import type { FastifyInstance } from "fastify";
import { buildApp } from "./app.js";
import type { ConfigType } from "./common/config.js";
import { SERVICES } from "./common/constants.js";
import { registerShutdown } from "./common/shutdown.js";
import { getTracing } from "./common/tracing.js";

let app: FastifyInstance | undefined;
let onSignal: (() => Promise<void>) | undefined;
let removeHandlers: (() => void) | undefined;

try {
  const built = await buildApp();
  app = built.app;

  const config = built.container.resolve<ConfigType>(SERVICES.CONFIG);
  onSignal = built.container.resolve<() => Promise<void>>(SERVICES.ON_SIGNAL);

  removeHandlers = registerShutdown(
    app,
    onSignal,
    config.get("server.shutdownTimeoutMs"),
  );

  await app.listen({
    port: config.get("server.port"),
    host: config.get("server.host"),
  });
} catch (error) {
  removeHandlers?.();

  if (app) {
    app.log.error({ err: error }, "Server startup failed");
  } else {
    console.error("Server startup failed", error);
  }

  process.exitCode = 1;

  try {
    await app?.close();
  } finally {
    await (onSignal?.() ?? getTracing().stop());
  }
}
