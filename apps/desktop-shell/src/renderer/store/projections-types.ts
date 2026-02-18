import type { GatewayConnectionState } from "../services/gateway-events.js";

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
