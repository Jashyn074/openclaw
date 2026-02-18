import type { AgentIntegrationPolicy } from "./types.js";

export function createAgentIntegrationPolicy(params: {
  allowedCapabilities: ReadonlyArray<string>;
  allowedScopes: ReadonlyArray<string>;
  quotaPerMinute: number;
  filePathAllowlist: ReadonlyArray<string>;
}): AgentIntegrationPolicy {
  return {
    allowedCapabilities: new Set(params.allowedCapabilities),
    allowedScopes: new Set(params.allowedScopes),
    quotaPerMinute: Math.max(params.quotaPerMinute, 1),
    filePathAllowlist: [...params.filePathAllowlist],
  };
}
