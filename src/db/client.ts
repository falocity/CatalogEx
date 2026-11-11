import { readFileSync } from 'node:fs';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool, type PoolConfig } from 'pg';
import type { ConfigType } from '../common/config.js';
import type { AppConfig } from '../common/config.schema.js';

function getPoolAuthentication(database: AppConfig['database']): Pick<PoolConfig, 'password' | 'ssl'> {
  if (!database.enableSslAuth) {
    return { password: database.password };
  }

  const { cert, key, ca } = database.sslPaths;
  return {
    ssl: {
      cert: readFileSync(cert),
      key: readFileSync(key),
      ca: readFileSync(ca),
      rejectUnauthorized: true,
    },
  };
}

export function createPool(config: ConfigType): Pool {
  const database = config.get('database');

  return new Pool({
    host: database.host,
    port: database.port,
    database: database.database,
    user: database.user,
    ...getPoolAuthentication(database),
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
