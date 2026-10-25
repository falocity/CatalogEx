import type { FastifyReply, FastifyRequest } from "fastify";
import { StatusCodes } from "http-status-codes";
import { getProductById, listProducts } from "../products.repository.js";
import {
  DEFAULT_PAGE_LIMIT,
  DEFAULT_PAGE_OFFSET,
  type PaginationQuery,
} from "../schemas/pagination.schema.js";

export async function getProductByIdHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const product = await getProductById(request.params.id);

  if (!product) {
    return reply.code(StatusCodes.NOT_FOUND).send({
      code: "PRODUCT_NOT_FOUND",
      message: "Product not found.",
      field: "id",
    });
  }

  return reply.code(StatusCodes.OK).send(product);
}

export async function listProductsHandler(
  request: FastifyRequest<{ Querystring: PaginationQuery }>,
  reply: FastifyReply,
) {
  const limit = request.query.limit ?? DEFAULT_PAGE_LIMIT;
  const offset = request.query.offset ?? DEFAULT_PAGE_OFFSET;

  const page = await listProducts(limit, offset);

  return reply.code(StatusCodes.OK).send(page);
}
