import { useState } from "react";
import { MODES, RUBRICS } from "../config/modes";

const modeDescriptions = { interview: "자세 안정성 중심", neck: "목·상체 자세 변화 중심", presentation: "자연스러운 이동 범위를 허용한 자세 평가" };

function SettingOption({ selected, title, description, onClick }) {
  return <button type="button" className={`setting-option ${selected ? "selected" : ""}`} onClick={onClick}><i>{selected ? "●" : "○"}</i><span><strong>{title}</strong><small>{description}</small></span></button>;
}

function ModeSelector({ modeId, rubric, inputMode, cameraDevices, cameraDeviceId, cameraPermission, onModeChange, onRubricChange, onInputModeChange, onCameraDeviceChange, onClose }) {
  const [view, setView] = useState("list");
  const mode = MODES[modeId];
  const activeCamera = cameraDevices.find((device) => device.deviceId === cameraDeviceId) || cameraDevices[0];
  const title = { list: "분석 설정", mode: "모드", rubric: "자세 기준", input: "입력 방식", camera: "카메라" }[view];
  const back = () => setView("list");

  return (
    <aside className="settings-panel" role="dialog" aria-labelledby="settings-title">
      <div className="settings-header">{view !== "list" ? <button type="button" onClick={back}>‹ 분석 설정</button> : <span>메뉴</span>}<strong id="settings-title">{title}</strong><button type="button" aria-label="분석 설정 닫기" onClick={onClose}>×</button></div>
      {view === "list" && <div className="settings-list">
        <button type="button" onClick={() => setView("mode")}><span>모드</span><strong>{mode.label} ›</strong></button>
        {modeId === "interview" && <button type="button" onClick={() => setView("rubric")}><span>자세 기준</span><strong>기준 {rubric} ›</strong></button>}
        <button type="button" onClick={() => setView("input")}><span>입력 방식</span><strong>{inputMode === "live" ? "실제 카메라" : "데모 모드"} ›</strong></button>
        {inputMode === "live" && <button type="button" onClick={() => cameraDevices.length > 1 && setView("camera")}><span>카메라</span><strong>{activeCamera?.label || (cameraPermission === "requesting" ? "확인 중" : "연결 대기")}{cameraDevices.length > 1 ? " ›" : ""}</strong></button>}
      </div>}
      {view === "mode" && <div className="settings-options">{Object.values(MODES).map((item) => <SettingOption key={item.id} selected={item.id === modeId} title={item.label} description={modeDescriptions[item.id]} onClick={() => { onModeChange(item.id); back(); }} />)}</div>}
      {view === "rubric" && <div className="settings-options">{Object.entries(RUBRICS).map(([id, item]) => <SettingOption key={id} selected={id === rubric} title={`기준 ${id}`} description={item.description} onClick={() => { onRubricChange(id); back(); }} />)}</div>}
      {view === "input" && <div className="settings-options"><SettingOption selected={inputMode === "mock"} title="데모 모드" description="준비된 자세 상황과 데모 Feature 사용" onClick={() => { onInputModeChange("mock"); back(); }} /><SettingOption selected={inputMode === "live"} title="실제 카메라" description="실제 Webcam 영상 사용 · 자세 분석 데이터는 데모 기반" onClick={() => { onInputModeChange("live"); back(); }} /></div>}
      {view === "camera" && <div className="settings-options">{cameraDevices.map((device, index) => <SettingOption key={device.deviceId} selected={device.deviceId === cameraDeviceId} title={device.label || `카메라 ${index + 1}`} description="이 카메라 하나를 미리보기와 분석 대상으로 사용" onClick={() => { onCameraDeviceChange(device.deviceId); back(); }} />)}</div>}
      <p className="settings-note">실제 카메라에서도 자세 분석과 코칭은 데모 데이터로 동작합니다.</p>
    </aside>
  );
}
export default ModeSelector;
