import { buildApp } from "./app.js";

const app = buildApp();

try {
  await app.listen({
    port: 3000,
    host: "127.0.0.1",
  });
} catch (error) {
  app.log.error({ err: error }, "Server startup failed");
  process.exitCode = 1;
  await app.close();
}
