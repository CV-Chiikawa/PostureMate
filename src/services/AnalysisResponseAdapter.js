const VALID_STATES = new Set(["NORMAL", "CANDIDATE", "CAUTION", "WARNING", "RECOVERED", "COOLDOWN"]);

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

function normalizeCoaching(packet) {
  if (!packet || typeof packet.event_id !== "string" || !packet.event_id.trim()
      || !["fallback", "solar"].includes(packet.source)
      || typeof packet.message !== "string" || !packet.message.trim()) return null;
  return { eventId: packet.event_id, source: packet.source, message: packet.message.trim() };
}

export function adaptAnalysisResponse(data, expected) {
  requireObject(data, "root");
  const frame = requireObject(data.frame, "frame");
  const context = requireObject(data.context, "context");
  if (data.analysis_source !== "mediapipe") throw new Error("Invalid analysis source");
  if (data.ok !== true || frame.received !== true) {
    throw new Error("Invalid analysis response: receipt/source");
  }
  if (typeof data.session_id !== "string" || data.session_id !== expected.sessionId) {
    throw new Error("Invalid analysis response: session mismatch");
  }
  if (context.mode !== expected.mode || (context.rubric ?? "") !== (expected.rubric ?? "")) {
    throw new Error("Invalid analysis response: context mismatch");
  }
  const measurementStatus = data.measurement_status === undefined ? "valid" : data.measurement_status;
  if (!["valid", "calibrating", "unavailable"].includes(measurementStatus)) {
    throw new Error("Invalid analysis response: measurement_status");
  }
  const measured = measurementStatus === "valid";
  let featurePacket = null;
  let event = null;
  if (measured) {
    const features = requireObject(data.features, "features");
    if (!VALID_STATES.has(data.state)) throw new Error("Invalid analysis response: unknown state");
    const liveRequired = context.mode === "neck" ? ["neck_score", "landmark_visibility"]
      : ["head_tilt", "shoulder_height_difference", "body_sway", "landmark_visibility"];
    for (const feature of liveRequired) {
      if (!Number.isFinite(features[feature])) throw new Error(`Invalid analysis response: features.${feature}`);
    }
    featurePacket = {
      capturedAt: Date.now(),
      values: { ...features },
    };
    event = normalizeEvent(data.event, context);
  } else if (data.features !== null || data.state !== null || data.event !== null) {
    throw new Error("Invalid analysis response: unmeasured frame");
  }
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
    calibration: data.calibration ?? null,
    measurementStatus,
    measurementReason: data.measurement_reason ?? null,
    activeIssue: measured ? data.active_issue ?? null : null,
    issueDurationMs: measured && Number.isFinite(data.issue_duration_sec) ? data.issue_duration_sec * 1000 : 0,
    featurePacket,
    state: data.state,
    event,
    coaching: measured ? normalizeCoaching(data.coaching) : null,
  };
}
