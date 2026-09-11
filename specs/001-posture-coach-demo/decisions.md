# 구현 결정

## D-01 상태 기반 SPA

별도 Router 없이 한 화면에서 준비, 실행, 일시정지, 종료 상태를 관리한다. 선행 데모 흐름이 짧고 배포 복잡도를 늘릴 이유가 없다.

## D-02 단일 주요 이벤트

여러 Feature를 동시에 표시하되 매 Tick에서 가장 심한 활성 평가 한 개를 Temporal State Machine에 입력한다. 시연 중 상태와 코칭의 원인을 명확하게 유지하기 위한 결정이다.

## D-03 시간 후보값

CANDIDATE는 즉시 시작하고, CAUTION은 2초, WARNING은 5초, RECOVERED는 1.2초, COOLDOWN은 2초로 둔다. 이는 성능 기준이 아닌 시연용 후보값이며 실제 영상 평가 후 교체한다.

## D-04 Mode 변경 규칙

Mode 또는 Rubric 변경 시 진행 중 세션을 준비 상태로 초기화한다. 서로 다른 Evaluator의 이벤트와 통계를 섞지 않는다.

## D-05 LIVE CAMERA 분석 경계

LIVE CAMERA에서는 영상 Preview만 실제다. Feature와 Landmark Overlay는 선택한 Mock Scenario에서 가져오며 UI에 `LIVE VIDEO / MOCK ANALYSIS`를 상시 표시한다.

## D-06 설계 문서 우선순위

두 설계 문서의 핵심 내용은 동일하다. 웹 데모 세부 구현은 최종 지시서의 명시적 Mock/Live 구분과 완료 기준을 우선한다.
