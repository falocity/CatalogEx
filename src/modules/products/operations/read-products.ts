import type { FastifyReply, FastifyRequest } from "fastify";
import { StatusCodes } from "http-status-codes";
import { getProductById } from "../products.repository.js";

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
