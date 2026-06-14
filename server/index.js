import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import session from "express-session";
import sqliteSessionStore from "better-sqlite3-session-store";
import { createApp } from "./app.js";
import { createDatabase } from "./database.js";

dotenv.config();

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number.parseInt(process.env.PORT, 10) || 9000;
const adminUsername = process.env.ADMIN_USERNAME;
const adminPassword = process.env.ADMIN_PASSWORD;
const sessionSecret = process.env.SESSION_SECRET;

if (!adminUsername || !adminPassword || !sessionSecret) {
  console.error("ADMIN_USERNAME、ADMIN_PASSWORD 和 SESSION_SECRET 必须配置");
  process.exit(1);
}

const db = createDatabase(process.env.DB_PATH || path.join(rootDir, "data", "short-link.db"));
const SqliteStore = sqliteSessionStore(session);
const sessionStore = new SqliteStore({
  client: db,
  expired: { clear: true, intervalMs: 15 * 60 * 1000 },
});
const app = createApp({
  db,
  adminUsername,
  adminPassword,
  sessionSecret,
  sessionStore,
  cookieSecure: process.env.SESSION_COOKIE_SECURE === "true",
  publicBaseUrl: (process.env.PUBLIC_BASE_URL || `http://localhost:${port}`).replace(/\/$/, ""),
  distDir: path.join(rootDir, "dist"),
  isProduction: process.env.NODE_ENV === "production",
});

app.listen(port, "0.0.0.0", () => {
  console.log(`ShortLink is running at http://localhost:${port}`);
});
