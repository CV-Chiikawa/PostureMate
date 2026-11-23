import unittest
from backend.calibration import PostureReference


def sample(**changes):
    raw=dict(head=0.,shoulder=0.,lateral=0.,forward=10.,scale=.3,torso_ratio=1.4,knee=.8,aspect=16/9,head_shoulder_angle=0.)
    return {**raw,**changes}


class ReferenceNoiseTests(unittest.TestCase):
    def test_periodic_single_frame_outliers_do_not_block_reference_forever(self):
        e=PostureReference()
        for i in range(41):
            e.observe(sample(forward=28.,knee=1.3) if i%7==3 else sample(),round(i*.2,3))
        self.assertIsNotNone(e.baseline)
        self.assertAlmostEqual(e.baseline['knee'],.8)
        self.assertAlmostEqual(e.baseline['forward'],10.)

    def test_one_outlier_does_not_erase_all_progress(self):
        e=PostureReference()
        for i in range(12):e.observe(sample(),i*.2)
        e.observe(sample(knee=1.3),2.4)
        p=e.packet(2.4)
        self.assertGreaterEqual(p['progress'],.4)
        self.assertGreaterEqual(p['sample_count'],12)

    def test_continuous_motion_times_out_with_metric_instead_of_false_normal(self):
        e=PostureReference()
        for i in range(91):reason=e.observe(sample(knee=.4 if i%2 else 1.2),i*.2)
        self.assertIsNone(e.baseline)
        self.assertEqual(reason,'reference_timeout')
        self.assertEqual(e.packet(18)['unstable_feature'],'knee')
        self.assertLessEqual(len(e.samples),27)

    def test_slow_drift_cannot_be_accepted_as_stationary(self):
        e=PostureReference()
        for i in range(40):e.observe(sample(head=i*.5),i*.2)
        self.assertIsNone(e.baseline)

    def test_settled_pose_recovers_after_timeout_without_accepting_motion(self):
        e=PostureReference()
        for i in range(81):e.observe(sample(knee=.4 if i%2 else 1.2),i*.2)
        for i in range(81,112):e.observe(sample(),i*.2)
        self.assertIsNotNone(e.baseline)
        self.assertAlmostEqual(e.baseline['knee'],.8)

    def test_gap_and_missing_data_still_require_new_observation_window(self):
        e=PostureReference()
        for i in range(16):e.observe(sample(),i*.2)
        e.interrupt()
        for i in range(25):e.observe(sample(),10+i*.2)
        self.assertIsNone(e.baseline)
        e.observe(sample(),15)
        self.assertIsNotNone(e.baseline)

    def test_reference_medians_reject_nonfinite_samples(self):
        e=PostureReference()
        for i in range(41):e.observe(sample(knee=float('nan')) if i%7==3 else sample(),i*.2)
        self.assertIsNotNone(e.baseline)
        self.assertAlmostEqual(e.baseline['knee'],.8)

    def test_lower_frame_rate_can_still_collect_minimum_samples(self):
        e=PostureReference()
        for i in range(20):e.observe(sample(),i*.4)
        self.assertIsNotNone(e.baseline)

    def test_timeout_packet_keeps_posture_events_suppressed(self):
        from backend.pose import PoseSession
        from backend.test_pose import front
        e=PoseSession()
        for i in range(91):
            p=front();p[7].y+=.02 if i%2 else 0
            r=e.observe(p,640,480,'interview','A',i*.2)
        self.assertEqual(r['measurement_status'],'calibrating')
        self.assertEqual(r['measurement_reason'],'reference_timeout')
        self.assertIsNone(r['event'])
        self.assertIsNone(r['state'])

    def test_incomplete_reference_never_shows_one_hundred_percent(self):
        e=PostureReference()
        for i in range(26):e.observe(sample(head=i*.2),i*.2)
        self.assertIsNone(e.baseline)
        self.assertLess(e.packet(5)['progress'],1.)

    def test_real_frame_interval_need_not_divide_five_seconds(self):
        e=PostureReference()
        for i in range(80):e.observe(sample(),i*.203)
        self.assertIsNotNone(e.baseline)

    def test_jittered_monotonic_timestamps_can_complete_reference(self):
        import math
        e=PostureReference();now=0.
        for i in range(80):
            now+=.211+.003*math.sin(i)
            e.observe(sample(),now)
        self.assertIsNotNone(e.baseline)

    def test_low_frame_rate_with_sparse_noise_collects_enough_inliers(self):
        e=PostureReference()
        for i in range(80):
            e.observe(sample(knee=1.3) if i%7==3 else sample(),i*.4)
        self.assertIsNotNone(e.baseline)
        self.assertAlmostEqual(e.baseline['knee'],.8)

    def test_missing_data_does_not_restart_the_delay_notice_clock(self):
        e=PostureReference();e.observe(sample(),0)
        e.interrupt()
        reason=e.observe(sample(),16)
        self.assertEqual(reason,'reference_timeout')
        self.assertIsNone(e.baseline)
        self.assertEqual(e.packet(16)['progress'],0)
