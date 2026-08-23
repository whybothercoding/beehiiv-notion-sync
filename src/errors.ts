export class SyncError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ConfigError extends SyncError {}

export class BeehiivApiError extends SyncError {
  constructor(
    message: string,
    public readonly status?: number,
    options?: { cause?: unknown }
  ) {
    super(message, options);
  }
}

export class BeehiivSchemaError extends SyncError {
  constructor(
    message: string,
    public readonly issues: string[],
    options?: { cause?: unknown }
  ) {
    super(`${message}: ${issues.join('; ')}`, options);
  }
}

export class NotionApiError extends SyncError {
  constructor(
    message: string,
    public readonly notionCode?: string,
    options?: { cause?: unknown }
  ) {
    super(message, options);
  }
}
