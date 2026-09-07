function CameraFeed({
  camera,
  selected = false,
  program = false,
}) {
  const subjectX = program ? 50 : camera.subjectX;

  const scale = program
    ? Math.max(camera.subjectScale * 1.2, 1.15)
    : camera.subjectScale;

  return (
    <div
      className={`camera-feed ${
        selected ? "camera-feed-selected" : ""
      } ${program ? "program-camera-feed" : ""}`}
    >
      <div className="camera-grid-lines" />

      <div className="camera-top-overlay">
        <span>{camera.name}</span>

        <span className="resolution-label">
          1920 × 1080
        </span>
      </div>

      <div
        className="camera-subject"
        style={{
          left: `${subjectX}%`,
          transform: `translateX(-50%) scale(${scale})`,
        }}
      >
        <div className="face-detection-box">
          <div className="subject-head" />

          <span className="face-label">
            FACE
          </span>
        </div>

        <div className="subject-body" />
      </div>

      <div className="camera-crosshair">
        <span />
        <span />
      </div>

      <div className="camera-bottom-overlay">
        <span>
          FACE {camera.faceSize}%
        </span>

        <span>
          SCORE {camera.score}
        </span>
      </div>
    </div>
  );
}

export default CameraFeed;