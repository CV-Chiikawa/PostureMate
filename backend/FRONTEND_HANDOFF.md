# 프론트 인계 · 실시간 코칭과 분석 결과

대상은 `PostureMate/frontend`의 `325aa80`입니다. 세 모드 모두 현재 분석 화면과 결과 카드의 디자인을 사용합니다. 서버에서 실시간 코칭은 프레임 응답으로, 세션 전체 피드백은 분석 종료 시 별도 요청으로 제공합니다.

## 1. 종료 시 세션 전체 피드백 요청

`src/services/AnalysisClient.js`에 `requestSessionFeedback(facts, signal)`을 추가하세요. 현재 프레임 API와 같은 `ANALYSIS_API_BASE_URL`에 `POST /session-feedback`을 JSON으로 보냅니다. 서버의 SOLAR 대기 한도는 15초이므로 브라우저 요청에는 20초를 허용하세요. 키는 백엔드에서 관리합니다.

아래는 거북목 모드의 요청 예시입니다. 모드는 `neck`, `interview`, `presentation` 중 하나이며, `rubric`은 면접에서만 `"A"` 또는 `"B"`, 나머지 모드에서는 `null`입니다.

```json
{
  "mode": "neck",
  "rubric": null,
  "elapsed_seconds": 40,
  "measured_seconds": 32,
  "caution": 2,
  "warning": 1,
  "recovered": 1,
  "issues": {"forward_head_proxy": {"episodes": 2, "seconds": 8.4}},
  "observations": {"head_forward": 3}
}
```

`src/App.jsx`의 `applyRemoteAnalysis`에서 현재 연습 전체에 걸쳐 다음 값을 모으세요.

| 요청 값 | 현재 프론트에서 가져올 곳 |
| --- | --- |
| `elapsed_seconds`, `caution`, `warning`, `recovered` | `elapsedMs / 1000`과 기존 `stats` |
| `measured_seconds` | 연속된 두 `measurementStatus === "valid"` 프레임 사이의 시간. 1초를 넘긴 공백, 보정·측정 불가·연결 끊김·일시정지 시간은 제외 |
| `issues[type].episodes`, `issues[type].seconds` | `stats.eventCounts[type]`과 `stats.issueDurations[type] / 1000`. 같은 자세가 주의에서 경고로 바뀌어도 한 구간 |
| `observations` | 기존 `getRemoteEventKey`로 중복 제거한 이벤트의 `event.metrics.observation`을 값별로 집계. 해당 필드가 없으면 생략하고 관찰이 없으면 빈 객체 전송 |

`endSession`에서 집계를 확정하고 종료당 한 번 요청하세요. 카메라 해제와 결과 카드 표시는 즉시 진행합니다. 유효 측정 3초 미만이면 클라이언트에서 바로 측정 부족을 표시해도 됩니다. 3초 이상이고 경고가 0건인 연습도 종합 피드백 대상입니다. 새 연습은 집계를 초기화하고 이전 요청을 취소하세요. 기존 ‘기준 자세 다시 측정’은 같은 연습이므로 이전 집계를 유지하고 유효 시간의 연결만 끊습니다.

## 2. 결과 화면 오른쪽 카드

현재 `App.jsx`가 종료 시 만든 `coachingMessage`를 `SessionSummary.jsx`에 넘겨서 카드에 ‘이번 세션이 끝났습니다’가 나옵니다. 이 카드에는 별도 `sessionFeedback` 상태를 전달하세요.

| 응답 또는 상태 | 카드 표시 |
| --- | --- |
| 요청 중 | ‘이번 연습 피드백’과 ‘SOLAR가 이번 연습의 자세 기록을 살펴보고 있습니다.’ |
| `{"source":"solar","message":"…"}` | ‘SOLAR 종합 피드백’과 서버가 생성한 `message` 전문 |
| `{"source":"insufficient"}` | ‘측정 시간이 짧습니다. 기준 자세를 잡은 뒤 3초 이상 측정해 주세요.’ |
| `{"source":"fallback"}`, 네트워크 오류, 시간 초과 | ‘측정 기록 요약’과 기존 통계에서 가장 자주 나타난 문제·횟수. 경고가 없으면 측정 구간에 경고가 없었다고 표시 |

HTTP 422는 요청 형식 오류입니다. 면접 이외 모드의 `rubric: null`, 초 단위 수치, 필수 집계 객체를 확인하세요. 영상, 좌표, 세션 ID는 이 요청에 넣지 않습니다.

## 3. 실시간 코칭 카드

`src/components/CoachingPanel.jsx`의 출처 배지를 유지하세요. 현재 같은 이벤트의 모든 교체에 8초 읽기 시간과 2초 확인 시간을 적용합니다. 같은 이벤트에서 `fallback → solar`일 때만 기본 문구 표시 시작 후 1초가 지나면 교체하세요. 이미 지났다면 도착 즉시 본문과 배지를 함께 바꿉니다.

`App.jsx`에서 문자열 라벨과 별도로 실제 `source`와 `activeEventId`를 넘기세요. 기존 세션·모드·이벤트 ID 검사와 한 프레임에만 도착한 코칭을 유지하는 처리는 그대로 사용합니다. 복귀·새 경고·중단 후에 도착한 이전 답은 폐기합니다. 실제로 화면에 표시된 주의·경고 이벤트 ID마다 출처를 기록하면 결과에 ‘실시간 주의·경고 안내 2건 중 SOLAR 응답 1건’을 표시할 수 있습니다. 정상·보정 안내와 세션 종합 피드백은 이 숫자에서 제외합니다.

## 확인 시나리오

1. 정상 자세만 유효하게 3초 이상 측정하고 끝내면 경고 0건이어도 종합 피드백이 뜹니다.
2. 3초 미만 또는 보정 도중 종료하면 측정 부족이 뜹니다. 키가 없는 서버에서는 3초 이상 측정했을 때 기본 통계 요약이 뜹니다.
3. 같은 경고에서 받은 SOLAR 본문과 배지가 함께 바뀌고, 정상으로 돌아오거나 다른 연습을 시작하면 이전 답이 남지 않습니다.
4. 면접에서 기준 자세를 다시 측정한 뒤 끝내면 한 연습의 전후 기록을 모두 반영합니다.

타이머, 집계 및 결과 상태 연결은 V2의 구현을 참고할 수 있습니다. 대상 프론트의 보정 UI와 출처 배지는 위 파일 단위로 연결하세요. [V2 프론트 변경 내역](https://github.com/CV-Chiikawa/PostureMate_V2/commit/051df429ba006865f4f7cb519c35c8fecb87d3ff)
