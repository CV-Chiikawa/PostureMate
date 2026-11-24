const EVENT_LABELS = {
  forward_lean: "상체 전방 기울임",
  forward_head_proxy: "머리·어깨 정렬 변화",
  head_tilt: "머리 기울임",
  shoulder_imbalance: "어깨 불균형",
  body_sway: "몸 흔들림",
  torso_lean: "상체 기울기",
  shoulder_height_difference: "어깨 높이 차이",
  hand_placement: "손·무릎 배치",
};

export function getRemoteEventKey(result) {
  if (!result.event) return null;
  return result.event.id || `${result.sessionId}:${result.event.type}:${result.event.startedAt}`;
}

export function toTemporalState(result, previous) {
  const isAlert = ["CAUTION", "WARNING"].includes(result.state);
  const sameContext = result.sessionId === previous.sessionId && result.context.mode === previous.mode
    && result.context.rubric === previous.rubric;
  const keepCurrentEvent = isAlert && result.state === previous.status && sameContext;
  const eventType = result.event?.type ?? (keepCurrentEvent || result.state === "RECOVERED" ? previous.eventType : null);
  let activeEventId = null;
  let coaching = null;
  if (isAlert) {
    // Solar usually arrives on a later frame whose event is null.
    activeEventId = result.event ? result.event.id : (keepCurrentEvent ? previous.activeEventId : null);
    if (activeEventId && result.coaching?.eventId === activeEventId) coaching = result.coaching;
    else if (activeEventId && keepCurrentEvent && previous.activeEventId === activeEventId) coaching = previous.coaching;
  }
  return {
    ...previous,
    sessionId: result.sessionId,
    mode: result.context.mode,
    rubric: result.context.rubric,
    activeEventId,
    coaching,
    status: result.state,
    eventType,
    eventLabel: eventType ? EVENT_LABELS[eventType] || eventType : null,
    statusChangedAt: result.state === previous.status ? previous.statusChangedAt : performance.now(),
    durationMs: result.event ? result.event.durationSec * 1000 : 0,
  };
}

// Confirm signal loss and return independently of which posture is seen during reacquisition.
export function stableDisplay(previous, sample, now) {
  const {measurementStatus, state, measurementReason} = sample;
  const key = [measurementStatus, state, measurementReason].join("/");
  const continuous = previous && now - previous.at <= 1000 && now >= previous.at;
  const current = continuous ? previous.current : null;
  const sinceSignal = continuous && previous.signal === measurementStatus ? previous.sinceSignal : now;
  const sincePosture = continuous && previous.key === key ? previous.sincePosture : now;
  const sameSignal = current?.measurementStatus === measurementStatus;
  const samePosture = sameSignal && current.state === state && current.measurementReason === measurementReason;
  const confirmed = sameSignal ? samePosture || now - sincePosture >= 800 : now - sinceSignal >= 1200;
  const lastConfirmed = confirmed || !continuous ? now : previous.lastConfirmed;
  const expired = now - lastConfirmed >= 2400;
  const next = confirmed ? sample : expired ? {measurementStatus: "unstable", state: null} : current;
  return {current: next, lastConfirmed, at: now, key, signal: measurementStatus, sinceSignal, sincePosture};
}
