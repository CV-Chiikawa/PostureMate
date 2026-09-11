import { FEATURE_LABELS, MODES } from "../config/modes";

const displayedFeatures = ["head_tilt", "shoulder_height_difference", "torso_lean", "body_sway", "forward_head_proxy", "landmark_visibility"];
function formatValue(feature, value) {
  if (feature === "landmark_visibility") return `${Math.round(value * 100)}%`;
  if (typeof value === "number") return Math.abs(value) >= 1 ? `${value.toFixed(1)}°` : value.toFixed(3);
  return value ?? "—";
}
function FeaturePanel({ featurePacket, evaluation, scenario }) {
  const resultMap = Object.fromEntries(evaluation.results.map((item) => [item.feature, item]));
  return (
    <section className="panel feature-panel">
      <div className="panel-heading"><div><span className="eyebrow">SHARED POSE FEATURES</span><h2>FEATURE LAYER</h2></div><span className="mock-chip">MOCK VALUES</span></div>
      <div className="feature-list">{displayedFeatures.map((feature) => {
        const result = resultMap[feature];
        const isVisibility = feature === "landmark_visibility";
        const state = isVisibility ? evaluation.available ? "normal" : "issue" : !result?.active ? "inactive" : result.isIssue ? "issue" : "normal";
        return <div className="feature-row" key={feature}><div><strong>{FEATURE_LABELS[feature]}</strong><small>{feature}</small></div><span className={`feature-state ${state}`}>{state === "inactive" ? "평가 제외" : state === "issue" ? "범위 이탈" : "허용"}</span><b>{formatValue(feature, featurePacket.values[feature])}</b></div>;
      })}</div>
      {scenario.id === "shared-sway" && <div className="context-proof"><span className="eyebrow">CONTEXT-AWARE PROOF · SAME BODY_SWAY = 0.130</span><div><p><b>{MODES.interview.label}</b><span className="issue">CAUTION 대상</span></p><p><b>{MODES.neck.label}</b><span>평가 제외</span></p><p><b>{MODES.presentation.label}</b><span className="normal">NORMAL 허용</span></p></div></div>}
    </section>
  );
}
export default FeaturePanel;
