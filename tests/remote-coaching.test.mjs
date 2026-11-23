import assert from "node:assert/strict";
import test from "node:test";
import { adaptAnalysisResponse } from "../src/services/AnalysisResponseAdapter.js";
import { stableDisplay, toTemporalState } from "../src/services/RemoteAnalysisProvider.js";
import { evaluateContext } from "../src/utils/evaluator.js";

test("잠깐의 가림과 자세 변화로 표시 상태가 번갈아 바뀌지 않는다", () => {
  let view;
  const tick = (t, measurementStatus, state = null) => {
    view = stableDisplay(view, {measurementStatus, state}, t);
    return view.current;
  };
  tick(0, "valid", "NORMAL");
  tick(600, "valid", "NORMAL");
  assert.equal(tick(1200, "valid", "NORMAL").state, "NORMAL");
  tick(1400, "unavailable");
  tick(1600, "valid", "CANDIDATE");
  assert.equal(tick(1800, "unavailable").state, "NORMAL");
  tick(2400, "unavailable");
  assert.equal(tick(3000, "unavailable").measurementStatus, "unavailable");
  assert.equal(tick(3200, "valid", "CANDIDATE").measurementStatus, "unavailable");
  tick(3800, "valid", "NORMAL");
  assert.equal(tick(4400, "valid", "NORMAL").measurementStatus, "valid");
});

const event = (id, severity = "caution") => ({
  event_id: id, mode: "neck", rubric: null, type: "forward_head_proxy", severity,
  started_at: 0, duration_sec: 2, confidence: 0.91, metrics: { forward_head_proxy: 0.12 },
});
const hint = (id, source, message) => ({ event_id: id, source, message });
const fallback = hint("A", "fallback", "기본 안내");
const solar = hint("A", "solar", "생성된 코칭");
function step(previous, { state = "CAUTION", currentEvent = null, coaching = null, session = "s", mode = "neck", packet = {} } = {}) {
  const data = {
    ok: true, frame: { received: true }, session_id: session, analysis_source: "mediapipe",
    context: { mode, rubric: null }, state, event: currentEvent, coaching,
    features: { neck_score: 2, neck_level: "CAUTION", neck_view: "SIDE_LEFT", head_tilt: 0, shoulder_height_difference: 0, torso_lean: 0, forward_head_proxy: 0.12, body_sway: 0, landmark_visibility: 1 },
    ...packet,
  };
  return toTemporalState(adaptAnalysisResponse(data, { sessionId: session, mode, rubric: "" }), previous);
}

test("경고 이후 장시간 가림과 후보가 번갈아 오면 과거 경고를 지운다", () => {
  let view;
  const tick = (t, measurementStatus, state) => view = stableDisplay(view, {measurementStatus, state}, t);
  for (let t = 0; t <= 1600; t += 200) tick(t, "valid", "WARNING");
  for (let t = 1800; t <= 4800; t += 200) {
    if (t % 400) tick(t, "unavailable", null);
    else tick(t, "valid", "CANDIDATE");
  }
  assert.equal(view.current.measurementStatus, "unstable");
  assert.equal(view.current.state, null);
});

test("거북목 요약은 전방 이동 수치 하나가 아니라 서버의 종합 단계를 표시한다", () => {
  for (const [level, rating] of [["GOOD","양호"], ["CAUTION","주의"], ["BAD","위험"]]) {
    const packet = { values: { neck_level:level, neck_score:2, neck_view:"SIDE_LEFT", landmark_visibility:.40 } };
    assert.equal(evaluateContext(packet, "neck").results[0].rating, rating);
  }
});

test("실측 요청에 구버전 데모가 응답하면 표시하지 않는다", () => {
  const data = {ok:true, frame:{received:true}, context:{mode:"neck"}, session_id:"s",
    analysis_source:"demo", measurement_status:"unavailable", state:null, event:null, features:null};
  assert.throws(() => adaptAnalysisResponse(data, {sessionId:"s", mode:"neck", source:"mediapipe"}), /source/);
  assert.throws(() => adaptAnalysisResponse(data, {sessionId:"s", mode:"neck"}), /source/);
});

test("발표 실측에서는 목 전방 수치 없이 유효한 분석과 코칭을 표시한다", () => {
  const packet = {analysis_source:"mediapipe", features:{head_tilt:12, shoulder_height_difference:.02,
    body_sway:0, landmark_visibility:.94}};
  const currentEvent = {...event("P"), mode:"presentation", type:"head_tilt"};
  const result = step({}, {mode:"presentation", packet, currentEvent, coaching:hint("P","fallback","머리를 세워 보세요.")});
  assert.equal(result.activeEventId,"P");
  assert.equal(step(result, {mode:"presentation",packet,coaching:hint("P","solar","고개를 천천히 세워 보세요.")}).coaching?.source,"solar");
});

test("실측 면접 응답은 손목과 무릎 가림 사유를 보존한다", () => {
  const data = {ok:true, frame:{received:true}, context:{mode:"interview",rubric:"B"}, session_id:"s",
    analysis_source:"mediapipe", measurement_status:"unavailable", measurement_reason:"wrist_or_knee_not_visible",
    state:null,event:null,features:null};
  const result = adaptAnalysisResponse(data,{sessionId:"s",mode:"interview",rubric:"B",source:"mediapipe"});
  assert.equal(result.measurementReason,"wrist_or_knee_not_visible");
});

test("보정·가림 응답은 이전 SOLAR를 지우고 기존 이벤트의 지연 응답을 무시한다", () => {
  const prev = step({}, { currentEvent: event("A"), coaching: solar });
  for (const measurement_status of ["calibrating", "unavailable"]) {
    const next = step(prev, { packet: { measurement_status, features: null, state: null, event: null, coaching: solar } });
    assert.equal(next.status, null);
    assert.equal(next.coaching, null);
    assert.equal(next.activeEventId, null);
    assert.equal(step(next, { coaching: solar }).coaching, null);
    assert.equal(step(next, { currentEvent: event("B"), coaching: hint("B", "fallback", "새 안내") }).coaching?.message, "새 안내");
  }
});

test("측정 가능 여부를 검증하고 기존 프레임의 숫자 계약을 유지한다", () => {
  assert.throws(() => step({}, { packet: { measurement_status: "unknown" } }), /measurement_status/);
  assert.throws(() => step({}, { packet: { measurement_status: "valid", features: null } }), /features/);
  assert.equal(step({}, { state: "NORMAL" }).status, "NORMAL");
});

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
