import typebox from 'typebox';
import { equalityOperandsSchema, numericOperandsSchema, spatialOperandsSchema } from './filter-operators.schema.js';

export const searchProductsSchema = typebox.Object(
  {
    equal: typebox.Optional(equalityOperandsSchema),
    greater: typebox.Optional(numericOperandsSchema),
    greaterEqual: typebox.Optional(numericOperandsSchema),
    less: typebox.Optional(numericOperandsSchema),
    lessEqual: typebox.Optional(numericOperandsSchema),

    contains: typebox.Optional(spatialOperandsSchema),
    within: typebox.Optional(spatialOperandsSchema),
    intersects: typebox.Optional(spatialOperandsSchema),
  },
  {
    additionalProperties: false,
  }
);

export type SearchProductsInput = typebox.Static<typeof searchProductsSchema>;
