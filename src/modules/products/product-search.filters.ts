import { and, eq, gt, gte, lt, lte, sql, type SQL } from "drizzle-orm";
import { products } from "../../db/schema.js";
import { geometryToSql } from "./geometry.utils.js";
import {
  EQUALITY_FILTER_FIELDS,
  NUMERIC_FILTER_FIELDS,
} from "./schemas/filter-operators.schema.js";
import type { SearchProductsInput } from "./schemas/search-products.schema.js";

const numericFields = new Set<string>(NUMERIC_FILTER_FIELDS);

const textEqualityFields = EQUALITY_FILTER_FIELDS.filter(
  (field) => !numericFields.has(field),
);

export function buildProductSearchConditions(
  input: SearchProductsInput,
): SQL | undefined {
  const conditions: SQL[] = [];

  for (const field of textEqualityFields) {
    const value = input.equal?.[field];

    if (value !== undefined) {
      conditions.push(eq(products[field], value));
    }
  }

  const numericGroups = [
    { operands: input.equal, compare: eq },
    { operands: input.greater, compare: gt },
    { operands: input.greaterEqual, compare: gte },
    { operands: input.less, compare: lt },
    { operands: input.lessEqual, compare: lte },
  ];

  for (const { operands, compare } of numericGroups) {
    for (const field of NUMERIC_FILTER_FIELDS) {
      const value = operands?.[field];

      if (value !== undefined) {
        conditions.push(
          compare(products[field], sql`${value}::double precision`),
        );
      }
    }
  }

  const spatialGroups = [
    { operands: input.contains, predicate: sql`ST_Contains` },
    { operands: input.within, predicate: sql`ST_Within` },
    { operands: input.intersects, predicate: sql`ST_Intersects` },
  ];

  for (const { operands, predicate } of spatialGroups) {
    const geometry = operands?.boundingPolygon;

    if (geometry !== undefined) {
      conditions.push(
        sql`${predicate}(
          ${products.boundingPolygon},
          ${geometryToSql(geometry)}
        )`,
      );
    }
  }

  return and(...conditions);
}
