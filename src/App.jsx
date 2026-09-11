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
import { MODES } from "./config/modes";
import { MOCK_SCENARIOS } from "./data/mockScenarios";
import { useCamera } from "./hooks/useCamera";
import { mockCoachingProvider } from "./services/MockCoachingProvider";
import { mockFeatureProvider } from "./services/MockFeatureProvider";
import { evaluateContext } from "./utils/evaluator";
import { advanceTemporalState, INITIAL_TEMPORAL_STATE } from "./utils/temporalEvent";

const initialStats = () => ({ caution: 0, warning: 0, recovered: 0, eventCounts: {}, issueDurations: {} });

function App() {
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
    const entry = {
      id: logIdRef.current++,
      time: new Date().toLocaleTimeString("ko-KR", { hour12: false }),
      status,
      message,
    };
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
          setStats((current) => ({
            ...current,
            issueDurations: { ...current.issueDurations, [previous.eventType]: (current.issueDurations[previous.eventType] || 0) + delta },
          }));
        }
        if (next.status !== previous.status) {
          const eventType = next.eventType || previous.eventType;
          addLog(next.status, `${eventType || "posture"}${next.eventLabel ? ` · ${next.eventLabel}` : ""}`);
          if (next.status === "CAUTION" || next.status === "WARNING" || next.status === "RECOVERED") {
            setStats((current) => ({
              ...current,
              caution: current.caution + (next.status === "CAUTION" ? 1 : 0),
              warning: current.warning + (next.status === "WARNING" ? 1 : 0),
              recovered: current.recovered + (next.status === "RECOVERED" ? 1 : 0),
              eventCounts: next.status === "CAUTION" || next.status === "WARNING"
                ? { ...current.eventCounts, [eventType]: (current.eventCounts[eventType] || 0) + 1 }
                : current.eventCounts,
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

  const startSession = () => {
    resetSession("running");
    addLog("SESSION", `START · ${mode.label}${modeId === "interview" ? ` · Rubric ${rubric}` : ""}`);
    if (inputMode === "live") startCamera(cameraDeviceId);
  };

  const pauseSession = () => {
    setSessionState("paused");
    addLog("SESSION", "PAUSE");
  };

  const resumeSession = () => {
    setSessionState("running");
    addLog("SESSION", "RESUME");
  };

  const endSession = () => {
    setSessionState("ended");
    stopCamera();
    addLog("SESSION", "END · Camera stream released");
  };

  const changeInputMode = (nextInputMode) => {
    setInputMode(nextInputMode);
    if (nextInputMode === "live") startCamera(cameraDeviceId);
    else stopCamera();
  };

  return (
    <div className="app-shell">
      <Header mode={mode} rubric={rubric} sessionState={sessionState} inputMode={inputMode} cameraPermission={cameraPermission} />
      <main className="dashboard">
        <section className="hero-copy">
          <div><span className="hero-kicker">CONTEXT-AWARE AI POSTURE COACH — WEB DEMO</span><h2>Shared Pose Features.<br /><em>Different context, different meaning.</em></h2></div>
          <p>하나의 자세 값을 상황별 기준으로 해석하고, 지속되는 변화만 단계적인 이벤트로 바꿉니다. 이 화면의 자세 분석과 코칭은 선행 검증용 Mock입니다.</p>
        </section>

        <ModeSelector modeId={modeId} rubric={rubric} onModeChange={changeMode} onRubricChange={changeRubric} />

        {sessionState === "ended" && <SessionSummary mode={mode} rubric={rubric} elapsedMs={elapsedMs} stats={stats} onRestart={startSession} />}

        <div className="analysis-grid">
          <CameraPanel mode={mode} scenario={scenario} inputMode={inputMode} onInputModeChange={changeInputMode} videoRef={videoRef} cameraDevices={cameraDevices} cameraDeviceId={cameraDeviceId} onCameraDeviceChange={selectCameraDevice} cameraPermission={cameraPermission} cameraError={cameraError} onCameraRetry={retryCamera} visibility={featurePacket.values.landmark_visibility} evaluation={evaluation} />
          <FeaturePanel featurePacket={featurePacket} evaluation={evaluation} scenario={scenario} />
          <StatusPanel temporal={temporal} evaluation={evaluation} />
          <CoachingPanel message={coachingMessage} temporal={temporal} mode={mode} />
          <ControlPanel sessionState={sessionState} elapsedMs={elapsedMs} scenario={scenario} scenarioIndex={scenarioIndex} scenarioCount={MOCK_SCENARIOS.length} onStart={startSession} onPause={pauseSession} onResume={resumeSession} onEnd={endSession} onNext={() => setScenarioIndex((current) => (current + 1) % MOCK_SCENARIOS.length)} />
          <EventLog logs={logs} />
        </div>

        <footer><span>WEB DEMO · NO VIDEO STORAGE</span><p>실제 MediaPipe, FastAPI, WebSocket, SOLAR 연동은 구현되지 않았습니다. 관찰 가능한 자세 Feature만 표현하며 의료적 판단을 제공하지 않습니다.</p></footer>
      </main>
    </div>
  );
}

export default App;
