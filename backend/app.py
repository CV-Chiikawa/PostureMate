"""Temporary local transport server with deterministic demo analysis fixtures."""

import io
import os
from collections import defaultdict
from threading import Lock

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, UnidentifiedImageError


MAX_FRAME_BYTES = 5 * 1024 * 1024
MAX_FRAME_PIXELS = 16_000_000
DEFAULT_ORIGINS = "http://localhost:5173,http://127.0.0.1:5173"
DEMO_PHASE_FRAMES = 10
DEMO_STATES = ("NORMAL", "CAUTION", "WARNING", "RECOVERED")
_session_frame_counts = defaultdict(int)
_session_frame_counts_lock = Lock()

DEMO_FEATURES = {
    "NORMAL": {
        "head_tilt": 2.4,
        "shoulder_height_difference": 0.03,
        "torso_lean": 4.8,
        "forward_head_proxy": 0.05,
        "body_sway": 0.07,
        "landmark_visibility": 0.96,
    },
    "CAUTION": {
        "head_tilt": 3.0,
        "shoulder_height_difference": 0.05,
        "torso_lean": 8.4,
        "forward_head_proxy": 0.07,
        "body_sway": 0.09,
        "landmark_visibility": 0.95,
    },
    "WARNING": {
        "head_tilt": 3.1,
        "shoulder_height_difference": 0.06,
        "torso_lean": 9.2,
        "forward_head_proxy": 0.08,
        "body_sway": 0.11,
        "landmark_visibility": 0.93,
    },
    "RECOVERED": {
        "head_tilt": 1.7,
        "shoulder_height_difference": 0.02,
        "torso_lean": 3.0,
        "forward_head_proxy": 0.04,
        "body_sway": 0.04,
        "landmark_visibility": 0.96,
    },
}

app = FastAPI(title="Posture Coach Frame Transport Demo")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in os.getenv("FRAME_DEMO_CORS_ORIGINS", DEFAULT_ORIGINS).split(",") if origin.strip()],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


@app.get("/health")
def health():
    return {"ok": True, "service": "remote-analysis-demo", "analysis_source": "demo"}


def demo_analysis(session_id: str, mode: str, rubric: str):
    """Return a deterministic sequence for contract/UI testing, never CV output."""
    with _session_frame_counts_lock:
        frame_index = _session_frame_counts[session_id]
        _session_frame_counts[session_id] += 1

    sequence_index = frame_index % (len(DEMO_STATES) * DEMO_PHASE_FRAMES)
    state = DEMO_STATES[sequence_index // DEMO_PHASE_FRAMES]
    event = None
    if state == "WARNING" and sequence_index % DEMO_PHASE_FRAMES == 0:
        event = {
            "event_id": f"demo:{session_id}:warning:{frame_index}",
            "mode": mode,
            "rubric": rubric or None,
            "type": "forward_lean",
            "severity": "warning",
            "started_at": round(frame_index / 5, 1),
            "duration_sec": 2.0,
            "confidence": 0.91,
            "metrics": {"torso_lean_deg": 9.2},
        }
    return state, dict(DEMO_FEATURES[state]), event


@app.post("/process-frame")
async def process_frame(
    file: UploadFile = File(...),
    session_id: str = Form(...),
    mode: str = Form(...),
    rubric: str = Form(""),
):
    if file.content_type != "image/jpeg":
        raise HTTPException(status_code=415, detail="JPEG frames only")
    if not session_id.strip() or not mode.strip():
        raise HTTPException(status_code=422, detail="session_id and mode are required")

    content = await file.read(MAX_FRAME_BYTES + 1)
    if not content:
        raise HTTPException(status_code=400, detail="Empty frame")
    if len(content) > MAX_FRAME_BYTES:
        raise HTTPException(status_code=413, detail="Frame too large")

    try:
        with Image.open(io.BytesIO(content)) as image:
            if image.format != "JPEG":
                raise HTTPException(status_code=415, detail="JPEG frames only")
            width, height = image.size
            if width * height > MAX_FRAME_PIXELS:
                raise HTTPException(status_code=413, detail="Frame dimensions too large")
            image.verify()
    except (UnidentifiedImageError, OSError, ValueError) as error:
        raise HTTPException(status_code=400, detail="Invalid JPEG frame") from error

    state, features, event = demo_analysis(session_id, mode, rubric)
    return {
        "ok": True,
        "session_id": session_id,
        "analysis_source": "demo",
        "frame": {
            "received": True,
            "width": width,
            "height": height,
            "byte_size": len(content),
        },
        "context": {"mode": mode, "rubric": rubric or None},
        "features": features,
        "state": state,
        "event": event,
    }
