import Type from "typebox";
import { CreateProductSchemaInput } from "./product.schema.js";

export const UpdateProductSchema = Type.Partial(CreateProductSchemaInput, {
  minProperties: 1,
  additionalProperties: false,
});

export type UpdateProduct = Type.Static<typeof UpdateProductSchema>;
