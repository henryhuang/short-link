import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

export function createDatabase(filename) {
  const resolved = path.resolve(filename);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });

  const db = new Database(resolved);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS mappings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE COLLATE NOCASE,
      target_url TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
      visits INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_mappings_enabled ON mappings(enabled);
    CREATE INDEX IF NOT EXISTS idx_mappings_updated_at ON mappings(updated_at DESC);
  `);

  return db;
}
