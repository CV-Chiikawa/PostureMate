"""Session-relative reference for a fixed single-camera view, not a medical norm."""
import math
from statistics import median

SECONDS = 5.0
# Beta heuristics: robust stable-window capture excludes transient model outliers.
STABILITY = {'head': 3.0, 'shoulder': .04, 'lateral': 4.0, 'forward': 5.0,
             'scale': .12, 'torso_ratio': .15, 'knee': .12}


MIN_SAMPLES = 15
TIMEOUT_SECONDS = 15.0
MIN_INLIER_FRACTION = .80
MIN_RETAINED_SAMPLES = math.ceil(MIN_SAMPLES/MIN_INLIER_FRACTION)


class PostureReference:
    def __init__(self):
        self.baseline = None
        self.samples = []
        self.last = None
        self.started = None
        self.reason = 'reference_collecting'
        self.unstable_feature = None
        self.accepted_samples = 0
        self.capture_count = 0

    def interrupt(self):
        self.samples.clear()
        self.last = None
        # Reset observation continuity, but keep the overall attempt timeout clock.
        self.accepted_samples = 0
        self.unstable_feature = None

    def packet(self, now):
        elapsed = now-self.samples[0][0] if self.samples else 0.
        progress = min(.95, elapsed/SECONDS, self.accepted_samples/MIN_SAMPLES)
        return {'status': 'ready' if self.baseline else 'collecting',
                'progress': 1. if self.baseline else max(0.,progress),
                'required_seconds': SECONDS, 'minimum_samples': MIN_SAMPLES,
                'sample_count': self.capture_count if self.baseline else len(self.samples),
                'accepted_samples': self.accepted_samples,
                'unstable_feature': self.unstable_feature}

    def _inliers(self):
        rows = [row for _,row in self.samples]
        good = [True]*len(rows)
        worst, worst_score = None, 0.
        drifting = False
        for key,tolerance in STABILITY.items():
            values = [row[key] for row in rows]
            if key in ('forward','knee') and all(v is None for v in values):
                continue
            finite = [v for v in values if v is not None and math.isfinite(v)]
            if not finite:
                return [], key
            center = median(finite)
            scale = max(abs(center),1e-6) if key in ('scale','torso_ratio') else 1.
            limit = tolerance*scale
            mask = [v is not None and math.isfinite(v) and abs(v-center)<=limit for v in values]
            good = [a and b for a,b in zip(good,mask)]
            score = 1-sum(mask)/len(mask)
            # A robust center alone could normalize a slow drift. Check temporal thirds too.
            third = max(1,len(rows)//3)
            first = [v for v in values[:third] if v is not None and math.isfinite(v)]
            last = [v for v in values[-third:] if v is not None and math.isfinite(v)]
            drift = abs(median(first)-median(last))/limit if first and last else float('inf')
            if len(rows)>=MIN_SAMPLES and drift>1:
                drifting = True
                score = max(score,drift)
            if score>worst_score:
                worst,worst_score = key,score
        accepted = [row for row,ok in zip(rows,good) if ok]
        recent = good[-5:]
        stable = (sum(good)>=MIN_INLIER_FRACTION*len(rows)
                  and sum(recent)>=MIN_INLIER_FRACTION*len(recent) and not drifting)
        return accepted, None if stable else worst

    def observe(self, raw, now):
        if self.baseline:
            base = self.baseline
            if (not .75 <= raw['scale']/base['scale'] <= 1.30
                    or not .70 <= raw['torso_ratio']/base['torso_ratio'] <= 1.40
                    or abs(raw['aspect']/base['aspect']-1) > .02):
                return 'framing_changed'
            return None
        if self.last is not None and (now<self.last or now-self.last>1):
            self.interrupt()
        self.last = now
        if self.started is None:
            self.started = now
        self.samples.append((now,raw))
        # Retain the boundary predecessor and enough raw rows to yield 15 inliers.
        # Real frame intervals rarely divide five seconds exactly.
        while len(self.samples)>MIN_RETAINED_SAMPLES and now-self.samples[1][0]>=SECONDS-1e-8:
            self.samples.pop(0)
        accepted,blocked = self._inliers()
        self.accepted_samples = len(accepted)
        self.unstable_feature = blocked
        self.reason = 'reference_unstable' if blocked else 'reference_collecting'
        elapsed = now-self.samples[0][0]
        if elapsed>=SECONDS-1e-8 and len(accepted)>=MIN_SAMPLES and blocked is None:
            self.baseline = {key: median(row[key] for row in accepted)
                             if all(row[key] is not None for row in accepted) else None
                             for key in raw}
            self.capture_count = len(self.samples)
            self.samples.clear()
            return None
        if now-self.started>=TIMEOUT_SECONDS:
            self.reason = 'reference_timeout'
        return self.reason

    def relative(self, raw):
        base = self.baseline
        forward = (max(0., raw['forward']-base['forward'])
                   if raw['forward'] is not None and base['forward'] is not None else None)
        lateral = abs(raw['lateral']-base['lateral'])
        return {'head_tilt': abs(raw['head']-base['head']),
                'shoulder_height_difference': abs(raw['shoulder']-base['shoulder']),
                'torso_lateral_lean': lateral,
                'torso_forward_proxy': forward,
                'raw_torso_lateral_lean': raw['lateral'],
                'raw_torso_forward_proxy': raw['forward'],
                'baseline_torso_lateral_lean': base['lateral'],
                'baseline_torso_forward_proxy': base['forward'],
                'torso_lean': max(lateral, forward or 0.)}


def raw_posture(points, p, width, height, mode):
    ls, rs, lh, rh = (p[i] for i in (11,12,23,24))
    sw = math.dist(ls[:2], rs[:2])
    sx, sy = (ls[0]+rs[0])/2, (ls[1]+rs[1])/2
    hx, hy = (lh[0]+rh[0])/2, (lh[1]+rh[1])/2
    if sw < .08*width or hy-sy < .04*height:
        return None
    head = math.degrees(math.atan2(p[7][1]-p[8][1], abs(p[7][0]-p[8][0])))
    shoulder_angle = math.degrees(math.atan2(ls[1]-rs[1], abs(ls[0]-rs[0])))
    if abs(p[7][0]-p[8][0])/sw < .15:
        return None
    forward = None
    if mode == 'interview':
        joints = [getattr(points[i], 'world', None) for i in (11,12,23,24)]
        if all(joints):
            a,b,c,d = joints
            vertical = c.y+d.y-a.y-b.y
            depth = c.z+d.z-a.z-b.z
            if all(math.isfinite(v) for v in (vertical,depth)) and vertical > 0:
                # Retain the signed proxy before subtracting the reference bias.
                forward = math.degrees(math.atan2(depth, vertical))
    return {'head': head, 'shoulder': (ls[1]-rs[1])/sw,
            'lateral': math.degrees(math.atan2(sx-hx, hy-sy)), 'forward': forward,
            'scale': sw/width, 'torso_ratio': math.hypot(sx-hx, sy-hy)/sw,
            'aspect': width/height, 'head_shoulder_angle': head-shoulder_angle,
            'knee': abs(p[25][0]-p[26][0])/abs(ls[0]-rs[0]) if mode=='interview' else None}
