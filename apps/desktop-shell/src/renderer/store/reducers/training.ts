import type { GatewayEvent } from "../../services/gateway-events.js";
import type { TrainingProjection } from "../projections-types.js";

export function createInitialTrainingProjection(): TrainingProjection {
  return {
    datasetQueueDepth: 0,
    evaluationRuns: [],
    retrainJobs: [],
    modelRegistry: [],
  };
}

// Training events are not streamed yet; keep this reducer isolated so event handling can be added
// without touching the rest of the projection pipeline.
export function reduceTraining(state: TrainingProjection, _event: GatewayEvent): TrainingProjection {
  return state;
}

export function selectLatestEvaluationScore(state: TrainingProjection): number | null {
  return state.evaluationRuns[0]?.score ?? null;
}
