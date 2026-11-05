import { sql } from "drizzle-orm";
import {
  check,
  customType,
  doublePrecision,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

const postgisGeometry = customType<{
  data: string;
  driverData: string;
}>({
  dataType() {
    return "geometry";
  },
});

export const productTypeEnum = pgEnum("product_type", [
  "raster",
  "rasterized vector",
  "3d tiles",
  "QMesh",
]);

export const consumptionProtocolEnum = pgEnum("consumption_protocol", [
  "WMS",
  "WMTS",
  "XYZ",
  "3D Tiles",
]);

export const products = pgTable(
  "products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 48 }).notNull(),
    description: text("description"),
    boundingPolygon: postgisGeometry("bounding_polygon").notNull(),
    consumptionLink: text("consumption_link").notNull(),
    productType: productTypeEnum("product_type").notNull(),
    consumptionProtocol: consumptionProtocolEnum(
      "consumption_protocol",
    ).notNull(),
    resolutionBest: doublePrecision("resolution_best").notNull(),
    minZoom: integer("min_zoom").notNull(),
    maxZoom: integer("max_zoom").notNull(),
  },
  (table) => [
    check("products_name_nonempty", sql`char_length(${table.name}) >= 1`),
    check(
      "products_description_nonempty",
      sql`char_length(${table.description}) >= 1`,
    ),
    check(
      "products_resolution_valid",
      sql`
        ${table.resolutionBest} >= 0
        AND ${table.resolutionBest} < 'Infinity'::double precision
      `,
    ),

    check("products_min_zoom_nonnegative", sql`${table.minZoom} >= 0`),
    check("products_max_zoom_positive", sql`${table.maxZoom} > 0`),
    check(
      "products_zoom_range_valid",
      sql`${table.minZoom} <= ${table.maxZoom}`,
    ),

    check(
      "products_bounding_polygon_type",
      sql`
        GeometryType(${table.boundingPolygon})
        IN ('POLYGON', 'MULTIPOLYGON')
      `,
    ),

    check(
      "products_bounding_polygon_srid",
      sql`ST_SRID(${table.boundingPolygon}) = 4326`,
    ),

    check(
      "products_bounding_polygon_dimensions_by_code(xy,xyz)",
      sql`ST_Zmflag(${table.boundingPolygon}) IN (0, 2)`,
    ),
    check(
      "products_bounding_polygon_valid",
      sql`
        NOT ST_IsEmpty(${table.boundingPolygon})
        AND ST_IsValid(${table.boundingPolygon})
      `,
    ),
    index("products_product_type_btree").on(table.productType),
    index("products_resolution_best_btree").on(table.resolutionBest),
    index("products_bounding_polygon_gist").using(
      "gist",
      table.boundingPolygon,
    ),
  ],
);
