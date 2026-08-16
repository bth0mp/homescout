import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";

const DB_PATH = resolve(process.env.DATABASE_PATH ?? "./data/homescout.db");

function open() {
  mkdirSync(dirname(DB_PATH), { recursive: true });
  const sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const database = drizzle(sqlite, { schema });
  migrate(database, { migrationsFolder: resolve("./drizzle") });
  return database;
}

// ponytail: cached on globalThis so Next's dev HMR doesn't open a new handle per reload.
const g = globalThis as { __homescoutDb?: ReturnType<typeof open> };
export const db = (g.__homescoutDb ??= open());

export { schema };
