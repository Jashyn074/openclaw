import {
  IntegrationPolicyError,
  IntegrationQuotaError,
  IntegrationValidationError,
} from "./errors.js";
import type { IntegrationRateLimiter } from "./rate-limiter.js";
import type {
  IntegrationActionResult,
  IntegrationAdapter,
  IntegrationExecutionArgs,
  IntegrationExecutionContext,
} from "./types.js";

function assertCapabilitiesAllowed(
  context: IntegrationExecutionContext,
  required: ReadonlyArray<string>,
): void {
  for (const capability of required) {
    if (!context.policy.allowedCapabilities.has(capability)) {
      throw new IntegrationPolicyError(
        `Agent '${context.agentId}' is missing required capability '${capability}'`,
      );
    }
  }
}

function assertScopesAllowed(
  context: IntegrationExecutionContext,
  scopes: ReadonlyArray<string>,
): void {
  for (const scope of scopes) {
    if (!context.policy.allowedScopes.has(scope)) {
      throw new IntegrationPolicyError(
        `Agent '${context.agentId}' is missing required scope '${scope}'`,
      );
    }
  }
}

export class IntegrationRuntime {
  constructor(private readonly rateLimiter: IntegrationRateLimiter) {}

  async run<Input, Output>(params: {
    adapter: IntegrationAdapter<Input, Output>;
    context: IntegrationExecutionContext;
    args: IntegrationExecutionArgs<Input>;
  }): Promise<IntegrationActionResult<Output>> {
    const { adapter, context, args } = params;
    const validation = adapter.validateInput(args.input);
    if (!validation.ok) {
      throw new IntegrationValidationError(validation.errors.join("; "));
    }

    assertCapabilitiesAllowed(context, args.requiredCapabilities);
    assertScopesAllowed(context, args.scopes);

    const quota = this.rateLimiter.checkAndIncrement({
      agentId: context.agentId,
      integrationId: adapter.id,
      limitPerMinute: context.policy.quotaPerMinute,
    });
    if (!quota.allowed) {
      throw new IntegrationQuotaError(
        `Quota exceeded for '${adapter.id}'. Retry in ${quota.retryInMs}ms`,
      );
    }

    const startedAt = Date.now();
    const output = await adapter.execute({
      input: args.input,
      context,
      scopes: args.scopes,
    });
    const finishedAt = Date.now();

    return {
      output,
      simulated: context.simulation,
      auditMetadata: adapter.auditMetadata({
        action: args.action,
        context,
        scopes: args.scopes,
        requiredCapabilities: args.requiredCapabilities,
        startedAt,
        finishedAt,
        quotaKey: `${context.agentId}:${adapter.id}`,
      }),
    };
  }
}
