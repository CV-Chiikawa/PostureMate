function EventLog({ logs }) {
  return (
    <section className="panel log-panel">
      <div className="panel-heading"><div><span className="eyebrow">REAL-TIME EVENT STREAM · MAX 24</span><h2>EVENT LOG</h2></div><span className="log-count">{logs.length} EVENTS</span></div>
      <div className="log-list">{logs.length === 0 && <p className="empty-log">세션을 시작하면 상태 변화가 기록됩니다.</p>}{logs.map((log) => <div className={`log-entry log-${log.status.toLowerCase()}`} key={log.id}><time>{log.time}</time><strong>{log.status}</strong><span>{log.message}</span></div>)}</div>
    </section>
  );
}
export default EventLog;
