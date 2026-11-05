import typebox from 'typebox';
import {
  boundingPolygonSchema,
  consumptionProtocolSchema,
  consumptionLinkSchema,
  maxZoom,
  minZoom,
  productDescriptionSchema,
  productIdSchema,
  productNameSchema,
  productTypeSchema,
  resolutionBestSchema,
} from './fields.schema.js';

export const productSchema = typebox.Object({
  id: productIdSchema,
  name: productNameSchema,
  description: typebox.Optional(productDescriptionSchema),
  boundingPolygon: boundingPolygonSchema,
  consumptionLink: consumptionLinkSchema,
  productType: productTypeSchema,
  consumptionProtocol: consumptionProtocolSchema,
  resolutionBest: resolutionBestSchema,
  minZoom: minZoom,
  maxZoom: maxZoom,
});

export const createProductSchemaInput = typebox.Omit(productSchema, ['id'], {
  additionalProperties: false,
});

export const productIdParamsSchema = typebox.Object({ id: productIdSchema }, { additionalProperties: false });

export const createProductResponseSchema = typebox.Pick(productSchema, ['id'], {
  additionalProperties: false,
});

export type Product = typebox.Static<typeof productSchema>;

export type CreateProduct = typebox.Static<typeof createProductSchemaInput>;

export type ProductIdParams = typebox.Static<typeof productIdParamsSchema>;

export type CreateProductResponse = typebox.Static<typeof createProductResponseSchema>;
