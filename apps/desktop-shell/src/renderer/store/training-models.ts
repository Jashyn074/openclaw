export type DatasetCurationStatus = "queued" | "curating" | "validated" | "rejected" | "failed";

export type EvaluationRunStatus = "queued" | "running" | "passed" | "failed" | "cancelled";

export type RetrainJobStatus = "queued" | "preparing" | "running" | "completed" | "failed" | "cancelled";

export type ModelRegistryStatus = "candidate" | "active" | "rolled_back" | "archived";

export type DatasetCurationRecord = {
  datasetId: string;
  status: DatasetCurationStatus;
  itemCount: number;
  owner: string;
  updatedAt: number;
  notes: string | null;
};

export type EvaluationRunRecord = {
  evaluationId: string;
  modelId: string;
  datasetId: string;
  status: EvaluationRunStatus;
  score: number | null;
  updatedAt: number;
};

export type RetrainJobRecord = {
  jobId: string;
  trigger: string;
  modelId: string;
  status: RetrainJobStatus;
  updatedAt: number;
};

export type ModelRegistryEntry = {
  modelId: string;
  status: ModelRegistryStatus;
  datasetId: string;
  datasetHash: string;
  baseModel: string;
  adapterId: string;
  evalScore: number | null;
  rollbackPointer: string | null;
  updatedAt: number;
};

