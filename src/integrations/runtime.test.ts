import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  IntegrationPolicyError,
  IntegrationQuotaError,
  IntegrationSandboxError,
} from "./errors.js";
import { fileAdapter } from "./file-adapter.js";
import { mailAdapter } from "./mail-adapter.js";
import { createAgentIntegrationPolicy } from "./policy.js";
import { createInMemoryIntegrationRateLimiter } from "./rate-limiter.js";
import { IntegrationRuntime } from "./runtime.js";
import { socialAdapter } from "./social-adapter.js";

function createRuntimeContext() {
  return {
    runtime: new IntegrationRuntime(createInMemoryIntegrationRateLimiter()),
    context: {
      agentId: "agent-main",
      simulation: false,
      policy: createAgentIntegrationPolicy({
        allowedCapabilities: ["mail.send", "social.publish", "file.read"],
        allowedScopes: ["mail.send", "social.draft", "social.publish", "file.read"],
        quotaPerMinute: 2,
        filePathAllowlist: [],
      }),
    },
  };
}

describe("integration runtime", () => {
  it("enforces capability checks before execution", async () => {
    const { runtime, context } = createRuntimeContext();

    await expect(
      runtime.run({
        adapter: mailAdapter,
        context,
        args: {
          action: "send",
          input: { to: "test@example.com", subject: "Hi", body: "Body" },
          requiredCapabilities: ["mail.read"],
          scopes: ["mail.send"],
        },
      }),
    ).rejects.toBeInstanceOf(IntegrationPolicyError);
  });

  it("enforces fine-grained scope checks", async () => {
    const { runtime, context } = createRuntimeContext();

    await expect(
      runtime.run({
        adapter: socialAdapter,
        context,
        args: {
          action: "publish",
          input: { text: "hello", channel: "x" },
          requiredCapabilities: ["social.publish"],
          scopes: ["social.admin"],
        },
      }),
    ).rejects.toBeInstanceOf(IntegrationPolicyError);
  });

  it("enforces per-agent quota", async () => {
    const { runtime, context } = createRuntimeContext();

    for (let i = 0; i < 2; i += 1) {
      await runtime.run({
        adapter: socialAdapter,
        context,
        args: {
          action: "draft",
          input: { text: `draft ${i}`, channel: "x" },
          requiredCapabilities: ["social.publish"],
          scopes: ["social.draft"],
        },
      });
    }

    await expect(
      runtime.run({
        adapter: socialAdapter,
        context,
        args: {
          action: "draft",
          input: { text: "draft 3", channel: "x" },
          requiredCapabilities: ["social.publish"],
          scopes: ["social.draft"],
        },
      }),
    ).rejects.toBeInstanceOf(IntegrationQuotaError);
  });

  it("supports simulation mode per adapter", async () => {
    const runtime = new IntegrationRuntime(createInMemoryIntegrationRateLimiter());
    const context = {
      agentId: "agent-main",
      simulation: true,
      policy: createAgentIntegrationPolicy({
        allowedCapabilities: ["mail.send"],
        allowedScopes: ["mail.send"],
        quotaPerMinute: 5,
        filePathAllowlist: [],
      }),
    };

    const result = await runtime.run({
      adapter: mailAdapter,
      context,
      args: {
        action: "send",
        input: { to: "test@example.com", subject: "Hi", body: "Body" },
        requiredCapabilities: ["mail.send"],
        scopes: ["mail.send"],
      },
    });

    expect(result.simulated).toBe(true);
    expect(result.output.mode).toBe("simulation");
    expect(result.auditMetadata.simulated).toBe(true);
  });

  it("enforces sandboxed file access allowlist", async () => {
    const tmp = await mkdtemp(join(tmpdir(), "openclaw-integrations-"));
    const allowedFile = join(tmp, "allowed.txt");
    const blockedFile = join(tmpdir(), "blocked.txt");
    await writeFile(allowedFile, "hello from allowed", "utf8");
    await writeFile(blockedFile, "blocked", "utf8");

    const runtime = new IntegrationRuntime(createInMemoryIntegrationRateLimiter());
    const context = {
      agentId: "agent-main",
      simulation: false,
      policy: createAgentIntegrationPolicy({
        allowedCapabilities: ["file.read"],
        allowedScopes: ["file.read"],
        quotaPerMinute: 5,
        filePathAllowlist: [tmp],
      }),
    };

    const ok = await runtime.run({
      adapter: fileAdapter,
      context,
      args: {
        action: "preview",
        input: { localPath: allowedFile },
        requiredCapabilities: ["file.read"],
        scopes: ["file.read"],
      },
    });
    expect(ok.output.preview).toContain("allowed");

    await expect(
      runtime.run({
        adapter: fileAdapter,
        context,
        args: {
          action: "preview",
          input: { localPath: blockedFile },
          requiredCapabilities: ["file.read"],
          scopes: ["file.read"],
        },
      }),
    ).rejects.toBeInstanceOf(IntegrationSandboxError);
  });
});
