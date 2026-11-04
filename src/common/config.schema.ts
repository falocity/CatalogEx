import typebox from 'typebox';
import { commonBoilerplateV3, type commonBoilerplateV3Type } from '@map-colonies/schemas';
import type { typeSymbol } from '@map-colonies/schemas/build/schemas/symbol.js';

const MAX_TCP_PORT = 65535;

function stringSetting(environmentVariable: string) {
  return typebox.String({
    minLength: 1,
    pattern: '\\S',
    'x-env-value': environmentVariable,
  });
}

function integerSetting(environmentVariable: string, minimum: number, maximum?: number) {
  return typebox.Integer({
    minimum,
    ...(maximum === undefined ? {} : { maximum }),
    'x-env-value': environmentVariable,
    'x-env-format': 'json',
  });
}

const schema = typebox.Object(
  {
    server: typebox.Object(
      {
        host: stringSetting('HOST'),
        port: integerSetting('PORT', 1, MAX_TCP_PORT),
        shutdownTimeoutMs: integerSetting('SHUTDOWN_TIMEOUT_MS', 1),
      },
      { additionalProperties: false }
    ),

    telemetry: typebox.Unsafe<commonBoilerplateV3Type['telemetry']>(commonBoilerplateV3.properties.telemetry),

    database: typebox.Object(
      {
        host: stringSetting('POSTGRES_HOST'),
        port: integerSetting('POSTGRES_PORT', 1, MAX_TCP_PORT),
        database: stringSetting('POSTGRES_DB'),
        user: stringSetting('POSTGRES_USER'),
        password: stringSetting('POSTGRES_PASSWORD'),
        maxConnections: integerSetting('DB_POOL_MAX', 1),
        idleTimeoutMs: integerSetting('DB_IDLE_TIMEOUT_MS', 0),
        connectionTimeoutMs: integerSetting('DB_CONNECTION_TIMEOUT_MS', 1),
      },
      { additionalProperties: false }
    ),

    readiness: typebox.Object(
      {
        queryTimeoutMs: integerSetting('READINESS_QUERY_TIMEOUT_MS', 1),
      },
      { additionalProperties: false }
    ),
  },
  {
    $id: 'urn:catalogex:config',
    additionalProperties: false,
  }
);

export type AppConfig = typebox.Static<typeof schema>;

export const appConfigSchema = schema as typeof schema & {
  readonly $id: string;
  readonly [typeSymbol]: AppConfig;
};
