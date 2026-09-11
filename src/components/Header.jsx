function Header({ mode, sessionState, inputMode, onShowGuide }) {
  const stateLabel = { idle: "분석 대기", running: "분석 중", paused: "일시정지", ended: "분석 완료" }[sessionState];
  return (
    <header className="app-header">
      <div className="brand"><div className="brand-mark" aria-hidden="true">PC</div><div><h1>Context-Aware AI Posture Coach</h1><p>상황에 맞춰 자세를 해석하는 선행 웹 데모</p></div></div>
      <div className="header-actions">
        <span className="header-badge">{inputMode === "live" ? "실제 영상 · 데모 분석" : "데모 분석"}</span>
        <span className={`header-badge state-${sessionState}`}>{stateLabel}</span>
        {sessionState !== "idle" && <span className="header-badge context-badge">{mode.label}</span>}
        <button className="guide-button" type="button" onClick={onShowGuide}>ⓘ 사용 안내</button>
      </div>
    </header>
  );
}
export default Header;
