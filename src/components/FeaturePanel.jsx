import { FEATURE_LABELS, NECK_LEVEL_LABELS } from "../config/modes";


function formatValue(feature, value) {
  if (feature === "landmark_visibility") return `${Math.round(value * 100)}%`;
  if (feature === "neck_score") return `${value}점`;
  if (feature === "neck_view") return value === "FRONT" ? "정면" : value === "SIDE_LEFT" ? "왼쪽 측면" : "오른쪽 측면";
  if (feature === "neck_level") return NECK_LEVEL_LABELS[value];
  if (typeof value === "number") return ["head_tilt", "torso_lean", "cva", "cva_delta"].includes(feature) ? `${value.toFixed(1)}°` : value.toFixed(3);
  return value ?? "—";
}

function FeaturePanel({ featurePacket, evaluation, mode }) {
  if (!featurePacket) {
    return <section className="panel feature-panel"><div className="panel-heading"><h2>주요 자세 항목</h2></div><p>표시할 측정값이 없습니다.</p></section>;
  }
  const resultMap = Object.fromEntries(evaluation.results.map((item) => [item.feature, item]));
  return (
    <section className="panel feature-panel">
      <div className="panel-heading"><div><span className="eyebrow">자세 요약</span><h2>주요 자세 항목</h2></div><span className="measurement-chip">최근 카메라 측정값</span></div>
      <div className="feature-summary">{[...Object.keys(mode.features), ...(mode.id === "interview" ? ["hand_placement"] : [])].map((feature) => {
        const result = resultMap[feature];
        const label = mode.features[feature]?.label || FEATURE_LABELS[feature];
        const state = !evaluation.available ? "확인 불가" : !result?.active ? "평가 제외" : result.rating ?? (result.isIssue ? "주의" : "양호");
        return <div key={feature}><span>{label}</span><strong className={result?.isIssue ? "issue" : ""}>{state}</strong></div>;
      })}</div>
      <details className="analysis-details">
        <summary>상세 분석 보기</summary>
        <div className="details-content">
          <div className="rule-summary"><span>현재 평가 기준</span><strong>{mode.label}</strong><p>{mode.description}</p></div>
          <div className="feature-list">{Object.keys(featurePacket.values).map((feature) => {
            const result = resultMap[feature];
            const state = mode.id === "neck" || feature === "landmark_visibility" ? "측정값" : !result?.active ? "평가 제외" : result.isIssue ? "범위 이탈" : "허용";
            return <div className="feature-row" key={feature}><div><strong>{FEATURE_LABELS[feature]}</strong><small>{feature}</small></div><span>{state}</span><b>{formatValue(feature, featurePacket.values[feature])}</b></div>;
          })}</div>
        </div>
      </details>
    </section>
  );
}
export default FeaturePanel;
