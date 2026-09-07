import CameraFeed from "./CameraFeed";

function ProgramOutput({ camera, reason }) {
  return (
    <section className="panel program-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">
            FINAL OUTPUT
          </span>

          <h2>PROGRAM</h2>
        </div>

        <div className="live-badge">
          <span />
          LIVE
        </div>
      </div>

      <CameraFeed
        camera={camera}
        selected
        program
      />

      <div className="program-information">
        <div>
          <span className="info-label">
            ACTIVE CAMERA
          </span>

          <strong>{camera.name}</strong>
        </div>

        <div>
          <span className="info-label">
            AUTO CROP
          </span>

          <strong>ENABLED</strong>
        </div>
      </div>

      <div className="selection-reason">
        <span>AI DECISION</span>

        <p>{reason}</p>
      </div>
    </section>
  );
}

export default ProgramOutput;