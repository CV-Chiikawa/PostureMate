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


def multipart_frame(session_id="test-session-001"):
    image = Image.new("RGB", (320, 180), (15, 120, 200))
    output = io.BytesIO()
    image.save(output, format="JPEG", quality=80)
    jpeg = output.getvalue()
    boundary = uuid.uuid4().hex
    parts = []
    for name, value in {"session_id": session_id, "mode": "interview", "rubric": "A"}.items():
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
    receipts = []
    jpeg_size = None
    for _ in range(31):
        body, boundary, jpeg_size = multipart_frame(session_id)
        request = urllib.request.Request(
            f"{BASE_URL}/process-frame",
            data=body,
            headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
            method="POST",
        )
        frame_status, receipt = request_json(request)
        assert frame_status == 200
        receipts.append(receipt)

    receipt = receipts[0]
    assert receipt["analysis_source"] == "demo"
    assert receipt["frame"]["received"] is True
    assert receipt["session_id"] == session_id
    assert (receipt["frame"]["width"], receipt["frame"]["height"], receipt["frame"]["byte_size"]) == (320, 180, jpeg_size)
    assert (receipt["context"]["mode"], receipt["context"]["rubric"]) == ("interview", "A")
    assert set(receipt["features"]) == {
        "head_tilt", "shoulder_height_difference", "torso_lean",
        "forward_head_proxy", "body_sway", "landmark_visibility",
    }
    assert receipt["event"] is None
    assert {item["state"] for item in receipts} == {"NORMAL", "CAUTION", "WARNING", "RECOVERED"}
    warning_event = next(item["event"] for item in receipts if item["event"] is not None)
    assert warning_event["type"] == "forward_lean"
    assert warning_event["severity"] == "warning"
    assert warning_event["mode"] == "interview"
    assert warning_event["rubric"] == "A"
    assert isinstance(warning_event["metrics"]["torso_lean_deg"], (int, float))
    assert receipts[-1]["state"] == "RECOVERED" and receipts[-1]["event"] is None
    print("GET /health:", health_status, health)
    print("POST /process-frame states:", [item["state"] for item in receipts])
    print("Demo event:", warning_event)
