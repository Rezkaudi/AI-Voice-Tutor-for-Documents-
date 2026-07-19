export class AppError extends Error {

  public readonly statusCode: number;
  public readonly code: string;
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

export class ValidationError extends AppError {
  constructor(message = "The request was invalid.") {
    super(message, 400, "VALIDATION_ERROR");
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication is required.") {
    super(message, 401, "UNAUTHORIZED");
  }
}

export class NotFoundError extends AppError {
  constructor(message = "The requested resource was not found.") {
    super(message, 404, "NOT_FOUND");
  }
}

export class UnprocessableEntityError extends AppError {
  constructor(message = "The request could not be processed.") {
    super(message, 422, "UNPROCESSABLE_ENTITY");
  }
}

export class UpstreamError extends AppError {
  constructor(message = "An upstream service failed.") {
    super(message, 502, "UPSTREAM_ERROR");
  }
}

export class PreconditionFailedError extends AppError {
  constructor(message = "The resource was modified concurrently.") {
    super(message, 412, "PRECONDITION_FAILED", false);
  }
}
