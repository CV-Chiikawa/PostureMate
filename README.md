# Context-Aware AI Posture Coach — Web Demo

사용 상황에 따라 자세 평가 기준을 다르게 적용하고, 문제 자세가 일정 시간 지속될 때 상태 변화와 교정 피드백을 보여주는 React 기반 선행 웹 데모입니다.

이 저장소는 최종 팀 프로젝트 전체를 구현한 것이 아니라 UI/UX, Context-Aware Evaluator, Temporal Event, Webcam 사용자 흐름을 팀 개발 전에 검증하기 위한 프로토타입입니다.

## 실행 방법

```bash
npm install
npm run dev
```

Production Build 확인:

```bash
npm run lint
npm run build
npm run preview
```

Webcam은 브라우저 보안 정책상 localhost 또는 HTTPS 환경에서 동작합니다.

## 주요 기능

- 모의면접, 거북목 방지, 발표 Mode 선택
- 모의면접 Rubric A/B 선택
- Mode별 카메라 구도 안내
- Mock Camera와 실제 Webcam Preview 전환
- Camera Permission, Device Enumeration, Device Selector, 오류와 Stream 정리
- Shared Pose Feature와 Context Evaluator 분리
- NORMAL → CANDIDATE → CAUTION → WARNING → RECOVERED → COOLDOWN 상태 전환
- Landmark Visibility 부족 시 판정 중지와 Camera Guide 표시
- Mock Coaching, Event Log, Session Summary
- 동일 `body_sway` 값의 Mode별 평가 차이를 보여주는 Context 비교 Scenario

## Mode와 Rubric

- **모의면접:** 머리·어깨·상체·몸 흔들림을 비교적 엄격하게 평가합니다.
  - **Rubric A:** 무릎을 상대적으로 모으고 양손을 중앙 무릎 영역에 배치합니다.
  - **Rubric B:** 무릎을 자연스럽게 두고 양손을 각각 대응 무릎 영역에 배치합니다.
- **거북목 방지:** Forward Head Proxy와 목·상체의 기준 자세 대비 변화를 봅니다. 의료 진단을 제공하지 않습니다.
- **발표:** 자연스러운 이동 범위를 허용하고 지속적인 기울기와 반복 흔들림을 봅니다.

현재 Threshold와 지속시간은 과학적·의학적 확정값이 아닌 데모 후보값입니다.

## 실제 기능과 Mock 기능

### 실제로 동작하는 기능

- React UI와 상태 기반 사용자 흐름
- 브라우저 Webcam 권한 요청과 Camera Device 선택
- 실제 Camera Preview
- Session Start, Pause, Resume, End
- Context Evaluator와 Temporal State Machine
- Event Log와 Session Summary

### Mock으로 유지한 기능

- Pose Landmark와 Pose Feature 입력
- MediaPipe Pose/Hand/Face 추론
- 손·무릎의 실제 영상 판정
- CV Backend 분석
- SOLAR 자연어 코칭

LIVE CAMERA에서도 영상만 실제입니다. 분석 화면에는 항상 `LIVE VIDEO / MOCK ANALYSIS`, Landmark에는 `POSE OVERLAY — DEMO`, 코칭에는 `DEMO COACHING · MOCK PROVIDER / NOT SOLAR`를 표시합니다.

## 기술 스택

- React 19
- Vite 8
- Browser MediaDevices API
- JavaScript 기반 Provider / Evaluator / Temporal State Machine
- CSS 반응형 Dashboard

새 Backend나 Runtime Dependency가 없어 기존 Vercel 정적 배포 구조를 유지합니다.

## 디렉터리 구조

```text
src/
├─ components/  화면 구성 요소
├─ config/      Mode별 조건과 데모 시간 설정
├─ data/        Mock Scenario
├─ hooks/       Webcam Stream 생명주기
├─ services/    Mock Feature/Coaching Provider
└─ utils/       Context Evaluator와 Temporal State Machine

specs/001-posture-coach-demo/
├─ specification.md
├─ research.md
├─ decisions.md
├─ plan.md
└─ tasks.md
```

`AUTOPILOT_PROGRESS.md`에는 구현 단계와 마지막 검증·Checkpoint를 기록합니다.

## 알려진 제한사항

- Webcam Preview는 코드 경로와 UI 오류 처리를 구현했지만 Camera Device·권한 조합은 사용자 환경에서 수동 확인이 필요합니다.
- Live Video는 실제 Pose 분석에 사용되지 않습니다.
- Mock Threshold는 실제 사용자 영상으로 조정되지 않았습니다.
- 세션 결과는 브라우저 메모리에만 유지하며 새로고침하면 사라집니다.
- 의료 진단, 감정·긴장·자신감 분석, 면접 합격 가능성, 발표 능력 점수, 음성·발표 내용 평가는 범위 밖입니다.

## Webcam 수동 확인

1. `npm run dev`로 localhost를 열고 `LIVE CAMERA`를 선택합니다.
2. 브라우저 Camera 권한을 허용하고 Preview가 나타나는지 확인합니다.
3. Camera Device가 여러 개면 Selector에서 변경해 Stream이 교체되는지 확인합니다.
4. 권한을 차단했을 때 안내와 `다시 시도`가 표시되는지 확인합니다.
5. `MOCK` 전환 또는 Session End 뒤 Camera 사용 표시가 꺼지는지 확인합니다.

## 향후 실제 통합 순서

1. `MockFeatureProvider`와 같은 계약을 구현하는 `RemoteFeatureProvider`를 추가합니다.
2. FastAPI + MediaPipe Pose에서 정규화된 Feature와 Visibility를 생성합니다.
3. WebSocket으로 최신 Feature/Event를 전달하고 오래된 Frame을 폐기합니다.
4. Mock 손·무릎 값을 Pose Wrist/Knee 또는 필요 시 Hand Landmarker 결과로 교체합니다.
5. Evaluator와 Temporal 기준을 내부 테스트 영상으로 조정합니다.
6. `MockCoachingProvider`를 Event 기반 `SolarCoachingProvider`로 교체하고 timeout fallback을 유지합니다.

원본 영상은 기본 저장하지 않으며, 실제 SOLAR 연동 시에도 영상이 아니라 구조화된 Event 근거만 전달하는 것을 원칙으로 합니다.
