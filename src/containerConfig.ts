import 'reflect-metadata';
import { jsLogger, type Logger } from '@map-colonies/js-logger';
import { getOtelMixin } from '@map-colonies/tracing-utils';
import { trace } from '@opentelemetry/api';
import type { FastifyInstance, FastifyServerOptions } from 'fastify';
import type { Pool } from 'pg';
import { Registry } from 'prom-client';
import { instancePerContainerCachingFactory, type DependencyContainer } from 'tsyringe';
import { CleanupRegistry } from '@map-colonies/cleanup-registry';
import { getConfig, type ConfigType } from './common/config.js';
import { SERVICES } from './common/constants.js';
import { registerDependencies, type InjectionObject } from './common/dependencyRegistration.js';
import { databaseFactory, databasePoolFactory, databaseReadinessFactory } from './db/dependencies.js';
import { stopTracing } from './common/tracing.js';
import { ServerBuilder } from './serverBuilder.js';

export interface RegisterOptions {
  override?: InjectionObject<unknown>[];
  serverOptions?: FastifyServerOptions;
}

export async function registerExternalValues(options: RegisterOptions = {}): Promise<DependencyContainer> {
  let cleanupRegistry: CleanupRegistry | undefined;
  let logger: Logger | undefined;

  const dependencies: InjectionObject<unknown>[] = [
    {
      token: SERVICES.CONFIG,
      provider: { useValue: getConfig() },
    },
    {
      token: SERVICES.LOGGER,
      provider: {
        useFactory: instancePerContainerCachingFactory(async (container) => {
          const config = container.resolve<ConfigType>(SERVICES.CONFIG);
          const { opentelemetryOptions, ...loggerConfig } = config.get('telemetry.logger');

          return jsLogger({
            ...loggerConfig,
            ...(opentelemetryOptions === undefined ? {} : { opentelemetryOptions }),
            mixin: getOtelMixin(),
          });
        }),
      },
      postInjectionHook: async (container): Promise<void> => {
        logger = await container.resolve<Promise<Logger> | Logger>(SERVICES.LOGGER);

        container.register(SERVICES.LOGGER, { useValue: logger });
      },
    },
    {
      token: SERVICES.CLEANUP_REGISTRY,
      provider: {
        useFactory: instancePerContainerCachingFactory((container) => {
          const config = container.resolve<ConfigType>(SERVICES.CONFIG);

          return new CleanupRegistry({
            overallTimeout: config.get('server.shutdownTimeoutMs'),
            logger: container.resolve<Logger>(SERVICES.LOGGER),
          });
        }),
      },
      postInjectionHook(container): void {
        cleanupRegistry = container.resolve<CleanupRegistry>(SERVICES.CLEANUP_REGISTRY);

        cleanupRegistry.register({
          id: SERVICES.TRACER,
          func: stopTracing,
        });
      },
    },
    {
      token: SERVICES.TRACER,
      provider: {
        useFactory: instancePerContainerCachingFactory((container) => {
          const config = container.resolve<ConfigType>(SERVICES.CONFIG);

          return trace.getTracer(config.get('telemetry.shared.serviceName') ?? 'catalogex');
        }),
      },
    },
    {
      token: SERVICES.METRICS,
      provider: {
        useFactory: instancePerContainerCachingFactory((container) => {
          const metricsRegistry = new Registry();
          const config = container.resolve<ConfigType>(SERVICES.CONFIG);

          config.initializeMetrics(metricsRegistry);

          return metricsRegistry;
        }),
      },
    },
    {
      token: SERVICES.ON_SIGNAL,
      provider: {
        useFactory: instancePerContainerCachingFactory((container) => {
          const registry = container.resolve<CleanupRegistry>(SERVICES.CLEANUP_REGISTRY);

          return registry.trigger.bind(registry);
        }),
      },
    },
    {
      token: SERVICES.POOL,
      provider: {
        useFactory: instancePerContainerCachingFactory(databasePoolFactory),
      },
      postInjectionHook(container): void {
        const pool = container.resolve<Pool>(SERVICES.POOL);
        const registry = container.resolve<CleanupRegistry>(SERVICES.CLEANUP_REGISTRY);

        registry.register({
          id: SERVICES.POOL,
          func: pool.end.bind(pool),
        });
      },
    },
    {
      token: SERVICES.DATABASE,
      provider: {
        useFactory: instancePerContainerCachingFactory(databaseFactory),
      },
    },
    {
      token: SERVICES.DATABASE_READINESS,
      provider: {
        useFactory: instancePerContainerCachingFactory(databaseReadinessFactory),
      },
    },
    {
      token: SERVICES.APPLICATION,
      provider: {
        useFactory: instancePerContainerCachingFactory((container) => container.resolve(ServerBuilder).build(options.serverOptions)),
      },
      postInjectionHook(container): void {
        const app = container.resolve<FastifyInstance>(SERVICES.APPLICATION);
        const registry = container.resolve<CleanupRegistry>(SERVICES.CLEANUP_REGISTRY);

        let closePromise: Promise<void> | undefined;

        registry.register({
          id: SERVICES.APPLICATION,
          func: async () => (closePromise ??= app.close()),
        });

        registry.remove({ id: SERVICES.POOL });
      },
    },
  ];

  try {
    return await registerDependencies(dependencies, options.override);
  } catch (error) {
    try {
      if (cleanupRegistry) {
        await cleanupRegistry.trigger();
      } else {
        await stopTracing();
      }
    } catch (cleanupError) {
      logger?.error({ err: cleanupError }, 'Failed to clean up after dependency registration error');
    }

    throw error;
  }
}
