import typebox from 'typebox';
import type { FastifySchema } from 'fastify';
import { StatusCodes } from 'http-status-codes';
import { createProductResponseSchema, createProductSchemaInput, productIdParamsSchema, productSchema } from './product.schema.js';
import { paginationQuerySchema, productsPageSchema } from './pagination.schema.js';
import { updateProductSchema } from './update-product.schema.js';
import { searchProductsSchema } from './search-products.schema.js';

const errorResponseSchema = typebox.Object(
  {
    code: typebox.String(),
    message: typebox.String(),
    field: typebox.Optional(typebox.String()),
  },
  { additionalProperties: false }
);

const commonErrors = {
  [StatusCodes.BAD_REQUEST]: errorResponseSchema,
  [StatusCodes.INTERNAL_SERVER_ERROR]: errorResponseSchema,
};

const notFound = {
  [StatusCodes.NOT_FOUND]: errorResponseSchema,
};

const bodyErrors = {
  [StatusCodes.REQUEST_TOO_LONG]: errorResponseSchema,
  [StatusCodes.UNSUPPORTED_MEDIA_TYPE]: errorResponseSchema,
};

export const productRouteSchemas = {
  create: {
    body: createProductSchemaInput,
    response: {
      [StatusCodes.CREATED]: createProductResponseSchema,
      ...commonErrors,
      ...bodyErrors,
    },
  },

  getById: {
    params: productIdParamsSchema,
    response: {
      [StatusCodes.OK]: productSchema,
      ...commonErrors,
      ...notFound,
    },
  },

  list: {
    querystring: paginationQuerySchema,
    response: {
      [StatusCodes.OK]: productsPageSchema,
      ...commonErrors,
    },
  },

  update: {
    params: productIdParamsSchema,
    body: updateProductSchema,
    response: {
      [StatusCodes.OK]: productSchema,
      ...commonErrors,
      ...notFound,
      ...bodyErrors,
    },
  },

  remove: {
    params: productIdParamsSchema,
    response: {
      ...commonErrors,
      ...notFound,
    },
  },

  search: {
    body: searchProductsSchema,
    querystring: paginationQuerySchema,
    response: {
      [StatusCodes.OK]: productsPageSchema,
      ...commonErrors,
      ...bodyErrors,
    },
  },
} satisfies Record<string, FastifySchema>;
