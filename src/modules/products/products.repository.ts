import { asc, eq, getTableColumns, sql } from "drizzle-orm";
import { db } from "../../db/client.js";
import { products } from "../../db/schema.js";
import type { BoundingPolygon } from "./schemas/fields.schema.js";
import type { CreateProduct, Product } from "./schemas/product.schema.js";

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
    .where(eq(products.id, id))
    .limit(1);

  return product ? toProduct(product) : undefined;
}
export async function listProducts(limit: number, offset: number) {
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
