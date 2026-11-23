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
SYSTEM_PROMPT = (
    "자세 연습 화면에 관찰 문장이 이미 표시됩니다. 이 관찰에 맞는 행동 하나만 ‘~세요’로 끝나는 짧은 한 문장으로 쓰세요. "
    "관찰을 되풀이하거나 새로운 자세 문제, 거리, 각도, 진단을 추가하지 마세요."
)
logger = logging.getLogger(__name__)

FEEDBACK = {
    "head_forward": ("머리가 기준 자세보다 앞으로 나와 있습니다.", "턱을 가볍게 당겨 주세요."),
    "head_lower": ("머리가 기준 자세보다 낮아졌습니다.", "고개를 처음 높이로 들어 주세요."),
    "head_tilt": ("고개가 한쪽으로 기울어져 있습니다.", "고개를 천천히 바로 세워 주세요."),
    "head_offset": ("머리가 어깨 중앙에서 한쪽으로 치우쳐 있습니다.", "머리를 양쪽 어깨 사이로 옮겨 주세요."),
    "face_size": ("화면에서 얼굴이 어깨에 비해 더 크게 보입니다.", "처음 앉았던 위치를 확인해 주세요."),
    "neck_angle": ("귀와 어깨를 잇는 선이 기준 자세보다 기울어졌습니다.", "고개를 처음 위치로 돌려 주세요."),
    "shoulder_height_difference": ("한쪽 어깨가 다른 쪽보다 높습니다.", "올라간 어깨에 힘을 빼 주세요."),
    "torso_lean": ("상체가 기울어져 있습니다.", "허리를 편안하게 세워 주세요."),
    "body_sway": ("상체가 좌우로 흔들리고 있습니다.", "몸의 중심을 잠시 잡아 주세요."),
    "knees_apart": ("무릎 사이가 벌어져 있습니다.", "양쪽 무릎을 조금 모아 주세요."),
    "hands_off_center": ("손이 양쪽 무릎 가운데에 모여 있지 않습니다.", "두 손을 무릎 가운데에 모아 주세요."),
    "knees_close": ("양쪽 무릎이 가까이 붙어 있습니다.", "무릎 사이를 조금 벌려 주세요."),
    "hands_off_knees": ("손이 같은 쪽 무릎 위에 놓여 있지 않습니다.", "양손을 각각 같은 쪽 무릎 위에 올려 주세요."),
}


def feedback_for(event):
    issue = event["metrics"].get("observation") or event["type"]
    return FEEDBACK.get(issue, ("자세가 기준 범위를 벗어났습니다.", "처음 자세로 돌아와 주세요."))


def fixed_hint(event):
    return " ".join(feedback_for(event))


async def solar_message(client, key, event, deadline):
    """Return only a timely, usable message; the fixed hint is already on screen."""
    facts = {k: event[k] for k in ("mode", "rubric", "type", "severity", "duration_sec", "metrics")}
    observation, action = feedback_for(event)
    prompt = f"{SYSTEM_PROMPT}\n화면의 관찰 문장: {observation}\n권장 행동 예시: {action}"
    try:
        async with asyncio.timeout_at(deadline):
            response = await client.post(SOLAR_URL, headers={"Authorization": f"Bearer {key}"},
                json={"model": "solar-pro4", "stream": False, "max_tokens": 160,
                      "messages": [{"role": "system", "content": prompt},
                                   {"role": "user", "content": json.dumps(facts, ensure_ascii=False)}]})
            response.raise_for_status()
            choice = response.json()["choices"][0]
            text = choice["message"]["content"]
            if (choice.get("finish_reason") not in (None, "stop") or not isinstance(text, str)
                    or not text.strip() or asyncio.get_running_loop().time() >= deadline):
                return None
            advice = text.strip()
            sentence = advice.removesuffix(".")
            if (len(advice) > 100 or not sentence.endswith(("세요", "십시오"))
                    or any(mark in sentence for mark in ".!?\n")):
                return None
            return f"{observation} {sentence}."
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

    def frame(self, client, state, event, saved_key=None):
        if state not in ("CAUTION", "WARNING"):
            self.invalidate()
            return None

        if self.severity != state or (event and self.event_id != event["event_id"]):
            self.invalidate()
            if event is None:
                return None
            self.event_id = event["event_id"]
            self.severity = state
            bucket = (event["mode"], event["rubric"], event["type"], event["severity"])
            now = asyncio.get_running_loop().time()
            key = os.getenv("UPSTAGE_API_KEY", saved_key)
            if key and now - self.last_call.get(bucket, -float("inf")) >= COOLDOWN:
                self.last_call[bucket] = now
                self.task = asyncio.create_task(solar_message(client, key, event, now + TIMEOUT))
            return {"event_id": self.event_id, "source": "fallback", "message": fixed_hint(event)}

        if self.task is not None and self.task.done():
            task, self.task = self.task, None
            if not task.cancelled() and (message := task.result()):
                return {"event_id": self.event_id, "source": "solar", "message": message}
        return None
