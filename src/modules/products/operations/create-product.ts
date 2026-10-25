import type { FastifyReply, FastifyRequest } from "fastify";
import { StatusCodes } from "http-status-codes";
import type { CreateProduct } from "../schemas/product.schema.js";
import { createProduct } from "../products.repository.js";
import { validateProductInput } from "../product.validation.js";

export async function createProductHandler(
  request: FastifyRequest<{ Body: CreateProduct }>,
  reply: FastifyReply,
) {
  validateProductInput(request.body);

  const product = await createProduct(request.body);

  return reply
    .code(StatusCodes.CREATED)
    .header("Location", `/products/${product.id}`)
    .send(product);
}