import Type from "typebox";
import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { StatusCodes } from "http-status-codes";

interface HealthOptions {
  checkDatabase: () => Promise<void>;
}

const healthySchema = Type.Object(
  {
    status: Type.Literal("ok"),
  },
  { additionalProperties: false },
);

const notReadySchema = Type.Object(
  {
    status: Type.Literal("not_ready"),
  },
  { additionalProperties: false },
);

export const healthRoutes: FastifyPluginAsyncTypebox<HealthOptions> = async (
  app,
  { checkDatabase },
) => {
  for (const url of ["/health", "/health/live"]) {
    app.get(
      url,
      {
        schema: {
          response: {
            [StatusCodes.OK]: healthySchema,
          },
        },
      },
      async () => ({ status: "ok" as const }),
    );
  }

  app.get(
    "/health/ready",
    {
      schema: {
        response: {
          [StatusCodes.OK]: healthySchema,
          [StatusCodes.SERVICE_UNAVAILABLE]: notReadySchema,
        },
      },
    },
    async (request, reply) => {
      try {
        await checkDatabase();

        return reply.code(StatusCodes.OK).send({
          status: "ok",
        });
      } catch (error) {
        request.log.warn({ err: error }, "Database readiness check failed");

        return reply.code(StatusCodes.SERVICE_UNAVAILABLE).send({
          status: "not_ready",
        });
      }
    },
  );
};
