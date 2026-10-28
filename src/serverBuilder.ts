import Fastify from "fastify";
import type { FastifyBaseLogger, FastifyServerOptions } from "fastify";
import { StatusCodes } from "http-status-codes";
import type { Pool } from "pg";
import type { DatabaseReadiness } from "./db/client.js";
import { registerErrorHandler } from "./error-handler.js";
import { healthRoutes } from "./modules/health/health.routes.js";
import type { ProductsController } from "./modules/products/products.controller.js";
import { productsRoutes } from "./modules/products/products.routes.js";

export class ServerBuilder {
  constructor(
    private readonly logger: FastifyBaseLogger,
    private readonly pool: Pool,
    private readonly controller: ProductsController,
    private readonly checkDatabase: DatabaseReadiness,
  ) {}

  build(options: FastifyServerOptions = {}) {
    const app = Fastify({
      loggerInstance: this.logger,
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

    app.register(productsRoutes, {
      controller: this.controller,
    });

    app.register(healthRoutes, {
      checkDatabase: this.checkDatabase,
    });

    const handlePoolError = (error: Error): void => {
      this.logger.error({ err: error }, "Unexpected database pool error");
    };

    this.pool.on("error", handlePoolError);

    app.addHook("onClose", async () => {
      try {
        await this.pool.end();
      } finally {
        this.pool.off("error", handlePoolError);
      }
    });

    return app;
  }
}
