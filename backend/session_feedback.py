"""Generate a retrospective from bounded session statistics."""
import asyncio
import json
import logging
import re
from typing import Annotated, Literal

import httpx
from pydantic import BaseModel, ConfigDict, Field, model_validator

from backend.coaching import FEEDBACK, MODE_CONTEXT, REFERENCE_POINTS, SOLAR_URL

Count = Annotated[int, Field(ge=0, le=1_000_000)]
Seconds = Annotated[float, Field(ge=0, allow_inf_nan=False)]
Issue = Literal["forward_head_proxy", "forward_lean", "torso_lean", "head_tilt",
                "shoulder_height_difference", "body_sway", "hand_placement"]


class IssueTotals(BaseModel):
    model_config = ConfigDict(extra="forbid")
    episodes: Count
    seconds: Seconds


class SessionFacts(BaseModel):
    model_config = ConfigDict(extra="forbid")
    mode: Literal["neck", "interview", "presentation"]
    rubric: Literal["A", "B"] | None
    elapsed_seconds: Seconds
    measured_seconds: Seconds
    caution: Count
    warning: Count
    recovered: Count
    issues: dict[Issue, IssueTotals]
    observations: dict[str, Count] = Field(max_length=len(FEEDBACK))

    @model_validator(mode="after")
    def check_context(self):
        if (self.mode == "interview") != (self.rubric is not None):
            raise ValueError("Invalid rubric for mode")
        if self.observations.keys() - FEEDBACK.keys():
            raise ValueError("Unknown observation")
        if self.measured_seconds > self.elapsed_seconds + 1:
            raise ValueError("Invalid measured duration")
        return self


async def session_feedback(client, key, facts):
    if facts.measured_seconds < 3:
        return {"source": "insufficient"}
    if not key:
        return {"source": "fallback"}
    evidence = facts.model_dump(exclude={"observations"})
    evidence["observed_postures"] = [
        {"observation": FEEDBACK[name][0], "reference": REFERENCE_POINTS[name]}
        for name, count in sorted(facts.observations.items(), key=lambda item: -item[1]) if count
    ]
    prompt = (
        f"방금 마친 {MODE_CONTEXT[facts.mode]}의 자세 코치입니다. "
        "세션 집계만 보고 한국어 존댓말로 2~3문장의 짧은 단락을 쓰세요. "
        "먼저 관찰된 자세를 일상어로 설명하고 반복 횟수나 누적 시간 중 의미 있는 수치를 하나만 자연스럽게 짚으세요. "
        "문제 반복 횟수는 issues의 episodes만 사용하세요. seconds는 여러 구간을 합한 시간입니다. "
        "주의·경고 알림을 반복 횟수에 합산하거나 화면의 모든 통계를 다시 읽지 마세요. "
        "recovered가 양수면 기준 자세로 돌아온 점을 짚으세요. "
        "마지막 문장은 해당 자세의 reference를 이용해 다음 연습 때 바로 해볼 행동 하나를 ‘~세요’로 제안하세요. "
        "스트레칭, 통증이나 근육 감각을 지시하지 마세요. "
        "문제가 기록되지 않았다면 측정된 동안의 안정적인 점과 유지할 행동을 말하세요. "
        "측정되지 않은 동안의 자세, 변화의 순서나 원인, 신체 질환을 추측하지 마세요. 제목·목록·영어 코드명은 생략하세요."
    )
    try:
        async with asyncio.timeout(15):
            response = await client.post(
                SOLAR_URL, headers={"Authorization": f"Bearer {key}"}, timeout=15,
                json={"model": "solar-pro4", "stream": False, "max_tokens": 350, "messages": [
                    {"role": "system", "content": prompt},
                    {"role": "user", "content": json.dumps(evidence, ensure_ascii=False)},
                ]},
            )
            response.raise_for_status()
            choice = response.json()["choices"][0]
            message = choice["message"]["content"]
            if (choice.get("finish_reason") in (None, "stop") and isinstance(message, str)
                    and 0 < len(message.strip()) <= 600 and re.search("[가-힣]", message)):
                return {"source": "solar", "message": message.strip()}
    except (TimeoutError, httpx.HTTPError, ValueError, LookupError, TypeError, AttributeError) as exc:
        logging.getLogger(__name__).warning("Solar session feedback unavailable: %s", type(exc).__name__)
    return {"source": "fallback"}
