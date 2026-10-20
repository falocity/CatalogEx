import Type from "typebox";
import { ProductSchema } from "./product.schema.js";

const NumericFieldsSchema = Type.Object({
  resolutionBest: Type.Number(),
  minZoom: Type.Integer(),
  maxZoom: Type.Integer(),
});

const EqualityFieldsSchema = Type.Object({
  ...NumericFieldsSchema.properties,
  id: ProductSchema.properties.id,
  name: ProductSchema.properties.name,
  description: ProductSchema.properties.description,
  consumptionLink: ProductSchema.properties.consumptionLink,
  productType: ProductSchema.properties.productType,
  consumptionProtocol: ProductSchema.properties.consumptionProtocol,
});

const SpatialFieldsSchema = Type.Object({
  boundingPolygon: ProductSchema.properties.boundingPolygon,
});

export const NumericOperandsSchema = Type.Partial(NumericFieldsSchema, {
  minProperties: 1,
  additionalProperties: false,
});

export const EqualityOperandsSchema = Type.Partial(EqualityFieldsSchema, {
  minProperties: 1,
  additionalProperties: false,
});

export const SpatialOperandsSchema = Type.Partial(SpatialFieldsSchema, {
  minProperties: 1,
  additionalProperties: false,
});
