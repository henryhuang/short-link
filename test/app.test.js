import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createApp } from "../server/app.js";
import { createDatabase } from "../server/database.js";

let db;
let app;
let tempDir;
let agent;

before(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "short-link-"));
  db = createDatabase(path.join(tempDir, "test.db"));
  app = createApp({
    db,
    adminUsername: "admin",
    adminPassword: "secret",
    sessionSecret: "test-session-secret",
    publicBaseUrl: "http://short.test",
  });
  agent = request.agent(app);
});

after(() => {
  db.close();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test("API requires authentication", async () => {
  const response = await request(app).get("/api/mappings");
  assert.equal(response.status, 401);
});

test("health endpoint checks database availability", async () => {
  const response = await request(app).get("/api/health");
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { status: "ok" });
});

test("secure session cookie works behind HTTPS proxy", async () => {
  const secureApp = createApp({
    db,
    adminUsername: "admin",
    adminPassword: "secret",
    sessionSecret: "secure-session-secret",
    publicBaseUrl: "https://short.test",
    cookieSecure: true,
  });
  const response = await request(secureApp)
    .post("/api/auth/login")
    .set("X-Forwarded-Proto", "https")
    .send({ username: "admin", password: "secret" });

  assert.equal(response.status, 200);
  assert.match(response.headers["set-cookie"][0], /;\s*Secure/i);

  const cookie = response.headers["set-cookie"][0].split(";")[0];
  const currentUser = await request(secureApp)
    .get("/api/auth/me")
    .set("X-Forwarded-Proto", "https")
    .set("Cookie", cookie);
  assert.equal(currentUser.status, 200);
  assert.deepEqual(currentUser.body, { user: { username: "admin" } });
});

test("production routes redirect home and serve admin only", async () => {
  const distDir = path.join(tempDir, "dist");
  fs.mkdirSync(distDir, { recursive: true });
  fs.writeFileSync(path.join(distDir, "index.html"), "<html>admin</html>");

  const productionApp = createApp({
    db,
    adminUsername: "admin",
    adminPassword: "secret",
    sessionSecret: "production-session-secret",
    publicBaseUrl: "https://l.cnhalo.com",
    distDir,
    isProduction: true,
  });

  const home = await request(productionApp).get("/");
  assert.equal(home.status, 302);
  assert.equal(home.headers.location, "https://cnhalo.com");

  const admin = await request(productionApp).get("/admin");
  assert.equal(admin.status, 200);
  assert.match(admin.text, /admin/);

  const unknown = await request(productionApp).get("/not-an-admin-route");
  assert.equal(unknown.status, 404);
});

test("admin can login and manage a mapping", async () => {
  const login = await agent
    .post("/api/auth/login")
    .send({ username: "admin", password: "secret" });
  assert.equal(login.status, 200);

  const created = await agent.post("/api/mappings").send({
    code: "docs",
    targetUrl: "https://example.com/docs",
    enabled: true,
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.shortUrl, "http://short.test/r/docs");

  const list = await agent.get("/api/mappings?search=docs");
  assert.equal(list.status, 200);
  assert.equal(list.body.total, 1);

  const updated = await agent.put(`/api/mappings/${created.body.id}`).send({
    code: "docs",
    targetUrl: "https://example.com/new-docs",
    enabled: false,
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.enabled, false);
});

test("enabled short link redirects and tracks visits", async () => {
  const created = await agent.post("/api/mappings").send({
    code: "home",
    targetUrl: "https://example.com/",
    enabled: true,
  });
  const redirect = await request(app).get("/r/home");
  assert.equal(redirect.status, 302);
  assert.equal(redirect.headers.location, "https://example.com/");

  const list = await agent.get("/api/mappings?search=home");
  assert.equal(list.body.items[0].visits, 1);

  await agent.put(`/api/mappings/${created.body.id}`).send({
    code: "home",
    targetUrl: "https://example.com/",
    enabled: false,
  });
  const disabled = await request(app).get("/r/home");
  assert.equal(disabled.status, 404);
});

test("duplicate codes are rejected case-insensitively", async () => {
  const response = await agent.post("/api/mappings").send({
    code: "HOME",
    targetUrl: "https://example.org/",
    enabled: true,
  });
  assert.equal(response.status, 409);
});
