import io
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
from PIL import Image

from backend.app import app
from backend.test_pose import front


def jpeg():
    output = io.BytesIO()
    Image.new("RGB", (96, 96), "gray").save(output, format="JPEG")
    return output.getvalue()


class LiveTransportTests(unittest.TestCase):
    def test_live_interview_gets_rubric_coaching_and_tracks_one_episode(self):
        with patch.dict("os.environ", {"UPSTAGE_API_KEY": ""}), TestClient(app) as client:
            with (
                patch.object(app.state.detector, "detect", side_effect=[front(spread=.09)]*26+[front()]*28),
                patch("backend.app.frame_time", side_effect=[i / 5 for i in range(54)], create=True),
            ):
                results = [
                    client.post(
                        "/process-frame",
                        data={"session_id": "s", "source": "mediapipe", "mode": "interview", "rubric": "B"},
                        files={"file": ("f.jpg", jpeg(), "image/jpeg")},
                    ).json()
                    for _ in range(54)
                ]
        events = [p for p in results if p["event"]]
        self.assertEqual([p["state"] for p in events], ["CAUTION", "WARNING"])
        for p in events:
            self.assertEqual(p["coaching"]["event_id"], p["event"]["event_id"])
            self.assertIn("무릎", p["coaching"]["message"])
        self.assertEqual(results[-1]["active_issue"], "hand_placement")
        self.assertAlmostEqual(results[-1]["issue_duration_sec"], 5.4)

    def test_model_failure_never_substitutes_demo(self):
        with (
            TestClient(app) as client,
            patch.object(app.state.detector, "detect", side_effect=FileNotFoundError),
        ):
            res = client.post(
                "/process-frame",
                data={"session_id": "s", "mode": "neck", "source": "mediapipe"},
                files={"file": ("f.jpg", jpeg(), "image/jpeg")},
            )
            self.assertEqual(res.status_code, 503)

    def test_empty_room_is_unmeasured_for_all_modes(self):
        with TestClient(app) as client:
            for mode, rubric in [("neck", ""), ("interview", "B"), ("presentation", "")]:
                packet = client.post(
                    "/process-frame",
                    data={
                        "session_id": mode,
                        "mode": mode,
                        "rubric": rubric,
                    },
                    files={"file": ("frame.jpg", jpeg(), "image/jpeg")},
                )
                self.assertEqual(packet.status_code, 200, packet.text)
                result = packet.json()
                self.assertEqual(result["analysis_source"], "mediapipe")
                self.assertEqual(result["measurement_status"], "unavailable")
                self.assertTrue(all(result[k] is None for k in ("state", "features", "event", "coaching")))

    def test_invalid_live_context_and_unknown_source_are_rejected(self):
        with TestClient(app) as client:
            for mode, rubric, source in [
                ("other", "", "mediapipe"),
                ("interview", "C", "mediapipe"),
                ("presentation", "B", "mediapipe"),
                ("neck", "", "other"),
                ("neck", "", "demo"),
            ]:
                res = client.post(
                    "/process-frame",
                    data={"session_id": "s", "mode": mode, "rubric": rubric, "source": source},
                    files={"file": ("f.jpg", jpeg(), "image/jpeg")},
                )
                self.assertEqual(res.status_code, 422)
