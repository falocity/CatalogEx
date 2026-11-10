/* eslint-disable @typescript-eslint/naming-convention */
export const SERVICES = {
  CONFIG: Symbol('Config'),
  LOGGER: Symbol('Logger'),
  TRACER: Symbol('Tracer'),
  METRICS: Symbol('Metrics'),
  ON_SIGNAL: Symbol('OnSignal'),
  CLEANUP_REGISTRY: Symbol('CleanupRegistry'),

  POOL: Symbol('DatabasePool'),
  DATABASE: Symbol('Database'),
  DATABASE_READINESS: Symbol('DatabaseReadiness'),

  GEOMETRY_VALIDATOR: Symbol('GeometryValidator'),
} as const;
/* eslint-enable @typescript-eslint/naming-convention */
export const MAX_TCP_PORT = 65535;
export const PRODUCT_NAME_MAX_LENGTH = 48;
export const POSTGRES_CHECK_VIOLATION = '23514';
export const POSTGRES_NUMERIC_OUT_OF_RANGE = '22003';
