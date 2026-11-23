"""Shared CPU pose/face detectors; session-specific history lives in PoseSession."""

import hashlib
import io
import os
from dataclasses import dataclass
from pathlib import Path

from PIL import Image
from backend.neckon import NeckObservation

MODEL = Path(__file__).with_name("models") / "pose_landmarker_lite.task"
MODEL_URL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task"
MODEL_SHA256 = "59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a"


MODEL_DIR = MODEL.parent
FULL = MODEL_DIR / "pose_landmarker_full.task"
FACE = MODEL_DIR / "blaze_face_short_range.tflite"
ASSETS = {
    MODEL: (MODEL_URL, MODEL_SHA256),
    FULL: ("https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task",
           "5134a3aad27a58b93da0088d431f366da362b44e3ccfbe3462b3827a839011b1"),
    FACE: ("https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
           "b4578f35940bf5a1a655214a1cce5cab13eba73c1297cd78e1a04c2380b0152f"),
}


def model_bytes(path):
    data = path.read_bytes()
    if hashlib.sha256(data).hexdigest() != ASSETS[path][1]:
        raise RuntimeError("Unexpected model checksum")
    return data


@dataclass(frozen=True)
class WorldPoint:
    y: float
    z: float


@dataclass(frozen=True)
class PosePoint:
    x: float
    y: float
    visibility: float
    presence: float
    world: WorldPoint
    z: float


class Landmarker:
    def __init__(self):
        self.engines = {}
        self.face = None

    def detect(self, jpeg, *, neck=False):
        import mediapipe as mp
        import numpy as np

        path = FULL if neck else MODEL
        if path not in self.engines:
            options = mp.tasks.vision.PoseLandmarkerOptions(
                base_options=mp.tasks.BaseOptions(model_asset_buffer=model_bytes(path)), num_poses=1
            )
            self.engines[path] = mp.tasks.vision.PoseLandmarker.create_from_options(options)
        if neck and self.face is None:
            options = mp.tasks.vision.FaceDetectorOptions(
                base_options=mp.tasks.BaseOptions(model_asset_buffer=model_bytes(FACE)))
            self.face = mp.tasks.vision.FaceDetector.create_from_options(options)
        with Image.open(io.BytesIO(jpeg)) as image:
            rgb = np.asarray(image.convert("RGB"))
        image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        result = self.engines[path].detect(image)
        if not result.pose_landmarks:
            return []
        points = [
            PosePoint(p.x, p.y, p.visibility, p.presence, WorldPoint(w.y, w.z), p.z)
            for p, w in zip(result.pose_landmarks[0], result.pose_world_landmarks[0], strict=True)
        ]

        if not neck:
            return points
        detections = self.face.detect(image).detections
        if not detections:
            return NeckObservation(points)
        face = max(detections, key=lambda f: f.bounding_box.width * f.bounding_box.height)
        nose = face.keypoints[2] if face.keypoints and len(face.keypoints) > 2 else None
        return NeckObservation(points, face.bounding_box.width / image.width,
                               (nose.x, nose.y) if nose else None)

    def close(self):
        for engine in self.engines.values():
            engine.close()
        self.engines.clear()
        if self.face:
            self.face.close()
            self.face = None


def install_asset(path, url, checksum):
    from tempfile import NamedTemporaryFile
    from urllib.request import urlopen

    path.parent.mkdir(exist_ok=True)
    if path.exists() and hashlib.sha256(path.read_bytes()).hexdigest() == checksum:
        return
    with urlopen(url, timeout=60) as response:
        data = response.read(25_000_000)
    if hashlib.sha256(data).hexdigest() != checksum:
        raise ValueError("Downloaded model checksum mismatch")
    with NamedTemporaryFile(dir=path.parent, delete=False) as tmp:
        tmp.write(data)
    try:
        os.replace(tmp.name, path)
    finally:
        Path(tmp.name).unlink(missing_ok=True)


if __name__ == "__main__":
    for path, (url, checksum) in ASSETS.items():
        install_asset(path, url, checksum)
        print(path)
