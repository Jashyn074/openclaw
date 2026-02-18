---
summary: "High bar execution plan for a local desktop OpenClaw app focused on always-on agent operations"
title: "Desktop agent operations plan"
---

# Desktop agent operations plan

This plan defines a high bar path for a standalone desktop app (including Windows `.exe`) that controls local OpenClaw with production grade reliability, safety, and UX quality.

## Product vision

Build a desktop command center where one operator can:

- run and supervise 24/7 agents
- orchestrate deep agent trees (agent and subagent hierarchies)
- chat with any agent while monitoring live execution
- understand what work is done, what failed, and what was created
- safely grant powerful capabilities with clear approval and audit controls

## Quality bar and non negotiables

The app is not a demo shell. Every subsystem must satisfy these standards:

- **Reliability first**: no silent failures, deterministic retries, clear recovery states
- **Operator clarity**: no hidden state transitions, strong observability in every screen
- **Secure by default**: least privilege, approval gates, immutable audit trails
- **Performance**: responsive UI under heavy logs and many concurrent runs
- **Design quality**: polished visual language, consistent interactions, accessible UI
- **Testability**: strong automated coverage for domain rules and UI critical paths

## Architecture strategy

Keep the OpenClaw Gateway as the control plane and build a dedicated desktop shell as the primary operator client.

- **Gateway**: orchestration transport, auth, existing RPC and event substrate
- **Desktop app**: native shell + native modules + agent ops UI domain
- **Data model extension**: explicit entities for task graph, run graph, artifact graph, approvals, incidents

This preserves compatibility with current OpenClaw behavior while enabling a higher level operator experience.

## Target desktop stack

- Shell: Electron (short term delivery speed)
- UI framework: React + TypeScript strict mode
- State: event sourced domain store + derived query layer
- Data cache: IndexedDB or SQLite for local projections and offline inspection
- Design system: token driven theming + reusable primitives + command palette
- Charts and traces: performant virtualized timeline and graph rendering

## Domain model blueprint

### Core entities

- `AgentProfile`
  - id, role, capability profile, health, parent id, children ids
- `Task`
  - id, title, priority, owner agent, dependencies, SLA, status
- `Run`
  - id, task id, agent id, attempt index, timestamps, terminal state, failure class
- `Artifact`
  - id, run id, type, path or uri, semantic tags, version
- `ApprovalRequest`
  - id, action class, risk score, requested by, scope, expiry, reviewer decision
- `Incident`
  - id, severity, impacted runs, mitigation status, timeline

### State machines

Every mutable entity must be backed by explicit finite state machines:

- Task: `created -> queued -> running -> blocked|failed|completed`
- Run: `created -> started -> streaming -> succeeded|failed|aborted|timed_out`
- Approval: `requested -> approved|rejected|expired`
- Incident: `open -> investigating -> mitigated -> closed`

Disallow illegal transitions in code, not only in UI.

## Capability and governance model

High risk actions must be segmented and controlled:

- capability categories: `network`, `filesystem`, `code_exec`, `mail`, `social`, `payments`, `secrets`
- scope granularity: per agent, per action, per target, per time window
- approval modes: auto allow, require approval, deny
- escalation: repeated denials or anomaly patterns automatically open incidents

All approvals and overrides must produce immutable audit events.

## UX and design system plan

### Core screens

1. **Operations home**
   - active runs, backlog pressure, failure rate, recent incidents, SLA risk
2. **Agent graph explorer**
   - interactive hierarchy view with health overlays and bottleneck indicators
3. **Task and run board**
   - kanban plus timeline, dependency lanes, retry and dead letter views
4. **Chat and control console**
   - per agent chat, run traces, tool calls, quick control actions
5. **Artifact explorer**
   - searchable output catalog with provenance and version history
6. **Governance center**
   - approval queue, policy editor, incident panel, audit export

### Design standards

- clear information hierarchy with dense but readable layouts
- keyboard first operation for power users
- color + icon semantics with accessibility contrast constraints
- full loading, empty, degraded, and error states for every major component
- motion used only to improve comprehension, never as decoration

## Reliability engineering plan

- heartbeat monitor for each active agent and run stream
- adaptive retry with backoff and jitter by failure class
- dead letter queue with operator actions and replay controls
- idempotency keys for all mutating commands
- automatic stuck run detector with remediation suggestions
- snapshot and replay of event streams for post incident debugging

## Performance engineering plan

- virtualized rendering for logs, chats, traces, tables, and graph lists
- incremental event ingestion with batched state updates
- background compaction for local projections and large logs
- guardrails for memory growth under long lived sessions
- built in performance telemetry and regressions budgets per release

## Security engineering plan

- local secret storage via OS secure keystore integration
- strict content security policy and hardened BrowserWindow settings
- signed app binaries and update channel verification
- redaction of sensitive data in logs and telemetry
- policy simulation mode before enabling destructive capabilities

## Testing and quality gates

### Automated checks

- domain model property tests for state machine invariants
- integration tests for gateway and desktop event compatibility
- contract tests for RPC and event schemas
- UI e2e scenarios for critical operator workflows
- visual regression tests for design system components
- performance smoke tests under synthetic high load

### Release gates

- zero known critical security findings
- no unresolved P0 reliability defects
- pass rate thresholds for domain, integration, and e2e suites
- signed build artifacts and reproducible release metadata

## Delivery roadmap

### Phase 0 done in previous slice

- desktop shell scaffold exists
- gateway url override exists
- windows packaging target exists

### Phase 1 foundation hardening

- secure Electron defaults and preload bridge baseline
- typed event bus adapter for gateway streams (in progress: typed gateway socket client skeleton exists)
- domain state machines and in memory projection store
- first operator home screen with health and queue metrics (not started)

### Phase 2 core operator workflows

- agent graph explorer and run timeline
- task board with retries and dependency tracing
- chat console unified with run and tool trace context
- artifact explorer with provenance filters

### Phase 3 governance and safety

- capability profiles editor
- approval queue with policy aware routing
- immutable audit log browser and export
- incident creation, triage, and mitigation workflow

### Phase 4 scale and polish

- large scale performance tuning and telemetry budgets
- advanced keyboard workflows and command palette
- visual polish pass and accessibility audit
- packaging hardening for Windows and later macOS and Linux channels

## Build sequence for next implementation step

1. Introduce `apps/desktop-shell/src/preload.ts` with a minimal typed bridge.
2. Replace direct URL load with an app shell route that can host native panels.
3. Add a gateway connection service with typed reconnect and backpressure handling.
4. Add an operations home page fed by derived metrics from event projections.
5. Add baseline tests for connection lifecycle and projection correctness.

## Local model training strategy (LoRA and SFT)

OpenClaw agents can orchestrate training workflows, but model training should run in external training pipelines.

- Use agents for dataset curation, labeling, evaluation, and retraining triggers.
- Run LoRA or SFT jobs in dedicated training infrastructure (for example, Axolotl, Unsloth, or custom GPU jobs).
- Register the trained artifact in a local inference runtime (Ollama, vLLM, or LM Studio) and route specific tasks to it.
- Keep a hosted model fallback for safety and critical reasoning tasks.
- Track each train and deploy cycle with reproducible metadata: dataset hash, base model, adapter config, eval score, and rollback target.

This keeps a 24/7 feedback and retrain loop possible while avoiding coupling the desktop runtime to GPU training workloads.

## Success metrics

- mean time to detect failures under 10 seconds
- mean time to triage incidents under 2 minutes
- zero untracked privileged actions
- responsive UI under 10k plus timeline events per session
- operator task completion speed higher than browser control workflow

## Implementation status

Completed in current implementation:

- desktop preload bridge baseline (`src/preload.ts`)
- desktop native shell route (`src/renderer/index.html`)
- gateway embedding workspace with top level shell controls (`src/renderer/app.ts`)
- typed gateway socket client skeleton with status snapshots and reconnect backoff (`src/renderer/gateway-client.ts`)
- workspace package wiring so desktop app dependencies install with root `pnpm install` (`pnpm-workspace.yaml`)

Next coding slice:

- replace iframe embedding with a native React operator app that consumes gateway events directly
- extend typed gateway connection service with protocol level events, auth handshake, and backpressure counters
- introduce first event projection store for health and queue metrics
