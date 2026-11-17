import typebox from 'typebox';
import { productSchema } from './product.schema.js';

const numericFieldsSchema = typebox.Object({
  resolutionBest: typebox.Number(),
  minZoom: typebox.Integer(),
  maxZoom: typebox.Integer(),
});

const equalityFieldsSchema = typebox.Object({
  ...numericFieldsSchema.properties,
  id: productSchema.properties.id,
  name: productSchema.properties.name,
  description: productSchema.properties.description,
  consumptionLink: productSchema.properties.consumptionLink,
  productType: productSchema.properties.productType,
  consumptionProtocol: productSchema.properties.consumptionProtocol,
});

const spatialFieldsSchema = typebox.Object({
  boundingPolygon: productSchema.properties.boundingPolygon,
});

const numericOperandsSchema = typebox.Partial(numericFieldsSchema, {
  minProperties: 1,
  additionalProperties: false,
});

const equalityOperandsSchema = typebox.Partial(equalityFieldsSchema, {
  minProperties: 1,
  additionalProperties: false,
});

const spatialOperandsSchema = typebox.Partial(spatialFieldsSchema, {
  minProperties: 1,
  additionalProperties: false,
});

type NumericField = keyof typeof numericFieldsSchema.properties;
type EqualityField = keyof typeof equalityFieldsSchema.properties;

const NUMERIC_FILTER_FIELDS = Object.keys(numericFieldsSchema.properties) as NumericField[];

const EQUALITY_FILTER_FIELDS = Object.keys(equalityFieldsSchema.properties) as EqualityField[];

export { numericOperandsSchema, equalityOperandsSchema, spatialOperandsSchema, NUMERIC_FILTER_FIELDS, EQUALITY_FILTER_FIELDS };
