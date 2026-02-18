import type { GatewayEvent } from "../../services/gateway-events.js";
import type { RunQueueProjection } from "../projections-types.js";

export function createInitialRunQueueProjection(): RunQueueProjection {
  return {
    queueDepth: 0,
    activeRuns: 0,
    failuresLastHour: 0,
  };
}

export function reduceRunQueue(state: RunQueueProjection, event: GatewayEvent): RunQueueProjection {
  switch (event.type) {
    case "queue.snapshot":
      return {
        queueDepth: event.queueDepth,
        activeRuns: event.activeRuns,
        failuresLastHour: event.failuresLastHour,
      };
    case "queue.updated":
      return {
        ...state,
        queueDepth: event.queueDepth,
      };
    case "run.started":
      return {
        ...state,
        activeRuns: state.activeRuns + 1,
        queueDepth: Math.max(0, state.queueDepth - 1),
      };
    case "run.finished":
      return {
        ...state,
        activeRuns: Math.max(0, state.activeRuns - 1),
      };
    case "run.failed":
      return {
        ...state,
        activeRuns: Math.max(0, state.activeRuns - 1),
        failuresLastHour: state.failuresLastHour + 1,
      };
    default:
      return state;
  }
}

export function selectQueueLoad(state: RunQueueProjection): number {
  return state.queueDepth + state.activeRuns;
}
