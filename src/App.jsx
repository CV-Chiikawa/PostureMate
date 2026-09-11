import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

import CameraPanel from "./components/CameraPanel";
import CoachingPanel from "./components/CoachingPanel";
import ControlPanel from "./components/ControlPanel";
import EventLog from "./components/EventLog";
import FeaturePanel from "./components/FeaturePanel";
import Header from "./components/Header";
import ModeSelector from "./components/ModeSelector";
import SessionSummary from "./components/SessionSummary";
import StatusPanel from "./components/StatusPanel";
import WelcomeModal from "./components/WelcomeModal";
import { MODES } from "./config/modes";
import { MOCK_SCENARIOS } from "./data/mockScenarios";
import { useCamera } from "./hooks/useCamera";
import { mockCoachingProvider } from "./services/MockCoachingProvider";
import { mockFeatureProvider } from "./services/MockFeatureProvider";
import { evaluateContext } from "./utils/evaluator";
import { advanceTemporalState, INITIAL_TEMPORAL_STATE } from "./utils/temporalEvent";

const initialStats = () => ({ caution: 0, warning: 0, recovered: 0, eventCounts: {}, issueDurations: {} });

function App() {
  const [showWelcome, setShowWelcome] = useState(true);
  const [modeId, setModeId] = useState("interview");
  const [rubric, setRubric] = useState("A");
  const [inputMode, setInputMode] = useState("mock");
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [sessionState, setSessionState] = useState("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [temporal, setTemporal] = useState(INITIAL_TEMPORAL_STATE);
  const [stats, setStats] = useState(initialStats);
  const [logs, setLogs] = useState([]);
  const logIdRef = useRef(0);
  const lastTickRef = useRef(0);

  const mode = MODES[modeId];
  const scenario = MOCK_SCENARIOS[scenarioIndex];
  const featurePacket = useMemo(() => mockFeatureProvider.getFeatures(scenarioIndex), [scenarioIndex]);
  const evaluation = useMemo(() => evaluateContext(featurePacket, modeId, rubric), [featurePacket, modeId, rubric]);
  const { videoRef, devices: cameraDevices, deviceId: cameraDeviceId, selectDevice: selectCameraDevice, permission: cameraPermission, error: cameraError, start: startCamera, retry: retryCamera, stop: stopCamera } = useCamera();
  const coachingMessage = mockCoachingProvider.getMessage(temporal, mode);

  const addLog = useCallback((status, message) => {
    const entry = { id: logIdRef.current++, time: new Date().toLocaleTimeString("ko-KR", { hour12: false }), status, message };
    setLogs((current) => [...current, entry].slice(-24));
  }, []);

  const resetSession = useCallback((state = "idle") => {
    setSessionState(state);
    setElapsedMs(0);
    setTemporal({ ...INITIAL_TEMPORAL_STATE });
    setStats(initialStats());
    setLogs([]);
    lastTickRef.current = 0;
  }, []);

  useEffect(() => {
    if (sessionState !== "running") return undefined;
    lastTickRef.current = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const delta = Math.max(0, now - lastTickRef.current);
      lastTickRef.current = now;
      setElapsedMs((current) => current + delta);
      setTemporal((previous) => {
        const next = advanceTemporalState(previous, evaluation, now);
        if (["CAUTION", "WARNING"].includes(previous.status) && previous.eventType) {
          setStats((current) => ({ ...current, issueDurations: { ...current.issueDurations, [previous.eventType]: (current.issueDurations[previous.eventType] || 0) + delta } }));
        }
        if (next.status !== previous.status) {
          const eventType = next.eventType || previous.eventType;
          addLog(next.status, `${eventType || "posture"}${next.eventLabel ? ` · ${next.eventLabel}` : ""}`);
          if (["CAUTION", "WARNING", "RECOVERED"].includes(next.status)) {
            setStats((current) => ({
              ...current,
              caution: current.caution + (next.status === "CAUTION" ? 1 : 0),
              warning: current.warning + (next.status === "WARNING" ? 1 : 0),
              recovered: current.recovered + (next.status === "RECOVERED" ? 1 : 0),
              eventCounts: ["CAUTION", "WARNING"].includes(next.status) ? { ...current.eventCounts, [eventType]: (current.eventCounts[eventType] || 0) + 1 } : current.eventCounts,
            }));
          }
        }
        return next;
      });
    }, 250);
    return () => window.clearInterval(timer);
  }, [sessionState, evaluation, addLog]);

  const changeMode = (nextMode) => {
    if (nextMode === modeId) return;
    setModeId(nextMode);
    resetSession();
  };

  const changeRubric = (nextRubric) => {
    if (nextRubric === rubric) return;
    setRubric(nextRubric);
    resetSession();
  };

  const changeInputMode = (nextInputMode) => {
    setInputMode(nextInputMode);
    if (nextInputMode === "live") startCamera(cameraDeviceId);
    else stopCamera();
  };

  const startSession = () => {
    resetSession("running");
    addLog("세션", `분석 시작 · ${mode.label}${modeId === "interview" ? ` · 기준 ${rubric}` : ""}`);
    if (inputMode === "live") startCamera(cameraDeviceId);
  };

  const endSession = () => {
    setSessionState("ended");
    stopCamera();
    addLog("세션", "분석 종료 · 카메라 연결 해제");
  };

  const cameraProps = {
    mode, scenario, inputMode, onInputModeChange: changeInputMode, videoRef,
    cameraDevices, cameraDeviceId, onCameraDeviceChange: selectCameraDevice,
    cameraPermission, cameraError, onCameraRetry: retryCamera,
    visibility: featurePacket.values.landmark_visibility, evaluation,
  };

  return (
    <div className="app-shell">
      {showWelcome && <WelcomeModal onClose={() => setShowWelcome(false)} />}
      <Header mode={mode} sessionState={sessionState} inputMode={inputMode} onShowGuide={() => setShowWelcome(true)} />

      <main className="dashboard">
        {sessionState === "idle" && (
          <section className="setup-stage">
            <div className="stage-heading"><span className="stage-number">01</span><div><span className="eyebrow">분석 준비</span><h2>어떤 상황에서 자세를 확인할까요?</h2><p>분석 전에 필요한 항목만 선택하세요. 설정은 분석을 시작한 뒤 숨겨집니다.</p></div></div>
            <div className="setup-layout">
              <section className="panel setup-panel"><ModeSelector modeId={modeId} rubric={rubric} onModeChange={changeMode} onRubricChange={changeRubric} /><button className="primary-button start-action" type="button" onClick={startSession}>분석 시작 <span>→</span></button><small>언제든 분석을 종료할 수 있으며 영상은 저장되지 않습니다.</small></section>
              <CameraPanel {...cameraProps} setup />
            </div>
          </section>
        )}

        {(sessionState === "running" || sessionState === "paused") && (
          <section className="analysis-stage">
            <div className="analysis-heading"><div><span className="eyebrow">분석 진행</span><h2>{mode.label}{modeId === "interview" ? ` · 기준 ${rubric}` : ""}</h2></div><span>{inputMode === "live" ? "실제 카메라 영상 / 자세 분석은 데모 데이터" : "데모 자세 데이터로 분석 중"}</span></div>
            <div className="focus-layout"><CameraPanel {...cameraProps} /><aside className="status-stack"><StatusPanel temporal={temporal} evaluation={evaluation} /><CoachingPanel message={coachingMessage} /></aside></div>
            <ControlPanel sessionState={sessionState} elapsedMs={elapsedMs} scenario={scenario} scenarioIndex={scenarioIndex} scenarioCount={MOCK_SCENARIOS.length} inputMode={inputMode} onPause={() => { setSessionState("paused"); addLog("세션", "분석 일시정지"); }} onResume={() => { setSessionState("running"); addLog("세션", "분석 계속"); }} onEnd={endSession} onPrevious={() => setScenarioIndex((current) => (current - 1 + MOCK_SCENARIOS.length) % MOCK_SCENARIOS.length)} onNext={() => setScenarioIndex((current) => (current + 1) % MOCK_SCENARIOS.length)} />
            <div className="support-grid"><FeaturePanel featurePacket={featurePacket} evaluation={evaluation} scenario={scenario} mode={mode} /><EventLog logs={logs} /></div>
          </section>
        )}

        {sessionState === "ended" && (
          <section className="result-stage"><SessionSummary mode={mode} rubric={rubric} elapsedMs={elapsedMs} stats={stats} onRestart={() => resetSession("idle")} /><EventLog logs={logs} /></section>
        )}

        <footer><span>웹 선행 데모 · 영상 저장 안 함</span><p>실제 MediaPipe, FastAPI, WebSocket, SOLAR 연동은 구현되지 않았습니다. 현재 자세 포인트, Feature와 코칭은 데모 데이터입니다.</p></footer>
      </main>
    </div>
  );
}

export default App;
