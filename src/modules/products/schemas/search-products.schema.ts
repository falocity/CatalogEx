import Type from "typebox";
import {
  EqualityOperandsSchema,
  NumericOperandsSchema,
  SpatialOperandsSchema,
} from "./filter-operators.schema.js";

export const SearchProductsSchema = Type.Object(
  {
    equal: Type.Optional(EqualityOperandsSchema),
    greater: Type.Optional(NumericOperandsSchema),
    greaterEqual: Type.Optional(NumericOperandsSchema),
    less: Type.Optional(NumericOperandsSchema),
    lessEqual: Type.Optional(NumericOperandsSchema),

    contains: Type.Optional(SpatialOperandsSchema),
    within: Type.Optional(SpatialOperandsSchema),
    intersects: Type.Optional(SpatialOperandsSchema),
  },
  {
    additionalProperties: false,
  },
);

export type SearchProductsInput = Type.Static<typeof SearchProductsSchema>;
