"""Contract tests: real JPEG -> FastAPI -> simulated Upstage HTTP -> later frame."""
import asyncio
import io
import json
import unittest
from unittest.mock import patch

import httpx
from PIL import Image

from backend.app import app
from backend.coaching import Coaching, fixed_hint
from backend.pose import PoseSession
from backend.test_pose import front, sequence, side


class FeedbackCopyTests(unittest.TestCase):
    def test_frontal_neck_alert_names_the_observed_change(self):
        for joint, axis, change, expected in [
            (0, "z", -.22, "머리가 기준 자세보다 앞으로 나와 있습니다."),
            (7, "y", .065, "고개가 한쪽으로 기울어져 있습니다."),
            (0, "y", .12, "머리가 기준 자세보다 낮아졌습니다."),
            (0, "x", .10, "머리가 어깨 중앙에서 한쪽으로 치우쳐 있습니다."),
        ]:
            with self.subTest(expected=expected):
                engine, posture = PoseSession(), front()
                setattr(posture[joint], axis, getattr(posture[joint], axis) + change)
                frames = sequence(engine, "neck", [front()] * 42 + [posture] * 18)
                event = next(p["event"] for p in frames if p["event"])
                self.assertTrue(fixed_hint(event).startswith(expected + " "), fixed_hint(event))

    def test_same_severity_switches_feedback_when_tilt_replaces_forward_head(self):
        forward, both, tilted = front(), front(), front()
        forward[0].z = both[0].z = -.22
        both[7].y += .064
        tilted[7].y += .064
        frames = sequence(PoseSession(), "neck", [front()] * 42 + [forward] * 20 + [both] * 8 + [tilted] * 28)
        self.assertTrue(all(p["state"] == "CAUTION" for p in frames[61:]))
        messages = [fixed_hint(p["event"]) for p in frames if p["event"]]
        self.assertEqual(len(messages), 2)
        self.assertIn("고개가 한쪽으로 기울어져 있습니다.", messages[-1])

    def test_interview_distinguishes_knee_spacing_from_hand_position(self):
        for rubric, posture, expected in [
            ("A", front(spread=.09), "무릎 사이가 벌어져 있습니다."),
            ("A", front(hands_y=.45), "손이 양쪽 무릎 가운데에 모여 있지 않습니다."),
            ("B", front(), "양쪽 무릎이 가까이 붙어 있습니다."),
            ("B", front(spread=.09, hands_y=.45), "손이 같은 쪽 무릎 위에 놓여 있지 않습니다."),
        ]:
            with self.subTest(rubric=rubric, expected=expected):
                frames = sequence(PoseSession(), "interview", [posture] * 30, rubric)
                event = next(p["event"] for p in frames if p["event"])
                self.assertTrue(fixed_hint(event).startswith(expected + " "), fixed_hint(event))


class NeckCoachingTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        image = io.BytesIO()
        Image.new("RGB", (320, 240)).save(image, "JPEG")
        self.jpeg = image.getvalue()
        self.calls = []
        self.started = asyncio.Event()
        self.release = asyncio.Event()
        self.finished = asyncio.Event()
        self.status = 200
        self.body = {"choices": [{"message": {"content": "고개를 처음 위치로 돌려 보세요."}}]}
        self.enterContext(patch.dict("os.environ", {"UPSTAGE_API_KEY": "unit-test-only"}))
        await self.enterAsyncContext(app.router.lifespan_context(app))
        self.points = side()
        self.now = 0
        self.enterContext(patch.object(app.state.detector, "detect", side_effect=lambda _, **kwargs: self.points))
        self.enterContext(patch("backend.app.frame_time", side_effect=lambda: self.now))
        self.client = await self.enterAsyncContext(httpx.AsyncClient(
            transport=httpx.ASGITransport(app), base_url="http://test"))
        app.state.solar = await self.enterAsyncContext(httpx.AsyncClient(
            transport=httpx.MockTransport(self.upstream)))

    async def test_health_reports_key_presence_without_exposing_credentials(self):
        for key, expected in [("unit-test-only", True), ("", False)]:
            with self.subTest(configured=expected), patch.dict("os.environ", {"UPSTAGE_API_KEY": key}):
                response = await self.client.get("/health")
                self.assertIs(response.json().get("solar_configured"), expected)
                self.assertNotIn("unit-test-only", response.text)

    async def test_upstream_failure_logs_status_without_credentials_or_response(self):
        self.status = 401
        self.body = {"error": "private-upstream-detail"}
        self.release.set()
        with self.assertLogs("backend.coaching", level="WARNING") as logs:
            await self.caution()
            await asyncio.wait_for(self.finished.wait(), 1)
        output = " ".join(logs.output)
        self.assertIn("HTTP 401", output)
        self.assertNotIn("unit-test-only", output)
        self.assertNotIn("private-upstream-detail", output)

    async def test_unusable_success_response_logs_safe_reason(self):
        self.body = {"choices": [{"finish_reason": "length", "message": {"content": "private-answer"}}]}
        self.release.set()
        with self.assertLogs("backend.coaching", level="WARNING") as logs:
            await self.caution()
            await asyncio.wait_for(self.finished.wait(), 1)
        self.assertIn("incomplete_response", " ".join(logs.output))
        self.assertNotIn("private-answer", " ".join(logs.output))

    async def upstream(self, req):
        self.calls.append(req)
        self.started.set()
        try:
            await self.release.wait()
            return httpx.Response(self.status, json=self.body)
        finally:
            self.finished.set()

    async def frame(self, session="neck-test", mode="neck"):
        self.now += 0.5
        res = await self.client.post("/process-frame",
            data={"session_id": session, "mode": mode, "rubric": "B" if mode == "interview" else ""},
            files={"file": ("frame.jpg", self.jpeg, "image/jpeg")})
        self.assertEqual(res.status_code, 200)
        await asyncio.sleep(0)  # Real camera frames arrive on distinct event-loop turns.
        return res.json()

    async def until(self, predicate, **kwargs):
        for _ in range(32):
            data = await self.frame(**kwargs)
            if predicate(data):
                return data
        self.fail("Pose sequence did not produce the requested state/event")

    async def caution(self, **kwargs):
        self.points = side()
        await self.until(lambda d: d["state"] == "NORMAL", **kwargs)
        self.points = side()
        self.points[0].x -= .045  # Nose-only change stays at NeckOn caution (2 points).
        return await self.until(lambda d: d["event"] and d["event"]["severity"] == "caution", **kwargs)

    async def test_calibration_and_occlusion_have_no_measurements_or_coaching(self):
        first = await self.frame()
        self.assertEqual(first.get("measurement_status"), "calibrating")
        for field in ("features", "state", "event", "coaching"):
            self.assertIsNone(first[field])
        self.assertEqual(self.calls, [])

        caution = await self.caution()
        self.assertEqual(caution["measurement_status"], "valid")
        await asyncio.wait_for(self.started.wait(), 1)
        self.started.clear()
        self.points = side(shift=.06)
        warning = await self.until(lambda d: d["state"] == "WARNING")
        self.assertEqual(warning["coaching"]["source"], "fallback")
        self.assertNotEqual(warning["event"]["event_id"], caution["event"]["event_id"])
        await asyncio.wait_for(self.started.wait(), 1)
        self.finished.clear()
        self.points = []
        blocked = await self.until(lambda d: d.get("measurement_status") == "unavailable")
        self.assertEqual(blocked["measurement_reason"], "ear_or_shoulder_not_visible")
        self.assertTrue(self.finished.is_set(), "occlusion should cancel the pending Solar call")
        for field in ("features", "state", "event", "coaching"):
            self.assertIsNone(blocked[field])
        self.assertIsNone((await self.frame())["coaching"])
        self.assertEqual(len(self.calls), 2)
        self.points = side()
        recovered = await self.frame()
        self.assertEqual(recovered["state"], "NORMAL")
        self.assertEqual(recovered["measurement_status"], "valid")
        self.assertIsNone(recovered["coaching"])

    async def test_warning_is_immediate_and_coaching_arrives_on_a_later_frame_once(self):
        start = await asyncio.wait_for(self.caution(), 1)
        event = start["event"]
        self.assertEqual(event["type"], "forward_head_proxy")
        self.assertEqual(start["analysis_source"], "mediapipe")
        self.assertEqual(start["coaching"]["source"], "fallback")
        self.assertEqual(start["coaching"]["event_id"], event["event_id"])
        await asyncio.wait_for(self.started.wait(), 1)
        req, = self.calls
        self.assertEqual(str(req.url), "https://api.upstage.ai/v1/chat/completions")
        self.assertEqual(req.headers["authorization"], "Bearer unit-test-only")
        body = json.loads(req.content)
        self.assertEqual(body["model"], "solar-pro4")
        facts = json.loads(body["messages"][-1]["content"])
        self.assertEqual(facts, {k: event[k] for k in ("mode", "rubric", "type", "severity", "duration_sec", "metrics")})
        self.assertNotIn("neck-test", req.content.decode())
        observation = "머리가 기준 자세보다 앞으로 나와 있습니다."
        self.assertTrue(start["coaching"]["message"].startswith(observation))
        self.assertIn(observation, body["messages"][0]["content"])
        self.assertIsNone((await self.frame())["coaching"])
        self.release.set()
        await asyncio.wait_for(self.finished.wait(), 1)
        self.assertIsNone((await self.frame(session="someone-else"))["coaching"])
        result = await self.until(lambda d: d.get("coaching") is not None)
        self.assertIsNone(result["event"])
        self.assertEqual(result["coaching"], {"event_id": event["event_id"], "source": "solar",
                         "message": observation + " " + self.body["choices"][0]["message"]["content"]})
        self.assertIsNone((await self.frame())["coaching"])
        self.assertEqual(len(self.calls), 1)

    async def test_escalation_can_call_but_same_pair_within_30s_cannot(self):
        self.release.set()
        await self.caution()
        self.points = side(shift=.06)
        await self.until(lambda d: d["event"] and d["event"]["severity"] == "warning")
        await asyncio.sleep(0)
        self.assertEqual(len(self.calls), 2)
        next_event = await self.caution()
        self.assertEqual(next_event["coaching"]["source"], "fallback")
        await asyncio.sleep(0)
        self.assertEqual(len(self.calls), 2)

    async def test_cooldown_expires_at_30s_but_an_ongoing_event_never_restarts(self):
        self.release.set()
        manager = Coaching()
        loop = asyncio.get_running_loop()
        start = loop.time()
        event = {"event_id": "a", "mode": "neck", "rubric": None, "type": "forward_head_proxy",
                 "severity": "warning", "duration_sec": 9, "metrics": {"forward_head_proxy": 0.18}}

        async def tick(offset, state, event):
            with patch.object(loop, "time", return_value=start + offset):
                manager.frame(app.state.solar, state, event)
            await asyncio.sleep(0)

        await tick(0, "WARNING", event)
        await tick(1, "RECOVERED", None)
        await tick(29.9, "WARNING", {**event, "event_id": "b"})
        self.assertEqual(len(self.calls), 1)
        await tick(30, "RECOVERED", None)
        await tick(30, "WARNING", {**event, "event_id": "c"})
        self.assertEqual(len(self.calls), 2)
        await tick(61, "WARNING", {**event, "event_id": "c"})
        self.assertEqual(len(self.calls), 2)

    async def test_completed_result_is_discarded_if_mode_changes_before_delivery(self):
        await self.caution()
        self.release.set()
        await asyncio.wait_for(self.finished.wait(), 1)
        self.assertIsNone((await self.frame(mode="presentation"))["coaching"])
        self.assertIsNone((await self.frame())["coaching"])

    async def test_recovery_or_mode_switch_discards_inflight_result(self):
        await self.caution()
        self.points = side(shift=.06)
        start = await self.until(lambda d: d["event"] and d["event"]["severity"] == "warning")
        self.assertEqual(start["coaching"]["source"], "fallback")
        await asyncio.sleep(0)
        self.points = side()
        recovered = await self.until(lambda d: d["state"] == "RECOVERED")
        self.release.set()
        await asyncio.sleep(0)
        self.assertIsNone(recovered["coaching"])
        self.assertIsNone((await self.frame())["coaching"])
        self.assertIsNone((await self.frame(mode="presentation"))["coaching"])

    async def test_deadline_cancels_slow_solar_without_canceling_frame_processing(self):
        # Exercise the actual deadline with the production five-second limit.
        start = await self.caution()
        await asyncio.wait_for(self.started.wait(), 1)
        self.assertEqual(start["coaching"]["source"], "fallback")
        await asyncio.sleep(4)
        self.assertFalse(self.finished.is_set())
        await asyncio.wait_for(self.finished.wait(), 1.4)
        self.assertIsNone((await self.frame())["coaching"])
        self.assertEqual(len(self.calls), 1)

    async def test_api_error_or_invalid_message_keeps_fallback(self):
        self.release.set()
        invalid_advice = ["머리가 앞으로 나왔습니다. 턱을 당겨 주세요.", "머리가 앞으로 나와 있습니다."]
        responses = [(429, {}), (200, {"choices": []})]
        for message in ["", *invalid_advice]:
            responses.append((200, {"choices": [{"message": {"content": message}}]}))
        for n,(status,body) in enumerate(responses):
            with self.subTest(status=status, body=body):
                self.status, self.body = status, body
                self.finished.clear()
                session = f"bad-{n}"
                self.assertEqual((await self.caution(session=session))["coaching"]["source"], "fallback")
                await asyncio.wait_for(self.finished.wait(), 1)
                self.assertIsNone((await self.frame(session=session))["coaching"])
        self.assertEqual(len(self.calls), len(responses))

    async def test_alerts_in_both_frontal_modes_request_solar(self):
        self.release.set()
        for mode in ("interview", "presentation"):
            self.points = front(spread=.09) if mode == "interview" else front()
            await self.until(lambda d: d["measurement_status"] == "valid", mode=mode, session=mode)
            self.points = front()
            if mode == "presentation":
                self.points[7].y += 0.05
            packet = await self.until(lambda d: d["event"] is not None, mode=mode, session=mode)
            self.assertEqual(packet["event"]["type"], "hand_placement" if mode == "interview" else "head_tilt")
            self.assertEqual(packet["coaching"]["source"], "fallback")
            delivered = await self.until(lambda d: (d["coaching"] or {}).get("source") == "solar", mode=mode, session=mode)
            self.assertEqual(delivered["coaching"]["event_id"], packet["event"]["event_id"])
        self.assertEqual(len(self.calls), 2)

    async def test_missing_key_keeps_frame_and_default_coaching(self):
        with patch.dict("os.environ", {"UPSTAGE_API_KEY": ""}):
            packet = await self.caution()
            self.assertEqual(packet["coaching"]["source"], "fallback")
            await asyncio.sleep(0)
            self.assertEqual(self.calls, [])

    async def test_neck_rejects_free_text_rubric_before_event_processing(self):
        response = await self.client.post("/process-frame",
            data={"session_id": "invalid", "mode": "neck", "rubric": "untrusted text"},
            files={"file": ("test.jpg", self.jpeg, "image/jpeg")})
        self.assertEqual(response.status_code, 422)
        self.assertEqual(self.calls, [])
