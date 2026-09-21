# 오토파일럿 진행 상태

- 현재 브랜치: `posture-coach-demo`
- 현재 단계: Webcam 프레임 샘플링·임시 FastAPI 전송 파이프라인 구현
- 상태: 코드와 서버 수신 검증 완료, 물리 Webcam 종단 간 검증 대기

## 완료

- 외부 Markdown 및 PDF 설계 문서 확인
- 기존 AutoDirector 코드와 Git 상태 분석
- 작업 브랜치 생성
- Specification, Research, Decisions, Plan, Tasks 작성
- 세 Mode와 Interview Rubric A/B 구현
- MockFeatureProvider, Context Evaluator, Temporal State Machine 구현
- Webcam Permission, Device Selector, Preview, Stream 정리 구현
- Dashboard, Demo Coaching, Event Log, Session Summary 구현
- AutoDirector 전용 다중 카메라·점수·자동 전환 모듈 제거
- README 및 반응형 UI 보완
- Welcome Modal과 사용 안내 다시 열기 구현
- 분석 준비 / 분석 진행 / 분석 결과 화면 분리
- Mode 및 Rubric Popover와 조건부 설정 UI 구현
- Camera·현재 상태·Coaching 중심 분석 화면 재구성
- Raw Feature, Event Log, Mock Scenario를 접힘 상세 영역으로 이동
- 결과 중심 Summary와 준비 화면 복귀 흐름 구현
- 별도 Welcome·준비 화면을 제거하고 대기 상태 Dashboard 즉시 표시
- Header 전역 기능을 `☰ 메뉴`의 사용 안내·분석 설정으로 통합
- 비차단형 이동 가능 사용 안내와 자동 열림 해제 설정 구현
- Mode·Rubric·입력 방식·Camera를 계층형 분석 설정으로 통합
- 대기·분석·종료 상태를 하나의 Dashboard 작업 공간으로 통합
- Temporal 상태별 Camera Panel Border·Glow 피드백 구현
- Session Summary를 Main Dashboard 전체 아래의 독립 Section으로 이동
- 분석 종료 시 우측 하단 Result Scroll Cue와 Smooth Scroll·Fade Out 구현
- Reduced Motion 및 좁은 화면용 Result Cue 처리
- 5 FPS JPEG FrameSampler, in-flight 건너뛰기 및 취소 가능한 HTTP Transport 구현
- 임시 FastAPI `/health`, `/process-frame`과 최소 CORS 구현
- Mock 분석과 독립된 실영상 프레임 수신 검증 경로 추가

## 다음 실제 통합 작업

1. MediaPipe + FastAPI 기반 `RemoteFeatureProvider` 구현
2. WebSocket 최신 Frame/Event 계약 연결
3. 실제 영상으로 Evaluator와 Temporal 후보값 조정
4. Event 기반 `SolarCoachingProvider`와 fallback 연결

## 알려진 오류

- 물리 Webcam Permission과 여러 Camera Device 전환은 사용자 환경에서 수동 확인 필요
- 실제 CV, 정식 Backend 분석, SOLAR는 의도적으로 Mock/미구현 상태; 임시 FastAPI는 프레임 수신만 확인

## 보류된 핵심 결정

- 없음. 실제 통합 항목은 후속 범위로 명시함

## 마지막 성공 검증

- `npm run lint` 성공
- `npm run build` 성공
- FastAPI 실서버 `GET /health` 200, CORS preflight 200 확인
- 합성 JPEG `POST /process-frame` 200 및 320×180·1,589 bytes·세션/모드/루브릭 수신 확인
- Mock 모드 시작·일시정지·재개·종료 및 Backend 비가동 시 UI 유지 확인
- 물리 Webcam에서 브라우저→FastAPI 종단 간 전송은 권한 승인 후 수동 확인 필요
- Context/Rubric/Visibility/Temporal 순수 로직 검증 성공
- 브라우저 핵심 흐름 및 Console 오류 0 확인
- 비차단 사용 안내, 전역 메뉴, 계층형 분석 설정 확인
- 모드별 Rubric 조건부 표시 및 분석 중 설정 잠금 확인
- NORMAL, CANDIDATE, CAUTION, WARNING, RECOVERED Camera 상태 스타일 확인
- 분석 종료 전후 Dashboard Panel 문서 위치 동일 확인
- Dashboard 하단 Result 생성 및 Result Scroll Cue 표시·이동·숨김 확인
- 상세 분석, Event Log, 시연 도구 접기/펼치기 확인

## 마지막 Checkpoint Commit

- `9190144 docs: define posture coach demo specification`
- `feat: build context-aware posture coach web demo` (최종 구현 커밋)
- `feat: simplify posture coach demo experience` (UI/UX 개선 커밋)
