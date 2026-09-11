# Context-Aware AI Posture Coach 선행 웹 데모 명세

## 목적

사용 상황에 따라 동일한 자세 Feature를 다르게 평가하고, 이상 상태가 일정 시간 지속될 때 단계적인 자세 이벤트와 설명 가능한 교정 안내를 보여주는 웹캠 기반 선행 웹 데모를 만든다.

## 사용자 시나리오

1. 사용자는 모의면접, 거북목 방지, 발표 중 하나를 선택한다.
2. 모의면접에서는 Rubric A 또는 B를 선택하고 모드별 카메라 구도를 확인한다.
3. MOCK 또는 LIVE CAMERA 입력을 선택한다. LIVE CAMERA는 실제 영상만 사용하며 분석은 Mock임을 명시한다.
4. 세션을 시작하고 Feature, Context 평가, Temporal Event, 코칭, 로그를 확인한다.
5. 문제 자세를 정상 자세로 바꿔 RECOVERED와 COOLDOWN을 확인한다.
6. 세션을 종료하고 이벤트 횟수, 지속시간, 주요 문제 자세를 확인한다.

## 기능 요구사항

- 세 모드와 Interview Rubric A/B 선택을 제공한다.
- Shared Feature와 Context Evaluator를 분리한다.
- `body_sway` 같은 동일 값이 모드에 따라 활성, 비활성 또는 허용으로 달라지는 시나리오를 제공한다.
- NORMAL, CANDIDATE, CAUTION, WARNING, RECOVERED, COOLDOWN 상태를 실제 시간 기준으로 전환한다.
- Visibility가 부족하면 잘못된 경고 대신 판정 불가와 카메라 조정 안내를 표시한다.
- Mock Scenario를 수동으로 전환할 수 있다.
- Webcam 권한 요청, 장치 조회·선택, Preview, 오류 처리, Stream 정리를 지원한다.
- Feature Panel, Status Panel, Demo Coaching, Event Log, Session Summary를 제공한다.
- 로그는 최근 항목만 보관한다.

## 비기능 요구사항

- 기존 React + Vite 및 Vercel 호환성을 유지하고 새 필수 의존성을 추가하지 않는다.
- 데스크톱 중심으로 설계하되 작은 화면에서도 핵심 기능을 사용할 수 있어야 한다.
- 색상뿐 아니라 텍스트로 상태를 전달한다.
- 원본 영상이나 세션 데이터를 저장하지 않는다.
- 의료 진단, 감정, 자신감, 합격 가능성, 발표 능력 점수를 표현하지 않는다.

## 실제 기능과 Mock 경계

실제 기능은 React UI, 브라우저 Webcam, 장치 선택, 세션 관리, Evaluator, Temporal State Machine, 로그와 요약이다. Pose Landmark, Pose Feature 입력, CV 추론, 손·무릎 분석, SOLAR 코칭은 Mock이다.

## 인수 기준

- 세 모드와 Rubric A/B를 선택할 수 있다.
- 단일 이상값으로 WARNING에 즉시 진입하지 않는다.
- 지속 시 CAUTION과 WARNING, 복구 시 RECOVERED와 COOLDOWN이 나타난다.
- 동일 `body_sway` 시나리오가 모의면접에서는 문제로, 거북목 방지에서는 평가 제외로, 발표에서는 허용으로 표시된다.
- Visibility 부족 시 Camera Guide가 표시되고 WARNING이 발생하지 않는다.
- LIVE CAMERA에서 `LIVE VIDEO / MOCK ANALYSIS`가 명확히 보인다.
- 세션 종료 후 필수 요약 항목이 표시된다.
- `npm run build`가 성공한다.
