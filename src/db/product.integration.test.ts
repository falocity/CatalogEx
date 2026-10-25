import assert from "node:assert/strict";
import { after, test } from "node:test";
import { pool } from "./client.js";

after(async () => {
  await pool.end();
});

const ringXY = [
  [34, 32],
  [35, 32],
  [35, 33],
  [34, 33],
  [34, 32],
];

const ringXYZ = ringXY.map(([longitude, latitude]) => [
  longitude,
  latitude,
  25,
]);

const cases = [
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
for (const example of cases) {
  test(`products preserves ${example.name}`, async () => {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const result = await client.query<{
        geometry: unknown;
        srid: number;
        dimensions: number;
      }>(
        `
          INSERT INTO products (
            name,
            bounding_polygon,
            consumption_link,
            product_type,
            consumption_protocol,
            resolution_best,
            min_zoom,
            max_zoom
          )
          VALUES (
            $1,
            ST_SetSRID(ST_GeomFromGeoJSON($2), 4326),
            $3,
            'raster',
            'WMS',
            0.5,
            1,
            18
          )
          RETURNING
            ST_AsGeoJSON(bounding_polygon, 15, 0)::json AS geometry,
            ST_SRID(bounding_polygon) AS srid,
            ST_NDims(bounding_polygon) AS dimensions
        `,
        [
          example.name,
          JSON.stringify(example.geometry),
          "https://example.com/wms",
        ],
      );
      assert.equal(result.rows.length, 1);

      const stored = result.rows[0];
      assert.ok(stored);

      assert.deepStrictEqual(stored.geometry, example.geometry);
      assert.equal(stored.srid, 4326);
      assert.equal(stored.dimensions, example.dimensions);
    } finally {
      try {
        await client.query("ROLLBACK");
      } finally {
        client.release();
      }
    }
  });
}
test("products rejects Point geometry", async () => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await assert.rejects(
      () =>
        client.query(`
          INSERT INTO products (
            name, bounding_polygon, consumption_link,
            product_type, consumption_protocol,
            resolution_best, min_zoom, max_zoom
          )
          VALUES (
            'Rejected Point',
            ST_SetSRID(ST_MakePoint(34, 32), 4326),
            'https://example.com/wms',
            'raster', 'WMS',
            0.5, 1, 18
          )
        `),
      {
        code: "23514",
        constraint: "products_bounding_polygon_type",
      },
    );
  } finally {
    try {
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  }
});
