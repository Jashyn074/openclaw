import { contextBridge } from "electron";

type DesktopShellApi = {
  getGatewayUrl: () => string;
};

const api: DesktopShellApi = {
  getGatewayUrl: () => {
    const params = new URLSearchParams(window.location.search);
    return params.get("gatewayUrl") ?? "http://127.0.0.1:18789/";
  },
};

contextBridge.exposeInMainWorld("openclawDesktop", api);
