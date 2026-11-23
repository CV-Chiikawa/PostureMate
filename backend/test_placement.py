import unittest
from backend.pose import hand_regions, hand_issue, PoseSession
from backend.test_pose import front


def lap():
    # Knee centers remain apart even when the inner edges of the knees touch.
    return {11:(600,200,1),12:(200,200,1),23:(510,430,1),24:(290,430,1),
            25:(565,590,1),26:(235,590,1),15:(430,450,1),16:(370,450,1)}


class PlacementTests(unittest.TestCase):
    def test_closed_reference_is_not_zero_center_distance(self):
        f=hand_regions(lap(),400,rubric='A',knee_reference=.825)
        self.assertIsNone(hand_issue(f,'A'))
        self.assertEqual(f['knee_placement_status'],'within_reference')

    def test_opening_knees_is_visible_even_with_correct_center_hands(self):
        p=lap(); p[25]=(660,590,1); p[26]=(140,590,1)
        f=hand_regions(p,400,rubric='A',knee_reference=.825)
        self.assertEqual(f['left_hand_region'],'center')
        self.assertEqual(f['right_hand_region'],'center')
        self.assertEqual(f['hand_placement_status'],'correct')
        self.assertEqual(f['knee_placement_status'],'too_wide')
        self.assertEqual(hand_issue(f,'A'),'knees_apart')

    def test_hands_on_upper_thighs_match_rubric_b(self):
        p=lap(); p[15]=(510,445,1);p[16]=(290,445,1)
        f=hand_regions(p,400,rubric='B',knee_reference=.825)
        self.assertIsNone(hand_issue(f,'B'))
        self.assertEqual((f['left_hand_region'],f['right_hand_region']),('left_knee','right_knee'))

    def test_abdomen_raised_hands_are_outside_lap(self):
        p=lap();p[15]=(430,230,1);p[16]=(370,230,1)
        f=hand_regions(p,400,rubric='A',knee_reference=.825)
        self.assertEqual(hand_issue(f,'A'),'hands_off_center')
        self.assertEqual(f['knee_placement_status'],'within_reference')

    def test_crossed_hands_do_not_match_b(self):
        p=lap();p[15]=(290,450,1);p[16]=(510,450,1)
        f=hand_regions(p,400,rubric='B',knee_reference=.825)
        self.assertEqual(hand_issue(f,'B'),'hands_off_knees')

    def test_closing_knees_from_b_reference_is_a_separate_issue(self):
        p=lap();p[25]=(460,590,1);p[26]=(340,590,1)
        f=hand_regions(p,400,rubric='B',knee_reference=.825)
        self.assertEqual(f['knee_placement_status'],'too_close')
        self.assertEqual(hand_issue(f,'B'),'knees_close')

    def test_palm_proxy_not_wrist_alone_controls_hand_location(self):
        p=lap();p[15]=(650,400,1);p[16]=(150,400,1)
        for i in (17,19,21):p[i]=(430,450,1)
        for i in (18,20,22):p[i]=(370,450,1)
        f=hand_regions(p,400,rubric='A',knee_reference=.825)
        self.assertEqual(f['hand_placement_status'],'correct')
        self.assertEqual(f['left_hand_source'],'pose_hand_points')

    def test_reference_scale_invariance(self):
        p=lap(); f=hand_regions(p,400,rubric='A',knee_reference=.825)
        q={i:(x*2,y*2,c) for i,(x,y,c) in p.items()}
        g=hand_regions(q,800,rubric='A',knee_reference=.825)
        self.assertEqual(f['knee_distance'],g['knee_distance'])
        self.assertEqual(f['hand_placement_status'],g['hand_placement_status'])

    def test_reference_median_records_personal_knee_spacing(self):
        e=PoseSession()
        p=front(spread=.16); p[15].x=p[16].x=.5
        for i in range(26):r=e.observe(p,640,480,'interview','A',i*.2)
        self.assertEqual(r['state'],'NORMAL')
        self.assertAlmostEqual(r['features']['knee_reference_distance'],.8)
        q=front(spread=.28);q[15].x=q[16].x=.5
        for i in range(26,55):r=e.observe(q,640,480,'interview','A',i*.2)
        self.assertEqual(r['state'],'WARNING')
        self.assertEqual(r['features']['knee_placement_status'],'too_wide')

class HandSpacingTests(unittest.TestCase):
    def test_two_central_but_separated_hands_have_specific_feedback(self):
        p=lap();p[15]=(500,450,1);p[16]=(300,450,1)
        f=hand_regions(p,400,rubric='A',knee_reference=.825)
        self.assertEqual((f['left_hand_region'],f['right_hand_region']),('center','center'))
        self.assertEqual(hand_issue(f,'A'),'hands_apart')
