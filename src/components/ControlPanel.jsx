function formatDuration(ms) {
  const total = Math.floor(ms / 1000);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function ControlPanel({ sessionState, elapsedMs, stats, scenario, scenarioIndex, scenarioCount, inputMode, onStart, onPause, onResume, onEnd, onPrevious, onNext }) {
  const scenarioLabel = scenario.id === "low-visibility" ? "내부 판정 보류" : scenario.label;
  const scenarioDescription = scenario.id === "low-visibility" ? "입력 데이터가 충분하지 않을 때 상태 전환을 보류하는 내부 동작을 확인합니다." : scenario.description;
  const issueDuration = Object.values(stats.issueDurations).reduce((total, duration) => total + duration, 0);
  return (
    <section className="session-toolbar">
      <div className="session-metrics">
        <div className="session-time"><span>{sessionState === "idle" ? "현재 상태" : "경과 시간"}</span><strong>{sessionState === "idle" ? "시작 전" : formatDuration(elapsedMs)}</strong></div>
        <div><span>주의</span><strong>{stats.caution}회</strong></div><div><span>경고</span><strong>{stats.warning}회</strong></div><div><span>누적 이상 시간</span><strong>{(issueDuration / 1000).toFixed(1)}초</strong></div>
      </div>
      <div className="session-actions">
        {sessionState === "idle" && <button className="primary-button start-session" onClick={onStart}>분석 시작</button>}
        {sessionState === "running" && <button className="secondary-button" onClick={onPause}>일시정지</button>}
        {sessionState === "paused" && <button className="secondary-button" onClick={onResume}>계속하기</button>}
        {(sessionState === "running" || sessionState === "paused") && <button className="danger-button" onClick={onEnd}>분석 종료</button>}
        {sessionState === "ended" && <span className="session-ended-label">분석 종료됨</span>}
      </div>
      {inputMode === "mock" && sessionState !== "ended" && <details className="demo-tools"><summary>시연 도구</summary><div><span>현재 자세 상황 · {scenarioIndex + 1}/{scenarioCount}</span><strong>{scenarioLabel}</strong><p>{scenarioDescription}</p><div><button type="button" aria-label="이전 자세 상황" onClick={onPrevious}>이전 상황</button><button type="button" aria-label="다음 자세 상황" onClick={onNext}>다음 자세 상황</button></div></div></details>}
    </section>
  );
}
export default ControlPanel;
