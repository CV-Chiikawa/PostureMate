import { MODES } from "../config/modes";
import ModeArtwork from "./ModeArtwork";

const modeOrder = ["neck", "interview", "presentation"];
const modeDetails = {
  neck: { tagline: "목·상체 자세 변화 중심", points: ["개인 기준 대비 목 자세 변화 확인", "정면·좌우 측면 자동 판별", "오래 앉아 있는 화면 작업에 적합"] },
  interview: { tagline: "정면 착석 안정성 중심", points: ["머리·어깨·상체 균형 확인", "Rubric A/B 손·무릎 배치 지원", "면접과 유사한 환경에서 반복 연습"] },
  presentation: { tagline: "자연스러운 이동을 허용한 평가", points: ["지속적인 기울기와 흔들림 확인", "넓은 상체 움직임 범위 반영", "발표 연습의 자세 흐름 점검"] },
};

function ModeSelectionPage({ modeId, onSelectMode, onStartMode }) {
  const selected = MODES[modeId];
  const detail = modeDetails[modeId];
  return (
    <main className="page-shell mode-selection-page" id="mode-selection-page">
      <section className="selection-intro">
        <h1>나에게 맞는 모드를 선택하세요</h1>
        <p>현재 상황과 목적에 맞는 자세 코칭 모드를 선택하여 효과적으로 연습할 수 있습니다.</p>
      </section>

      <section className="mode-card-grid" aria-label="자세 코칭 모드 선택">
        {modeOrder.map((id) => {
          const mode = MODES[id];
          const active = id === modeId;
          return (
            <article key={id} className={`mode-selection-card ${active ? "selected" : ""}`}>
              <button className="mode-card-choice" type="button" aria-pressed={active} onClick={() => onSelectMode(id)}>
                <div className="mode-card-visual"><ModeArtwork modeId={id} /><div className="mode-card-overlay"><strong>{mode.label}</strong><p>{mode.description}</p></div></div>
                <div className="mode-card-label"><strong>{mode.label}</strong><small>{modeDetails[id].tagline}</small></div>
              </button>
              <button className="mode-card-start" type="button" aria-label={`${mode.label} 모드로 바로 시작`} onClick={() => onStartMode(id)}>선택</button>
            </article>
          );
        })}
      </section>

      <section className="selected-mode-guide" aria-live="polite">
        <div className="selected-mode-summary"><ModeArtwork modeId={modeId} compact /><div><span>선택한 모드 안내</span><h2>{selected.label}</h2><p>{selected.description}</p></div></div>
        <ul>{detail.points.map((point) => <li key={point}><span aria-hidden="true">✓</span>{point}</li>)}</ul>
        <button className="primary-button selected-start" type="button" onClick={() => onStartMode(modeId)}>이 모드로 시작하기</button>
      </section>
    </main>
  );
}

export default ModeSelectionPage;
