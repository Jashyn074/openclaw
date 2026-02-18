import type { GatewayEvent } from "../../services/gateway-events.js";
import type { GatewayHealthProjection, HealthBannerLevel } from "../projections-types.js";

export function createInitialGatewayHealthProjection(): GatewayHealthProjection {
  return {
    connectionState: "connecting",
    uptimeSeconds: 0,
    lastHeartbeatAt: null,
    lastErrorMessage: null,
    errorCount: 0,
  };
}

export function reduceGatewayHealth(
  state: GatewayHealthProjection,
  event: GatewayEvent,
  at: number,
): GatewayHealthProjection {
  switch (event.type) {
    case "gateway.connected":
      return {
        ...state,
        connectionState: "connected",
        lastErrorMessage: null,
      };
    case "gateway.disconnected":
      return {
        ...state,
        connectionState: "disconnected",
        lastErrorMessage: event.reason ?? "Gateway disconnected.",
        errorCount: state.errorCount + 1,
      };
    case "gateway.heartbeat":
      return {
        ...state,
        connectionState: "connected",
        lastHeartbeatAt: at,
        uptimeSeconds: event.uptimeSeconds,
      };
    case "system.notice":
      if (event.level === "info") {
        return state;
      }
      return {
        ...state,
        connectionState: "degraded",
        errorCount: state.errorCount + 1,
        lastErrorMessage: event.message,
      };
    default:
      return state;
  }
}

export function deriveHealthBanner(gatewayHealth: GatewayHealthProjection): HealthBannerLevel {
  if (gatewayHealth.connectionState === "disconnected") {
    return "disconnected";
  }

  if (gatewayHealth.connectionState === "degraded" || gatewayHealth.errorCount > 0) {
    return "degraded";
  }

  return "ok";
}

export function normalizeGatewayHealthForBanner(gatewayHealth: GatewayHealthProjection): GatewayHealthProjection {
  const banner = deriveHealthBanner(gatewayHealth);
  if (banner === "ok" && gatewayHealth.connectionState !== "connected") {
    return {
      ...gatewayHealth,
      connectionState: "connecting",
    };
  }

  return gatewayHealth;
}
