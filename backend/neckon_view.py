"""NeckOn AI d57a911, Finally/mode_inference.py: lock the camera view once per session."""

from collections import deque
from statistics import mean


def clamp01(value):
    return max(0.0, min(1.0, value))


class ViewInference:
    def __init__(self, now):
        self.start_time = now
        self.front_conf = deque(maxlen=20)
        self.left_conf = deque(maxlen=20)
        self.right_conf = deque(maxlen=20)
        self.locked_mode = None

    def _front_confidence(self, landmarks):
        left_ear = landmarks[7]
        right_ear = landmarks[8]
        nose = landmarks[0]
        left_shoulder = landmarks[11]
        right_shoulder = landmarks[12]

        shoulder_center_x = (left_shoulder.x + right_shoulder.x) / 2
        ear_center_x = (left_ear.x + right_ear.x) / 2

        both_ears_visible = float(left_ear.visibility > 0.42 and right_ear.visibility > 0.42)
        head_tilt = abs(left_ear.y - right_ear.y)
        center_offset = abs(nose.x - shoulder_center_x)
        nose_ear_mid = abs(nose.x - ear_center_x)
        shoulder_balance = abs(left_shoulder.y - right_shoulder.y)
        ear_vis_balance = abs(left_ear.visibility - right_ear.visibility)

        conf = (
            0.32 * both_ears_visible
            + 0.20 * (1.0 - clamp01(head_tilt / 0.08))
            + 0.18 * (1.0 - clamp01(center_offset / 0.10))
            + 0.12 * (1.0 - clamp01(nose_ear_mid / 0.08))
            + 0.08 * (1.0 - clamp01(shoulder_balance / 0.06))
            + 0.10 * (1.0 - clamp01(ear_vis_balance / 0.35))
        )
        return clamp01(conf)

    def _side_features_pose_only(self, landmarks, side_name):
        """
        infer 단계에서는 Face Detection nose tip 대신 Pose NOSE만 사용
        -> 밝은 환경 / 광각 웹캠 / 반사에서 덜 흔들리게
        """
        left_ear = landmarks[7]
        right_ear = landmarks[8]
        nose = landmarks[0]
        left_shoulder = landmarks[11]
        right_shoulder = landmarks[12]

        if side_name == "LEFT":
            side_ear = left_ear
            opp_ear = right_ear
            side_shoulder = left_shoulder
        else:
            side_ear = right_ear
            opp_ear = left_ear
            side_shoulder = right_shoulder

        if nose.visibility < 0.35 or side_ear.visibility < 0.35 or side_shoulder.visibility < 0.35:
            return 0.0, 0.0, 0.0

        ear_mid_x = (left_ear.x + right_ear.x) / 2

        # +면 LEFT 쪽, -면 RIGHT 쪽으로 돈 것으로 해석
        signed_yaw = ear_mid_x - nose.x

        if side_name == "LEFT":
            matched_yaw = signed_yaw
        else:
            matched_yaw = -signed_yaw

        side_profile = abs(nose.x - side_ear.x)
        ear_vis_gap = side_ear.visibility - opp_ear.visibility

        yaw_strength = clamp01(matched_yaw / 0.18)
        profile_strength = clamp01((side_profile - 0.030) / 0.090)
        vis_gap_strength = clamp01((ear_vis_gap + 0.10) / 0.45)
        ear_vis_strength = clamp01((side_ear.visibility - 0.35) / max(1e-6, (1.0 - 0.35)))
        shoulder_vis_strength = clamp01((side_shoulder.visibility - 0.35) / max(1e-6, (1.0 - 0.35)))

        conf = (
            0.38 * yaw_strength
            + 0.30 * profile_strength
            + 0.12 * vis_gap_strength
            + 0.10 * ear_vis_strength
            + 0.10 * shoulder_vis_strength
        )
        return clamp01(conf), side_profile, matched_yaw

    def update(self, landmarks, now):
        # 원본 front confidence
        front_raw = self._front_confidence(landmarks)

        # infer 단계용 side confidence (pose only)
        left_raw, left_profile, left_yaw = self._side_features_pose_only(landmarks, "LEFT")
        right_raw, right_profile, right_yaw = self._side_features_pose_only(landmarks, "RIGHT")

        left_ear = landmarks[7]
        right_ear = landmarks[8]

        best_side_profile = max(left_profile, right_profile)
        best_matched_yaw = max(left_yaw, right_yaw)
        ear_vis_gap_abs = abs(left_ear.visibility - right_ear.visibility)

        # -------------------------
        # front bias 줄이기
        # -------------------------
        front_penalty = 0.0

        # 옆모습 특징이 꽤 보이면 front 점수 감점
        if best_side_profile >= 0.085:
            front_penalty += 0.12

        if best_matched_yaw >= 0.26:
            front_penalty += 0.14

        if ear_vis_gap_abs >= 0.18:
            front_penalty += 0.07

        if max(left_raw, right_raw) >= 0.62:
            front_penalty += 0.05

        front_adj = clamp01(front_raw - front_penalty)

        # -------------------------
        # side를 살짝 밀어주기
        # -------------------------
        left_adj = left_raw
        right_adj = right_raw

        if left_profile >= 0.090:
            left_adj += 0.05
        if left_yaw >= 0.26:
            left_adj += 0.05

        if right_profile >= 0.090:
            right_adj += 0.05
        if right_yaw >= 0.26:
            right_adj += 0.05

        left_adj = clamp01(left_adj)
        right_adj = clamp01(right_adj)

        self.front_conf.append(front_adj)
        self.left_conf.append(left_adj)
        self.right_conf.append(right_adj)

        front_avg = mean(self.front_conf)
        left_avg = mean(self.left_conf)
        right_avg = mean(self.right_conf)

        best_side = max(left_avg, right_avg)
        best_side_name = "LEFT" if left_avg >= right_avg else "RIGHT"

        elapsed = now - self.start_time

        if elapsed >= 2.0:
            side_lock_threshold = 0.48
            front_lock_threshold = 0.57

            # side는 조금만 우세해도 잠그고
            if best_side >= side_lock_threshold and best_side >= front_avg - 0.02:
                self.locked_mode = f"SIDE_{best_side_name}"

            # front는 더 확실히 우세할 때만 잠금
            elif front_avg >= front_lock_threshold and front_avg >= best_side + 0.10:
                self.locked_mode = "FRONT"

            # 애매하면 side 쪽을 우선
            else:
                if best_side >= front_avg - 0.02:
                    self.locked_mode = f"SIDE_{best_side_name}"
                else:
                    self.locked_mode = "FRONT"

        return self.locked_mode
