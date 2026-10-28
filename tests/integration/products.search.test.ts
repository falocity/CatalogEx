import assert from "node:assert/strict";
import { test } from "node:test";
import type { FastifyInstance } from "fastify";
import { StatusCodes } from "http-status-codes";
import {
  makeProduct,
  rectangle,
  storeProduct,
  withProductTest,
} from "../helpers/products.js";
import type { ProductsPage } from "../../src/modules/products/schemas/pagination.schema.js";
import type { SearchProductsInput } from "../../src/modules/products/schemas/search-products.schema.js";

async function search(
  app: FastifyInstance,
  filters: SearchProductsInput,
  offset = 0,
  limit = 20,
): Promise<ProductsPage> {
  const response = await app.inject({
    method: "POST",
    url: `/products/search?limit=${limit}&offset=${offset}`,
    payload: filters,
  });

  assert.equal(response.statusCode, StatusCodes.OK, response.body);
  return response.json<ProductsPage>();
}

const spatialMatches = {
  contains: ["outer"],
  within: ["inner"],
  intersects: ["inner", "outer", "overlap", "touch"],
} as const;

for (const operator of ["contains", "within", "intersects"] as const) {
  test(`search ${operator} uses the correct direction and boundary behavior`, async () => {
    await withProductTest(async ({ app }) => {
      const name = makeProduct().name;

      const shapes = {
        inner: rectangle(2, 2, 3, 3),
        outer: rectangle(-1, -1, 11, 11),
        overlap: rectangle(9, 4, 12, 6),
        touch: rectangle(10, 2, 12, 3),
        far: rectangle(20, 20, 21, 21),
      };

      const ids = new Map<string, string>();

      for (const [label, boundingPolygon] of Object.entries(shapes)) {
        ids.set(
          label,
          await storeProduct(app, makeProduct({ name, boundingPolygon })),
        );
      }

      const page = await search(app, {
        equal: { name },
        [operator]: {
          boundingPolygon: rectangle(0, 0, 10, 10),
        },
      });

      assert.deepEqual(
        page.items.map((product) => product.id).sort(),
        spatialMatches[operator].map((label) => ids.get(label)).sort(),
      );
      assert.equal(page.hasMore, false);
    });
  });
}

test("search combines equality and numeric conditions with AND", async () => {
  await withProductTest(async ({ app }) => {
    const name = makeProduct().name;

    await storeProduct(app, makeProduct({ name, resolutionBest: 0.5 }));

    const expected = await storeProduct(
      app,
      makeProduct({ name, resolutionBest: 2 }),
    );

    await storeProduct(
      app,
      makeProduct({
        name,
        resolutionBest: 2,
        consumptionProtocol: "WMS",
      }),
    );

    const page = await search(app, {
      equal: { name, consumptionProtocol: "WMTS" },
      greater: { resolutionBest: 1 },
      lessEqual: { resolutionBest: 3 },
    });

    assert.deepEqual(
      page.items.map((product) => product.id),
      [expected],
    );
  });
});

test("search pagination returns ordered pages and an empty final page", async () => {
  await withProductTest(async ({ app }) => {
    const name = makeProduct().name;
    const ids: string[] = [];

    for (let i = 0; i < 3; i++) {
      ids.push(await storeProduct(app, makeProduct({ name })));
    }

    ids.sort();

    for (const offset of [0, 2, 3]) {
      const page = await search(app, { equal: { name } }, offset, 2);

      assert.deepEqual(
        page.items.map((product) => product.id),
        ids.slice(offset, offset + 2),
      );
      assert.equal(page.limit, 2);
      assert.equal(page.offset, offset);
      assert.equal(page.hasMore, offset + 2 < ids.length);
    }

    const noMatches = await search(app, {
      equal: { name },
      greater: { resolutionBest: 99 },
    });

    assert.deepEqual(noMatches.items, []);
    assert.equal(noMatches.hasMore, false);
  });
});

test("listing pagination matches the database snapshot", async () => {
  await withProductTest(async ({ app, client }) => {
    for (let i = 0; i < 3; i++) {
      await storeProduct(app, makeProduct());
    }

    const { rows } = await client.query<{ id: string }>(
      "SELECT id FROM public.products ORDER BY id LIMIT 5",
    );
    const expected = rows.map((row) => row.id);

    const countResult = await client.query<{ count: number }>(
      "SELECT count(*)::integer AS count FROM public.products",
    );
    const count = countResult.rows[0]!.count;

    for (const offset of [0, 2, count]) {
      const response = await app.inject({
        method: "GET",
        url: `/products?limit=2&offset=${offset}`,
      });

      assert.equal(response.statusCode, StatusCodes.OK, response.body);

      const page = response.json<ProductsPage>();

      assert.deepEqual(
        page.items.map((product) => product.id),
        offset === count ? [] : expected.slice(offset, offset + 2),
      );
      assert.equal(page.limit, 2);
      assert.equal(page.offset, offset);
      assert.equal(page.hasMore, offset + 2 < count);
    }
  });
});
