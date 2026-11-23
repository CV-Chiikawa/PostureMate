export const FRAME_SAMPLING = {
  fps: 5,
  jpegQuality: 0.8,
  requestTimeoutMs: 3000,
  errorRetryMs: 2000,
  logIntervalMs: 5000,
};

export const ANALYSIS_API_BASE_URL =
  import.meta.env.VITE_ANALYSIS_API_BASE_URL?.trim() ||
  (import.meta.env.DEV ? "http://127.0.0.1:8000" : "");
