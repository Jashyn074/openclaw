import type { DatasetCurationStatus, EvaluationRunStatus, ModelRegistryStatus, RetrainJobStatus } from "../store/training-models.js";

export type GatewayConnectionState = "connecting" | "connected" | "disconnected" | "degraded";

export type GatewayEvent =
  | { type: "gateway.connected"; sessionId?: string }
  | { type: "gateway.disconnected"; reason?: string }
  | { type: "gateway.heartbeat"; uptimeSeconds: number }
  | { type: "queue.snapshot"; queueDepth: number; activeRuns: number; failuresLastHour: number }
  | { type: "queue.updated"; queueDepth: number }
  | { type: "run.started"; runId: string; agentId: string }
  | { type: "run.finished"; runId: string; agentId: string }
  | { type: "run.failed"; runId: string; agentId: string; reason: string }
  | { type: "agent.activity"; agentId: string; status: "active" | "idle" }
  | { type: "training.dataset.recorded"; datasetId: string; status: DatasetCurationStatus; itemCount: number; owner: string; notes?: string }
  | { type: "training.dataset.transitioned"; datasetId: string; status: DatasetCurationStatus; notes?: string }
  | { type: "training.evaluation.recorded"; evaluationId: string; modelId: string; datasetId: string; status: EvaluationRunStatus; score?: number }
  | { type: "training.evaluation.transitioned"; evaluationId: string; status: EvaluationRunStatus; score?: number }
  | { type: "training.retrain.recorded"; jobId: string; trigger: string; modelId: string; status: RetrainJobStatus }
  | { type: "training.retrain.transitioned"; jobId: string; status: RetrainJobStatus }
  | { type: "training.registry.recorded"; modelId: string; status: ModelRegistryStatus; datasetId: string; datasetHash: string; baseModel: string; adapterId: string; evalScore?: number; rollbackPointer?: string }
  | { type: "training.registry.transitioned"; modelId: string; status: ModelRegistryStatus; evalScore?: number; rollbackPointer?: string }
  | { type: "system.notice"; level: "info" | "warning" | "error"; message: string };

export type GatewayAdapterStatus = {
  state: GatewayConnectionState;
  message: string;
};

export type GatewayAdapterMetrics = {
  reconnectAttempts: number;
  eventsReceived: number;
  eventsProcessed: number;
  eventsDropped: number;
};

type GatewayAdapterOptions = {
  gatewayUrl: string;
  authToken?: string;
  maxQueueSize?: number;
  reconnectBaseMs?: number;
  onEvent: (event: GatewayEvent) => void;
  onStatus: (status: GatewayAdapterStatus) => void;
  onError: (message: string) => void;
};

export type GatewayAdapterController = {
  start: () => void;
  stop: () => void;
  getMetrics: () => GatewayAdapterMetrics;
};

export function toGatewayEventsWebSocketUrl(gatewayUrl: string): string {
  const parsed = new URL(gatewayUrl);
  parsed.protocol = parsed.protocol === "https:" ? "wss:" : "ws:";
  parsed.pathname = "/api/desktop/events";
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString();
}

export function createGatewayEventAdapter(options: GatewayAdapterOptions): GatewayAdapterController {
  const maxQueueSize = options.maxQueueSize ?? 400;
  const reconnectBaseMs = options.reconnectBaseMs ?? 600;

  let socket: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let shouldRun = false;
  let reconnectAttempts = 0;
  let eventsReceived = 0;
  let eventsProcessed = 0;
  let eventsDropped = 0;
  let draining = false;

  const queue: GatewayEvent[] = [];

  const getMetrics = (): GatewayAdapterMetrics => ({
    reconnectAttempts,
    eventsReceived,
    eventsProcessed,
    eventsDropped,
  });

  const clearReconnectTimer = (): void => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  const scheduleReconnect = (): void => {
    if (!shouldRun) {
      return;
    }

    clearReconnectTimer();
    reconnectAttempts += 1;
    const backoff = Math.min(10_000, reconnectBaseMs * 2 ** Math.min(reconnectAttempts, 6));

    options.onStatus({
      state: "connecting",
      message: `Gateway reconnect over ${backoff} ms (attempt ${reconnectAttempts}).`,
    });

    reconnectTimer = setTimeout(connect, backoff);
  };

  const drainQueue = (): void => {
    if (draining) {
      return;
    }

    draining = true;
    queueMicrotask(() => {
      while (queue.length > 0) {
        const nextEvent = queue.shift();
        if (!nextEvent) {
          continue;
        }

        options.onEvent(nextEvent);
        eventsProcessed += 1;
      }

      draining = false;
    });
  };

  const pushEvent = (event: GatewayEvent): void => {
    if (queue.length >= maxQueueSize) {
      queue.shift();
      eventsDropped += 1;
      options.onStatus({
        state: "degraded",
        message: "Gateway event backpressure: oldest events dropped.",
      });
    }

    queue.push(event);
    drainQueue();
  };

  const handleRawMessage = (message: string): void => {
    let parsedEvent: GatewayEvent;
    try {
      parsedEvent = JSON.parse(message) as GatewayEvent;
    } catch {
      options.onError("Gateway event decode failed; ignoring malformed payload.");
      options.onStatus({
        state: "degraded",
        message: "Received malformed gateway event payload.",
      });
      return;
    }

    eventsReceived += 1;
    pushEvent(parsedEvent);
  };

  const connect = (): void => {
    if (!shouldRun) {
      return;
    }

    const wsUrl = toGatewayEventsWebSocketUrl(options.gatewayUrl);
    options.onStatus({ state: "connecting", message: `Connecting to ${wsUrl}` });

    socket = new WebSocket(wsUrl);

    socket.addEventListener("open", () => {
      reconnectAttempts = 0;
      options.onStatus({ state: "connected", message: "Gateway event stream connected." });

      // Placeholder auth handshake so we can later enforce token-verified streams.
      const hello = {
        type: "auth.hello",
        token: options.authToken ?? "",
      };
      socket?.send(JSON.stringify(hello));

      pushEvent({ type: "gateway.connected" });
    });

    socket.addEventListener("message", (event) => {
      handleRawMessage(String(event.data));
    });

    socket.addEventListener("error", () => {
      options.onError("Gateway socket emitted an error event.");
      options.onStatus({
        state: "degraded",
        message: "Gateway stream error detected; reconnecting soon.",
      });
    });

    socket.addEventListener("close", () => {
      options.onStatus({
        state: "disconnected",
        message: "Gateway stream disconnected.",
      });
      pushEvent({ type: "gateway.disconnected", reason: "socket-closed" });
      socket = null;
      scheduleReconnect();
    });
  };

  const stop = (): void => {
    shouldRun = false;
    clearReconnectTimer();

    if (socket) {
      socket.close();
      socket = null;
    }

    options.onStatus({
      state: "disconnected",
      message: "Gateway stream stopped by desktop shell.",
    });
  };

  return {
    start: () => {
      if (shouldRun) {
        return;
      }

      shouldRun = true;
      connect();
    },
    stop,
    getMetrics,
  };
}
