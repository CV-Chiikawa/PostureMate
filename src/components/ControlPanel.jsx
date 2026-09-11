function formatDuration(ms) {
  const total = Math.floor(ms / 1000);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function ControlPanel({ sessionState, elapsedMs, scenario, scenarioIndex, scenarioCount, inputMode, onStart, onPause, onResume, onEnd, onPrevious, onNext }) {
  return (
    <section className="session-toolbar">
      <div className="session-time"><span>{sessionState === "idle" ? "현재 상태" : "분석 시간"}</span><strong>{sessionState === "idle" ? "시작 전" : formatDuration(elapsedMs)}</strong></div>
      <div className="session-actions">
        {sessionState === "idle" && <button className="primary-button start-session" onClick={onStart}>분석 시작</button>}
        {sessionState === "running" && <button className="secondary-button" onClick={onPause}>일시정지</button>}
        {sessionState === "paused" && <button className="secondary-button" onClick={onResume}>계속하기</button>}
        {(sessionState === "running" || sessionState === "paused") && <button className="danger-button" onClick={onEnd}>분석 종료</button>}
      </div>
      {inputMode === "mock" && sessionState !== "ended" && <details className="demo-tools"><summary>시연 도구</summary><div><span>현재 자세 상황 · {scenarioIndex + 1}/{scenarioCount}</span><strong>{scenario.label}</strong><p>{scenario.description}</p><div><button type="button" aria-label="이전 자세 상황" onClick={onPrevious}>이전 상황</button><button type="button" aria-label="다음 자세 상황" onClick={onNext}>다음 자세 상황</button></div></div></details>}
    </section>
  );
}
export default ControlPanel;
