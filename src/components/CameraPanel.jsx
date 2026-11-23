function CameraPanel({ mode, videoRef, visibility, temporalStatus, sessionState, cameraPermission, cameraError, onCameraRetry }) {
  return (
    <section className={`panel camera-panel focus-camera posture-${temporalStatus?.toLowerCase() ?? "waiting"}`}>
      <div className="panel-heading"><div><span className="eyebrow">현재 화면</span><h2>카메라 미리보기</h2></div><span className="source-badge live">실제 카메라</span></div>
      <div className="preview">
        <video ref={videoRef} autoPlay muted playsInline />
        <div className="preview-topbar"><span><i aria-hidden="true" />{cameraPermission === "granted" ? "카메라 연결됨" : sessionState === "ended" ? "카메라 꺼짐" : "카메라 연결 대기"}</span><strong>{mode.label}</strong></div>
        <div className={`guide-frame guide-${mode.id}`}><span>{mode.label} 구도</span></div>
        <div className="preview-meta"><span>{visibility == null ? "측정 대기" : `가시성 ${Math.round(visibility * 100)}%`}</span><span>MediaPipe 자세 분석</span></div>
        <div className="preview-guidance"><span>구도 안내</span><strong>{mode.guide || `${mode.label}에 맞게 상체가 화면 안에 보이도록 조정해 주세요.`}</strong></div>
        {sessionState === "ended" && <div className="camera-session-ended">분석이 종료되었습니다.</div>}
      </div>
      {sessionState !== "ended" && cameraError && <div className="camera-inline-error"><span>{cameraError}</span><button type="button" onClick={onCameraRetry}>다시 시도</button></div>}
      {sessionState !== "ended" && !cameraError && cameraPermission !== "granted" && <p className="camera-wait">카메라 연결 상태 · {cameraPermission === "requesting" ? "권한 확인 중" : "연결 대기"}</p>}
    </section>
  );
}
export default CameraPanel;
