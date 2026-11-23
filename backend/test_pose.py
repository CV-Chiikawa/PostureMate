import math
import unittest
from types import SimpleNamespace

from backend.pose import PoseSession


def point(x, y, visibility=1):
    return SimpleNamespace(x=x, y=y, z=0.0, visibility=visibility, presence=1)


def side(shift=0, mirror=False, drop=0):
    pose = [point(0, 0, 0) for _ in range(33)]
    for i, x, y in [
        (0, 0.43 - shift, 0.27 + drop),
        (7, 0.55 - shift, 0.28 + drop),
        (11, 0.58, 0.46),
        (23, 0.49, 0.8),
    ]:
        pose[{7: 8, 11: 12, 23: 24}.get(i, i) if mirror else i] = point(1 - x if mirror else x, y)
    pose[7 if mirror else 8] = point(0.53 if mirror else 0.47, 0.28, 0.24)
    pose[11 if mirror else 12] = point(0.50, 0.46, 0.24)
    return pose


def front(spread=0.02, dx=0, hands_y=0.85):
    pose = [point(0, 0, 0) for _ in range(33)]
    for i, x, y in [
        (0, 0.5, 0.18),
        (7, 0.54, 0.20),
        (8, 0.46, 0.20),
        (11, 0.60, 0.32),
        (12, 0.40, 0.32),
        (23, 0.56, 0.65),
        (24, 0.44, 0.65),
        (25, 0.5 + spread / 2, 0.85),
        (26, 0.5 - spread / 2, 0.85),
        (15, 0.5 + spread / 2, hands_y),
        (16, 0.5 - spread / 2, hands_y),
    ]:
        pose[i] = point(x + dx, y)
    return pose


def sequence(engine, mode, frames, rubric="", start=0):
    return [
        engine.observe(p, 640, 480, mode, rubric, round(start + i * 0.2, 3)) for i, p in enumerate(frames)
    ]


class PoseTests(unittest.TestCase):
    def test_five_seconds_of_baseline_after_view_lock_in_all_neck_views(self):
        for pose in (front(), side(), side(mirror=True)):
            with self.subTest(nose_x=pose[0].x):
                packets = sequence(PoseSession(), "neck", [pose] * 37)
                self.assertEqual(packets[9]["measurement_reason"], "view_inference")
                self.assertEqual(packets[10]["measurement_reason"], "calibrating")  # 2.0s, view locked
                for packet in packets[10:35]:  # Through 6.8s after session start.
                    self.assertEqual(packet["measurement_status"], "calibrating")
                    self.assertIsNone(packet["state"])
                    self.assertIsNone(packet["event"])
                self.assertEqual(packets[36]["state"], "NORMAL")

    def test_missing_pose_does_not_count_toward_initial_baseline(self):
        for pose in (front(), side()):
            with self.subTest(nose_x=pose[0].x):
                # 2 seconds of usable pose after view lock, 4 seconds away, then 3 more usable seconds.
                packets = sequence(PoseSession(), "neck", [pose] * 21 + [[]] * 20 + [pose] * 17)
                self.assertEqual(packets[40]["measurement_status"], "unavailable")
                self.assertEqual(packets[55]["measurement_status"], "calibrating")
                self.assertEqual(packets[57]["state"], "NORMAL")

    def test_neckon_front_uses_relative_depth_after_view_lock_and_baseline(self):
        engine = PoseSession()
        frames = sequence(engine, "neck", [front()] * 42)
        self.assertEqual(frames[8]["measurement_status"], "calibrating")
        self.assertEqual(frames[20]["measurement_status"], "calibrating")
        self.assertEqual(frames[-1]["state"], "NORMAL")
        self.assertEqual(frames[-1]["features"]["neck_view"], "FRONT")
        mild = front()
        mild[0].z = -0.18
        self.assertEqual(sequence(engine, "neck", [mild] * 8, start=8.4)[-1]["state"], "CAUTION")
        strong = front()
        strong[0].z = -0.40
        seen = sequence(engine, "neck", [strong] * 10, start=10)
        self.assertEqual(seen[-1]["state"], "WARNING")
        self.assertEqual(seen[-1]["features"]["neck_score"], 4)
        lost = sequence(engine, "neck", [[]] * 5, start=12)
        self.assertTrue(all(p["event"] is None and p["features"] is None for p in lost))

    def test_neckon_rejects_frontal_distance_change_but_accepts_shallow_side_visibility(self):
        engine = PoseSession()
        sequence(engine, "neck", [front()] * 42)
        wide = front()
        wide[7].x, wide[8].x = 0.59, 0.41
        self.assertEqual(sequence(engine, "neck", [wide] * 5, start=8.4)[-1]["measurement_reason"], "too_close")
        oblique = side()
        engine = PoseSession()
        sequence(engine, "neck", [oblique] * 42)
        oblique[7].visibility = 0.40
        result = sequence(engine, "neck", [oblique] * 4, start=8.4)[-1]
        self.assertEqual(result["state"], "NORMAL")
        self.assertEqual(result["features"]["neck_view"], "SIDE_LEFT")
    def test_forward_trunk_lean_in_interview_even_when_shoulders_are_level(self):
        pose = front()
        for i in (11, 12):
            pose[i].world = SimpleNamespace(y=-.48, z=-.14)
        for i in (23, 24):
            pose[i].world = SimpleNamespace(y=0, z=0)
        result = sequence(PoseSession(), "interview", [pose] * 26, "A")[-1]
        self.assertEqual(result["state"], "WARNING")
        self.assertEqual(result["event"]["type"], "torso_lean")
        self.assertAlmostEqual(result["features"]["torso_lean"], 16.26, places=1)

    def test_neckon_side_baseline_then_sustained_warning_and_recovery(self):
        for mirror in (False, True):
            engine = PoseSession()
            neutral, forward = side(mirror=mirror), side(0.06, mirror)
            warm = sequence(engine, "neck", [neutral] * 42)
            self.assertEqual(warm[24]["measurement_status"], "calibrating")
            self.assertEqual(warm[-1]["features"]["neck_view"], "SIDE_RIGHT" if mirror else "SIDE_LEFT")
            moved = sequence(engine, "neck", [forward] * 16, start=8.4)
            self.assertEqual([m["event"]["severity"] for m in moved if m["event"]], ["caution", "warning"])
            self.assertEqual(moved[-1]["state"], "WARNING")
            self.assertAlmostEqual(moved[-1]["features"]["nose_forward_delta"], .06)
            self.assertGreaterEqual(moved[-1]["features"]["neck_score"], 4)
            recovery = sequence(engine, "neck", [neutral] * 18, start=11.6)
            self.assertIn("RECOVERED", [m["state"] for m in recovery])
            self.assertEqual(recovery[-1]["state"], "NORMAL")

    def test_lost_landmarks_do_not_replay_prior_warning_on_upright_return(self):
        engine = PoseSession()
        frames = sequence(engine, "neck", [side()]*42 + [side(.06)]*8 + [[]]*3 + [side()])
        self.assertEqual(frames[49]["state"], "WARNING")
        self.assertEqual(frames[-1]["state"], "NORMAL")
        self.assertIsNone(frames[-1]["event"])

    def test_neck_occlusion_and_time_gap_break_warning_duration(self):
        engine = PoseSession()
        sequence(engine, "neck", [side()] * 42 + [side(0.06)] * 8)
        lost = engine.observe([], 640, 480, "neck", "", 10.)
        self.assertIsNone(lost["state"])
        for stamp in (12., 22.):
            new = engine.observe(side(.06), 640, 480, "neck", "", stamp)
            self.assertEqual(new["state"], "CAUTION")
            self.assertEqual(new["issue_duration_sec"], 0)

    def test_neck_accepts_desk_crop_and_reports_deep_look_down(self):
        p = side()
        p[23] = point(0, 0, 0)
        engine = PoseSession()
        self.assertEqual(sequence(engine, "neck", [p] * 42)[-1]["state"], "NORMAL")
        lost = sequence(engine, "neck", [side(drop=.18)] * 8, start=8.4)[-1]
        self.assertEqual(lost["measurement_reason"], "look_down")
        self.assertIsNone(lost["event"])

    def test_same_seated_pose_distinguishes_rubrics_and_raised_hands(self):
        for spread, hands_y, rubric, expected in [
            (0.02, 0.85, "A", "NORMAL"),
            (0.02, 0.85, "B", "WARNING"),
            (0.14, 0.85, "B", "NORMAL"),
            (0.14, 0.85, "A", "WARNING"),
            (0.14, 0.50, "B", "WARNING"),
        ]:
            last = sequence(PoseSession(), "interview", [front(spread, hands_y=hands_y)] * 26, rubric)[-1]
            self.assertEqual(last["state"], expected)
            if expected == "WARNING":
                self.assertEqual(last["event"]["type"], "hand_placement")

    def test_invisible_or_out_of_frame_wrist_blocks_interview_only(self):
        for bad in [point(0.5, 0.5, 0.1), point(1.2, 0.5), point(float("nan"), 0.5)]:
            pose = front()
            pose[15] = bad
            self.assertEqual(
                sequence(PoseSession(), "interview", [pose], "A")[0]["measurement_reason"],
                "wrist_or_knee_not_visible",
            )
            self.assertEqual(sequence(PoseSession(), "presentation", [pose])[0]["state"], "NORMAL")

    def test_presentation_allows_walking_but_detects_repeated_sway_and_persistent_lean(self):
        straight = [front(dx=i * 0.002) for i in range(45)]
        self.assertTrue(
            all(v["state"] == "NORMAL" for v in sequence(PoseSession(), "presentation", straight))
        )
        repeated = [front(dx=0.07 * math.sin(i * math.pi / 4)) for i in range(60)]
        packets = sequence(PoseSession(), "presentation", repeated)
        self.assertIn("body_sway", [v["event"]["type"] for v in packets if v["event"]])
        lean = front()
        lean[23], lean[24] = point(0.44, 0.65), point(0.32, 0.65)
        self.assertEqual(
            sequence(PoseSession(), "presentation", [lean] * 26)[-1]["event"]["type"], "torso_lean"
        )

    def test_same_small_repeated_motion_triggers_only_interview(self):
        poses = [front(dx=0.014 * math.sin(i * math.pi / 4)) for i in range(60)]
        for mode, rubric, expected in [("interview", "A", True), ("presentation", "", False)]:
            events = [v["event"] for v in sequence(PoseSession(), mode, poses, rubric) if v["event"]]
            self.assertEqual(any(e["type"] == "body_sway" for e in events), expected)
