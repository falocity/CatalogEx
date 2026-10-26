import type { FastifyReply, FastifyRequest } from "fastify";
import { StatusCodes } from "http-status-codes";
import type { ProductsService } from "./products.service.js";
import type { CreateProduct } from "./schemas/product.schema.js";
import type { UpdateProduct } from "./schemas/update-product.schema.js";
import type { SearchProductsInput } from "./schemas/search-products.schema.js";
import {
  DEFAULT_PAGE_LIMIT,
  DEFAULT_PAGE_OFFSET,
  type PaginationQuery,
} from "./schemas/pagination.schema.js";

export function createProductsController(service: ProductsService) {
  return {
    async createProductHandler(
      request: FastifyRequest<{ Body: CreateProduct }>,
      reply: FastifyReply,
    ) {
      const product = await service.createProduct(request.body);

      return reply
        .code(StatusCodes.CREATED)
        .header("Location", `/products/${product.id}`)
        .send(product);
    },

    async getProductByIdHandler(
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply,
    ) {
      const product = await service.getProductById(request.params.id);

      return reply.code(StatusCodes.OK).send(product);
    },

    async listProductsHandler(
      request: FastifyRequest<{ Querystring: PaginationQuery }>,
      reply: FastifyReply,
    ) {
      const page = await service.listProducts(
        request.query.limit ?? DEFAULT_PAGE_LIMIT,
        request.query.offset ?? DEFAULT_PAGE_OFFSET,
      );

      return reply.code(StatusCodes.OK).send(page);
    },

    async updateProductHandler(
      request: FastifyRequest<{
        Params: { id: string };
        Body: UpdateProduct;
      }>,
      reply: FastifyReply,
    ) {
      const product = await service.updateProduct(
        request.params.id,
        request.body,
      );

      return reply.code(StatusCodes.OK).send(product);
    },

    async deleteProductHandler(
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply,
    ) {
      await service.deleteProduct(request.params.id);

      return reply.code(StatusCodes.NO_CONTENT).send();
    },

    async searchProductsHandler(
      request: FastifyRequest<{
        Body: SearchProductsInput;
        Querystring: PaginationQuery;
      }>,
      reply: FastifyReply,
    ) {
      const page = await service.searchProducts(
        request.body,
        request.query.limit ?? DEFAULT_PAGE_LIMIT,
        request.query.offset ?? DEFAULT_PAGE_OFFSET,
      );

      return reply.code(StatusCodes.OK).send(page);
    },
  };
}

export type ProductsController = ReturnType<typeof createProductsController>;
