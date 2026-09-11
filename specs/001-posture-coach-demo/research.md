# 조사 결과

## 설계 문서 비교

- Markdown 설계서와 16쪽 PDF 고도화 설계서는 프로젝트 정의, 고정 범위, Feature Layer, Evaluator, Temporal Event, CV/SOLAR 역할과 비목표가 일치한다.
- PDF는 Markdown 내용을 팀 리뷰용 시각 문서로 재구성했으며 구현 범위를 바꾸는 추가 요구사항은 없다.
- 최종 지시서는 완성 시스템이 아닌 웹 선행 데모에 맞춰 실제 Webcam과 Mock 분석의 경계를 더 구체적으로 고정한다.

## 기존 코드 분석

- 재사용: React/Vite 구성, Vercel 친화적 정적 구조, 어두운 Dashboard 스타일, 카드와 Event Log 패턴, Mock Scenario와 시간 기반 상태 갱신 방식.
- 수정: Header, Camera Feed, Control Panel, 상태 관리, CSS Design System.
- 제거 대상: Director Score, 다중 카메라 비교, 자동 카메라 전환, Auto Crop, 방송 출력 개념.
- 신규: Mode 설정, Provider, Context Evaluator, Temporal State Machine, Webcam Hook, Session Summary.

## 기술 조사

- 브라우저 Webcam은 `navigator.mediaDevices.getUserMedia()`와 `enumerateDevices()`로 구현하며 HTTPS 또는 localhost 보안 컨텍스트가 필요하다.
- 장치 변경 시 기존 Track을 모두 정지한 뒤 새 Stream을 연결한다.
- React 상태 기반 단일 화면으로 충분하므로 Router는 추가하지 않는다.
- 테스트 가능한 핵심 로직은 DOM과 분리된 순수 함수로 구성한다.

## 위험과 대응

- 백그라운드 탭 Timer 지연: 절대 시각 차이를 사용해 지속시간을 계산한다.
- Webcam 거부·미지원: Mock 모드로 즉시 돌아갈 수 있는 오류 메시지를 제공한다.
- Mock Landmark 오인: 항상 `POSE OVERLAY — DEMO`를 표시한다.
- 임계값 과학성 오인: 설정과 문서에 데모 후보값임을 명시한다.
