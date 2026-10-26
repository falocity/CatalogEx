import { defineConfig } from "drizzle-kit";
import { getConfig } from "./src/config.js";

const database = getConfig().database;

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    host: database.host,
    port: database.port,
    user: database.user,
    password: database.password,
    database: database.database,
  },
});
