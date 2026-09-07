import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import "./App.css";

import Header from "./components/Header";
import CameraCard from "./components/CameraCard";
import ProgramOutput from "./components/ProgramOutput";
import DirectorLog from "./components/DirectorLog";
import ControlPanel from "./components/ControlPanel";

import {
  getMockCameras,
  MOCK_SCENARIO_COUNT,
} from "./data/mockCameras";

import {
  getCameraReason,
  SWITCH_HOLD_COUNT,
  SWITCH_MARGIN,
} from "./utils/director";

function App() {
  const [scenarioIndex, setScenarioIndex] =
    useState(0);

  const [isRunning, setIsRunning] =
    useState(true);

  const [activeCameraId, setActiveCameraId] =
    useState("A");

  const activeCameraRef = useRef("A");

  const candidateRef = useRef({
    id: null,
    count: 0,
  });

  const logIdRef = useRef(1);

  const [logs, setLogs] = useState([
    {
      id: 0,
      time: new Date().toLocaleTimeString(
        "ko-KR",
        {
          hour12: false,
        },
      ),
      type: "system",
      message:
        "AutoDirector engine initialized.",
    },
  ]);

  const cameras = useMemo(
    () => getMockCameras(scenarioIndex),
    [scenarioIndex],
  );

  const activeCamera =
    cameras.find(
      (camera) =>
        camera.id === activeCameraId,
    ) ?? cameras[0];

  const addLog = useCallback(
    (message, type = "system") => {
      const log = {
        id: logIdRef.current++,
        time: new Date().toLocaleTimeString(
          "ko-KR",
          {
            hour12: false,
          },
        ),
        type,
        message,
      };

      setLogs((currentLogs) =>
        [log, ...currentLogs].slice(0, 8),
      );
    },
    [],
  );

  useEffect(() => {
    if (!isRunning) {
      return undefined;
    }

    const timer = setInterval(() => {
      setScenarioIndex(
        (current) =>
          (current + 1) %
          MOCK_SCENARIO_COUNT,
      );
    }, 2200);

    return () => clearInterval(timer);
  }, [isRunning]);

  useEffect(() => {
    if (!isRunning) {
      return;
    }

    const currentCamera =
      cameras.find(
        (camera) =>
          camera.id ===
          activeCameraRef.current,
      ) ?? cameras[0];

    const challenger = cameras
      .filter(
        (camera) =>
          camera.id !== currentCamera.id,
      )
      .sort(
        (a, b) => b.score - a.score,
      )[0];

    if (!challenger) {
      return;
    }

    const scoreDifference =
      challenger.score -
      currentCamera.score;

    if (
      scoreDifference >= SWITCH_MARGIN
    ) {
      if (
        candidateRef.current.id ===
        challenger.id
      ) {
        candidateRef.current.count += 1;
      } else {
        candidateRef.current = {
          id: challenger.id,
          count: 1,
        };

        addLog(
          `${challenger.name} 우세 감지 · ${challenger.score} vs ${currentCamera.score}`,
          "candidate",
        );
      }

      if (
        candidateRef.current.count >=
        SWITCH_HOLD_COUNT
      ) {
        const previousCamera =
          currentCamera.id;

        activeCameraRef.current =
          challenger.id;

        setActiveCameraId(
          challenger.id,
        );

        candidateRef.current = {
          id: null,
          count: 0,
        };

        addLog(
          `CAMERA ${previousCamera} → CAMERA ${challenger.id} 자동 전환`,
          "switch",
        );
      }
    } else {
      candidateRef.current = {
        id: null,
        count: 0,
      };
    }
  }, [cameras, isRunning, addLog]);

  const handleToggle = () => {
    setIsRunning((current) => {
      const next = !current;

      addLog(
        next
          ? "AutoDirector resumed."
          : "AutoDirector paused.",
        "system",
      );

      return next;
    });
  };

  const handleNextScene = () => {
    setScenarioIndex(
      (current) =>
        (current + 1) %
        MOCK_SCENARIO_COUNT,
    );
  };

  const selectionReason =
    getCameraReason(activeCamera);

  return (
    <div className="app-shell">
      <Header isRunning={isRunning} />

      <main className="dashboard">
        <section className="panel camera-bank">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">
                MULTI-CAMERA INPUT
              </span>

              <h2>CAMERA SOURCES</h2>
            </div>

            <span className="camera-count">
              2 SOURCES CONNECTED
            </span>
          </div>

          <div className="camera-grid">
            {cameras.map((camera) => (
              <CameraCard
                key={camera.id}
                camera={camera}
                selected={
                  camera.id ===
                  activeCameraId
                }
              />
            ))}
          </div>
        </section>

        <aside className="director-column">
          <ProgramOutput
            camera={activeCamera}
            reason={selectionReason}
          />

          <ControlPanel
            isRunning={isRunning}
            onToggle={handleToggle}
            onNext={handleNextScene}
            scenarioIndex={scenarioIndex}
            scenarioCount={
              MOCK_SCENARIO_COUNT
            }
          />
        </aside>

        <DirectorLog logs={logs} />
      </main>
    </div>
  );
}

export default App;