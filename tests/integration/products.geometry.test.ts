import assert from "node:assert/strict";
import { test } from "node:test";
import { StatusCodes } from "http-status-codes";
import {
  makeProduct,
  storeProduct,
  withProductTest,
} from "../helpers/products.js";
import type { BoundingPolygon } from "../../src/modules/products/schemas/fields.schema.js";
import type { Product } from "../../src/modules/products/schemas/product.schema.js";

const ringXY: [number, number][] = [
  [34, 32],
  [35, 32],
  [35, 33],
  [34, 33],
  [34, 32],
];

const ringXYZ: [number, number, number][] = ringXY.map(
  ([longitude, latitude]) => [longitude, latitude, 25],
);

const cases: {
  name: string;
  geometry: BoundingPolygon;
  dimensions: number;
}[] = [
  {
    name: "Polygon XY",
    geometry: { type: "Polygon", coordinates: [ringXY] },
    dimensions: 2,
  },
  {
    name: "Polygon XYZ",
    geometry: { type: "Polygon", coordinates: [ringXYZ] },
    dimensions: 3,
  },
  {
    name: "MultiPolygon XY",
    geometry: { type: "MultiPolygon", coordinates: [[ringXY]] },
    dimensions: 2,
  },
  {
    name: "MultiPolygon XYZ",
    geometry: { type: "MultiPolygon", coordinates: [[ringXYZ]] },
    dimensions: 3,
  },
];

test("API stores and returns Polygon and MultiPolygon in XY and XYZ", () =>
  withProductTest(async ({ app, client }) => {
    for (const { name, geometry, dimensions } of cases) {
      const id = await storeProduct(
        app,
        makeProduct({ boundingPolygon: geometry }),
      );

      const response = await app.inject({
        method: "GET",
        url: `/products/${id}`,
      });

      assert.equal(
        response.statusCode,
        StatusCodes.OK,
        `${name}: ${response.body}`,
      );
      assert.deepEqual(
        response.json<Product>().boundingPolygon,
        geometry,
        name,
      );

      const { rows } = await client.query<{
        geometry: unknown;
        dimensions: number;
      }>(
        `SELECT ST_AsGeoJSON(bounding_polygon, 15, 0)::json AS geometry,
                ST_NDims(bounding_polygon) AS dimensions
         FROM products WHERE id = $1`,
        [id],
      );

      assert.deepEqual(rows[0]?.geometry, geometry, name);
      assert.equal(rows[0]?.dimensions, dimensions, name);
    }
  }));

test("API rejects Point geometry", () =>
  withProductTest(async ({ app }) => {
    const response = await app.inject({
      method: "POST",
      url: "/products",
      payload: {
        ...makeProduct(),
        boundingPolygon: { type: "Point", coordinates: [34, 32] },
      },
    });

    assert.equal(response.statusCode, StatusCodes.BAD_REQUEST, response.body);
  }));
