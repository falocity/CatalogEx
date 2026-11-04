import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    reporters: ["verbose"],
    projects: [
      {
        test: {
          name: "unit",
          environment: "node",
          setupFiles: ["./tests/setup.mts"],
          include: ["tests/unit/**/*.spec.ts"],
        },
      },
      {
        test: {
          name: "integration",
          environment: "node",
          setupFiles: ["./tests/setup.mts"],
          include: ["tests/integration/**/*.spec.ts"],
        },
      },
    ],
    coverage: {
      enabled: true,
      provider: "v8",
      reporter: ["text", "html", "json", "json-summary"],
      include: ["src/**/*.{ts,mts}"],
      exclude: [
        "src/index.ts",
        "src/instrumentation.mts",
        "src/db/migrate.ts",
        "**/*.test.ts",
      ],
      reportOnFailure: true,
      thresholds: {
        global: {
          statements: 80,
          branches: 80,
          functions: 80,
          lines: 80,
        },
      },
    },
  },
});
