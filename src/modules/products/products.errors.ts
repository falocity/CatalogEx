import { DrizzleQueryError } from "drizzle-orm";
import { DatabaseError } from "pg";
import { StatusCodes } from "http-status-codes";
import { AppError, ValidationError } from "../../errors.js";

const POSTGRES_CHECK_VIOLATION = "23514";
const POSTGRES_NUMERIC_OUT_OF_RANGE = "22003";

export class ProductNotFoundError extends AppError {
  constructor() {
    super(
      "PRODUCT_NOT_FOUND",
      "Product not found.",
      StatusCodes.NOT_FOUND,
      "id",
    );

    this.name = "ProductNotFoundError";
  }
}

export function rethrowProductDatabaseError(error: unknown): never {
  const databaseError =
    error instanceof DrizzleQueryError ? error.cause : error;

  if (
    databaseError instanceof DatabaseError &&
    databaseError.code === POSTGRES_NUMERIC_OUT_OF_RANGE
  ) {
    throw new AppError(
      "VALIDATION_ERROR",
      "A numeric value is outside the supported storage range.",
      StatusCodes.BAD_REQUEST,
    );
  }

  if (
    databaseError instanceof DatabaseError &&
    databaseError.code === POSTGRES_CHECK_VIOLATION
  ) {
    switch (databaseError.constraint) {
      case "products_zoom_range_valid":
        throw new ValidationError(
          "minZoom",
          "minZoom must not exceed maxZoom.",
        );

      case "products_bounding_polygon_valid":
        throw new ValidationError(
          "boundingPolygon",
          "boundingPolygon must be a valid, nonempty geometry.",
        );
    }
  }

  throw error;
}
