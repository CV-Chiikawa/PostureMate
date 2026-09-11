const messages = {
  head_tilt: "머리 기울기가 유지되고 있습니다. 시선은 편안하게 두고 머리를 중앙으로 조정해보세요.",
  shoulder_height_difference: "양 어깨 높이 차이가 유지되고 있습니다. 어깨의 힘을 풀고 수평을 확인해보세요.",
  torso_lean: "상체가 기울어진 상태가 유지되고 있습니다. 상체를 조금 세워보세요.",
  forward_head_proxy: "기준 자세보다 머리의 앞쪽 변화가 유지되고 있습니다. 화면과 거리를 조정하고 목을 편안히 세워보세요.",
  body_sway: "반복적인 몸 흔들림이 감지되고 있습니다. 잠시 중심을 잡고 자세를 안정시켜보세요.",
  hand_placement: "선택한 면접 Rubric의 손·무릎 배치를 다시 확인해보세요.",
};

export class MockCoachingProvider {
  getMessage(event, mode) {
    if (event.status === "NORMAL") {
      return `${mode.label} 모드의 관찰 조건 안에 있습니다. 편안한 자세를 유지하세요.`;
    }
    if (event.status === "CANDIDATE") {
      return "변화를 관찰하고 있습니다. 순간 동작은 바로 경고하지 않습니다.";
    }
    if (event.status === "RECOVERED") {
      return "중립 범위로 돌아왔습니다. 현재 자세를 편안하게 유지하세요.";
    }
    if (event.status === "COOLDOWN") {
      return "복구를 확인했습니다. 같은 안내가 반복되지 않도록 잠시 대기합니다.";
    }
    return messages[event.eventType] || "현재 자세 변화를 확인하고 편안한 중립 자세로 조정해보세요.";
  }
}

export const mockCoachingProvider = new MockCoachingProvider();
