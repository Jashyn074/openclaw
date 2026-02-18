export type IntegrationCapability = string;
export type IntegrationScope = string;

export type IntegrationActionResult<Output> = {
  output: Output;
  simulated: boolean;
  auditMetadata: IntegrationAuditMetadata;
};

export type IntegrationAuditMetadata = {
  integration: string;
  action: string;
  agentId: string;
  scopes: IntegrationScope[];
  simulated: boolean;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  quotaKey: string;
  capabilityChecks: IntegrationCapability[];
};

export type IntegrationRollbackHint = {
  summary: string;
  steps: string[];
};

export type IntegrationInputValidationResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      errors: string[];
    };

export type AgentIntegrationPolicy = {
  /** Allowlist of capabilities this agent can use for integrations. */
  allowedCapabilities: ReadonlySet<IntegrationCapability>;
  /** Fine-grained scopes this agent can request at execution time. */
  allowedScopes: ReadonlySet<IntegrationScope>;
  /** Per-integration hard quota for successful/simulated executions in the time window. */
  quotaPerMinute: number;
  /** Allowlisted local paths for any file access done by adapters. */
  filePathAllowlist: ReadonlyArray<string>;
};

export type IntegrationExecutionContext = {
  agentId: string;
  simulation: boolean;
  policy: AgentIntegrationPolicy;
};

export type IntegrationExecutionArgs<Input> = {
  input: Input;
  scopes: ReadonlyArray<IntegrationScope>;
  requiredCapabilities: ReadonlyArray<IntegrationCapability>;
  action: string;
};

export type IntegrationAdapter<Input, Output> = {
  id: string;
  validateInput(input: Input): IntegrationInputValidationResult;
  execute(args: {
    input: Input;
    context: IntegrationExecutionContext;
    scopes: ReadonlyArray<IntegrationScope>;
  }): Promise<Output>;
  auditMetadata(args: {
    action: string;
    context: IntegrationExecutionContext;
    scopes: ReadonlyArray<IntegrationScope>;
    requiredCapabilities: ReadonlyArray<IntegrationCapability>;
    startedAt: number;
    finishedAt: number;
    quotaKey: string;
  }): IntegrationAuditMetadata;
  rollbackHint(args: { input: Input; simulated: boolean }): IntegrationRollbackHint;
};
