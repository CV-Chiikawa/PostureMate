import { calculateDirectorScore } from "../utils/director";

const CAMERA_INFO = {
  A: {
    id: "A",
    name: "CAMERA A",
    position: "LEFT ANGLE",
  },

  B: {
    id: "B",
    name: "CAMERA B",
    position: "RIGHT ANGLE",
  },
};

const SCENARIOS = [
  {
    A: {
      faceSize: 82,
      frontal: 91,
      center: 92,
      visibility: 97,
      subjectX: 50,
      subjectScale: 1,
    },

    B: {
      faceSize: 41,
      frontal: 55,
      center: 62,
      visibility: 88,
      subjectX: 72,
      subjectScale: 0.68,
    },
  },

  {
    A: {
      faceSize: 78,
      frontal: 88,
      center: 86,
      visibility: 96,
      subjectX: 54,
      subjectScale: 0.95,
    },

    B: {
      faceSize: 54,
      frontal: 68,
      center: 70,
      visibility: 91,
      subjectX: 64,
      subjectScale: 0.78,
    },
  },

  {
    A: {
      faceSize: 59,
      frontal: 64,
      center: 66,
      visibility: 89,
      subjectX: 65,
      subjectScale: 0.8,
    },

    B: {
      faceSize: 80,
      frontal: 91,
      center: 87,
      visibility: 96,
      subjectX: 52,
      subjectScale: 0.98,
    },
  },

  {
    A: {
      faceSize: 47,
      frontal: 51,
      center: 56,
      visibility: 82,
      subjectX: 71,
      subjectScale: 0.7,
    },

    B: {
      faceSize: 89,
      frontal: 96,
      center: 94,
      visibility: 98,
      subjectX: 49,
      subjectScale: 1.08,
    },
  },

  {
    A: {
      faceSize: 57,
      frontal: 67,
      center: 70,
      visibility: 90,
      subjectX: 62,
      subjectScale: 0.78,
    },

    B: {
      faceSize: 84,
      frontal: 93,
      center: 90,
      visibility: 97,
      subjectX: 51,
      subjectScale: 1.02,
    },
  },

  {
    A: {
      faceSize: 85,
      frontal: 93,
      center: 90,
      visibility: 97,
      subjectX: 51,
      subjectScale: 1.03,
    },

    B: {
      faceSize: 61,
      frontal: 70,
      center: 65,
      visibility: 90,
      subjectX: 35,
      subjectScale: 0.79,
    },
  },

  {
    A: {
      faceSize: 90,
      frontal: 96,
      center: 95,
      visibility: 98,
      subjectX: 50,
      subjectScale: 1.08,
    },

    B: {
      faceSize: 45,
      frontal: 54,
      center: 58,
      visibility: 84,
      subjectX: 27,
      subjectScale: 0.68,
    },
  },
];

export function getMockCameras(scenarioIndex) {
  const scenario =
    SCENARIOS[scenarioIndex % SCENARIOS.length];

  return ["A", "B"].map((id) => {
    const metrics = scenario[id];

    return {
      ...CAMERA_INFO[id],
      ...metrics,
      score: calculateDirectorScore(metrics),
    };
  });
}

export const MOCK_SCENARIO_COUNT =
  SCENARIOS.length;