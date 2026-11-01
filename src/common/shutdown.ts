import { CleanupRegistry } from "@map-colonies/cleanup-registry";
import type { FastifyInstance } from "fastify";

export function registerShutdown(
  app: FastifyInstance,
  onSignal: () => Promise<void>,
  timeoutMs: number,
): () => void {
  const registry = new CleanupRegistry({ overallTimeout: timeoutMs });
  let cleanupPromise: Promise<void> | undefined;

  registry.register({
    id: "application",
    func: () => {
      cleanupPromise ??= (async () => {
        try {
          await app.close();
        } finally {
          await onSignal();
        }
      })();

      return cleanupPromise;
    },
  });

  registry.on("finished", (status) => {
    if (status !== "success") {
      app.log.error({ status }, "Server shutdown did not complete");
      process.exit(1);
    }
  });

  let shuttingDown = false;
  let watchdog: ReturnType<typeof setTimeout> | undefined;

  const removeHandlers = () => {
    process.off("SIGINT", onInterrupt);
    process.off("SIGTERM", onTerminate);
  };

  const handleSignal = (signal: NodeJS.Signals) => {
    if (shuttingDown) return;
    shuttingDown = true;

    app.log.info({ signal }, "Server shutting down");

    watchdog = setTimeout(() => {
      app.log.error("Server shutdown deadline exceeded");
      process.exit(1);
    }, timeoutMs + 1000);

    void registry
      .trigger()
      .catch((error: unknown) => {
        app.log.error({ err: error }, "Server shutdown failed");
        process.exit(1);
      })
      .finally(() => {
        if (watchdog) clearTimeout(watchdog);
        removeHandlers();
      });
  };

  const onInterrupt = () => handleSignal("SIGINT");
  const onTerminate = () => handleSignal("SIGTERM");

  process.once("SIGINT", onInterrupt);
  process.once("SIGTERM", onTerminate);

  return removeHandlers;
}
