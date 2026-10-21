import { sql } from "drizzle-orm";
import { db, pool } from "./client.js";

try {
  const result = await db.execute(sql`
    SELECT
      current_database() AS database,
      PostGIS_Version() AS postgis_version
  `);

  console.table(result.rows);
} finally {
  await pool.end();
}
