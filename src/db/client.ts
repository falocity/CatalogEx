import { readFileSync } from 'node:fs';
import type { vectorCatalogexV1Type } from '@map-colonies/schemas';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool, type PoolConfig } from 'pg';
import type { ConfigType } from '../common/config.js';

function getPoolSsl(ssl: vectorCatalogexV1Type['database']['ssl']): PoolConfig['ssl'] {
  if (!ssl.enabled) {
    return false;
  }

  return {
    cert: readFileSync(ssl.cert),
    key: readFileSync(ssl.key),
    ...(ssl.ca === undefined ? {} : { ca: readFileSync(ssl.ca) }),
    rejectUnauthorized: true,
  };
}
export function createPool(config: ConfigType): Pool {
  const database = config.get('database');

  return new Pool({
    host: database.host,
    port: database.port,
    database: database.database,
    user: database.username,
    password: database.password,
    ssl: getPoolSsl(database.ssl),
    max: database.maxConnections,
    idleTimeoutMillis: database.idleTimeoutMs,
    connectionTimeoutMillis: database.connectionTimeoutMs,
  });
}

export function createDatabase(pool: Pool): Database {
  return drizzle({ client: pool });
}

export function createDatabaseReadiness(pool: Pool, config: ConfigType): DatabaseReadiness {
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

export type DatabaseReadiness = () => Promise<void>;
