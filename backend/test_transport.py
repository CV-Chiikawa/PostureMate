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


def multipart_frame():
    image = Image.new("RGB", (320, 180), (15, 120, 200))
    output = io.BytesIO()
    image.save(output, format="JPEG", quality=80)
    jpeg = output.getvalue()
    boundary = uuid.uuid4().hex
    parts = []
    for name, value in {"session_id": "test-session-001", "mode": "interview", "rubric": "A"}.items():
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
    body, boundary, jpeg_size = multipart_frame()
    request = urllib.request.Request(
        f"{BASE_URL}/process-frame",
        data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        method="POST",
    )
    frame_status, receipt = request_json(request)
    assert frame_status == 200
    assert receipt["frame_received"] is True
    assert receipt["session_id"] == "test-session-001"
    assert (receipt["width"], receipt["height"], receipt["byte_size"]) == (320, 180, jpeg_size)
    assert (receipt["mode"], receipt["rubric"]) == ("interview", "A")
    print("GET /health:", health_status, health)
    print("POST /process-frame:", frame_status, receipt)
