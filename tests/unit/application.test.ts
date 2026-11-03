import type { Pool } from "pg";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { buildApp } from "../../src/app.js";
import { initConfig } from "../../src/common/config.js";
import { SERVICES } from "../../src/common/constants.js";

describe("application lifecycle", () => {
  beforeAll(async () => {
    await initConfig();
  });

  it("shares dependencies within an app and isolates separate apps", async () => {
    const first = await buildApp({ logger: false });
    const second = await buildApp({ logger: false });

    try {
      const firstPool = first.container.resolve<Pool>(SERVICES.POOL);
      const secondPool = second.container.resolve<Pool>(SERVICES.POOL);

      expect(firstPool).toBe(first.container.resolve(SERVICES.POOL));
      expect(firstPool).not.toBe(secondPool);

      expect(first.container.resolve(SERVICES.DATABASE)).not.toBe(
        second.container.resolve(SERVICES.DATABASE),
      );

      await first.app.close();

      const response = await second.app.inject({
        method: "GET",
        url: "/health/live",
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ status: "ok" });
    } finally {
      await first.app.close();
      await second.app.close();
    }
  });

  it("does not call database readiness for liveness", async () => {
    let calls = 0;

    const { app } = await buildApp(
      { logger: false },
      {
        override: [
          {
            token: SERVICES.DATABASE_READINESS,
            provider: {
              useValue: async () => {
                calls++;
                throw new Error("unavailable");
              },
            },
          },
        ],
      },
    );

    try {
      const response = await app.inject({
        method: "GET",
        url: "/health/live",
      });

      expect(response.statusCode).toBe(200);
      expect(calls).toBe(0);
    } finally {
      await app.close();
    }
  });

  it("uses the injected readiness check and returns 200", async () => {
    let calls = 0;

    const { app } = await buildApp(
      { logger: false },
      {
        override: [
          {
            token: SERVICES.DATABASE_READINESS,
            provider: {
              useValue: async () => {
                calls++;
              },
            },
          },
        ],
      },
    );

    try {
      const response = await app.inject({
        method: "GET",
        url: "/health/ready",
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ status: "ok" });
      expect(calls).toBe(1);
    } finally {
      await app.close();
    }
  });

  it("returns 503 without database details on readiness failure", async () => {
    const { app } = await buildApp(
      { logger: false },
      {
        override: [
          {
            token: SERVICES.DATABASE_READINESS,
            provider: {
              useValue: async () => {
                throw new Error("private database error");
              },
            },
          },
        ],
      },
    );

    try {
      const response = await app.inject({
        method: "GET",
        url: "/health/ready",
      });

      expect(response.statusCode).toBe(503);
      expect(response.json()).toEqual({ status: "not_ready" });
      expect(response.body).not.toMatch(/private database error/);
    } finally {
      await app.close();
    }
  });
  it("returns a generic 500 without exposing an unexpected error", async () => {
    const { app } = await buildApp({ logger: false });

    app.get("/test/unexpected-error", async () => {
      throw new Error("private failure detail");
    });

    try {
      const response = await app.inject({
        method: "GET",
        url: "/test/unexpected-error",
      });

      expect(response.statusCode).toBe(500);
      expect(response.json()).toEqual({
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred.",
      });
      expect(response.body).not.toContain("private failure detail");
    } finally {
      await app.close();
    }
  });

  it("returns a 413 response for an oversized JSON request", async () => {
    const { app } = await buildApp({ logger: false, bodyLimit: 32 });

    try {
      const response = await app.inject({
        method: "POST",
        url: "/products",
        payload: { name: "x".repeat(100) },
      });

      expect(response.statusCode).toBe(413);
      expect(response.json()).toEqual({
        code: "PAYLOAD_TOO_LARGE",
        message: "Request body is too large.",
      });
    } finally {
      await app.close();
    }
  });

  it("ends the pool and removes its error listener on close", async () => {
    const { app, container } = await buildApp({ logger: false });
    const pool = container.resolve<Pool>(SERVICES.POOL);
    const end = vi.spyOn(pool, "end");

    expect(pool.listenerCount("error")).toBe(1);

    await app.close();

    expect(end).toHaveBeenCalledOnce();
    expect(pool.listenerCount("error")).toBe(0);
  });
});
