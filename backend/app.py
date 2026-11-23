"""Session-scoped live posture analysis."""

import asyncio
import io
import os
from time import monotonic as frame_time
from collections import OrderedDict
from contextlib import asynccontextmanager
from dataclasses import dataclass, field

import httpx
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, UnidentifiedImageError

from backend.coaching import Coaching
from backend.landmarker import Landmarker
from backend.pose import PoseSession
from backend.solar_credentials import read_saved_key

MAX_FRAME_BYTES = 5 * 1024 * 1024
MAX_FRAME_PIXELS = 16_000_000
DEFAULT_ORIGINS = "http://localhost:5173,http://127.0.0.1:5173"
MAX_SESSIONS = 128
SESSION_IDLE_SECONDS = 300


@dataclass
class Session:
    segment: str = ""
    pose: PoseSession = field(default_factory=PoseSession)
    context: tuple = ()
    last_seen: float = 0
    coaching: Coaching = field(default_factory=Coaching)


def get_session(sessions, session_id):
    now = asyncio.get_running_loop().time()
    # Ordered by last use: expired sessions must not retain tasks or replay old results.
    while sessions and next(iter(sessions.values())).last_seen <= now - SESSION_IDLE_SECONDS:
        sessions.popitem(last=False)[1].coaching.invalidate()
    if session_id not in sessions and len(sessions) >= MAX_SESSIONS:
        sessions.popitem(last=False)[1].coaching.invalidate()
    if session_id not in sessions:
        sessions[session_id] = Session()
    session = sessions[session_id]
    sessions.move_to_end(session_id)
    session.last_seen = now
    return session


@asynccontextmanager
async def lifespan(app):
    app.state.sessions = OrderedDict()
    app.state.saved_solar_key = read_saved_key() if "UPSTAGE_API_KEY" not in os.environ else None
    app.state.detector = Landmarker()
    app.state.inference_lock = asyncio.Lock()
    async with httpx.AsyncClient() as client:
        app.state.solar = client
        try:
            yield
        finally:
            tasks = [s.coaching.task for s in app.state.sessions.values() if s.coaching.task]
            for session in app.state.sessions.values():
                session.coaching.invalidate()
            await asyncio.gather(*tasks, return_exceptions=True)
            app.state.sessions.clear()
            app.state.saved_solar_key = None
            app.state.detector.close()


app = FastAPI(title="PostureMate", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in os.getenv("FRAME_DEMO_CORS_ORIGINS", DEFAULT_ORIGINS).split(",") if origin.strip()],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


@app.get("/health")
def health():
    return {"ok": True, "service": "posturemate", "analysis_source": "mediapipe", "sources": ["mediapipe"]}


@app.post("/process-frame")
async def process_frame(
    request: Request,
    file: UploadFile = File(...),
    session_id: str = Form(...),
    mode: str = Form(...),
    rubric: str = Form(""),
    source: str = Form("mediapipe"),
    segment: str = Form(""),
):
    if file.content_type != "image/jpeg":
        raise HTTPException(status_code=415, detail="JPEG frames only")
    if not session_id.strip() or not mode.strip():
        raise HTTPException(status_code=422, detail="session_id and mode are required")
    if source != "mediapipe":
        raise HTTPException(status_code=422, detail="Unknown analysis source")
    if not (
        (mode == "interview" and rubric in {"A", "B"}) or (mode in {"neck", "presentation"} and not rubric)
    ):
        raise HTTPException(status_code=422, detail="Invalid mode or rubric")

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

    sampled_at = frame_time()
    async with request.app.state.inference_lock:
        try:
            points = await asyncio.to_thread(request.app.state.detector.detect, content, neck=mode == "neck")
        except (ImportError, FileNotFoundError, RuntimeError) as error:
            raise HTTPException(503, "Pose model unavailable") from error
        except (OSError, ValueError) as error:
            raise HTTPException(400, "Unreadable JPEG frame") from error
        session = get_session(request.app.state.sessions, session_id)
        if session.context != (mode, rubric):
            session.coaching.invalidate()
            session.pose = PoseSession()
            session.context = (mode, rubric)
        if session.segment != segment:
            session.pose.interrupt()
            session.coaching.invalidate()
            session.segment = segment
        analysis = session.pose.observe(points, width, height, mode, rubric, sampled_at)
    coaching = session.coaching.frame(request.app.state.solar, analysis["state"], analysis["event"],
                                      saved_key=request.app.state.saved_solar_key)
    return {
        "ok": True,
        "session_id": session_id,
        "analysis_source": source,
        "frame": {
            "received": True,
            "width": width,
            "height": height,
            "byte_size": len(content),
        },
        "context": {"mode": mode, "rubric": rubric or None},
        **analysis,
        "coaching": coaching,
    }
