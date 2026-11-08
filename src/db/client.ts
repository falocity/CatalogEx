import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import type { ConfigType } from '../common/config.js';

export function createPool(config: ConfigType): Pool {
  const database = config.get('database');

  return new Pool({
    host: database.host,
    port: database.port,
    database: database.database,
    user: database.user,
    password: database.password,
    max: database.maxConnections,
    idleTimeoutMillis: database.idleTimeoutMs,
    connectionTimeoutMillis: database.connectionTimeoutMs,
  });
}

export function createDatabase(pool: Pool): Database {
  return drizzle({ client: pool });
}

export function createDatabaseReadiness(pool: Pool, config: ConfigType) {
  return async function checkDatabase(): Promise<void> {
    const query = {
      text: 'SELECT 1',
      // eslint-disable-next-line @typescript-eslint/naming-convention -- node-postgres option name.
      query_timeout: config.get('readiness.queryTimeoutMs'),
    };

    await pool.query(query);
  };
}

export type Database = NodePgDatabase & { $client: Pool };
export type DatabaseReadiness = ReturnType<typeof createDatabaseReadiness>;
