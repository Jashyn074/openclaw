# OpenClaw desktop shell (starter)

This app is the first step toward a standalone desktop control app (including Windows `.exe` builds) for operating local OpenClaw agents.

## What this starter does

- Creates a native desktop window via Electron.
- Loads an OpenClaw desktop shell page (instead of opening the Gateway URL directly).
- Embeds the OpenClaw Gateway inside an application workspace frame.
- Shows the active Gateway target and supports quick reload from the top bar.
- Allows overriding the gateway URL with `OPENCLAW_GATEWAY_URL`.
- Applies hardened browser defaults (`contextIsolation`, `sandbox`, no Node integration).
- Shows a clear error dialog when the desktop shell cannot be loaded.

## Run (development)

```bash
cd apps/desktop-shell
pnpm install
pnpm dev
```

Optional gateway URL override:

```bash
OPENCLAW_GATEWAY_URL=http://localhost:18789/ pnpm dev
```

## Build targets

Use Electron Builder in this package to generate installers and executables.

```bash
pnpm build
pnpm dist
```

> Note: packaging profiles can be expanded per platform once the native dashboard modules are added.
