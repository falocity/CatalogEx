import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { StatusCodes } from "http-status-codes";
import { buildApp } from "../../src/app.js";
import type { Pool } from "pg";
import { SERVICES } from "../../src/common/constants.js";
import type {
  CreateProduct,
  Product,
} from "../../src/modules/products/schemas/product.schema.js";

const { app, container } = await buildApp({ logger: false });
const pool = container.resolve<Pool>(SERVICES.POOL);
const names = new Set<string>();

function makeInput(): CreateProduct {
  const name = `api-${randomUUID()}`;
  names.add(name);

  return {
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
}

async function store(input: CreateProduct): Promise<string> {
  const response = await app.inject({
    method: "POST",
    url: "/products",
    payload: input,
  });

  assert.equal(response.statusCode, StatusCodes.CREATED, response.body);

  const { id } = response.json<{ id: string }>();
  assert.equal(typeof id, "string");

  return id;
}

function expectValidationError(response: { statusCode: number; body: string }) {
  assert.equal(response.statusCode, StatusCodes.BAD_REQUEST, response.body);

  const body = JSON.parse(response.body) as {
    code: string;
    message: string;
  };

  assert.equal(body.code, "VALIDATION_ERROR");

  return body;
}

after(async () => {
  try {
    await pool.query(
      "DELETE FROM public.products WHERE name = ANY($1::text[])",
      [[...names]],
    );
  } finally {
    await app.close();
  }
});

test("POST stores minZoom zero", async () => {
  const input = { ...makeInput(), minZoom: 0 };
  const id = await store(input);

  const response = await app.inject({
    method: "GET",
    url: `/products/${id}`,
  });

  assert.equal(response.statusCode, StatusCodes.OK, response.body);
  assert.equal(response.json<Product>().minZoom, 0);
});

test("PATCH stores minZoom zero and preserves omitted fields", async () => {
  const input = makeInput();
  const id = await store(input);

  const update = await app.inject({
    method: "PATCH",
    url: `/products/${id}`,
    payload: { minZoom: 0 },
  });

  assert.equal(update.statusCode, StatusCodes.OK, update.body);

  const retrieval = await app.inject({
    method: "GET",
    url: `/products/${id}`,
  });

  assert.equal(retrieval.statusCode, StatusCodes.OK, retrieval.body);

  const product = retrieval.json<Product>();

  assert.equal(product.minZoom, 0);
  assert.equal(product.maxZoom, input.maxZoom);
  assert.equal(product.name, input.name);
  assert.deepEqual(product.boundingPolygon, input.boundingPolygon);
});

for (const field of ["minZoom", "maxZoom"] as const) {
  for (const method of ["POST", "PATCH"] as const) {
    test(`${method} returns 400 for ${field} storage overflow`, async () => {
      const input = makeInput();
      const overflow = 2_147_483_648;

      const id = method === "PATCH" ? await store(input) : undefined;

      const payload =
        method === "PATCH"
          ? { [field]: overflow }
          : {
              ...input,
              [field]: overflow,
              ...(field === "minZoom" ? { maxZoom: overflow } : {}),
            };

      const response = await app.inject({
        method,
        url: method === "POST" ? "/products" : `/products/${id}`,
        payload,
      });

      const error = expectValidationError(response);

      assert.equal(
        error.message,
        "A numeric value is outside the supported storage range.",
      );

      if (id !== undefined) {
        const retrieval = await app.inject({
          method: "GET",
          url: `/products/${id}`,
        });

        assert.equal(retrieval.statusCode, StatusCodes.OK, retrieval.body);

        const product = retrieval.json<Product>();
        assert.equal(product.minZoom, input.minZoom);
        assert.equal(product.maxZoom, input.maxZoom);
      }
    });
  }
}

for (const kind of ["Polygon", "MultiPolygon"] as const) {
  for (const operation of ["create", "update", "search"] as const) {
    test(`${operation} rejects extra ${kind} properties`, async () => {
      const input = makeInput();
      const id = operation === "update" ? await store(input) : undefined;

      const geometry =
        kind === "Polygon"
          ? input.boundingPolygon
          : {
              type: "MultiPolygon",
              coordinates: [input.boundingPolygon.coordinates],
            };

      for (const extra of [
        { unexpected: true },
        { crs: { type: "name", properties: { name: "EPSG:3857" } } },
      ]) {
        const invalidGeometry = { ...geometry, ...extra };

        const payload =
          operation === "create"
            ? { ...input, boundingPolygon: invalidGeometry }
            : operation === "update"
              ? { boundingPolygon: invalidGeometry }
              : { intersects: { boundingPolygon: invalidGeometry } };

        const response = await app.inject({
          method: operation === "update" ? "PATCH" : "POST",
          url:
            operation === "create"
              ? "/products"
              : operation === "update"
                ? `/products/${id}`
                : "/products/search",
          payload,
        });

        expectValidationError(response);
      }

      if (id !== undefined) {
        const retrieval = await app.inject({
          method: "GET",
          url: `/products/${id}`,
        });

        assert.equal(retrieval.statusCode, StatusCodes.OK, retrieval.body);

        assert.deepEqual(
          retrieval.json<Product>().boundingPolygon,
          input.boundingPolygon,
        );
      }
    });
  }
}
