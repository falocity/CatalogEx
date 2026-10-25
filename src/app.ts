import Fastify from "fastify";
import type { FastifyInstance, FastifyServerOptions } from "fastify";
import { StatusCodes } from "http-status-codes";
import { pool } from "./db/client.js";
import { registerErrorHandler } from "./error-handler.js";
import { productsRoutes } from "./modules/products/products.routes.js";
import { healthRoutes } from "./modules/health/health.routes.js";

export function buildApp(options: FastifyServerOptions = {}): FastifyInstance {
  const app = Fastify({
    logger: true,
    ...options,
  });

  registerErrorHandler(app);

  app.addHook("onRequest", async (request, reply) => {
    if (request.method !== "POST" && request.method !== "PATCH") {
      return;
    }

    const mediaType = request.headers["content-type"]
      ?.split(";")[0]
      ?.trim()
      .toLowerCase();

    if (mediaType !== "application/json") {
      return reply.code(StatusCodes.UNSUPPORTED_MEDIA_TYPE).send({
        code: "UNSUPPORTED_MEDIA_TYPE",
        message: "Content-Type must be application/json.",
      });
    }
  });

  app.register(productsRoutes);
  app.register(healthRoutes);

  const handlePoolError = (error: Error): void => {
    app.log.error({ err: error }, "Unexpected database pool error");
  };

  pool.on("error", handlePoolError);

  app.addHook("onClose", async () => {
    try {
      await pool.end();
    } finally {
      pool.off("error", handlePoolError);
    }
  });

  return app;
}
