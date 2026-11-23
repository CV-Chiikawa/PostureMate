import { useState } from "react";
import { MODES, RUBRICS } from "../config/modes";

const modeDescriptions = { interview: "자세 안정성 중심", neck: "목·상체 자세 변화 중심", presentation: "자연스러운 이동 범위를 허용한 자세 평가" };

function SettingOption({ selected, title, description, onClick }) {
  return <button type="button" className={`setting-option ${selected ? "selected" : ""}`} onClick={onClick}><i>{selected ? "●" : "○"}</i><span><strong>{title}</strong><small>{description}</small></span></button>;
}

function ModeSelector({ modeId, rubric, cameraDevices, cameraDeviceId, cameraPermission, onModeChange, onRubricChange, onCameraDeviceChange, onClose }) {
  const [view, setView] = useState("list");
  const mode = MODES[modeId];
  const activeCamera = cameraDevices.find((device) => device.deviceId === cameraDeviceId) || cameraDevices[0];
  const title = { list: "분석 설정", mode: "모드", rubric: "자세 기준", camera: "카메라" }[view];
  const back = () => setView("list");

  return (
    <aside className="settings-panel" role="dialog" aria-labelledby="settings-title">
      <div className="settings-header">{view !== "list" ? <button type="button" onClick={back}>‹ 분석 설정</button> : <span>메뉴</span>}<strong id="settings-title">{title}</strong><button type="button" aria-label="분석 설정 닫기" onClick={onClose}>×</button></div>
      {view === "list" && <div className="settings-list">
        <button type="button" onClick={() => setView("mode")}><span>모드</span><strong>{mode.label} ›</strong></button>
        {modeId === "interview" && <button type="button" onClick={() => setView("rubric")}><span>자세 기준</span><strong>기준 {rubric} ›</strong></button>}
        <button type="button" onClick={() => cameraDevices.length > 1 && setView("camera")}><span>카메라</span><strong>{activeCamera?.label || (cameraPermission === "requesting" ? "확인 중" : "연결 대기")}{cameraDevices.length > 1 ? " ›" : ""}</strong></button>
      </div>}
      {view === "mode" && <div className="settings-options">{Object.values(MODES).map((item) => <SettingOption key={item.id} selected={item.id === modeId} title={item.label} description={modeDescriptions[item.id]} onClick={() => { onModeChange(item.id); back(); }} />)}</div>}
      {view === "rubric" && <div className="settings-options">{Object.entries(RUBRICS).map(([id, item]) => <SettingOption key={id} selected={id === rubric} title={`기준 ${id}`} description={item.description} onClick={() => { onRubricChange(id); back(); }} />)}</div>}
      {view === "camera" && <div className="settings-options">{cameraDevices.map((device, index) => <SettingOption key={device.deviceId} selected={device.deviceId === cameraDeviceId} title={device.label || `카메라 ${index + 1}`} description="이 카메라 하나를 미리보기와 분석 대상으로 사용" onClick={() => { onCameraDeviceChange(device.deviceId); back(); }} />)}</div>}
      <p className="settings-note">서버는 원본 영상을 저장하지 않습니다. SOLAR는 자세 이벤트를 받으며, MediaPipe는 Google에 성능·사용 지표를 보낼 수 있습니다.</p>
    </aside>
  );
}
export default ModeSelector;
