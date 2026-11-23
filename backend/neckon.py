"""Headless port of NeckOn AI d57a911, posture_monitor_ai/Finally.

Coordinates and z are the image-normalized Pose landmarks used by NeckOn.
World-space z and pixel-aspect corrections would change its thresholds.
"""

import math
from collections import deque
from dataclasses import dataclass
from statistics import mean, median

from backend.neckon_view import ViewInference, clamp01

BASELINE_SECONDS = 5.0

@dataclass
class NeckObservation:
    points: list
    face_width: float | None = None
    face_nose: tuple | None = None


def averaged(history, sample):
    history.append(sample)
    return {key: mean(row[key] for row in history) for key in sample}


def front_metrics(p):
    nose, left, right, ls, rs = (p[i] for i in (0, 7, 8, 11, 12))
    width = abs(left.x - right.x)
    return dict(
        head=left.y - right.y,
        shoulder=ls.y - rs.y,
        offset=nose.x - (ls.x + rs.x) / 2,
        nose_z=nose.z,
        ear_z=(left.z + right.z) / 2,
        nose_y=nose.y,
        width=width,
        ratio=width / (abs(ls.x - rs.x) + 1e-6),
    )


def front_score(m, base):
    distance = m["width"] / (base["width"] + 1e-6)
    head, shoulder, offset = (abs(m[k] - base[k]) for k in ("head", "shoulder", "offset"))
    nose, ear = (base[k] - m[k] for k in ("nose_z", "ear_z"))
    drop, ratio = (m[k] - base[k] for k in ("nose_y", "ratio"))
    if distance > 1.60 or distance < 0.72:
        return None, "too_close" if distance > 1.60 else "too_far"
    if head > 0.095 or offset > 0.120 or (head > 0.070 and offset > 0.060):
        return None, "face_front"

    def norm(value, threshold):
        return min(2.5, max(0.0, value) / threshold)

    depth = 1.15 * norm(nose, 0.16) + 0.90 * norm(ear, 0.10)
    lower, size = norm(drop, 0.080), 0.75 * norm(ratio, 0.10)
    tilt, shift, shoulders = 0.90 * norm(head, 0.040), 0.65 * norm(offset, 0.050), 0.45 * norm(shoulder, 0.035)
    forward = depth + lower + size
    imbalance = tilt + shift + shoulders
    if forward < 1.15 and imbalance < 1.05:
        score = 0
    elif forward >= 2.55 or (forward >= 2.05 and imbalance >= 1.15):
        score = 4
    elif forward >= 1.20 or imbalance >= 1.10:
        score = 2
    else:
        score = 0
    if forward >= imbalance:
        dominant = {"head_forward": depth, "head_lower": lower, "face_size": size}
    else:
        dominant = {"head_tilt": tilt, "head_offset": shift, "shoulder_height_difference": shoulders}
    return dict(
        neck_score=score,
        observation=max(dominant, key=dominant.get) if score else None,
        forward_score=forward,
        imbalance_score=imbalance,
        nose_depth_delta=nose,
        ear_depth_delta=ear,
        nose_drop=drop,
    ), None


def view_quality(side, yaw, profile):
    if yaw is not None:
        if (side == "SIDE_LEFT" and yaw >= 0) or (side == "SIDE_RIGHT" and yaw <= 0):
            return 0.0, "wrong_side"
        angle, low, high = abs(yaw), 0.08, 0.95
    else:
        angle, low, high = profile, 0.040, 0.190
    state = "too_front" if angle < low else "too_side" if angle > high else "ok"
    yaw_quality = 0.5 if yaw is None else clamp01(1 - abs(abs(yaw) - 0.58) / (0.435 + 1e-6))
    profile_quality = clamp01(1 - abs(profile - 0.125) / (0.075 + 1e-6))
    if state != "ok":
        return 0.25 * yaw_quality + 0.10 * profile_quality, state
    return 0.70 * yaw_quality + 0.30 * profile_quality, state


def side_score(cva, delta, nose, ear, drop):
    changes = (delta >= 1.8, nose >= 0.018, drop >= 0.040)
    score = (
        sum(changes)
        + (delta >= 5.0)
        + (nose >= 0.040)
        + (ear >= 0.055)
        + (drop >= 0.095)
        + (cva <= 60.0)
        + (sum(changes) >= 2)
    )
    bad = (
        (delta >= 3.5 and nose >= 0.027)
        or nose >= 0.077
        or (drop >= 0.082 and nose >= 0.022)
        or (cva <= 60.0 and delta >= 2.8)
        or score >= 4
    )
    return score, bad


class NeckMonitor:
    def __init__(self):
        self.inference = None
        self.view = None
        self.baseline = None
        self.reset_tracking()

    def reset_tracking(self):
        self.history = deque(maxlen=3)
        self.point_history = {side: deque(maxlen=3) for side in ("SIDE_LEFT", "SIDE_RIGHT")}
        self.samples = []
        self.baseline_elapsed = 0.0
        self.last_baseline_at = None
        self.grace_until = 0.0
        self.level = "GOOD"
        self.good_frames = 0
        self.bad_since = None
        if self.baseline is None:
            self.inference = self.view = None

    def side_pack(self, frame, side):
        p = frame.points
        nose = p[0]
        nx, ny = nose.x, nose.y
        if frame.face_nose is not None:
            fx, fy = frame.face_nose
            if abs(fx - nx) <= 0.035 and abs(fy - ny) <= 0.050:
                nx, ny = 0.75 * nx + 0.25 * fx, 0.75 * ny + 0.25 * fy
        ear, shoulder = (p[7], p[11]) if side == "SIDE_LEFT" else (p[8], p[12])
        ex = clamp01(ear.x + 0.14 * (ear.x - nx))
        ey = clamp01(ear.y + 0.06 * (shoulder.y - ear.y))
        m = averaged(
            self.point_history[side], dict(nx=nx, ny=ny, ex=ex, ey=ey, sx=shoulder.x, sy=shoulder.y)
        )
        if min(ear.visibility, shoulder.visibility) < 0.35:
            return None
        width = abs(p[8].x - p[7].x)
        both = min(p[7].visibility, p[8].visibility)
        yaw = (
            (nx - (p[7].x + p[8].x) / 2) / (width + 1e-6)
            if both >= 0.35 and width >= 0.03
            else None
        )
        scale = frame.face_width
        if scale is None or scale <= 0.05:
            scale = width if both > 0.35 and width > 0.03 else 0.18
        profile = abs(m["nx"] - m["ex"])
        quality, view = view_quality(side, yaw, profile)
        ear_forward = abs(m["ex"] - m["sx"])
        metrics = dict(
            cva=math.degrees(math.atan2(abs(m["ey"] - m["sy"]), ear_forward + 1e-6)),
            nose=abs(m["nx"] - m["sx"]),
            ear=ear_forward,
            ny=m["ny"],
            profile=profile,
            scale=scale,
        )
        return metrics, quality, view, yaw

    def save_baseline(self, values, now, quality=None):
        if values is None:
            self.last_baseline_at = None
            return
        if self.last_baseline_at is not None:
            self.baseline_elapsed += now - self.last_baseline_at
            self.samples.append((values, quality))
        self.last_baseline_at = now
        if self.baseline_elapsed < BASELINE_SECONDS:
            return
        if quality is not None and median(q for _, q in self.samples) < 0.18:
            self.baseline_elapsed = 0.0
            self.samples.clear()
            for history in self.point_history.values():
                history.clear()
            return
        aggregate = mean if self.view == "FRONT" else median
        self.baseline = {k: aggregate(m[k] for m, _ in self.samples) for k in self.samples[0][0]}
        self.samples.clear()
        self.grace_until = now + 0.5 if self.view != "FRONT" else now

    def observe(self, frame, now):
        if not isinstance(frame, NeckObservation):
            frame = NeckObservation(frame)
        p = frame.points
        if len(p) < 33:
            self.last_baseline_at = None
            self.history.clear()
            for history in self.point_history.values():
                history.clear()
            return None, None, "ear_or_shoulder_not_visible"
        if self.view is None:
            if self.inference is None:
                self.inference = ViewInference(now)
            self.view = self.inference.update(p, now)
            if self.view:
                self.last_baseline_at = now
            return None, None, "view_inference" if self.view is None else "calibrating"
        if self.view == "FRONT":
            m = averaged(self.history, front_metrics(p))
            if self.baseline is None:
                self.save_baseline(m, now)
                return None, None, "calibrating"
            features, reason = front_score(m, self.baseline)
            if reason:
                return None, None, reason
            bad = features["neck_score"] >= 4
            vis = min(p[i].visibility for i in (0, 7, 8, 11, 12))
        else:
            opposite = "SIDE_RIGHT" if self.view == "SIDE_LEFT" else "SIDE_LEFT"
            pack = self.side_pack(frame, self.view)
            other = self.side_pack(frame, opposite)
            if self.baseline is None:
                valid = pack and pack[2] == "ok"
                self.save_baseline(pack[0] if valid else None, now, pack[1] if valid else 0.0)
                return None, None, "calibrating" if valid else "side_view_required"
            if pack is None:
                self.point_history[self.view].clear()
                return None, None, "ear_or_shoulder_not_visible"
            m = averaged(self.history, pack[0])
            base = self.baseline
            scale = min(1.35, max(0.75, m["scale"] / base["scale"]))
            delta = base["cva"] - m["cva"]
            nose, ear = m["nose"] / scale - base["nose"], m["ear"] / scale - base["ear"]
            drop, profile = (m["ny"] - base["ny"]) / scale, m["profile"] / scale
            _, view = view_quality(self.view, pack[3], profile)
            if view in ("too_front", "wrong_side"):
                reason = "side_view_required"
            elif view == "too_side":
                extreme = abs(pack[3] or 0.0) >= 1.45 or profile >= 0.205
                reason = (
                    "too_side"
                    if extreme and delta < 1.8 and nose < 0.018 and drop < 0.040
                    else None
                )
            elif other and other[1] > pack[1] + 0.40 and delta < 2.0 and nose < 0.020:
                reason = "side_view_required"
            else:
                reason = "look_down" if drop >= 0.160 and nose <= 0.020 else None
            if reason:
                self.point_history[self.view].clear()
                return None, None, reason
            score, bad = side_score(m["cva"], delta, nose, ear, drop)
            if now < self.grace_until:
                score = 0
                bad = (
                    (delta >= 3.5 and nose >= 0.027)
                    or nose >= 0.077
                    or (drop >= 0.082 and nose >= 0.022)
                    or (m["cva"] <= 60 and delta >= 2.8)
                )
            features = dict(
                neck_score=score,
                cva=m["cva"],
                cva_delta=delta,
                nose_forward_delta=nose,
                ear_forward_delta=ear,
                nose_drop=drop,
            )
            if nose >= 0.018 or ear >= 0.055:
                features["observation"] = "head_forward"
            elif drop >= 0.040:
                features["observation"] = "head_lower"
            else:
                features["observation"] = "neck_angle"
            joints = (7, 11) if self.view == "SIDE_LEFT" else (8, 12)
            vis = min(p[i].visibility for i in joints)

        self.good_frames = 0 if bad or features["neck_score"] >= 2 else self.good_frames + 1
        if bad:
            if self.level != "BAD":
                self.bad_since = now
            self.level = "BAD"
        elif features["neck_score"] >= 2:
            self.level = "CAUTION"
        elif self.good_frames >= 2:
            self.level = "GOOD"
        if self.level != "BAD":
            self.bad_since = None
        alert = self.bad_since is not None and now - self.bad_since >= 0.5
        features.update(neck_view=self.view, neck_level=self.level, landmark_visibility=vis)
        state = "WARNING" if alert else "NORMAL" if self.level == "GOOD" else "CAUTION"
        return features, state, None
