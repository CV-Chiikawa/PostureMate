"""Run against a live local server: python -m backend.test_transport."""

import io
import json
import urllib.request
import uuid

from PIL import Image


BASE_URL = "http://127.0.0.1:8000"


def request_json(request):
    with urllib.request.urlopen(request, timeout=5) as response:
        return response.status, json.load(response)


def multipart_frame(session_id="test-session-001", mode="interview", rubric="A"):
    image = Image.new("RGB", (320, 180), (15, 120, 200))
    output = io.BytesIO()
    image.save(output, format="JPEG", quality=80)
    jpeg = output.getvalue()
    boundary = uuid.uuid4().hex
    parts = []
    for name, value in {"session_id": session_id, "mode": mode, "rubric": rubric}.items():
        parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n'.encode())
    parts.append(
        f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="frame.jpg"\r\nContent-Type: image/jpeg\r\n\r\n'.encode()
        + jpeg + b"\r\n"
    )
    parts.append(f"--{boundary}--\r\n".encode())
    return b"".join(parts), boundary, len(jpeg)


if __name__ == "__main__":
    health_status, health = request_json(urllib.request.Request(f"{BASE_URL}/health"))
    assert health_status == 200 and health["ok"] is True
    session_id = f"test-{uuid.uuid4()}"
    for mode, rubric in [("interview", "A"), ("neck", ""), ("presentation", "")]:
        body, boundary, jpeg_size = multipart_frame(session_id, mode, rubric)
        request = urllib.request.Request(f"{BASE_URL}/process-frame", data=body,
            headers={"Content-Type": f"multipart/form-data; boundary={boundary}"}, method="POST")
        status, packet = request_json(request)
        assert status == 200 and packet["analysis_source"] == "mediapipe"
        assert packet["frame"] == {"received": True, "width": 320, "height": 180, "byte_size": jpeg_size}
        assert packet["context"] == {"mode": mode, "rubric": rubric or None}
        assert packet["measurement_status"] == "unavailable"
        assert all(packet[key] is None for key in ("state", "features", "event", "coaching"))
        print(mode, "JPEG received; no person detected")
