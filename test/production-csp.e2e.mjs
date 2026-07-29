import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { chromium } from "playwright";
import { createSecurityHeadersMiddleware } from "../server/security-headers.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distPath = path.join(projectRoot, "dist");
const indexPath = path.join(distPath, "index.html");

if (!existsSync(indexPath)) {
  throw new Error("Production CSP E2E requires a production build. Run npm run build first.");
}

const app = express();
app.disable("x-powered-by");
app.use(createSecurityHeadersMiddleware());
app.get(["/api/v1/me", "/api/me"], (_request, response) => {
  response.status(401).json({
    error: { code: "AUTH_REQUIRED", message: "Authentication required." },
  });
});
app.get(["/api/v1/auth/providers", "/api/auth/providers"], (_request, response) => {
  response.json({
    providers: {
      email: { ok: true, mode: "configured", missing: [], purpose: "Email/password sign-in" },
      google: { ok: false, mode: "disabled", missing: [], purpose: "Google OAuth" },
      sessionSecurity: { ok: true, mode: "configured", missing: [] },
    },
    inviteRequired: true,
  });
});
app.get(["/api/v1/storage", "/api/storage"], (_request, response) => {
  response.json({
    usedBytes: 0,
    objectCount: 0,
    objectStorage: "s3-compatible",
    plan: { storageLimitBytes: null, storageScope: "account" },
  });
});
app.use(express.static(distPath, { index: false }));
app.get("*splat", (_request, response) => response.sendFile(indexPath));

const server = app.listen(0, "127.0.0.1");
await new Promise((resolve, reject) => {
  server.once("listening", resolve);
  server.once("error", reject);
});

const address = server.address();
assert.ok(address && typeof address === "object");
const baseUrl = `http://127.0.0.1:${address.port}`;
let browser;

try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  const consoleViolations = [];
  const pageErrors = [];

  page.on("console", (message) => {
    const text = message.text();
    if (/content security policy|refused to (?:load|execute|apply|connect)/i.test(text)) {
      consoleViolations.push(text);
    }
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.addInitScript(() => {
    window.__rivtCspViolations = [];
    document.addEventListener("securitypolicyviolation", (event) => {
      window.__rivtCspViolations.push({
        blockedURI: event.blockedURI,
        effectiveDirective: event.effectiveDirective,
      });
    });
  });

  const response = await page.goto(baseUrl, { waitUntil: "networkidle" });
  assert.ok(response);
  const policy = response.headers()["content-security-policy"] ?? "";
  assert.match(policy, /default-src 'self'/);
  assert.match(policy, /frame-ancestors 'none'/);
  assert.equal(response.headers()["x-frame-options"], "DENY");
  assert.equal(response.headers()["x-content-type-options"], "nosniff");

  await page.waitForFunction(() => document.documentElement.classList.contains("rivt-app-ready"));
  await page.getByRole("heading", { name: "Work, proof, and trade community in one place." }).waitFor();
  const browserViolations = await page.evaluate(() => window.__rivtCspViolations);

  assert.deepEqual(browserViolations, []);
  assert.deepEqual(consoleViolations, []);
  assert.deepEqual(pageErrors, []);
  console.log("Production CSP browser E2E passed.");
  await context.close();
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
