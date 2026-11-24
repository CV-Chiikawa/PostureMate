export function createSessionMetrics() {
  return { measuredMs: 0, lastValidAt: null, observations: {} };
}

export function recordMeasurement(metrics, measurementStatus, now) {
  if (measurementStatus !== "valid") {
    metrics.lastValidAt = null;
    return;
  }
  if (metrics.lastValidAt !== null) {
    const delta = now - metrics.lastValidAt;
    if (delta >= 0 && delta <= 1000) metrics.measuredMs += delta;
  }
  metrics.lastValidAt = now;
}

export function breakMeasurementContinuity(metrics) {
  metrics.lastValidAt = null;
}

export function recordObservation(metrics, observation) {
  if (!["string", "number", "boolean"].includes(typeof observation)) return;
  const key = String(observation).trim();
  if (!key) return;
  metrics.observations[key] = (metrics.observations[key] || 0) + 1;
}

export function buildSessionFacts({ mode, rubric, elapsedMs, stats, metrics }) {
  const issueTypes = new Set([...Object.keys(stats.eventCounts), ...Object.keys(stats.issueDurations)]);
  const issues = {};
  for (const type of issueTypes) {
    issues[type] = {
      episodes: stats.eventCounts[type] || 0,
      seconds: Number(((stats.issueDurations[type] || 0) / 1000).toFixed(1)),
    };
  }
  return {
    mode,
    rubric: mode === "interview" ? rubric : null,
    elapsed_seconds: Number((elapsedMs / 1000).toFixed(1)),
    measured_seconds: Number((metrics.measuredMs / 1000).toFixed(1)),
    caution: stats.caution,
    warning: stats.warning,
    recovered: stats.recovered,
    issues,
    observations: { ...metrics.observations },
  };
}
