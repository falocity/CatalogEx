import Fastify from "fastify";
import type { FastifyInstance } from "fastify";

export function buildApp(): FastifyInstance {
  const app = Fastify({
    logger: true,
  });

  app.get(
    "/health",
    {
      schema: {
        response: {
          200: {
            type: "object",
            properties: {
              status: {
                type: "string",
                enum: ["ok"],
              },
            },
            required: ["status"],
            additionalProperties: false,
          },
        },
      },
    },
    async () => {
      return { status: "ok" };
    },
  );

  return app;
}
