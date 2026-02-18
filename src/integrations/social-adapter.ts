import type {
  IntegrationAdapter,
  IntegrationAuditMetadata,
  IntegrationExecutionContext,
  IntegrationInputValidationResult,
  IntegrationRollbackHint,
} from "./types.js";

export type SocialInput = {
  text: string;
  channel: "x" | "linkedin";
};

export type SocialOutput = {
  mode: "simulation" | "live";
  postRef: string;
};

function validateSocialInput(input: SocialInput): IntegrationInputValidationResult {
  const errors: string[] = [];
  if (!input.text.trim()) {
    errors.push("'text' is required");
  }
  if (input.text.length > 280) {
    errors.push("'text' cannot exceed 280 characters");
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true };
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
    integration: "social",
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

function buildRollbackHint(params: {
  simulated: boolean;
  input: SocialInput;
}): IntegrationRollbackHint {
  return params.simulated
    ? {
        summary: "Simulation mode: no rollback required.",
        steps: ["No post was published."],
      }
    : {
        summary: "Delete or edit the published post.",
        steps: [
          `Open ${params.input.channel} publisher dashboard.`,
          "Remove the post or publish a correction comment.",
        ],
      };
}

export const socialAdapter: IntegrationAdapter<SocialInput, SocialOutput> = {
  id: "social",
  validateInput: validateSocialInput,
  async execute(args): Promise<SocialOutput> {
    const mode = args.context.simulation ? "simulation" : "live";
    return {
      mode,
      postRef: `${args.input.channel}-${mode}-${Date.now()}`,
    };
  },
  auditMetadata: buildAuditMetadata,
  rollbackHint: buildRollbackHint,
};
