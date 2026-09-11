function formatDuration(ms) {
  const total = Math.floor(ms / 1000);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function ControlPanel({ sessionState, elapsedMs, scenario, scenarioIndex, scenarioCount, onStart, onPause, onResume, onEnd, onNext }) {
  return (
    <section className="panel control-panel">
      <div className="panel-heading"><div><span className="eyebrow">SESSION &amp; MOCK SCENARIO</span><h2>CONTROL PANEL</h2></div><span className="session-clock">{formatDuration(elapsedMs)}</span></div>
      <div className="scenario-card"><div><span>SCENARIO {scenarioIndex + 1} / {scenarioCount}</span><strong>{scenario.label}</strong><p>{scenario.description}</p></div><button type="button" onClick={onNext}>NEXT SCENARIO <b>→</b></button></div>
      <div className="session-controls">
        {(sessionState === "idle" || sessionState === "ended") && <button className="primary-button" onClick={onStart}>{sessionState === "ended" ? "START NEW SESSION" : "START SESSION"}</button>}
        {sessionState === "running" && <button className="secondary-button" onClick={onPause}>PAUSE</button>}
        {sessionState === "paused" && <button className="primary-button" onClick={onResume}>RESUME</button>}
        {(sessionState === "running" || sessionState === "paused") && <button className="danger-button" onClick={onEnd}>END SESSION</button>}
      </div>
      <p className="control-note">Scenario는 Mock Feature만 변경합니다. LIVE CAMERA 영상은 실제지만 분석값에는 사용하지 않습니다.</p>
    </section>
  );
}
export default ControlPanel;
