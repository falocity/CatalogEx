import type { FastifyReply, FastifyRequest } from "fastify";
import { StatusCodes } from "http-status-codes";

import {
  ProductValidationError,
  validateBoundingPolygon,
} from "../product.validation.js";
import {
  areBoundingPolygonsValid,
  searchProducts,
} from "../products.repository.js";
import type { BoundingPolygon } from "../schemas/fields.schema.js";
import {
  DEFAULT_PAGE_LIMIT,
  DEFAULT_PAGE_OFFSET,
  type PaginationQuery,
} from "../schemas/pagination.schema.js";
import type { SearchProductsInput } from "../schemas/search-products.schema.js";

export async function searchProductsHandler(
  request: FastifyRequest<{
    Body: SearchProductsInput;
    Querystring: PaginationQuery;
  }>,
  reply: FastifyReply,
) {
  const geometries: BoundingPolygon[] = [];

  for (const operands of [
    request.body.contains,
    request.body.within,
    request.body.intersects,
  ]) {
    const geometry = operands?.boundingPolygon;

    if (geometry !== undefined) {
      validateBoundingPolygon(geometry);
      geometries.push(geometry);
    }
  }

  const geometriesValid = await areBoundingPolygonsValid(geometries);

  if (!geometriesValid) {
    throw new ProductValidationError(
      "boundingPolygon",
      "Search polygons must be valid, nonempty geometries.",
    );
  }

  const limit = request.query.limit ?? DEFAULT_PAGE_LIMIT;
  const offset = request.query.offset ?? DEFAULT_PAGE_OFFSET;
  const page = await searchProducts(request.body, limit, offset);

  return reply.code(StatusCodes.OK).send(page);
}
