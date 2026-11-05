import { migrate } from "drizzle-orm/node-postgres/migrator";
import { getConfig, initConfig } from "../common/config.js";
import { createDatabase, createPool } from "./client.js";

await initConfig();
const pool = createPool(getConfig());

try {
  await migrate(createDatabase(pool), {
    migrationsFolder: "./drizzle",
  });

  console.log("Database migrations are up to date.");
} finally {
  await pool.end();
}
