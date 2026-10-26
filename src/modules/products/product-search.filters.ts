import { and, eq, gt, gte, lt, lte, sql, type SQL } from "drizzle-orm";
import { products } from "../../db/schema.js";
import { geometryToSql } from "./geometry.utils.js";
import type { SearchProductsInput } from "./schemas/search-products.schema.js";

export function buildProductSearchConditions(
  input: SearchProductsInput,
): SQL | undefined {
  const conditions: SQL[] = [];

  const numericFields = ["resolutionBest", "minZoom", "maxZoom"] as const;

  const equalityFields = [
    "id",
    "name",
    "description",
    "consumptionLink",
    "productType",
    "consumptionProtocol",
    ...numericFields,
  ] as const;

  for (const field of equalityFields) {
    const value = input.equal?.[field];

    if (value !== undefined) {
      const operand =
        typeof value === "number" ? sql`${value}::double precision` : value;

      conditions.push(eq(products[field], operand));
    }
  }

  const numericGroups = [
    { operands: input.greater, compare: gt },
    { operands: input.greaterEqual, compare: gte },
    { operands: input.less, compare: lt },
    { operands: input.lessEqual, compare: lte },
  ];

  for (const { operands, compare } of numericGroups) {
    for (const field of numericFields) {
      const value = operands?.[field];

      if (value !== undefined) {
        conditions.push(
          compare(products[field], sql`${value}::double precision`),
        );
      }
    }
  }

  const contains = input.contains?.boundingPolygon;

  if (contains !== undefined) {
    conditions.push(
      sql`ST_Contains(
        ${products.boundingPolygon},
        ${geometryToSql(contains)}
      )`,
    );
  }

  const within = input.within?.boundingPolygon;

  if (within !== undefined) {
    conditions.push(
      sql`ST_Within(
        ${products.boundingPolygon},
        ${geometryToSql(within)}
      )`,
    );
  }

  const intersects = input.intersects?.boundingPolygon;

  if (intersects !== undefined) {
    conditions.push(
      sql`ST_Intersects(
        ${products.boundingPolygon},
        ${geometryToSql(intersects)}
      )`,
    );
  }

  return and(...conditions);
}
