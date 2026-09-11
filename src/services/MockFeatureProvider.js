import { MOCK_SCENARIOS } from "../data/mockScenarios.js";

export class MockFeatureProvider {
  getScenario(index) {
    return MOCK_SCENARIOS[index % MOCK_SCENARIOS.length];
  }

  getFeatures(index) {
    const scenario = this.getScenario(index);
    return {
      source: "mock",
      capturedAt: Date.now(),
      scenarioId: scenario.id,
      values: { ...scenario.features },
    };
  }
}

export const mockFeatureProvider = new MockFeatureProvider();
