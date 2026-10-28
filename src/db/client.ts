import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import type { ConfigType } from "../common/config.js";

export function createPool(config: ConfigType): Pool {
  return new Pool(config.get("database"));
}

export function createDatabase(pool: Pool) {
  return drizzle({ client: pool });
}

export function createDatabaseReadiness(pool: Pool, config: ConfigType) {
  return async function checkDatabase(): Promise<void> {
    const query = {
      text: "SELECT 1",
      query_timeout: config.get("readiness.queryTimeoutMs"),
    };

    await pool.query(query);
  };
}

export type Database = ReturnType<typeof createDatabase>;
export type DatabaseReadiness = ReturnType<typeof createDatabaseReadiness>;
