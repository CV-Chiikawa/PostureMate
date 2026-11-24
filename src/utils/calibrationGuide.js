const FEATURE_NAMES = {head:"머리",shoulder:"어깨",lateral:"상체 좌우",forward:"상체 전방",
  scale:"카메라 거리",torso_ratio:"상체 비율",knee:"무릎 간격"};

export function referenceNotice(reason, calibration, mode, rubric) {
  const c=calibration ?? {};
  const feature=FEATURE_NAMES[c.unstable_feature] || "관절";
  const accepted=Number.isFinite(c.accepted_samples) ? c.accepted_samples : 0;
  const minimum=Number.isFinite(c.minimum_samples) ? c.minimum_samples : 15;
  const frames=`유효 프레임 ${Math.min(accepted,minimum)}/${minimum}`;
  if (reason === "reference_timeout") {
    return {title:"기준 자세 측정 지연",message:`${feature} 추정값이 안정되지 않거나 프레임이 부족해 기준을 아직 저장하지 않았습니다. ${frames}. 얼굴·어깨·골반과 필요한 손·무릎이 보이게 구도를 조정한 뒤 다시 측정해 주세요.`};
  }
  const posture=mode === "interview"
    ? (rubric === "A" ? "무릎을 편하게 모으고 두 손을 가운데 둔 자세" : "무릎을 자연스럽게 벌리고 각 손을 같은 쪽 무릎에 둔 자세")
    : "바른 자세";
  const progress=Math.round(Math.max(0,Math.min(1,Number.isFinite(c.progress) ? c.progress : 0))*100);
  const unstable=reason === "reference_unstable" ? `${feature} 추정값의 변동을 확인 중입니다. ` : "";
  return {title:"기준 자세 보정 중",message:`${unstable}${posture}로 구도를 맞추고 약 5초간 유지해 주세요. (${progress}% · ${frames}) 일시적으로 튄 추정값은 제외합니다.`};
}
