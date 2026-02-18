export type AgentQuotaCheckResult =
  | { allowed: true; used: number; remaining: number }
  | { allowed: false; used: number; remaining: 0; retryInMs: number };

export type IntegrationRateLimiter = {
  checkAndIncrement(params: {
    agentId: string;
    integrationId: string;
    limitPerMinute: number;
  }): AgentQuotaCheckResult;
};

type QuotaBucket = {
  windowStartMs: number;
  count: number;
};

export function createInMemoryIntegrationRateLimiter(
  now: () => number = Date.now,
): IntegrationRateLimiter {
  const buckets = new Map<string, QuotaBucket>();
  const windowMs = 60_000;

  return {
    checkAndIncrement(params): AgentQuotaCheckResult {
      const key = `${params.agentId}:${params.integrationId}`;
      const currentMs = now();
      const existing = buckets.get(key);

      if (!existing || currentMs - existing.windowStartMs >= windowMs) {
        buckets.set(key, { windowStartMs: currentMs, count: 1 });
        return {
          allowed: true,
          used: 1,
          remaining: Math.max(params.limitPerMinute - 1, 0),
        };
      }

      if (existing.count >= params.limitPerMinute) {
        return {
          allowed: false,
          used: existing.count,
          remaining: 0,
          retryInMs: windowMs - (currentMs - existing.windowStartMs),
        };
      }

      existing.count += 1;
      return {
        allowed: true,
        used: existing.count,
        remaining: Math.max(params.limitPerMinute - existing.count, 0),
      };
    },
  };
}
