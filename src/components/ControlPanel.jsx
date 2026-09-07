import {
  SWITCH_HOLD_COUNT,
  SWITCH_MARGIN,
} from "../utils/director";

function ControlPanel({
  isRunning,
  onToggle,
  onNext,
  scenarioIndex,
  scenarioCount,
}) {
  return (
    <section className="panel control-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">
            PROTOTYPE CONTROLS
          </span>

          <h2>DIRECTOR CONTROL</h2>
        </div>
      </div>

      <div className="control-buttons">
        <button
          className={`primary-button ${
            isRunning ? "stop-button" : ""
          }`}
          onClick={onToggle}
        >
          {isRunning
            ? "PAUSE DIRECTOR"
            : "START DIRECTOR"}
        </button>

        <button
          className="secondary-button"
          onClick={onNext}
        >
          NEXT SCENE
        </button>
      </div>

      <div className="control-stats">
        <div>
          <span>SCENE</span>
          <strong>
            {scenarioIndex + 1}/{scenarioCount}
          </strong>
        </div>

        <div>
          <span>SWITCH MARGIN</span>
          <strong>+{SWITCH_MARGIN}</strong>
        </div>

        <div>
          <span>HOLD COUNT</span>
          <strong>{SWITCH_HOLD_COUNT}</strong>
        </div>

        <div>
          <span>MODE</span>
          <strong>AUTO</strong>
        </div>
      </div>
    </section>
  );
}

export default ControlPanel;