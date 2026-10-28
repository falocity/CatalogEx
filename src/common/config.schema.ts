import Type from "typebox";
import schemas from "@map-colonies/schemas";
import type { commonTelemetryLoggerV2Type } from "@map-colonies/schemas";
import type { typeSymbol } from "@map-colonies/schemas/build/schemas/symbol.js";

function stringSetting(environmentVariable: string) {
  return Type.String({
    minLength: 1,
    pattern: "\\S",
    "x-env-value": environmentVariable,
  });
}

function integerSetting(
  environmentVariable: string,
  minimum: number,
  maximum?: number,
) {
  return Type.Integer({
    minimum,
    ...(maximum === undefined ? {} : { maximum }),
    "x-env-value": environmentVariable,
    "x-env-format": "json",
  });
}

const schema = Type.Object(
  {
    server: Type.Object(
      {
        host: stringSetting("HOST"),
        port: integerSetting("PORT", 1, 65535),
        shutdownTimeoutMs: integerSetting("SHUTDOWN_TIMEOUT_MS", 1),
      },
      { additionalProperties: false },
    ),

    telemetry: Type.Object(
      {
        logger: Type.Unsafe<commonTelemetryLoggerV2Type>({
          $ref: schemas.commonTelemetryLoggerV2.$id,
        }),
      },
      { additionalProperties: false },
    ),

    database: Type.Object(
      {
        host: stringSetting("POSTGRES_HOST"),
        port: integerSetting("POSTGRES_PORT", 1, 65535),
        database: stringSetting("POSTGRES_DB"),
        user: stringSetting("POSTGRES_USER"),
        password: stringSetting("POSTGRES_PASSWORD"),
        max: integerSetting("DB_POOL_MAX", 1),
        idleTimeoutMillis: integerSetting("DB_IDLE_TIMEOUT_MS", 0),
        connectionTimeoutMillis: integerSetting("DB_CONNECTION_TIMEOUT_MS", 1),
      },
      { additionalProperties: false },
    ),

    readiness: Type.Object(
      {
        queryTimeoutMs: integerSetting("READINESS_QUERY_TIMEOUT_MS", 1),
      },
      { additionalProperties: false },
    ),
  },
  {
    $id: "urn:catalogex:config",
    additionalProperties: false,
  },
);

export type AppConfig = Type.Static<typeof schema>;
export const AppConfigSchema = schema as typeof schema & {
  readonly $id: string;
  readonly [typeSymbol]: AppConfig;
};
