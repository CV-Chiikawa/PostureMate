import assert from "node:assert/strict";
import test from "node:test";
import {
  breakMeasurementContinuity,
  buildSessionFacts,
  createSessionMetrics,
  recordMeasurement,
  recordObservation,
} from "../src/utils/sessionFeedback.js";

test("유효 프레임 사이 1초 이하 구간만 측정 시간으로 누적한다", () => {
  const metrics = createSessionMetrics();
  recordMeasurement(metrics, "valid", 0);
  recordMeasurement(metrics, "valid", 200);
  recordMeasurement(metrics, "valid", 800);
  recordMeasurement(metrics, "unavailable", 1000);
  recordMeasurement(metrics, "valid", 2000);
  recordMeasurement(metrics, "valid", 2500);
  recordMeasurement(metrics, "valid", 4000);
  assert.equal(metrics.measuredMs, 1300);
  breakMeasurementContinuity(metrics);
  recordMeasurement(metrics, "valid", 4200);
  assert.equal(metrics.measuredMs, 1300);
});

test("관찰값을 값별로 집계하고 세션 피드백 요청 사실을 만든다", () => {
  const metrics = createSessionMetrics();
  metrics.measuredMs = 3240;
  recordObservation(metrics, "head_forward");
  recordObservation(metrics, "head_forward");
  recordObservation(metrics, null);
  const facts = buildSessionFacts({
    mode: "neck",
    rubric: "A",
    elapsedMs: 40100,
    stats: {
      caution: 2,
      warning: 1,
      recovered: 1,
      eventCounts: { forward_head_proxy: 2 },
      issueDurations: { forward_head_proxy: 8400 },
    },
    metrics,
  });
  assert.deepEqual(facts, {
    mode: "neck",
    rubric: null,
    elapsed_seconds: 40.1,
    measured_seconds: 3.2,
    caution: 2,
    warning: 1,
    recovered: 1,
    issues: { forward_head_proxy: { episodes: 2, seconds: 8.4 } },
    observations: { head_forward: 2 },
  });
});

test("면접 모드에서만 rubric을 전송한다", () => {
  const facts = buildSessionFacts({
    mode: "interview",
    rubric: "B",
    elapsedMs: 0,
    stats: { caution: 0, warning: 0, recovered: 0, eventCounts: {}, issueDurations: {} },
    metrics: createSessionMetrics(),
  });
  assert.equal(facts.rubric, "B");
  assert.deepEqual(facts.issues, {});
  assert.deepEqual(facts.observations, {});
});
