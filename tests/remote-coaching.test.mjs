import assert from "node:assert/strict";
import test from "node:test";
import { adaptAnalysisResponse } from "../src/services/AnalysisResponseAdapter.js";
import { toTemporalState } from "../src/services/RemoteAnalysisProvider.js";

const event = (id, severity = "caution") => ({
  event_id: id, mode: "neck", rubric: null, type: "forward_head_proxy", severity,
  started_at: 0, duration_sec: 2, confidence: 0.91, metrics: { forward_head_proxy: 0.12 },
});
const hint = (id, source, message) => ({ event_id: id, source, message });
const fallback = hint("A", "fallback", "기본 안내");
const solar = hint("A", "solar", "생성된 코칭");
function step(previous, { state = "CAUTION", currentEvent = null, coaching = null, session = "s", mode = "neck" } = {}) {
  const data = {
    ok: true, frame: { received: true }, session_id: session, analysis_source: "demo",
    context: { mode, rubric: null }, state, event: currentEvent, coaching,
    features: { head_tilt: 0, shoulder_height_difference: 0, torso_lean: 0, forward_head_proxy: 0.12, body_sway: 0, landmark_visibility: 1 },
  };
  return toTemporalState(adaptAnalysisResponse(data, { sessionId: session, mode, rubric: "" }), previous);
}

test("기본 안내 → 이벤트 없는 프레임의 SOLAR → 다음 프레임 유지 → 복구 후 폐기", () => {
  let state = step({}, { currentEvent: event("A"), coaching: fallback });
  assert.equal(state.coaching?.message, "기본 안내");
  assert.equal(step(state).coaching?.source, "fallback");
  state = step(state, { coaching: solar });
  assert.equal(state.coaching?.message, "생성된 코칭");
  assert.equal(step(state).coaching?.source, "solar");
  state = step(state, { state: "RECOVERED", coaching: solar });
  assert.equal(state.coaching, null);
  assert.equal(step(state, { coaching: solar }).coaching, null);
});

test("새 경고·새 세션·다른 모드에 예전 코칭을 표시하지 않는다", () => {
  const prev = step({}, { currentEvent: event("A"), coaching: solar });
  let next = step(prev, { state: "WARNING", currentEvent: event("B", "warning"), coaching: hint("B", "fallback", "새 경고") });
  next = step(next, { state: "WARNING", coaching: solar });
  assert.equal(next.coaching?.message, "새 경고");
  assert.equal(step(prev, { currentEvent: event("B"), coaching: solar }).coaching, null);
  assert.equal(step(prev, { state: "WARNING", coaching: solar }).coaching, null);
  assert.equal(step(prev, { session: "other", coaching: solar }).coaching, null);
  assert.equal(step(prev, { mode: "presentation", coaching: solar }).coaching, null);
});

test("잘못된 선택 필드가 정상적인 자세 판정이나 복구를 막지 않는다", () => {
  const prev = step({}, { currentEvent: event("A"), coaching: fallback });
  for (const invalid of [undefined, {}, { event_id: "A", source: "other", message: "텍스트" }, hint("A", "solar", "  "), hint("A", "solar", {})]) {
    assert.equal(step(prev, { coaching: invalid }).coaching?.source, "fallback");
    const recovered = step(prev, { state: "RECOVERED", coaching: invalid });
    assert.equal(recovered.status, "RECOVERED");
    assert.equal(recovered.coaching, null);
  }
});
