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
import {
  getProductByIdHandler,
  listProductsHandler,
} from "./operations/read-products.js";
import {
  PaginationQuerySchema,
  ProductsPageSchema,
} from "./schemas/pagination.schema.js";
import { deleteProductHandler } from "./operations/delete-product.js";
import { updateProductHandler } from "./operations/update-product.js";
import { UpdateProductSchema } from "./schemas/update-product.schema.js";

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
  
  app.get(
    "/products",
    {
      schema: {
        querystring: PaginationQuerySchema,
        response: {
          [StatusCodes.OK]: ProductsPageSchema,
        },
      },
    },
    listProductsHandler,
  );

  app.delete(
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
    deleteProductHandler,
  );

  app.patch(
    "/products/:id",
    {
      schema: {
        params: Type.Object(
          {
            id: ProductIdSchema,
          },
          { additionalProperties: false },
        ),
        body: UpdateProductSchema,
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
    updateProductHandler,
  );
};
