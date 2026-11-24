function formatDuration(ms) {
  const total = Math.floor(ms / 1000);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

const eventLabels = { forward_head_proxy: "머리·어깨 정렬 변화", forward_lean: "상체 전방 기울임", torso_lean: "상체 기울기", head_tilt: "머리 기울기", shoulder_height_difference: "어깨 균형", body_sway: "몸 흔들림", hand_placement: "손·무릎 배치", posture: "자세 변화" };

function getFeedbackView(sessionFeedback, stats, eventRows) {
  if (sessionFeedback?.status === "loading") {
    return { title: "이번 연습 피드백", message: "SOLAR가 이번 연습의 자세 기록을 살펴보고 있습니다." };
  }
  if (sessionFeedback?.source === "solar") {
    return { title: "SOLAR 종합 피드백", message: sessionFeedback.message };
  }
  if (sessionFeedback?.source === "insufficient") {
    return { title: "이번 연습 피드백", message: "측정 시간이 짧습니다. 기준 자세를 잡은 뒤 3초 이상 측정해 주세요." };
  }
  if (stats.warning === 0) {
    return { title: "측정 기록 요약", message: "측정 구간에 경고가 없었습니다." };
  }
  const topCount = eventRows[0]?.[1] ?? 0;
  const topIssues = eventRows.filter(([, count]) => count === topCount).map(([type]) => eventLabels[type] || type);
  return {
    title: "측정 기록 요약",
    message: topIssues.length
      ? `가장 자주 기록된 문제는 ${topIssues.join(", ")}이며 ${topCount}회 나타났습니다.`
      : `이번 연습에서 경고가 ${stats.warning}회 기록되었습니다.`,
  };
}

function SessionSummary({ mode, rubric, elapsedMs, stats, logs, sessionFeedback, onRestart }) {
  const longest = Object.entries(stats.issueDurations).sort((a, b) => b[1] - a[1])[0];
  const issueDuration = Object.values(stats.issueDurations).reduce((total, duration) => total + duration, 0);
  const eventRows = Object.entries(stats.eventCounts).sort((a, b) => b[1] - a[1]);
  const maxCount = Math.max(1, ...eventRows.map(([, count]) => count));
  const primaryIssues = eventRows.filter(([, count]) => count === maxCount);
  const feedbackView = getFeedbackView(sessionFeedback, stats, eventRows);
  const postureTimeline = logs.filter((log) => ["CAUTION", "WARNING", "RECOVERED"].includes(log.status)).slice(-6);
  const sessionStart = logs.find((log) => log.status === "세션" && log.message.startsWith("분석 시작"));
  const sessionEnd = [...logs].reverse().find((log) => log.status === "세션" && log.message.startsWith("분석 종료"));
  const timeline = [
    sessionStart && { ...sessionStart, status: "START", message: "자세 감시 시작" },
    ...postureTimeline,
    sessionEnd && { ...sessionEnd, status: "END", message: "자세 감시 종료" },
  ].filter(Boolean);
  return (
    <section className="result-card">
      <div className="result-heading"><div><h2>분석 결과</h2><p>주요 자세변화와 코칭 결과를 확인하세요.</p></div><div className="result-mode"><span>분석 모드</span><strong>{mode.label}{mode.id === "interview" ? ` · 기준 ${rubric}` : ""}</strong></div></div>
      <div className="result-overview"><div><span>분석 시간</span><strong>{formatDuration(elapsedMs)}</strong></div><div><span>주의</span><strong>{stats.caution}회</strong></div><div><span>경고</span><strong>{stats.warning}회</strong></div><div><span>누적 이상 시간</span><strong>{(issueDuration / 1000).toFixed(1)}초</strong></div><div><span>항목별 최장 누적</span><strong>{longest ? `${(longest[1] / 1000).toFixed(1)}초` : "0.0초"}</strong></div><div><span>정상 복귀</span><strong>{stats.recovered}회</strong></div></div>
      <div className="result-detail-grid">
        <div className="result-analysis-column">
          <section className="result-primary-issue"><div className="result-section-title"><span>주요 문제</span><small>가장 자주 기록된 항목</small></div>{primaryIssues.length ? <p className="result-primary-list">{primaryIssues.map(([type]) => eventLabels[type] || type).join(", ")}</p> : <p className="result-empty">기록 없음</p>}</section>
          <section className="result-statistics"><div className="result-section-title"><span>주요 분석 결과</span><small>기록된 문제별 횟수</small></div>{eventRows.length ? eventRows.map(([type, count]) => <div className="result-bar" key={type}><span>{eventLabels[type] || type}</span><i><b style={{ width: `${Math.max(8, count / maxCount * 100)}%` }} /></i><strong>{count}회</strong></div>) : <p className="result-empty">기록된 문제 자세 이벤트가 없습니다.</p>}</section>
        </div>
        <section className="result-coaching"><div className="result-section-title"><span>{feedbackView.title}</span></div><blockquote aria-live="polite">{feedbackView.message}</blockquote></section>
      </div>
      <section className="result-timeline"><div className="result-section-title"><span>자세 변화 요약</span><small>감시 시작부터 종료까지</small></div>{timeline.length ? <ol>{timeline.map((log) => <li className={`timeline-${log.status.toLowerCase()}`} key={`${log.status}-${log.id}`}><time>{log.time}</time><span>{log.status === "START" ? "감시 시작" : log.status === "END" ? "감시 종료" : log.status}</span><p>{log.message}</p></li>)}</ol> : <p className="result-empty">표시할 자세 변화 기록이 없습니다.</p>}</section>
      <button className="primary-button result-action" type="button" onClick={onRestart}>다시 분석하기</button>
    </section>
  );
}
export default SessionSummary;
