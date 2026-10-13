import Type from "typebox";
import {
  BoundingPolygonSchema,
  ConsumptionProtocolSchema,
  ConsumtionLinkSchema,
  MaxZoom,
  MinZoom,
  ProductDescriptionSchema,
  ProductIdSchema,
  ProductNameSchema,
  ProductTypeSchema,
  ResolutionBestSchema,
} from "./fields.schema.js";

export const ProductSchema = Type.Object({
  id: ProductIdSchema,
  name: ProductNameSchema,
  description: Type.Optional(ProductDescriptionSchema),
  boundingPolygon: BoundingPolygonSchema,
  consumptionLink: ConsumtionLinkSchema,
  productType: ProductTypeSchema,
  consumptionProtocol: ConsumptionProtocolSchema,
  resolutionBest: ResolutionBestSchema,
  minZoom: MinZoom,
  maxZoom: MaxZoom,
});

export const CreateProductSchemaInput = Type.Omit(ProductSchema, ["id"]);

export type Product = Type.Static<typeof ProductSchema>;

export type CreateProduct = Type.Static<typeof CreateProductSchemaInput>;
