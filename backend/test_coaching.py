"""Contract tests: real JPEG -> FastAPI -> simulated Upstage HTTP -> later frame."""
import asyncio
import io
import json
import unittest
from unittest.mock import patch

import httpx
from PIL import Image

from backend.app import app
from backend.coaching import Coaching


class NeckCoachingTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        image = io.BytesIO()
        Image.new("RGB", (16, 12)).save(image, "JPEG")
        self.jpeg = image.getvalue()
        self.calls = []
        self.started = asyncio.Event()
        self.release = asyncio.Event()
        self.finished = asyncio.Event()
        self.status = 200
        self.body = {"choices": [{"message": {"content": "고개를 처음 위치로 돌려 보세요."}}]}
        self.enterContext(patch.dict("os.environ", {"UPSTAGE_API_KEY": "unit-test-only"}))
        await self.enterAsyncContext(app.router.lifespan_context(app))
        self.client = await self.enterAsyncContext(httpx.AsyncClient(
            transport=httpx.ASGITransport(app), base_url="http://test"))
        app.state.solar = await self.enterAsyncContext(httpx.AsyncClient(
            transport=httpx.MockTransport(self.upstream)))

    async def upstream(self, req):
        self.calls.append(req)
        self.started.set()
        try:
            await self.release.wait()
            return httpx.Response(self.status, json=self.body)
        finally:
            self.finished.set()

    async def frame(self, session="neck-test", mode="neck"):
        res = await self.client.post("/process-frame",
            data={"session_id": session, "mode": mode, "rubric": ""},
            files={"file": ("frame.jpg", self.jpeg, "image/jpeg")})
        self.assertEqual(res.status_code, 200)
        await asyncio.sleep(0)  # Real camera frames arrive on distinct event-loop turns.
        return res.json()

    async def until(self, predicate, **kwargs):
        for _ in range(120):
            data = await self.frame(**kwargs)
            if predicate(data):
                return data
        self.fail("demo never produced requested state/event")

    async def caution(self, **kwargs):
        return await self.until(lambda d: d["event"] and d["event"]["severity"] == "caution", **kwargs)

    async def test_warning_is_immediate_and_coaching_arrives_on_a_later_frame_once(self):
        start = await asyncio.wait_for(self.caution(), 1)
        event = start["event"]
        self.assertEqual(event["type"], "forward_head_proxy")
        self.assertEqual(start["analysis_source"], "demo")
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
        self.assertIsNone((await self.frame())["coaching"])
        self.release.set()
        await asyncio.wait_for(self.finished.wait(), 1)
        self.assertIsNone((await self.frame(session="someone-else"))["coaching"])
        result = await self.until(lambda d: d.get("coaching") is not None)
        self.assertIsNone(result["event"])
        self.assertEqual(result["coaching"], {"event_id": event["event_id"], "source": "solar",
                         "message": self.body["choices"][0]["message"]["content"]})
        self.assertIsNone((await self.frame())["coaching"])
        self.assertEqual(len(self.calls), 1)

    async def test_escalation_can_call_but_same_pair_within_30s_cannot(self):
        self.release.set()
        await self.caution()
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
                manager.frame(app.state.solar, "neck", state, event)
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
        start = await self.until(lambda d: d["event"] and d["event"]["severity"] == "warning")
        self.assertEqual(start["coaching"]["source"], "fallback")
        await asyncio.sleep(0)
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
        for n,(status,body) in enumerate([(429, {}), (200, {"choices": []}), (200, {"choices":[{"message":{"content":""}}]})]):
            with self.subTest(status=status, body=body):
                self.status, self.body = status, body
                self.finished.clear()
                session = f"bad-{n}"
                self.assertEqual((await self.caution(session=session))["coaching"]["source"], "fallback")
                await asyncio.wait_for(self.finished.wait(), 1)
                self.assertIsNone((await self.frame(session=session))["coaching"])
        self.assertEqual(len(self.calls), 3)

    async def test_other_modes_do_not_use_solar(self):
        for mode in ("interview", "presentation"):
            event = await self.until(lambda d: d["event"] is not None, mode=mode, session=mode)
            self.assertEqual(event["event"]["type"], "forward_lean")
            self.assertIsNone(event["coaching"])
        self.assertEqual(self.calls, [])

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
