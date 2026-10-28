import { useState } from "react";

function Header({ page, mode, rubric, sessionState, inputMode, hasResult, onNavigate, onShowResult, onShowGuide, onShowSettings }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const stateLabel = { idle: "분석 대기", running: "분석 중", paused: "일시정지", ended: "분석 완료" }[sessionState];
  const settingsLocked = sessionState === "running" || sessionState === "paused";

  return (
    <header className="app-header">
      <button className="brand" type="button" onClick={() => onNavigate("intro")} disabled={settingsLocked} aria-label="PostureMate 소개로 이동"><span className="brand-mark" aria-hidden="true">P</span><span><strong>PostureMate</strong><small>Context-aware posture coach</small></span></button>
      <nav className="main-nav" aria-label="주요 메뉴">
        <button className={page === "intro" ? "active" : ""} type="button" disabled={settingsLocked} onClick={() => onNavigate("intro")}>소개</button>
        <button className={page === "modes" ? "active" : ""} type="button" disabled={settingsLocked} onClick={() => onNavigate("modes")}>모드 선택</button>
        <button className={page === "analysis" && hasResult ? "active" : ""} type="button" disabled={!hasResult} onClick={onShowResult}>분석 결과</button>
      </nav>
      <div className="header-tools">
        {page === "analysis" && <div className="header-summary"><span>{mode.label}{mode.id === "interview" ? ` · 기준 ${rubric}` : ""}</span><span>{inputMode === "live" ? "실제 영상 · 데모 분석" : "데모 분석"}</span><strong className={`state-${sessionState}`}>{stateLabel}</strong></div>}
        <div className="menu-wrap">
          <button className="menu-trigger" type="button" aria-expanded={menuOpen} aria-label="도움말 및 설정 메뉴" onClick={() => setMenuOpen((current) => !current)}>•••</button>
          {menuOpen && <div className="global-menu"><span>메뉴</span><button type="button" onClick={() => { onShowGuide(); setMenuOpen(false); }}>사용 안내 <i>›</i></button><button type="button" disabled={settingsLocked} onClick={() => { onShowSettings(); setMenuOpen(false); }}>분석 설정 <i>›</i>{settingsLocked && <small>분석 종료 후 변경</small>}</button></div>}
        </div>
      </div>
    </header>
  );
}
export default Header;
