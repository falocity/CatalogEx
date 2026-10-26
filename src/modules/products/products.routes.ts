import Type from "typebox";
import {
  TypeBoxValidatorCompiler,
  type FastifyPluginAsyncTypebox,
} from "@fastify/type-provider-typebox";
import { StatusCodes } from "http-status-codes";
import type { ProductsController } from "./products.controller.js";
import {
  CreateProductSchemaInput,
  ProductSchema,
} from "./schemas/product.schema.js";
import { ProductIdSchema } from "./schemas/fields.schema.js";
import {
  PaginationQuerySchema,
  ProductsPageSchema,
} from "./schemas/pagination.schema.js";
import { UpdateProductSchema } from "./schemas/update-product.schema.js";
import { SearchProductsSchema } from "./schemas/search-products.schema.js";

interface ProductsRoutesOptions {
  controller: ProductsController;
}

const createBodySchema = Type.Object(CreateProductSchemaInput.properties, {
  additionalProperties: false,
});

const idParamsSchema = Type.Object(
  { id: ProductIdSchema },
  { additionalProperties: false },
);

const ErrorResponseSchema = Type.Object(
  {
    code: Type.String(),
    message: Type.String(),
    field: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

const commonErrorResponses = {
  [StatusCodes.BAD_REQUEST]: ErrorResponseSchema,
  [StatusCodes.INTERNAL_SERVER_ERROR]: ErrorResponseSchema,
};

const notFoundResponse = {
  [StatusCodes.NOT_FOUND]: ErrorResponseSchema,
};

const bodyErrorResponses = {
  [StatusCodes.REQUEST_TOO_LONG]: ErrorResponseSchema,
  [StatusCodes.UNSUPPORTED_MEDIA_TYPE]: ErrorResponseSchema,
};

export const productsRoutes: FastifyPluginAsyncTypebox<
  ProductsRoutesOptions
> = async (app, { controller }) => {
  app.setValidatorCompiler(TypeBoxValidatorCompiler);

  app.post(
    "/products",
    {
      schema: {
        body: createBodySchema,
        response: {
          [StatusCodes.CREATED]: ProductSchema,
          ...commonErrorResponses,
          ...bodyErrorResponses,
        },
      },
    },
    controller.createProductHandler,
  );

  app.get(
    "/products/:id",
    {
      schema: {
        params: idParamsSchema,
        response: {
          [StatusCodes.OK]: ProductSchema,
          ...commonErrorResponses,
          ...notFoundResponse,
        },
      },
    },
    controller.getProductByIdHandler,
  );

  app.get(
    "/products",
    {
      schema: {
        querystring: PaginationQuerySchema,
        response: {
          [StatusCodes.OK]: ProductsPageSchema,
          ...commonErrorResponses,
        },
      },
    },
    controller.listProductsHandler,
  );

  app.patch(
    "/products/:id",
    {
      schema: {
        params: idParamsSchema,
        body: UpdateProductSchema,
        response: {
          [StatusCodes.OK]: ProductSchema,
          ...commonErrorResponses,
          ...notFoundResponse,
          ...bodyErrorResponses,
        },
      },
    },
    controller.updateProductHandler,
  );

  app.delete(
    "/products/:id",
    {
      schema: {
        params: idParamsSchema,
        response: {
          ...commonErrorResponses,
          ...notFoundResponse,
        },
      },
    },
    controller.deleteProductHandler,
  );

  app.post(
    "/products/search",
    {
      schema: {
        body: SearchProductsSchema,
        querystring: PaginationQuerySchema,
        response: {
          [StatusCodes.OK]: ProductsPageSchema,
          ...commonErrorResponses,
          ...bodyErrorResponses,
        },
      },
    },
    controller.searchProductsHandler,
  );
};
