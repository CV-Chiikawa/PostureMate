"""PostureMate's per-user Upstage credential on this Windows computer."""
import argparse
import logging
import os
import sys

TARGET = "PostureMate/Upstage"
logger = logging.getLogger(__name__)


def normalized_key(value):
    key = value.strip()
    if not key or not all("!" <= char <= "~" for char in key) or len(key.encode("utf-16-le")) > 2560:
        raise ValueError("공백 없이 Upstage API 키를 입력해 주세요.")
    return key


def read_saved_key():
    if sys.platform != "win32":
        return None
    import pywintypes
    import win32cred

    try:
        entry = win32cred.CredRead(TARGET, win32cred.CRED_TYPE_GENERIC)
        return normalized_key(entry["CredentialBlob"].decode("utf-16-le"))
    except pywintypes.error as error:
        if error.winerror != 1168:  # ERROR_NOT_FOUND is normal before registration.
            logger.warning("Windows credential unavailable (Win32 %s)", error.winerror)
    except (ValueError, KeyError):
        logger.warning("PostureMate credential must be registered again")
    return None


def save_key(value):
    import win32cred

    key = normalized_key(value)
    win32cred.CredWrite({
        "Type": win32cred.CRED_TYPE_GENERIC,
        "TargetName": TARGET,
        "UserName": "PostureMate",
        "CredentialBlob": key,
        "Persist": win32cred.CRED_PERSIST_LOCAL_MACHINE,
    })


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("save", "status"))
    args = parser.parse_args()
    if sys.platform != "win32":
        parser.exit(1, "Windows에서 실행해 주세요.\n")
    if args.action == "status":
        saved = bool(read_saved_key())
        print("등록됨" if saved else "미등록")
        return 0 if saved else 1

    import pywintypes
    import win32cred

    try:
        key = os.getenv("UPSTAGE_API_KEY")
        if not key:
            _, key, _ = win32cred.CredUIPromptForCredentials(
                TARGET, 0, "PostureMate", None, False,
                win32cred.CREDUI_FLAGS_GENERIC_CREDENTIALS | win32cred.CREDUI_FLAGS_ALWAYS_SHOW_UI
                | win32cred.CREDUI_FLAGS_KEEP_USERNAME | win32cred.CREDUI_FLAGS_DO_NOT_PERSIST,
                {"CaptionText": "PostureMate · Upstage 키 등록",
                 "MessageText": "암호 칸에 Upstage API 키를 입력하세요. 확인하면 이 PC의 Windows 자격 증명 관리자에 저장합니다."},
            )
        save_key(key)
    except pywintypes.error as error:
        if error.winerror == 1223:  # ERROR_CANCELLED
            print("등록을 취소했습니다.")
            return 1
        parser.exit(1, f"자격 증명을 저장하지 못했습니다 (Win32 {error.winerror}).\n")
    except ValueError as error:
        parser.exit(1, f"{error}\n")
    print("PostureMate/Upstage 키를 저장했습니다.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
