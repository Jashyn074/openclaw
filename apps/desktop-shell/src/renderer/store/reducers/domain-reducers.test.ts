import { describe, expect, it } from "vitest";
import { reduceAgentActivity, selectBusyAgentRatio } from "./agent-activity.js";
import { reduceActivityFeed, selectLatestFeedItem } from "./activity-feed.js";
import {
  createInitialGatewayHealthProjection,
  deriveHealthBanner,
  normalizeGatewayHealthForBanner,
  reduceGatewayHealth,
} from "./gateway-health.js";
import { createInitialRunQueueProjection, reduceRunQueue, selectQueueLoad } from "./run-queue.js";
import { createInitialTrainingProjection, reduceTraining, selectLatestEvaluationScore } from "./training.js";

describe("domain reducers", () => {
  it("updates gateway health transitions and keeps banner derivation stable", () => {
    const initial = createInitialGatewayHealthProjection();
    const withWarning = reduceGatewayHealth(
      initial,
      { type: "system.notice", level: "warning", message: "Latency rising" },
      1_000,
    );
    const normalized = normalizeGatewayHealthForBanner(withWarning);

    expect(deriveHealthBanner(normalized)).toBe("degraded");
    expect(normalized.lastErrorMessage).toBe("Latency rising");
    expect(normalized.errorCount).toBe(1);
  });

  it("updates run queue metrics and selector", () => {
    const initial = createInitialRunQueueProjection();
    const withSnapshot = reduceRunQueue(initial, { type: "queue.snapshot", queueDepth: 5, activeRuns: 2, failuresLastHour: 1 });
    const withRunStart = reduceRunQueue(withSnapshot, { type: "run.started", runId: "r1", agentId: "agent-1" });

    expect(withRunStart.queueDepth).toBe(4);
    expect(withRunStart.activeRuns).toBe(3);
    expect(selectQueueLoad(withRunStart)).toBe(7);
  });

  it("aggregates agent state and busy ratio", () => {
    const initial = { activeAgents: 0, idleAgents: 0, byAgent: {} };
    const withA = reduceAgentActivity(initial, { type: "agent.activity", agentId: "a", status: "active" });
    const withB = reduceAgentActivity(withA, { type: "agent.activity", agentId: "b", status: "idle" });

    expect(withB.activeAgents).toBe(1);
    expect(withB.idleAgents).toBe(1);
    expect(selectBusyAgentRatio(withB)).toBe(0.5);
  });

  it("emits feed entries and latest selector", () => {
    const initial: Array<{ id: string; at: number; summary: string; level: "info" | "warning" | "error" }> = [];
    const withQueue = reduceActivityFeed(initial, { type: "queue.updated", queueDepth: 3 }, 1_000);
    const withFailure = reduceActivityFeed(
      withQueue,
      { type: "run.failed", runId: "r2", agentId: "agent-2", reason: "timeout" },
      2_000,
    );

    expect(selectLatestFeedItem(withFailure)?.summary).toContain("failed");
    expect(withFailure).toHaveLength(2);
  });

  it("keeps training projection unchanged until training events are added", () => {
    const initial = createInitialTrainingProjection();
    const updated = reduceTraining(initial, { type: "queue.updated", queueDepth: 9 });

    expect(updated).toEqual(initial);
    expect(selectLatestEvaluationScore(updated)).toBeNull();
  });
});
