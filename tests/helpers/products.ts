import { randomUUID } from 'node:crypto';
import { expect } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { PoolClient } from 'pg';
import { StatusCodes } from 'http-status-codes';
import { buildApp } from '../../src/app.js';
import { getConfig, initConfig } from '../../src/common/config.js';
import { SERVICES } from '../../src/common/constants.js';
import { createPool } from '../../src/db/client.js';
import type { BoundingPolygon } from '../../src/modules/products/schemas/fields.schema.js';
import type { CreateProduct, CreateProductResponse } from '../../src/modules/products/schemas/product.schema.js';
import { ProductsRequestSender } from './productsRequestSender.js';

export function rectangle(left: number, bottom: number, right: number, top: number): Extract<BoundingPolygon, { type: 'Polygon' }> {
  return {
    type: 'Polygon',
    coordinates: [
      [
        [left, bottom],
        [right, bottom],
        [right, top],
        [left, top],
        [left, bottom],
      ],
    ],
  };
}

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

export async function storeProduct(app: FastifyInstance, input: CreateProduct): Promise<string> {
  const response = await new ProductsRequestSender(app).create(input);
  expect(response.statusCode, response.body).toBe(StatusCodes.CREATED);

  const { id } = response.json<CreateProductResponse>();
  expect(id).toEqual(expect.any(String));
  expect(response.json()).toEqual({ id });

  return id;
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

export async function withProductTest(run: (context: { app: FastifyInstance; client: PoolClient }) => Promise<void>): Promise<void> {
  await initConfig();
  const config = getConfig();
  const pool = createPool(config);

  let client: PoolClient | undefined;
  let app: FastifyInstance | undefined;

  try {
    client = await pool.connect();
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ');

    ({ app } = await buildApp(
      { logger: false },
      {
        config,
        override: [
          {
            token: SERVICES.DATABASE,
            provider: { useValue: drizzle({ client }) },
          },
        ],
      }
    ));

    await run({ app, client });
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
