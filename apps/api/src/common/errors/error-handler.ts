import type { FastifyError, FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { errorResponse } from "../response/api-response";
import { AppError } from "./app-error";
import { ERROR_MESSAGES } from "./error.messages";

export function setupErrorHandler(fastify: FastifyInstance): void {
  fastify.setNotFoundHandler((_request, reply) =>
    reply.status(404).send(errorResponse({ code: 404, message: ERROR_MESSAGES.notFound })),
  );
  fastify.setErrorHandler((error: FastifyError | Error, request, reply) => {
    // 1. Handle Zod validation errors
    if (error instanceof ZodError) {
      const details = error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }));

      request.log.warn({ err: error, path: request.url, details }, "Schema validation error");

      return reply.status(400).send(
        errorResponse({
          code: 400,
          message: ERROR_MESSAGES.requestValidationFailed,
          details,
        }),
      );
    }

    // 2. Handle Fastify built-in schema validation errors
    if ("validation" in error && Array.isArray(error.validation)) {
      const details = error.validation.map((v) => ({
        field: v.instancePath?.replace(/^\//, "") || v.keyword,
        message: v.message || ERROR_MESSAGES.invalidValue,
      }));

      request.log.warn({ err: error, path: request.url, details }, "Fastify validation error");

      return reply.status(400).send(
        errorResponse({
          code: 400,
          message: ERROR_MESSAGES.requestValidationFailed,
          details,
        }),
      );
    }

    // 3. Handle Domain AppError instances
    if (error instanceof AppError) {
      if (error.statusCode >= 500) {
        request.log.error({ err: error, path: request.url }, error.message);
      } else {
        request.log.warn({ err: error, path: request.url }, error.message);
      }

      return reply.status(error.statusCode).send(
        errorResponse({
          code: error.statusCode,
          message: error.message,
          details: error.details,
        }),
      );
    }

    // Preserve HTTP errors raised by Fastify (e.g. malformed JSON or unsupported media).
    if (
      "statusCode" in error &&
      typeof error.statusCode === "number" &&
      error.statusCode >= 400 &&
      error.statusCode < 500
    ) {
      return reply.status(error.statusCode).send(
        errorResponse({
          code: error.statusCode,
          message: error.message,
        }),
      );
    }

    // 4. Handle unexpected runtime errors (500)
    request.log.error({ err: error, path: request.url }, "Unhandled server error");

    const isDev = process.env.NODE_ENV !== "production";

    return reply.status(500).send(
      errorResponse({
        code: 500,
        message: isDev ? error.message : ERROR_MESSAGES.unexpectedInternalServerError,
      }),
    );
  });
}
