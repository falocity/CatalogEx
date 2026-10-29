import { CleanupRegistry } from "@map-colonies/cleanup-registry";
import type { FastifyInstance } from "fastify";

export function registerShutdown(
  app: FastifyInstance,
  onSignal: () => Promise<void>,
  timeoutMs: number,
): () => void {
  const registry = new CleanupRegistry({ overallTimeout: timeoutMs });

  // app.close() runs the onClose hook that ends the database pool.
  registry.register({
    id: "application",
    func: async () => {
      try {
        await app.close();
      } finally {
        await onSignal();
      }
    },
  });

  registry.on("finished", (status) => {
    if (status !== "success") {
      app.log.error({ status }, "Server shutdown did not complete");
      process.exitCode = 1;
    }
  });

  let shuttingDown = false;

  const removeHandlers = () => {
    process.off("SIGINT", onInterrupt);
    process.off("SIGTERM", onTerminate);
  };

  const handleSignal = (signal: NodeJS.Signals) => {
    if (shuttingDown) return;

    shuttingDown = true;
    app.log.info({ signal }, "Server shutting down");

    void registry
      .trigger()
      .catch((error: unknown) => {
        app.log.error({ err: error }, "Server shutdown failed");
        process.exitCode = 1;
      })
      .finally(removeHandlers);
  };

  const onInterrupt = () => handleSignal("SIGINT");
  const onTerminate = () => handleSignal("SIGTERM");

  process.once("SIGINT", onInterrupt);
  process.once("SIGTERM", onTerminate);

  return removeHandlers;
}