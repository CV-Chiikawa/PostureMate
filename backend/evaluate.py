"""Replay a constant-frame-rate video through the live rules or score saved intervals."""

import argparse
import json
import math
import time
from collections import Counter
from contextlib import ExitStack
from pathlib import Path
from uuid import uuid4

from backend.landmarker import Landmarker
from backend.pose import PoseSession


def overlap(a, b):
    return max(0, min(a["end"], b["end"]) - max(a["start"], b["start"]))


def score(truth, predictions, duration):
    if not math.isfinite(duration) or duration <= 0:
        raise ValueError("duration must be a positive number of seconds")
    for item in [*truth, *predictions]:
        if not item.get("type") or not 0 <= item["start"] < item["end"] <= duration + 0.000001:
            raise ValueError(f"Invalid interval: {item}")
    neighbors = []
    for p in predictions:
        options = []
        for i, t in enumerate(truth):
            common = overlap(t, p)
            union = t["end"] - t["start"] + p["end"] - p["start"] - common
            if t["type"] == p["type"] and common / union >= 0.30:
                options.append((common / union, i))
        neighbors.append([i for _, i in sorted(options, reverse=True)])
    matches = {}

    def assign(prediction, seen):
        for actual in neighbors[prediction]:
            if actual not in seen:
                seen.add(actual)
                if actual not in matches or assign(matches[actual], seen):
                    matches[actual] = prediction
                    return True
        return False

    for i in range(len(predictions)):
        assign(i, set())
    annotated = end = 0.0
    for item in sorted(truth, key=lambda t: t["start"]):
        annotated += max(0, item["end"] - max(end, item["start"]))
        end = max(end, item["end"])
    normal_minutes = (duration - annotated) / 60
    false_warnings = 0
    for item in predictions:
        when = item.get("warning_at", item["start"])
        if when is not None and not any(t["start"] <= when < t["end"] for t in truth):
            false_warnings += 1
    tp = Counter(truth[i]["type"] for i in matches)
    actual = Counter(t["type"] for t in truth)
    predicted = Counter(p["type"] for p in predictions)

    def counts(hits, labeled, found):
        return {
            "tp": hits,
            "fp": found - hits,
            "fn": labeled - hits,
            "precision": hits / found if found else None,
            "recall": hits / labeled if labeled else None,
        }

    return {
        **counts(len(matches), len(truth), len(predictions)),
        "by_type": {
            k: counts(tp[k], actual[k], predicted[k]) for k in sorted(actual.keys() | predicted.keys())
        },
        "normal_minutes": normal_minutes,
        "false_warnings_per_normal_minute": false_warnings / normal_minutes if normal_minutes > 0 else None,
    }


def replay(path, mode, rubric, endpoint):
    import cv2
    import httpx

    with ExitStack() as resources:
        video = cv2.VideoCapture(str(path))
        resources.callback(video.release)
        fps = video.get(cv2.CAP_PROP_FPS)
        if not video.isOpened() or not math.isfinite(fps) or fps <= 0:
            raise ValueError("Could not open video with a valid frame rate")
        detector = Landmarker()
        resources.callback(detector.close)
        engine = PoseSession()
        http = resources.enter_context(httpx.Client(timeout=5)) if endpoint else None
        session = str(uuid4())
        started = time.perf_counter()
        frame_count = next_sample = 0
        delays, event_delays, intervals = [], [], []
        unavailable = 0
        current = None
        while True:
            ok, image = video.read()
            if not ok:
                break
            stamp = frame_count / fps
            frame_count += 1
            if stamp + 1e-8 < next_sample:
                continue
            next_sample = (math.floor(stamp * 5 + 1e-8) + 1) / 5
            if endpoint:
                time.sleep(max(0, started + stamp - time.perf_counter()))
                # Emulate the browser's in-flight skip when the server is slow.
                if time.perf_counter() - started - stamp >= 0.2:
                    continue
            before = time.perf_counter()
            ok, buf = cv2.imencode(".jpg", image, [cv2.IMWRITE_JPEG_QUALITY, 80])
            if not ok:
                raise ValueError("Could not encode video frame")
            jpeg = buf.tobytes()
            if http:
                response = http.post(
                    endpoint.rstrip("/") + "/process-frame",
                    data={"mode": mode, "rubric": rubric, "source": "mediapipe", "session_id": session},
                    files={"file": ("frame.jpg", jpeg, "image/jpeg")},
                )
                response.raise_for_status()
                result = response.json()
                if result["analysis_source"] != "mediapipe" or result["session_id"] != session:
                    raise ValueError("Expected live analysis for the replay session")
            else:
                height, width = image.shape[:2]
                result = engine.observe(detector.detect(jpeg, neck=mode == "neck"), width, height, mode, rubric, stamp)
            latency = time.perf_counter() - before
            delays.append(latency)
            if result.get("event"):
                event_delays.append(latency)
            unavailable += result["measurement_status"] == "unavailable"
            issue = result.get("active_issue")
            if not issue:
                current = None
                continue
            new_caution = result.get("event") is not None and result["state"] == "CAUTION"
            if current is None or current["type"] != issue or new_caution:
                current = {
                    "type": issue,
                    "start": max(0, stamp - result["issue_duration_sec"]),
                    "end": stamp,
                    "warning_at": None,
                }
                intervals.append(current)
            current["end"] = stamp + 0.2
            if result["state"] == "WARNING" and current["warning_at"] is None:
                current["warning_at"] = stamp
        duration = frame_count / fps
        for item in intervals:
            item["end"] = min(duration, item["end"])
        elapsed = time.perf_counter() - started
        if not delays:
            raise ValueError("Video yielded no sampled frames")
        return (
            duration,
            intervals,
            {
                "path": "http" if endpoint else "local",
                "frames": len(delays),
                "unavailable": unavailable,
                "processing_fps": len(delays) / (max(duration, elapsed) if endpoint else elapsed),
                "max_frame_latency_sec": max(delays),
                "max_event_latency_sec": max(event_delays) if event_delays else None,
            },
        )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--labels", type=Path, help="Human-labeled intervals for accuracy scoring")
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--video", type=Path)
    source.add_argument("--predictions", type=Path)
    parser.add_argument("--duration", type=float)
    parser.add_argument("--mode", choices=("neck", "interview", "presentation"))
    parser.add_argument("--rubric", choices=("A", "B"), default="")
    parser.add_argument("--endpoint", help="Explicitly transmit sampled JPEGs to this analysis server")
    args = parser.parse_args()
    truth = json.loads(args.labels.read_text(encoding="utf-8-sig")) if args.labels else None
    if args.video:
        if not args.mode or (args.mode == "interview") != bool(args.rubric):
            parser.error("Video requires --mode. Only interview requires --rubric A or B.")
        duration, predicted, performance = replay(args.video, args.mode, args.rubric, args.endpoint)
    else:
        if args.duration is None or truth is None:
            parser.error("Saved predictions require --labels and --duration in seconds")
        duration = args.duration
        predicted = json.loads(args.predictions.read_text(encoding="utf-8-sig"))
        performance = {}
    accuracy = score(truth, predicted, duration) if truth is not None else {}
    print(json.dumps({**accuracy, **performance, "predictions": predicted}, indent=2))


if __name__ == "__main__":
    main()
