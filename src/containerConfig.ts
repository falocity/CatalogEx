import { jsLogger } from "@map-colonies/js-logger";
import { getOtelMixin } from "@map-colonies/tracing-utils";
import { trace } from "@opentelemetry/api";
import { Registry } from "prom-client";
import type { FastifyBaseLogger } from "fastify";
import type { Pool } from "pg";
import type { DependencyContainer } from "tsyringe";

import { getConfig, type ConfigType } from "./common/config.js";
import { SERVICES } from "./common/constants.js";
import { getTracing } from "./common/tracing.js";
import {
  cachedFactory,
  registerDependencies,
  type InjectionObject,
} from "./common/dependencyRegistration.js";
import {
  createDatabase,
  createDatabaseReadiness,
  createPool,
  type Database,
  type DatabaseReadiness,
} from "./db/client.js";
import {
  createGeometryValidator,
  type GeometryValidator,
} from "./modules/products/geometry.utils.js";
import {
  createProductsController,
  type ProductsController,
} from "./modules/products/products.controller.js";
import {
  createProductsRepository,
  type ProductsRepository,
} from "./modules/products/products.repository.js";
import {
  createProductsService,
  type ProductsService,
} from "./modules/products/products.service.js";
import { ServerBuilder } from "./serverBuilder.js";

export interface RegisterOptions {
  config?: ConfigType;
  override?: InjectionObject<unknown>[];
}

export async function registerExternalValues(
  options: RegisterOptions = {},
): Promise<DependencyContainer> {
  const config = options.config ?? getConfig();

  const logger = await jsLogger({
    ...config.get("telemetry.logger"),
    mixin: getOtelMixin(),
  });

  const metrics = new Registry();
  config.initializeMetrics(metrics);

  const dependencies: InjectionObject<unknown>[] = [
    {
      token: SERVICES.CONFIG,
      provider: { useValue: config },
    },
    {
      token: SERVICES.LOGGER,
      provider: { useValue: logger },
    },
    {
      token: SERVICES.TRACER,
      provider: {
        useValue: trace.getTracer(config.get("telemetry.shared.serviceName")),
      },
    },
    {
      token: SERVICES.METRICS,
      provider: { useValue: metrics },
    },
    {
      token: SERVICES.ON_SIGNAL,
      provider: {
        useValue: async (): Promise<void> => {
          await getTracing().stop();
        },
      },
    },
    {
      token: SERVICES.POOL,
      provider: {
        useFactory: cachedFactory((container) =>
          createPool(container.resolve<ConfigType>(SERVICES.CONFIG)),
        ),
      },
    },
    {
      token: SERVICES.DATABASE,
      provider: {
        useFactory: cachedFactory((container) =>
          createDatabase(container.resolve<Pool>(SERVICES.POOL)),
        ),
      },
    },
    {
      token: SERVICES.DATABASE_READINESS,
      provider: {
        useFactory: cachedFactory((container) =>
          createDatabaseReadiness(
            container.resolve<Pool>(SERVICES.POOL),
            container.resolve<ConfigType>(SERVICES.CONFIG),
          ),
        ),
      },
    },
    {
      token: SERVICES.GEOMETRY_VALIDATOR,
      provider: {
        useFactory: cachedFactory((container) =>
          createGeometryValidator(
            container.resolve<Database>(SERVICES.DATABASE),
          ),
        ),
      },
    },
    {
      token: SERVICES.PRODUCTS_REPOSITORY,
      provider: {
        useFactory: cachedFactory((container) =>
          createProductsRepository(
            container.resolve<Database>(SERVICES.DATABASE),
            container.resolve<FastifyBaseLogger>(SERVICES.LOGGER),
          ),
        ),
      },
    },
    {
      token: SERVICES.PRODUCTS_SERVICE,
      provider: {
        useFactory: cachedFactory((container) =>
          createProductsService(
            container.resolve<ProductsRepository>(SERVICES.PRODUCTS_REPOSITORY),
            container.resolve<FastifyBaseLogger>(SERVICES.LOGGER),
            container.resolve<GeometryValidator>(SERVICES.GEOMETRY_VALIDATOR),
          ),
        ),
      },
    },
    {
      token: SERVICES.PRODUCTS_CONTROLLER,
      provider: {
        useFactory: cachedFactory((container) =>
          createProductsController(
            container.resolve<ProductsService>(SERVICES.PRODUCTS_SERVICE),
          ),
        ),
      },
    },
    {
      token: ServerBuilder,
      provider: {
        useFactory: cachedFactory(
          (container) =>
            new ServerBuilder(
              container.resolve<FastifyBaseLogger>(SERVICES.LOGGER),
              container.resolve<Pool>(SERVICES.POOL),
              container.resolve<ProductsController>(
                SERVICES.PRODUCTS_CONTROLLER,
              ),
              container.resolve<DatabaseReadiness>(SERVICES.DATABASE_READINESS),
            ),
        ),
      },
    },
  ];

  return registerDependencies(dependencies, options.override);
}
