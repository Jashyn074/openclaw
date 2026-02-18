import { readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { IntegrationSandboxError } from "./errors.js";

export type SandboxedFs = {
  readTextFile(localPath: string): Promise<string>;
};

function isWithinAllowlistedPath(allowlist: ReadonlyArray<string>, requestedPath: string): boolean {
  const normalized = resolve(requestedPath);

  return allowlist.some((entry) => {
    const base = resolve(entry);
    return normalized === base || normalized.startsWith(`${base}${sep}`);
  });
}

export function createSandboxedFs(params: { allowlist: ReadonlyArray<string> }): SandboxedFs {
  return {
    async readTextFile(localPath: string): Promise<string> {
      if (!isWithinAllowlistedPath(params.allowlist, localPath)) {
        throw new IntegrationSandboxError(
          `Path '${localPath}' is outside integration sandbox allowlist`,
        );
      }

      return readFile(localPath, "utf8");
    },
  };
}
