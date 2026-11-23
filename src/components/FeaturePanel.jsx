import { FEATURE_LABELS, NECK_LEVEL_LABELS } from "../config/modes";


const POSITION_LABELS = {center:"중앙 무릎 영역",left_knee:"왼쪽 허벅지·무릎",right_knee:"오른쪽 허벅지·무릎",
  outside:"무릎 영역 밖",within_reference:"개인 기준 범위",too_wide:"기준보다 벌어짐",too_close:"기준보다 모임",
  correct:"조건 충족",incorrect:"조건 이탈",pose_hand_points:"Pose 손 관절점",wrist_proxy:"손목으로 추정",
  knees_apart:"무릎 간격 넓음",knees_close:"무릎 간격 좁음",hands_apart:"양손이 서로 떨어짐",hands_off_center:"손이 중앙 영역 밖",hands_off_knees:"손이 대응 영역 밖"};

function formatValue(feature, value) {
  if (Array.isArray(value)) return value.length ? value.map(v=>POSITION_LABELS[v] || v).join(" · ") : "없음";
  if (feature === "landmark_visibility") return `${Math.round(value * 100)}%`;
  if (feature === "neck_score") return `${value}점`;
  if (feature === "neck_view") return value === "FRONT" ? "정면" : value === "SIDE_LEFT" ? "왼쪽 측면" : "오른쪽 측면";
  if (feature === "neck_level") return NECK_LEVEL_LABELS[value];
  if (typeof value === "string") return POSITION_LABELS[value] || value;
  if (typeof value === "number") return ["head_tilt", "torso_lean", "cva", "cva_delta", "torso_lateral_lean", "torso_forward_proxy", "raw_torso_lateral_lean", "raw_torso_forward_proxy", "baseline_torso_lateral_lean", "baseline_torso_forward_proxy"].includes(feature) ? `${value.toFixed(1)}°` : value.toFixed(3);
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
      <div className="feature-summary">{[...Object.keys(mode.features), ...(mode.id === "interview" ? ["hand_placement", "knee_placement"] : [])].map((feature) => {
        const result = resultMap[feature];
        const label = mode.features[feature]?.label || FEATURE_LABELS[feature];
        const state = !evaluation.available ? "확인 불가" : !result?.active ? "평가 제외" : result.rating ?? (result.isIssue ? "주의" : "양호");
        return <div key={feature}><span>{label}</span><strong className={result?.isIssue ? "issue" : ""}>{state}</strong></div>;
      })}</div>
      {mode.id === "interview" && <div className="placement-live" aria-label="손과 무릎 위치">
        <p>왼손 · {formatValue("left_hand_region",featurePacket.values.left_hand_region)} / 오른손 · {formatValue("right_hand_region",featurePacket.values.right_hand_region)}</p>
        <p>무릎 · {formatValue("knee_placement_status",featurePacket.values.knee_placement_status)}
          {Number.isFinite(featurePacket.values.knee_distance_ratio) && ` (기준 대비 ${featurePacket.values.knee_distance_ratio.toFixed(2)}배)`}</p>
        <small>손 위치는 Pose 관절의 추정값입니다. 손목 추정만 제공될 때에는 상세 분석에서 확인할 수 있습니다.</small>
      </div>}
      <details className="analysis-details">
        <summary>상세 분석 보기</summary>
        <div className="details-content">
          <div className="rule-summary"><span>현재 평가 기준</span><strong>{mode.label}</strong><p>{mode.description}</p>{mode.id !== "neck" && <p>머리·어깨·상체는 개인 기준 대비 변화량입니다. 전방 값은 영상 모델의 추정 proxy이며 실제 신체 각도가 아닙니다.</p>}</div>
          <div className="feature-list">{Object.keys(featurePacket.values).map((feature) => {
            const result = resultMap[feature];
            const state = mode.id === "neck" || feature === "landmark_visibility" ? "측정값" : !result?.active ? "평가 제외" : result.isIssue ? "범위 이탈" : "허용";
            return <div className="feature-row" key={feature}><div><strong>{FEATURE_LABELS[feature] || feature}</strong><small>{feature}</small></div><span>{state}</span><b>{formatValue(feature, featurePacket.values[feature])}</b></div>;
          })}</div>
        </div>
      </details>
    </section>
  );
}
export default FeaturePanel;
