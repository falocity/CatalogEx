import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { buildProductSearchConditions } from "../../src/modules/products/product-search.filters.js";
import type { BoundingPolygon } from "../../src/modules/products/schemas/fields.schema.js";
import type { SearchProductsInput } from "../../src/modules/products/schemas/search-products.schema.js";

const ringXY: [number, number][] = [
  [34, 31],
  [35, 31],
  [35, 32],
  [34, 31],
];

const polygon: BoundingPolygon = {
  type: "Polygon",
  coordinates: [ringXY],
};

const dialect = new PgDialect();

function query(input: SearchProductsInput) {
  const conditions = buildProductSearchConditions(input);
  if (conditions === undefined) {
    throw new Error("Expected search conditions");
  }

  return dialect.sqlToQuery(conditions);
}

describe("product search filters", () => {
  it("does not add WHERE conditions for an empty search", () => {
    expect(buildProductSearchConditions({})).toBeUndefined();
  });

  it("parameterizes text and joins text and numeric conditions with AND", () => {
    const name = "example' OR TRUE; --";

    const result = query({
      equal: { name },
      greater: { maxZoom: -1 },
    });

    expect(result.params).toEqual([name, -1]);
    expect(result.sql).not.toContain(name);
    expect(result.sql).toMatch(/\sand\s/i);
  });

  it.each([
    ["equal", "="],
    ["greater", ">"],
    ["greaterEqual", ">="],
    ["less", "<"],
    ["lessEqual", "<="],
  ] as const)(
    "$0 supports numeric thresholds beyond the stored integer range",
    (operator, comparison) => {
      const input: SearchProductsInput = {};
      input[operator] = { minZoom: 2_147_483_648 };

      const result = query(input);

      expect(result.params).toEqual([2_147_483_648]);
      expect(result.sql).toContain(` ${comparison} `);
      expect(result.sql).toMatch(/::double precision/);
    },
  );

  it.each([
    ["contains", "ST_Contains"],
    ["within", "ST_Within"],
    ["intersects", "ST_Intersects"],
  ] as const)(
    "$0 places the product footprint first and parameterizes GeoJSON",
    (operator, predicate) => {
      const input: SearchProductsInput = {};
      input[operator] = { boundingPolygon: polygon };

      const result = query(input);

      expect(result.params).toEqual([JSON.stringify(polygon)]);

      const functionStart = result.sql.indexOf(predicate + "(");
      expect(functionStart).toBeGreaterThanOrEqual(0);

      const args = result.sql
        .slice(functionStart + predicate.length + 1)
        .trimStart();

      expect(args).toMatch(/^"products"\."bounding_polygon",/);
    },
  );
});
