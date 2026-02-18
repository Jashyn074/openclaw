import type { GatewayEvent } from "../services/gateway-events.js";
import {
  createInitialAgentActivityProjection,
  reduceAgentActivity,
  selectBusyAgentRatio,
} from "./reducers/agent-activity.js";
import { reduceActivityFeed, selectLatestFeedItem } from "./reducers/activity-feed.js";
import {
  createInitialGatewayHealthProjection,
  deriveHealthBanner,
  normalizeGatewayHealthForBanner,
  reduceGatewayHealth as reduceGatewayHealthDomain,
} from "./reducers/gateway-health.js";
import { createInitialRunQueueProjection, reduceRunQueue, selectQueueLoad } from "./reducers/run-queue.js";
import {
  createInitialTrainingProjection,
  reduceTraining,
  selectLatestEvaluationScore,
} from "./reducers/training.js";
import type {
  ActivityFeedItem,
  AgentActivityProjection,
  GatewayHealthProjection,
  HealthBannerLevel,
  OperationsProjectionState,
  RunQueueProjection,
  TrainingProjection,
} from "./projections-types.js";

export type {
  ActivityFeedItem,
  AgentActivityProjection,
  GatewayHealthProjection,
  HealthBannerLevel,
  OperationsProjectionState,
  RunQueueProjection,
  TrainingProjection,
};

export function createInitialOperationsState(): OperationsProjectionState {
  return {
    gatewayHealth: createInitialGatewayHealthProjection(),
    runQueue: createInitialRunQueueProjection(),
    agentActivity: createInitialAgentActivityProjection(),
    training: createInitialTrainingProjection(),
    activityFeed: [],
    lastUpdatedAt: null,
  };
}

export function applyGatewayEvent(
  state: OperationsProjectionState,
  event: GatewayEvent,
  at: number,
): OperationsProjectionState {
  const gatewayHealth = normalizeGatewayHealthForBanner(reduceGatewayHealthDomain(state.gatewayHealth, event, at));

  return {
    gatewayHealth,
    runQueue: reduceRunQueue(state.runQueue, event),
    agentActivity: reduceAgentActivity(state.agentActivity, event),
    training: reduceTraining(state.training, event),
    activityFeed: reduceActivityFeed(state.activityFeed, event, at),
    lastUpdatedAt: at,
  };
}

export function selectHealthBanner(state: OperationsProjectionState): HealthBannerLevel {
  return deriveHealthBanner(state.gatewayHealth);
}

export function selectRunQueueLoad(state: OperationsProjectionState): number {
  return selectQueueLoad(state.runQueue);
}

export function selectAgentBusyRatio(state: OperationsProjectionState): number {
  return selectBusyAgentRatio(state.agentActivity);
}

export function selectLatestActivity(state: OperationsProjectionState): ActivityFeedItem | null {
  return selectLatestFeedItem(state.activityFeed);
}

export function selectLatestTrainingEvaluationScore(state: OperationsProjectionState): number | null {
  return selectLatestEvaluationScore(state.training);
}

// Keep reducer-style helper exported from this module to preserve import ergonomics for store code.
export function reduceGatewayHealth(
  state: GatewayHealthProjection,
  event: GatewayEvent,
  at: number,
): GatewayHealthProjection {
  return normalizeGatewayHealthForBanner(reduceGatewayHealthDomain(state, event, at));
}
