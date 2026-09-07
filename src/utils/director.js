export const SCORE_WEIGHTS = {
  faceSize: 0.35,
  frontal: 0.3,
  center: 0.2,
  visibility: 0.15,
};

export const SWITCH_MARGIN = 10;
export const SWITCH_HOLD_COUNT = 2;

/**
 * 카메라의 각 평가 요소를 기반으로 최종 Director Score를 계산한다.
 */
export function calculateDirectorScore(metrics) {
  const score =
    metrics.faceSize * SCORE_WEIGHTS.faceSize +
    metrics.frontal * SCORE_WEIGHTS.frontal +
    metrics.center * SCORE_WEIGHTS.center +
    metrics.visibility * SCORE_WEIGHTS.visibility;

  return Math.round(score);
}

/**
 * 선택된 카메라가 왜 좋은 화면인지 설명하기 위한 함수
 */
export function getCameraReason(camera) {
  const metrics = [
    {
      key: "frontal",
      label: "정면 얼굴",
      value: camera.frontal,
    },
    {
      key: "faceSize",
      label: "적절한 얼굴 크기",
      value: camera.faceSize,
    },
    {
      key: "center",
      label: "화면 중앙 정렬",
      value: camera.center,
    },
    {
      key: "visibility",
      label: "높은 가시성",
      value: camera.visibility,
    },
  ];

  return metrics
    .sort((a, b) => b.value - a.value)
    .slice(0, 2)
    .map((metric) => metric.label)
    .join(" / ");
}