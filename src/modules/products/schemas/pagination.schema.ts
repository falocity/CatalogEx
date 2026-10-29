import Type from "typebox";
import { ProductSchema } from "./product.schema.js";

export const DEFAULT_PAGE_LIMIT = 20;
export const DEFAULT_PAGE_OFFSET = 0;

const MAX_PAGE_LIMIT = 100;

const LimitSchema = Type.Integer({
  minimum: 1,
  maximum: MAX_PAGE_LIMIT,
});

const OffsetSchema = Type.Integer({
  minimum: 0,
});
export const PaginationQuerySchema = Type.Object(
  {
    limit: Type.Optional(LimitSchema),
    offset: Type.Optional(OffsetSchema),
  },
  { additionalProperties: false },
);
export const ProductsPageSchema = Type.Object(
  {
    items: Type.Array(ProductSchema, {
      maxItems: MAX_PAGE_LIMIT,
    }),
    limit: LimitSchema,
    offset: OffsetSchema,
    hasMore: Type.Boolean(),
  },
  { additionalProperties: false },
);

export type PaginationQuery = Type.Static<typeof PaginationQuerySchema>;
export type ProductsPage = Type.Static<typeof ProductsPageSchema>;
