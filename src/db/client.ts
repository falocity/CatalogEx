import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { getConfig } from "../config.js";

export const pool = new Pool(getConfig().database);

export const db = drizzle({ client: pool });

export type Database = typeof db;
