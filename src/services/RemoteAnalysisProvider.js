const EVENT_LABELS = {
  forward_lean: "상체 전방 기울임",
  head_tilt: "머리 기울임",
  shoulder_imbalance: "어깨 불균형",
  body_sway: "몸 흔들림",
};

export function getRemoteEventKey(result) {
  if (!result.event) return null;
  return result.event.id || `${result.sessionId}:${result.event.type}:${result.event.startedAt}`;
}

export function toTemporalState(result, previous) {
  const keepCurrentEvent = result.state === previous.status && ["CAUTION", "WARNING"].includes(result.state);
  const eventType = result.event?.type ?? (keepCurrentEvent || result.state === "RECOVERED" ? previous.eventType : null);
  return {
    ...previous,
    status: result.state,
    eventType,
    eventLabel: eventType ? EVENT_LABELS[eventType] || eventType : null,
    statusChangedAt: result.state === previous.status ? previous.statusChangedAt : performance.now(),
    durationMs: result.event ? result.event.durationSec * 1000 : 0,
  };
}
