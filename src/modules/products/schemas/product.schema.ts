import Type from "typebox";
import {
  BoundingPolygonSchema,
  ConsumptionProtocolSchema,
  ConsumptionLinkSchema,
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
  consumptionLink: ConsumptionLinkSchema,
  productType: ProductTypeSchema,
  consumptionProtocol: ConsumptionProtocolSchema,
  resolutionBest: ResolutionBestSchema,
  minZoom: MinZoom,
  maxZoom: MaxZoom,
});

export const CreateProductSchemaInput = Type.Omit(ProductSchema, ["id"], {
  additionalProperties: false,
});

export const ProductIdParamsSchema = Type.Object(
  { id: ProductIdSchema },
  { additionalProperties: false },
);

export const CreateProductResponseSchema = Type.Pick(ProductSchema, ["id"], {
  additionalProperties: false,
});

export type Product = Type.Static<typeof ProductSchema>;

export type CreateProduct = Type.Static<typeof CreateProductSchemaInput>;

export type ProductIdParams = Type.Static<typeof ProductIdParamsSchema>;

export type CreateProductResponse = Type.Static<
  typeof CreateProductResponseSchema
>;
