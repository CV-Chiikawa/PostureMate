function Header({ mode, rubric, sessionState, inputMode, cameraPermission }) {
  const sessionLabel = { idle: "READY", running: "SESSION ACTIVE", paused: "PAUSED", ended: "SESSION ENDED" }[sessionState];
  return (
    <header className="app-header">
      <div className="brand"><div className="brand-mark" aria-hidden="true">PC</div><div><h1>Context-Aware AI Posture Coach</h1><p>WEB DEMO · SHARED FEATURES / CONTEXT EVALUATION / TEMPORAL EVENTS</p></div></div>
      <div className="header-statuses" aria-label="현재 데모 상태">
        <span>{mode.shortLabel}{mode.id === "interview" ? ` · ${rubric}` : ""}</span>
        <span>{inputMode === "live" ? "LIVE VIDEO / MOCK ANALYSIS" : "MOCK INPUT"}</span>
        <span className={`session-pill ${sessionState}`}><i />{sessionLabel}</span>
        {inputMode === "live" && <span>CAMERA {cameraPermission.toUpperCase()}</span>}
      </div>
    </header>
  );
}
export default Header;
