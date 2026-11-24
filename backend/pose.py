"""Per-session measurements from MediaPipe's 33 normalized landmarks."""

import math
from collections import deque
from backend.neckon import NeckMonitor
from backend.calibration import PostureReference, raw_posture
from backend.placement import hand_regions, hand_issue
from uuid import uuid4


LIMITS = {
    "interview": {"head_tilt": 7, "shoulder_height_difference": 0.08, "torso_lean": 8, "body_sway": 0.08},
    "presentation": {
        "head_tilt": 10,
        "shoulder_height_difference": 0.13,
        "torso_lean": 13,
        "body_sway": 0.18,
    },
}


def offset_angle(dx, dy):
    return math.degrees(math.atan2(abs(dx), abs(dy)))


def visible_points(points, width, height, threshold):
    return {
        i: (p.x * width, p.y * height, min(p.visibility, p.presence))
        for i, p in enumerate(points)
        if 0 <= p.x <= 1 and 0 <= p.y <= 1 and min(p.visibility, p.presence) >= threshold
    }


def motion_range(history, now, x, width, repeated_only):
    history.append((now, x))
    while history[0][0] < now - 3:
        history.popleft()
    positions = [p for _, p in history]
    # Require two substantial reversals before treating travel as presentation sway.
    if repeated_only:
        pivot = extreme = positions[0]
        direction = turns = 0
        for pos in positions[1:]:
            if not direction:
                if abs(pos - pivot) >= 0.06 * width:
                    direction = 1 if pos > pivot else -1
                    extreme = pos
            elif direction * (pos - extreme) >= 0:
                extreme = pos
            elif direction * (extreme - pos) >= 0.06 * width:
                turns += 1
                direction *= -1
                extreme = pos
        if turns < 2:
            return 0.0
    return (max(positions) - min(positions)) / width


def unmeasured(status="unavailable", reason="body_not_visible"):
    return {
        "measurement_status": status,
        "measurement_reason": reason,
        "features": None,
        "state": None,
        "event": None,
    }


class PoseSession:
    def __init__(self):
        self.neck_monitor = NeckMonitor()
        self.reference = PostureReference()
        self.reference_mode = None
        self.motion = deque(maxlen=240)
        self.last = None
        self.reset_event()

    def reset_event(self):
        self.issue = None
        self.since = None
        self.status = "NORMAL"
        self.recovered_at = None
        self.reported_observation = self.pending_observation = None
        self.observation_since = None

    def report_observation(self, observation, state_changed, now):
        if observation != self.pending_observation:
            self.pending_observation, self.observation_since = observation, now
        if state_changed or (observation and observation != self.reported_observation
                             and now - self.observation_since >= 2.0):
            self.reported_observation = observation
            return True
        return False

    def interrupt(self):
        self.reset_event()
        self.motion.clear()
        self.neck_monitor.reset_tracking()
        self.reference.interrupt()

    def observe_neck(self, points, now):
        features, measured_state, reason = self.neck_monitor.observe(points, now)
        if reason:
            self.reset_event()
            if reason in {"calibrating", "view_inference"}:
                return unmeasured("calibrating", reason)
            self.neck_monitor.level = "GOOD"
            self.neck_monitor.bad_since = None
            self.neck_monitor.good_frames = 0
            return unmeasured(reason=reason)
        before = self.status
        observation = features.pop("observation")
        event = None
        alert = measured_state in {"CAUTION", "WARNING"}
        if alert:
            self.recovered_at = None
            if self.since is None:
                self.since = now
            if self.report_observation(observation, before != measured_state, now):
                event = {
                    "event_id": str(uuid4()), "mode": "neck", "rubric": None,
                    "type": "forward_head_proxy", "severity": measured_state.lower(),
                    "started_at": self.since, "duration_sec": round(now-self.since, 3),
                    "confidence": features["landmark_visibility"], "metrics": {**features, "observation": observation},
                }
        else:
            if before in {"CAUTION", "WARNING"}:
                self.recovered_at = now
            if self.recovered_at is not None and now-self.recovered_at < 1.2:
                measured_state = "RECOVERED"
            self.since = None
        self.status = measured_state
        return {"measurement_status": "valid", "features": features, "state": measured_state,
                "event": event, "active_issue": "forward_head_proxy" if alert else None,
                "issue_duration_sec": round(now-self.since, 3) if alert else 0.0}

    def frontal(self, p, mode, now, points):
        if not all(i in p for i in (7, 8, 11, 12)):
            return None, "upper_body_not_visible"
        if mode == "interview" and not all(i in p for i in (15, 16, 25, 26)):
            return None, "wrist_or_knee_not_visible"
        left, right = p[11], p[12]
        width = abs(left[0] - right[0])
        if width < 2 or abs(p[7][0] - p[8][0]) < 2:
            return None, "upper_body_not_visible"
        cx, cy = (left[0] + right[0]) / 2, (left[1] + right[1]) / 2
        required = (7, 8, 11, 12, 15, 16, 25, 26) if mode == "interview" else (7, 8, 11, 12)
        features = {
            "head_tilt": offset_angle(p[7][1] - p[8][1], p[7][0] - p[8][0]),
            "shoulder_height_difference": abs(left[1] - right[1]) / width,
            "body_sway": motion_range(self.motion, now, cx, width, True) if self.reference.baseline else 0.,
            "landmark_visibility": min(p[i][2] for i in required),
        }
        if not all(i in p for i in (23, 24)):
            return None, "hips_not_visible"
        raw = raw_posture(points, p, self.frame_size[0], self.frame_size[1], mode)
        if raw is None:
            return None, "reference_view_required"
        if mode == "interview" and raw['forward'] is None:
            return None, "forward_proxy_unavailable"
        if self.reference.baseline is None and abs(raw['head_shoulder_angle']) > 15:
            return None, "reference_neutral_required"
        reason = self.reference.observe(raw, now)
        if reason:
            return None, reason
        features.update(self.reference.relative(raw))
        features['landmark_visibility'] = min(features['landmark_visibility'], p[23][2], p[24][2])
        if mode == "interview":
            features.update(hand_regions(p, width, rubric=self.rubric,
                                         knee_reference=self.reference.baseline["knee"]))
        return features, None

    def transition(self, issue, now):
        if self.recovered_at is not None:
            age = now - self.recovered_at
            if age < 3.2 and (not issue or self.issue == issue):
                self.status = "RECOVERED" if age < 1.2 else "COOLDOWN"
                return
            self.reset_event()
        if not issue:
            if self.status in {"CAUTION", "WARNING"}:
                self.status, self.recovered_at = "RECOVERED", now
            else:
                self.reset_event()
            return
        if issue != self.issue:
            self.issue, self.since = issue, now
        duration = round(now - self.since, 6)
        self.status = "WARNING" if duration >= 5 else "CAUTION" if duration >= 2 else "CANDIDATE"

    def observe(self, points, width, height, mode, rubric, now):
        if self.last is not None and (now < self.last or now - self.last > 1):
            self.interrupt()
        self.last = now
        if mode == "neck":
            return self.observe_neck(points, now)
        if self.reference_mode != (mode, rubric):
            self.reference = PostureReference()
            self.reference_mode = (mode, rubric)
            self.reset_event()
            self.motion.clear()
        self.rubric = rubric
        self.frame_size = (width, height)
        p = visible_points(
            points, width, height, {"interview": 0.65, "presentation": 0.55}[mode]
        )
        features, reason = self.frontal(p, mode, now, points)
        if reason:
            self.reset_event()
            self.motion.clear()
            collecting = reason in {"reference_collecting", "reference_unstable", "reference_timeout"}
            if not collecting:
                self.reference.interrupt()
            return {**unmeasured("calibrating" if collecting else "unavailable", reason),
                    "calibration": self.reference.packet(now)}
        ratios = {k: features[k] / limit for k, limit in LIMITS[mode].items() if k in features}
        if mode == "interview":
            placement = hand_issue(features, rubric)
            ratios["hand_placement"] = 1.4 if placement else 0
        issue = max(ratios, key=ratios.get)
        before = self.status
        self.transition(issue if ratios[issue] > 1 else None, now)
        event = None
        alert = self.status in {"CAUTION", "WARNING"}
        observation = placement if issue == "hand_placement" else issue
        if alert and self.report_observation(observation, self.status != before, now):
            metrics = (
                {k: features[k] for k in ("left_hand_region", "right_hand_region", "knee_distance", "knee_reference_distance",
                                            "knee_placement_status", "hand_placement_status", "placement_issues")}
                if issue == "hand_placement"
                else {issue: features[issue]}
            )
            if issue == "hand_placement":
                metrics["observation"] = observation
            event = {
                "event_id": str(uuid4()),
                "mode": mode,
                "rubric": rubric or None,
                "type": issue,
                "severity": self.status.lower(),
                "started_at": self.since,
                "duration_sec": round(now - self.since, 3),
                "confidence": features["landmark_visibility"],
                "metrics": metrics,
            }
        return {
            "measurement_status": "valid",
            "calibration": self.reference.packet(now),
            "features": features,
            "state": self.status,
            "event": event,
            "active_issue": self.issue if alert else None,
            "issue_duration_sec": round(now - self.since, 3) if alert else 0.0,
        }
