import type { GatewayEvent } from "../../services/gateway-events.js";
import type { ActivityFeedItem } from "../projections-types.js";

const feedLimit = 40;

type FeedUpdate = {
  summary: string;
  level?: ActivityFeedItem["level"];
};

function toFeedUpdate(event: GatewayEvent): FeedUpdate | null {
  switch (event.type) {
    case "gateway.connected":
      return { summary: "Gateway connection established." };
    case "gateway.disconnected":
      return { summary: "Gateway disconnected.", level: "warning" };
    case "queue.snapshot":
      return { summary: "Queue snapshot refreshed." };
    case "queue.updated":
      return { summary: `Queue depth updated to ${event.queueDepth}.` };
    case "run.started":
      return { summary: `Run ${event.runId} started by ${event.agentId}.` };
    case "run.finished":
      return { summary: `Run ${event.runId} completed by ${event.agentId}.` };
    case "run.failed":
      return { summary: `Run ${event.runId} failed: ${event.reason}`, level: "error" };
    case "agent.activity":
      return { summary: `Agent ${event.agentId} is now ${event.status}.` };
    case "system.notice":
      return { summary: event.message, level: event.level };
    default:
      return null;
  }
}

export function reduceActivityFeed(state: ActivityFeedItem[], event: GatewayEvent, at: number): ActivityFeedItem[] {
  const update = toFeedUpdate(event);
  if (!update) {
    return state;
  }

  const item: ActivityFeedItem = {
    id: `${at}-${update.summary}`,
    at,
    summary: update.summary,
    level: update.level ?? "info",
  };

  return [item, ...state].slice(0, feedLimit);
}

export function selectLatestFeedItem(items: ActivityFeedItem[]): ActivityFeedItem | null {
  return items[0] ?? null;
}
