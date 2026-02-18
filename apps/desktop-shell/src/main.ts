import { app, BrowserWindow, dialog } from "electron";

const defaultGatewayUrl = "http://127.0.0.1:18789/";

function normalizeGatewayUrl(value: string): string {
  const candidate = value.trim();
  if (!candidate) {
    return defaultGatewayUrl;
  }

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return defaultGatewayUrl;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return defaultGatewayUrl;
  }

  return parsed.toString();
}

function resolveGatewayUrl(): string {
  const configured = process.env.OPENCLAW_GATEWAY_URL;
  if (!configured) {
    return defaultGatewayUrl;
  }

  return normalizeGatewayUrl(configured);
}

async function createMainWindow(): Promise<BrowserWindow> {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: "#0f1115",
    autoHideMenuBar: true,
    title: "OpenClaw Desktop",
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });

  const gatewayUrl = resolveGatewayUrl();
  try {
    await mainWindow.loadURL(gatewayUrl);
  } catch (error) {
    await dialog.showMessageBox(mainWindow, {
      type: "error",
      title: "OpenClaw Desktop",
      message: "Kon de OpenClaw Gateway niet laden.",
      detail: `Probeer of de gateway draait op ${gatewayUrl}.\n\n${String(error)}`,
    });
  }

  return mainWindow;
}

async function bootstrap(): Promise<void> {
  await app.whenReady();
  await createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createMainWindow();
    }
  });
}

void bootstrap();

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
