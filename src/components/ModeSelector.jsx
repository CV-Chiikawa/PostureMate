import { useState } from "react";
import { MODES, RUBRICS } from "../config/modes";

function ChoicePopover({ label, value, open, onToggle, children }) {
  return (
    <div className="choice-field">
      <span>{label}</span>
      <button className="choice-trigger" type="button" onClick={onToggle} aria-expanded={open}><strong>{value}</strong><i>▾</i></button>
      {open && <div className="choice-menu" role="menu">{children}</div>}
    </div>
  );
}

function ModeSelector({ modeId, rubric, onModeChange, onRubricChange }) {
  const [modeOpen, setModeOpen] = useState(false);
  const [rubricOpen, setRubricOpen] = useState(false);
  const mode = MODES[modeId];

  return (
    <div className="setup-choices">
      <ChoicePopover label="사용 모드" value={mode.label} open={modeOpen} onToggle={() => { setModeOpen((current) => !current); setRubricOpen(false); }}>
        {Object.values(MODES).map((item) => <button type="button" role="menuitem" key={item.id} className={item.id === modeId ? "selected" : ""} onClick={() => { onModeChange(item.id); setModeOpen(false); }}><strong>{item.label}</strong><small>{item.description}</small></button>)}
      </ChoicePopover>
      {modeId === "interview" && (
        <ChoicePopover label="자세 기준" value={`기준 ${rubric}`} open={rubricOpen} onToggle={() => { setRubricOpen((current) => !current); setModeOpen(false); }}>
          {Object.entries(RUBRICS).map(([id, item]) => <button type="button" role="menuitem" key={id} className={id === rubric ? "selected" : ""} onClick={() => { onRubricChange(id); setRubricOpen(false); }}><strong>기준 {id}</strong><small>{item.description}</small></button>)}
        </ChoicePopover>
      )}
      <div className="mode-summary"><span>선택한 평가 방식</span><p>{mode.description}</p></div>
    </div>
  );
}
export default ModeSelector;
