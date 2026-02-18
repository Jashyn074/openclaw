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
});
