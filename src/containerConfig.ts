import { jsLogger } from '@map-colonies/js-logger';
import { getOtelMixin } from '@map-colonies/tracing-utils';
import { trace } from '@opentelemetry/api';
import type { FastifyBaseLogger } from 'fastify';
import type { Pool } from 'pg';
import { Registry } from 'prom-client';
import type { DependencyContainer } from 'tsyringe';

import { getConfig, type ConfigType } from './common/config.js';
import { SERVICES } from './common/constants.js';
import { cachedFactory, registerDependencies, type InjectionObject } from './common/dependencyRegistration.js';
import { getTracing } from './common/tracing.js';
import { createDatabase, createDatabaseReadiness, createPool, type Database, type DatabaseReadiness } from './db/client.js';

export interface RegisterOptions {
  config?: ConfigType;
  override?: InjectionObject<unknown>[];
}

export async function registerExternalValues(options: RegisterOptions = {}): Promise<DependencyContainer> {
  const config = options.config ?? getConfig();

  const logger = await jsLogger({
    ...config.get('telemetry.logger'),
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
        useValue: trace.getTracer(config.get('telemetry.shared.serviceName')),
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
        useFactory: cachedFactory((container) => createPool(container.resolve<ConfigType>(SERVICES.CONFIG))),
      },
    },
    {
      token: SERVICES.DATABASE,
      provider: {
        useFactory: cachedFactory((container) => createDatabase(container.resolve<Pool>(SERVICES.POOL))),
      },
    },
    {
      token: SERVICES.DATABASE_READINESS,
      provider: {
        useFactory: cachedFactory((container) =>
          createDatabaseReadiness(container.resolve<Pool>(SERVICES.POOL), container.resolve<ConfigType>(SERVICES.CONFIG))
        ),
      },
    },
  ];

  return registerDependencies(dependencies, options.override);
}
