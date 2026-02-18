import type { GatewayConnectionState, GatewayEvent } from "../services/gateway-events.js";
import type {
  DatasetCurationRecord,
  DatasetCurationStatus,
  EvaluationRunRecord,
  EvaluationRunStatus,
  ModelRegistryEntry,
  ModelRegistryStatus,
  RetrainJobRecord,
  RetrainJobStatus,
} from "./training-models.js";

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
  datasetCuration: DatasetCurationRecord[];
  evaluationRuns: EvaluationRunRecord[];
  retrainJobs: RetrainJobRecord[];
  modelRegistry: ModelRegistryEntry[];
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
const recordListLimit = 8;

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
      datasetCuration: [],
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

function upsertRecordByKey<T extends { updatedAt: number }, K extends keyof T>(
  records: T[],
  key: K,
  value: T[K],
  createOrUpdate: (existing: T | null) => T,
): T[] {
  const next = [...records];
  const index = next.findIndex((record) => record[key] === value);
  const existing = index >= 0 ? next[index] : null;
  const updated = createOrUpdate(existing);

  if (index >= 0) {
    next[index] = updated;
  } else {
    next.unshift(updated);
  }

  return next
    .toSorted((left, right) => right.updatedAt - left.updatedAt)
    .slice(0, recordListLimit);
}

function updateDatasetQueueDepth(records: DatasetCurationRecord[]): number {
  const queuedStates = new Set<DatasetCurationStatus>(["queued", "curating"]);
  return records.filter((record) => queuedStates.has(record.status)).length;
}

function transitionEvaluationStatus(
  status: EvaluationRunStatus,
  score: number | null,
): { status: EvaluationRunStatus; score: number | null } {
  if ((status === "passed" || status === "failed") && score === null) {
    return { status, score: 0 };
  }

  return { status, score };
}

function transitionRetrainStatus(status: RetrainJobStatus): RetrainJobStatus {
  return status;
}

function transitionRegistryStatus(
  status: ModelRegistryStatus,
  rollbackPointer: string | null,
): { status: ModelRegistryStatus; rollbackPointer: string | null } {
  if (status === "rolled_back" && !rollbackPointer) {
    return { status, rollbackPointer: "manual" };
  }

  return { status, rollbackPointer };
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
      datasetCuration: [...state.training.datasetCuration],
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
    case "training.dataset.recorded": {
      next.training.datasetCuration = upsertRecordByKey(
        next.training.datasetCuration,
        "datasetId",
        event.datasetId,
        (existing) => ({
          datasetId: event.datasetId,
          status: event.status,
          itemCount: event.itemCount,
          owner: event.owner,
          notes: event.notes ?? existing?.notes ?? null,
          updatedAt: at,
        }),
      );
      next.training.datasetQueueDepth = updateDatasetQueueDepth(next.training.datasetCuration);
      next.activityFeed = addFeedItem(next.activityFeed, at, `Dataset ${event.datasetId} recorded as ${event.status}.`);
      break;
    }
    case "training.dataset.transitioned": {
      next.training.datasetCuration = upsertRecordByKey(
        next.training.datasetCuration,
        "datasetId",
        event.datasetId,
        (existing) => ({
          datasetId: event.datasetId,
          status: event.status,
          itemCount: existing?.itemCount ?? 0,
          owner: existing?.owner ?? "unknown",
          notes: event.notes ?? existing?.notes ?? null,
          updatedAt: at,
        }),
      );
      next.training.datasetQueueDepth = updateDatasetQueueDepth(next.training.datasetCuration);
      next.activityFeed = addFeedItem(next.activityFeed, at, `Dataset ${event.datasetId} transitioned to ${event.status}.`);
      break;
    }
    case "training.evaluation.recorded": {
      next.training.evaluationRuns = upsertRecordByKey(
        next.training.evaluationRuns,
        "evaluationId",
        event.evaluationId,
        () => ({
          evaluationId: event.evaluationId,
          modelId: event.modelId,
          datasetId: event.datasetId,
          status: event.status,
          score: event.score ?? null,
          updatedAt: at,
        }),
      );
      next.activityFeed = addFeedItem(next.activityFeed, at, `Evaluation ${event.evaluationId} recorded as ${event.status}.`);
      break;
    }
    case "training.evaluation.transitioned": {
      next.training.evaluationRuns = upsertRecordByKey(
        next.training.evaluationRuns,
        "evaluationId",
        event.evaluationId,
        (existing) => {
          const transition = transitionEvaluationStatus(event.status, event.score ?? existing?.score ?? null);
          return {
            evaluationId: event.evaluationId,
            modelId: existing?.modelId ?? "unknown",
            datasetId: existing?.datasetId ?? "unknown",
            status: transition.status,
            score: transition.score,
            updatedAt: at,
          };
        },
      );
      next.activityFeed = addFeedItem(
        next.activityFeed,
        at,
        `Evaluation ${event.evaluationId} transitioned to ${event.status}.`,
      );
      break;
    }
    case "training.retrain.recorded": {
      next.training.retrainJobs = upsertRecordByKey(next.training.retrainJobs, "jobId", event.jobId, () => ({
        jobId: event.jobId,
        trigger: event.trigger,
        modelId: event.modelId,
        status: event.status,
        updatedAt: at,
      }));
      next.activityFeed = addFeedItem(next.activityFeed, at, `Retrain job ${event.jobId} recorded as ${event.status}.`);
      break;
    }
    case "training.retrain.transitioned": {
      next.training.retrainJobs = upsertRecordByKey(next.training.retrainJobs, "jobId", event.jobId, (existing) => ({
        jobId: event.jobId,
        trigger: existing?.trigger ?? "manual",
        modelId: existing?.modelId ?? "unknown",
        status: transitionRetrainStatus(event.status),
        updatedAt: at,
      }));
      next.activityFeed = addFeedItem(next.activityFeed, at, `Retrain job ${event.jobId} transitioned to ${event.status}.`);
      break;
    }
    case "training.registry.recorded": {
      next.training.modelRegistry = upsertRecordByKey(next.training.modelRegistry, "modelId", event.modelId, () => ({
        modelId: event.modelId,
        status: event.status,
        datasetId: event.datasetId,
        datasetHash: event.datasetHash,
        baseModel: event.baseModel,
        adapterId: event.adapterId,
        evalScore: event.evalScore ?? null,
        rollbackPointer: event.rollbackPointer ?? null,
        updatedAt: at,
      }));
      next.activityFeed = addFeedItem(next.activityFeed, at, `Model ${event.modelId} recorded in registry.`);
      break;
    }
    case "training.registry.transitioned": {
      next.training.modelRegistry = upsertRecordByKey(next.training.modelRegistry, "modelId", event.modelId, (existing) => {
        const transition = transitionRegistryStatus(event.status, event.rollbackPointer ?? existing?.rollbackPointer ?? null);
        return {
          modelId: event.modelId,
          status: transition.status,
          datasetId: existing?.datasetId ?? "unknown",
          datasetHash: existing?.datasetHash ?? "unknown",
          baseModel: existing?.baseModel ?? "unknown",
          adapterId: existing?.adapterId ?? "unknown",
          evalScore: event.evalScore ?? existing?.evalScore ?? null,
          rollbackPointer: transition.rollbackPointer,
          updatedAt: at,
        };
      });
      next.activityFeed = addFeedItem(next.activityFeed, at, `Model ${event.modelId} transitioned to ${event.status}.`);
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
