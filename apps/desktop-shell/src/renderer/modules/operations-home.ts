import { selectHealthBanner, type OperationsProjectionState } from "../store/projections.js";

type OperationsHomeRefs = {
  healthBanner: HTMLElement;
  statusMessage: HTMLElement;
  loadingState: HTMLElement;
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
      refs.loadingState.hidden = hasEvents;
      refs.emptyState.hidden = state.activityFeed.length > 0;

      refs.kpiConnection.textContent = state.gatewayHealth.connectionState;
      refs.kpiQueueDepth.textContent = String(state.runQueue.queueDepth);
      refs.kpiActiveRuns.textContent = String(state.runQueue.activeRuns);
      refs.kpiFailures.textContent = String(state.runQueue.failuresLastHour);
      refs.kpiUptime.textContent = toDuration(state.gatewayHealth.uptimeSeconds);
      refs.kpiActiveAgents.textContent = String(state.agentActivity.activeAgents);

      if (state.activityFeed.length === 0) {
        refs.activityFeed.innerHTML = "";
      } else {
        refs.activityFeed.innerHTML = state.activityFeed
          .map((item) => {
            const time = new Date(item.at).toLocaleTimeString();
            return `<li class="feed-item" data-level="${item.level}"><span>${time}</span><p>${item.summary}</p></li>`;
          })
          .join("");
      }

      refs.trainingDatasetQueue.textContent = String(state.training.datasetQueueDepth);
      refs.trainingEvalRuns.textContent = String(state.training.evaluationRuns.length);
      refs.trainingRetrainJobs.textContent = String(state.training.retrainJobs.length);
      refs.trainingRegistry.textContent = String(state.training.modelRegistry.length);
    },
  };
}
