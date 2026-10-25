import Type from "typebox";
import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { StatusCodes } from "http-status-codes";

export const healthRoutes: FastifyPluginAsyncTypebox = async (app) => {
  app.get(
    "/health",
    {
      schema: {
        response: {
          [StatusCodes.OK]: Type.Object(
            {
              status: Type.Literal("ok"),
            },
            { additionalProperties: false },
          ),
        },
      },
    },
    async () => {
      return { status: "ok" as const };
    },
  );
};
