import assert from "node:assert/strict";
import { test } from "node:test";
import type { Pool } from "pg";
import { buildApp } from "../../src/app.js";
import { SERVICES } from "../../src/common/constants.js";

process.env.POSTGRES_USER ??= "unit-test";
process.env.POSTGRES_PASSWORD ??= "unit-test-only";

test("dependencies are shared within an app and isolated across apps", async () => {
  const first = await buildApp({ logger: false });
  const second = await buildApp({ logger: false });

  try {
    const firstPool = first.container.resolve<Pool>(SERVICES.POOL);
    const secondPool = second.container.resolve<Pool>(SERVICES.POOL);

    assert.equal(firstPool, first.container.resolve(SERVICES.POOL));
    assert.notEqual(firstPool, secondPool);

    assert.equal(
      first.container.resolve(SERVICES.PRODUCTS_REPOSITORY),
      first.container.resolve(SERVICES.PRODUCTS_REPOSITORY),
    );

    assert.notEqual(
      first.container.resolve(SERVICES.DATABASE),
      second.container.resolve(SERVICES.DATABASE),
    );

    await first.app.close();

    const response = await second.app.inject({
      method: "GET",
      url: "/health/live",
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { status: "ok" });
  } finally {
    await first.app.close();
    await second.app.close();
  }
});

test("liveness does not call database readiness", async () => {
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

    assert.equal(response.statusCode, 200);
    assert.equal(calls, 0);
  } finally {
    await app.close();
  }
});

test("readiness uses the injected check and returns 200", async () => {
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

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { status: "ok" });
    assert.equal(calls, 1);
  } finally {
    await app.close();
  }
});

test("readiness failure returns 503 without database details", async () => {
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

    assert.equal(response.statusCode, 503);
    assert.deepEqual(response.json(), { status: "not_ready" });
    assert.doesNotMatch(response.body, /private database error/);
  } finally {
    await app.close();
  }
});

test("closing an app ends its pool and removes its error listener", async () => {
  const { app, container } = await buildApp({ logger: false });
  const pool = container.resolve<Pool>(SERVICES.POOL);

  let ended = false;
  const end = pool.end.bind(pool);

  pool.end = async () => {
    ended = true;
    await end();
  };

  assert.equal(pool.listenerCount("error"), 1);

  await app.close();

  assert.equal(ended, true);
  assert.equal(pool.listenerCount("error"), 0);
});
