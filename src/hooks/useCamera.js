import { useCallback, useEffect, useRef, useState } from "react";

export function useCamera() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [devices, setDevices] = useState([]);
  const [deviceId, setDeviceId] = useState("");
  const [permission, setPermission] = useState("idle");
  const [error, setError] = useState("");

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const start = useCallback(async (requestedDeviceId = "") => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setPermission("unavailable");
      setError("이 브라우저에서는 Webcam API를 사용할 수 없습니다.");
      return;
    }
    setPermission("requesting");
    setError("");
    stop();
    try {
      const constraints = {
        video: requestedDeviceId
          ? { deviceId: { exact: requestedDeviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
          : { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setPermission("granted");
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const cameras = allDevices.filter((device) => device.kind === "videoinput");
      setDevices(cameras);
      const activeId = stream.getVideoTracks()[0]?.getSettings().deviceId || requestedDeviceId;
      if (activeId) setDeviceId(activeId);
      if (!cameras.length) setError("사용 가능한 Camera Device를 찾지 못했습니다.");
    } catch (cameraError) {
      const denied = cameraError?.name === "NotAllowedError" || cameraError?.name === "SecurityError";
      setPermission(denied ? "denied" : "error");
      setError(denied
        ? "카메라 권한이 거부되었습니다. 브라우저 설정을 확인하거나 데모 모드를 사용하세요."
        : `카메라를 시작하지 못했습니다: ${cameraError?.message || "알 수 없는 오류"}`);
    }
  }, [stop]);

  const selectDevice = useCallback((nextDeviceId) => {
    setDeviceId(nextDeviceId);
    start(nextDeviceId);
  }, [start]);

  useEffect(() => stop, [stop]);

  return { videoRef, devices, deviceId, selectDevice, permission, error, start, retry: () => start(deviceId), stop };
}
