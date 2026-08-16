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

  const database = drizzle(sqlite, { schema });

  // Migrations must run with foreign keys OFF. Drizzle wraps the whole
  // migration in BEGIN/COMMIT, and PRAGMA foreign_keys is a no-op inside a
  // transaction — so any future migration that rebuilds a table (SQLite's
  // create-copy-drop-rename dance) would cascade-delete every scenario and
  // share link when the old table is dropped.
  sqlite.pragma("foreign_keys = OFF");
  migrate(database, { migrationsFolder: resolve("./drizzle") });
  sqlite.pragma("foreign_keys = ON");

  return database;
}

// ponytail: lazy, NOT a module-level const. Next evaluates route modules during
// `next build` (collectSegments), so a module-scope open() would create and
// migrate a database inside the build image, and would do it from several
// parallel build workers at once. Nothing here touches disk until a request
// actually asks for it. Cached on globalThis so dev HMR reuses one handle.
const g = globalThis as { __homescoutDb?: ReturnType<typeof open> };

export function getDb() {
  return (g.__homescoutDb ??= open());
}

export { schema };
