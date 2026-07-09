import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";

const port = 5197;
const baseUrl = `http://127.0.0.1:${port}`;
const projectRoot = process.cwd();
const viteBin = path.join(projectRoot, "node_modules", "vite", "bin", "vite.js");
const screenshotDir = path.join(os.tmpdir(), "rivt-guest-preview-pass");

const vite = spawn(process.execPath, [viteBin, "--host", "127.0.0.1", "--port", String(port)], {
  cwd: projectRoot,
  env: { ...process.env, VITE_API_URL: baseUrl },
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

async function launchBrowser() {
  try {
    return await chromium.launch();
  } catch {
    return chromium.launch({ channel: "chrome" });
  }
}

async function configurePage(page) {
  await page.route("**/api/auth/providers", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ providers: {} }),
  }));
  await page.route("**/api/v1/me", (route) => route.fulfill({
    status: 401,
    contentType: "application/json",
    body: JSON.stringify({ error: { code: "UNAUTHENTICATED", message: "Sign in required." } }),
  }));
  await page.route("**/api/**", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ data: {}, meta: { nextCursor: null } }),
  }));
}

async function openPreview(page, roleLabel, expectedHeading) {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Skip/i }).click();
  await page.getByRole("button", { name: new RegExp(`^${roleLabel}\\b`, "i") }).click();
  await page.getByRole("button", { name: /Browse RIVT preview/i }).click();
  await page.waitForURL("**/app", { timeout: 10_000 });
  await page.getByRole("heading", { name: expectedHeading }).waitFor({ timeout: 10_000 });

  const shellVisible = await page.locator(".v2-main").isVisible();
  assert.equal(shellVisible, true, `${roleLabel} preview shell is not visible`);
  const visibleText = (await page.locator("body").innerText()).trim();
  assert.match(visibleText, /Demo preview/i, `${roleLabel} preview did not render the demo banner`);
  assert.match(visibleText, /Trending in the trades|Communities|You're active now/i, `${roleLabel} preview body is missing app content`);

  const hasOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  assert.equal(hasOverflow, false, `${roleLabel} preview has horizontal overflow at compact width`);

  await page.screenshot({
    path: path.join(screenshotDir, `${roleLabel.toLowerCase()}-preview-320.png`),
    fullPage: false,
  });
}

try {
  await fs.rm(screenshotDir, { recursive: true, force: true });
  await fs.mkdir(screenshotDir, { recursive: true });
  await waitForServer();

  const browser = await launchBrowser();
  const context = await browser.newContext({
    viewport: { width: 320, height: 568 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await configurePage(page);

  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  await openPreview(page, "Contractor", /Good (morning|afternoon|evening), Demo contractor account/i);
  await context.clearCookies();
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await openPreview(page, "Subcontractor", /Good (morning|afternoon|evening), Demo subcontractor account/i);

  assert.deepEqual(consoleErrors, [], `Unexpected preview console errors:\n${consoleErrors.join("\n")}`);
  await browser.close();
  console.log(JSON.stringify({ ok: true, screenshotDir }, null, 2));
} finally {
  vite.kill("SIGTERM");
}
