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
import { useFrameSampler } from "./hooks/useFrameSampler";
import { mockCoachingProvider } from "./services/MockCoachingProvider";
import { mockFeatureProvider } from "./services/MockFeatureProvider";
import { getRemoteEventKey, toTemporalState } from "./services/RemoteAnalysisProvider";
import { evaluateContext } from "./utils/evaluator";
import { advanceTemporalState, INITIAL_TEMPORAL_STATE } from "./utils/temporalEvent";

const GUIDE_COOKIE_NAME = "posture-coach-hide-guide";
const GUIDE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function hasGuideOptOutCookie() {
  return document.cookie
    .split("; ")
    .some((cookie) => cookie === `${GUIDE_COOKIE_NAME}=true`);
}

function saveGuideOptOutCookie() {
  document.cookie = `${GUIDE_COOKIE_NAME}=true; Max-Age=${GUIDE_COOKIE_MAX_AGE}; Path=/; SameSite=Lax`;
}

const initialStats = () => ({ caution: 0, warning: 0, recovered: 0, eventCounts: {}, issueDurations: {} });

function App() {
  const [showGuide, setShowGuide] = useState(() => {
    try { return !hasGuideOptOutCookie(); } catch { return true; }
  });
  const [guideOpenedManually, setGuideOpenedManually] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [modeId, setModeId] = useState("interview");
  const [rubric, setRubric] = useState("A");
  const [inputMode, setInputMode] = useState("mock");
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [sessionState, setSessionState] = useState("idle");
  const [frameSessionId, setFrameSessionId] = useState("");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [temporal, setTemporal] = useState(INITIAL_TEMPORAL_STATE);
  const [stats, setStats] = useState(initialStats);
  const [logs, setLogs] = useState([]);
  const [remoteAnalysis, setRemoteAnalysis] = useState(null);
  const [resultCueVisible, setResultCueVisible] = useState(false);
  const logIdRef = useRef(0);
  const lastTickRef = useRef(0);
  const resultRef = useRef(null);
  const remoteEventKeysRef = useRef(new Set());
  const remoteStatusRef = useRef(null);

  const mode = MODES[modeId];
  const scenario = MOCK_SCENARIOS[scenarioIndex];
  const mockFeaturePacket = useMemo(() => mockFeatureProvider.getFeatures(scenarioIndex), [scenarioIndex]);
  const featurePacket = inputMode === "live" && remoteAnalysis ? remoteAnalysis.featurePacket : mockFeaturePacket;
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
    setRemoteAnalysis(null);
    setResultCueVisible(false);
    lastTickRef.current = 0;
    remoteEventKeysRef.current.clear();
    remoteStatusRef.current = null;
  }, []);

  const applyRemoteAnalysis = useCallback((result) => {
    if (inputMode !== "live" || sessionState !== "running" || result.sessionId !== frameSessionId) return;
    setRemoteAnalysis(result);
    setTemporal((previous) => toTemporalState(result, previous));

    const previousStatus = remoteStatusRef.current;
    if (result.state !== previousStatus) {
      remoteStatusRef.current = result.state;
      if (["CAUTION", "RECOVERED"].includes(result.state) && !result.event) {
        addLog(result.state, `원격 데모 · ${result.state === "CAUTION" ? "주의 상태" : "정상 자세 복귀"}`);
      }
      if (["CAUTION", "WARNING", "RECOVERED"].includes(result.state)) {
        setStats((current) => ({
          ...current,
          caution: current.caution + (result.state === "CAUTION" ? 1 : 0),
          warning: current.warning + (result.state === "WARNING" ? 1 : 0),
          recovered: current.recovered + (result.state === "RECOVERED" ? 1 : 0),
        }));
      }
    }

    const eventKey = getRemoteEventKey(result);
    if (eventKey && !remoteEventKeysRef.current.has(eventKey)) {
      remoteEventKeysRef.current.add(eventKey);
      addLog(result.state, `원격 데모 이벤트 · ${result.event.type}`);
      setStats((current) => ({
        ...current,
        eventCounts: { ...current.eventCounts, [result.event.type]: (current.eventCounts[result.event.type] || 0) + 1 },
        issueDurations: { ...current.issueDurations, [result.event.type]: (current.issueDurations[result.event.type] || 0) + result.event.durationSec * 1000 },
      }));
    }
  }, [addLog, frameSessionId, inputMode, sessionState]);

  useFrameSampler({
    videoRef,
    enabled: inputMode === "live" && sessionState === "running" && cameraPermission === "granted",
    sessionId: frameSessionId,
    mode: modeId,
    rubric: modeId === "interview" ? rubric : "",
    onAnalysisResult: applyRemoteAnalysis,
  });

  useEffect(() => {
    if (sessionState !== "running") return undefined;
    lastTickRef.current = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const delta = Math.max(0, now - lastTickRef.current);
      lastTickRef.current = now;
      setElapsedMs((current) => current + delta);
      if (inputMode === "live") return;
      setTemporal((previous) => {
        const next = advanceTemporalState(previous, evaluation, now);
        if (["CAUTION", "WARNING"].includes(previous.status) && previous.eventType) {
          setStats((current) => ({ ...current, issueDurations: { ...current.issueDurations, [previous.eventType]: (current.issueDurations[previous.eventType] || 0) + delta } }));
        }
        if (next.status !== previous.status) {
          const eventType = next.eventType || previous.eventType;
          addLog(next.status, `${eventType || "posture"}${next.eventLabel ? ` · ${next.eventLabel}` : ""}`);
          if (["CAUTION", "WARNING", "RECOVERED"].includes(next.status)) {
            setStats((current) => ({ ...current, caution: current.caution + (next.status === "CAUTION" ? 1 : 0), warning: current.warning + (next.status === "WARNING" ? 1 : 0), recovered: current.recovered + (next.status === "RECOVERED" ? 1 : 0), eventCounts: ["CAUTION", "WARNING"].includes(next.status) ? { ...current.eventCounts, [eventType]: (current.eventCounts[eventType] || 0) + 1 } : current.eventCounts }));
          }
        }
        return next;
      });
    }, 250);
    return () => window.clearInterval(timer);
  }, [sessionState, evaluation, addLog, inputMode]);

  useEffect(() => {
    if (sessionState !== "ended" || !resultRef.current) return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setResultCueVisible(false);
    }, { threshold: 0.35 });
    observer.observe(resultRef.current);
    return () => observer.disconnect();
  }, [sessionState]);

  const changeMode = (nextMode) => { if (nextMode !== modeId) { setModeId(nextMode); resetSession(); } };
  const changeRubric = (nextRubric) => { if (nextRubric !== rubric) { setRubric(nextRubric); resetSession(); } };
  const changeInputMode = (nextInputMode) => { setInputMode(nextInputMode); if (nextInputMode === "live") startCamera(cameraDeviceId); else stopCamera(); };
  const startSession = () => { setFrameSessionId(crypto.randomUUID()); resetSession("running"); addLog("세션", `분석 시작 · ${mode.label}${modeId === "interview" ? ` · 기준 ${rubric}` : ""}`); if (inputMode === "live") startCamera(cameraDeviceId); };
  const endSession = () => { setSessionState("ended"); setResultCueVisible(true); stopCamera(); addLog("세션", "분석 종료 · 카메라 연결 해제"); };
  const closeGuide = (dontShowAgain) => {
    if (dontShowAgain) { try { saveGuideOptOutCookie(); } catch { /* Cookie 저장 불가 환경에서는 이번 화면에서만 닫는다. */ } }
    setShowGuide(false);
  };

  const phaseCopy = { idle: ["분석 대기", "설정을 확인하고 분석을 시작하세요."], running: ["분석 중", "현재 자세와 코칭을 확인하세요."], paused: ["일시정지", "분석이 잠시 멈춰 있습니다."], ended: ["분석 완료", "이번 세션의 결과를 확인하세요."] }[sessionState];
  const scrollToResult = () => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    resultRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  };

  return (
    <div className="app-shell">
      {showGuide && <WelcomeModal onClose={closeGuide} showDontShowAgain={!guideOpenedManually} />}
      {showSettings && <ModeSelector modeId={modeId} rubric={rubric} inputMode={inputMode} cameraDevices={cameraDevices} cameraDeviceId={cameraDeviceId} cameraPermission={cameraPermission} onModeChange={changeMode} onRubricChange={changeRubric} onInputModeChange={changeInputMode} onCameraDeviceChange={selectCameraDevice} onClose={() => setShowSettings(false)} />}
      <Header mode={mode} rubric={rubric} sessionState={sessionState} inputMode={inputMode} onShowGuide={() => { setGuideOpenedManually(true); setShowGuide(true); }} onShowSettings={() => setShowSettings(true)} />

      <main className="dashboard">
        <div className="analysis-heading"><div><span className="eyebrow">{phaseCopy[0]}</span><h2>{mode.label}{modeId === "interview" ? ` · 기준 ${rubric}` : ""}</h2></div><span>{phaseCopy[1]} · {inputMode === "live" ? "실제 영상 / 데모 분석" : "데모 분석"}</span></div>

        <div className="focus-layout">
          <CameraPanel mode={mode} scenario={scenario} inputMode={inputMode} videoRef={videoRef} visibility={featurePacket.values.landmark_visibility} temporalStatus={temporal.status} sessionState={sessionState} cameraPermission={cameraPermission} cameraError={cameraError} onCameraRetry={retryCamera} />
          <aside className="status-stack"><StatusPanel temporal={temporal} evaluation={evaluation} /><CoachingPanel message={coachingMessage} /></aside>
        </div>

        <ControlPanel sessionState={sessionState} elapsedMs={elapsedMs} scenario={scenario} scenarioIndex={scenarioIndex} scenarioCount={MOCK_SCENARIOS.length} inputMode={inputMode} onStart={startSession} onPause={() => { setSessionState("paused"); addLog("세션", "분석 일시정지"); }} onResume={() => { setSessionState("running"); addLog("세션", "분석 계속"); }} onEnd={endSession} onPrevious={() => setScenarioIndex((current) => (current - 1 + MOCK_SCENARIOS.length) % MOCK_SCENARIOS.length)} onNext={() => setScenarioIndex((current) => (current + 1) % MOCK_SCENARIOS.length)} />

        <div className="support-grid"><FeaturePanel featurePacket={featurePacket} evaluation={evaluation} scenario={scenario} mode={mode} /><EventLog logs={logs} /></div>
        <footer><span>웹 선행 데모 · 영상 저장 안 함</span><p>임시 FastAPI는 프레임 수신과 Demo Feature/Event 계약만 검증합니다. MediaPipe, 실제 CV 판정, WebSocket, SOLAR는 미연동이며 분석값과 코칭은 데모 데이터입니다.</p></footer>
      </main>

      {sessionState === "ended" && <section ref={resultRef} id="analysis-result" className="analysis-result-section" aria-label="분석 결과"><SessionSummary mode={mode} rubric={rubric} elapsedMs={elapsedMs} stats={stats} onRestart={() => resetSession("idle")} /></section>}
      {sessionState === "ended" && <button className={`result-scroll-cue ${resultCueVisible ? "visible" : "hidden"}`} type="button" aria-controls="analysis-result" onClick={scrollToResult}><span className="result-scroll-cue-content"><b>분석 결과 보기</b><i aria-hidden="true">↓</i></span></button>}
    </div>
  );
}
export default App;
