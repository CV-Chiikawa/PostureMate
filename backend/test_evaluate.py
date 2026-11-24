import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


class AcceptanceTests(unittest.TestCase):
    def test_one_truth_cannot_credit_two_warnings_and_normal_minutes_exclude_labeled_time(self):
        with tempfile.TemporaryDirectory() as folder:
            truth = Path(folder) / "truth.json"
            predicted = Path(folder) / "predicted.json"
            truth.write_text(json.dumps([{"type": "torso_lean", "start": 10, "end": 20}]))
            predicted.write_text(
                json.dumps(
                    [
                        {"type": "torso_lean", "start": 10, "end": 15},
                        {"type": "torso_lean", "start": 15, "end": 20},
                        {"type": "body_sway", "start": 35, "end": 42},
                    ]
                )
            )
            run = subprocess.run(
                [
                    sys.executable,
                    "-m",
                    "backend.evaluate",
                    "--labels",
                    str(truth),
                    "--predictions",
                    str(predicted),
                    "--duration",
                    "70",
                ],
                capture_output=True,
                text=True,
            )
            self.assertEqual(run.returncode, 0, run.stderr)
            score = json.loads(run.stdout)
            self.assertAlmostEqual(score["precision"], 1 / 3)
            self.assertEqual(score["recall"], 1)
            self.assertEqual(score["false_warnings_per_normal_minute"], 1)
            self.assertEqual(score["by_type"]["torso_lean"]["tp"], 1)

    def test_evaluates_video_with_actual_model_and_reports_unmeasured_frames(self):
        import cv2
        import numpy as np

        with tempfile.TemporaryDirectory() as folder:
            video = Path(folder) / "empty.avi"
            writer = cv2.VideoWriter(str(video), cv2.VideoWriter_fourcc(*"MJPG"), 10, (96, 96))
            for _ in range(10):
                writer.write(np.zeros((96, 96, 3), dtype=np.uint8))
            writer.release()
            labels = Path(folder) / "truth.json"
            labels.write_text("[]")
            run = subprocess.run(
                [
                    sys.executable,
                    "-m",
                    "backend.evaluate",
                    "--labels",
                    str(labels),
                    "--video",
                    str(video),
                    "--mode",
                    "presentation",
                ],
                capture_output=True,
                text=True,
            )
            self.assertEqual(run.returncode, 0, run.stderr)
            report = json.loads(run.stdout)
            self.assertEqual(report["frames"], 5)
            self.assertEqual(report["unavailable"], 5)
            self.assertEqual(report["false_warnings_per_normal_minute"], 0)
            self.assertIsNone(report["recall"])
            self.assertGreater(report["processing_fps"], 0)
            unlabeled = subprocess.run(
                [sys.executable, "-m", "backend.evaluate", "--video", str(video), "--mode", "presentation"],
                capture_output=True, text=True,
            )
            self.assertEqual(unlabeled.returncode, 0, unlabeled.stderr)
            performance = json.loads(unlabeled.stdout)
            self.assertEqual(performance["unavailable"], 5)
            self.assertNotIn("precision", performance)
            self.assertNotIn("false_warnings_per_normal_minute", performance)
