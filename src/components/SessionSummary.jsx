function formatDuration(ms) {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}분 ${total % 60}초`;
}

function SessionSummary({ mode, rubric, elapsedMs, stats, onRestart }) {
  const frequent = Object.entries(stats.eventCounts).sort((a, b) => b[1] - a[1])[0];
  const longest = Object.entries(stats.issueDurations).sort((a, b) => b[1] - a[1])[0];
  return (
    <section className="panel summary-panel">
      <div className="summary-copy"><span className="eyebrow">SESSION COMPLETE · MOCK ANALYSIS SUMMARY</span><h2>세션 요약</h2><p>능력이나 건강 상태의 점수가 아닌, 이번 Mock 세션에서 발생한 관찰 이벤트 요약입니다.</p></div>
      <div className="summary-grid">
        <div><span>MODE</span><strong>{mode.label}{mode.id === "interview" ? ` · Rubric ${rubric}` : ""}</strong></div>
        <div><span>DURATION</span><strong>{formatDuration(elapsedMs)}</strong></div>
        <div><span>CAUTION</span><strong>{stats.caution}</strong></div>
        <div><span>WARNING</span><strong>{stats.warning}</strong></div>
        <div><span>RECOVERY</span><strong>{stats.recovered}</strong></div>
        <div><span>MOST FREQUENT</span><strong>{frequent?.[0] || "없음"}</strong></div>
        <div className="wide"><span>주요 문제 자세 누적시간</span><strong>{longest ? `${longest[0]} · ${(longest[1] / 1000).toFixed(1)}초` : "기록 없음"}</strong></div>
      </div>
      <button className="primary-button" onClick={onRestart}>NEW SESSION</button>
    </section>
  );
}
export default SessionSummary;
