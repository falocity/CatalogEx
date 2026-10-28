import { buildApp } from "./app.js";
import type { ConfigType } from "./common/config.js";
import { SERVICES } from "./common/constants.js";
import { registerProcessLifecycle } from "./containerConfig.js";

const { app, container } = await buildApp();
const config = container.resolve<ConfigType>(SERVICES.CONFIG);
const removeHandlers = registerProcessLifecycle(app, config);

try {
  await app.listen({
    port: config.get("server.port"),
    host: config.get("server.host"),
  });
} catch (error) {
  removeHandlers();
  app.log.error({ err: error }, "Server startup failed");
  process.exitCode = 1;
  await app.close();
}
