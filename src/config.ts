import "dotenv/config";

const LOG_LEVELS = [
  "fatal",
  "error",
  "warn",
  "info",
  "debug",
  "trace",
  "silent",
] as const;

type LogLevel = (typeof LOG_LEVELS)[number];

interface PoolSettings {
  max: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
}

export interface DatabaseConfig extends PoolSettings {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export interface AppConfig {
  server: {
    host: string;
    port: number;
    logLevel: LogLevel;
    shutdownTimeoutMs: number;
  };
  database: DatabaseConfig;
  readiness: {
    queryTimeoutMs: number;
  };
}

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name];

  if (value === undefined || value.trim() === "") {
    throw new Error(`${name} is required`);
  }

  return value;
}

function integer(
  env: NodeJS.ProcessEnv,
  name: string,
  fallback: number,
  minimum: number,
  maximum = 2_147_483_647,
): number {
  const raw = env[name];
  const value = raw === undefined ? fallback : Number(raw);

  if (
    (raw !== undefined && !/^\d+$/.test(raw)) ||
    !Number.isSafeInteger(value) ||
    value < minimum ||
    value > maximum
  ) {
    throw new Error(
      `${name} must be an integer between ${minimum} and ${maximum}`,
    );
  }

  return value;
}

function isLogLevel(value: string): value is LogLevel {
  return LOG_LEVELS.some((level) => level === value);
}

export function loadConfig(env: NodeJS.ProcessEnv): AppConfig {
  const logLevel = env.LOG_LEVEL ?? "info";

  if (!isLogLevel(logLevel)) {
    throw new Error(`LOG_LEVEL must be one of: ${LOG_LEVELS.join(", ")}`);
  }

  const host = env.HOST ?? "127.0.0.1";

  if (host.trim() === "") {
    throw new Error("HOST must not be empty");
  }

  const database: DatabaseConfig = {
    host: required(env, "POSTGRES_HOST"),
    port: integer(env, "POSTGRES_PORT", 5432, 1, 65535),
    user: required(env, "POSTGRES_USER"),
    password: required(env, "POSTGRES_PASSWORD"),
    database: required(env, "POSTGRES_DB"),
    max: integer(env, "DB_POOL_MAX", 10, 1),
    idleTimeoutMillis: integer(env, "DB_IDLE_TIMEOUT_MS", 30_000, 0),
    connectionTimeoutMillis: integer(
      env,
      "DB_CONNECTION_TIMEOUT_MS",
      5_000,
      1,
    ),
  };

  return {
    server: {
      host,
      port: integer(env, "PORT", 3000, 1, 65535),
      logLevel,
      shutdownTimeoutMs: integer(
        env,
        "SHUTDOWN_TIMEOUT_MS",
        10_000,
        1,
      ),
    },
    database,
    readiness: {
      queryTimeoutMs: integer(
        env,
        "READINESS_QUERY_TIMEOUT_MS",
        1_000,
        1,
      ),
    },
  };
}

let currentConfig: AppConfig | undefined;

export function getConfig(): AppConfig {
  currentConfig ??= loadConfig(process.env);
  return currentConfig;
}