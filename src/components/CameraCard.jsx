import CameraFeed from "./CameraFeed";
import ScoreBar from "./ScoreBar";

function CameraCard({ camera, selected }) {
  return (
    <article
      className={`camera-card ${
        selected ? "camera-card-selected" : ""
      }`}
    >
      <div className="camera-card-header">
        <div>
          <span className="eyebrow">
            {camera.position}
          </span>

          <h2>{camera.name}</h2>
        </div>

        <div
          className={`camera-status ${
            selected ? "selected" : ""
          }`}
        >
          <span className="status-dot" />

          {selected ? "SELECTED" : "STANDBY"}
        </div>
      </div>

      <CameraFeed
        camera={camera}
        selected={selected}
      />

      <div className="camera-metrics">
        <ScoreBar
          label="Face Size"
          value={camera.faceSize}
        />

        <ScoreBar
          label="Frontal"
          value={camera.frontal}
        />

        <ScoreBar
          label="Center"
          value={camera.center}
        />

        <ScoreBar
          label="Visibility"
          value={camera.visibility}
        />
      </div>

      <div className="director-score">
        <div>
          <span>DIRECTOR SCORE</span>
          <small>AI camera evaluation</small>
        </div>

        <strong>{camera.score}</strong>
      </div>
    </article>
  );
}

export default CameraCard;