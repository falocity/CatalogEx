import { jsLogger } from "@map-colonies/js-logger";
import type { FastifyBaseLogger, FastifyInstance } from "fastify";
import type { Pool } from "pg";
import type { DependencyContainer } from "tsyringe";

import { getConfig, initConfig, type ConfigType } from "./common/config.js";
import { SERVICES } from "./common/constants.js";
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
  loggerEnabled?: boolean;
  override?: InjectionObject<unknown>[];
}

export async function registerExternalValues(
  options: RegisterOptions = {},
): Promise<DependencyContainer> {
  if (!options.config) {
    await initConfig();
  }

  const config = options.config ?? getConfig();

  const logger = await jsLogger({
    ...config.get("telemetry.logger"),
    enabled: options.loggerEnabled ?? true,
  });

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

export function registerProcessLifecycle(
  app: FastifyInstance,
  config: ConfigType,
) {
  let shutdownStarted = false;
  const handlers = new Map<NodeJS.Signals, () => void>();

  const removeHandlers = () => {
    for (const [signal, handler] of handlers) {
      process.off(signal, handler);
    }
  };

  async function shutdown(signal: NodeJS.Signals): Promise<void> {
    if (shutdownStarted) {
      return;
    }

    shutdownStarted = true;
    app.log.info({ signal }, "Server shutting down");

    const timeout = setTimeout(() => {
      app.log.error("Graceful shutdown timed out");
      process.exit(1);
    }, config.get("server.shutdownTimeoutMs"));

    timeout.unref();

    try {
      await app.close();
      clearTimeout(timeout);
      removeHandlers();
    } catch (error) {
      app.log.error({ err: error }, "Server shutdown failed");
      process.exitCode = 1;
    }
  }

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    const handler = () => {
      void shutdown(signal);
    };

    handlers.set(signal, handler);
    process.on(signal, handler);
  }

  return removeHandlers;
}
