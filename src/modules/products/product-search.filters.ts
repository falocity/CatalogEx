import { and, eq, gt, gte, lt, lte, sql, type SQL } from "drizzle-orm";
import { products } from "../../db/schema.js";
import type { BoundingPolygon } from "./schemas/fields.schema.js";
import type { SearchProductsInput } from "./schemas/search-products.schema.js";

function geometryOperand(geometry: BoundingPolygon): SQL {
  return sql`
    ST_SetSRID(
      ST_GeomFromGeoJSON(${JSON.stringify(geometry)}),
      4326
    )
  `;
}

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
    { operands: input.greaterThan, compare: gt },
    { operands: input.greaterEqual, compare: gte },
    { operands: input.lessThan, compare: lt },
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
        ${geometryOperand(contains)}
      )`,
    );
  }

  const within = input.within?.boundingPolygon;

  if (within !== undefined) {
    conditions.push(
      sql`ST_Within(
        ${products.boundingPolygon},
        ${geometryOperand(within)}
      )`,
    );
  }

  const intersects = input.intersects?.boundingPolygon;

  if (intersects !== undefined) {
    conditions.push(
      sql`ST_Intersects(
        ${products.boundingPolygon},
        ${geometryOperand(intersects)}
      )`,
    );
  }

  return and(...conditions);
}
