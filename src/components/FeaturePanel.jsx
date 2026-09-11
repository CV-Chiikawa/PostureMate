import { FEATURE_LABELS, MODES } from "../config/modes";

const summaryFeatures = ["head_tilt", "shoulder_height_difference", "torso_lean", "body_sway"];
const rawFeatures = ["head_tilt", "shoulder_height_difference", "torso_lean", "body_sway", "forward_head_proxy", "landmark_visibility"];

function formatValue(feature, value) {
  if (feature === "landmark_visibility") return `${Math.round(value * 100)}%`;
  if (typeof value === "number") return Math.abs(value) >= 1 ? `${value.toFixed(1)}°` : value.toFixed(3);
  return value ?? "—";
}

function FeaturePanel({ featurePacket, evaluation, scenario, mode }) {
  const resultMap = Object.fromEntries(evaluation.results.map((item) => [item.feature, item]));
  return (
    <section className="panel feature-panel">
      <div className="panel-heading"><div><span className="eyebrow">자세 요약</span><h2>주요 자세 항목</h2></div><span className="mock-chip">데모 데이터</span></div>
      <div className="feature-summary">{summaryFeatures.map((feature) => {
        const result = resultMap[feature];
        const label = FEATURE_LABELS[feature];
        const state = !evaluation.available ? "확인 불가" : !result?.active ? "평가 제외" : result.isIssue ? "주의" : "양호";
        return <div key={feature}><span>{label}</span><strong className={state === "주의" ? "issue" : ""}>{state}</strong></div>;
      })}</div>
      <details className="analysis-details">
        <summary>상세 분석 보기</summary>
        <div className="details-content">
          <div className="rule-summary"><span>현재 평가 기준</span><strong>{mode.label}</strong><p>{mode.description}</p></div>
          <div className="feature-list">{rawFeatures.map((feature) => {
            const result = resultMap[feature];
            const state = feature === "landmark_visibility" ? evaluation.available ? "허용" : "부족" : !result?.active ? "평가 제외" : result.isIssue ? "범위 이탈" : "허용";
            return <div className="feature-row" key={feature}><div><strong>{FEATURE_LABELS[feature]}</strong><small>{feature}</small></div><span>{state}</span><b>{formatValue(feature, featurePacket.values[feature])}</b></div>;
          })}</div>
          {scenario.id === "shared-sway" && <div className="context-proof"><span className="eyebrow">같은 BODY_SWAY = 0.130의 상황별 평가</span><div><p><b>{MODES.interview.label}</b><span>주의 대상</span></p><p><b>{MODES.neck.label}</b><span>평가 제외</span></p><p><b>{MODES.presentation.label}</b><span>허용 범위</span></p></div></div>}
        </div>
      </details>
    </section>
  );
}
export default FeaturePanel;
