import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { StatusCodes } from "http-status-codes";
import { buildApp } from "../../app.js";
import type { Pool } from "pg";
import { SERVICES } from "../../common/constants.js";
import type { ProductsPage } from "./schemas/pagination.schema.js";
import type { CreateProduct, Product } from "./schemas/product.schema.js";

test("products API: CRUD and numeric search", async (t) => {
  const { app, container } = await buildApp({ logger: false });
  const pool = container.resolve<Pool>(SERVICES.POOL);
  const name = `api-test-${randomUUID()}`;

  t.after(async () => {
    try {
      await pool.query("DELETE FROM public.products WHERE name = $1", [name]);
    } finally {
      await app.close();
    }
  });

  const input: CreateProduct = {
    name,
    boundingPolygon: {
      type: "Polygon",
      coordinates: [
        [
          [34, 31],
          [35, 31],
          [35, 32],
          [34, 32],
          [34, 31],
        ],
      ],
    },
    consumptionLink: "https://example.com/wmts",
    productType: "raster",
    consumptionProtocol: "WMTS",
    resolutionBest: 0.5,
    minZoom: 1,
    maxZoom: 18,
  };

  const creation = await app.inject({
    method: "POST",
    url: "/products",
    payload: input,
  });

  assert.equal(creation.statusCode, StatusCodes.CREATED, creation.body);

  const created = creation.json<Product>();
  assert.match(
    created.id,
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
  assert.equal(creation.headers.location, `/products/${created.id}`);
  assert.deepEqual(created, { ...input, id: created.id });

  const url = `/products/${created.id}`;

  const retrieval = await app.inject({ method: "GET", url });

  assert.equal(retrieval.statusCode, StatusCodes.OK, retrieval.body);
  assert.deepEqual(retrieval.json<Product>(), created);

  for (const { threshold, expectedIds } of [
    { threshold: 0.25, expectedIds: [created.id] },
    { threshold: 1, expectedIds: [] },
  ]) {
    const search = await app.inject({
      method: "POST",
      url: "/products/search?limit=1&offset=0",
      payload: {
        equal: { name },
        greater: { resolutionBest: threshold },
      },
    });

    assert.equal(search.statusCode, StatusCodes.OK, search.body);

    const page = search.json<ProductsPage>();
    assert.deepEqual(
      page.items.map((product) => product.id),
      expectedIds,
      `Unexpected search result for resolutionBest > ${threshold}`,
    );
    assert.equal(page.limit, 1);
    assert.equal(page.offset, 0);
    assert.equal(page.hasMore, false);
  }

  const expectedUpdate = {
    ...created,
    description: "Updated automatically",
  };

  const update = await app.inject({
    method: "PATCH",
    url,
    payload: { description: expectedUpdate.description },
  });

  assert.equal(update.statusCode, StatusCodes.OK, update.body);
  assert.deepEqual(update.json<Product>(), expectedUpdate);

  const updatedRetrieval = await app.inject({ method: "GET", url });

  assert.equal(
    updatedRetrieval.statusCode,
    StatusCodes.OK,
    updatedRetrieval.body,
  );
  assert.deepEqual(updatedRetrieval.json<Product>(), expectedUpdate);

  const deletion = await app.inject({ method: "DELETE", url });

  assert.equal(deletion.statusCode, StatusCodes.NO_CONTENT, deletion.body);
  assert.equal(deletion.body, "");

  const missing = await app.inject({ method: "GET", url });

  assert.equal(missing.statusCode, StatusCodes.NOT_FOUND, missing.body);
  assert.equal(missing.json<{ code: string }>().code, "PRODUCT_NOT_FOUND");
});
