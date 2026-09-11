# 구현 계획

## 구조

```text
MockScenarioProvider → MockFeatureProvider → Context Evaluator
                                            ↓
                                  Temporal State Machine
                                            ↓
                         Dashboard / Coaching / Log / Summary
```

`config`는 모드 설명과 평가 조건, `data`는 Scenario, `services`는 Provider, `utils`는 순수 판정 로직, `hooks`는 Webcam 생명주기, `components`는 UI를 담당한다.

## 단계

1. 한글 명세, 조사, 결정, 계획, Task와 복구 문서를 만든다.
2. Provider, Evaluator, Temporal Event 순수 로직을 구현한다.
3. 기존 Dashboard를 Posture Coach UI로 리팩터링하고 세션 흐름을 연결한다.
4. Webcam 장치 선택과 Preview를 연결한다.
5. README와 진행 문서를 갱신하고 lint, build, 핵심 로직 검증을 수행한다.
6. 작업 브랜치에 안정적인 최종 Commit을 남긴다.

## 검증 시나리오

- 같은 몸 흔들림 Scenario를 세 모드에서 평가해 결과 차이를 비교한다.
- 이상 Scenario를 유지해 CANDIDATE → CAUTION → WARNING을 확인한다.
- 정상 Scenario로 전환해 RECOVERED → COOLDOWN → NORMAL을 확인한다.
- Visibility 부족 Scenario에서 판정 불가와 Camera Guide를 확인한다.
- Interview Rubric A/B에서 손 위치 평가가 달라지는지 확인한다.
- Webcam 미지원·거부·장치 없음 분기와 Stream 정리 코드를 확인한다.
