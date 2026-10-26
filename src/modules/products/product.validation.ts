import { ValidationError } from "../../errors.js";
import type { BoundingPolygon } from "./schemas/fields.schema.js";
import type { CreateProduct } from "./schemas/product.schema.js";
import type { UpdateProduct } from "./schemas/update-product.schema.js";

export class ProductValidationError extends ValidationError {
  constructor(field: string, message: string) {
    super(field, message);
    this.name = "ProductValidationError";
  }
}

export function validateBoundingPolygon(geometry: BoundingPolygon): void {
  const polygons =
    geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;

  let dimensions: number | undefined;

  for (const polygon of polygons) {
    for (const ring of polygon) {
      const first = ring[0];
      const last = ring.at(-1);

      if (
        !first ||
        !last ||
        first.length !== last.length ||
        first.some((coordinate, index) => coordinate !== last[index])
      ) {
        throw new ProductValidationError(
          "boundingPolygon",
          "Each ring must end with the same position it starts with.",
        );
      }

      for (const position of ring) {
        dimensions ??= position.length;

        if (position.length !== dimensions) {
          throw new ProductValidationError(
            "boundingPolygon",
            "All positions must consistently use two or three coordinates.",
          );
        }
      }
    }
  }
}

export function validateProductInput(input: CreateProduct): void {
  if (input.minZoom > input.maxZoom) {
    throw new ProductValidationError(
      "minZoom",
      "minZoom must not exceed maxZoom.",
    );
  }

  validateBoundingPolygon(input.boundingPolygon);
}

export function validateProductUpdate(input: UpdateProduct): void {
  if (
    input.minZoom !== undefined &&
    input.maxZoom !== undefined &&
    input.minZoom > input.maxZoom
  ) {
    throw new ProductValidationError(
      "minZoom",
      "minZoom must not exceed maxZoom.",
    );
  }

  if (input.boundingPolygon !== undefined) {
    validateBoundingPolygon(input.boundingPolygon);
  }
}
