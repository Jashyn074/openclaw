# OpenClaw desktop shell (starter)

This app is the first step toward a standalone desktop control app (including Windows `.exe` builds) for operating local OpenClaw agents.

## What this starter does

- Creates a native desktop window via Electron.
- Loads an OpenClaw desktop shell page (instead of opening the Gateway URL directly).
- Embeds the OpenClaw Gateway inside an application workspace frame.
- Shows the active Gateway target and supports quick reload from the top bar.
- Displays lightweight operations telemetry cards (connection state, reconnects, observed messages, uptime).
- Adds a typed Gateway WebSocket client skeleton with status and reconnect handling.
- Allows overriding the gateway URL with `OPENCLAW_GATEWAY_URL`.
- Applies hardened browser defaults (`contextIsolation`, `sandbox`, no Node integration).
- Shows a clear error dialog when the desktop shell cannot be loaded.

## Run (development)

```bash
pnpm install
pnpm --dir apps/desktop-shell dev
```

Optional gateway URL override:

```bash
OPENCLAW_GATEWAY_URL=http://localhost:18789/ pnpm --dir apps/desktop-shell dev
```

## Build targets

Use Electron Builder in this package to generate installers and executables.

```bash
pnpm --dir apps/desktop-shell build
pnpm --dir apps/desktop-shell dist
```

## Current architecture boundaries

- Renderer runtime is TypeScript and compiled into `dist/renderer/*.js`.
- `GatewayClient` currently focuses on typed connection state and reconnect behavior.
- Current shell includes a small operations projection store (`ops-store.ts`) fed by Gateway connection status.
- Next slices should replace iframe embedding with native operator modules and richer event projections.
