import { describe, expect, it } from "vitest";
import { applyGatewayEvent, createInitialOperationsState, selectHealthBanner } from "./projections.js";

describe("operations projections", () => {
  it("tracks queue and run state transitions deterministically", () => {
    const initial = createInitialOperationsState();

    const snapshot = applyGatewayEvent(
      initial,
      { type: "queue.snapshot", queueDepth: 4, activeRuns: 1, failuresLastHour: 2 },
      1_000,
    );
    const started = applyGatewayEvent(snapshot, { type: "run.started", runId: "r1", agentId: "agent-a" }, 1_500);
    const failed = applyGatewayEvent(
      started,
      { type: "run.failed", runId: "r1", agentId: "agent-a", reason: "timeout" },
      2_000,
    );

    expect(failed.runQueue.queueDepth).toBe(3);
    expect(failed.runQueue.activeRuns).toBe(1);
    expect(failed.runQueue.failuresLastHour).toBe(3);
    expect(failed.activityFeed[0]?.summary).toContain("failed");
  });

  it("derives health banner states from connection and notices", () => {
    const initial = createInitialOperationsState();

    const connected = applyGatewayEvent(initial, { type: "gateway.connected" }, 1_000);
    const warning = applyGatewayEvent(
      connected,
      { type: "system.notice", level: "warning", message: "High queue latency" },
      2_000,
    );
    const disconnected = applyGatewayEvent(
      warning,
      { type: "gateway.disconnected", reason: "transport" },
      3_000,
    );

    expect(selectHealthBanner(connected)).toBe("ok");
    expect(selectHealthBanner(warning)).toBe("degraded");
    expect(selectHealthBanner(disconnected)).toBe("disconnected");
  });

  it("aggregates agent activity summary", () => {
    const initial = createInitialOperationsState();
    const withA = applyGatewayEvent(initial, { type: "agent.activity", agentId: "a1", status: "active" }, 1_000);
    const withB = applyGatewayEvent(withA, { type: "agent.activity", agentId: "a2", status: "idle" }, 2_000);
    const swapped = applyGatewayEvent(withB, { type: "agent.activity", agentId: "a2", status: "active" }, 3_000);

    expect(swapped.agentActivity.activeAgents).toBe(2);
    expect(swapped.agentActivity.idleAgents).toBe(0);
    expect(swapped.agentActivity.byAgent.a2).toBe("active");
  });

  it("projects typed training lifecycle records", () => {
    const initial = createInitialOperationsState();

    const datasetRecorded = applyGatewayEvent(
      initial,
      {
        type: "training.dataset.recorded",
        datasetId: "ds-1",
        status: "queued",
        itemCount: 120,
        owner: "ml-ops",
      },
      1_000,
    );
    const datasetTransitioned = applyGatewayEvent(
      datasetRecorded,
      {
        type: "training.dataset.transitioned",
        datasetId: "ds-1",
        status: "validated",
      },
      2_000,
    );
    const evaluation = applyGatewayEvent(
      datasetTransitioned,
      {
        type: "training.evaluation.recorded",
        evaluationId: "eval-1",
        modelId: "model-a",
        datasetId: "ds-1",
        status: "running",
      },
      3_000,
    );
    const retrain = applyGatewayEvent(
      evaluation,
      {
        type: "training.retrain.recorded",
        jobId: "job-1",
        modelId: "model-a",
        trigger: "schedule",
        status: "queued",
      },
      4_000,
    );
    const registry = applyGatewayEvent(
      retrain,
      {
        type: "training.registry.recorded",
        modelId: "model-a",
        status: "candidate",
        datasetId: "ds-1",
        datasetHash: "hash-1",
        baseModel: "llama",
        adapterId: "adapter-a",
      },
      5_000,
    );

    expect(registry.training.datasetCuration[0]?.status).toBe("validated");
    expect(registry.training.datasetQueueDepth).toBe(0);
    expect(registry.training.evaluationRuns[0]?.evaluationId).toBe("eval-1");
    expect(registry.training.retrainJobs[0]?.jobId).toBe("job-1");
    expect(registry.training.modelRegistry[0]?.modelId).toBe("model-a");
  });

});
