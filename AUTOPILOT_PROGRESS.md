# 오토파일럿 진행 상태

- 현재 브랜치: `posture-coach-demo`
- 현재 단계: 전체 구현 및 검증 완료
- 상태: 완료

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

## 다음 실제 통합 작업

1. MediaPipe + FastAPI 기반 `RemoteFeatureProvider` 구현
2. WebSocket 최신 Frame/Event 계약 연결
3. 실제 영상으로 Evaluator와 Temporal 후보값 조정
4. Event 기반 `SolarCoachingProvider`와 fallback 연결

## 알려진 오류

- 물리 Webcam Permission과 여러 Camera Device 전환은 사용자 환경에서 수동 확인 필요
- 실제 CV, Backend, SOLAR는 의도적으로 Mock/미구현 상태

## 보류된 핵심 결정

- 없음. 실제 통합 항목은 후속 범위로 명시함

## 마지막 성공 검증

- `npm run lint` 성공
- `npm run build` 성공
- Context/Rubric/Visibility/Temporal 순수 로직 검증 성공
- 브라우저 핵심 흐름 및 Console 오류 0 확인

## 마지막 Checkpoint Commit

- `9190144 docs: define posture coach demo specification`
- `feat: build context-aware posture coach web demo` (최종 구현 커밋)
