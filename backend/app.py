"""Temporary local frame-receipt server; this does not analyze posture."""

import io
import os

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, UnidentifiedImageError


MAX_FRAME_BYTES = 5 * 1024 * 1024
MAX_FRAME_PIXELS = 16_000_000
DEFAULT_ORIGINS = "http://localhost:5173,http://127.0.0.1:5173"

app = FastAPI(title="Posture Coach Frame Transport Demo")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in os.getenv("FRAME_DEMO_CORS_ORIGINS", DEFAULT_ORIGINS).split(",") if origin.strip()],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


@app.get("/health")
def health():
    return {"ok": True, "service": "frame-receipt-demo"}


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

    return {
        "ok": True,
        "session_id": session_id,
        "frame_received": True,
        "width": width,
        "height": height,
        "byte_size": len(content),
        "mode": mode,
        "rubric": rubric or None,
    }
