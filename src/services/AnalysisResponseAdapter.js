const VALID_STATES = new Set(["NORMAL", "CANDIDATE", "CAUTION", "WARNING", "RECOVERED", "COOLDOWN"]);
const REQUIRED_FEATURES = [
  "head_tilt",
  "shoulder_height_difference",
  "torso_lean",
  "forward_head_proxy",
  "body_sway",
  "landmark_visibility",
];

function requireObject(value, name) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`Invalid analysis response: ${name}`);
  return value;
}

function normalizeEvent(event, context) {
  if (event === null) return null;
  requireObject(event, "event");
  if (typeof event.type !== "string" || !event.type || !["caution", "warning"].includes(event.severity)) {
    throw new Error("Invalid analysis response: event fields");
  }
  if (event.mode !== context.mode || (event.rubric ?? null) !== (context.rubric ?? null)) {
    throw new Error("Invalid analysis response: event context mismatch");
  }
  for (const field of ["started_at", "duration_sec", "confidence"]) {
    if (!Number.isFinite(event[field])) throw new Error(`Invalid analysis response: event.${field}`);
  }
  return {
    id: typeof event.event_id === "string" ? event.event_id : null,
    type: event.type,
    severity: event.severity,
    startedAt: event.started_at,
    durationSec: event.duration_sec,
    confidence: event.confidence,
    metrics: requireObject(event.metrics, "event.metrics"),
  };
}

export function adaptAnalysisResponse(data, expected) {
  requireObject(data, "root");
  const frame = requireObject(data.frame, "frame");
  const context = requireObject(data.context, "context");
  const features = requireObject(data.features, "features");
  if (data.ok !== true || typeof data.analysis_source !== "string" || !data.analysis_source || frame.received !== true) {
    throw new Error("Invalid analysis response: receipt/source");
  }
  if (typeof data.session_id !== "string" || data.session_id !== expected.sessionId) {
    throw new Error("Invalid analysis response: session mismatch");
  }
  if (context.mode !== expected.mode || (context.rubric ?? "") !== (expected.rubric ?? "")) {
    throw new Error("Invalid analysis response: context mismatch");
  }
  if (!VALID_STATES.has(data.state)) throw new Error("Invalid analysis response: unknown state");
  for (const feature of REQUIRED_FEATURES) {
    if (!Number.isFinite(features[feature])) throw new Error(`Invalid analysis response: features.${feature}`);
  }
  const event = normalizeEvent(data.event, context);
  return {
    sessionId: data.session_id,
    analysisSource: data.analysis_source,
    frame: {
      received: true,
      width: frame.width,
      height: frame.height,
      byteSize: frame.byte_size,
    },
    context: { mode: context.mode, rubric: context.rubric },
    featurePacket: {
      source: data.analysis_source === "demo" ? "remote-demo" : "remote",
      capturedAt: Date.now(),
      scenarioId: `remote-${data.state.toLowerCase()}`,
      values: { ...features },
    },
    state: data.state,
    event,
  };
}
