# PostureMate 프레임 API

`POST /process-frame`은 multipart 필드 `file`(JPEG), `session_id`, `mode`를 받는다. 면접(`interview`)은 `rubric=A` 또는 `B`를 사용한다. 발표(`presentation`)와 거북목(`neck`)은 루브릭을 비운다. 소스의 기본값이자 유일한 허용값은 `mediapipe`이다. 지원하지 않는 소스와 모드 조합에는 HTTP 422를 반환한다.

`measurement_status`는 유효한 측정에서 `valid`, 기준 자세 수집 중에는 `calibrating`, 필수 관절이 보이지 않을 때는 `unavailable`이다. 뒤의 두 상태에서는 `features`, `state`, `event`, `coaching`이 모두 null이다. 모델을 사용할 수 없으면 HTTP 503을 반환한다.

자세와 코칭 상태는 세션별로 관리한다. 모드나 루브릭 변경 시 자세 기준을 초기화한다. 같은 모드에서 `segment`가 바뀌면 기준 자세는 유지하고 경고 지속시간을 다시 센다. 세션은 메모리에 최대 128개를 보관하며 5분 이상 사용하지 않은 항목은 다음 요청 때 정리한다.

주의와 경고 이벤트에는 기본 코칭 문구를 즉시 반환한다. 서버의 SOLAR Pro 4 응답은 5초 이내에 도착하고 같은 이벤트가 계속될 때 후속 프레임으로 한 번 전달한다. 프론트는 세션과 이벤트 ID를 대조한다. 원본 JPEG는 메모리에서 처리하며 SOLAR에는 자세 이벤트의 관찰값만 전송한다.

서버 실행, Windows 키 등록, 세 모드의 검증 방법은 [프로젝트 안내](../README.md)에 있다.
