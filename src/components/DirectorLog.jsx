function DirectorLog({ logs }) {
  return (
    <section className="panel log-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">
            REAL-TIME EVENT STREAM
          </span>

          <h2>DIRECTOR LOG</h2>
        </div>
      </div>

      <div className="log-list">
        {logs.map((log) => (
          <div
            className={`log-entry ${log.type}`}
            key={log.id}
          >
            <span className="log-time">
              {log.time}
            </span>

            <span className="log-symbol">
              {log.type === "switch"
                ? "SW"
                : log.type === "candidate"
                  ? "AI"
                  : "SYS"}
            </span>

            <span className="log-message">
              {log.message}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

export default DirectorLog;