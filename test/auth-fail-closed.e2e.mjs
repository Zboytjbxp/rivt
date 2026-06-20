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
try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  await page.route("**/api/v1/me", (route) => route.fulfill({
    status: 401,
    contentType: "application/json",
    body: JSON.stringify({ error: { code: "AUTH_REQUIRED", message: "Authentication required." } }),
  }));
  await page.route("**/api/auth/providers", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ providers: { email: { ok: true, mode: "configured", missing: [], purpose: "Email/password sign-in" } }, inviteRequired: true }),
  }));
  await page.route("**/api/v1/auth/login", (route) => route.fulfill({
    status: 503,
    contentType: "application/json",
    body: JSON.stringify({ error: { code: "TEST_UNAVAILABLE", message: "Service unavailable for test." } }),
  }));
  await page.route("**/api/v1/auth/signup", (route) => {
    capturedSignupBody = route.request().postDataJSON();
    return route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "TEST_UNAVAILABLE", message: "Signup unavailable for test." } }),
    });
  });

  await page.goto(baseUrl, { waitUntil: "networkidle" });
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
  await browser?.close();
  vite.kill();
}
