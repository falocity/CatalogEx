import { context, ROOT_CONTEXT, type Span } from '@opentelemetry/api';
import { RPCType, setRPCMetadata, type RPCMetadata } from '@opentelemetry/core';
import { fastify } from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerTraceRoute } from '../../src/common/traceRoute.js';

async function recordRoute(url: string): Promise<RPCMetadata> {
  const metadata: RPCMetadata = { type: RPCType.HTTP, span: {} as Span };
  vi.spyOn(context, 'active').mockReturnValue(setRPCMetadata(ROOT_CONTEXT, metadata));

  const app = fastify();
  registerTraceRoute(app);
  app.get('/products/:id', async () => Promise.resolve({}));

  try {
    await app.inject({ method: 'GET', url });
  } finally {
    await app.close();
  }

  return metadata;
}

describe('registerTraceRoute', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should record the route template for a matched request.', async () => {
    const metadata = await recordRoute('/products/0b9f5d3e-1c1a-4e5b-9d3c-2f6e7a8b9c0d');

    expect(metadata.route).toBe('/products/:id');
  });

  it('should leave the route unset for an unmatched request.', async () => {
    const metadata = await recordRoute('/unknown/path');

    expect(metadata.route).toBeUndefined();
  });

  it('should do nothing when no HTTP server span is active.', async () => {
    const app = fastify();
    registerTraceRoute(app);
    app.get('/products/:id', async () => Promise.resolve({}));

    try {
      const response = await app.inject({ method: 'GET', url: '/products/1' });

      expect(response.statusCode).toBe(200);
    } finally {
      await app.close();
    }
  });
});
