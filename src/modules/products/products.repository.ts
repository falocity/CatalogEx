import { asc, eq, getTableColumns } from "drizzle-orm";
import type { FastifyBaseLogger } from "fastify";
import type { Database } from "../../db/client.js";
import { products } from "../../db/schema.js";
import { geometryAsGeoJSON, geometryToSql } from "./geometry.utils.js";
import { buildProductSearchConditions } from "./product-search.filters.js";
import { rethrowProductDatabaseError } from "./products.errors.js";
import type { ProductsPage } from "./schemas/pagination.schema.js";
import type { CreateProduct, Product } from "./schemas/product.schema.js";
import type { SearchProductsInput } from "./schemas/search-products.schema.js";
import type { UpdateProduct } from "./schemas/update-product.schema.js";

const productSelection = {
  ...getTableColumns(products),
  boundingPolygon: geometryAsGeoJSON(products.boundingPolygon),
};

type ProductRow = Omit<Product, "description"> & {
  description: string | null;
};

function toProduct(row: ProductRow): Product {
  const { description, ...product } = row;

  return description === null ? product : { ...product, description };
}

function toPage(
  rows: ProductRow[],
  limit: number,
  offset: number,
): ProductsPage {
  return {
    items: rows.slice(0, limit).map(toProduct),
    limit,
    offset,
    hasMore: rows.length > limit,
  };
}

export function createProductsRepository(
  db: Database,
  logger: FastifyBaseLogger,
) {
  async function query<T>(
    operation: string,
    execute: () => PromiseLike<T>,
  ): Promise<T> {
    const started = performance.now();

    try {
      const result = await execute();

      logger.debug(
        {
          operation,
          durationMs: performance.now() - started,
          rowCount: Array.isArray(result) ? result.length : undefined,
        },
        "Product database query completed",
      );

      return result;
    } catch (error) {
      rethrowProductDatabaseError(error);
    }
  }

  return {
    async createProduct(input: CreateProduct): Promise<Product> {
      const [created] = await query("create", () =>
        db
          .insert(products)
          .values({
            ...input,
            description: input.description ?? null,
            boundingPolygon: geometryToSql(input.boundingPolygon),
          })
          .returning(productSelection),
      );

      if (!created) {
        throw new Error("Product insert returned no row");
      }

      return toProduct(created);
    },

    async getProductById(id: string): Promise<Product | undefined> {
      const [product] = await query("getById", () =>
        db.select(productSelection).from(products).where(eq(products.id, id)),
      );

      return product ? toProduct(product) : undefined;
    },

    async listProducts(limit: number, offset: number): Promise<ProductsPage> {
      const rows = await query("list", () =>
        db
          .select(productSelection)
          .from(products)
          .orderBy(asc(products.id))
          .limit(limit + 1)
          .offset(offset),
      );

      return toPage(rows, limit, offset);
    },

    async updateProduct(
      id: string,
      input: UpdateProduct,
    ): Promise<Product | undefined> {
      const [updated] = await query("update", () =>
        db
          .update(products)
          .set({
            ...input,
            boundingPolygon:
              input.boundingPolygon === undefined
                ? undefined
                : geometryToSql(input.boundingPolygon),
          })
          .where(eq(products.id, id))
          .returning(productSelection),
      );

      return updated ? toProduct(updated) : undefined;
    },

    async deleteProduct(id: string): Promise<boolean> {
      const [deleted] = await query("delete", () =>
        db
          .delete(products)
          .where(eq(products.id, id))
          .returning({ id: products.id }),
      );

      return deleted !== undefined;
    },

    async searchProducts(
      input: SearchProductsInput,
      limit: number,
      offset: number,
    ): Promise<ProductsPage> {
      const rows = await query("search", () =>
        db
          .select(productSelection)
          .from(products)
          .where(buildProductSearchConditions(input))
          .orderBy(asc(products.id))
          .limit(limit + 1)
          .offset(offset),
      );

      return toPage(rows, limit, offset);
    },
  };
}

export type ProductsRepository = ReturnType<typeof createProductsRepository>;
