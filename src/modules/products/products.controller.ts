import type { FastifyReply, FastifyRequest } from "fastify";
import { StatusCodes } from "http-status-codes";
import type { ProductsService } from "./products.service.js";
import type {
  CreateProduct,
  ProductIdParams,
} from "./schemas/product.schema.js";
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
        .send({ id: product.id });
    },

    async getProductByIdHandler({
      params: { id },
    }: FastifyRequest<{ Params: ProductIdParams }>) {
      return service.getProductById(id);
    },

    async listProductsHandler({
      query: { limit = DEFAULT_PAGE_LIMIT, offset = DEFAULT_PAGE_OFFSET },
    }: FastifyRequest<{ Querystring: PaginationQuery }>) {
      return service.listProducts(limit, offset);
    },

    async updateProductHandler({
      params: { id },
      body,
    }: FastifyRequest<{
      Params: ProductIdParams;
      Body: UpdateProduct;
    }>) {
      return service.updateProduct(id, body);
    },

    async deleteProductHandler(
      { params: { id } }: FastifyRequest<{ Params: ProductIdParams }>,
      reply: FastifyReply,
    ) {
      await service.deleteProduct(id);
      return reply.code(StatusCodes.NO_CONTENT).send();
    },

    async searchProductsHandler({
      body,
      query: { limit = DEFAULT_PAGE_LIMIT, offset = DEFAULT_PAGE_OFFSET },
    }: FastifyRequest<{
      Body: SearchProductsInput;
      Querystring: PaginationQuery;
    }>) {
      return service.searchProducts(body, limit, offset);
    },
  };
}

export type ProductsController = ReturnType<typeof createProductsController>;
