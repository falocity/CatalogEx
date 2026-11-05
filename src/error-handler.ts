import type { FastifyInstance } from "fastify";
import { StatusCodes } from "http-status-codes";
import { AppError } from "./errors.js";

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      request.log.warn({ code: error.code, field: error.field }, error.message);

      return reply.code(error.statusCode).send({
        code: error.code,
        message: error.message,
        ...(error.field === undefined ? {} : { field: error.field }),
      });
    }

    if (error instanceof Error && "statusCode" in error) {
      switch (error.statusCode) {
        case StatusCodes.BAD_REQUEST:
          request.log.warn({ err: error }, "Request validation failed");

          return reply.code(StatusCodes.BAD_REQUEST).send({
            code: "VALIDATION_ERROR",
            message: error.message,
          });

        case StatusCodes.REQUEST_TOO_LONG:
          return reply.code(StatusCodes.REQUEST_TOO_LONG).send({
            code: "PAYLOAD_TOO_LARGE",
            message: "Request body is too large.",
          });

        case StatusCodes.UNSUPPORTED_MEDIA_TYPE:
          return reply.code(StatusCodes.UNSUPPORTED_MEDIA_TYPE).send({
            code: "UNSUPPORTED_MEDIA_TYPE",
            message: "Content-Type must be application/json.",
          });
      }
    }

    request.log.error({ err: error }, "Request failed");

    return reply.code(StatusCodes.INTERNAL_SERVER_ERROR).send({
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred.",
    });
  });
}
