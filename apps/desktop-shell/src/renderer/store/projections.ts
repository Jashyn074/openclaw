import type { GatewayConnectionState, GatewayEvent } from "../services/gateway-events.js";

export type HealthBannerLevel = "ok" | "degraded" | "disconnected";

export type GatewayHealthProjection = {
  connectionState: GatewayConnectionState;
  uptimeSeconds: number;
  lastHeartbeatAt: number | null;
  lastErrorMessage: string | null;
  errorCount: number;
};

export type RunQueueProjection = {
  queueDepth: number;
  activeRuns: number;
  failuresLastHour: number;
};

export type AgentActivityProjection = {
  activeAgents: number;
  idleAgents: number;
  byAgent: Record<string, "active" | "idle">;
};

export type ActivityFeedItem = {
  id: string;
  at: number;
  summary: string;
  level: "info" | "warning" | "error";
};

export type TrainingProjection = {
  datasetQueueDepth: number;
  evaluationRuns: Array<{ id: string; status: "queued" | "running" | "passed" | "failed"; score: number | null }>;
  retrainJobs: Array<{ id: string; trigger: string; status: "queued" | "running" | "completed" | "failed" }>;
  modelRegistry: Array<{
    modelId: string;
    datasetHash: string;
    baseModel: string;
    adapterId: string;
    evalScore: number;
    rollbackPointer: string | null;
  }>;
};

export type OperationsProjectionState = {
  gatewayHealth: GatewayHealthProjection;
  runQueue: RunQueueProjection;
  agentActivity: AgentActivityProjection;
  training: TrainingProjection;
  activityFeed: ActivityFeedItem[];
  lastUpdatedAt: number | null;
};

const feedLimit = 40;

export function createInitialOperationsState(): OperationsProjectionState {
  return {
    gatewayHealth: {
      connectionState: "connecting",
      uptimeSeconds: 0,
      lastHeartbeatAt: null,
      lastErrorMessage: null,
      errorCount: 0,
    },
    runQueue: {
      queueDepth: 0,
      activeRuns: 0,
      failuresLastHour: 0,
    },
    agentActivity: {
      activeAgents: 0,
      idleAgents: 0,
      byAgent: {},
    },
    training: {
      datasetQueueDepth: 0,
      evaluationRuns: [],
      retrainJobs: [],
      modelRegistry: [],
    },
    activityFeed: [],
    lastUpdatedAt: null,
  };
}

function addFeedItem(
  items: ActivityFeedItem[],
  at: number,
  summary: string,
  level: ActivityFeedItem["level"] = "info",
): ActivityFeedItem[] {
  const item: ActivityFeedItem = {
    id: `${at}-${summary}`,
    at,
    summary,
    level,
  };

  return [item, ...items].slice(0, feedLimit);
}

function deriveHealthBanner(gatewayHealth: GatewayHealthProjection): HealthBannerLevel {
  if (gatewayHealth.connectionState === "disconnected") {
    return "disconnected";
  }

  if (gatewayHealth.connectionState === "degraded" || gatewayHealth.errorCount > 0) {
    return "degraded";
  }

  return "ok";
}

export function applyGatewayEvent(
  state: OperationsProjectionState,
  event: GatewayEvent,
  at: number,
): OperationsProjectionState {
  let next: OperationsProjectionState = {
    ...state,
    gatewayHealth: { ...state.gatewayHealth },
    runQueue: { ...state.runQueue },
    agentActivity: {
      ...state.agentActivity,
      byAgent: { ...state.agentActivity.byAgent },
    },
    training: {
      ...state.training,
      evaluationRuns: [...state.training.evaluationRuns],
      retrainJobs: [...state.training.retrainJobs],
      modelRegistry: [...state.training.modelRegistry],
    },
    activityFeed: [...state.activityFeed],
    lastUpdatedAt: at,
  };

  switch (event.type) {
    case "gateway.connected": {
      next.gatewayHealth.connectionState = "connected";
      next.gatewayHealth.lastErrorMessage = null;
      next.activityFeed = addFeedItem(next.activityFeed, at, "Gateway connection established.");
      break;
    }
    case "gateway.disconnected": {
      next.gatewayHealth.connectionState = "disconnected";
      next.gatewayHealth.lastErrorMessage = event.reason ?? "Gateway disconnected.";
      next.gatewayHealth.errorCount += 1;
      next.activityFeed = addFeedItem(next.activityFeed, at, "Gateway disconnected.", "warning");
      break;
    }
    case "gateway.heartbeat": {
      next.gatewayHealth.connectionState = "connected";
      next.gatewayHealth.lastHeartbeatAt = at;
      next.gatewayHealth.uptimeSeconds = event.uptimeSeconds;
      break;
    }
    case "queue.snapshot": {
      next.runQueue.queueDepth = event.queueDepth;
      next.runQueue.activeRuns = event.activeRuns;
      next.runQueue.failuresLastHour = event.failuresLastHour;
      next.activityFeed = addFeedItem(next.activityFeed, at, "Queue snapshot refreshed.");
      break;
    }
    case "queue.updated": {
      next.runQueue.queueDepth = event.queueDepth;
      next.activityFeed = addFeedItem(next.activityFeed, at, `Queue depth updated to ${event.queueDepth}.`);
      break;
    }
    case "run.started": {
      next.runQueue.activeRuns += 1;
      next.runQueue.queueDepth = Math.max(0, next.runQueue.queueDepth - 1);
      next.activityFeed = addFeedItem(next.activityFeed, at, `Run ${event.runId} started by ${event.agentId}.`);
      break;
    }
    case "run.finished": {
      next.runQueue.activeRuns = Math.max(0, next.runQueue.activeRuns - 1);
      next.activityFeed = addFeedItem(next.activityFeed, at, `Run ${event.runId} completed by ${event.agentId}.`);
      break;
    }
    case "run.failed": {
      next.runQueue.activeRuns = Math.max(0, next.runQueue.activeRuns - 1);
      next.runQueue.failuresLastHour += 1;
      next.activityFeed = addFeedItem(next.activityFeed, at, `Run ${event.runId} failed: ${event.reason}`, "error");
      break;
    }
    case "agent.activity": {
      next.agentActivity.byAgent[event.agentId] = event.status;
      const statuses = Object.values(next.agentActivity.byAgent);
      next.agentActivity.activeAgents = statuses.filter((value) => value === "active").length;
      next.agentActivity.idleAgents = statuses.filter((value) => value === "idle").length;
      next.activityFeed = addFeedItem(next.activityFeed, at, `Agent ${event.agentId} is now ${event.status}.`);
      break;
    }
    case "system.notice": {
      if (event.level !== "info") {
        next.gatewayHealth.connectionState = "degraded";
        next.gatewayHealth.errorCount += 1;
        next.gatewayHealth.lastErrorMessage = event.message;
      }
      next.activityFeed = addFeedItem(next.activityFeed, at, event.message, event.level);
      break;
    }
  }

  const banner = deriveHealthBanner(next.gatewayHealth);
  if (banner === "ok" && next.gatewayHealth.connectionState !== "connected") {
    next.gatewayHealth.connectionState = "connecting";
  }

  return next;
}

export function selectHealthBanner(state: OperationsProjectionState): HealthBannerLevel {
  return deriveHealthBanner(state.gatewayHealth);
}
