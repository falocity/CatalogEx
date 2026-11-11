import typebox from 'typebox';
import { commonBoilerplateV3, type commonBoilerplateV3Type } from '@map-colonies/schemas';
import type { typeSymbol } from '@map-colonies/schemas/build/schemas/symbol.js';
import { MAX_TCP_PORT } from './constants.js';

function stringSetting(environmentVariable: string): typebox.TString {
  return typebox.String({
    minLength: 1,
    pattern: '\\S',
    'x-env-value': environmentVariable,
  });
}

function integerSetting(environmentVariable: string, minimum: number, maximum?: number): typebox.TInteger {
  return typebox.Integer({
    minimum,
    ...(maximum === undefined ? {} : { maximum }),
    'x-env-value': environmentVariable,
    'x-env-format': 'json',
  });
}

const databaseCommon = {
  host: stringSetting('POSTGRES_HOST'),
  port: integerSetting('POSTGRES_PORT', 1, MAX_TCP_PORT),
  database: stringSetting('POSTGRES_DB'),
  user: stringSetting('POSTGRES_USER'),
  maxConnections: integerSetting('DB_POOL_MAX', 1),
  idleTimeoutMs: integerSetting('DB_IDLE_TIMEOUT_MS', 0),
  connectionTimeoutMs: integerSetting('DB_CONNECTION_TIMEOUT_MS', 1),
};

const enableSslAuthEnv = {
  'x-env-value': 'DB_ENABLE_SSL_AUTH',
  'x-env-format': 'json',
};

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

    database: typebox.Union([
      typebox.Object(
        {
          ...databaseCommon,
          enableSslAuth: typebox.Literal(false, enableSslAuthEnv),
          password: stringSetting('POSTGRES_PASSWORD'),
        },
        { additionalProperties: false }
      ),
      typebox.Object(
        {
          ...databaseCommon,
          enableSslAuth: typebox.Literal(true, enableSslAuthEnv),
          sslPaths: typebox.Object(
            {
              cert: stringSetting('DB_CERT_PATH'),
              key: stringSetting('DB_KEY_PATH'),
              ca: stringSetting('DB_CA_PATH'),
            },
            { additionalProperties: false }
          ),
        },
        { additionalProperties: false }
      ),
    ]),

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
