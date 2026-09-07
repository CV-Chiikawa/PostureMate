function Header({ isRunning }) {
  return (
    <header className="app-header">
      <div className="brand">
        <div className="brand-mark">
          AD
        </div>

        <div>
          <h1>AutoDirector</h1>
          <p>AI MULTI-CAMERA DIRECTOR</p>
        </div>
      </div>

      <div className="system-status">
        <span
          className={`system-dot ${
            isRunning ? "online" : "offline"
          }`}
        />

        {isRunning
          ? "DIRECTOR ONLINE"
          : "DIRECTOR PAUSED"}
      </div>
    </header>
  );
}

export default Header;