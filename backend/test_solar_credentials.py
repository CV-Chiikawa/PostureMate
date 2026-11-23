import io
import os
import subprocess
import sys
import unittest
import uuid
from unittest.mock import patch

import httpx
from PIL import Image

from backend.app import app
from backend.test_pose import front


@unittest.skipUnless(sys.platform == "win32", "Windows Credential Manager")
class CredentialTests(unittest.IsolatedAsyncioTestCase):
    async def test_server_uses_saved_key_for_coaching_without_environment(self):
        import win32cred

        self.enterContext(patch.dict(os.environ))
        os.environ.pop("UPSTAGE_API_KEY", None)
        sample = "fixture-for-startup"
        read = self.enterContext(patch.object(win32cred, "CredRead", return_value={
            "CredentialBlob": sample.encode("utf-16-le")
        }))
        await self.enterAsyncContext(app.router.lifespan_context(app))
        self.assertEqual(read.call_count, 1, "Server startup must load its Windows credential")
        authorized = []

        def upstream(request):
            authorized.append(request.headers.get("Authorization") == "Bearer " + sample)
            return httpx.Response(200, json={"choices":[{"message":{"content":"무릎 사이를 조금 벌려 주세요."}}]})

        app.state.solar = await self.enterAsyncContext(httpx.AsyncClient(transport=httpx.MockTransport(upstream)))
        client = await self.enterAsyncContext(httpx.AsyncClient(transport=httpx.ASGITransport(app), base_url="http://local"))
        frame = io.BytesIO()
        Image.new("RGB", (320, 240)).save(frame, "JPEG")
        import asyncio
        self.enterContext(patch.object(app.state.detector, "detect", return_value=front()))
        self.enterContext(patch("backend.app.frame_time", side_effect=[i / 5 for i in range(24)]))
        for _ in range(24):
            packet = await client.post("/process-frame", data={"session_id":"test", "mode":"interview", "rubric":"B"},
                                       files={"file":("frame.jpg",frame.getvalue(),"image/jpeg")})
            self.assertEqual(packet.status_code, 200)
            await asyncio.sleep(0)
            if (packet.json().get("coaching") or {}).get("source") == "solar":
                break
        self.assertEqual(authorized, [True])
        self.assertEqual(packet.json()["coaching"]["source"], "solar")
        read.assert_called_once_with("PostureMate/Upstage", win32cred.CRED_TYPE_GENERIC)
        self.assertNotIn("UPSTAGE_API_KEY", os.environ)

    def test_registration_is_local_persistent_and_readable_from_fresh_process(self):
        import win32cred
        from backend import solar_credentials as credentials

        target = "PostureMate/Test/" + uuid.uuid4().hex
        with patch.object(credentials, "TARGET", target):
            credentials.save_key("test-fixture-only")
            self.addCleanup(win32cred.CredDelete, target, win32cred.CRED_TYPE_GENERIC)
            entry = win32cred.CredRead(target, win32cred.CRED_TYPE_GENERIC)
            self.assertEqual(entry["Persist"], win32cred.CRED_PERSIST_LOCAL_MACHINE)
            code = ("import sys; from backend import solar_credentials as c; c.TARGET=sys.argv[1]; "
                    "sys.exit(0 if c.read_saved_key() == 'test-fixture-only' else 1)")
            child = subprocess.run([sys.executable, "-c", code, target], capture_output=True)
            self.assertEqual(child.returncode, 0)
            with self.assertRaises(ValueError):
                credentials.save_key(" ")
            self.assertTrue(credentials.read_saved_key() == "test-fixture-only")
