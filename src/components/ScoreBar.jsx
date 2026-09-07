function ScoreBar({ label, value }) {
  return (
    <div className="score-row">
      <div className="score-label-row">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>

      <div className="score-track">
        <div
          className="score-fill"
          style={{
            width: `${value}%`,
          }}
        />
      </div>
    </div>
  );
}

export default ScoreBar;