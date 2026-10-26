import Fastify from "fastify";
import type { FastifyInstance, FastifyServerOptions } from "fastify";
import { StatusCodes } from "http-status-codes";
import { getConfig } from "./config.js";
import { db, pool } from "./db/client.js";
import { registerErrorHandler } from "./error-handler.js";
import { healthRoutes } from "./modules/health/health.routes.js";
import { areBoundingPolygonsValid } from "./modules/products/geometry.utils.js";
import { createProductsController } from "./modules/products/products.controller.js";
import { createProductsRepository } from "./modules/products/products.repository.js";
import { productsRoutes } from "./modules/products/products.routes.js";
import { createProductsService } from "./modules/products/products.service.js";

export function buildApp(options: FastifyServerOptions = {}): FastifyInstance {
  const config = getConfig();

  const app = Fastify({
    logger: {
      level: config.server.logLevel,
    },
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

  const repository = createProductsRepository(db, app.log);

  const service = createProductsService(repository, app.log, (geometries) =>
    areBoundingPolygonsValid(db, geometries),
  );

  const controller = createProductsController(service);

  app.register(productsRoutes, { controller });
  app.register(healthRoutes, {
    checkDatabase: async () => {
      const query = {
        text: "SELECT 1",
        query_timeout: config.readiness.queryTimeoutMs,
      };

      await pool.query(query);
    },
  });
  
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
