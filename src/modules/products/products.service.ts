import type { FastifyBaseLogger } from "fastify";

import type { ProductsRepository } from "./products.repository.js";
import { ProductNotFoundError } from "./products.errors.js";
import {
  ProductValidationError,
  validateBoundingPolygon,
  validateProductInput,
  validateProductUpdate,
} from "./product.validation.js";
import type { BoundingPolygon } from "./schemas/fields.schema.js";
import type { CreateProduct } from "./schemas/product.schema.js";
import type { UpdateProduct } from "./schemas/update-product.schema.js";
import type { SearchProductsInput } from "./schemas/search-products.schema.js";

export function createProductsService(
  repository: ProductsRepository,
  logger: FastifyBaseLogger,
  validateGeometries: (geometries: BoundingPolygon[]) => Promise<boolean>,
) {
  return {
    async createProduct(input: CreateProduct) {
      validateProductInput(input);

      const product = await repository.createProduct(input);

      logger.info({ productId: product.id }, "Product created");

      return product;
    },

    async getProductById(id: string) {
      const product = await repository.getProductById(id);

      if (!product) {
        throw new ProductNotFoundError();
      }

      return product;
    },

    async listProducts(limit: number, offset: number) {
      return repository.listProducts(limit, offset);
    },

    async updateProduct(id: string, input: UpdateProduct) {
      validateProductUpdate(input);

      const product = await repository.updateProduct(id, input);

      if (!product) {
        throw new ProductNotFoundError();
      }

      logger.info({ productId: id }, "Product updated");

      return product;
    },

    async deleteProduct(id: string) {
      const deleted = await repository.deleteProduct(id);

      if (!deleted) {
        throw new ProductNotFoundError();
      }

      logger.info({ productId: id }, "Product deleted");
    },

    async searchProducts(
      input: SearchProductsInput,
      limit: number,
      offset: number,
    ) {
      const geometries: BoundingPolygon[] = [];

      for (const operands of [input.contains, input.within, input.intersects]) {
        const geometry = operands?.boundingPolygon;

        if (geometry !== undefined) {
          validateBoundingPolygon(geometry);
          geometries.push(geometry);
        }
      }

      const geometriesValid = await validateGeometries(geometries);

      if (!geometriesValid) {
        throw new ProductValidationError(
          "boundingPolygon",
          "Search polygons must be valid, nonempty geometries.",
        );
      }

      logger.debug({ filters: input, limit, offset }, "Searching products");

      return repository.searchProducts(input, limit, offset);
    },
  };
}

export type ProductsService = ReturnType<typeof createProductsService>;
