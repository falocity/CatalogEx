import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { StatusCodes } from "http-status-codes";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { buildApp } from "../../src/app.js";
import { getConfig, initConfig } from "../../src/common/config.js";
import { SERVICES } from "../../src/common/constants.js";
import type { BoundingPolygon } from "../../src/modules/products/schemas/fields.schema.js";
import type { ProductsPage } from "../../src/modules/products/schemas/pagination.schema.js";
import type {
  CreateProduct,
  CreateProductResponse,
  Product,
} from "../../src/modules/products/schemas/product.schema.js";
import type { SearchProductsInput } from "../../src/modules/products/schemas/search-products.schema.js";
import {
  makeProduct,
  rectangle,
  storeProduct,
  withProductTest,
} from "../helpers/products.js";
import { ProductsRequestSender } from "../helpers/productsRequestSender.js";
import { spawn } from "node:child_process";
import { createServer } from "node:http";

describe("products API", () => {
  describe("Happy Path", () => {
    it("creates a product and returns its ID and Location", () =>
      withProductTest(async ({ app }) => {
        const requests = new ProductsRequestSender(app);
        const response = await requests.create(
          makeProduct({
            boundingPolygon: rectangle(34, 31, 35, 32),
            resolutionBest: 0.5,
            minZoom: 1,
          }),
        );

        expect(response.statusCode, response.body).toBe(StatusCodes.CREATED);
        const created = response.json<CreateProductResponse>();
        expect(created.id).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
        );
        expect(created).toEqual({ id: created.id });
        expect(response.headers.location).toBe(`/products/${created.id}`);
      }));

    it("retrieves the stored product", () =>
      withProductTest(async ({ app }) => {
        const requests = new ProductsRequestSender(app);
        const input = makeProduct();
        const id = await storeProduct(app, input);
        const response = await requests.getById(id);

        expect(response.statusCode, response.body).toBe(StatusCodes.OK);
        expect(response.json<Product>()).toEqual({ ...input, id });
      }));

    it("searches by name and numeric resolution threshold", () =>
      withProductTest(async ({ app }) => {
        const requests = new ProductsRequestSender(app);
        const input = makeProduct({ resolutionBest: 0.5 });
        const id = await storeProduct(app, input);

        for (const { threshold, expectedIds } of [
          { threshold: 0.25, expectedIds: [id] },
          { threshold: 1, expectedIds: [] },
        ]) {
          const response = await requests.search(
            {
              equal: { name: input.name },
              greater: { resolutionBest: threshold },
            },
            1,
            0,
          );

          expect(response.statusCode, response.body).toBe(StatusCodes.OK);
          const page = response.json<ProductsPage>();
          expect(page.items.map((product) => product.id)).toEqual(expectedIds);
          expect(page).toMatchObject({ limit: 1, offset: 0, hasMore: false });
        }
      }));

    it("updates a field and preserves omitted fields", () =>
      withProductTest(async ({ app }) => {
        const requests = new ProductsRequestSender(app);
        const input = makeProduct();
        const id = await storeProduct(app, input);
        const expected = { ...input, id, description: "Updated automatically" };

        const update = await requests.update(id, {
          description: expected.description,
        });
        expect(update.statusCode, update.body).toBe(StatusCodes.OK);
        expect(update.json<Product>()).toEqual(expected);

        const retrieval = await requests.getById(id);
        expect(retrieval.statusCode, retrieval.body).toBe(StatusCodes.OK);
        expect(retrieval.json<Product>()).toEqual(expected);
      }));

    it("deletes a product and returns 404 on a subsequent GET", () =>
      withProductTest(async ({ app }) => {
        const requests = new ProductsRequestSender(app);
        const id = await storeProduct(app, makeProduct());

        const deletion = await requests.remove(id);
        expect(deletion.statusCode, deletion.body).toBe(StatusCodes.NO_CONTENT);
        expect(deletion.body).toBe("");

        const missing = await requests.getById(id);
        expect(missing.statusCode, missing.body).toBe(StatusCodes.NOT_FOUND);
        expect(missing.json<{ code: string }>().code).toBe("PRODUCT_NOT_FOUND");
      }));
  });

  describe("Sad Path", () => {
    it.each(["PATCH", "DELETE"] as const)("%s returns 404", async (method) => {
      await withProductTest(async ({ app }) => {
        const requests = new ProductsRequestSender(app);
        const id = randomUUID();
        const response =
          method === "PATCH"
            ? await requests.update(id, { name: "Missing product" })
            : await requests.remove(id);

        expect(response.statusCode, response.body).toBe(StatusCodes.NOT_FOUND);
        expect(response.json()).toEqual({
          code: "PRODUCT_NOT_FOUND",
          message: "Product not found.",
          field: "id",
        });
      });
    });
  });
});

async function unusedPort(): Promise<number> {
  const server = createServer();

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Could not allocate a test port");
  }

  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });

  return address.port;
}

async function withRunningServer(
  databasePort: number,
  run: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const port = await unusedPort();
  const baseUrl = `http://127.0.0.1:${port}`;

  const child = spawn(
    process.execPath,
    [
      "--import",
      "tsx",
      "--import",
      "./src/instrumentation.mts",
      "src/index.ts",
    ],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_ENV: "test",
        HOST: "127.0.0.1",
        PORT: String(port),
        POSTGRES_PORT: String(databasePort),
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  let output = "";
  child.stdout.on("data", (chunk: Buffer) => {
    output += chunk.toString();
  });
  child.stderr.on("data", (chunk: Buffer) => {
    output += chunk.toString();
  });

  const stopped = new Promise<void>((resolve) => {
    child.once("exit", () => resolve());
  });

  try {
    let listening = false;

    for (let attempt = 0; attempt < 100; attempt++) {
      if (child.exitCode !== null) {
        throw new Error(`Server exited before listening:\n${output}`);
      }

      try {
        const response = await fetch(`${baseUrl}/health/live`, {
          signal: AbortSignal.timeout(300),
        });

        if (response.ok) {
          listening = true;
          break;
        }
      } catch {
        // The server may still be starting.
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    if (!listening) {
      throw new Error(`Server did not start:\n${output}`);
    }

    await run(baseUrl);
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGTERM");

      const timeout = setTimeout(() => {
        child.kill("SIGKILL");
      }, 5_000);

      try {
        await stopped;
      } finally {
        clearTimeout(timeout);
      }
    }
  }
}

describe("health checks", () => {
  beforeAll(async () => {
    await initConfig();
  });

  describe("Happy Path", () => {
    it("returns live and ready when the database is available", async () => {
      const databasePort = getConfig().get("database.port");

      await withRunningServer(databasePort, async (baseUrl) => {
        const live = await fetch(`${baseUrl}/health/live`);
        expect(live.status).toBe(StatusCodes.OK);
        expect(await live.json()).toEqual({ status: "ok" });

        const ready = await fetch(`${baseUrl}/health/ready`);
        expect(ready.status).toBe(StatusCodes.OK);
        expect(await ready.json()).toEqual({ status: "ok" });
      });
    }, 20_000);
  });

  describe("Sad Path", () => {
    it("stays live but returns 503 when the database is unavailable", async () => {
      const unavailableDatabasePort = await unusedPort();

      await withRunningServer(unavailableDatabasePort, async (baseUrl) => {
        const live = await fetch(`${baseUrl}/health/live`);
        expect(live.status).toBe(StatusCodes.OK);
        expect(await live.json()).toEqual({ status: "ok" });

        const ready = await fetch(`${baseUrl}/health/ready`);
        expect(ready.status).toBe(StatusCodes.SERVICE_UNAVAILABLE);

        const body = await ready.text();
        expect(JSON.parse(body)).toEqual({ status: "not_ready" });
        expect(body).not.toContain("Connection terminated");
      });
    }, 20_000);
  });
});

const ringXY: [number, number][] = [
  [34, 32],
  [35, 32],
  [35, 33],
  [34, 33],
  [34, 32],
];

const ringXYZ: [number, number, number][] = ringXY.map(
  ([longitude, latitude]) => [longitude, latitude, 25],
);

const cases: {
  name: string;
  geometry: BoundingPolygon;
}[] = [
  {
    name: "Polygon XY",
    geometry: { type: "Polygon", coordinates: [ringXY] },
  },
  {
    name: "Polygon XYZ",
    geometry: { type: "Polygon", coordinates: [ringXYZ] },
  },
  {
    name: "MultiPolygon XY",
    geometry: { type: "MultiPolygon", coordinates: [[ringXY]] },
  },
  {
    name: "MultiPolygon XYZ",
    geometry: { type: "MultiPolygon", coordinates: [[ringXYZ]] },
  },
];

describe("product footprint API", () => {
  describe("Happy Path", () => {
    it.each(cases)("stores and returns $name", ({ geometry }) =>
      withProductTest(async ({ app }) => {
        const requests = new ProductsRequestSender(app);
        const id = await storeProduct(
          app,
          makeProduct({ boundingPolygon: geometry }),
        );

        const response = await requests.getById(id);

        expect(response.statusCode, response.body).toBe(StatusCodes.OK);
        expect(response.json<Product>().boundingPolygon).toEqual(geometry);
      }),
    );
  });

  describe("Bad Path", () => {
    it("rejects Point geometry", () =>
      withProductTest(async ({ app }) => {
        const requests = new ProductsRequestSender(app);
        const response = await requests.create({
          ...makeProduct(),
          boundingPolygon: { type: "Point", coordinates: [34, 32] },
        });

        expect(response.statusCode, response.body).toBe(
          StatusCodes.BAD_REQUEST,
        );
      }));
  });
});

async function search(
  app: FastifyInstance,
  filters: SearchProductsInput,
  offset = 0,
  limit = 20,
): Promise<ProductsPage> {
  const response = await new ProductsRequestSender(app).search(
    filters,
    limit,
    offset,
  );

  expect(response.statusCode, response.body).toBe(StatusCodes.OK);
  return response.json<ProductsPage>();
}

const spatialMatches = {
  contains: ["outer"],
  within: ["inner"],
  intersects: ["inner", "outer", "overlap", "touch"],
} as const;

describe("product search", () => {
  describe("Happy Path", () => {
    it.each(["contains", "within", "intersects"] as const)(
      "%s uses the correct direction and boundary behavior",
      async (operator) => {
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

          expect(page.items.map((product) => product.id).sort()).toEqual(
            spatialMatches[operator].map((label) => ids.get(label)).sort(),
          );
          expect(page.hasMore).toBe(false);
        });
      },
    );

    it("combines equality and numeric conditions with AND", async () => {
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

        expect(page.items.map((product) => product.id)).toEqual([expected]);
      });
    });

    it("returns ordered search pages and an empty final page", async () => {
      await withProductTest(async ({ app }) => {
        const name = makeProduct().name;
        const ids: string[] = [];

        for (let i = 0; i < 3; i++) {
          ids.push(await storeProduct(app, makeProduct({ name })));
        }

        ids.sort();

        for (const offset of [0, 2, 3]) {
          const page = await search(app, { equal: { name } }, offset, 2);

          expect(page.items.map((product) => product.id)).toEqual(
            ids.slice(offset, offset + 2),
          );
          expect(page.limit).toBe(2);
          expect(page.offset).toBe(offset);
          expect(page.hasMore).toBe(offset + 2 < ids.length);
        }

        const noMatches = await search(app, {
          equal: { name },
          greater: { resolutionBest: 99 },
        });

        expect(noMatches.items).toEqual([]);
        expect(noMatches.hasMore).toBe(false);
      });
    });

    it("lists pages matching the database snapshot", async () => {
      await withProductTest(async ({ app, client }) => {
        const requests = new ProductsRequestSender(app);
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
        const count = countResult.rows[0]?.count;
        if (count === undefined) {
          throw new Error("Product count query returned no row");
        }

        for (const offset of [0, 2, count]) {
          const response = await requests.list(2, offset);

          expect(response.statusCode, response.body).toBe(StatusCodes.OK);

          const page = response.json<ProductsPage>();

          expect(page.items.map((product) => product.id)).toEqual(
            offset === count ? [] : expected.slice(offset, offset + 2),
          );
          expect(page.limit).toBe(2);
          expect(page.offset).toBe(offset);
          expect(page.hasMore).toBe(offset + 2 < count);
        }
      });
    });
  });
});

describe("product request validation", () => {
  let app: FastifyInstance;
  let requests: ProductsRequestSender;
  let pool: Pool;
  const names = new Set<string>();

  beforeAll(async () => {
    await initConfig();
    const built = await buildApp({ logger: false });
    app = built.app;
    requests = new ProductsRequestSender(app);
    pool = built.container.resolve<Pool>(SERVICES.POOL);
  });

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
    const response = await requests.create(input);

    expect(response.statusCode, response.body).toBe(StatusCodes.CREATED);

    const { id } = response.json<{ id: string }>();
    expect(id).toEqual(expect.any(String));
    expect(response.json()).toEqual({ id });

    return id;
  }

  function expectValidationError(response: {
    statusCode: number;
    body: string;
  }) {
    expect(response.statusCode, response.body).toBe(StatusCodes.BAD_REQUEST);

    const body = JSON.parse(response.body) as {
      code: string;
      message: string;
    };

    expect(body.code).toBe("VALIDATION_ERROR");

    return body;
  }

  afterAll(async () => {
    try {
      if (pool !== undefined && names.size > 0) {
        await pool.query(
          "DELETE FROM public.products WHERE name = ANY($1::text[])",
          [[...names]],
        );
      }
    } finally {
      await app?.close();
    }
  });

  describe("Happy Path", () => {
    it("stores minZoom zero on POST", async () => {
      const input = { ...makeInput(), minZoom: 0 };
      const id = await store(input);

      const response = await requests.getById(id);

      expect(response.statusCode, response.body).toBe(StatusCodes.OK);
      expect(response.json<Product>().minZoom).toBe(0);
    });

    it("stores minZoom zero on PATCH and preserves omitted fields", async () => {
      const input = makeInput();
      const id = await store(input);

      const update = await requests.update(id, { minZoom: 0 });

      expect(update.statusCode, update.body).toBe(StatusCodes.OK);

      const retrieval = await requests.getById(id);

      expect(retrieval.statusCode, retrieval.body).toBe(StatusCodes.OK);

      const product = retrieval.json<Product>();

      expect(product.minZoom).toBe(0);
      expect(product.maxZoom).toBe(input.maxZoom);
      expect(product.name).toBe(input.name);
      expect(product.boundingPolygon).toEqual(input.boundingPolygon);
    });
  });

  describe("Bad Path", () => {
    it.each([
      ["POST", "minZoom"],
      ["PATCH", "minZoom"],
      ["POST", "maxZoom"],
      ["PATCH", "maxZoom"],
    ] as const)(
      "%s returns 400 for %s storage overflow",
      async (method, field) => {
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

        const response =
          id === undefined
            ? await requests.create(payload)
            : await requests.update(id, payload);

        const error = expectValidationError(response);

        expect(error.message).toBe(
          "A numeric value is outside the supported storage range.",
        );

        if (id !== undefined) {
          const retrieval = await requests.getById(id);

          expect(retrieval.statusCode, retrieval.body).toBe(StatusCodes.OK);

          const product = retrieval.json<Product>();
          expect(product.minZoom).toBe(input.minZoom);
          expect(product.maxZoom).toBe(input.maxZoom);
        }
      },
    );

    it.each([
      ["create", "Polygon"],
      ["update", "Polygon"],
      ["search", "Polygon"],
      ["create", "MultiPolygon"],
      ["update", "MultiPolygon"],
      ["search", "MultiPolygon"],
    ] as const)("%s rejects extra %s properties", async (operation, kind) => {
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

        const response =
          operation === "create"
            ? await requests.create(payload)
            : id !== undefined
              ? await requests.update(id, payload)
              : await requests.search(payload, 20, 0);

        expectValidationError(response);
      }

      if (id !== undefined) {
        const retrieval = await requests.getById(id);

        expect(retrieval.statusCode, retrieval.body).toBe(StatusCodes.OK);

        expect(retrieval.json<Product>().boundingPolygon).toEqual(
          input.boundingPolygon,
        );
      }
    });

    it.each(["create", "update-both", "update-min", "update-max"] as const)(
      "%s rejects invalid resulting zoom order",
      async (operation) => {
        const input = { ...makeInput(), minZoom: 5 };

        const id = operation === "create" ? undefined : await store(input);

        const payload =
          operation === "create"
            ? { ...input, minZoom: 19 }
            : operation === "update-both"
              ? { minZoom: 19, maxZoom: 18 }
              : operation === "update-min"
                ? { minZoom: 19 }
                : { maxZoom: 4 };

        const response =
          id === undefined
            ? await requests.create(payload)
            : await requests.update(id, payload);

        const error = expectValidationError(response);
        expect(error.message).toBe("minZoom must not exceed maxZoom.");

        if (id !== undefined) {
          const retrieval = await requests.getById(id);

          expect(retrieval.statusCode, retrieval.body).toBe(StatusCodes.OK);

          expect(retrieval.json<Product>()).toEqual({ ...input, id });
        }
      },
    );

    it.each(["POST", "PATCH"] as const)(
      "%s rejects unsupported request media types",
      async (method) => {
        const headers = { "content-type": "text/plain" };
        const response =
          method === "POST"
            ? await requests.create("not JSON", headers)
            : await requests.update(randomUUID(), "not JSON", headers);

        expect(response.statusCode, response.body).toBe(
          StatusCodes.UNSUPPORTED_MEDIA_TYPE,
        );
        expect(response.json<{ code: string }>().code).toBe(
          "UNSUPPORTED_MEDIA_TYPE",
        );
      },
    );
  });
});
