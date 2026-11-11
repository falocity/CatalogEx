import { describe, expect, it, vi } from 'vitest';

const tracingSpies = vi.hoisted(() => ({
  constructor: vi.fn(),
  stop: vi.fn(async () => {}),
}));

vi.mock('@map-colonies/tracing', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention -- Mirrors the package export name.
  Tracing: class {
    public constructor(options: unknown) {
      tracingSpies.constructor(options);
    }

    public async stop(): Promise<void> {
      await tracingSpies.stop();
    }
  },
}));

describe('tracing lifecycle', () => {
  it('should reject access to tracing before initialization.', async () => {
    vi.resetModules();

    const { getTracing, stopTracing } = await import('../../src/common/tracing.js');

    expect(() => getTracing()).toThrow('Tracing has not been initialized');
    await expect(stopTracing()).resolves.toBeUndefined();
  });

  it('should configure tracing and stop it during cleanup.', async () => {
    vi.resetModules();
    tracingSpies.constructor.mockClear();
    tracingSpies.stop.mockClear();

    const { tracingFactory, getTracing, stopTracing } = await import('../../src/common/tracing.js');

    const tracing = tracingFactory({});

    expect(tracingSpies.constructor).toHaveBeenCalledWith({
      autoInstrumentationsConfigMap: {
        '@opentelemetry/instrumentation-fs': {
          requireParentSpan: true,
        },
      },
    });
    expect(getTracing()).toBe(tracing);

    await stopTracing();

    expect(tracingSpies.stop).toHaveBeenCalledOnce();
  });
});
