import type { CleanupRegistry } from '@map-colonies/cleanup-registry';
import type { Logger } from '@map-colonies/js-logger';
import type { FastifyInstance, FastifyServerOptions } from 'fastify';
import type { DependencyContainer } from 'tsyringe';

import { SERVICES } from './common/constants.js';
import { registerExternalValues, type RegisterOptions } from './containerConfig.js';
import { ServerBuilder } from './serverBuilder.js';

export async function buildApp(
  options: FastifyServerOptions = {},
  registerOptions: RegisterOptions = {}
): Promise<{ app: FastifyInstance; container: DependencyContainer }> {
  const container = await registerExternalValues(registerOptions);
  const registry = container.resolve<CleanupRegistry>(SERVICES.CLEANUP_REGISTRY);

  try {
    const app = container.resolve(ServerBuilder).build(options);
    let closePromise: Promise<void> | undefined;

    registry.register({
      id: 'application',
      func: async () => (closePromise ??= app.close()),
    });
    registry.remove({ id: SERVICES.POOL });

    return { app, container };
  } catch (error) {
    try {
      await registry.trigger();
    } catch (cleanupError) {
      container.resolve<Logger>(SERVICES.LOGGER).error({ err: cleanupError }, 'Failed to clean up after app construction error');
    }

    throw error;
  }
}
