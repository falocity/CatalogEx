import type { BoundingPolygon } from "./schemas/fields.schema.js";
import type { CreateProduct } from "./schemas/product.schema.js";

export class ProductValidationError extends Error {
  readonly field: string;

  constructor(field: string, message: string) {
    super(message);
    this.name = "ProductValidationError";
    this.field = field;
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
