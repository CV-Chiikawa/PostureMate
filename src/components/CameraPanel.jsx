function PoseOverlay({ pose }) {
  const x = pose.sway || 0;
  const lean = pose.lean || 0;
  const head = pose.head || 0;
  return (
    <svg className="pose-overlay" viewBox="0 0 320 180" role="img" aria-label="실제 검출이 아닌 데모용 자세 포인트"><g transform={`translate(${x} 0) rotate(${lean * 0.18} 160 104)`}><circle cx={160 + head * 0.2} cy="45" r="14" /><line x1="160" y1="59" x2="160" y2="115" /><line x1="118" y1="76" x2="202" y2="76" /><line x1="118" y1="76" x2="132" y2="121" /><line x1="202" y1="76" x2="188" y2="121" /><line x1="160" y1="115" x2="137" y2="158" /><line x1="160" y1="115" x2="183" y2="158" />{[160,118,202,132,188,137,183].map((cx,index) => <circle key={`${cx}-${index}`} cx={cx} cy={[59,76,76,121,121,158,158][index]} r="3" />)}</g></svg>
  );
}

function CameraPanel({ mode, scenario, inputMode, videoRef, visibility, evaluation, cameraPermission, cameraError, onCameraRetry }) {
  return (
    <section className="panel camera-panel focus-camera">
      <div className="panel-heading"><div><span className="eyebrow">현재 화면</span><h2>카메라 미리보기</h2></div><span className={`source-badge ${inputMode}`}>{inputMode === "live" ? "실제 영상 · 데모 분석" : "데모 분석"}</span></div>
      <div className={`preview ${!evaluation.available ? "visibility-warning" : ""}`}>
        {inputMode === "live" ? <video ref={videoRef} autoPlay muted playsInline /> : <div className="mock-scene" aria-label="데모 카메라 화면"><div className="mock-aura" /><div className="mock-person" /></div>}
        <div className={`guide-frame guide-${mode.id}`}><span>{mode.label} 구도</span></div><PoseOverlay pose={scenario.pose} /><span className="overlay-disclaimer">자세 포인트 · 데모</span>
        <div className="preview-meta"><span>가시성 {Math.round(visibility * 100)}%</span><span>{inputMode === "mock" ? scenario.label : "영상은 실제 · 분석값은 데모"}</span></div>
        {!evaluation.available && <div className="camera-guide-alert"><strong>카메라 조정이 필요합니다</strong><span>{evaluation.guide}</span></div>}
      </div>
      {inputMode === "live" && cameraError && <div className="camera-inline-error"><span>{cameraError}</span><button type="button" onClick={onCameraRetry}>다시 시도</button></div>}
      {inputMode === "live" && !cameraError && cameraPermission !== "granted" && <p className="camera-wait">카메라 연결 상태 · {cameraPermission === "requesting" ? "권한 확인 중" : "연결 대기"}</p>}
    </section>
  );
}
export default CameraPanel;
