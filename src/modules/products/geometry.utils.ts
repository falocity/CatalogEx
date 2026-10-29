import { and, sql, type SQL, type SQLWrapper } from "drizzle-orm";
import type { Database } from "../../db/client.js";
import type { BoundingPolygon } from "./schemas/fields.schema.js";

export function geometryToSql(geometry: BoundingPolygon): SQL {
  return sql`
    ST_SetSRID(
      ST_GeomFromGeoJSON(${JSON.stringify(geometry)}),
      4326
    )
  `;
}

export function geometryAsGeoJSON(column: SQLWrapper): SQL<BoundingPolygon> {
  return sql<BoundingPolygon>`
    ST_AsGeoJSON(
      ST_ForcePolygonCCW(${column}),
      15,
      0
    )::json
  `;
}

export function createGeometryValidator(db: Database) {
  return {
    async areValid(geometries: BoundingPolygon[]): Promise<boolean> {
      if (geometries.length === 0) {
        return true;
      }

      const checks = geometries.map((geometry) => {
        const operand = geometryToSql(geometry);

        return sql`
          (
            NOT ST_IsEmpty(${operand})
            AND ST_IsValid(${operand})
          )
        `;
      });

      const result = await db.execute(sql`
        SELECT ${and(...checks)} AS valid
      `);

      return result.rows[0]?.valid === true;
    },
  };
}

export type GeometryValidator = ReturnType<typeof createGeometryValidator>;
