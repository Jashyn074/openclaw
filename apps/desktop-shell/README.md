# OpenClaw desktop shell

This app now runs as a native-first operator cockpit foundation for OpenClaw (including Windows `.exe` packaging).

## Native modules in this iteration

The renderer no longer treats the Gateway iframe as the primary workspace. Instead it ships a native Operations Home that is driven by typed Gateway events and deterministic projections.

Implemented module boundaries:

- `src/renderer/services/*`
  - Typed gateway event adapter (WebSocket transport, reconnect strategy, auth handshake placeholder, backpressure counters).
- `src/renderer/store/*`
  - Deterministic projection reducers and store wiring for:
    - gateway health
    - run queue counters
    - agent activity summary
    - activity feed
    - typed training orchestration records (dataset curation, evaluation runs, retrain jobs, model registry entries)
- `src/renderer/modules/*`
  - Native Operations Home renderer with explicit loading/empty/error states.

## Fallback surface (still present)

- The embedded Gateway iframe is still available as a fallback panel.
- Primary UX is now the native dashboard and KPI surfaces.

## Training orchestration strategy hooks (external training only)

This shell intentionally does **not** run local GPU training. It now includes typed projection records, lifecycle transitions, and compact native record lists for:

- dataset curation queue
- evaluation run records
- retrain trigger jobs
- model registry metadata (dataset hash, base model, adapter id, eval score, rollback pointer)

Training execution remains external (Axolotl / Unsloth / custom pipeline). The desktop shell only projects and visualizes lifecycle metadata; it does not execute training workloads.

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

## Build and test

```bash
pnpm --dir apps/desktop-shell build
pnpm --dir apps/desktop-shell test
```

## Next-step roadmap

1. Replace placeholder gateway event contracts with server-validated schemas and auth handshake confirmation events.
2. Add persisted projection snapshots and time-window analytics for KPI trends.
3. Expand training orchestration projections with live queue/event streams from external trainers.
4. Add module-specific UI tests for Operations Home rendering and degraded/disconnected recovery paths.
