import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const JOURNAL_MODES = new Set(["DELETE", "TRUNCATE", "PERSIST", "MEMORY", "WAL", "OFF"]);

function backupWalSidecarFiles(filename) {
  const backupSuffix = `.bak-${Date.now()}`;
  for (const suffix of ["-wal", "-shm"]) {
    const sidecar = `${filename}${suffix}`;
    if (fs.existsSync(sidecar)) {
      fs.renameSync(sidecar, `${sidecar}${backupSuffix}`);
    }
  }
}

export function createDatabase(filename, options = {}) {
  const resolved = path.resolve(filename);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });

  const journalMode = String(options.journalMode || process.env.SQLITE_JOURNAL_MODE || "DELETE").toUpperCase();
  if (!JOURNAL_MODES.has(journalMode)) {
    throw new Error(`Unsupported SQLite journal mode: ${journalMode}`);
  }
  if (journalMode !== "WAL") {
    backupWalSidecarFiles(resolved);
  }

  const db = new Database(resolved);
  db.pragma(`journal_mode = ${journalMode}`);
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
