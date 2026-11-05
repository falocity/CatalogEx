import Type from "typebox";
import type { FastifySchema } from "fastify";
import { StatusCodes } from "http-status-codes";
import {
  CreateProductResponseSchema,
  CreateProductSchemaInput,
  ProductIdParamsSchema,
  ProductSchema,
} from "./product.schema.js";
import {
  PaginationQuerySchema,
  ProductsPageSchema,
} from "./pagination.schema.js";
import { UpdateProductSchema } from "./update-product.schema.js";
import { SearchProductsSchema } from "./search-products.schema.js";

const ErrorResponseSchema = Type.Object(
  {
    code: Type.String(),
    message: Type.String(),
    field: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

const commonErrors = {
  [StatusCodes.BAD_REQUEST]: ErrorResponseSchema,
  [StatusCodes.INTERNAL_SERVER_ERROR]: ErrorResponseSchema,
};

const notFound = {
  [StatusCodes.NOT_FOUND]: ErrorResponseSchema,
};

const bodyErrors = {
  [StatusCodes.REQUEST_TOO_LONG]: ErrorResponseSchema,
  [StatusCodes.UNSUPPORTED_MEDIA_TYPE]: ErrorResponseSchema,
};

export const productRouteSchemas = {
  create: {
    body: CreateProductSchemaInput,
    response: {
      [StatusCodes.CREATED]: CreateProductResponseSchema,
      ...commonErrors,
      ...bodyErrors,
    },
  },

  getById: {
    params: ProductIdParamsSchema,
    response: {
      [StatusCodes.OK]: ProductSchema,
      ...commonErrors,
      ...notFound,
    },
  },

  list: {
    querystring: PaginationQuerySchema,
    response: {
      [StatusCodes.OK]: ProductsPageSchema,
      ...commonErrors,
    },
  },

  update: {
    params: ProductIdParamsSchema,
    body: UpdateProductSchema,
    response: {
      [StatusCodes.OK]: ProductSchema,
      ...commonErrors,
      ...notFound,
      ...bodyErrors,
    },
  },

  remove: {
    params: ProductIdParamsSchema,
    response: {
      ...commonErrors,
      ...notFound,
    },
  },

  search: {
    body: SearchProductsSchema,
    querystring: PaginationQuerySchema,
    response: {
      [StatusCodes.OK]: ProductsPageSchema,
      ...commonErrors,
      ...bodyErrors,
    },
  },
} satisfies Record<string, FastifySchema>;
