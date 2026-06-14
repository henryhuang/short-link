import crypto from "node:crypto";
import path from "node:path";
import express from "express";
import session from "express-session";

const CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{2,31}$/;

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  if (leftBuffer.length !== rightBuffer.length) {
    crypto.timingSafeEqual(leftBuffer, leftBuffer);
    return false;
  }
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function normalizeMapping(row, publicBaseUrl) {
  return {
    id: row.id,
    code: row.code,
    targetUrl: row.target_url,
    enabled: Boolean(row.enabled),
    visits: row.visits,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    shortUrl: `${publicBaseUrl}/r/${encodeURIComponent(row.code)}`,
  };
}

function validateMapping(body) {
  const code = String(body.code || "").trim();
  const targetUrl = String(body.targetUrl || "").trim();
  if (!CODE_PATTERN.test(code)) {
    return { error: "短码需为 3–32 个字符，并以字母或数字开头" };
  }
  let url;
  try {
    url = new URL(targetUrl);
  } catch {
    return { error: "请输入有效的目标地址" };
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    return { error: "目标地址仅支持 http:// 或 https://" };
  }
  return { code, targetUrl: url.toString(), enabled: body.enabled !== false };
}

export function createApp({
  db,
  adminUsername,
  adminPassword,
  sessionSecret,
  publicBaseUrl,
  sessionStore,
  distDir = path.resolve("dist"),
  isProduction = false,
}) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "32kb" }));
  app.use(
    session({
      name: "shortlink.sid",
      store: sessionStore,
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: isProduction,
        maxAge: 8 * 60 * 60 * 1000,
      },
    }),
  );

  const requireAuth = (req, res, next) => {
    if (!req.session.user) {
      return res.status(401).json({ message: "请先登录" });
    }
    next();
  };

  app.get("/api/health", (_req, res) => {
    db.prepare("SELECT 1").get();
    res.json({ status: "ok" });
  });

  app.post("/api/auth/login", (req, res) => {
    const username = String(req.body.username || "");
    const password = String(req.body.password || "");
    if (!safeEqual(username, adminUsername) || !safeEqual(password, adminPassword)) {
      return res.status(401).json({ message: "用户名或密码错误" });
    }
    req.session.regenerate((error) => {
      if (error) return res.status(500).json({ message: "登录失败，请重试" });
      req.session.user = { username: adminUsername };
      res.json({ user: req.session.user });
    });
  });

  app.get("/api/auth/me", (req, res) => {
    if (!req.session.user) return res.status(401).json({ message: "未登录" });
    res.json({ user: req.session.user });
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {
      res.clearCookie("shortlink.sid");
      res.json({ ok: true });
    });
  });

  app.get("/api/config", requireAuth, (_req, res) => {
    res.json({ publicBaseUrl });
  });

  app.get("/api/stats", requireAuth, (_req, res) => {
    const result = db
      .prepare(`
        SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN enabled = 1 THEN 1 ELSE 0 END) AS enabled,
          SUM(CASE WHEN enabled = 0 THEN 1 ELSE 0 END) AS disabled,
          COALESCE(SUM(visits), 0) AS visits
        FROM mappings
      `)
      .get();
    res.json({
      total: result.total,
      enabled: result.enabled || 0,
      disabled: result.disabled || 0,
      visits: result.visits,
    });
  });

  app.get("/api/mappings", requireAuth, (req, res) => {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(req.query.pageSize, 10) || 10));
    const search = String(req.query.search || "").trim();
    const status = ["enabled", "disabled"].includes(req.query.status) ? req.query.status : "all";
    const conditions = [];
    const params = {};

    if (search) {
      conditions.push("(code LIKE @search OR target_url LIKE @search)");
      params.search = `%${search}%`;
    }
    if (status !== "all") {
      conditions.push("enabled = @enabled");
      params.enabled = status === "enabled" ? 1 : 0;
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const total = db.prepare(`SELECT COUNT(*) AS count FROM mappings ${where}`).get(params).count;
    const items = db
      .prepare(`
        SELECT * FROM mappings
        ${where}
        ORDER BY updated_at DESC, id DESC
        LIMIT @limit OFFSET @offset
      `)
      .all({ ...params, limit: pageSize, offset: (page - 1) * pageSize })
      .map((row) => normalizeMapping(row, publicBaseUrl));
    res.json({ items, total, page, pageSize });
  });

  app.post("/api/mappings", requireAuth, (req, res) => {
    const values = validateMapping(req.body);
    if (values.error) return res.status(400).json({ message: values.error });
    try {
      const result = db
        .prepare("INSERT INTO mappings (code, target_url, enabled) VALUES (?, ?, ?)")
        .run(values.code, values.targetUrl, values.enabled ? 1 : 0);
      const row = db.prepare("SELECT * FROM mappings WHERE id = ?").get(result.lastInsertRowid);
      res.status(201).json(normalizeMapping(row, publicBaseUrl));
    } catch (error) {
      if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
        return res.status(409).json({ message: "该短码已存在" });
      }
      throw error;
    }
  });

  app.put("/api/mappings/:id", requireAuth, (req, res) => {
    const values = validateMapping(req.body);
    if (values.error) return res.status(400).json({ message: values.error });
    try {
      const result = db
        .prepare(`
          UPDATE mappings
          SET code = ?, target_url = ?, enabled = ?, updated_at = datetime('now')
          WHERE id = ?
        `)
        .run(values.code, values.targetUrl, values.enabled ? 1 : 0, req.params.id);
      if (!result.changes) return res.status(404).json({ message: "Mapping 不存在" });
      const row = db.prepare("SELECT * FROM mappings WHERE id = ?").get(req.params.id);
      res.json(normalizeMapping(row, publicBaseUrl));
    } catch (error) {
      if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
        return res.status(409).json({ message: "该短码已存在" });
      }
      throw error;
    }
  });

  app.delete("/api/mappings/:id", requireAuth, (req, res) => {
    const result = db.prepare("DELETE FROM mappings WHERE id = ?").run(req.params.id);
    if (!result.changes) return res.status(404).json({ message: "Mapping 不存在" });
    res.json({ ok: true });
  });

  app.get("/r/:code", (req, res) => {
    const row = db
      .prepare("SELECT id, target_url FROM mappings WHERE code = ? AND enabled = 1")
      .get(req.params.code);
    if (!row) return res.status(404).send("Short link not found");
    db.prepare("UPDATE mappings SET visits = visits + 1 WHERE id = ?").run(row.id);
    res.redirect(302, row.target_url);
  });

  if (isProduction) {
    app.use(express.static(distDir));
    app.get("/{*path}", (_req, res) => res.sendFile(path.join(distDir, "index.html")));
  }

  app.use((error, _req, res, _next) => {
    console.error(error);
    res.status(500).json({ message: "服务器内部错误" });
  });

  return app;
}
