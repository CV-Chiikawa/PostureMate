function PersonShape({ className = "", pointing = false }) {
  return (
    <span className={`art-person ${className}`}>
      <i className="art-head" />
      <i className="art-body" />
      <i className="art-arm art-arm-primary" />
      <i className={`art-arm art-arm-secondary ${pointing ? "pointing" : ""}`} />
    </span>
  );
}

function ModeArtwork({ modeId, compact = false }) {
  return (
    <div className={`mode-artwork artwork-${modeId} ${compact ? "compact" : ""}`} aria-hidden="true">
      <span className="art-sun" />

      {modeId === "neck" && (
        <>
          <span className="art-desk" />
          <span className="art-monitor"><i className="monitor-screen" /><i className="monitor-stand" /><i className="monitor-base" /></span>
          <span className="art-keyboard" />
          <span className="art-chair" />
          <PersonShape className="art-worker" />
        </>
      )}

      {modeId === "interview" && (
        <>
          <span className="art-interview-table"><i className="interview-paper" /></span>
          <span className="art-chair chair-left" />
          <span className="art-chair chair-right" />
          <PersonShape className="art-candidate" />
          <PersonShape className="art-interviewer" />
          <span className="art-conversation"><i /><i /><i /></span>
        </>
      )}

      {modeId === "presentation" && (
        <>
          <span className="art-board"><i className="board-title" /><i className="board-line line-one" /><i className="board-line line-two" /><i className="board-chart" /></span>
          <PersonShape className="art-teacher" pointing />
          <span className="art-floor" />
        </>
      )}

      <span className="art-accent" />
    </div>
  );
}

export default ModeArtwork;
