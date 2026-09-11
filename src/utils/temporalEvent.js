import { TEMPORAL_CONFIG } from "../config/modes.js";

export const INITIAL_TEMPORAL_STATE = {
  status: "NORMAL",
  eventType: null,
  eventLabel: null,
  detectedAt: null,
  statusChangedAt: 0,
  durationMs: 0,
};

function transition(previous, status, now, extra = {}) {
  return { ...previous, ...extra, status, statusChangedAt: now };
}

export function advanceTemporalState(previous, evaluation, now, config = TEMPORAL_CONFIG) {
  if (!evaluation.available) {
    return previous.status === "NORMAL" ? previous : { ...INITIAL_TEMPORAL_STATE, statusChangedAt: now };
  }

  const issue = evaluation.primary;
  if (issue) {
    if (previous.eventType !== issue.feature || ["NORMAL", "RECOVERED"].includes(previous.status)) {
      return transition(previous, "CANDIDATE", now, {
        eventType: issue.feature,
        eventLabel: issue.label,
        detectedAt: now,
        durationMs: 0,
      });
    }

    if (previous.status === "COOLDOWN") {
      if (now - previous.statusChangedAt < config.cooldownMs) return previous;
      return transition(previous, "CANDIDATE", now, { detectedAt: now, durationMs: 0 });
    }

    const durationMs = now - previous.detectedAt;
    if (durationMs >= config.warningMs && previous.status !== "WARNING") {
      return transition(previous, "WARNING", now, { durationMs });
    }
    if (durationMs >= config.cautionMs && previous.status === "CANDIDATE") {
      return transition(previous, "CAUTION", now, { durationMs });
    }
    return { ...previous, durationMs };
  }

  if (["CAUTION", "WARNING"].includes(previous.status)) {
    return transition(previous, "RECOVERED", now, { durationMs: previous.durationMs });
  }
  if (previous.status === "CANDIDATE") {
    return { ...INITIAL_TEMPORAL_STATE, statusChangedAt: now };
  }
  if (previous.status === "RECOVERED" && now - previous.statusChangedAt >= config.recoveredMs) {
    return transition(previous, "COOLDOWN", now);
  }
  if (previous.status === "COOLDOWN" && now - previous.statusChangedAt >= config.cooldownMs) {
    return { ...INITIAL_TEMPORAL_STATE, statusChangedAt: now };
  }
  return previous;
}
