import { FEATURE_LABELS, MODES } from "../config/modes.js";

function handPlacementEvaluation(values, rubric) {
  const isRubricA = rubric === "A";
  const handsMatch = isRubricA
    ? values.left_hand_region === "center" && values.right_hand_region === "center"
    : values.left_hand_region === "left_knee" && values.right_hand_region === "right_knee";
  const kneesMatch = isRubricA ? values.knee_distance <= 0.22 : values.knee_distance >= 0.23;

  return {
    feature: "hand_placement",
    label: `손·무릎 배치 · Rubric ${rubric}`,
    value: handsMatch && kneesMatch ? "조건 충족" : "조건 이탈",
    threshold: isRubricA ? "중앙 손 / 무릎 ≤ 0.22" : "각 무릎 손 / 무릎 ≥ 0.23",
    active: true,
    isIssue: !(handsMatch && kneesMatch),
    ratio: handsMatch && kneesMatch ? 0 : 1.4,
  };
}

export function evaluateContext(featurePacket, modeId, rubric = "A") {
  const mode = MODES[modeId];
  const values = featurePacket.values;
  const visibility = values.landmark_visibility;

  if (visibility < mode.requiredVisibility) {
    return {
      available: false,
      reason: "필수 Landmark 가시성이 부족합니다.",
      guide: modeId === "interview"
        ? "무릎 영역을 확인하기 어렵습니다. 카메라를 조금 뒤로 이동해주세요."
        : mode.guide,
      results: [],
      primary: null,
    };
  }

  const results = Object.entries(FEATURE_LABELS)
    .filter(([feature]) => feature !== "landmark_visibility" && feature !== "hand_placement")
    .map(([feature, defaultLabel]) => {
      const config = mode.features[feature];
      const value = values[feature];
      if (!config || typeof value !== "number") {
        return { feature, label: defaultLabel, value, active: false, isIssue: false, ratio: 0 };
      }
      const absoluteValue = Math.abs(value);
      return {
        feature,
        label: config.label,
        value,
        unit: config.unit,
        threshold: config.threshold,
        active: true,
        isIssue: absoluteValue > config.threshold,
        ratio: absoluteValue / config.threshold,
      };
    });

  if (modeId === "interview") {
    results.push(handPlacementEvaluation(values, rubric));
  }

  const issues = results.filter((result) => result.active && result.isIssue);
  const primary = issues.sort((a, b) => b.ratio - a.ratio)[0] || null;

  return {
    available: true,
    reason: null,
    guide: null,
    results,
    primary,
  };
}
