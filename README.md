# PostureMate V2

PostureMate는 웹캠으로 거북목·모의면접·발표 자세를 연습하는 웹 앱입니다. 카메라에서 감지한 변화와 지금 할 수 있는 조정을 한국어로 안내합니다. 연습이 끝나면 주의·경고 횟수, 자세를 회복한 횟수와 항목별 지속 시간을 확인할 수 있습니다.

## 구현 브랜치

기본 브랜치 `main`에는 이 안내서만 있습니다. 각 구현 브랜치는 같은 출발점에서 분기했으며, 전체 앱을 실행할 때는 아래 절차에 따라 로컬에서 합칩니다.

| 브랜치 | 구현 |
| --- | --- |
| [Frontend](https://github.com/CV-Chiikawa/PostureMate_V2/tree/Frontend) | React·Vite 화면, 웹캠 연결과 프레임 전송, 자세별 코칭 카드, 세션 결과, 브라우저 테스트 |
| [Backend](https://github.com/CV-Chiikawa/PostureMate_V2/tree/Backend) | FastAPI 프레임 API, 세션 관리, SOLAR Pro 4 코칭, Windows 자격 증명 연동, API 테스트와 개발 명세 |
| [AI](https://github.com/CV-Chiikawa/PostureMate_V2/tree/AI) | MediaPipe 모델 준비와 추론, NeckOn 기반 거북목 보정, 면접·발표 자세 판정, 라벨 영상 평가와 자세 테스트 |

## 연습 모드

| 모드 | 카메라에 보일 부위 | 확인하는 자세 |
| --- | --- | --- |
| 거북목 방지 | 정면이나 비스듬한 측면에서 얼굴과 어깨 | 약 2초간 구도를 확인하고 5초간 개인 기준 자세를 수집합니다. 머리가 앞으로 나오거나 한쪽으로 기우는 등의 변화를 구분합니다. |
| 모의면접 | 정면에서 얼굴, 양손, 양쪽 무릎 | 고개·어깨·상체 기울기와 좌우 움직임을 감지합니다. 기준 A는 양손을 무릎 가운데에 모으고, B는 각 손을 같은 쪽 무릎에 둡니다. |
| 발표 | 정면에서 얼굴과 상체 | 지속되는 기울기와 반복적인 좌우 흔들림을 감지합니다. 한 방향으로 걷는 동작은 허용합니다. |

## Windows에서 실행

Git, Node.js 22.12 이상과 Python 3.13을 준비합니다. 새 PowerShell 창에서 세 브랜치의 구현을 로컬 실행용 브랜치에 모읍니다.

```powershell
git clone https://github.com/CV-Chiikawa/PostureMate_V2.git
cd PostureMate_V2
git switch -c local-run origin/main
git merge --no-edit origin/Frontend origin/Backend origin/AI
```

같은 창에서 Python 의존성과 모델을 준비한 뒤 분석 서버를 시작합니다. 모델 준비 명령은 고정된 버전의 파일을 다운로드하고 SHA-256을 확인합니다.

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend/requirements.txt
.\.venv\Scripts\python.exe -m backend.landmarker
.\.venv\Scripts\python.exe -m uvicorn backend.app:app --host 127.0.0.1 --port 8000
```

두 번째 PowerShell 창을 같은 프로젝트 폴더에서 열고 화면을 시작합니다.

```powershell
npm ci
npm run dev
```

[로컬 화면](http://127.0.0.1:5173)에서 모드를 선택하고 카메라 권한을 허용한 뒤 **분석 시작**을 누릅니다. 개발 화면은 기본적으로 같은 PC의 8000번 포트에 연결합니다.

## SOLAR 코칭

기본 자세 안내는 API 키 없이 사용할 수 있습니다. SOLAR Pro 4의 추가 코칭을 사용하려면 서버를 시작하기 전에 아래 명령을 실행하고 암호 입력 창에 Upstage API 키를 넣습니다. 이후 같은 Windows 계정에서 서버를 켜면 자격 증명 관리자에서 키를 불러옵니다.

```powershell
.\.venv\Scripts\python.exe -m backend.solar_credentials save
```

카메라 프레임은 분석 서버 메모리에서 처리합니다. SOLAR에는 모드, 자세 유형, 지속 시간 등 코칭에 필요한 관찰값만 전달합니다.

## 검증과 구현 근거

세 구현을 합친 폴더에서 테스트와 빌드를 실행합니다. `npm run test:browser`는 로컬 웹 화면과 분석 서버가 실행 중이고 Chrome이 설치되어 있을 때 세 모드의 카메라 흐름을 검증합니다.

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s backend -p "test_*.py"
npm test
npm run lint
npm run build
```

자세별 인수 조건과 프레임 응답 형식은 [개발 명세](https://github.com/CV-Chiikawa/PostureMate_V2/blob/Backend/docs/superpowers/specs/2026-11-23-posturemate.md)와 [API 문서](https://github.com/CV-Chiikawa/PostureMate_V2/blob/Backend/backend/README.md)에 있습니다. 화면은 [기존 PostureMate 프론트](https://github.com/CV-Chiikawa/PostureMate/tree/624b1c02c8acae245554b3381a1a6dfec73d7ced)를, 거북목 판정은 [NeckOn](https://github.com/SaltyPie153/NeckOn/tree/d57a911eed2cdb737d446e3aa3702f8d94f83bbd/posture_monitor_ai/Finally)을 기반으로 합니다.

## 모의면접·발표 개인 기준 보정 (로컬 개선)

두 모드는 분석 시작 후 **안정된 기준 자세 5초(최소 15프레임)**를 수집합니다. 카메라와 거리를 먼저 맞추고 정면에서 바른 자세를 유지하세요. 일시적으로 튄 관절 추정값은 제외하고, 지속적인 변동이나 서서히 움직이는 자세에서는 기준 저장을 보류합니다. 관절이 가려지거나 입력이 끊기면 관찰 창을 다시 수집하며, 보정 중에는 자세 경고·코칭 이벤트를 생성하지 않습니다. 화면에는 진행률을 표시합니다. 발표도 이제 골반까지 보여야 상체 평가가 가능합니다.

머리·어깨·상체 좌우 기울기는 부호를 유지한 원본값의 중앙값을 기준으로 변화량을 계산합니다. 따라서 카메라의 고정된 기울기와 개인 초기 정렬 차이를 일부 보정하며, 반대 방향으로 기울어진 변화도 놓치지 않습니다. 기존 임계값은 이제 이러한 **기준 대비 변화량의 초기 휴리스틱**입니다. 손·무릎 A/B 배치는 아래 개인 무릎 기준 및 무릎 영역 규칙으로 별도 평가합니다.

모의면접의 전방 기울기는 MediaPipe 추정 좌표의 기준 대비 증가량인 `torso_forward_proxy`입니다. 실제 신체 3D 각도로 해석하지 않습니다. 좌우 변화량 `torso_lateral_lean`, 원본 `raw_*`, 기준 `baseline_*`을 상세 분석에서 구분합니다. 전방 기준 또는 현재 추정값이 없으면 모의면접을 측정 불가로 처리합니다. 발표는 전방 추정값으로 경고하지 않습니다.

두 모드 모두 단순 위치 변경만으로 몸 흔들림을 경고하지 않고, 유의한 반복 방향 전환을 요구합니다. 어깨 투영 크기·상체 비율·영상 가로세로 비가 기준에서 크게 달라지면 판정을 보류합니다. 원래 위치로 돌아오거나 **기준 자세 다시 측정**을 누르세요. 재측정은 새 분석 세션을 사용하지만 화면의 기존 연습 통계는 유지합니다. 카메라 장치를 바꾸면 새 연습으로 초기화합니다.

이 방법은 카메라 자체를 보정하는 장치 calibration이나 의학적 정상 자세 판별이 아닙니다. 처음부터 잘못된 자세를 유지하면 그 자세가 기준에 반영될 수 있습니다. 고개-어깨 정렬과 관절 가시성 검사를 하지만 모든 나쁜 초기 자세를 배제하지는 못합니다. 단일 웹캠만으로 카메라 이동과 사람 움직임을 완전히 구분하지 못하며, 위·아래로 심하게 치우친 구도나 촬영 각도 변화가 작을 때는 감지하지 못할 수 있습니다. 고정된 카메라에서 구도를 맞추고, 배치를 바꿨다면 직접 재측정하세요.

검증은 회귀 테스트·합성 관절·가상 카메라를 사용합니다. 사람별 실제 웹캠 정확도는 추가 테스트가 필요합니다. SOLAR 키 적용은 이 로컬 개선의 범위에 포함하지 않습니다.

### 손·무릎 배치 보정

A의 기준 측정 때는 무릎을 편하게 모으고 손을 가운데에, B는 무릎을 자연스럽게 벌리고 각 손을 대응하는 허벅지·무릎에 둡니다. 무릎을 붙여도 양쪽 관절 중심 거리는 0이 아니므로 어깨너비 22% 고정값을 사용하지 않고, 안정된 기준 측정의 무릎 중심 간격 중앙값과 비교합니다. A는 기준보다 벌어짐, B는 기준보다 모임을 확인합니다. 기본 허용 여유는 기준 간격의 25%와 최소 신체 비율 여유 중 큰 값이며 Beta 휴리스틱입니다. 기준 측정 때 이미 무릎을 잘못 배치하면 잘못된 기준이 될 수 있으므로 먼저 기준 안내에 맞춰야 합니다.

손은 Pose 손가락 쪽 관절점이 2개 이상 보이면 중앙값을 손 위치 proxy로 쓰고, 부족하면 손목으로 추정합니다. 전용 Hand Landmarker나 손 모양 인식은 아닙니다. A 중앙 손 영역은 무릎 벌어짐과 독립적으로 계산하며 두 손이 서로 가까워야 합니다. B는 대응하는 골반-무릎 선분 주변의 허벅지~무릎 영역을 허용합니다. 손을 배·가슴 쪽으로 들거나 반대쪽에 놓으면 별도 이슈입니다. 가림/옷/촬영 구도에 따른 오차는 남아 있습니다.

웹 화면은 ‘손 배치’와 ‘무릎 간격’을 나누고, 왼손·오른손 영역과 기준 대비 무릎 간격 배율을 표시합니다. 프런트는 백엔드의 `hand_placement_status`, `knee_placement_status`를 사용해 중복된 고정 임계값 판정을 하지 않습니다. 전체 시간 상태/통계는 기존 `hand_placement` 이벤트 묶음을 유지하며 자세별 세부 원인은 `placement_issues`와 이벤트의 observation으로 구분합니다. 제출된 화면 녹화는 UI 오판 확인과 로컬 재추정에만 사용했으며, 가려진 원본 카메라 픽셀이나 당시 서버 관절값을 복원한 것은 아닙니다. 실영상 최종 정확도는 다시 웹캠으로 확인해야 합니다.

### 기준 보정이 오래 걸릴 때

수집 중 한 프레임의 극단값 때문에 전체 진행을 초기화하지 않습니다. 최소 5초 및 유효 15프레임을 수집하고, 여러 항목이 동시에 기준 중앙값 근처에 있는 프레임이 전체/최근 구간에서 각각 80% 이상인지 확인합니다. 전후 구간 중앙값을 비교해 서서히 기울어지는 움직임이 기준으로 저장되지 않도록 합니다. 낮은 처리 FPS에서는 5초보다 길어질 수 있습니다. 미완료 진행률은 100%로 표시하지 않습니다. 15초 이상 안정된 기준을 얻지 못하면 ‘기준 자세 측정 지연’에 불안정한 추정 항목과 유효 프레임 수를 표시하며, 정상 자세나 경고로 대체하지 않습니다. `calibration` 응답의 `unstable_feature`, `accepted_samples`, `minimum_samples`, `sample_count`로 원인을 확인할 수 있습니다.
