import type { FastifyReply, FastifyRequest } from "fastify";
import { StatusCodes } from "http-status-codes";
import type { UpdateProduct } from "../schemas/update-product.schema.js";
import { updateProduct } from "../products.repository.js";
import { validateBoundingPolygon } from "../product.validation.js";

export async function updateProductHandler(
  request: FastifyRequest<{
    Params: { id: string };
    Body: UpdateProduct;
  }>,
  reply: FastifyReply,
) {
  if (request.body.boundingPolygon !== undefined) {
    validateBoundingPolygon(request.body.boundingPolygon);
  }

  const product = await updateProduct(request.params.id, request.body);
  if (!product) {
    return reply.code(StatusCodes.NOT_FOUND).send({
      code: "PRODUCT_NOT_FOUND",
      message: "Product not found.",
      field: "id",
    });
  }

  return reply.code(StatusCodes.OK).send(product);
}
