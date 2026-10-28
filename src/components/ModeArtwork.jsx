function ModeArtwork({ modeId, compact = false }) {
  return (
    <div className={`mode-artwork artwork-${modeId} ${compact ? "compact" : ""}`} aria-hidden="true">
      <span className="art-sun" />
      <span className="art-desk" />
      <span className="art-screen" />
      <span className="art-person"><i className="art-head" /><i className="art-body" /><i className="art-arm" /></span>
      <span className="art-accent" />
    </div>
  );
}

export default ModeArtwork;
