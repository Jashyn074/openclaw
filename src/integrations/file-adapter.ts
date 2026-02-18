import { createSandboxedFs } from "./sandbox-fs.js";
import type {
  IntegrationAdapter,
  IntegrationAuditMetadata,
  IntegrationExecutionContext,
  IntegrationInputValidationResult,
  IntegrationRollbackHint,
} from "./types.js";

export type FileInput = {
  localPath: string;
};

export type FileOutput = {
  mode: "simulation" | "live";
  preview: string;
};

function validateFileInput(input: FileInput): IntegrationInputValidationResult {
  if (!input.localPath.trim()) {
    return { ok: false, errors: ["'localPath' is required"] };
  }

  return { ok: true };
}

function buildAuditMetadata(params: {
  action: string;
  context: IntegrationExecutionContext;
  scopes: ReadonlyArray<string>;
  requiredCapabilities: ReadonlyArray<string>;
  startedAt: number;
  finishedAt: number;
  quotaKey: string;
}): IntegrationAuditMetadata {
  return {
    integration: "file",
    action: params.action,
    agentId: params.context.agentId,
    scopes: [...params.scopes],
    simulated: params.context.simulation,
    startedAt: new Date(params.startedAt).toISOString(),
    finishedAt: new Date(params.finishedAt).toISOString(),
    durationMs: params.finishedAt - params.startedAt,
    quotaKey: params.quotaKey,
    capabilityChecks: [...params.requiredCapabilities],
  };
}

export const fileAdapter: IntegrationAdapter<FileInput, FileOutput> = {
  id: "file",
  validateInput: validateFileInput,
  async execute(args): Promise<FileOutput> {
    if (args.context.simulation) {
      return { mode: "simulation", preview: "Simulation mode: file read skipped." };
    }

    const fs = createSandboxedFs({ allowlist: args.context.policy.filePathAllowlist });
    const content = await fs.readTextFile(args.input.localPath);
    return {
      mode: "live",
      preview: content.slice(0, 120),
    };
  },
  auditMetadata: buildAuditMetadata,
  rollbackHint(args): IntegrationRollbackHint {
    return args.simulated
      ? {
          summary: "Simulation mode: no rollback required.",
          steps: ["No file was read."],
        }
      : {
          summary: "File reads are non-destructive.",
          steps: ["No rollback action required."],
        };
  },
};
