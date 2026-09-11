function PoseOverlay({ pose }) {
  const x = pose.sway || 0;
  const lean = pose.lean || 0;
  const head = pose.head || 0;
  return (
    <svg className="pose-overlay" viewBox="0 0 320 180" role="img" aria-label="실제 검출이 아닌 데모용 자세 Landmark">
      <g transform={`translate(${x} 0) rotate(${lean * 0.18} 160 104)`}>
        <circle cx={160 + head * 0.2} cy="45" r="14" /><line x1="160" y1="59" x2="160" y2="115" /><line x1="118" y1="76" x2="202" y2="76" /><line x1="118" y1="76" x2="132" y2="121" /><line x1="202" y1="76" x2="188" y2="121" /><line x1="160" y1="115" x2="137" y2="158" /><line x1="160" y1="115" x2="183" y2="158" />
        {[160, 118, 202, 132, 188, 137, 183].map((cx, index) => <circle key={`${cx}-${index}`} cx={cx} cy={[59, 76, 76, 121, 121, 158, 158][index]} r="3" />)}
      </g>
    </svg>
  );
}

function CameraPanel({ mode, scenario, inputMode, onInputModeChange, videoRef, cameraDevices, cameraDeviceId, onCameraDeviceChange, cameraPermission, cameraError, onCameraRetry, visibility, evaluation }) {
  const permissionLabel = { idle: "대기", requesting: "권한 요청 중", granted: "연결됨", denied: "권한 거부", unavailable: "지원 안 됨", error: "연결 오류" }[cameraPermission] || cameraPermission;
  return (
    <section className="panel camera-panel">
      <div className="panel-heading"><div><span className="eyebrow">02 · CAMERA &amp; GUIDE</span><h2>CAMERA PREVIEW</h2></div><span className={`source-badge ${inputMode}`}>{inputMode === "live" ? "LIVE VIDEO / MOCK ANALYSIS" : "MOCK CAMERA / MOCK ANALYSIS"}</span></div>
      <div className={`preview ${!evaluation.available ? "visibility-warning" : ""}`}>
        {inputMode === "live" ? <video ref={videoRef} autoPlay muted playsInline /> : <div className="mock-scene" aria-label="Mock Camera Preview"><div className="mock-aura" /><div className="mock-person" /></div>}
        <div className={`guide-frame guide-${mode.id}`}><span>{mode.shortLabel} GUIDE</span></div>
        <PoseOverlay pose={scenario.pose} />
        <span className="overlay-disclaimer">POSE OVERLAY — DEMO</span>
        <div className="preview-meta"><span>LANDMARK VISIBILITY {Math.round(visibility * 100)}%</span><span>{scenario.label.toUpperCase()}</span></div>
        {!evaluation.available && <div className="camera-guide-alert"><strong>판정 불가 · 카메라 조정 필요</strong><span>{evaluation.guide}</span></div>}
      </div>
      <div className="camera-toolbar">
        <div className="segmented-control" aria-label="입력 모드"><button className={inputMode === "mock" ? "active" : ""} onClick={() => onInputModeChange("mock")}>MOCK</button><button className={inputMode === "live" ? "active" : ""} onClick={() => onInputModeChange("live")}>LIVE CAMERA</button></div>
        <label><span>CAMERA DEVICE</span><select value={cameraDeviceId} onChange={(event) => onCameraDeviceChange(event.target.value)} disabled={inputMode !== "live" || !cameraDevices.length}>{!cameraDevices.length && <option value="">{inputMode === "live" ? "장치 확인 중" : "LIVE에서 선택"}</option>}{cameraDevices.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Camera ${index + 1}`}</option>)}</select></label>
        <div className="permission-state"><span>PERMISSION</span><strong>{permissionLabel}</strong></div>
        {inputMode === "live" && cameraError && <button className="retry-button" onClick={onCameraRetry}>다시 시도</button>}
      </div>
      {inputMode === "live" && cameraError && <p className="camera-error">{cameraError}</p>}
      <div className="guide-copy"><strong>{mode.label} 구도 안내</strong><span>{mode.guide}</span></div>
    </section>
  );
}
export default CameraPanel;
