import { getTableColumns, sql } from "drizzle-orm";
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

  const { description, ...product } = created;
  return description === null ? product : { ...product, description };
}
