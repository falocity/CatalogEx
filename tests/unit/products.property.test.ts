import fc from "fast-check";
import { expect, test } from "vitest";
import { validateBoundingPolygon } from "../../src/modules/products/product.validation.js";
import { ProductValidationError } from "../../src/modules/products/products.errors.js";

const polygons = fc
  .record({
    left: fc.integer({ min: -170, max: 160 }),
    bottom: fc.integer({ min: -80, max: 70 }),
    width: fc.integer({ min: 1, max: 10 }),
    height: fc.integer({ min: 1, max: 10 }),
    xyz: fc.boolean(),
    altitude: fc.integer({ min: -1000, max: 10000 }),
  })
  .map(({ left, bottom, width, height, xyz, altitude }) => {
    const position = (
      x: number,
      y: number,
    ): [number, number] | [number, number, number] =>
      xyz ? [x, y, altitude] : [x, y];

    return {
      type: "Polygon" as const,
      coordinates: [
        [
          position(left, bottom),
          position(left + width, bottom),
          position(left + width, bottom + height),
          position(left, bottom + height),
          position(left, bottom),
        ],
      ],
    };
  });

test("closed rectangles pass structural validation in XY and XYZ", () => {
  fc.assert(
    fc.property(polygons, (polygon) => {
      expect(() => validateBoundingPolygon(polygon)).not.toThrow();

      expect(() =>
        validateBoundingPolygon({
          type: "MultiPolygon",
          coordinates: [polygon.coordinates],
        }),
      ).not.toThrow();
    }),
    { numRuns: 50 },
  );
});

test("breaking a generated ring closure causes validation failure", () => {
  fc.assert(
    fc.property(polygons, (polygon) => {
      const ring = polygon.coordinates[0]!;

      const openPolygon = {
        ...polygon,
        coordinates: [[...ring.slice(0, -1), ring[1]!]],
      };

      expect(() => validateBoundingPolygon(openPolygon)).toThrow(
        ProductValidationError,
      );
    }),
    { numRuns: 50 },
  );
});
