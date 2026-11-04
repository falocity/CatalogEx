import { sql, type SQL, type SQLWrapper } from 'drizzle-orm';
import type { BoundingPolygon } from './schemas/fields.schema.js';

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
