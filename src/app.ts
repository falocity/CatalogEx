import { CleanupRegistry } from "@map-colonies/cleanup-registry";
import type { Logger } from "@map-colonies/js-logger";
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
  const container = await registerExternalValues(registerOptions);
  const registry = container.resolve<CleanupRegistry>(
    SERVICES.CLEANUP_REGISTRY,
  );

  try {
    const app = container.resolve(ServerBuilder).build(options);
    let closePromise: Promise<void> | undefined;

    registry.register({
      id: "application",
      func: () => (closePromise ??= app.close()),
    });

    return { app, container };
  } catch (error) {
    registry.register({
      id: "database",
      func: () => container.resolve<Pool>(SERVICES.POOL).end(),
    });

    try {
      await registry.trigger();
    } catch (cleanupError) {
      container
        .resolve<Logger>(SERVICES.LOGGER)
        .error(
          { err: cleanupError },
          "Failed to clean up after app construction error",
        );
    }

    throw error;
  }
}
