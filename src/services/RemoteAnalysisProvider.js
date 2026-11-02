const EVENT_LABELS = {
  forward_lean: "상체 전방 기울임",
  forward_head_proxy: "머리 전방 변화",
  head_tilt: "머리 기울임",
  shoulder_imbalance: "어깨 불균형",
  body_sway: "몸 흔들림",
};

export function getRemoteEventKey(result) {
  if (!result.event) return null;
  return result.event.id || `${result.sessionId}:${result.event.type}:${result.event.startedAt}`;
}

export function toTemporalState(result, previous) {
  const isAlert = ["CAUTION", "WARNING"].includes(result.state);
  const keepCurrentEvent = isAlert && result.state === previous.status && result.sessionId === previous.sessionId;
  const eventType = result.event?.type ?? (keepCurrentEvent || result.state === "RECOVERED" ? previous.eventType : null);
  let activeEventId = null;
  let coaching = null;
  if (isAlert && result.context.mode === "neck") {
    // Solar usually arrives on a later frame whose event is null.
    activeEventId = result.event ? result.event.id : (keepCurrentEvent ? previous.activeEventId : null);
    if (activeEventId && result.coaching?.eventId === activeEventId) coaching = result.coaching;
    else if (activeEventId && keepCurrentEvent && previous.activeEventId === activeEventId) coaching = previous.coaching;
  }
  return {
    ...previous,
    sessionId: result.sessionId,
    activeEventId,
    coaching,
    status: result.state,
    eventType,
    eventLabel: eventType ? EVENT_LABELS[eventType] || eventType : null,
    statusChangedAt: result.state === previous.status ? previous.statusChangedAt : performance.now(),
    durationMs: result.event ? result.event.durationSec * 1000 : 0,
  };
}
