import { ANALYSIS_API_BASE_URL, FRAME_SAMPLING } from "../config/frameSampling";

export async function sendFrame({ blob, sessionId, mode, rubric, signal }) {
  if (!ANALYSIS_API_BASE_URL) return null;

  const payload = new FormData();
  payload.append("file", blob, "frame.jpg");
  payload.append("session_id", sessionId);
  payload.append("mode", mode);
  payload.append("rubric", rubric || "");

  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) controller.abort();
  const timeout = window.setTimeout(abort, FRAME_SAMPLING.requestTimeoutMs);
  const startedAt = performance.now();
  try {
    const response = await fetch(`${ANALYSIS_API_BASE_URL.replace(/\/$/, "")}/process-frame`, {
      method: "POST",
      body: payload,
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (data?.ok !== true || data.frame_received !== true || data.session_id !== sessionId) {
      throw new Error("Invalid frame receipt response");
    }
    return { data, status: response.status, rttMs: Math.round(performance.now() - startedAt) };
  } finally {
    window.clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}
