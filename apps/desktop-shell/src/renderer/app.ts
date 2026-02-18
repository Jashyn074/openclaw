import { GatewayClient, type GatewayStatusSnapshot } from "./gateway-client.js";
import { OpsStore } from "./ops-store.js";

function requireElement<TElement extends Element>(selector: string): TElement {
  const node = document.querySelector(selector);
  if (!node) {
    throw new Error(`Desktop shell renderer failed to find element: ${selector}`);
  }

  return node as TElement;
}

function formatLastMessageAge(lastMessageAt?: number): string {
  if (!lastMessageAt) {
    return "No message yet";
  }

  const elapsedMs = Date.now() - lastMessageAt;
  if (elapsedMs < 1_000) {
    return "just now";
  }

  const elapsedSeconds = Math.round(elapsedMs / 1_000);
  return `${elapsedSeconds}s ago`;
}

function updateStatusText(statusElement: HTMLElement, snapshot: GatewayStatusSnapshot): void {
  statusElement.textContent = `state=${snapshot.state} attempt=${snapshot.attempt} lastMessage=${formatLastMessageAge(snapshot.lastMessageAt)}`;
}

function updateKpiCard(selector: string, value: string): void {
  const target = requireElement<HTMLElement>(selector);
  target.textContent = value;
}

function renderOpsSnapshot(opsStore: OpsStore): void {
  const snapshot = opsStore.getSnapshot();
  updateKpiCard("#kpiConnection", snapshot.connectionState);
  updateKpiCard("#kpiReconnects", String(snapshot.reconnectAttempts));
  updateKpiCard("#kpiMessages", String(snapshot.messagesObserved));
  updateKpiCard("#kpiUptime", `${snapshot.uptimeSeconds}s`);
}

function bootstrap(): void {
  const gatewayUrl = window.openclawDesktop.getGatewayUrl();

  const gatewayUrlElement = requireElement<HTMLElement>("#gatewayUrl");
  const gatewayFrame = requireElement<HTMLIFrameElement>("#gatewayFrame");
  const reloadButton = requireElement<HTMLButtonElement>("#reloadButton");
  const reconnectButton = requireElement<HTMLButtonElement>("#reconnectGateway");
  const connectionStatus = requireElement<HTMLElement>("#gatewayConnectionStatus");

  gatewayUrlElement.textContent = gatewayUrl;
  gatewayFrame.src = gatewayUrl;

  const gatewayClient = new GatewayClient(gatewayUrl);
  const opsStore = new OpsStore();

  renderOpsSnapshot(opsStore);

  const unsubscribe = gatewayClient.onStatus((snapshot) => {
    updateStatusText(connectionStatus, snapshot);
    opsStore.ingestGatewayStatus(snapshot);
    renderOpsSnapshot(opsStore);
  });

  const uptimeInterval = window.setInterval(() => {
    renderOpsSnapshot(opsStore);
  }, 1_000);

  gatewayClient.connect();

  reloadButton.addEventListener("click", () => {
    gatewayFrame.src = gatewayUrl;
  });

  reconnectButton.addEventListener("click", () => {
    gatewayClient.disconnect();
    gatewayClient.connect();
  });

  window.addEventListener("beforeunload", () => {
    window.clearInterval(uptimeInterval);
    unsubscribe();
    gatewayClient.disconnect();
  });
}

bootstrap();
