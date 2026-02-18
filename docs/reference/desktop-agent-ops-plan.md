---
summary: "Roadmap for a local desktop (.exe) control app for OpenClaw agents"
title: "Desktop agent operations plan"
---

# Desktop agent operations plan

This plan is tailored for a standalone desktop app (for example a Windows `.exe`) instead of a browser-only workflow.

## Goals

- Run OpenClaw locally with a clear operations dashboard.
- Control always-on agents and subagents in a single app.
- Chat with agents and inspect live progress.
- Track tasks, runs, and produced artifacts in an auditable way.
- Gate high-risk actions (email/social/file/code/internet) with explicit policy and approvals.

## Architecture decision

Use the existing OpenClaw Gateway as the control plane and add a dedicated desktop shell app:

- **Gateway** stays the backend (`ws://127.0.0.1:18789`).
- **Desktop shell (.exe)** is the primary operator interface.
- **Agent Ops module** is added incrementally (tasks, hierarchies, artifacts, approvals).

This avoids rebuilding transport/auth/routing logic and keeps parity with existing Gateway features.

## Delivery phases

### Phase 0: Desktop shell foundation (this PR starts here)

- Create a standalone desktop shell app structure.
- Open the local Gateway UI inside the desktop window.
- Add startup env configuration (`OPENCLAW_GATEWAY_URL`) so local/remote development can switch endpoints.

### Phase 1: Agent operations data model

- Add explicit entities for:
  - agents
  - parent-child agent graph
  - tasks
  - task runs
  - artifacts
  - approvals
- Define lifecycle states and transitions for robust 24/7 execution.

### Phase 2: Operations dashboard surfaces

- Agent graph overview (controller/worker/subagent views).
- Task board (queued/running/blocked/completed/failed).
- Artifact explorer grouped by source run.
- Per-agent chat pane with run timeline.

### Phase 3: Safety and governance

- Capability profiles per agent (`net`, `fs`, `code`, `mail`, `social`).
- Approval queue for high-risk actions.
- Immutable audit trail for all tool actions.
- Kill switch and scoped pause/resume controls.

### Phase 4: Reliability for always-on execution

- Heartbeats and stuck-run detection.
- Retry/backoff with dead-letter queue.
- Health widgets and incident indicators in dashboard.

## Immediate next implementation slice

After this skeleton is in place:

1. Add a typed desktop-to-gateway bridge for status and session metadata.
2. Add a native dashboard home view (agent health + run queue counters).
3. Add a local persistence layer for desktop preferences.
4. Add packaging pipeline to produce Windows `.exe` artifacts.
