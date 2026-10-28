import assert from "node:assert/strict";
import { test } from "node:test";
import { PgDialect } from "drizzle-orm/pg-core";
import { DatabaseError } from "pg";

import { buildProductSearchConditions } from "../../src/modules/products/product-search.filters.js";
import {
  validateBoundingPolygon,
  validateProductFields,
} from "../../src/modules/products/product.validation.js";
import {
  ProductValidationError,
  rethrowProductDatabaseError,
} from "../../src/modules/products/products.errors.js";
import type { BoundingPolygon } from "../../src/modules/products/schemas/fields.schema.js";
import type { SearchProductsInput } from "../../src/modules/products/schemas/search-products.schema.js";

const ringXY: [number, number][] = [
  [34, 31],
  [35, 31],
  [35, 32],
  [34, 31],
];

const ringXYZ = ringXY.map(([x, y]): [number, number, number] => [x, y, 10]);

const polygon: BoundingPolygon = {
  type: "Polygon",
  coordinates: [ringXY],
};

const dialect = new PgDialect();

function query(input: SearchProductsInput) {
  const conditions = buildProductSearchConditions(input);
  assert.ok(conditions);
  return dialect.sqlToQuery(conditions);
}

test("geometry validation accepts closed XY and XYZ polygons and multipolygons", () => {
  const cases: BoundingPolygon[] = [
    polygon,
    { type: "Polygon", coordinates: [ringXYZ] },
    { type: "MultiPolygon", coordinates: [[ringXY]] },
    { type: "MultiPolygon", coordinates: [[ringXYZ]] },
  ];

  for (const geometry of cases) {
    assert.doesNotThrow(() => validateBoundingPolygon(geometry));
  }
});

test("geometry validation rejects an open ring", () => {
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

  assert.throws(
    () => validateBoundingPolygon(geometry),
    ProductValidationError,
  );
});

test("geometry validation rejects mixed coordinate dimensions", () => {
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

  assert.throws(
    () => validateBoundingPolygon(geometry),
    ProductValidationError,
  );
});

test("partial field validation accepts omitted geometry", () => {
  assert.doesNotThrow(() => validateProductFields({ name: "renamed" }));
});

test("empty search has no WHERE conditions", () => {
  assert.equal(buildProductSearchConditions({}), undefined);
});

test("search parameterizes text and joins text and numeric conditions with AND", () => {
  const name = "example' OR TRUE; --";

  const result = query({
    equal: { name },
    greater: { maxZoom: -1 },
  });

  assert.deepEqual(result.params, [name, -1]);
  assert.ok(!result.sql.includes(name));
  assert.match(result.sql, /\sand\s/i);
});

for (const [operator, comparison] of [
  ["equal", "="],
  ["greater", ">"],
  ["greaterEqual", ">="],
  ["less", "<"],
  ["lessEqual", "<="],
] as const) {
  test(`${operator} supports numeric thresholds beyond the stored integer range`, () => {
    const input: SearchProductsInput = {};
    input[operator] = { minZoom: 2_147_483_648 };

    const result = query(input);

    assert.deepEqual(result.params, [2_147_483_648]);
    assert.ok(result.sql.includes(` ${comparison} `));
    assert.match(result.sql, /::double precision/);
  });
}

for (const [operator, predicate] of [
  ["contains", "ST_Contains"],
  ["within", "ST_Within"],
  ["intersects", "ST_Intersects"],
] as const) {
  test(`${operator} places the product footprint first and parameterizes GeoJSON`, () => {
    const input: SearchProductsInput = {};
    input[operator] = { boundingPolygon: polygon };

    const result = query(input);

    assert.deepEqual(result.params, [JSON.stringify(polygon)]);

    const functionStart = result.sql.indexOf(predicate + "(");
    assert.ok(functionStart >= 0);

    const args = result.sql
      .slice(functionStart + predicate.length + 1)
      .trimStart();

    assert.ok(args.startsWith('"products"."bounding_polygon",'));
  });
}

test("database zoom-order violations become a product validation error", () => {
  const error = new DatabaseError("check failed", 0, "error");
  error.code = "23514";
  error.constraint = "products_zoom_range_valid";

  assert.throws(
    () => rethrowProductDatabaseError(error),
    (caught) => {
      assert.ok(caught instanceof ProductValidationError);
      assert.equal(caught.statusCode, 400);
      assert.equal(caught.field, "minZoom");
      return true;
    },
  );
});

test("unexpected database errors are rethrown unchanged", () => {
  const error = new Error("unexpected");

  assert.throws(
    () => rethrowProductDatabaseError(error),
    (caught) => caught === error,
  );
});
