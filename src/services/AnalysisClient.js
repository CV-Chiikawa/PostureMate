import { ANALYSIS_API_BASE_URL, FRAME_SAMPLING } from "../config/frameSampling";
import { adaptAnalysisResponse } from "./AnalysisResponseAdapter";

const SESSION_FEEDBACK_TIMEOUT_MS = 20000;

function bindAbortSignal(signal, controller) {
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) controller.abort();
  return () => signal?.removeEventListener("abort", abort);
}

export async function sendFrame({ blob, sessionId, mode, rubric, segment, signal }) {
  if (!ANALYSIS_API_BASE_URL) return null;

  const payload = new FormData();
  payload.append("file", blob, "frame.jpg");
  payload.append("session_id", sessionId);
  payload.append("source", "mediapipe");
  payload.append("segment", segment);
  payload.append("mode", mode);
  payload.append("rubric", rubric || "");

  const controller = new AbortController();
  const unbindAbort = bindAbortSignal(signal, controller);
  const timeout = window.setTimeout(() => controller.abort(), FRAME_SAMPLING.requestTimeoutMs);
  const startedAt = performance.now();
  try {
    const response = await fetch(`${ANALYSIS_API_BASE_URL.replace(/\/$/, "")}/process-frame`, {
      method: "POST",
      body: payload,
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    let data;
    try { data = await response.json(); } catch { throw new Error("Invalid analysis response: JSON"); }
    const analysis = adaptAnalysisResponse(data, { sessionId, mode, rubric: rubric || "", source: "mediapipe" });
    return { data, analysis, status: response.status, rttMs: Math.round(performance.now() - startedAt) };
  } finally {
    window.clearTimeout(timeout);
    unbindAbort();
  }
}

export async function requestSessionFeedback(facts, signal) {
  if (!ANALYSIS_API_BASE_URL) throw new Error("Analysis endpoint missing");

  const controller = new AbortController();
  const unbindAbort = bindAbortSignal(signal, controller);
  const timeout = window.setTimeout(() => controller.abort(), SESSION_FEEDBACK_TIMEOUT_MS);
  try {
    const response = await fetch(`${ANALYSIS_API_BASE_URL.replace(/\/$/, "")}/session-feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(facts),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    let data;
    try { data = await response.json(); } catch { throw new Error("Invalid session feedback response: JSON"); }
    if (!data || !["solar", "insufficient", "fallback"].includes(data.source)) {
      throw new Error("Invalid session feedback response: source");
    }
    if (data.source === "solar" && (typeof data.message !== "string" || !data.message.trim())) {
      throw new Error("Invalid session feedback response: message");
    }
    return { source: data.source, message: typeof data.message === "string" ? data.message.trim() : "" };
  } finally {
    window.clearTimeout(timeout);
    unbindAbort();
  }
}
