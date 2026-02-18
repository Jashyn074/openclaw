const gatewayUrlElement = document.querySelector("#gatewayUrl");
const gatewayFrame = document.querySelector("#gatewayFrame");
const reloadButton = document.querySelector("#reloadButton");

if (!gatewayUrlElement || !gatewayFrame || !reloadButton) {
  throw new Error("Desktop shell renderer failed to initialize expected DOM nodes.");
}

const gatewayUrl = window.openclawDesktop.getGatewayUrl();
gatewayUrlElement.textContent = gatewayUrl;
gatewayFrame.src = gatewayUrl;

reloadButton.addEventListener("click", () => {
  gatewayFrame.src = gatewayUrl;
});
