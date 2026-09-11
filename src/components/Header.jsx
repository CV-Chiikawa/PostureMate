import { useState } from "react";

function Header({ mode, rubric, sessionState, inputMode, onShowGuide, onShowSettings }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const stateLabel = { idle: "분석 대기", running: "분석 중", paused: "일시정지", ended: "분석 완료" }[sessionState];
  const settingsLocked = sessionState === "running" || sessionState === "paused";

  return (
    <header className="app-header">
      <div className="header-left">
        <div className="menu-wrap">
          <button className="menu-trigger" type="button" aria-expanded={menuOpen} onClick={() => setMenuOpen((current) => !current)}>☰ <span>메뉴</span></button>
          {menuOpen && <div className="global-menu"><span>메뉴</span><button type="button" onClick={() => { onShowGuide(); setMenuOpen(false); }}>사용 안내 <i>›</i></button><button type="button" disabled={settingsLocked} onClick={() => { onShowSettings(); setMenuOpen(false); }}>분석 설정 <i>›</i>{settingsLocked && <small>분석 종료 후 변경</small>}</button></div>}
        </div>
        <div className="brand"><div className="brand-mark" aria-hidden="true">PC</div><div><h1>Context-Aware AI Posture Coach</h1><p>상황에 맞춰 자세를 해석하는 선행 웹 데모</p></div></div>
      </div>
      <div className="header-summary"><span>{mode.label}{mode.id === "interview" ? ` · 기준 ${rubric}` : ""}</span><span>{inputMode === "live" ? "실제 영상 · 데모 분석" : "데모 분석"}</span><strong className={`state-${sessionState}`}>{stateLabel}</strong></div>
    </header>
  );
}
export default Header;
