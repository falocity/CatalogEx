import { buildApp } from "./app.js";
import { getConfig } from "./config.js";

const app = buildApp();
const config = getConfig();

let shutdownStarted = false;

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (shutdownStarted) {
    return;
  }

  shutdownStarted = true;

  app.log.info({ signal }, "Server shutting down");

  const timeout = setTimeout(() => {
    app.log.error("Graceful shutdown timed out");
    process.exit(1);
  }, config.server.shutdownTimeoutMs);

  timeout.unref();

  try {
    await app.close();
  } catch (error) {
    app.log.error({ err: error }, "Server shutdown failed");
    process.exitCode = 1;
  } finally {
    clearTimeout(timeout);
  }
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    void shutdown(signal);
  });
}

try {
  await app.listen({
    port: config.server.port,
    host: config.server.host,
  });
} catch (error) {
  app.log.error({ err: error }, "Server startup failed");
  process.exitCode = 1;
  await app.close();
}
