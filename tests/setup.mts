process.env.NODE_ENV = "test";
process.env.POSTGRES_USER ??= "unit-test";
process.env.POSTGRES_PASSWORD ??= "unit-test-only";

const { initConfig } = await import("../src/common/config.js");
await initConfig();
