import type { ApiErrorDetail } from "@metastorage/shared";
import { ERROR_MESSAGES } from "./error.messages";

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: ApiErrorDetail[];

  constructor(
    message: string,
    statusCode = 500,
    code = "INTERNAL_SERVER_ERROR",
    details?: ApiErrorDetail[],
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = ERROR_MESSAGES.notFound, details?: ApiErrorDetail[]) {
    super(message, 404, "NOT_FOUND", details);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string = ERROR_MESSAGES.badRequest, details?: ApiErrorDetail[]) {
    super(message, 400, "BAD_REQUEST", details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = ERROR_MESSAGES.unauthorized, details?: ApiErrorDetail[]) {
    super(message, 401, "UNAUTHORIZED", details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = ERROR_MESSAGES.forbidden, details?: ApiErrorDetail[]) {
    super(message, 403, "FORBIDDEN", details);
  }
}

export class ConflictError extends AppError {
  constructor(message: string = ERROR_MESSAGES.conflict, details?: ApiErrorDetail[]) {
    super(message, 409, "CONFLICT", details);
  }
}

export class ValidationError extends AppError {
  constructor(message: string = ERROR_MESSAGES.validationFailed, details?: ApiErrorDetail[]) {
    super(message, 422, "VALIDATION_ERROR", details);
  }
}
