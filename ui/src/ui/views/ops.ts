import { html } from "lit";
import { t } from "../../i18n/index.ts";
import type { EventLogEntry } from "../app-events.ts";
import type { ExecApprovalRequest } from "../controllers/exec-approval.ts";
import { clampText, formatMs } from "../format.ts";
import type {
  AgentIdentityResult,
  AgentsFilesListResult,
  AgentsListResult,
  HealthSnapshot,
  LogEntry,
} from "../types.ts";

type OpsTaskStatus = "todo" | "inProgress" | "blocked" | "done";

type OpsTask = {
  id: string;
  title: string;
  agentId: string;
  status: OpsTaskStatus;
  priority: "high" | "medium" | "low";
  createdAtMs: number;
  source: "chatQueue" | "approval" | "event";
};

type OpsViewProps = {
  connected: boolean;
  helloUptimeMs: number | null;
  agentsList: AgentsListResult | null;
  selectedAgentId: string | null;
  agentIdentityById: Record<string, AgentIdentityResult>;
  agentSkillsCount: number;
  chatQueue: Array<{ id: string; queuedAt: number; text: string; sessionKey?: string }>;
  execApprovalQueue: ExecApprovalRequest[];
  eventLog: EventLogEntry[];
  logsEntries: LogEntry[];
  chatMessages: unknown[];
  chatToolMessages: unknown[];
  agentFilesList: AgentsFilesListResult | null;
  agentFileContents: Record<string, string>;
  healthSnapshot: HealthSnapshot | null;
  throughputPerMinute: number;
  filters: {
    agent: string;
    status: string;
    priority: string;
    windowMinutes: number;
  };
  onFilterChange: (name: "agent" | "status" | "priority" | "windowMinutes", value: string) => void;
};

const TASK_COLUMNS: OpsTaskStatus[] = ["todo", "inProgress", "blocked", "done"];

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function stringifyShort(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map((entry) => stringifyShort(entry)).join(", ");
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).slice(0, 2);
    return entries.map(([key, item]) => `${key}: ${stringifyShort(item)}`).join(", ");
  }
  return "n/a";
}

function deriveTasks(props: OpsViewProps): OpsTask[] {
  const fromQueue = props.chatQueue.map((item) => ({
    id: `q-${item.id}`,
    title: clampText(item.text || "Queued chat message", 64),
    agentId:
      item.sessionKey?.split(":")?.[1] ||
      props.selectedAgentId ||
      props.agentsList?.defaultId ||
      "main",
    status: "todo" as const,
    priority: "medium" as const,
    createdAtMs: item.queuedAt,
    source: "chatQueue" as const,
  }));

  const fromApprovals = props.execApprovalQueue.map((item) => ({
    id: `a-${item.id}`,
    title: clampText(item.reason || item.command || "Pending approval", 64),
    agentId: item.agentId || props.selectedAgentId || props.agentsList?.defaultId || "main",
    status: "blocked" as const,
    priority: "high" as const,
    createdAtMs: item.createdAtMs,
    source: "approval" as const,
  }));

  const fromEvents = props.eventLog.slice(0, 8).map((entry, index) => {
    const lowered = entry.event.toLowerCase();
    const status: OpsTaskStatus =
      lowered.includes("error") || lowered.includes("failed")
        ? "blocked"
        : lowered.includes("done") || lowered.includes("complete")
          ? "done"
          : lowered.includes("start") || lowered.includes("run")
            ? "inProgress"
            : "todo";
    return {
      id: `e-${entry.ts}-${index}`,
      title: clampText(`${entry.event}: ${stringifyShort(entry.payload)}`, 64),
      agentId: props.selectedAgentId || props.agentsList?.defaultId || "main",
      status,
      priority: status === "blocked" ? "high" : "low",
      createdAtMs: entry.ts,
      source: "event" as const,
    };
  });

  return [...fromQueue, ...fromApprovals, ...fromEvents];
}

export function renderOps(props: OpsViewProps) {
  const agents = props.agentsList?.agents ?? [];
  const now = Date.now();
  const allTasks = deriveTasks(props);
  const failingRuns = allTasks.filter((task) => task.status === "blocked").length;
  const activeAgents = agents.length;
  const selectedAgentId =
    props.selectedAgentId || props.agentsList?.defaultId || agents[0]?.id || "main";
  const selectedAgent = agents.find((entry) => entry.id === selectedAgentId) ?? null;
  const selectedIdentity = props.agentIdentityById[selectedAgentId];

  const filteredTasks = allTasks.filter((task) => {
    if (props.filters.agent !== "all" && task.agentId !== props.filters.agent) {
      return false;
    }
    if (props.filters.status !== "all" && task.status !== props.filters.status) {
      return false;
    }
    if (props.filters.priority !== "all" && task.priority !== props.filters.priority) {
      return false;
    }
    const ageMs = now - task.createdAtMs;
    return ageMs <= props.filters.windowMinutes * 60_000;
  });

  const healthEntries = Object.entries(asRecord(props.healthSnapshot)).slice(0, 6);
  const latestActions = props.eventLog.slice(0, 5);
  const artifacts = props.agentFilesList?.files ?? [];
  const selectedArtifact = artifacts[0] ?? null;
  const preview = selectedArtifact ? props.agentFileContents[selectedArtifact.path] : null;
  const toolSummary = props.chatToolMessages.length;

  return html`
    <div class="grid ops-grid">
      <div class="card">
        <div class="card-title">${t("ops.home.title")}</div>
        <div class="card-sub">${t("ops.home.subtitle")}</div>
        <div class="stat-grid">
          <div class="stat">
            <div class="stat-label">${t("ops.home.activeAgents")}</div>
            <div class="stat-value ${activeAgents > 0 ? "ok" : "warn"}">${activeAgents}</div>
          </div>
          <div class="stat">
            <div class="stat-label">${t("ops.home.failingRuns")}</div>
            <div class="stat-value ${failingRuns > 0 ? "warn" : "ok"}">${failingRuns}</div>
          </div>
          <div class="stat">
            <div class="stat-label">${t("ops.home.queues")}</div>
            <div class="stat-value">${props.chatQueue.length + props.execApprovalQueue.length}</div>
          </div>
          <div class="stat">
            <div class="stat-label">${t("ops.home.throughput")}</div>
            <div class="stat-value">${props.throughputPerMinute}/min</div>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-2">
        <div class="card">
          <div class="card-title">${t("ops.agentDetail.title")}</div>
          <div class="card-sub">${selectedAgentId}</div>
          <div class="stack ops-stack-compact">
            <div><strong>${t("ops.agentDetail.name")}:</strong> ${selectedIdentity?.name || selectedAgent?.name || "n/a"}</div>
            <div><strong>${t("ops.agentDetail.capabilities")}:</strong> ${props.agentSkillsCount}</div>
            <div><strong>${t("ops.agentDetail.subagents")}:</strong> ${Math.max(0, agents.length - 1)}</div>
            <div><strong>${t("ops.agentDetail.health")}:</strong> ${props.connected ? "OK" : "Offline"}</div>
            <div>
              <strong>${t("ops.agentDetail.lastActions")}:</strong>
              <ul class="ops-list">
                ${
                  latestActions.length > 0
                    ? latestActions.map(
                        (action) => html`<li>${action.event} · ${formatMs(action.ts)}</li>`,
                      )
                    : html`<li>${t("ops.common.noData")}</li>`
                }
              </ul>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-title">${t("ops.realtime.title")}</div>
          <div class="card-sub">${t("ops.realtime.subtitle")}</div>
          <div class="stack ops-stack-compact">
            <div>
              <span class="pill ${props.connected ? "" : "danger"}">
                ${props.connected ? t("ops.realtime.wsConnected") : t("ops.realtime.wsDisconnected")}
              </span>
            </div>
            <div><strong>${t("ops.realtime.uptime")}:</strong> ${props.helloUptimeMs ? `${Math.round(props.helloUptimeMs / 1000)}s` : "n/a"}</div>
            <div><strong>${t("ops.realtime.streamedEvents")}:</strong> ${props.eventLog.length}</div>
            <div><strong>${t("ops.realtime.logLines")}:</strong> ${props.logsEntries.length}</div>
            <div class="ops-health-grid">
              ${
                healthEntries.length > 0
                  ? healthEntries.map(
                      ([key, value]) =>
                        html`<div class="chip"><strong>${key}</strong>: ${stringifyShort(value)}</div>`,
                    )
                  : html`<div class="chip">${t("ops.common.noData")}</div>`
              }
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">${t("ops.tasks.title")}</div>
        <div class="card-sub">${t("ops.tasks.subtitle")}</div>
        <div class="filters ops-filters">
          <label>
            ${t("ops.tasks.filters.agent")}
            <select @change=${(event: Event) => props.onFilterChange("agent", (event.target as HTMLSelectElement).value)}>
              <option value="all">All</option>
              ${agents.map((agent) => html`<option value=${agent.id} ?selected=${props.filters.agent === agent.id}>${agent.id}</option>`)}
            </select>
          </label>
          <label>
            ${t("ops.tasks.filters.status")}
            <select @change=${(event: Event) => props.onFilterChange("status", (event.target as HTMLSelectElement).value)}>
              <option value="all">All</option>
              ${TASK_COLUMNS.map((status) => html`<option value=${status} ?selected=${props.filters.status === status}>${status}</option>`)}
            </select>
          </label>
          <label>
            ${t("ops.tasks.filters.priority")}
            <select @change=${(event: Event) => props.onFilterChange("priority", (event.target as HTMLSelectElement).value)}>
              <option value="all">All</option>
              <option value="high" ?selected=${props.filters.priority === "high"}>high</option>
              <option value="medium" ?selected=${props.filters.priority === "medium"}>medium</option>
              <option value="low" ?selected=${props.filters.priority === "low"}>low</option>
            </select>
          </label>
          <label>
            ${t("ops.tasks.filters.time")}
            <select
              @change=${(event: Event) =>
                props.onFilterChange("windowMinutes", (event.target as HTMLSelectElement).value)}
            >
              <option value="15" ?selected=${props.filters.windowMinutes === 15}>15m</option>
              <option value="60" ?selected=${props.filters.windowMinutes === 60}>60m</option>
              <option value="240" ?selected=${props.filters.windowMinutes === 240}>240m</option>
              <option value="1440" ?selected=${props.filters.windowMinutes === 1440}>24h</option>
            </select>
          </label>
        </div>
        <div class="ops-kanban">
          ${TASK_COLUMNS.map((column) => {
            const items = filteredTasks.filter((task) => task.status === column);
            return html`<section class="ops-kanban-column">
              <h4>${column}</h4>
              ${
                items.length > 0
                  ? items.map(
                      (task) => html`<article class="ops-task-card">
                      <div class="ops-task-title">${task.title}</div>
                      <div class="ops-task-meta">${task.agentId} · ${task.priority} · ${task.source}</div>
                    </article>`,
                    )
                  : html`<div class="card-sub">${t("ops.common.noData")}</div>`
              }
            </section>`;
          })}
        </div>
      </div>

      <div class="grid grid-cols-2">
        <div class="card">
          <div class="card-title">${t("ops.artifacts.title")}</div>
          <div class="card-sub">${t("ops.artifacts.subtitle")}</div>
          <div class="stack ops-stack-compact">
            ${
              artifacts.length > 0
                ? artifacts.slice(0, 8).map(
                    (file) => html`<div class="ops-artifact-row">
                    <div>
                      <div class="mono">${file.name}</div>
                      <div class="card-sub">${file.path}</div>
                    </div>
                    <a class="btn btn-ghost" href="#" @click=${(event: Event) => event.preventDefault()}>Download</a>
                  </div>`,
                  )
                : html`<div class="card-sub">${t("ops.common.noData")}</div>`
            }
            ${
              selectedArtifact
                ? html`<div class="ops-preview">
                  <div class="label">Preview: ${selectedArtifact.name}</div>
                  <pre>${clampText(preview || "No preview available", 500)}</pre>
                </div>`
                : null
            }
          </div>
        </div>

        <div class="card">
          <div class="card-title">${t("ops.chat.title")}</div>
          <div class="card-sub">${t("ops.chat.subtitle")}</div>
          <div class="stack ops-stack-compact">
            <div><strong>${t("ops.chat.sessionContext")}:</strong> ${selectedAgentId}</div>
            <div><strong>${t("ops.chat.messages")}:</strong> ${props.chatMessages.length}</div>
            <div><strong>${t("ops.chat.toolSummary")}:</strong> ${toolSummary}</div>
            <div class="ops-chat-preview">
              ${(props.chatMessages || []).slice(-3).map((entry, index) => {
                const value = stringifyShort(entry);
                return html`<div class="chip">${index + 1}. ${clampText(value, 96)}</div>`;
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}
