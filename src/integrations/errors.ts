export class IntegrationPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IntegrationPolicyError";
  }
}

export class IntegrationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IntegrationValidationError";
  }
}

export class IntegrationQuotaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IntegrationQuotaError";
  }
}

export class IntegrationSandboxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IntegrationSandboxError";
  }
}
