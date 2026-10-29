export const SERVICES = {
  CONFIG: Symbol("Config"),
  LOGGER: Symbol("Logger"),
  TRACER: Symbol("Tracer"),
  METRICS: Symbol("Metrics"),
  ON_SIGNAL: Symbol("OnSignal"),

  POOL: Symbol("DatabasePool"),
  DATABASE: Symbol("Database"),
  DATABASE_READINESS: Symbol("DatabaseReadiness"),

  GEOMETRY_VALIDATOR: Symbol("GeometryValidator"),

  PRODUCTS_REPOSITORY: Symbol("ProductsRepository"),
  PRODUCTS_SERVICE: Symbol("ProductsService"),
  PRODUCTS_CONTROLLER: Symbol("ProductsController"),
} as const;
