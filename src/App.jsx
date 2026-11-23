import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

import CameraPanel from "./components/CameraPanel";
import CoachingPanel from "./components/CoachingPanel";
import ControlPanel from "./components/ControlPanel";
import EventLog from "./components/EventLog";
import FeaturePanel from "./components/FeaturePanel";
import Header from "./components/Header";
import IntroPage from "./components/IntroPage";
import ModeSelectionPage from "./components/ModeSelectionPage";
import ModeSelector from "./components/ModeSelector";
import SessionSummary from "./components/SessionSummary";
import StatusPanel from "./components/StatusPanel";
import WelcomeModal from "./components/WelcomeModal";
import { MODES } from "./config/modes";
import { useCamera } from "./hooks/useCamera";
import { useFrameSampler } from "./hooks/useFrameSampler";
import { getRemoteEventKey, stableDisplay, toTemporalState } from "./services/RemoteAnalysisProvider";
import { evaluateContext } from "./utils/evaluator";
import { referenceNotice } from "./utils/calibrationGuide";

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

const INITIAL_TEMPORAL_STATE = { status: null, eventLabel: null, coaching: null };

const initialStats = () => ({ caution: 0, warning: 0, recovered: 0, eventCounts: {}, issueDurations: {} });

const measurementGuides = {
  forward_proxy_unavailable: "상체 전방 변화 추정이 불안정합니다. 정면에서 골반까지 보이게 구도를 조정해 주세요.",
  hips_not_visible: "양쪽 골반까지 화면에 들어오도록 카메라를 맞춰 주세요.",
  reference_view_required: "얼굴·어깨·골반이 충분히 보이도록 정면 구도를 맞춰 주세요.",
  reference_neutral_required: "고개를 어깨와 나란히 세우고 기준 자세를 준비해 주세요.",
  framing_changed: "기준 측정 때와 거리가 달라졌습니다. 처음 위치로 돌아오거나 ‘기준 자세 다시 측정’을 눌러 주세요.",
  ear_or_shoulder_not_visible: "얼굴과 어깨가 함께 보이도록 카메라를 맞춰 주세요.",
  upper_body_not_visible: "양쪽 귀와 어깨가 보이도록 정면을 향해 주세요.",
  wrist_or_knee_not_visible: "양손과 양쪽 무릎까지 보이도록 카메라를 뒤로 옮겨 주세요.",
  side_view_required: "처음 기준을 잡은 쪽으로 얼굴과 어깨를 비스듬히 돌려 주세요.",
  too_side: "얼굴을 카메라 쪽으로 조금 돌려 주세요.",
  too_close: "처음 기준을 잡았을 때의 거리까지 뒤로 이동하세요.",
  too_far: "처음 기준을 잡았을 때의 거리까지 가까이 오세요.",
  face_front: "고개와 어깨를 정면 중앙에 두세요.",
  look_down: "고개를 들어 처음 자세로 돌아오면 측정을 이어갑니다.",
  model_unavailable: "분석 서버의 자세 모델을 준비해 주세요. 연결을 다시 시도합니다.",
  disconnected: "분석 서버와 연결할 수 없습니다. 연결을 다시 시도합니다.",
  endpoint_missing: "분석 서버 주소를 설정한 뒤 다시 시작해 주세요.",
  camera_unavailable: "카메라에서 새 프레임을 기다리고 있습니다.",
};

const framingByMode = {
  neck: "얼굴과 어깨가 함께 보이도록 카메라를 맞춰 주세요.",
  interview: "얼굴부터 양손과 무릎까지 화면에 들어오도록 카메라를 맞춰 주세요.",
  presentation: "얼굴부터 골반까지 함께 보이도록 카메라를 맞춰 주세요.",
};

function App() {
  const [page, setPage] = useState("intro");
  const [showGuide, setShowGuide] = useState(() => {
    try { return !hasGuideOptOutCookie(); } catch { return true; }
  });
  const [guideOpenedManually, setGuideOpenedManually] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [modeId, setModeId] = useState("interview");
  const [rubric, setRubric] = useState("A");
  const [sessionState, setSessionState] = useState("idle");
  const [frameSessionId, setFrameSessionId] = useState("");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [temporal, setTemporal] = useState(INITIAL_TEMPORAL_STATE);
  const [stats, setStats] = useState(initialStats);
  const [logs, setLogs] = useState([]);
  const [liveAnalysis, setRemoteAnalysis] = useState(null);
  const [resultCueVisible, setResultCueVisible] = useState(false);
  const logIdRef = useRef(0);
  const lastTickRef = useRef(0);
  const resultRef = useRef(null);
  const remoteEventKeysRef = useRef(new Set());
  const remoteStatusRef = useRef(null);
  const displayRef = useRef(null);
  const rawTemporalRef = useRef(INITIAL_TEMPORAL_STATE);
  const lastIssueRef = useRef(null);

  const clearMeasurement = useCallback((reason) => {
    setRemoteAnalysis(reason ? { measurementStatus: "offline", measurementReason: reason } : null);
    setTemporal({ ...INITIAL_TEMPORAL_STATE, status: null });
    remoteStatusRef.current = null;
    displayRef.current = null;
    rawTemporalRef.current = INITIAL_TEMPORAL_STATE;
    lastIssueRef.current = null;
  }, []);

  const mode = MODES[modeId];
  const featurePacket = liveAnalysis?.featurePacket;
  const evaluation = useMemo(() => featurePacket ? evaluateContext(featurePacket, modeId, rubric) : null, [featurePacket, modeId, rubric]);
  const measurementNotice = liveAnalysis?.measurementStatus === "unstable"
    ? { title: "구도 확인 중", message: framingByMode[modeId] }
    : liveAnalysis?.measurementReason === "view_inference"
    ? { title: "카메라 구도 확인 중", message: "정면 또는 비스듬한 옆모습으로 잠시 자세를 유지하세요." }
    : liveAnalysis?.measurementStatus === "calibrating"
    ? (modeId === "neck"
      ? {title:"기준 자세 보정 중",message:"기준 자세를 측정 중입니다. 편안한 자세로 5초간 앉아 주세요."}
      : referenceNotice(liveAnalysis.measurementReason, liveAnalysis.calibration, modeId, rubric))
    : liveAnalysis?.measurementStatus === "unavailable"
      ? { title: "자세 측정 불가", message: measurementGuides[liveAnalysis.measurementReason] || framingByMode[modeId] }
    : liveAnalysis?.measurementReason === "camera_unavailable"
      ? { title: "카메라 연결 대기", message: measurementGuides.camera_unavailable }
    : liveAnalysis?.measurementStatus === "offline"
      ? { title: "분석 연결 끊김", message: measurementGuides[liveAnalysis.measurementReason] }
      : null;
  const previewEnabled = page === "analysis" && sessionState !== "ended";
  const { videoRef, devices: cameraDevices, deviceId: cameraDeviceId, selectDevice: selectCameraDevice, permission: cameraPermission, error: cameraError, retry: retryCamera } = useCamera(previewEnabled, clearMeasurement);
  const coaching = temporal.coaching;
  const coachingContext = measurementNotice?.title ?? temporal.activeEventId ?? temporal.status ?? "waiting";
  const coachingScope = liveAnalysis?.measurementStatus === "offline" ? liveAnalysis.measurementReason : sessionState;
  const coachingLabel = !measurementNotice && coaching?.source === "solar" ? "SOLAR 코칭" : "기본 안내";
  const coachingMessage = sessionState === "ended"
    ? "이번 세션이 끝났습니다."
    : sessionState === "paused" ? "분석을 잠시 멈췄습니다."
    : measurementNotice?.message ?? coaching?.message ?? (!featurePacket
      ? "카메라의 측정 결과를 기다리고 있습니다."
      : temporal.status === "NORMAL" ? "현재 자세가 기준 범위에 있습니다. 그대로 유지해 주세요."
      : temporal.status === "RECOVERED" ? "자세가 기준 범위로 돌아왔습니다."
      : "자세 변화를 확인하고 있습니다.");

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
    displayRef.current = null;
    rawTemporalRef.current = INITIAL_TEMPORAL_STATE;
    lastIssueRef.current = null;
  }, []);

  const applyRemoteAnalysis = useCallback((result) => {
    if (sessionState !== "running" || result.sessionId !== frameSessionId) return;
    const raw = toTemporalState(result, rawTemporalRef.current);
    rawTemporalRef.current = raw;
    displayRef.current = stableDisplay(displayRef.current, { ...result, temporal: raw }, performance.now());
    const confirmed = displayRef.current.current;
    setRemoteAnalysis(confirmed);
    const shown = confirmed?.temporal ?? INITIAL_TEMPORAL_STATE;
    setTemporal(shown.coaching && shown.activeEventId !== raw.activeEventId ? { ...shown, coaching: null } : shown);

    const previousStatus = remoteStatusRef.current;
    if (result.state !== previousStatus) {
      remoteStatusRef.current = result.state;
      if (["CAUTION", "RECOVERED"].includes(result.state) && !result.event) {
        addLog(result.state, result.state === "CAUTION" ? "주의 상태" : "정상 자세 복귀");
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
      addLog(result.state, `자세 변화 · ${result.event.type}`);
    }
    const previousIssue = lastIssueRef.current;
    const issue = result.activeIssue;
    if (issue) {
      const same = previousIssue?.type === issue && previousIssue.duration <= result.issueDurationMs;
      const delta = result.issueDurationMs - (same ? previousIssue.duration : 0);
      setStats((current) => ({
        ...current,
        eventCounts: { ...current.eventCounts, [issue]: (current.eventCounts[issue] || 0) + (same ? 0 : 1) },
        issueDurations: { ...current.issueDurations, [issue]: (current.issueDurations[issue] || 0) + delta },
      }));
    }
    lastIssueRef.current = issue ? { type: issue, duration: result.issueDurationMs } : null;
  }, [addLog, frameSessionId, sessionState]);

  useFrameSampler({
    videoRef,
    enabled: sessionState === "running" && cameraPermission === "granted",
    sessionId: frameSessionId,
    mode: modeId,
    rubric: modeId === "interview" ? rubric : "",
    onAnalysisResult: applyRemoteAnalysis,
    onUnavailable: clearMeasurement,
  });

  useEffect(() => {
    if (sessionState !== "running") return undefined;
    lastTickRef.current = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const delta = Math.max(0, now - lastTickRef.current);
      lastTickRef.current = now;
      setElapsedMs((current) => current + delta);
    }, 250);
    return () => window.clearInterval(timer);
  }, [sessionState]);

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
  const startSession = () => { setFrameSessionId(crypto.randomUUID()); resetSession("running"); addLog("세션", `분석 시작 · ${mode.label}${modeId === "interview" ? ` · 기준 ${rubric}` : ""}`); };
  const recalibrate = () => {
    setFrameSessionId(crypto.randomUUID());
    clearMeasurement();
    addLog("세션", "기준 자세 다시 측정 · 이전 연습 기록 유지");
  };
  const endSession = () => {
    setSessionState("ended");
    clearMeasurement();
    setResultCueVisible(true);
    addLog("세션", "분석 종료 · 카메라 연결 해제");
  };
  const closeGuide = (dontShowAgain) => {
    if (dontShowAgain) { try { saveGuideOptOutCookie(); } catch { /* Cookie 저장 불가 환경에서는 이번 화면에서만 닫는다. */ } }
    setShowGuide(false);
  };

  const phaseCopy = { idle: ["분석 대기", "설정을 확인하고 분석을 시작하세요."], running: ["분석 중", "현재 자세와 코칭을 확인하세요."], paused: ["일시정지", "분석이 잠시 멈춰 있습니다."], ended: ["분석 완료", "이번 세션의 결과를 확인하세요."] }[sessionState];
  const scrollToResult = () => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    resultRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  };
  const navigatePage = (nextPage) => {
    if (["running", "paused"].includes(sessionState)) return;
    setPage(nextPage);
  };
  const chooseModeFromIntro = (nextMode) => {
    changeMode(nextMode);
    resetSession("idle");
    setPage("analysis");
  };
  const enterAnalysis = (nextMode = modeId) => {
    setModeId(nextMode);
    resetSession("idle");
    setPage("analysis");
  };
  const showResult = () => {
    if (sessionState !== "ended") return;
    setPage("analysis");
    window.setTimeout(scrollToResult, 0);
  };

  useEffect(() => { window.scrollTo({ top: 0, behavior: "auto" }); }, [page]);

  return (
    <div className="app-shell">
      {showGuide && <WelcomeModal onClose={closeGuide} showDontShowAgain={!guideOpenedManually} />}
      {showSettings && <ModeSelector modeId={modeId} rubric={rubric} cameraDevices={cameraDevices} cameraDeviceId={cameraDeviceId} cameraPermission={cameraPermission} onModeChange={changeMode} onRubricChange={changeRubric} onCameraDeviceChange={(id) => { selectCameraDevice(id); resetSession(); }} onClose={() => setShowSettings(false)} />}
      <Header page={page} mode={mode} rubric={rubric} sessionState={sessionState} hasResult={sessionState === "ended"} onNavigate={navigatePage} onShowResult={showResult} onShowGuide={() => { setGuideOpenedManually(true); setShowGuide(true); }} onShowSettings={() => setShowSettings(true)} />

      {page === "intro" && <IntroPage onStart={() => setPage("modes")} onChooseMode={chooseModeFromIntro} />}
      {page === "modes" && <ModeSelectionPage modeId={modeId} onSelectMode={changeMode} onStartMode={enterAnalysis} />}
      {page === "analysis" && <>
        <main className="dashboard" id="analysis-dashboard">
          <div className="analysis-heading"><div><span className="section-kicker">{phaseCopy[0]}</span><h1>{mode.label}{modeId === "interview" ? ` · 기준 ${rubric}` : ""}</h1></div><div><span>{phaseCopy[1]}</span><b>실제 영상 / MediaPipe 자세 분석</b></div></div>

          <div className="focus-layout">
            <CameraPanel mode={mode} videoRef={videoRef} visibility={featurePacket?.values.landmark_visibility} temporalStatus={temporal.status} sessionState={sessionState} cameraPermission={cameraPermission} cameraError={cameraError} onCameraRetry={retryCamera} />
            <aside className="status-stack">
              <StatusPanel temporal={temporal} evaluation={evaluation} measurementTitle={measurementNotice?.title} />
              <FeaturePanel featurePacket={featurePacket} evaluation={evaluation} mode={mode} />
              <CoachingPanel key={`${modeId}/${rubric}/${frameSessionId}/${coachingScope}/${coachingContext}`}
                label={coachingLabel} message={coachingMessage} />
            </aside>
          </div>

          <ControlPanel sessionState={sessionState} elapsedMs={elapsedMs} stats={stats} cameraReady={cameraPermission === "granted"} onRecalibrate={modeId === "neck" ? null : recalibrate} onStart={startSession} onPause={() => { setSessionState("paused"); clearMeasurement(); addLog("세션", "분석 일시정지"); }} onResume={() => { setSessionState("running"); addLog("세션", "분석 계속"); }} onEnd={endSession} />

          <div className="support-grid"><EventLog logs={logs} defaultOpen={sessionState === "ended"} /></div>
          <footer><span>PostureMate · 영상 저장 안 함</span><p>실제 카메라로 연습하면 JPEG를 분석 서버로 보냅니다. SOLAR 코칭에는 자세 이벤트의 관찰값만 사용합니다.</p></footer>
        </main>

        {sessionState === "ended" && <section ref={resultRef} id="analysis-result" className="analysis-result-section" aria-label="분석 결과"><SessionSummary mode={mode} rubric={rubric} elapsedMs={elapsedMs} stats={stats} logs={logs} coachingLabel={coachingLabel} coachingMessage={coachingMessage} onRestart={() => resetSession("idle")} /></section>}
        {sessionState === "ended" && <button className={`result-scroll-cue ${resultCueVisible ? "visible" : "hidden"}`} type="button" aria-controls="analysis-result" onClick={scrollToResult}><span className="result-scroll-cue-content"><b>분석 결과 보기</b><i aria-hidden="true">↓</i></span></button>}
      </>}
    </div>
  );
}
export default App;
