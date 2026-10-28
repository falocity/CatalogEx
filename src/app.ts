import type { FastifyServerOptions } from "fastify";
import type { Pool } from "pg";
import { SERVICES } from "./common/constants.js";
import {
  registerExternalValues,
  type RegisterOptions,
} from "./containerConfig.js";
import { ServerBuilder } from "./serverBuilder.js";

export async function buildApp(
  options: FastifyServerOptions = {},
  registerOptions: RegisterOptions = {},
) {
  const container = await registerExternalValues({
    ...registerOptions,
    loggerEnabled: options.logger !== false,
  });

  try {
    const app = container.resolve(ServerBuilder).build(options);

    return { app, container };
  } catch (error) {
    await container.resolve<Pool>(SERVICES.POOL).end();
    throw error;
  }
}
