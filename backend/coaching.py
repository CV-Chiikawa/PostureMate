"""Event-scoped coaching. Frame handlers schedule work but never await Solar."""
import asyncio
import json
import logging
import os
from dataclasses import dataclass, field

import httpx


SOLAR_URL = "https://api.upstage.ai/v1/chat/completions"
TIMEOUT = 5.0
COOLDOWN = 30.0
FALLBACK = "고개가 기준 자세보다 앞으로 나왔어요. 처음 편안하게 앉았던 위치로 돌아와 보세요."
SYSTEM_PROMPT = (
    "당신은 한국어 자세 연습 코치입니다. 아래 JSON은 거북목 연습 데모의 관찰값입니다. "
    "관찰한 변화와 지금 할 수 있는 조정 한 가지를 두 문장 이내의 존댓말로 알려주세요. "
    "비율을 각도나 실제 거리로 바꾸지 말고, 질병 진단이나 제공되지 않은 사실은 말하지 마세요."
)
logger = logging.getLogger(__name__)


async def solar_message(client, key, event, deadline):
    """Return only a timely, usable message; the fixed hint is already on screen."""
    facts = {k: event[k] for k in ("mode", "rubric", "type", "severity", "duration_sec", "metrics")}
    try:
        async with asyncio.timeout_at(deadline):
            response = await client.post(SOLAR_URL, headers={"Authorization": f"Bearer {key}"},
                json={"model": "solar-pro4", "stream": False, "max_tokens": 160,
                      "messages": [{"role": "system", "content": SYSTEM_PROMPT},
                                   {"role": "user", "content": json.dumps(facts, ensure_ascii=False)}]})
            response.raise_for_status()
            choice = response.json()["choices"][0]
            text = choice["message"]["content"]
            if (choice.get("finish_reason") not in (None, "stop") or not isinstance(text, str)
                    or not text.strip() or asyncio.get_running_loop().time() >= deadline):
                return None
            return text.strip()
    except (TimeoutError, httpx.HTTPError, ValueError, LookupError, TypeError, AttributeError) as exc:
        # Never log Authorization, prompt, response body, or session identifiers.
        logger.warning("Solar coaching unavailable: %s", type(exc).__name__)
        return None


@dataclass
class Coaching:
    event_id: str | None = None
    severity: str | None = None
    task: asyncio.Task | None = None
    last_call: dict = field(default_factory=dict)

    def invalidate(self):
        if self.task is not None:
            self.task.cancel()
        self.event_id = self.severity = self.task = None

    def frame(self, client, mode, state, event):
        if mode != "neck" or state not in ("CAUTION", "WARNING"):
            self.invalidate()
            return None

        if self.severity != state or (event and self.event_id != event["event_id"]):
            self.invalidate()
            if event is None:
                return None
            self.event_id = event["event_id"]
            self.severity = state
            bucket = (event["type"], event["severity"])
            now = asyncio.get_running_loop().time()
            key = os.getenv("UPSTAGE_API_KEY")
            if key and now - self.last_call.get(bucket, -float("inf")) >= COOLDOWN:
                self.last_call[bucket] = now
                self.task = asyncio.create_task(solar_message(client, key, event, now + TIMEOUT))
            return {"event_id": self.event_id, "source": "fallback", "message": FALLBACK}

        if self.task is not None and self.task.done():
            task, self.task = self.task, None
            if not task.cancelled() and (message := task.result()):
                return {"event_id": self.event_id, "source": "solar", "message": message}
        return None
