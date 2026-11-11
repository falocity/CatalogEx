import { EventEmitter } from 'node:events';
import type { CleanupRegistry } from '@map-colonies/cleanup-registry';
import { jsLogger } from '@map-colonies/js-logger';
import { describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../src/app.js';
import { SERVICES } from '../../src/common/constants.js';
import { stopTracing } from '../../src/common/tracing.js';

vi.mock('../../src/common/config.js', () => ({
  getConfig: () => ({
    get: (key: string): unknown => {
      const values: Record<string, unknown> = {
        'server.shutdownTimeoutMs': 1000,
        'telemetry.logger': { level: 'silent', prettyPrint: false },
        'telemetry.shared.serviceName': 'catalogex-registration-test',
      };

      return values[key];
    },
    initializeMetrics: vi.fn(),
  }),
}));

vi.mock('../../src/common/tracing.js', () => ({
  stopTracing: vi.fn(async () => {}),
}));

function createPoolDouble() {
  return Object.assign(new EventEmitter(), {
    end: vi.fn(async () => {}),
  });
}

describe('application dependency registration', () => {
  it('should honor overrides and server options and close the pool once during application cleanup.', async () => {
    const pool = createPoolDouble();
    const logger = await jsLogger({ enabled: false });

    const { app, container } = await buildApp(
      { bodyLimit: 16 },
      {
        override: [
          { token: SERVICES.POOL, provider: { useValue: pool } },
          { token: SERVICES.LOGGER, provider: { useValue: logger } },
        ],
      }
    );

    try {
      expect(container.resolve(SERVICES.APPLICATION)).toBe(app);
      expect(container.resolve(SERVICES.LOGGER)).toBe(logger);

      app.post('/registration-check', async () => Promise.resolve({ ok: true }));

      const response = await app.inject({
        method: 'POST',
        url: '/registration-check',
        payload: { value: 'x'.repeat(32) },
      });

      expect(response.statusCode).toBe(413);

      await container.resolve<CleanupRegistry>(SERVICES.CLEANUP_REGISTRY).trigger();

      expect(pool.end).toHaveBeenCalledOnce();
    } finally {
      await app.close();
    }

    expect(pool.end).toHaveBeenCalledOnce();
  });

  it('should close an acquired pool and preserve the error when application creation fails.', async () => {
    const pool = createPoolDouble();
    const logger = await jsLogger({ enabled: false });
    const error = new Error('application construction failed');

    await expect(
      buildApp(
        {},
        {
          override: [
            { token: SERVICES.POOL, provider: { useValue: pool } },
            { token: SERVICES.LOGGER, provider: { useValue: logger } },
            {
              token: SERVICES.APPLICATION,
              provider: {
                useFactory: () => {
                  throw error;
                },
              },
            },
          ],
        }
      )
    ).rejects.toBe(error);

    expect(pool.end).toHaveBeenCalledOnce();
  });

  it('should stop preloaded tracing when logger initialization fails before registry creation.', async () => {
    vi.mocked(stopTracing).mockClear();

    const error = new Error('logger initialization failed');

    await expect(
      buildApp(
        {},
        {
          override: [
            {
              token: SERVICES.LOGGER,
              provider: {
                useFactory: async () => Promise.reject(error),
              },
            },
          ],
        }
      )
    ).rejects.toBe(error);

    expect(stopTracing).toHaveBeenCalledOnce();
  });

  it('should resolve the asynchronous logger before constructing Fastify.', async () => {
    const pool = createPoolDouble();

    const { app, container } = await buildApp(
      {},
      {
        override: [{ token: SERVICES.POOL, provider: { useValue: pool } }],
      }
    );

    try {
      expect(container.resolve(SERVICES.LOGGER)).not.toBeInstanceOf(Promise);

      const response = await app.inject({
        method: 'GET',
        url: '/registration-check',
      });

      expect(response.statusCode).toBe(404);

      await container.resolve<CleanupRegistry>(SERVICES.CLEANUP_REGISTRY).trigger();

      expect(pool.end).toHaveBeenCalledOnce();
    } finally {
      await app.close();
    }
  });
});
