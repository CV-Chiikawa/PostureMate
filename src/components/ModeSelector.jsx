import { MODES, RUBRICS } from "../config/modes";

function ModeSelector({ modeId, rubric, onModeChange, onRubricChange }) {
  return (
    <section className="mode-section" aria-labelledby="mode-title">
      <div className="section-intro"><span className="eyebrow">01 · SELECT CONTEXT</span><h2 id="mode-title">같은 자세도 상황에 따라 다르게 봅니다</h2><p>Feature 원본은 공유하고, 선택한 사용 상황의 Evaluator가 허용 범위와 지속시간을 결정합니다.</p></div>
      <div className="mode-grid">
        {Object.values(MODES).map((mode, index) => (
          <button key={mode.id} type="button" className={`mode-card ${mode.id === modeId ? "selected" : ""}`} onClick={() => onModeChange(mode.id)} aria-pressed={mode.id === modeId}>
            <span className="mode-number">0{index + 1}</span><strong>{mode.label}</strong><small>{mode.description}</small>
          </button>
        ))}
      </div>
      {modeId === "interview" && (
        <div className="rubric-row"><span>INTERVIEW RUBRIC</span>{Object.entries(RUBRICS).map(([id, item]) => (
          <button type="button" key={id} className={rubric === id ? "selected" : ""} onClick={() => onRubricChange(id)} aria-pressed={rubric === id}><strong>{item.label}</strong><small>{item.description}</small></button>
        ))}</div>
      )}
    </section>
  );
}
export default ModeSelector;
