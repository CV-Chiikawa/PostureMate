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
