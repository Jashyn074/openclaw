import type { GatewayEvent } from "../../services/gateway-events.js";
import type { AgentActivityProjection } from "../projections-types.js";

export function createInitialAgentActivityProjection(): AgentActivityProjection {
  return {
    activeAgents: 0,
    idleAgents: 0,
    byAgent: {},
  };
}

export function reduceAgentActivity(state: AgentActivityProjection, event: GatewayEvent): AgentActivityProjection {
  if (event.type !== "agent.activity") {
    return state;
  }

  const byAgent = {
    ...state.byAgent,
    [event.agentId]: event.status,
  };
  const statuses = Object.values(byAgent);

  return {
    byAgent,
    activeAgents: statuses.filter((value) => value === "active").length,
    idleAgents: statuses.filter((value) => value === "idle").length,
  };
}

export function selectBusyAgentRatio(state: AgentActivityProjection): number {
  const total = state.activeAgents + state.idleAgents;
  if (total === 0) {
    return 0;
  }

  return state.activeAgents / total;
}
