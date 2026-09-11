import { TEMPORAL_CONFIG } from "../config/modes";
const steps = ["NORMAL", "CANDIDATE", "CAUTION", "WARNING", "RECOVERED", "COOLDOWN"];
function StatusPanel({ temporal, evaluation }) {
  const duration = temporal.durationMs / 1000;
  const progress = temporal.status === "CANDIDATE" || temporal.status === "CAUTION" ? Math.min(100, (temporal.durationMs / TEMPORAL_CONFIG.warningMs) * 100) : temporal.status === "WARNING" ? 100 : 0;
  return (
    <section className={`panel status-panel status-${temporal.status.toLowerCase()}`}>
      <div className="panel-heading"><div><span className="eyebrow">TEMPORAL POSTURE EVENT</span><h2>CURRENT STATUS</h2></div><span className="duration-readout">{duration.toFixed(1)}s</span></div>
      {!evaluation.available ? <div className="unavailable-status"><strong>판정 불가</strong><span>Visibility를 먼저 확보하세요.</span></div> : <><div className="status-hero"><span className="status-pulse" /><div><strong>{temporal.status}</strong><p>{temporal.eventLabel || "현재 활성 자세 이벤트가 없습니다."}</p></div></div><div className="temporal-progress"><span style={{ width: `${progress}%` }} /></div></>}
      <div className="state-track" aria-label="Temporal Event 상태 흐름">{steps.map((step, index) => <div className={temporal.status === step ? "active" : ""} key={step}><i>{index + 1}</i><span>{step}</span></div>)}</div>
      <p className="threshold-note">데모 시간 기준 · CAUTION 2초 · WARNING 5초 · RECOVERY/COOLDOWN 적용</p>
    </section>
  );
}
export default StatusPanel;
