"""Event-scoped coaching. Frame handlers schedule work but never await Solar."""
import asyncio
import json
import logging
import os
import re
import unicodedata
from dataclasses import dataclass, field

import httpx


SOLAR_URL = "https://api.upstage.ai/v1/chat/completions"
TIMEOUT = 5.0
COOLDOWN = 30.0
SYSTEM_PROMPT = (
    "사용자가 연습을 이어가면서 바로 해볼 행동 하나를 안내하세요. 화면에 이미 나온 관찰은 반복하지 마세요. "
    "관찰과 metrics에서 가장 관련 있는 신체 부위 하나를 골라, 그 부위를 움직일 방향이나 스스로 확인할 위치를 짚으세요. "
    "서로 다른 동작을 나열하거나 여러 부위에 힘을 주고 고정하도록 지시하지 마세요. "
    "severity와 duration_sec를 함께 고려하세요. 방금 감지된 주의에는 작은 조정을, "
    "같은 변화가 지속된 경고에는 자세를 다시 잡을 수 있는 단서를 주세요. 단계 이름이나 경과 시간은 낭독하지 말고 동작부터 안내하세요. "
    "감지되지 않은 문제, 좌우 방향, 주변 사물이나 수치 목표를 추측하지 마세요. "
    "한국어 존댓말로 ‘~세요’로 끝나는 짧은 한 문장만 답하세요."
)
MODE_CONTEXT = {
    "neck": "개인 기준 자세와 비교하는 거북목 연습",
    "interview": "앉아서 답변하는 모의면접. 손 위치는 선택한 rubric을 따릅니다(A: 무릎 가운데, B: 각 손과 같은 쪽 무릎).",
    "presentation": "서서 말하는 발표 연습. 자연스러운 이동은 허용합니다.",
}
REFERENCE_POINTS = {
    "head_forward": "귀와 어깨의 앞뒤 위치",
    "head_lower": "눈높이와 시선",
    "head_tilt": "양쪽 귀의 높이",
    "head_offset": "코와 양쪽 어깨의 중앙선",
    "face_size": "기준 구도에서 보였던 얼굴과 어깨의 상대 크기",
    "neck_angle": "귀와 같은 쪽 어깨의 위치",
    "shoulder_height_difference": "양쪽 어깨 끝의 높이",
    "torso_lean": "어깨 중심과 골반 중심",
    "body_sway": "몸무게가 양발에 실리는 감각",
    "knees_apart": "양쪽 무릎 안쪽의 간격",
    "knees_close": "각 발과 같은 쪽 무릎의 위치",
    "hands_off_center": "두 무릎 사이의 중간점과 손목 위치",
    "hands_apart": "무릎 가운데에서 양손 사이의 간격",
    "hands_off_knees": "각 손목과 같은 쪽 무릎의 위치",
}
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
    "hands_apart": ("양손이 서로 떨어져 있습니다.", "무릎 가운데에서 두 손을 조금 모아 주세요."),
    "hands_off_center": ("손이 양쪽 무릎 가운데에 모여 있지 않습니다.", "두 손을 무릎 가운데에 모아 주세요."),
    "knees_close": ("양쪽 무릎이 가까이 붙어 있습니다.", "무릎 사이를 조금 벌려 주세요."),
    "hands_off_knees": ("손이 같은 쪽 무릎 위에 놓여 있지 않습니다.", "양손을 각각 같은 쪽 무릎 위에 올려 주세요."),
}


def feedback_for(event):
    issue = event["metrics"].get("observation") or event["type"]
    return FEEDBACK.get(issue, ("자세가 기준 범위를 벗어났습니다.", "처음 자세로 돌아와 주세요."))


def fixed_hint(event):
    return " ".join(feedback_for(event))


def action_key(text):
    compact = re.sub(r"[\W_]+", "", unicodedata.normalize("NFKC", text))
    core = re.sub(r"가볍게|살짝|조금|천천히|부드럽게|(?:주세요|보세요|주십시오|보십시오)$", "", compact)
    # A generic goal adds no practical cue to an otherwise identical movement.
    return re.sub(r"(?:머리를|고개를|몸을|상체를)?(?:기준|바른|원래)자세(?:에맞춰|로돌아가|로돌아와|를유지해)$", "", core)


async def solar_message(client, key, event, deadline):
    """Return only a timely, usable message; the fixed hint is already on screen."""
    facts = {k: event[k] for k in ("mode", "rubric", "type", "severity", "duration_sec", "metrics")}
    observation, default_action = feedback_for(event)
    issue = event["metrics"].get("observation") or event["type"]
    reference = REFERENCE_POINTS.get(issue, "개인 기준 자세와 현재 감지된 부위의 위치")
    prompt = (f"{SYSTEM_PROMPT}\n연습 상황: {MODE_CONTEXT[event['mode']]}\n화면의 관찰: {observation}"
              f"\n사용자가 직접 확인할 단서: {reference}. 이 단서를 동작 속에 자연스럽게 담으세요.")
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
                logger.warning("Solar coaching unavailable: incomplete_response")
                return None
            advice = text.strip()
            sentence = advice.removesuffix(".")
            if (len(advice) > 100 or not sentence.endswith(("세요", "십시오"))
                    or any(mark in sentence for mark in ".!?\n")):
                logger.warning("Solar coaching unavailable: invalid_advice_format")
                return None
            if action_key(sentence) == action_key(default_action):
                return None
            return f"{observation} {sentence}."
    except httpx.HTTPStatusError as exc:
        logger.warning("Solar coaching unavailable: HTTP %s", exc.response.status_code)
        return None
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
            bucket = (event["mode"], event["rubric"], event["type"],
                      event["metrics"].get("observation"), event["severity"])
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
