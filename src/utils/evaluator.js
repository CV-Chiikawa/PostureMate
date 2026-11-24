import { FEATURE_LABELS, MODES, NECK_LEVEL_LABELS } from "../config/modes.js";

function placementEvaluations(values) {
  // Use the backend's personal-reference decisions; do not duplicate fixed knee thresholds.
  const hand = values.hand_placement_status;
  const knee = values.knee_placement_status;
  return [
    {feature:"hand_placement",label:"손 배치",value:hand === "correct" ? "조건 충족" : "조건 이탈",
      active:["correct","incorrect"].includes(hand),isIssue:hand === "incorrect",ratio:hand === "incorrect" ? 1.4 : 0},
    {feature:"knee_placement",label:"무릎 간격",value:knee === "within_reference" ? "기준 범위" : "기준 이탈",
      active:["within_reference","too_wide","too_close"].includes(knee),
      isIssue:["too_wide","too_close"].includes(knee),ratio:["too_wide","too_close"].includes(knee) ? 1.4 : 0},
  ];
}

export function evaluateContext(featurePacket, modeId, _rubric = "A") {
  const mode = MODES[modeId];
  const values = featurePacket.values;
  if (modeId === "neck") {
    const result = { feature: "neck_score", active: true, isIssue: values.neck_level !== "GOOD",
      rating: NECK_LEVEL_LABELS[values.neck_level] ?? "확인 중" };
    return { available: true, results: [result], primary: result.isIssue ? result : null };
  }
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
    .filter(([feature]) => feature !== "landmark_visibility" && feature !== "hand_placement" && feature !== "knee_placement")
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
    results.push(...placementEvaluations(values));
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
