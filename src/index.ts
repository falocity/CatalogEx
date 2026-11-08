import { createTerminus } from "@godaddy/terminus";
import { CleanupRegistry } from "@map-colonies/cleanup-registry";
import type { Logger } from "@map-colonies/js-logger";

import { buildApp } from "./app.js";
import type { ConfigType } from "./common/config.js";
import { SERVICES } from "./common/constants.js";
import type { DatabaseReadiness } from "./db/client.js";

let logger: Logger | undefined;
let onSignal: (() => Promise<void>) | undefined;

try {
  const { app, container } = await buildApp();
  logger = container.resolve<Logger>(SERVICES.LOGGER);

  const config = container.resolve<ConfigType>(SERVICES.CONFIG);
  onSignal = container.resolve<() => Promise<void>>(SERVICES.ON_SIGNAL);
  const checkDatabase = container.resolve<DatabaseReadiness>(
    SERVICES.DATABASE_READINESS,
  );

  const registry = container.resolve<CleanupRegistry>(
    SERVICES.CLEANUP_REGISTRY,
  );
  registry.on("finished", (status) => {
    if (status !== "success") {
      logger?.error({ status }, "Server shutdown did not complete");
      process.exit(1);
    }
  });

  createTerminus(app.server, {
    healthChecks: {
      "/health/liveness": async (): Promise<void> => {},
      "/health/readiness": async (): Promise<void> => {
        try {
          await checkDatabase();
        } catch (error) {
          logger?.warn({ err: error }, "Database readiness check failed");
          throw error;
        }
      },
    },
    statusErrorResponse: { status: "not_ready" },
    signal: "SIGTERM",
    signals: ["SIGINT"],
    timeout: config.get("server.shutdownTimeoutMs") + 1000,
    useExit0: true,
    onSignal,
  });

  await app.listen({
    port: config.get("server.port"),
    host: config.get("server.host"),
  });
} catch (error) {
  if (logger) {
    logger.error({ err: error }, "Server startup failed");
  } else {
    console.error("Server startup failed", error);
  }

  process.exitCode = 1;
  if (onSignal) {
    try {
      await onSignal();
    } catch (cleanupError) {
      logger?.error({ err: cleanupError }, "Server startup cleanup failed");
    }
  }
}
