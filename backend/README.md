# PostureMate 프레임 API

`POST /process-frame`은 multipart 필드 `file`(JPEG), `session_id`, `mode`를 받는다. 면접(`interview`)은 `rubric=A` 또는 `B`를 사용한다. 발표(`presentation`)와 거북목(`neck`)은 루브릭을 비운다. 소스의 기본값이자 유일한 허용값은 `mediapipe`이다. 지원하지 않는 소스와 모드 조합에는 HTTP 422를 반환한다.

`measurement_status`는 유효한 측정에서 `valid`, 기준 자세 수집 중에는 `calibrating`, 필수 관절이 보이지 않을 때는 `unavailable`이다. 뒤의 두 상태에서는 `features`, `state`, `event`, `coaching`이 모두 null이다. 모델을 사용할 수 없으면 HTTP 503을 반환한다.

자세와 코칭 상태는 세션별로 관리한다. 모드나 루브릭 변경 시 자세 기준을 초기화한다. 같은 모드에서 `segment`가 바뀌면 기준 자세는 유지하고 경고 지속시간을 다시 센다. 세션은 메모리에 최대 128개를 보관하며 5분 이상 사용하지 않은 항목은 다음 요청 때 정리한다.

주의와 경고 이벤트에는 기본 코칭 문구를 즉시 반환한다. 서버의 SOLAR Pro 4 응답은 5초 이내에 도착하고 같은 이벤트가 계속될 때 후속 프레임으로 한 번 전달한다. 프론트는 세션과 이벤트 ID를 대조한다. 원본 JPEG는 메모리에서 처리하며 SOLAR에는 자세 이벤트의 관찰값만 전송한다.

서버 실행, Windows 키 등록, 세 모드의 검증 방법은 [프로젝트 안내](../README.md)에 있다.

모의면접·발표 응답에는 `calibration: {status: "collecting"|"ready", progress: 0..1, required_seconds: 5}`가 추가됩니다. 수집 중은 `measurement_status=calibrating`, `measurement_reason=reference_collecting|reference_unstable`이며 측정값·상태·이벤트는 null입니다. 구도가 바뀐 경우 `unavailable/framing_changed`를 반환합니다. 손목/무릎뿐 아니라 상체 평가에 필요한 골반 가시성도 확인합니다. 모의면접의 전방 추정 불가는 `forward_proxy_unavailable`로 반환하며 정상으로 대체하지 않습니다. 기준은 세션에 속하므로 다시 측정할 때 새 session_id를 사용합니다. 기존 거북목 보정·API 요청 필드는 유지합니다.

모의면접 손·무릎 판정은 `features.hand_placement_status`(`correct`/`incorrect`)와 `features.knee_placement_status`(`within_reference`/`too_wide`/`too_close`)로 분리합니다. `knee_distance`는 어깨너비로 정규화한 현재 무릎 중심 간격, `knee_reference_distance`는 해당 루브릭 기준 수집의 중앙값, `knee_distance_ratio`는 기준 대비 배율입니다. `placement_issues`에는 모든 배치 문제를 담고, 기존 `hand_placement` 이벤트의 `metrics.observation`은 대표 세부 문제를 나타냅니다. `left_hand_source`/`right_hand_source`는 `pose_hand_points` 또는 `wrist_proxy`입니다. 루브릭을 바꾸면 간격 기준도 새로 수집합니다.

보정 지연 시 `measurement_status=calibrating`, `measurement_reason=reference_timeout`입니다. 15초 경과만으로 기준을 저장하지 않으며 상태·이벤트는 계속 null입니다. `calibration.unstable_feature` 및 유효/최소 샘플 수로 원인을 안내합니다. 일시적인 모델 튐은 제외하지만 가림·긴 입력 공백은 관찰 연속성을 초기화합니다.
