import { useCallback, useEffect, useRef, useState } from "react";

export function useCamera(enabled, onUnavailable) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const requestIdRef = useRef(0);
  const [devices, setDevices] = useState([]);
  const [deviceId, setDeviceId] = useState("");
  const [preferredDevice, selectDevice] = useState("");
  const [permission, setPermission] = useState("idle");
  const [error, setError] = useState("");

  const stop = useCallback(() => {
    requestIdRef.current += 1;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setPermission("idle");
  }, []);

  const start = useCallback(async (requestedDeviceId = "") => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setPermission("unavailable");
      setError("이 브라우저에서는 Webcam API를 사용할 수 없습니다.");
      return;
    }
    stop();
    const requestId = requestIdRef.current;
    setPermission("requesting");
    setError("");
    try {
      const constraints = {
        video: requestedDeviceId
          ? { deviceId: { exact: requestedDeviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
          : { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (requestId !== requestIdRef.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      streamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      track.addEventListener("ended", () => {
        if (requestId !== requestIdRef.current) return;
        stop();
        onUnavailable("camera_unavailable");
        setError("카메라 연결이 끊겼습니다. 장치를 연결하고 다시 시도하세요.");
      }, { once: true });
      if (videoRef.current) videoRef.current.srcObject = stream;
      setPermission("granted");
      const allDevices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
      if (requestId !== requestIdRef.current) return;
      const cameras = allDevices.filter((device) => device.kind === "videoinput");
      setDevices(cameras);
      const activeId = track.getSettings().deviceId || requestedDeviceId;
      if (activeId) setDeviceId(activeId);
    } catch (cameraError) {
      if (requestId !== requestIdRef.current) return;
      const denied = cameraError?.name === "NotAllowedError" || cameraError?.name === "SecurityError";
      setPermission(denied ? "denied" : "error");
      setError(denied
        ? "카메라 권한이 거부되었습니다. 주소창의 사이트 설정에서 카메라를 허용하고 다시 시도하세요."
        : `카메라를 시작하지 못했습니다: ${cameraError?.message || "알 수 없는 오류"}`);
    }
  }, [stop, onUnavailable]);

  useEffect(() => {
    if (!enabled) return;
    // React can mount and release a preview within the same turn.
    let active = true;
    queueMicrotask(() => { if (active) start(preferredDevice); });
    return () => {
      active = false;
      stop();
    };
  }, [enabled, preferredDevice, start, stop]);

  return { videoRef, devices, deviceId, selectDevice, permission, error, retry: () => start(preferredDevice) };
}
