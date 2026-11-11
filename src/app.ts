import type { FastifyInstance, FastifyServerOptions } from 'fastify';
import type { DependencyContainer } from 'tsyringe';
import { SERVICES } from './common/constants.js';
import { registerExternalValues, type RegisterOptions } from './containerConfig.js';

export async function buildApp(
  options: FastifyServerOptions = {},
  registerOptions: RegisterOptions = {}
): Promise<{ app: FastifyInstance; container: DependencyContainer }> {
  const container = await registerExternalValues({
    ...registerOptions,
    serverOptions: options,
  });

  return {
    app: container.resolve<FastifyInstance>(SERVICES.APPLICATION),
    container,
  };
}
