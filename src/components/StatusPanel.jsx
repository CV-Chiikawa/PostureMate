const stateCopy = {
  NORMAL: { title: "정상 자세", description: "현재 자세가 선택한 모드의 허용 범위에 있습니다." },
  CANDIDATE: { title: "자세 변화 감지 중", description: "순간적인 움직임인지 잠시 확인하고 있습니다." },
  CAUTION: { title: "주의가 필요합니다", description: "자세 변화가 일정 시간 이어지고 있습니다." },
  WARNING: { title: "자세 교정이 필요합니다", description: "문제 자세가 계속되어 조정을 권장합니다." },
  RECOVERED: { title: "정상 자세로 돌아왔습니다", description: "자세가 다시 중립 범위로 돌아왔습니다." },
  COOLDOWN: { title: "자세 상태를 확인 중입니다", description: "같은 안내를 반복하지 않고 현재 상태를 확인합니다." },
};

function StatusPanel({ temporal, evaluation }) {
  const copy = stateCopy[temporal.status];
  return (
    <section className={`panel status-panel status-${temporal.status.toLowerCase()}`}>
      <div className="panel-heading"><div><span className="eyebrow">현재 자세</span><h2>{evaluation.available ? copy.title : "카메라 구도를 확인해주세요"}</h2></div><span className="state-code">{evaluation.available ? temporal.status : "판정 불가"}</span></div>
      <div className="status-message"><span className="status-pulse" /><div><p>{evaluation.available ? copy.description : evaluation.guide}</p>{evaluation.available && temporal.eventLabel && <strong>감지 항목 · {temporal.eventLabel}</strong>}</div></div>
    </section>
  );
}
export default StatusPanel;
