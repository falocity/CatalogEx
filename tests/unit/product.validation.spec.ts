import { describe, expect, it } from "vitest";
import {
  validateBoundingPolygon,
  validateProductFields,
} from "../../src/modules/products/product.validation.js";
import { ProductValidationError } from "../../src/modules/products/products.errors.js";
import type { BoundingPolygon } from "../../src/modules/products/schemas/fields.schema.js";
import { validFootprints } from "../helpers/geometry.js";

describe("product geometry validation", () => {
  it.each(validFootprints)(
    "accepts a closed $name geometry",
    ({ geometry }) => {
      expect(() => validateBoundingPolygon(geometry)).not.toThrow();
    },
  );

  it("rejects an open ring", () => {
    const geometry: BoundingPolygon = {
      type: "Polygon",
      coordinates: [
        [
          [34, 31],
          [35, 31],
          [35, 32],
          [34, 32],
        ],
      ],
    };

    expect(() => validateBoundingPolygon(geometry)).toThrow(
      ProductValidationError,
    );
  });

  it("rejects mixed coordinate dimensions", () => {
    const geometry: BoundingPolygon = {
      type: "Polygon",
      coordinates: [
        [
          [34, 31],
          [35, 31, 10],
          [35, 32],
          [34, 31],
        ],
      ],
    };

    expect(() => validateBoundingPolygon(geometry)).toThrow(
      ProductValidationError,
    );
  });
});

describe("product fields", () => {
  it("accepts omitted geometry on an update", () => {
    expect(() => validateProductFields({ name: "renamed" })).not.toThrow();
  });
});
