import { randomUUID } from 'node:crypto';
import { jsLogger } from '@map-colonies/js-logger';
import { expect } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { PoolClient } from 'pg';
import { StatusCodes } from 'http-status-codes';
import { buildApp } from '../../src/app.js';
import { getConfig, initConfig } from '../../src/common/config.js';
import { SERVICES } from '../../src/common/constants.js';
import { createPool } from '../../src/db/client.js';
import type { ProductsPage } from '../../src/modules/products/schemas/pagination.schema.js';
import type { CreateProduct, CreateProductResponse } from '../../src/modules/products/schemas/product.schema.js';
import type { SearchProductsInput } from '../../src/modules/products/schemas/search-products.schema.js';
import { rectangle } from './geometry.js';
import { ProductsRequestSender } from './productsRequestSender.js';

const validationBounds = { left: 34, bottom: 31, right: 35, top: 32 };
const searchPageLimit = 20;

export function makeProduct(overrides: Partial<CreateProduct> = {}): CreateProduct {
  return {
    name: `test-${randomUUID()}`,
    boundingPolygon: rectangle(0, 0, 1, 1),
    consumptionLink: 'https://example.com/wmts',
    productType: 'raster',
    consumptionProtocol: 'WMTS',
    resolutionBest: 1,
    minZoom: 0,
    maxZoom: 18,
    ...overrides,
  };
}

export function makeValidationInput(names: Set<string>): CreateProduct {
  const input = makeProduct({
    boundingPolygon: rectangle(validationBounds.left, validationBounds.bottom, validationBounds.right, validationBounds.top),
    resolutionBest: 0.5,
    minZoom: 1,
  });

  names.add(input.name);
  return input;
}

export async function storeProduct(requests: ProductsRequestSender, input: CreateProduct): Promise<string> {
  const response = await requests.create(input);
  expect(response.statusCode, response.body).toBe(StatusCodes.CREATED);

  const { id } = response.json<CreateProductResponse>();
  expect(id).toEqual(expect.any(String));
  expect(response.json()).toEqual({ id });

  return id;
}

export async function searchProducts(
  requests: ProductsRequestSender,
  filters: SearchProductsInput,
  offset = 0,
  limit = searchPageLimit
): Promise<ProductsPage> {
  const response = await requests.search(filters, limit, offset);

  expect(response.statusCode, response.body).toBe(StatusCodes.OK);
  return response.json<ProductsPage>();
}

export function expectValidationError(response: { statusCode: number; body: string }): { code: string; message: string } {
  expect(response.statusCode, response.body).toBe(StatusCodes.BAD_REQUEST);

  const body = JSON.parse(response.body) as {
    code: string;
    message: string;
  };

  expect(body.code).toBe('VALIDATION_ERROR');

  return body;
}

export async function withProductTest(run: (context: { requests: ProductsRequestSender; client: PoolClient }) => Promise<void>): Promise<void> {
  await initConfig();
  const config = getConfig();
  const pool = createPool(config);

  let client: PoolClient | undefined;
  let app: FastifyInstance | undefined;

  try {
    client = await pool.connect();
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ');

    ({ app } = await buildApp(
      {},
      {
        config,
        override: [
          {
            token: SERVICES.LOGGER,
            provider: { useValue: await jsLogger({ enabled: false }) },
          },
          {
            token: SERVICES.DATABASE,
            provider: { useValue: drizzle({ client }) },
          },
        ],
      }
    ));

    await run({ requests: new ProductsRequestSender(app), client });
  } finally {
    try {
      if (client) await client.query('ROLLBACK');
    } finally {
      client?.release();

      try {
        await app?.close();
      } finally {
        await pool.end();
      }
    }
  }
}
