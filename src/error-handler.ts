import type { FastifyInstance } from "fastify";
import { StatusCodes } from "http-status-codes";
import { DrizzleQueryError } from "drizzle-orm";
import { DatabaseError } from "pg";
import { ProductValidationError } from "./modules/products/product.validation.js";

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ProductValidationError) {
      return reply.code(StatusCodes.BAD_REQUEST).send({
        code: "VALIDATION_ERROR",
        message: error.message,
        field: error.field,
      });
    }

    if (error instanceof Error && "statusCode" in error) {
      switch (error.statusCode) {
        case StatusCodes.BAD_REQUEST:
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

    const databaseError =
      error instanceof DrizzleQueryError ? error.cause : error;

    if (
      databaseError instanceof DatabaseError &&
      databaseError.code === "23514" &&
      databaseError.constraint === "products_bounding_polygon_valid"
    ) {
      return reply.code(StatusCodes.BAD_REQUEST).send({
        code: "VALIDATION_ERROR",
        message: "boundingPolygon must be a valid, nonempty geometry.",
        field: "boundingPolygon",
      });
    }

    request.log.error({ err: error }, "Request failed");

    return reply.code(StatusCodes.INTERNAL_SERVER_ERROR).send({
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred.",
    });
  });
}
