import type { FastifyReply, FastifyRequest } from "fastify";
import { StatusCodes } from "http-status-codes";
import { deleteProduct } from "../products.repository.js";

export async function deleteProductHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const deleted = await deleteProduct(request.params.id);

  if (!deleted) {
    return reply.code(StatusCodes.NOT_FOUND).send({
      code: "PRODUCT_NOT_FOUND",
      message: "Product not found.",
      field: "id",
    });
  }

  return reply.code(StatusCodes.NO_CONTENT).send();
}
