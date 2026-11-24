import json
import unittest
from unittest.mock import AsyncMock, patch

import httpx
from fastapi.testclient import TestClient

from backend.app import app


FACTS = {
    "mode": "neck", "rubric": None, "elapsed_seconds": 44, "measured_seconds": 32.4,
    "caution": 3, "warning": 1, "recovered": 2,
    "issues": {"forward_head_proxy": {"episodes": 3, "seconds": 15.5}},
    "observations": {"head_forward": 2, "head_tilt": 1},
}


class SessionFeedbackTests(unittest.TestCase):
    def test_interview_summary_supports_team_hand_spacing_observation(self):
        facts = {**FACTS, "mode": "interview", "rubric": "A", "observations": {"hands_apart": 2},
                 "issues": {"hand_placement": {"episodes": 1, "seconds": 4}}}
        message = "무릎 가운데에서 양손 사이 간격을 확인해 보세요."
        response = httpx.Response(200, request=httpx.Request("POST", "https://example.org"),
                                  json={"choices": [{"finish_reason": "stop", "message": {"content": message}}]})
        with patch.dict("os.environ", {"UPSTAGE_API_KEY": "test"}), TestClient(app) as client:
            with patch.object(app.state.solar, "post", new_callable=AsyncMock, return_value=response) as post:
                result = client.post("/session-feedback", json=facts)
                self.assertEqual(result.json(), {"source": "solar", "message": message})
                evidence = json.loads(post.await_args.kwargs["json"]["messages"][-1]["content"])
                self.assertIn("양손", evidence["observed_postures"][0]["reference"])

    def test_summary_uses_whole_session_and_only_returns_generated_text_on_success(self):
        message = "이번 연습에서는 머리가 앞으로 나오는 변화가 반복됐고 두 차례 기준 자세로 돌아왔습니다. 다음에는 귀가 어깨 위에 오는지 확인해 보세요."
        response = httpx.Response(200, request=httpx.Request("POST", "https://example.org"),
                                  json={"choices": [{"finish_reason": "stop", "message": {"content": message}}]})
        with patch.dict("os.environ", {"UPSTAGE_API_KEY": "test"}), TestClient(app) as client:
            with patch.object(app.state.solar, "post", new_callable=AsyncMock, return_value=response) as post:
                result = client.post("/session-feedback", json=FACTS)
                self.assertEqual(result.status_code, 200)
                self.assertEqual(result.json(), {"source": "solar", "message": message})
                body = post.await_args.kwargs["json"]
                self.assertEqual(body["model"], "solar-pro4")
                evidence = json.loads(body["messages"][-1]["content"])
                # Caution and warning can describe one episode. Their observation
                # counts must never become a second source of episode counts.
                self.assertNotIn("observations", evidence)
                self.assertEqual(evidence["issues"], FACTS["issues"])
                self.assertEqual(evidence["recovered"], 2)
                self.assertEqual(evidence["observed_postures"][0]["observation"], "머리가 기준 자세보다 앞으로 나와 있습니다.")
                self.assertIn("귀", evidence["observed_postures"][0]["reference"])
                post.assert_awaited_once()

    def test_short_session_and_no_key_do_not_call_solar(self):
        with patch.dict("os.environ", {"UPSTAGE_API_KEY": ""}), TestClient(app) as client:
            with patch.object(app.state.solar, "post", new_callable=AsyncMock) as post:
                short = client.post("/session-feedback", json={**FACTS, "measured_seconds": 2.9})
                self.assertEqual(short.json()["source"], "insufficient")
                self.assertEqual(client.post("/session-feedback", json=FACTS).json()["source"], "fallback")
                post.assert_not_awaited()

    def test_rejects_unknown_observations_and_mismatched_rubric(self):
        with TestClient(app) as client:
            for changes in ({"observations": {"arbitrary free text": 1}}, {"rubric": "A"}, {"frame": "x"}):
                self.assertEqual(client.post("/session-feedback", json={**FACTS, **changes}).status_code, 422)

    def test_model_timeout_returns_fallback_and_normal_only_sessions_can_be_reviewed(self):
        facts = {**FACTS, "mode": "presentation", "issues": {}, "observations": {}, "caution": 0, "warning": 0, "recovered": 0}
        with patch.dict("os.environ", {"UPSTAGE_API_KEY": "test"}), TestClient(app) as client:
            with patch.object(app.state.solar, "post", new_callable=AsyncMock, side_effect=httpx.ReadTimeout("timeout")) as post:
                self.assertEqual(client.post("/session-feedback", json=facts).json()["source"], "fallback")
                post.assert_awaited_once()
