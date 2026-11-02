import { CleanupRegistry } from "@map-colonies/cleanup-registry";
import type { Logger } from "@map-colonies/js-logger";

import { buildApp } from "./app.js";
import type { ConfigType } from "./common/config.js";
import { SERVICES } from "./common/constants.js";

let logger: Logger | undefined;
let onSignal: (() => Promise<void>) | undefined;
let shutdownTimeoutMs: number | undefined;
let shutdownPromise: Promise<void> | undefined;

const removeSignalHandlers = (): void => {
  process.off("SIGINT", onInterrupt);
  process.off("SIGTERM", onTerminate);
};

function shutdown(signal?: NodeJS.Signals): Promise<void> {
  if (shutdownPromise) return shutdownPromise;
  if (!onSignal || shutdownTimeoutMs === undefined) return Promise.resolve();

  if (signal) logger?.info({ signal }, "Server shutting down");

  const deadline = setTimeout(() => {
    logger?.error("Server shutdown deadline exceeded");
    process.exit(1);
  }, shutdownTimeoutMs + 1000);

  shutdownPromise = onSignal()
    .catch((error: unknown) => {
      logger?.error({ err: error }, "Server shutdown failed");
      process.exit(1);
    })
    .finally(() => {
      clearTimeout(deadline);
      removeSignalHandlers();
    });

  return shutdownPromise;
}

const onInterrupt = (): void => {
  void shutdown("SIGINT");
};

const onTerminate = (): void => {
  void shutdown("SIGTERM");
};

try {
  const { app, container } = await buildApp();
  logger = container.resolve<Logger>(SERVICES.LOGGER);

  const config = container.resolve<ConfigType>(SERVICES.CONFIG);
  shutdownTimeoutMs = config.get("server.shutdownTimeoutMs");
  onSignal = container.resolve<() => Promise<void>>(SERVICES.ON_SIGNAL);

  const registry = container.resolve<CleanupRegistry>(
    SERVICES.CLEANUP_REGISTRY,
  );
  registry.on("finished", (status) => {
    if (status !== "success") {
      logger?.error({ status }, "Server shutdown did not complete");
      process.exit(1);
    }
  });

  process.once("SIGINT", onInterrupt);
  process.once("SIGTERM", onTerminate);

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
  removeSignalHandlers();

  if (onSignal) await shutdown();
  else process.exit(1);
}
