"""Check a running local FastAPI with synthetic frames; no camera or client-side key."""
import argparse
import time
import urllib.request
import uuid

from backend.test_transport import BASE_URL, multipart_frame, request_json


def run(expect_fallback=False):
    session_id = f"smoke-{uuid.uuid4().hex}"
    body, boundary, _ = multipart_frame(session_id, "neck", "")
    request = urllib.request.Request(f"{BASE_URL}/process-frame", data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"}, method="POST")
    active = None
    received_solar = False
    for _ in range(90):
        _, packet = request_json(request)
        assert packet["analysis_source"] == "demo" and packet["session_id"] == session_id
        if packet["event"]:
            active = packet["event"]["event_id"]
            assert packet["coaching"]["source"] == "fallback"
            print(packet["state"], "immediate fallback")
        if packet["coaching"]:
            coaching = packet["coaching"]
            assert coaching["event_id"] == active
            if coaching["source"] == "solar":
                assert not expect_fallback and packet["event"] is None
                received_solar = True
                print("SOLAR:", coaching["message"])
        if packet["state"] == "RECOVERED":
            assert active and packet["coaching"] is None
            if not received_solar and not expect_fallback:
                raise SystemExit("No Solar reply before recovery: check the server key, quota and five-second deadline.")
            print("PASS: recovered; no stale coaching")
            return
        time.sleep(0.2)
    raise SystemExit("The neck demo did not reach recovery")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--expect-fallback", action="store_true", help="Use with a server started without a key")
    run(parser.parse_args().expect_fallback)
