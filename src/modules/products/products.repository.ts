import { and, asc, eq, getTableColumns, sql } from "drizzle-orm";
import { db } from "../../db/client.js";
import { products } from "../../db/schema.js";
import { buildProductSearchConditions } from "./product-search.filters.js";
import type { BoundingPolygon } from "./schemas/fields.schema.js";
import type { ProductsPage } from "./schemas/pagination.schema.js";
import type { CreateProduct, Product } from "./schemas/product.schema.js";
import type { SearchProductsInput } from "./schemas/search-products.schema.js";
import type { UpdateProduct } from "./schemas/update-product.schema.js";

const productSelection = {
  ...getTableColumns(products),
  boundingPolygon: sql<BoundingPolygon>`
    ST_AsGeoJSON(
      ST_ForcePolygonCCW(${products.boundingPolygon}),
      15,
      0
    )::json
  `,
};

type ProductRow = Omit<Product, "description"> & {
  description: string | null;
};

function toProduct(row: ProductRow): Product {
  const { description, ...product } = row;

  return description === null ? product : { ...product, description };
}

export async function createProduct(input: CreateProduct): Promise<Product> {
  const [created] = await db
    .insert(products)
    .values({
      name: input.name,
      description: input.description ?? null,
      boundingPolygon: sql`
        ST_SetSRID(
          ST_GeomFromGeoJSON(${JSON.stringify(input.boundingPolygon)}),
          4326
        )
      `,
      consumptionLink: input.consumptionLink,
      productType: input.productType,
      consumptionProtocol: input.consumptionProtocol,
      resolutionBest: input.resolutionBest,
      minZoom: input.minZoom,
      maxZoom: input.maxZoom,
    })
    .returning(productSelection);

  if (!created) {
    throw new Error("Product insert returned no row");
  }

  return toProduct(created);
}

export async function getProductById(id: string): Promise<Product | undefined> {
  const [product] = await db
    .select(productSelection)
    .from(products)
    .where(eq(products.id, id));

  return product ? toProduct(product) : undefined;
}

export async function listProducts(
  limit: number,
  offset: number,
): Promise<ProductsPage> {
  const rows = await db
    .select(productSelection)
    .from(products)
    .orderBy(asc(products.id))
    .limit(limit + 1)
    .offset(offset);

  return {
    items: rows.slice(0, limit).map(toProduct),
    limit,
    offset,
    hasMore: rows.length > limit,
  };
}

export async function updateProduct(
  id: string,
  input: UpdateProduct,
): Promise<Product | undefined> {
  const [updated] = await db
    .update(products)
    .set({
      name: input.name,
      description: input.description,
      boundingPolygon:
        input.boundingPolygon === undefined
          ? undefined
          : sql`
              ST_SetSRID(
                ST_GeomFromGeoJSON(
                  ${JSON.stringify(input.boundingPolygon)}
                ),
                4326
              )
            `,
      consumptionLink: input.consumptionLink,
      productType: input.productType,
      consumptionProtocol: input.consumptionProtocol,
      resolutionBest: input.resolutionBest,
      minZoom: input.minZoom,
      maxZoom: input.maxZoom,
    })
    .where(eq(products.id, id))
    .returning(productSelection);

  return updated ? toProduct(updated) : undefined;
}

export async function deleteProduct(id: string): Promise<boolean> {
  const [deleted] = await db
    .delete(products)
    .where(eq(products.id, id))
    .returning({ id: products.id });

  return deleted !== undefined;
}

export async function areBoundingPolygonsValid(
  geometries: BoundingPolygon[],
): Promise<boolean> {
  if (geometries.length === 0) {
    return true;
  }

  const checks = geometries.map((geometry) => {
    const operand = sql`
      ST_SetSRID(
        ST_GeomFromGeoJSON(${JSON.stringify(geometry)}),
        4326
      )
    `;

    return sql`
      (
        NOT ST_IsEmpty(${operand})
        AND ST_IsValid(${operand})
      )
    `;
  });

  const result = await db.execute(sql`
    SELECT ${and(...checks)} AS valid
  `);

  return result.rows[0]?.valid === true;
}

export async function searchProducts(
  input: SearchProductsInput,
  limit: number,
  offset: number,
): Promise<ProductsPage> {
  const conditions = buildProductSearchConditions(input);

  const rows = await db
    .select(productSelection)
    .from(products)
    .where(conditions)
    .orderBy(asc(products.id))
    .limit(limit + 1)
    .offset(offset);

  return {
    items: rows.slice(0, limit).map(toProduct),
    limit,
    offset,
    hasMore: rows.length > limit,
  };
}
