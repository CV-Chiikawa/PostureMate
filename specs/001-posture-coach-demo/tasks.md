# 구현 Tasks

- [x] 외부 Markdown/PDF 설계 문서 확인
- [x] 기존 AutoDirector와 Git 상태 분석
- [x] `posture-coach-demo` 브랜치 생성
- [x] Specification 작성
- [x] Research와 Decisions 작성
- [x] Plan 작성
- [x] Mode와 Rubric 설정 구현
- [x] Mock Scenario와 Feature Provider 구현
- [x] Context Evaluator 구현
- [x] Temporal State Machine 구현
- [x] Analysis Dashboard와 Mock Coaching 구현
- [x] Event Log와 Session Summary 구현
- [x] Webcam Hook, 장치 선택, Preview 구현
- [x] Visibility와 오류 처리 구현
- [x] 반응형 UI와 README 보완
- [x] lint와 Production Build 검증
- [x] 최종 Commit 생성

## 검증 결과

- `npm run lint`: 오류 및 경고 없이 성공
- `npm run build`: Vite Production Build 성공
- 순수 로직: Context 차이, Rubric A/B, Visibility, 전체 Temporal 상태 순서 성공
- 브라우저: 세 Mode 선택, Warning/Recovery/Cooldown, Pause/End, Session Summary 확인
- 브라우저 Console: 오류 및 경고 없음
- Webcam 물리 장치와 권한 조합: 사용자 환경에서 수동 확인 필요
