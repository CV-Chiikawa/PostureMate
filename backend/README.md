# 거북목 데모 이벤트 → Solar Pro 4

FastAPI가 JPEG를 검증한 뒤 **합성 자세 이벤트**를 만듭니다. `analysis_source: "demo"`는 계속 유지합니다. MediaPipe와 화면 연결은 아직 포함되지 않습니다. `neck` 모드에서만 서버가 [Upstage Chat Completions API](https://console.upstage.ai/ko/api/chat)의 `solar-pro4`를 호출합니다.

## 로컬 실행

저장소 루트에서 Python **3.11 이상**과 PowerShell을 사용합니다.

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend/requirements.txt
# 이 터미널의 서버 프로세스에서만 사용. 이미 설정한 경우 생략.
$env:UPSTAGE_API_KEY = [System.Net.NetworkCredential]::new('', (Read-Host 'Upstage API key' -AsSecureString)).Password
.\.venv\Scripts\python.exe -m uvicorn backend.app:app --host 127.0.0.1 --port 8000
```

키 입력 줄을 생략하고 키 없는 환경에서 실행해도 경고와 고정 안내는 동작합니다. 키는 프론트의 `VITE_*` 변수에 넣지 않습니다. 인증 없는 **로컬·단일 워커 데모**입니다. 세션은 메모리에 최대 128개 유지하고, 5분 동안 입력이 없던 세션은 다음 요청 때 정리합니다.

두 번째 터미널에서:

```powershell
# 모의 Upstage 응답으로 검사. 키와 실행 중인 서버가 필요하지 않습니다.
.\.venv\Scripts\python.exe -m unittest discover -s backend -p "test_*.py" -v
# 실행 중인 서버에 합성 JPEG 전송. 서버에 실제 키가 있으면 최대 두 번 실호출합니다.
.\.venv\Scripts\python.exe -m backend.smoke_neck
# 키 없는 서버에서는 대체 문구 경로만 별도 검증
.\.venv\Scripts\python.exe -m backend.smoke_neck --expect-fallback
```

## 프레임과 호출 규칙

- 기존 `POST /process-frame`의 multipart 필드와 응답은 유지합니다. `mode=neck`, `rubric=""`으로 JPEG를 보냅니다. 추가 필드는 최상위 `coaching`뿐입니다.
- 첫 프레임부터 세면 11번째에 주의, 46번째에 경고, 81번째에 복구합니다. 이는 시연용 프레임 순서이며 임상 기준이 아닙니다. 기본 5 FPS에서 주의·경고가 각각 약 7초 지속됩니다.
- 새 이벤트는 고정 문구와 즉시 반환합니다. 모델 입력은 모드·루브릭·유형·심각도·지속시간·측정값뿐입니다. JPEG·세션 ID는 전송하지 않습니다.
- 같은 세션·유형·심각도는 호출 시작 후 **30초** 동안 재호출하지 않습니다. 주의와 경고는 별도로 셉니다. 같은 이벤트가 계속되는 동안은 30초를 넘겨도 다시 요청하지 않습니다.
- SOLAR만 **최대 5초** 기다립니다. 시간 초과, 키 누락, 호출 오류, 사용할 수 없는 답변은 고정 문구로 끝나며 자동 재시도하지 않습니다. 프레임 전송은 계속됩니다.

## 프론트 인계: 이벤트 ID로 문장 연결

아래는 같은 세션의 **응답 일부**입니다. 첫 주의 이벤트에서 기본 안내를 표시하고 `event.event_id`를 현재 경고 ID로 보관합니다.

```json
{
  "session_id": "sample", "state": "CAUTION",
  "event": {"event_id": "demo:sample:neck:caution:10", "type": "forward_head_proxy", "severity": "caution"},
  "coaching": {"event_id": "demo:sample:neck:caution:10", "source": "fallback", "message": "고개가 기준 자세보다 앞으로 나왔어요. 처음 편안하게 앉았던 위치로 돌아와 보세요."}
}
```

문장이 준비된 뒤 **처음 오는 유효한 프레임**에 한 번 전달합니다. 이때 `event`는 이미 전달했으므로 `null`일 수 있습니다. 예시 문구:

```json
{
  "session_id": "sample", "state": "CAUTION", "event": null,
  "coaching": {"event_id": "demo:sample:neck:caution:10", "source": "solar", "message": "고개가 앞으로 나왔어요. 처음 앉았던 위치로 돌아와 보세요."}
}
```

`AnalysisResponseAdapter`에서 선택 필드 `coaching`을 보존하고 현재 세션·이벤트 ID가 **모두** 일치할 때만 문구를 교체합니다. `coaching: null`은 새 문구가 없다는 뜻이므로 같은 이벤트의 표시 문구는 유지합니다. 복구·모드 변경·세션 종료 시 현재 ID를 비웁니다. 일시정지 중에는 프레임이 없으므로 문장을 전달하지 않습니다. 웹캠 UI 수정은 프론트 담당자 범위입니다.
