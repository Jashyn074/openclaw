import { selectHealthBanner, type OperationsProjectionState } from "../store/projections.js";

type OperationsHomeRefs = {
  healthBanner: HTMLElement;
  statusMessage: HTMLElement;
  loadingState: HTMLElement;
  disconnectedState: HTMLElement;
  errorState: HTMLElement;
  emptyState: HTMLElement;
  kpiConnection: HTMLElement;
  kpiQueueDepth: HTMLElement;
  kpiActiveRuns: HTMLElement;
  kpiFailures: HTMLElement;
  kpiUptime: HTMLElement;
  kpiActiveAgents: HTMLElement;
  activityFeed: HTMLElement;
  trainingDatasetQueue: HTMLElement;
  trainingEvalRuns: HTMLElement;
  trainingRetrainJobs: HTMLElement;
  trainingRegistry: HTMLElement;
};

type DashboardStatePanel = "loading" | "disconnected" | "empty" | "ready";

export type OperationsHomeController = {
  render: (state: OperationsProjectionState) => void;
  setStatusMessage: (message: string) => void;
  setErrorMessage: (message: string | null) => void;
};

function requireNode(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Expected renderer node #${id} was not found.`);
  }

  return element;
}

function toDuration(uptimeSeconds: number): string {
  const total = Math.max(0, Math.floor(uptimeSeconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return `${hours}h ${minutes}m ${seconds}s`;
}

export function createOperationsHomeController(): OperationsHomeController {
  const refs: OperationsHomeRefs = {
    healthBanner: requireNode("healthBanner"),
    statusMessage: requireNode("statusMessage"),
    loadingState: requireNode("loadingState"),
    disconnectedState: requireNode("disconnectedState"),
    errorState: requireNode("errorState"),
    emptyState: requireNode("emptyState"),
    kpiConnection: requireNode("kpiConnection"),
    kpiQueueDepth: requireNode("kpiQueueDepth"),
    kpiActiveRuns: requireNode("kpiActiveRuns"),
    kpiFailures: requireNode("kpiFailures"),
    kpiUptime: requireNode("kpiUptime"),
    kpiActiveAgents: requireNode("kpiActiveAgents"),
    activityFeed: requireNode("activityFeed"),
    trainingDatasetQueue: requireNode("trainingDatasetQueue"),
    trainingEvalRuns: requireNode("trainingEvalRuns"),
    trainingRetrainJobs: requireNode("trainingRetrainJobs"),
    trainingRegistry: requireNode("trainingRegistry"),
  };

  return {
    setStatusMessage: (message) => {
      refs.statusMessage.textContent = message;
    },
    setErrorMessage: (message) => {
      refs.errorState.hidden = !message;
      refs.errorState.textContent = message ?? "";
    },
    render: (state) => {
      const banner = selectHealthBanner(state);
      refs.healthBanner.dataset.state = banner;
      refs.healthBanner.textContent =
        banner === "ok"
          ? "Gateway healthy"
          : banner === "degraded"
            ? "Gateway degraded"
            : "Gateway disconnected";

      const hasEvents = state.lastUpdatedAt !== null;
      const hasActivity = state.activityFeed.length > 0;
      const showDisconnected = state.gatewayHealth.connectionState === "disconnected";

      const dashboardState: DashboardStatePanel = !hasEvents
        ? "loading"
        : showDisconnected
          ? "disconnected"
          : hasActivity
            ? "ready"
            : "empty";

      refs.loadingState.hidden = dashboardState !== "loading";
      refs.disconnectedState.hidden = dashboardState !== "disconnected";
      refs.emptyState.hidden = dashboardState !== "empty";

      refs.kpiConnection.textContent = state.gatewayHealth.connectionState;
      refs.kpiQueueDepth.textContent = String(state.runQueue.queueDepth);
      refs.kpiActiveRuns.textContent = String(state.runQueue.activeRuns);
      refs.kpiFailures.textContent = String(state.runQueue.failuresLastHour);
      refs.kpiUptime.textContent = toDuration(state.gatewayHealth.uptimeSeconds);
      refs.kpiActiveAgents.textContent = String(state.agentActivity.activeAgents);

      const feedItems = state.activityFeed.map((item) => {
        const row = document.createElement("li");
        row.className = "feed-item";
        row.dataset.level = item.level;

        const time = document.createElement("time");
        time.dateTime = new Date(item.at).toISOString();
        time.textContent = new Date(item.at).toLocaleTimeString();

        const summary = document.createElement("p");
        summary.textContent = item.summary;

        row.append(time, summary);
        return row;
      });
      refs.activityFeed.replaceChildren(...feedItems);

      refs.trainingDatasetQueue.textContent = String(state.training.datasetQueueDepth);
      refs.trainingEvalRuns.textContent = String(state.training.evaluationRuns.length);
      refs.trainingRetrainJobs.textContent = String(state.training.retrainJobs.length);
      refs.trainingRegistry.textContent = String(state.training.modelRegistry.length);
    },
  };
}
