export const MODES = {
  interview: {
    id: "interview",
    label: "모의면접",
    shortLabel: "INTERVIEW",
    description: "정면 착석 자세의 안정성과 선택한 손·무릎 배치를 확인합니다.",
    guide: "얼굴부터 무릎까지 보이도록 정면에 앉아 카메라를 조금 뒤로 배치하세요.",
    requiredVisibility: 0.65,
    features: {
      head_tilt: { threshold: 7, label: "머리 좌우 기울기", unit: "°" },
      shoulder_height_difference: { threshold: 0.08, label: "어깨 높이 차이", unit: "" },
      torso_lean: { threshold: 8, label: "상체 기울기", unit: "°" },
      body_sway: { threshold: 0.08, label: "몸 흔들림", unit: "" },
    },
  },
  neck: {
    id: "neck",
    label: "거북목 방지",
    shortLabel: "NECK CARE",
    description: "정면과 측면을 구분하고 개인 기준 자세 대비 거북목 변화를 평가합니다.",
    guide: "정면이나 40~65° 비스듬한 측면으로 앉아 주세요. 구도가 잡히면 편안한 자세를 5초간 유지해 주세요.",
    features: { neck_score: { label: "NeckOn 종합 판정" } },
  },
  presentation: {
    id: "presentation",
    label: "발표",
    shortLabel: "PRESENTATION",
    description: "자연스러운 이동은 허용하고 지속적인 기울기와 반복 흔들림을 확인합니다.",
    guide: "상체와 좌우 움직임이 보이도록 정면 중심의 여유 있는 구도를 맞추세요.",
    requiredVisibility: 0.55,
    features: {
      head_tilt: { threshold: 10, label: "머리 좌우 기울기", unit: "°" },
      shoulder_height_difference: { threshold: 0.13, label: "어깨 높이 차이", unit: "" },
      torso_lean: { threshold: 13, label: "상체 좌우 기울기", unit: "°" },
      body_sway: { threshold: 0.18, label: "반복 몸 흔들림", unit: "" },
    },
  },
};

export const RUBRICS = {
  A: {
    label: "Rubric A",
    description: "무릎을 상대적으로 모으고 양손을 중앙 무릎 영역에 배치",
  },
  B: {
    label: "Rubric B",
    description: "무릎을 자연스럽게 두고 양손을 각각 대응 무릎 영역에 배치",
  },
};

export const NECK_LEVEL_LABELS = { GOOD: "양호", CAUTION: "주의", BAD: "위험" };

export const FEATURE_LABELS = {
  neck_score: "NeckOn 점수", neck_level: "NeckOn 판정", neck_view: "카메라 구도",
  forward_score: "정면 전방 점수", imbalance_score: "정면 비대칭 점수",
  nose_depth_delta: "코 깊이 변화", ear_depth_delta: "귀 깊이 변화",
  nose_drop: "코 하강량", nose_forward_delta: "코 전방 이동", ear_forward_delta: "귀 전방 이동",
  cva: "귀·어깨 각도", cva_delta: "기준 대비 각도 감소",
  head_tilt: "머리 좌우 기울기",
  shoulder_height_difference: "어깨 균형",
  torso_lean: "상체 기울기",
  forward_head_proxy: "머리·어깨 정렬 변화",
  body_sway: "몸 흔들림",
  face_or_body_direction: "몸 방향",
  left_hand_region: "왼손 위치",
  right_hand_region: "오른손 위치",
  knee_distance: "무릎 사이 거리",
  landmark_visibility: "신체 포인트 가시성",
  hand_placement: "손·무릎 배치",
};
