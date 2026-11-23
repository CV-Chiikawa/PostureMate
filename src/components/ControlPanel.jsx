function formatDuration(ms) {
  const total = Math.floor(ms / 1000);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function ControlPanel({ sessionState, elapsedMs, stats, cameraReady, onStart, onPause, onResume, onEnd }) {
  const issueDuration = Object.values(stats.issueDurations).reduce((total, duration) => total + duration, 0);
  return (
    <section className="session-toolbar">
      <div className="session-metrics">
        <div className="session-time"><span>{sessionState === "idle" ? "현재 상태" : "경과 시간"}</span><strong>{sessionState === "idle" ? "시작 전" : formatDuration(elapsedMs)}</strong></div>
        <div><span>주의</span><strong>{stats.caution}회</strong></div><div><span>경고</span><strong>{stats.warning}회</strong></div><div><span>누적 이상 시간</span><strong>{(issueDuration / 1000).toFixed(1)}초</strong></div>
      </div>
      <div className="session-actions">
        {sessionState === "idle" && <button className="primary-button start-session" disabled={!cameraReady} onClick={onStart}>분석 시작</button>}
        {sessionState === "running" && <button className="secondary-button" onClick={onPause}>일시정지</button>}
        {sessionState === "paused" && <button className="secondary-button" disabled={!cameraReady} onClick={onResume}>계속하기</button>}
        {(sessionState === "running" || sessionState === "paused") && <button className="danger-button" onClick={onEnd}>분석 종료</button>}
        {sessionState === "ended" && <span className="session-ended-label">분석 종료됨</span>}
      </div>
    </section>
  );
}
export default ControlPanel;
