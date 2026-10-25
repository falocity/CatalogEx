import Type from "typebox";
import {
  TypeBoxValidatorCompiler,
  type FastifyPluginAsyncTypebox,
} from "@fastify/type-provider-typebox";
import { StatusCodes } from "http-status-codes";
import {
  CreateProductSchemaInput,
  ProductSchema,
} from "./schemas/product.schema.js";
import { ProductIdSchema } from "./schemas/fields.schema.js";
import { createProductHandler } from "./operations/create-product.js";
import { getProductByIdHandler } from "./operations/read-products.js";

const createBodySchema = Type.Object(CreateProductSchemaInput.properties, {
  additionalProperties: false,
});

export const productsRoutes: FastifyPluginAsyncTypebox = async (app) => {
  app.setValidatorCompiler(TypeBoxValidatorCompiler);

  app.post(
    "/products",
    {
      schema: {
        body: createBodySchema,
        response: {
          [StatusCodes.CREATED]: ProductSchema,
        },
      },
    },
    createProductHandler,
  );

  app.get(
    "/products/:id",
    {
      schema: {
        params: Type.Object(
          {
            id: ProductIdSchema,
          },
          { additionalProperties: false },
        ),
        response: {
          [StatusCodes.OK]: ProductSchema,
          [StatusCodes.NOT_FOUND]: Type.Object(
            {
              code: Type.Literal("PRODUCT_NOT_FOUND"),
              message: Type.String(),
              field: Type.Optional(Type.String()),
            },
            { additionalProperties: false },
          ),
        },
      },
    },
    getProductByIdHandler,
  );
};
