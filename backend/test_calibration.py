import math
import unittest
from types import SimpleNamespace
from backend.pose import PoseSession
from backend.test_pose import front


def observe(engine, p, mode='interview', now=0):
    return engine.observe(p,640,480,mode,'A' if mode=='interview' else '',now)


def warm(engine,p,mode='interview',start=0):
    return [observe(engine,p,mode,round(start+i*.2,3)) for i in range(26)]


def depth(p,z):
    for i in (11,12): p[i].world=SimpleNamespace(y=-.48,z=z)
    for i in (23,24): p[i].world=SimpleNamespace(y=0.,z=0.)
    return p


class CalibrationTests(unittest.TestCase):
    def test_both_modes_collect_five_seconds_without_events(self):
        for mode in ('interview','presentation'):
            packets=warm(PoseSession(),front(),mode)
            self.assertTrue(all(p['measurement_status']=='calibrating' and p['event'] is None for p in packets[:-1]))
            self.assertEqual(packets[-1]['state'],'NORMAL')
            self.assertEqual(packets[-1]['calibration']['status'],'ready')

    def test_constant_depth_bias_is_not_a_posture_warning(self):
        e=PoseSession(); p=depth(front(),-.08)
        packets=warm(e,p)
        for i in range(26,60): r=observe(e,p,now=i*.2)
        self.assertEqual(r['state'],'NORMAL')
        self.assertAlmostEqual(r['features']['torso_forward_proxy'],0)
        self.assertGreater(r['features']['raw_torso_forward_proxy'],9)

    def test_added_forward_lean_is_relative_and_separate(self):
        e=PoseSession(); warm(e,depth(front(),-.08))
        for i in range(26,54): r=observe(e,depth(front(),-.25),now=i*.2)
        self.assertEqual(r['state'],'WARNING')
        self.assertAlmostEqual(r['features']['torso_lateral_lean'],0)
        self.assertGreater(r['features']['torso_forward_proxy'],15)

    def test_signed_baseline_detects_change_to_opposite_side(self):
        for mode in ('interview','presentation'):
            e=PoseSession(); p=front()
            for i in (23,24): p[i].x-=.05
            self.assertEqual(warm(e,p,mode)[-1]['state'],'NORMAL')
            q=front()
            for i in (23,24): q[i].x+=.05
            for i in range(26,54): r=observe(e,q,mode,i*.2)
            self.assertEqual(r['state'],'WARNING')
            self.assertGreater(r['features']['torso_lateral_lean'],20)

    def test_scale_change_requests_explicit_recalibration(self):
        e=PoseSession(); warm(e,front())
        p=front()
        for j in p: j.x=.5+(j.x-.5)*1.5
        r=observe(e,p,now=5.2)
        self.assertEqual(r['measurement_reason'],'framing_changed')
        self.assertIsNone(r['event'])
        self.assertEqual(observe(e,front(),now=5.4)['state'],'NORMAL')

    def test_start_button_motion_cannot_become_the_reference(self):
        e=PoseSession(); p=front()
        for i in range(40):
            q=front()
            q[7].y+=.02 if i%2 else 0
            r=observe(e,q,now=i*.2)
        self.assertEqual(r['measurement_status'],'calibrating')
        self.assertIsNone(r['event'])
        self.assertEqual(warm(e,p,start=8)[-1]['state'],'NORMAL')

    def test_dropout_during_calibration_restarts_valid_observation(self):
        e=PoseSession(); warmup=[observe(e,front(),now=i*.2) for i in range(15)]
        self.assertEqual(warmup[-1]['measurement_status'],'calibrating')
        self.assertEqual(observe(e,[],now=3)['measurement_status'],'unavailable')
        packets=warm(e,front(),start=4)
        self.assertTrue(all(p['state'] is None for p in packets[:-1]))
        self.assertEqual(packets[-1]['state'],'NORMAL')

    def test_single_position_adjustment_is_not_repeated_sway(self):
        e=PoseSession(); warm(e,front())
        packets=[observe(e,front(dx=.07),now=5.2+i*.2) for i in range(30)]
        self.assertTrue(all(p['state']=='NORMAL' for p in packets))

    def test_body_sway_still_detects_repeated_motion_in_both_modes(self):
        for mode in ('interview','presentation'):
            e=PoseSession(); warm(e,front(),mode)
            packets=[observe(e,front(dx=.07*math.sin(i*math.pi/4)),mode,5.2+i*.2) for i in range(60)]
            self.assertTrue(any(p['event'] and p['event']['type']=='body_sway' for p in packets))

    def test_camera_roll_can_be_a_reference_in_both_modes(self):
        for mode in ('interview','presentation'):
            e=PoseSession(); p=front(); angle=math.radians(10)
            for j in p:
                x,y=(j.x-.5)*640,(j.y-.5)*480
                j.x=.5+(math.cos(angle)*x-math.sin(angle)*y)/640
                j.y=.5+(math.sin(angle)*x+math.cos(angle)*y)/480
            self.assertEqual(warm(e,p,mode)[-1]['state'],'NORMAL')
            self.assertAlmostEqual(observe(e,p,mode,5.2)['features']['head_tilt'],0)

    def test_mode_switch_does_not_reuse_old_reference(self):
        e=PoseSession(); warm(e,front())
        self.assertEqual(observe(e,front(),'presentation',5.2)['measurement_status'],'calibrating')

    def test_missing_hips_cannot_silently_skip_torso_evaluation(self):
        e=PoseSession(); p=front(); p[23].visibility=.1
        self.assertEqual(observe(e,p)['measurement_reason'],'hips_not_visible')

class MissingForwardTests(unittest.TestCase):
    def test_missing_forward_geometry_never_claims_full_interview_normal(self):
        e=PoseSession(); p=front()
        for i in (11,12,23,24):
            if hasattr(p[i],'world'): del p[i].world
        r=observe(e,p)
        self.assertEqual(r['measurement_status'],'unavailable')
        self.assertEqual(r['measurement_reason'],'forward_proxy_unavailable')
        self.assertIsNone(r['state'])
        self.assertEqual(warm(e,depth(front(),0),start=1)[-1]['state'],'NORMAL')
        self.assertEqual(observe(e,p,now=6.2)['measurement_status'],'unavailable')
