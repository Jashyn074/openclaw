import { createOperationsHomeController } from "./modules/operations-home.js";
import { createGatewayEventAdapter } from "./services/gateway-events.js";
import { createOperationsStore } from "./store/operations-store.js";

type DesktopShellApi = {
  getGatewayUrl: () => string;
};

declare global {
  interface Window {
    openclawDesktop: DesktopShellApi;
  }
}

const gatewayUrlElement = document.querySelector<HTMLElement>("#gatewayUrl");
const gatewayFrame = document.querySelector<HTMLIFrameElement>("#gatewayFrame");
const reloadButton = document.querySelector<HTMLButtonElement>("#reloadButton");

if (!gatewayUrlElement || !gatewayFrame || !reloadButton) {
  throw new Error("Desktop shell renderer failed to initialize expected DOM nodes.");
}

const gatewayUrl = window.openclawDesktop.getGatewayUrl();
gatewayUrlElement.textContent = gatewayUrl;
gatewayFrame.src = gatewayUrl;

const store = createOperationsStore();
const operationsHome = createOperationsHomeController();

const adapter = createGatewayEventAdapter({
  gatewayUrl,
  onEvent: (event) => {
    store.dispatch(event);
  },
  onStatus: (status) => {
    operationsHome.setStatusMessage(status.message);
  },
  onError: (message) => {
    operationsHome.setErrorMessage(message);
    store.dispatch(
      {
        type: "system.notice",
        level: "error",
        message,
      },
      Date.now(),
    );
  },
});

store.subscribe((state) => {
  operationsHome.render(state);
});

reloadButton.addEventListener("click", () => {
  gatewayFrame.src = gatewayUrl;
  adapter.stop();
  operationsHome.setErrorMessage(null);
  adapter.start();
});

window.addEventListener("beforeunload", () => {
  adapter.stop();
});

adapter.start();
