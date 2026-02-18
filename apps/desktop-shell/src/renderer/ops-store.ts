import type { GatewayStatusSnapshot } from "./gateway-client.js";

export type OpsSnapshot = {
  readonly connectionState: GatewayStatusSnapshot["state"];
  readonly reconnectAttempts: number;
  readonly messagesObserved: number;
  readonly lastMessageAt?: number;
  readonly firstConnectedAt?: number;
  readonly uptimeSeconds: number;
};

export class OpsStore {
  private snapshot: OpsSnapshot = {
    connectionState: "idle",
    reconnectAttempts: 0,
    messagesObserved: 0,
    uptimeSeconds: 0,
  };

  public ingestGatewayStatus(status: GatewayStatusSnapshot): OpsSnapshot {
    const firstConnectedAt =
      this.snapshot.firstConnectedAt ?? (status.state === "open" ? Date.now() : undefined);

    const previousLastMessageAt = this.snapshot.lastMessageAt;
    const receivedNewMessage =
      typeof status.lastMessageAt === "number" && status.lastMessageAt !== previousLastMessageAt;

    const uptimeSeconds = firstConnectedAt
      ? Math.max(0, Math.floor((Date.now() - firstConnectedAt) / 1_000))
      : 0;

    this.snapshot = {
      connectionState: status.state,
      reconnectAttempts: Math.max(0, status.attempt - 1),
      messagesObserved: this.snapshot.messagesObserved + (receivedNewMessage ? 1 : 0),
      lastMessageAt: status.lastMessageAt,
      firstConnectedAt,
      uptimeSeconds,
    };

    return this.snapshot;
  }

  public getSnapshot(): OpsSnapshot {
    return this.snapshot;
  }
}
