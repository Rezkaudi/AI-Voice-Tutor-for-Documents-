/**
 * Domain-level error hierarchy.
 *
 * These errors are framework-agnostic: the domain and application layers throw
 * them without knowing about HTTP. The presentation layer maps `statusCode`
 * onto a real HTTP response (see `error-handler` middleware).
 */

/** Base class for every expected, client-facing error in the system. */
export class AppError extends Error {
  /** HTTP status this error maps to at the edge. */
  public readonly statusCode: number;
  /** Stable, machine-readable error code. */
  public readonly code: string;
  /** True for errors that are safe to surface verbatim to the caller. */
  public readonly expose: boolean;

  constructor(message: string, statusCode: number, code: string, expose = true) {
    super(message);
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.code = code;
    this.expose = expose;
    Error.captureStackTrace?.(this, new.target);
  }
}

/** The request was malformed or failed validation. */
export class ValidationError extends AppError {
  constructor(message = "The request was invalid.") {
    super(message, 400, "VALIDATION_ERROR");
  }
}

/** The request lacks valid authentication credentials. */
export class UnauthorizedError extends AppError {
  constructor(message = "Authentication is required.") {
    super(message, 401, "UNAUTHORIZED");
  }
}

/** A requested resource does not exist. */
export class NotFoundError extends AppError {
  constructor(message = "The requested resource was not found.") {
    super(message, 404, "NOT_FOUND");
  }
}

/** The request was well-formed but cannot be processed (e.g. an unreadable file). */
export class UnprocessableEntityError extends AppError {
  constructor(message = "The request could not be processed.") {
    super(message, 422, "UNPROCESSABLE_ENTITY");
  }
}

/** A downstream dependency failed unexpectedly. */
export class UpstreamError extends AppError {
  constructor(message = "An upstream service failed.") {
    super(message, 502, "UPSTREAM_ERROR");
  }
}
