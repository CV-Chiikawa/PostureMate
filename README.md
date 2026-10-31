# PostureMate Frontend

사용 상황에 따라 자세 평가 기준을 다르게 적용하고, 문제 자세가 일정 시간 지속될 때 상태 변화와 교정 피드백을 보여주는 PostureMate의 React 프론트엔드입니다.

현재 브랜치는 팀 통합 `main`이 아닌 프론트엔드 개발 브랜치입니다. UI/UX, Webcam 제어, 5 FPS 프레임 샘플링, Backend API 연결, Feature/State/Event 표시와 세션 흐름을 담당합니다.

## 브랜치와 담당 범위

- 작업 브랜치: `frontend`
- 담당: React UI, 반응형 화면, Camera 권한·장치 선택, 프레임 샘플링, 분석 API Client, 결과 시각화
- 연동 대상: Backend의 `POST /process-frame` 응답과 CV Feature/Event 계약
- 제외 범위: 실제 MediaPipe 추론, CV 모델 판정, 팀 통합 `main` 관리, SOLAR 서버 구현

팀 통합은 담당자 간 API 계약을 확인한 뒤 별도 Pull Request로 진행합니다. `frontend` 브랜치에서 조직 저장소의 `main`을 직접 생성하거나 대체하지 않습니다.

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

## 로컬 분석 연결 검증

실제 Webcam 영상에서 JPEG 프레임을 추출해 임시 FastAPI 서버로 전송하고, Demo Feature/State/Event 응답이 프론트엔드에 반영되는 수직 연결을 검증할 수 있습니다. 응답은 실제 CV 결과가 아닌 결정론적 Demo Fixture입니다.

```powershell
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
.venv\Scripts\python.exe -m uvicorn backend.app:app --host 127.0.0.1 --port 8000
```

다른 터미널에서 `npm run dev`를 실행하고 `실제 카메라`를 선택한 뒤 `분석 시작`을 누릅니다. 기본 개발 URL은 `http://127.0.0.1:8000`이며 `.env.example`의 `VITE_ANALYSIS_API_BASE_URL`을 `.env.local`에 설정해 교체할 수 있습니다. 배포 빌드에 주소가 없으면 프레임 전송만 비활성화되고 기존 데모는 작동합니다. FastAPI는 개발 Origin `localhost:5173`과 `127.0.0.1:5173`만 기본 허용합니다. 포트가 다르면 `FRAME_DEMO_CORS_ORIGINS` 환경변수에 명시합니다.

기본 설정은 `src/config/frameSampling.js`의 5 FPS, JPEG Quality 0.8, 요청 Timeout 3초입니다. `useFrameSampler`가 `<video>`를 화면에 표시하지 않는 Canvas로 캡처하고 `AnalysisClient`가 `multipart/form-data`의 `file`, `session_id`, `mode`, `rubric`을 `POST /process-frame`에 전송합니다. 이전 요청이 끝나지 않으면 다음 프레임은 건너뛰며, 일시정지·종료 시 Timer와 요청을 정리합니다. 서버는 프레임을 저장하지 않고 JPEG를 검증한 뒤 `context`, `features`, `state`, `event`를 반환합니다.

주요 응답 계약은 다음과 같습니다.

```text
session_id
analysis_source
context
features
state
event
```

`event`가 없을 때는 `null`을 사용하며, 프론트엔드는 `session_id`가 현재 세션과 일치하는 응답만 반영합니다.

서버를 켠 상태에서 Endpoint만 확인하려면 `.venv\Scripts\python.exe -m backend.test_transport`를 실행합니다. 이 테스트는 합성 JPEG를 전송합니다. 실제 웹캠 프레임 수신은 브라우저 카메라 권한을 허용한 환경에서 별도 확인해야 합니다.

## 주요 기능

- 소개 → 모드 선택 → 분석 → 결과로 이어지는 화면 흐름
- 모의면접, 거북목 방지, 발표 Mode 선택
- 모의면접 Rubric A/B 선택
- Mode별 카메라 구도 안내
- Mock Camera와 실제 Webcam Preview 전환
- Camera Permission, Device Enumeration, Device Selector, 오류와 Stream 정리
- Shared Pose Feature와 Context Evaluator 분리
- NORMAL → CANDIDATE → CAUTION → WARNING → RECOVERED → COOLDOWN 상태 전환
- Landmark Visibility 부족 시 사용자 경고 없이 내부 판정 중지
- Mock Coaching, Event Log, Session Summary
- 실제 Webcam Frame 전송과 Remote Demo 응답 반영
- 동일 `body_sway` 값의 Mode별 평가 차이를 보여주는 Context 비교 Scenario

## 사용자 흐름

1. 소개 화면에서 `분석 시작하기`를 눌러 모드 선택으로 이동합니다.
2. 모의면접, 거북목 방지, 발표 중 하나를 선택하고 `이 모드로 시작하기`를 누릅니다.
3. 소개 화면 하단의 모드 카드를 선택하면 모드 선택 화면을 생략하고 분석 대기 화면으로 바로 이동합니다.
4. 분석 설정에서 데모 입력 또는 실제 카메라와 필요한 Rubric을 확인합니다.
5. `분석 시작` 후 Camera Preview, 상태, Feature, Coaching과 Event Log를 확인합니다.
6. 분석을 종료하면 Dashboard 아래에 Session Summary가 생성되며 `분석 결과 보기`로 이동할 수 있습니다.

최초 방문 시에는 화면 조작을 막지 않는 작은 `사용 안내` 패널이 자동으로 열립니다. 자동 안내에서 `다음부터 자동으로 열지 않기`를 선택하면 `posture-coach-hide-guide` Cookie가 저장됩니다. 상단 메뉴의 `사용 안내`는 Cookie 상태와 관계없이 항상 다시 열 수 있습니다.

분석 중 Camera Preview Panel은 현재 Temporal 상태를 색상으로도 보조 표시합니다. NORMAL과 COOLDOWN은 중립, CANDIDATE는 매우 약한 노랑, CAUTION은 노랑, WARNING은 빨강, RECOVERED는 초록 테두리와 Glow를 사용하며 기존 상태 Text는 항상 함께 유지합니다.

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
- 실제 Webcam JPEG 프레임 샘플링과 임시 FastAPI 수신 검증
- Remote Demo Feature/State/Event 응답의 UI 반영
- Session Start, Pause, Resume, End
- Context Evaluator와 Temporal State Machine
- Event Log와 Session Summary

### Mock으로 유지한 기능

- Pose Landmark와 Pose Feature 입력
- MediaPipe Pose/Hand/Face 추론
- 손·무릎의 실제 영상 판정
- MediaPipe 기반 실제 CV Backend 분석
- SOLAR 자연어 코칭

`실제 카메라`에서는 영상과 프레임 전송이 실제로 동작하지만 현재 FastAPI 응답은 Demo Fixture입니다. 화면에는 `실제 카메라 영상 / 자세 분석은 데모 데이터`, Landmark에는 `자세 포인트 표시 — 데모`, 코칭에는 `데모 코칭 · SOLAR 미연동`을 표시합니다.

## 기술 스택

- React 19
- Vite 8
- Browser MediaDevices API
- JavaScript 기반 Provider / Evaluator / Temporal State Machine
- CSS 반응형 Dashboard

FastAPI는 로컬 전송 검증용 선택 서버입니다. React/Vite 정적 빌드는 기존 Vercel 구조를 유지하며, 배포에서 서버를 자동 제공하지 않습니다.

## 디렉터리 구조

```text
src/
├─ assets/      공통 Mode 카드 이미지
├─ components/  화면 구성 요소
├─ config/      Mode별 조건과 데모 시간 설정
├─ data/        Mock Scenario
├─ hooks/       Webcam Stream 생명주기
├─ services/    Mock/Remote Provider와 프레임 전송 Client
└─ utils/       Context Evaluator와 Temporal State Machine

backend/        임시 FastAPI 프레임 수신 서버와 전송 테스트
```

현재 구현 상태, 검증 결과와 Backend/CV 인계 항목은 `FRONTEND_STATUS.md`에서 관리합니다. 개인 구현 과정에서 만든 `specs/` 문서는 로컬 참고자료로만 유지하며 Git 추적 대상에서 제외합니다.

## 알려진 제한사항

- Webcam Preview는 코드 경로와 UI 오류 처리를 구현했지만 Camera Device·권한 조합은 사용자 환경에서 수동 확인이 필요합니다.
- Live Video는 실제 Pose 분석에 사용되지 않습니다.
- 임시 FastAPI는 Demo Feature/State/Event만 반환하며 실제 영상 내용을 분석하지 않습니다.
- Mock Threshold는 실제 사용자 영상으로 조정되지 않았습니다.
- 세션 결과는 브라우저 메모리에만 유지하며 새로고침하면 사라집니다.
- 의료 진단, 감정·긴장·자신감 분석, 면접 합격 가능성, 발표 능력 점수, 음성·발표 내용 평가는 범위 밖입니다.

## Webcam 수동 확인

1. `npm run dev`로 localhost를 열고 상단 메뉴의 `분석 설정 → 입력 방식 → 실제 카메라`를 선택합니다.
2. 브라우저 Camera 권한을 허용하고 Preview가 나타나는지 확인합니다.
3. Camera Device가 여러 개면 Selector에서 변경해 Stream이 교체되는지 확인합니다.
4. 권한을 차단했을 때 안내와 `다시 시도`가 표시되는지 확인합니다.
5. `데모 모드` 전환 또는 `분석 종료` 뒤 Camera 사용 표시가 꺼지는지 확인합니다.

## 향후 실제 통합 순서

1. Backend/CV 담당자와 Feature 필드명, 단위, State, Event, `session_id` 규칙을 확정합니다.
2. 임시 Demo Fixture를 FastAPI + MediaPipe의 정규화된 Feature와 Visibility로 교체합니다.
3. 필요 시 WebSocket으로 최신 Feature/Event를 전달하고 오래된 Frame을 폐기합니다.
4. Mock 손·무릎 값을 Pose Wrist/Knee 또는 필요 시 Hand Landmarker 결과로 교체합니다.
5. Evaluator와 Temporal 기준을 내부 테스트 영상으로 조정합니다.
6. `MockCoachingProvider`를 Event 기반 `SolarCoachingProvider`로 교체하고 timeout fallback을 유지합니다.

원본 영상은 기본 저장하지 않으며, 실제 SOLAR 연동 시에도 영상이 아니라 구조화된 Event 근거만 전달하는 것을 원칙으로 합니다.
