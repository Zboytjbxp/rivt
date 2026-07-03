import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";

const port = 5195;
const baseUrl = `http://127.0.0.1:${port}`;
const projectRoot = process.cwd();
const viteBin = path.join(projectRoot, "node_modules", "vite", "bin", "vite.js");
const screenshotDir = path.join(os.tmpdir(), "rivt-tools-pass");

const vite = spawn(process.execPath, [viteBin, "--host", "127.0.0.1", "--port", String(port)], {
  cwd: projectRoot,
  env: { ...process.env, VITE_ENABLE_GUEST_DEMO: "false" },
  stdio: ["ignore", "pipe", "pipe"],
});

const account = {
  id: "tools-ui-account",
  status: "active",
  primaryRole: "contractor",
  email: "rivttesting@gmail.com",
  provider: "email",
  emailVerified: true,
  profile: {
    displayName: "Michael Test",
    headline: "Contractor",
    bio: "",
    locationText: "Jacksonville, FL",
    visibility: "network",
    onboardingStatus: "complete",
    serviceArea: { city: "Jacksonville", region: "FL", countryCode: "US", radiusMiles: 25 },
    availabilityStatus: "available",
    contactEmailVisibility: "private",
    phoneE164: null,
    phoneVisibility: "private",
    avatarUploadId: null,
    trades: [{ code: "electrical", name: "Electrical", primary: true }],
  },
  organizations: [{ id: "org-tools-ui", name: "RIVT Test Crew", role: "owner" }],
  capabilities: {
    canCompleteOnboarding: false,
    canPostWork: true,
    canApplyToWork: false,
    canPublishProfile: true,
  },
};

const activeWorkItem = {
  id: "tools-active-work-1",
  jobId: "tools-job-1",
  offerId: "tools-offer-1",
  organizationId: "org-tools-ui",
  contractorAccountId: account.id,
  tradespersonAccountId: "tools-tradesperson-1",
  status: "active",
  startedAt: "2026-06-21T12:00:00.000Z",
  completedAt: null,
  cancelledAt: null,
  createdAt: "2026-06-21T12:00:00.000Z",
  updatedAt: "2026-06-21T12:00:00.000Z",
  job: {
    id: "tools-job-1",
    title: "Tenant Build-Out",
    status: "accepted",
    organization: { id: "org-tools-ui", name: "RIVT Test Crew" },
    publicLocation: { city: "Jacksonville", region: "FL", countryCode: "US" },
  },
  events: [],
};

const projectRecord = {
  id: "tools-project-1",
  activeWorkId: activeWorkItem.id,
  jobId: activeWorkItem.jobId,
  organizationId: activeWorkItem.organizationId,
  status: "open",
  contractorAccountId: account.id,
  tradespersonAccountId: activeWorkItem.tradespersonAccountId,
  job: {
    title: activeWorkItem.job.title,
    status: "accepted",
    publicLocation: activeWorkItem.job.publicLocation,
  },
  entries: [],
  media: [],
  completionSubmissions: [],
  updatedAt: "2026-06-21T12:05:00.000Z",
};

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

async function configurePage(page) {
  await page.route(`**/api/v1/active-work/${activeWorkItem.id}/project`, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { project: projectRecord } }) }),
  );
  await page.route(`**/api/v1/projects/${projectRecord.id}/entries`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          entry: {
            id: "tools-daily-log-entry",
            projectId: projectRecord.id,
            actorAccountId: account.id,
            entryType: "note",
            body: JSON.parse(route.request().postData() || "{}").body ?? "Daily log",
            checklist: {},
            metadata: {},
            createdAt: "2026-06-21T13:00:00.000Z",
          },
        },
      }),
    }),
  );
  await page.route("**/api/v1/me", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: account }) }),
  );
  await page.route("**/api/auth/providers", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ providers: {} }) }),
  );
  await page.route("**/api/v1/sessions", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { sessions: [] } }) }),
  );
  await page.route("**/api/v1/conversations", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { conversations: [] } }) }),
  );
  await page.route("**/api/v1/notifications", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { notifications: [], unreadCount: 0 } }) }),
  );
  await page.route("**/api/v1/shop-talk/posts", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { posts: [] } }) }),
  );
  await page.route("**/api/v1/communities", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { communities: [] } }) }),
  );
  await page.route("**/api/v1/albums", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { albums: [] } }) }),
  );
  await page.route("**/api/storage", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ usedBytes: 0, objectCount: 0, plan: {} }) }),
  );
  await page.route("**/api/v1/shop-talk/reactions/batch", async (route) => {
    const body = route.request().postDataJSON();
    const targets = Array.isArray(body?.targets) ? body.targets : [];
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          reactions: targets.map((target) => ({
            targetType: target.targetType,
            targetKey: target.targetKey,
            upvotes: 0,
            downvotes: 0,
            score: 0,
            viewerReaction: null,
          })),
          reputation: {
            reactionsGiven: 0,
            upvotesGiven: 0,
            downvotesGiven: 0,
            targetsReacted: 0,
            lastReactedAt: null,
          },
        },
      }),
    });
  });
  await page.route(/\/api\/v1\/active-work\/?(?:\?.*)?$/, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { activeWork: [activeWorkItem] } }) }),
  );
  await page.route("**/api/v1/jobs?**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { jobs: [] }, meta: { nextCursor: null } }) }),
  );
}

async function assertNoHorizontalOverflow(page) {
  const hasOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  assert.equal(hasOverflow, false, "page has horizontal overflow");
}

async function assertCalculatorNoVerticalOverflow(page) {
  const metrics = await page.locator(".fraction-calc-workbench").evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }));
  assert.ok(
    metrics.scrollHeight <= metrics.clientHeight + 2,
    `calculator workbench has vertical overflow: ${metrics.scrollHeight}px content in ${metrics.clientHeight}px viewport`,
  );
}

async function runToolsFlow(page, viewportName) {
  await page.goto(`${baseUrl}/app/tools`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Tools", exact: true }).waitFor({ timeout: 15_000 });
  const primaryTool = (name) => page.locator(".v2-tool-launch-card").filter({ hasText: name }).first();
  await page.getByRole("button", { name: /Heavy 16th/i }).waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: /Records & photos/i }).waitFor({ timeout: 15_000 });
  assert.equal(await page.locator(".v2-tool-launch-card").count(), 5, "Tools hub should expose exactly five primary field apps");
  assert.equal(await page.locator(".v2-tool-mini-card").count(), 15, "Tools hub should expose supporting utilities as compact launchers");
  await page.getByRole("button", { name: /Materials/i }).waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: /Time tracker/i }).waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: /Payment tracker/i }).waitFor({ timeout: 15_000 });
  await assertNoHorizontalOverflow(page);
  await page.screenshot({ path: path.join(screenshotDir, `${viewportName}-tools-hub.png`), fullPage: true });

  await page.getByRole("button", { name: /Heavy 16th/i }).click();
  await page.getByRole("heading", { name: "Heavy 16th field calculator" }).waitFor({ timeout: 15_000 });
  await page.getByLabel("Length calculator").getByText("Total length", { exact: true }).waitFor({ timeout: 15_000 });
  await page.getByText("Copy result", { exact: true }).waitFor({ timeout: 15_000 });
  const fractionButtons = viewportName === "mobile"
    ? page.getByLabel("Sixteenth tape reference")
    : page.getByLabel("Sixteenth fractions");
  await page.getByLabel("Fraction calculator keypad").getByRole("button", { name: "7" }).click();
  await fractionButtons.getByRole("button", { name: "1/2" }).click();
  await page.getByLabel("Fraction calculator keypad").getByRole("button", { name: "+" }).click();
  await page.getByLabel("Fraction calculator keypad").getByRole("button", { name: "2" }).click();
  await fractionButtons.getByRole("button", { name: "1/4" }).click();
  await page.getByLabel("Fraction calculator keypad").getByRole("button", { name: "=" }).click();
  await page.locator(".calc-primary-value", { hasText: '9 3/4"' }).waitFor({ timeout: 15_000 });
  if (viewportName === "mobile") await assertCalculatorNoVerticalOverflow(page);
  await assertNoHorizontalOverflow(page);
  await page.screenshot({ path: path.join(screenshotDir, `${viewportName}-calculator.png`), fullPage: true });
  await page.getByRole("button", { name: "Spacing" }).click();
  await page.getByLabel("Equal spacing calculator").getByText("Center-to-center").waitFor({ timeout: 15_000 });
  await page.getByText("First center", { exact: true }).waitFor({ timeout: 15_000 });
  if (viewportName === "mobile") await assertCalculatorNoVerticalOverflow(page);
  await assertNoHorizontalOverflow(page);
  await page.getByRole("button", { name: "Cuts" }).click();
  await page.getByLabel("Cut angle calculator").getByText("Flat miter", { exact: true }).waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: "Inside" }).waitFor({ timeout: 15_000 });
  if (viewportName === "mobile") await assertCalculatorNoVerticalOverflow(page);
  await assertNoHorizontalOverflow(page);
  await page.getByRole("button", { name: "Hardware" }).click();
  await page.getByLabel("Hardware layout calculator").getByText("Centerline", { exact: true }).waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: "Knob" }).click();
  await page.getByText("Height mark", { exact: true }).waitFor({ timeout: 15_000 });
  if (viewportName === "mobile") await assertCalculatorNoVerticalOverflow(page);
  await assertNoHorizontalOverflow(page);
  await page.screenshot({ path: path.join(screenshotDir, `${viewportName}-calculator-hardware.png`), fullPage: true });
  await page.getByLabel("Heavy 16th field calculator").getByRole("button", { name: "Tools" }).click();

  await primaryTool("Estimate").click();
  await page.getByRole("heading", { name: "Estimate builder" }).waitFor({ timeout: 15_000 });
  await page.getByText("Recommended target", { exact: true }).waitFor({ timeout: 15_000 });
  await page.getByText(/labor load/i).waitFor({ timeout: 15_000 });
  await assertNoHorizontalOverflow(page);
  await page.screenshot({ path: path.join(screenshotDir, `${viewportName}-estimate.png`), fullPage: true });
  await page.getByLabel("Estimate builder").getByRole("button", { name: "Tools" }).click();

  await primaryTool("Invoice").click();
  await page.getByRole("heading", { name: "Invoice draft" }).waitFor({ timeout: 15_000 });
  await page.getByLabel("Template name").fill(`${viewportName} invoice template`);
  await page.getByRole("button", { name: "Save template" }).click();
  await page.getByText("Template saved on this device.", { exact: true }).waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: "Load" }).first().waitFor({ timeout: 15_000 });
  await page.getByLabel("Recipient email").fill("billing@example.com");
  await page.getByLabel("Recipient phone").fill("+19045550123");
  await page.getByRole("link", { name: "Email draft" }).waitFor({ timeout: 15_000 });
  await page.getByRole("link", { name: "Text draft" }).waitFor({ timeout: 15_000 });
  await page.getByRole("heading", { name: "Printable invoice" }).waitFor({ timeout: 15_000 });
  await page.getByLabel("Printable invoice preview").getByText("Total due", { exact: true }).waitFor({ timeout: 15_000 });
  await page.getByText("RIVT does not send on your behalf.", { exact: false }).waitFor({ timeout: 15_000 });
  await assertNoHorizontalOverflow(page);
  await page.screenshot({ path: path.join(screenshotDir, `${viewportName}-invoice.png`), fullPage: true });
  await page.getByLabel("Invoice draft").getByRole("button", { name: "Tools" }).click();

  await primaryTool("Daily log").click();
  await page.getByRole("heading", { name: "Daily log", exact: true }).waitFor({ timeout: 15_000 });
  await page.getByText("Records-ready", { exact: true }).waitFor({ timeout: 15_000 });
  await page.getByText("Tenant Build-Out", { exact: true }).waitFor({ timeout: 15_000 });
  await page.getByLabel("Work completed").fill("Installed devices, labeled panel schedule, and cleaned up the work area.");
  await page.getByLabel("Blockers / changes").fill("Waiting on final fixture selections before trim-out can close.");
  await page.getByLabel("Safety note").fill("Verified ladder setup and kept panel covered while working.");
  await page.getByRole("button", { name: "Photos captured" }).click();
  await page.getByRole("button", { name: "Safety condition checked" }).click();
  await page.locator(".v2-daily-log-preview").waitFor({ timeout: 15_000 });
  await page.locator(".v2-daily-log-preview").getByText("Installed devices", { exact: false }).waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: "Save to Records" }).click();
  await page.getByText("Daily log saved to the server-backed Records timeline.", { exact: true }).waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: "Save local draft" }).click();
  await page.getByText("Daily log draft saved on this device.", { exact: true }).waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: "Copy daily log" }).waitFor({ timeout: 15_000 });
  await assertNoHorizontalOverflow(page);
  await page.screenshot({ path: path.join(screenshotDir, `${viewportName}-daily-log.png`), fullPage: true });
  await page.getByLabel("Daily log").getByRole("button", { name: "Tools" }).click();

  await primaryTool("Records & photos").click();
  await page.getByRole("heading", { name: "Job Photos", exact: true, level: 1 }).waitFor({ timeout: 15_000 });
  await page.getByText("Document any job", { exact: false }).waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: /New album/i }).waitFor({ timeout: 15_000 });
  await assertNoHorizontalOverflow(page);
  await page.screenshot({ path: path.join(screenshotDir, `${viewportName}-job-photos.png`), fullPage: true });
}

let browser;

try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });
  await fs.rm(screenshotDir, { recursive: true, force: true });
  await fs.mkdir(screenshotDir, { recursive: true });

  for (const viewport of [
    { name: "desktop", width: 1440, height: 900 },
    { name: "mobile", width: 390, height: 844 },
  ]) {
    const context = await browser.newContext({ viewport, serviceWorkers: "block" });
    const page = await context.newPage();
    const errors = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));

    await configurePage(page);
    await runToolsFlow(page, viewport.name);
    assert.equal(errors.length, 0, `${viewport.name} console errors: ${errors.join("\n")}`);
    await context.close();
  }

  console.log(`Tools rendered QA passed. Screenshots: ${screenshotDir}`);
} finally {
  await browser?.close();
  vite.kill();
}
