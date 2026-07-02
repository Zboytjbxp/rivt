import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const port = 5187;
const baseUrl = `http://127.0.0.1:${port}`;
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const viteBin = path.join(projectRoot, "node_modules", "vite", "bin", "vite.js");
const vite = spawn(process.execPath, [viteBin, "--host", "127.0.0.1", "--port", String(port)], {
  cwd: process.cwd(),
  env: { ...process.env, VITE_ENABLE_GUEST_DEMO: "false" },
  stdio: ["ignore", "pipe", "pipe"],
});

async function waitForServer() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch {
      // Vite is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Timed out waiting for Vite.");
}

let browser;
let capturedSignupBody;

function routeJson(route, status, payload) {
  route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(payload),
  });
}

function captureSignupBody(route) {
  capturedSignupBody = route.request().postDataJSON();
  routeJson(route, 503, {
    error: { code: "TEST_UNAVAILABLE", message: "Signup unavailable for test." },
  });
}

function failAuthPath(message, path = "TEST_UNAVAILABLE") {
  return (route) => routeJson(route, 503, {
    error: { code: path, message },
  });
}

try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block",
  });
  const page = await context.newPage();

  // Ensure auth bootstrap works even when backend is absent in this environment.
  await page.route("**/api/v1/me", failAuthPath("Authentication required.", "AUTH_REQUIRED"));
  await page.route("**/api/me", failAuthPath("Authentication required.", "AUTH_REQUIRED"));
  await page.route("**/api/auth/providers", (route) => routeJson(route, 200, {
    providers: {
      email: { ok: true, mode: "configured", missing: [], purpose: "Email/password sign-in" },
      google: { ok: true, mode: "configured", missing: [], purpose: "Google OAuth" },
    },
    inviteRequired: true,
  }));
  await page.route("**/api/v1/auth/providers", (route) => routeJson(route, 200, {
    providers: {
      email: { ok: true, mode: "configured", missing: [], purpose: "Email/password sign-in" },
      google: { ok: true, mode: "configured", missing: [], purpose: "Google OAuth" },
    },
    inviteRequired: true,
  }));
  const storagePayload = {
    usedBytes: 0,
    objectCount: 0,
    objectStorage: "s3-compatible",
    plan: { storageLimitBytes: null, storageScope: "account" },
  };
  await page.route("**/api/storage", (route) => routeJson(route, 200, storagePayload));
  await page.route("**/api/v1/storage", (route) => routeJson(route, 200, storagePayload));
  await page.route("**/api/v1/auth/login", failAuthPath("Service unavailable for test.", "TEST_UNAVAILABLE"));
  await page.route("**/api/auth/login", failAuthPath("Service unavailable for test.", "TEST_UNAVAILABLE"));
  await page.route("**/api/v1/auth/signup", captureSignupBody);
  await page.route("**/api/auth/signup", captureSignupBody);

  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: /Shop Talk, built for the trades/i }).waitFor();
  assert.equal(await page.getByText("Authentication required.").count(), 0);
  assert.equal(await page.getByText("Browse local demo").count(), 0);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.locator('input[type="email"]').fill("test@example.com");
  await page.locator('input[type="password"]').fill("wrong-password");
  await page.locator('button[type="submit"]').click();

  await page.getByText("Service unavailable for test.").waitFor();
  assert.equal(await page.getByText("Welcome back").isVisible(), true);
  assert.equal(await page.getByText("Browse local demo").count(), 0);

  await page.getByRole("button", { name: "Sign up", exact: true }).click();
  const contractorRole = page.locator(".role-toggle").getByRole("button", { name: "Contractor", exact: true });
  const tradespersonRole = page.locator(".role-toggle").getByRole("button", { name: "Tradesperson", exact: true });
  assert.equal(await contractorRole.getAttribute("aria-pressed"), "true");
  assert.equal(await tradespersonRole.getAttribute("aria-pressed"), "false");
  await page.getByRole("button", { name: "Tradesperson", exact: true }).click();
  assert.equal(await contractorRole.getAttribute("aria-pressed"), "false");
  assert.equal(await tradespersonRole.getAttribute("aria-pressed"), "true");
  await page.getByLabel("Name", { exact: true }).fill("Taylor Test");
  const inviteField = page.getByLabel(/Pilot invitation code/i);
  assert.equal(await inviteField.getAttribute("required"), "");
  await inviteField.fill("rivt_test_invite");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await page.getByText("Signup unavailable for test.").waitFor();

  assert.equal(capturedSignupBody?.role, "tradesperson");
  assert.equal(capturedSignupBody?.displayName, "Taylor Test");
  assert.equal(capturedSignupBody?.inviteCode, "rivt_test_invite");
  console.log("Fail-closed authentication E2E passed.");
} finally {
  if (browser) {
    await browser.close();
  }
  vite.kill();
}
