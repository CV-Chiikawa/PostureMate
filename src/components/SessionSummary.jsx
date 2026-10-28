function formatDuration(ms) {
  const total = Math.floor(ms / 1000);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

const eventLabels = { forward_lean: "상체 전방 기울임", torso_lean: "상체 기울기", head_tilt: "머리 기울기", shoulder_height_difference: "어깨 균형", body_sway: "몸 흔들림", hand_placement: "손·무릎 배치", posture: "자세 변화" };

function SessionSummary({ mode, rubric, elapsedMs, stats, logs, coachingMessage, onRestart }) {
  const frequent = Object.entries(stats.eventCounts).sort((a, b) => b[1] - a[1])[0];
  const longest = Object.entries(stats.issueDurations).sort((a, b) => b[1] - a[1])[0];
  const eventRows = Object.entries(stats.eventCounts).sort((a, b) => b[1] - a[1]);
  const maxCount = Math.max(1, ...eventRows.map(([, count]) => count));
  const timeline = logs.filter((log) => ["CAUTION", "WARNING", "RECOVERED"].includes(log.status)).slice(-6);
  return (
    <section className="result-card">
      <div className="result-heading"><div><span className="section-kicker">SESSION REPORT</span><h2>분석 결과</h2><p>이번 세션에서 실제로 기록된 데모 자세 이벤트를 정리했습니다.</p></div><div className="result-mode"><span>분석 모드</span><strong>{mode.label}{mode.id === "interview" ? ` · 기준 ${rubric}` : ""}</strong></div></div>
      <div className="result-overview"><div><span>분석 시간</span><strong>{formatDuration(elapsedMs)}</strong></div><div><span>주의</span><strong>{stats.caution}회</strong></div><div><span>교정 필요</span><strong>{stats.warning}회</strong></div><div><span>정상 복귀</span><strong>{stats.recovered}회</strong></div><div><span>주요 자세</span><strong>{frequent ? eventLabels[frequent[0]] || frequent[0] : "기록 없음"}</strong></div>{longest && <div><span>최장 누적</span><strong>{(longest[1] / 1000).toFixed(1)}초</strong></div>}</div>
      <div className="result-detail-grid">
        <section className="result-statistics"><div className="result-section-title"><span>주요 분석 결과</span><small>기록된 문제별 횟수</small></div>{eventRows.length ? eventRows.map(([type, count]) => <div className="result-bar" key={type}><span>{eventLabels[type] || type}</span><i><b style={{ width: `${Math.max(8, count / maxCount * 100)}%` }} /></i><strong>{count}회</strong></div>) : <p className="result-empty">기록된 문제 자세 이벤트가 없습니다.</p>}</section>
        <section className="result-coaching"><div className="result-section-title"><span>데모 코칭</span><small>SOLAR 미연동</small></div><blockquote>{coachingMessage}</blockquote></section>
      </div>
      <section className="result-timeline"><div className="result-section-title"><span>자세 변화 요약</span><small>이번 세션의 실제 이벤트</small></div>{timeline.length ? <ol>{timeline.map((log) => <li className={`timeline-${log.status.toLowerCase()}`} key={log.id}><time>{log.time}</time><span>{log.status}</span><p>{log.message}</p></li>)}</ol> : <p className="result-empty">표시할 자세 변화 기록이 없습니다.</p>}</section>
      <button className="primary-button result-action" type="button" onClick={onRestart}>다시 분석하기</button>
    </section>
  );
}
export default SessionSummary;
