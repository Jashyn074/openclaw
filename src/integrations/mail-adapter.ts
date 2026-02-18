import type {
  IntegrationAdapter,
  IntegrationAuditMetadata,
  IntegrationExecutionContext,
  IntegrationInputValidationResult,
  IntegrationRollbackHint,
} from "./types.js";

export type MailInput = {
  to: string;
  subject: string;
  body: string;
};

export type MailOutput = {
  mode: "simulation" | "live";
  messageId: string;
};

function validateMailInput(input: MailInput): IntegrationInputValidationResult {
  const errors: string[] = [];
  if (!input.to.includes("@")) {
    errors.push("'to' must be a valid email address");
  }
  if (!input.subject.trim()) {
    errors.push("'subject' is required");
  }
  if (!input.body.trim()) {
    errors.push("'body' is required");
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
    integration: "mail",
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
  input: MailInput;
}): IntegrationRollbackHint {
  return params.simulated
    ? {
        summary: "Simulation mode: no rollback required.",
        steps: ["No live email was sent."],
      }
    : {
        summary: "If needed, send a correction email to the same recipient.",
        steps: [
          `Send follow-up to ${params.input.to} with corrected content.`,
          "Reference previous subject and explain the correction.",
        ],
      };
}

export const mailAdapter: IntegrationAdapter<MailInput, MailOutput> = {
  id: "mail",
  validateInput: validateMailInput,
  async execute(args): Promise<MailOutput> {
    const mode = args.context.simulation ? "simulation" : "live";
    // Actual provider I/O is handled elsewhere; adapter shape keeps policy/scope checks centralized.
    return {
      mode,
      messageId: `${mode}-mail-${Date.now()}`,
    };
  },
  auditMetadata: buildAuditMetadata,
  rollbackHint: buildRollbackHint,
};
