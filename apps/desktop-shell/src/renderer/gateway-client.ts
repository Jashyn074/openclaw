export type GatewayConnectionState = "idle" | "connecting" | "open" | "closed" | "error";

export type GatewayStatusSnapshot = {
  readonly state: GatewayConnectionState;
  readonly attempt: number;
  readonly lastError?: string;
  readonly lastMessageAt?: number;
};

export type GatewayStatusListener = (snapshot: GatewayStatusSnapshot) => void;

const websocketSchemeByHttp = {
  "http:": "ws:",
  "https:": "wss:",
} as const;

function resolveGatewayWebSocketUrl(gatewayHttpUrl: string): string {
  const parsed = new URL(gatewayHttpUrl);
  const nextScheme = websocketSchemeByHttp[parsed.protocol as keyof typeof websocketSchemeByHttp];
  if (!nextScheme) {
    throw new Error(`Unsupported gateway protocol: ${parsed.protocol}`);
  }

  parsed.protocol = nextScheme;
  return parsed.toString();
}

export class GatewayClient {
  private readonly listeners = new Set<GatewayStatusListener>();

  private readonly wsUrl: string;

  private socket: WebSocket | null = null;

  private reconnectTimer: number | null = null;

  private attempt = 0;

  private status: GatewayStatusSnapshot = {
    state: "idle",
    attempt: 0,
  };

  public constructor(gatewayHttpUrl: string) {
    this.wsUrl = resolveGatewayWebSocketUrl(gatewayHttpUrl);
  }

  public connect(): void {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.attempt += 1;
    this.publish({
      state: "connecting",
      attempt: this.attempt,
      lastError: this.status.lastError,
      lastMessageAt: this.status.lastMessageAt,
    });

    const socket = new WebSocket(this.wsUrl);
    this.socket = socket;

    socket.addEventListener("open", () => {
      this.publish({
        state: "open",
        attempt: this.attempt,
        lastMessageAt: Date.now(),
      });
    });

    socket.addEventListener("message", () => {
      this.publish({
        state: this.status.state,
        attempt: this.attempt,
        lastError: this.status.lastError,
        lastMessageAt: Date.now(),
      });
    });

    socket.addEventListener("error", () => {
      this.publish({
        state: "error",
        attempt: this.attempt,
        lastError: "Gateway WebSocket reported an error.",
        lastMessageAt: this.status.lastMessageAt,
      });
    });

    socket.addEventListener("close", () => {
      this.publish({
        state: "closed",
        attempt: this.attempt,
        lastError: this.status.lastError,
        lastMessageAt: this.status.lastMessageAt,
      });
      this.scheduleReconnect();
    });
  }

  public disconnect(): void {
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }

    this.publish({
      state: "idle",
      attempt: this.attempt,
      lastError: this.status.lastError,
      lastMessageAt: this.status.lastMessageAt,
    });
  }

  public onStatus(listener: GatewayStatusListener): () => void {
    this.listeners.add(listener);
    listener(this.status);

    return () => {
      this.listeners.delete(listener);
    };
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer !== null) {
      return;
    }

    const reconnectDelayMs = Math.min(30_000, 1_000 * 2 ** Math.max(0, this.attempt - 1));
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, reconnectDelayMs);
  }

  private publish(snapshot: GatewayStatusSnapshot): void {
    this.status = snapshot;
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }
}
