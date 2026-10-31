# PostureMate Frontend Status

- 저장소: `CV-Chiikawa/PostureMate`
- 작업 브랜치: `frontend`
- 기준일: 2026-10-31
- 애플리케이션 기준 커밋: `09fb100`
- 상태: 프론트엔드 선행 데모와 Remote Demo 연결 완료, 실제 CV Backend 통합 대기

## 담당 범위

이 브랜치는 React UI, Webcam 제어, Frame Sampling, Backend API Client, Feature/State/Event 표시와 세션 결과 화면을 담당합니다. 팀 통합 `main`, 실제 MediaPipe 추론, CV 모델과 SOLAR 서버는 이 브랜치의 단독 책임 범위가 아닙니다.

## 구현 완료

- 소개 → 모드 선택 → 분석 → 결과로 이어지는 반응형 사용자 흐름
- 모의면접, 거북목 방지, 발표 모드와 모의면접 Rubric A/B
- 모드 카드 공통 이미지와 직접 분석 화면 진입
- 데모 입력과 실제 Camera Preview 전환
- Camera 권한, 장치 조회·선택, 재시도와 Stream 정리
- 5 FPS JPEG Frame Sampling, in-flight 요청 건너뛰기, Timeout과 취소 처리
- `POST /process-frame` Multipart 요청
- Remote Demo Feature/State/Event 응답 Adapter와 세션 불일치 응답 차단
- NORMAL, CANDIDATE, CAUTION, WARNING, RECOVERED, COOLDOWN 상태 표시
- Event 중복 방지, Event Log, Session Summary와 실제 수집 데이터 기반 결과 화면
- 분석 시작, 일시정지, 재개, 종료 시 Sampling 생명주기 처리
- Cookie 기반 사용 안내 자동 표시 해제와 수동 재호출
- Landmark Visibility 부족 시 잘못된 경고를 차단하되 별도 Camera Guide는 노출하지 않음

## 현재 API 계약

Frontend 요청:

```text
POST /process-frame
multipart/form-data
  file: JPEG
  session_id: string
  mode: interview | neck | presentation
  rubric: A | B | ""
```

Frontend가 사용하는 응답 필드:

```text
session_id
analysis_source
context
features
state
event
```

`event`가 없으면 `null`을 사용합니다. Event 식별에는 `event_id`를 우선 사용하며, 없으면 세션·유형·시작 시각 조합을 사용합니다. 응답의 `session_id`가 현재 세션과 다르면 UI에 반영하지 않습니다.

## 실제 기능과 Demo 경계

실제로 동작하는 항목:

- Browser Webcam Preview와 장치 선택
- JPEG Frame 추출과 HTTP 전송
- Remote 응답 수신, 상태·Feature·Event 표시
- 세션과 결과 UI

현재 Demo인 항목:

- FastAPI의 Feature/State/Event 값
- Pose Landmark Overlay
- 자세 판정 근거와 Threshold
- Coaching 문구와 SOLAR 연동

현재 임시 FastAPI는 영상 내용을 분석하지 않습니다. JPEG 형식과 크기를 검증한 뒤 세션별 결정론적 Demo Fixture를 반환합니다.

## 마지막 검증

- `npm run lint` 성공
- `npm run build` 성공
- Mock 세션 시작·일시정지·재개·종료 흐름 확인
- 실제 Camera Preview와 Frame 전송 경로 확인
- Remote Demo의 NORMAL → CAUTION → WARNING → RECOVERED 반영 확인
- `event: null`, Event 중복 방지와 세션 불일치 응답 차단 경로 확인
- 분석 종료 후 Sampling과 Camera Stream 정리 확인

README와 이 상태 문서만 변경한 조직 이전 커밋은 애플리케이션 코드에 영향을 주지 않습니다.

## Backend/CV 통합 전 합의 항목

- Feature 필드명과 단위
- State 값과 전환 책임 위치
- Event 구조, `event_id`, 시작 시각과 지속시간 단위
- `session_id` 생성·검증 규칙
- Event가 없을 때 `null` 처리
- Landmark Visibility와 누락 Feature 처리
- 서버 지연, Timeout, malformed response와 재연결 정책

## 다음 작업

1. Backend/CV 담당자와 JSON 계약을 확정합니다.
2. FastAPI Demo Fixture를 MediaPipe/CV 결과로 교체합니다.
3. 실제 Landmark Overlay를 연결합니다.
4. 연결 끊김, 지연, malformed response, session mismatch를 통합 테스트합니다.
5. 실제 영상으로 Threshold와 Temporal 후보값을 검증합니다.
6. Event 기반 SOLAR Coaching과 Timeout fallback을 연결합니다.

## 브랜치 운영

- 프론트엔드 작업은 `frontend` 브랜치에 Commit·Push합니다.
- 팀 통합 `main`은 통합 담당자가 생성하고 관리합니다.
- 실제 통합 전에는 API 계약과 테스트 결과를 확인한 뒤 Pull Request를 사용합니다.
- 개인 구현 과정의 `specs/` 문서는 로컬 참고용이며 Git 추적 대상에서 제외합니다.
