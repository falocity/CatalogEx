import typebox from 'typebox';
import { createProductSchemaInput } from './product.schema.js';

export const updateProductSchema = typebox.Partial(createProductSchemaInput, {
  minProperties: 1,
  additionalProperties: false,
});

export type UpdateProduct = typebox.Static<typeof updateProductSchema>;
