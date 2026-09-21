import { useEffect } from "react";
import { ANALYSIS_API_BASE_URL, FRAME_SAMPLING } from "../config/frameSampling";
import { sendFrame } from "../services/AnalysisClient";

function captureJpeg(video, canvas, quality) {
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (!width || !height || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return null;
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D context unavailable");
  context.drawImage(video, 0, 0, width, height);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob?.type === "image/jpeg"
      ? resolve({ blob, width, height })
      : reject(new Error("JPEG Blob generation failed")), "image/jpeg", quality);
  });
}

export function useFrameSampler({ videoRef, enabled, sessionId, mode, rubric }) {
  useEffect(() => {
    if (!enabled || !sessionId || !ANALYSIS_API_BASE_URL) return undefined;

    const intervalMs = 1000 / FRAME_SAMPLING.fps;
    const canvas = document.createElement("canvas");
    const controller = new AbortController();
    const metrics = { frames: 0, skipped: 0, errors: 0, lastTickAt: 0, lastLogAt: 0 };
    let active = true;
    let inFlight = false;
    let retryAfter = 0;

    const tick = async () => {
      const video = videoRef.current;
      if (!video || !video.srcObject) return;
      if (performance.now() < retryAfter) return;
      if (inFlight) { metrics.skipped += 1; return; }
      inFlight = true;
      const now = performance.now();
      const actualIntervalMs = metrics.lastTickAt ? Math.round(now - metrics.lastTickAt) : intervalMs;
      metrics.lastTickAt = now;
      try {
        const frame = await captureJpeg(video, canvas, FRAME_SAMPLING.jpegQuality);
        if (!active || !frame) return;
        metrics.frames += 1;
        const receipt = await sendFrame({ blob: frame.blob, sessionId, mode, rubric, signal: controller.signal });
        if (active && receipt && now - metrics.lastLogAt >= FRAME_SAMPLING.logIntervalMs) {
          console.info("[FrameSampler]", { frame: metrics.frames, targetFps: FRAME_SAMPLING.fps, actualIntervalMs, resolution: `${frame.width}x${frame.height}`, jpegBytes: frame.blob.size, skipped: metrics.skipped, errors: metrics.errors });
          console.info("[AnalysisTransport]", { status: receipt.status, rttMs: receipt.rttMs, serverReceived: receipt.data.frame_received });
          metrics.lastLogAt = now;
        }
      } catch (error) {
        if (active) {
          metrics.errors += 1;
          retryAfter = performance.now() + FRAME_SAMPLING.errorRetryMs;
          if (now - metrics.lastLogAt >= FRAME_SAMPLING.logIntervalMs) {
            console.warn("[FrameSampler] Frame transport unavailable", { reason: error.message, skipped: metrics.skipped, errors: metrics.errors });
            metrics.lastLogAt = now;
          }
        }
      } finally {
        inFlight = false;
      }
    };

    console.info("[FrameSampler] Started", { targetFps: FRAME_SAMPLING.fps, jpegQuality: FRAME_SAMPLING.jpegQuality, endpoint: ANALYSIS_API_BASE_URL });
    const timer = window.setInterval(tick, intervalMs);
    return () => {
      active = false;
      window.clearInterval(timer);
      controller.abort();
      canvas.width = 0;
      canvas.height = 0;
      console.info("[FrameSampler] Stopped", { frames: metrics.frames, skipped: metrics.skipped, errors: metrics.errors });
    };
  }, [videoRef, enabled, sessionId, mode, rubric]);
}
