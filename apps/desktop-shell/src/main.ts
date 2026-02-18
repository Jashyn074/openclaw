import { app, BrowserWindow } from "electron";

const defaultGatewayUrl = "http://127.0.0.1:18789/";

function resolveGatewayUrl(): string {
  const configured = process.env.OPENCLAW_GATEWAY_URL?.trim();
  if (!configured) {
    return defaultGatewayUrl;
  }

  return configured;
}

function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: "#0f1115",
    autoHideMenuBar: true,
    title: "OpenClaw Desktop",
  });

  void window.loadURL(resolveGatewayUrl());
  return window;
}

app.whenReady().then(() => {
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
