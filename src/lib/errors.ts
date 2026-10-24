/** Base class so callers can distinguish "our" failures from bugs. */
export class AppError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly retryable = false,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class UpstreamError extends AppError {
  constructor(
    message: string,
    readonly service: string,
    readonly statusCode?: number,
    retryable = false,
    cause?: unknown,
  ) {
    super(message, "UPSTREAM_ERROR", retryable, cause);
  }
}

export class ParseError extends AppError {
  constructor(message: string, cause?: unknown) {
    super(message, "PARSE_ERROR", false, cause);
  }
}

export class ConfigError extends AppError {
  constructor(message: string) {
    super(message, "CONFIG_ERROR", false);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, "NOT_FOUND", false);
  }
}

export function toErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return typeof e === "string" ? e : JSON.stringify(e);
}
