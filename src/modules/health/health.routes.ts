import type { FastifyPluginAsync } from "fastify";
import { StatusCodes } from "http-status-codes";
import type { DatabaseReadiness } from "../../db/client.js";

interface HealthOptions {
  checkDatabase: DatabaseReadiness;
}

export const healthRoutes: FastifyPluginAsync<HealthOptions> = async (
  app,
  { checkDatabase },
) => {
  app.get("/health/live", async () => ({ status: "ok" }));

  app.get("/health/ready", async (request, reply) => {
    try {
      await checkDatabase();
      return { status: "ok" };
    } catch (error) {
      request.log.warn({ err: error }, "Database readiness check failed");

      return reply
        .code(StatusCodes.SERVICE_UNAVAILABLE)
        .send({ status: "not_ready" });
    }
  });
};
