"""Interview lap-placement proxies from Pose landmarks, not finger/gesture recognition."""
import math
from statistics import median

# Beta heuristics, normalized by shoulder width. References belong to this session/rubric.
KNEE_RELATIVE_MARGIN = .25
A_KNEE_MIN_MARGIN = .12
B_KNEE_MIN_MARGIN = .10
HAND_CENTER_HALF_WIDTH = .35
HAND_PAIR_MAX_GAP = .45
THIGH_TOLERANCE = .35


def hand_anchor(p, wrist, fingers):
    available = [p[i] for i in fingers if i in p]
    if len(available) >= 2:
        return (median(v[0] for v in available), median(v[1] for v in available)), 'pose_hand_points'
    return p[wrist][:2], 'wrist_proxy'


def segment_distance(point, start, end):
    dx,dy=end[0]-start[0],end[1]-start[1]
    length=dx*dx+dy*dy
    t=max(0.,min(1.,((point[0]-start[0])*dx+(point[1]-start[1])*dy)/length)) if length else 0.
    return math.hypot(point[0]-start[0]-t*dx,point[1]-start[1]-t*dy)


def hand_regions(p, width, *, rubric, knee_reference):
    left,right=p[25],p[26]
    middle=((left[0]+right[0])/2,(left[1]+right[1])/2)
    separation=abs(left[0]-right[0])/width
    margin=max(A_KNEE_MIN_MARGIN if rubric=='A' else B_KNEE_MIN_MARGIN,
               knee_reference*KNEE_RELATIVE_MARGIN)
    knee_status=('too_wide' if separation>knee_reference+margin else 'within_reference') if rubric=='A' else (
        'too_close' if separation<max(0.,knee_reference-margin) else 'within_reference')
    lh,lsource=hand_anchor(p,15,(17,19,21))
    rh,rsource=hand_anchor(p,16,(18,20,22))
    top=min(p[23][1],p[24][1],left[1],right[1])-THIGH_TOLERANCE*width
    bottom=max(left[1],right[1])+.25*width

    def region(anchor):
        if rubric=='A':
            return 'center' if (abs(anchor[0]-middle[0])<=HAND_CENTER_HALF_WIDTH*width
                                and top<=anchor[1]<=bottom) else 'outside'
        distance,name=min((segment_distance(anchor,p[hip],p[knee]),name)
                          for hip,knee,name in [(23,25,'left_knee'),(24,26,'right_knee')])
        return name if distance<=THIGH_TOLERANCE*width else 'outside'

    lregion,rregion=region(lh),region(rh)
    if rubric=='A':
        hand_ok=(lregion==rregion=='center' and abs(lh[0]-rh[0])<=HAND_PAIR_MAX_GAP*width
                 and abs(lh[1]-rh[1])<=.35*width)
    else:
        hand_ok=lregion=='left_knee' and rregion=='right_knee'
    issues=[]
    if knee_status!='within_reference':issues.append('knees_apart' if rubric=='A' else 'knees_close')
    if not hand_ok:
        issues.append('hands_apart' if rubric=='A' and lregion==rregion=='center'
                      else 'hands_off_center' if rubric=='A' else 'hands_off_knees')
    return {'left_hand_region':lregion,'right_hand_region':rregion,
            'left_hand_source':lsource,'right_hand_source':rsource,
            'knee_distance':separation,'knee_reference_distance':knee_reference,
            'knee_distance_ratio':separation/max(knee_reference,.05),
            'knee_placement_status':knee_status,
            'hand_placement_status':'correct' if hand_ok else 'incorrect',
            'placement_issues':issues}


def hand_issue(features, rubric):
    return next(iter(features['placement_issues']),None)
