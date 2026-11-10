import 'reflect-metadata';
import { jsLogger } from '@map-colonies/js-logger';
import { getOtelMixin } from '@map-colonies/tracing-utils';
import { trace } from '@opentelemetry/api';
import type { Pool } from 'pg';
import { Registry } from 'prom-client';
import { instancePerContainerCachingFactory, type DependencyContainer } from 'tsyringe';
import { CleanupRegistry } from '@map-colonies/cleanup-registry';
import { getConfig, type ConfigType } from './common/config.js';
import { SERVICES } from './common/constants.js';
import { registerDependencies, type InjectionObject } from './common/dependencyRegistration.js';
import { databaseFactory, databasePoolFactory, databaseReadinessFactory } from './db/dependencies.js';
import { stopTracing } from './common/tracing.js';

export interface RegisterOptions {
  override?: InjectionObject<unknown>[];
}

export async function registerExternalValues(options: RegisterOptions = {}): Promise<DependencyContainer> {
  const config = getConfig();

  const { opentelemetryOptions, ...loggerConfig } = config.get('telemetry.logger');
  const logger = await jsLogger({
    ...loggerConfig,
    ...(opentelemetryOptions === undefined ? {} : { opentelemetryOptions }),
    mixin: getOtelMixin(),
  });

  const cleanupRegistry = new CleanupRegistry({
    overallTimeout: config.get('server.shutdownTimeoutMs'),
    logger,
  });

  cleanupRegistry.register({
    id: SERVICES.TRACER,
    func: stopTracing,
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
      token: SERVICES.TRACER,
      provider: {
        useValue: trace.getTracer(config.get('telemetry.shared.serviceName') ?? 'catalogex'),
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
        useValue: cleanupRegistry.trigger.bind(cleanupRegistry),
      },
    },
    {
      token: SERVICES.POOL,
      provider: {
        useFactory: instancePerContainerCachingFactory(databasePoolFactory),
      },
      postInjectionHook(container): void {
        const pool = container.resolve<Pool>(SERVICES.POOL);
        cleanupRegistry.register({ id: SERVICES.POOL, func: pool.end.bind(pool) });
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
      token: SERVICES.CLEANUP_REGISTRY,
      provider: { useValue: cleanupRegistry },
    },
  ];

  try {
    return await registerDependencies(dependencies, options.override);
  } catch (error) {
    try {
      await cleanupRegistry.trigger();
    } catch (cleanupError) {
      logger.error({ err: cleanupError }, 'Failed to clean up after dependency registration error');
    }

    throw error;
  }
}
