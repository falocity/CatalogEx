import typebox from 'typebox';
import { productSchema } from './product.schema.js';

const DEFAULT_PAGE_LIMIT = 20;
const DEFAULT_PAGE_OFFSET = 0;

const MAX_PAGE_LIMIT = 100;

const limitSchema = typebox.Integer({
  minimum: 1,
  maximum: MAX_PAGE_LIMIT,
});

const offsetSchema = typebox.Integer({
  minimum: 0,
});
const paginationQuerySchema = typebox.Object(
  {
    limit: typebox.Optional(limitSchema),
    offset: typebox.Optional(offsetSchema),
  },
  { additionalProperties: false }
);
const productsPageSchema = typebox.Object(
  {
    items: typebox.Array(productSchema, {
      maxItems: MAX_PAGE_LIMIT,
    }),
    limit: limitSchema,
    offset: offsetSchema,
    hasMore: typebox.Boolean(),
  },
  { additionalProperties: false }
);

type PaginationQuery = typebox.Static<typeof paginationQuerySchema>;
type ProductsPage = typebox.Static<typeof productsPageSchema>;

export { DEFAULT_PAGE_LIMIT, DEFAULT_PAGE_OFFSET, paginationQuerySchema, productsPageSchema };
export type { PaginationQuery, ProductsPage };
