function formatDuration(ms) {
  const total = Math.floor(ms / 1000);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function SessionSummary({ mode, rubric, elapsedMs, stats, onRestart }) {
  const frequent = Object.entries(stats.eventCounts).sort((a, b) => b[1] - a[1])[0];
  const longest = Object.entries(stats.issueDurations).sort((a, b) => b[1] - a[1])[0];
  return (
    <section className="result-card">
      <div className="result-check" aria-hidden="true">✓</div><span className="eyebrow">분석 결과</span><h2>분석이 완료되었습니다</h2><p>아래 내용은 능력이나 건강 상태에 대한 점수가 아닌, 이번 데모 세션의 자세 이벤트 요약입니다.</p>
      <div className="result-grid"><div><span>모드</span><strong>{mode.label}{mode.id === "interview" ? ` · 기준 ${rubric}` : ""}</strong></div><div><span>분석 시간</span><strong>{formatDuration(elapsedMs)}</strong></div><div><span>주의</span><strong>{stats.caution}회</strong></div><div><span>교정 필요</span><strong>{stats.warning}회</strong></div><div><span>정상 복귀</span><strong>{stats.recovered}회</strong></div><div><span>가장 자주 감지된 자세</span><strong>{frequent?.[0] || "없음"}</strong></div>{longest && <div className="wide"><span>주요 문제 자세 누적시간</span><strong>{longest[0]} · {(longest[1] / 1000).toFixed(1)}초</strong></div>}</div>
      <button className="primary-button result-action" type="button" onClick={onRestart}>다시 분석하기</button>
    </section>
  );
}
export default SessionSummary;
