function EventLog({ logs, defaultOpen = false }) {
  return (
    <details className="panel event-log" open={defaultOpen || undefined}>
      <summary><span>자세 이벤트 기록</span><b>{logs.length}건</b><i>▾</i></summary>
      <div className="log-list">{logs.length === 0 && <p className="empty-log">아직 기록된 자세 이벤트가 없습니다.</p>}{logs.map((log) => <div className={`log-entry log-${log.status.toLowerCase()}`} key={log.id}><time>{log.time}</time><strong>{log.status}</strong><span>{log.message}</span></div>)}</div>
    </details>
  );
}
export default EventLog;
