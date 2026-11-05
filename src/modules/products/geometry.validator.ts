import { and, sql } from "drizzle-orm";
import { inject, injectable } from "tsyringe";

import { SERVICES } from "../../common/constants.js";
import type { Database } from "../../db/client.js";
import { geometryToSql } from "./geometry.utils.js";
import type { BoundingPolygon } from "./schemas/fields.schema.js";

@injectable()
export class GeometryValidator {
  public constructor(
    @inject(SERVICES.DATABASE) private readonly db: Database,
  ) {}

  public async areValid(geometries: BoundingPolygon[]): Promise<boolean> {
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

    const result = await this.db.execute(sql`
      SELECT ${and(...checks)} AS valid
    `);

    return result.rows[0]?.valid === true;
  }
}
