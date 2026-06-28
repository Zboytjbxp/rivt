import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";

const port = 5196;
const baseUrl = `http://127.0.0.1:${port}`;
const projectRoot = process.cwd();
const viteBin = path.join(projectRoot, "node_modules", "vite", "bin", "vite.js");
const screenshotDir = path.join(os.tmpdir(), "rivt-mobile-actions-pass");

const vite = spawn(process.execPath, [viteBin, "--host", "127.0.0.1", "--port", String(port)], {
  cwd: projectRoot,
  env: { ...process.env, VITE_ENABLE_GUEST_DEMO: "false" },
  stdio: ["ignore", "pipe", "pipe"],
});

const account = {
  id: "mobile-actions-account",
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
  organizations: [{ id: "org-mobile-actions", name: "RIVT Test Crew", role: "owner" }],
  capabilities: {
    canCompleteOnboarding: false,
    canPostWork: true,
    canApplyToWork: false,
    canPublishProfile: true,
  },
};

const draftJob = {
  id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  organization: { id: "org-mobile-actions", name: "RIVT Test Crew" },
  createdByAccountId: account.id,
  title: "Kitchen trim-out support",
  trade: { code: "electrical", name: "Electrical" },
  summary: "Needs help.",
  scopeDescription: "",
  status: "draft",
  difficulty: "moderate",
  workType: "side_work",
  budget: null,
  durationHours: null,
  preferredStartDate: null,
  applicationDeadline: null,
  insuranceRequired: true,
  publicLocation: { city: "Jacksonville", region: "FL", countryCode: "US", postalPrefix: null },
  privateLocation: null,
  requirements: { tools: [], materials: [], deliverables: [], certificationCodes: [] },
  addressPrivacy: "Exact address shared after acceptance",
  matchScore: null,
  version: 1,
  publishedAt: null,
  pausedAt: null,
  closedAt: null,
  createdAt: "2026-06-28T10:00:00.000Z",
  updatedAt: "2026-06-28T10:00:00.000Z",
  events: [],
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
  await page.route("**/api/v1/notifications/read", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { unreadCount: 0 } }) }),
  );
  await page.route("**/api/v1/profiles?**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { profiles: [] } }) }),
  );
  await page.route("**/api/v1/shop-talk/reactions/batch", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { reactions: [], reputation: { reactionsGiven: 0, upvotesGiven: 0, downvotesGiven: 0, targetsReacted: 0, lastReactedAt: null } } }),
    }),
  );
  await page.route(/\/api\/v1\/active-work\/?(?:\?.*)?$/, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { activeWork: [] } }) }),
  );
  await page.route("**/api/v1/applications", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { applications: [] } }) }),
  );
  await page.route("**/api/v1/offers", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { offers: [] } }) }),
  );
  await page.route(`**/api/v1/jobs/${draftJob.id}`, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { job: draftJob } }) }),
  );
  await page.route(`**/api/v1/jobs/${draftJob.id}/applications`, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { applications: [] } }) }),
  );
  await page.route("**/api/v1/jobs?**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { jobs: [draftJob] }, meta: { nextCursor: null } }),
    }),
  );
}

async function assertNoHorizontalOverflow(page, label) {
  const hasOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  assert.equal(hasOverflow, false, `${label} has horizontal overflow`);
}

async function assertControlCenterClickable(page, selector, label) {
  const result = await page.evaluate((targetSelector) => {
    const element = document.querySelector(targetSelector);
    if (!(element instanceof HTMLElement)) return { found: false };
    element.scrollIntoView({ block: "center", inline: "nearest" });
    const rect = element.getBoundingClientRect();
    const x = Math.max(0, Math.min(window.innerWidth - 1, rect.left + rect.width / 2));
    const y = Math.max(0, Math.min(window.innerHeight - 1, rect.top + rect.height / 2));
    const hit = document.elementFromPoint(x, y);
    return {
      found: true,
      rect: {
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        top: Math.round(rect.top),
        bottom: Math.round(rect.bottom),
      },
      viewport: { width: window.innerWidth, height: window.innerHeight },
      clickable: Boolean(hit && (element === hit || element.contains(hit) || hit.closest(targetSelector) === element)),
      hitTag: hit?.tagName ?? null,
      hitClass: hit instanceof HTMLElement ? hit.className : null,
    };
  }, selector);
  assert.equal(result.found, true, `${label} was not found`);
  assert.equal(result.clickable, true, `${label} center is occluded: ${JSON.stringify(result)}`);
}

async function runMobileFlow(page) {
  await page.goto(`${baseUrl}/app/home`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Post work/i }).waitFor({ timeout: 15_000 });
  await assertNoHorizontalOverflow(page, "Home");
  assert.equal(await page.locator(".v2-weather-drive-widget").count(), 0, "Home should not render the static forecast widget");
  assert.equal(await page.locator(".v2-quick-actions").count(), 0, "Home should not render the duplicate quick-action strip");
  await page.screenshot({ path: path.join(screenshotDir, "mobile-home-clean.png"), fullPage: true });

  await page.goto(`${baseUrl}/app/work`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Work", exact: true }).waitFor({ timeout: 15_000 });
  await assertNoHorizontalOverflow(page, "Work");

  await page.getByRole("button", { name: "Drafts" }).click();
  await page.locator(".v2-job-row-inner").filter({ hasText: "Kitchen trim-out support" }).first().click();
  await page.getByText("Draft is not publish-ready", { exact: true }).waitFor({ timeout: 15_000 });
  await page.getByText(/Add summary, scope/i).waitFor({ timeout: 15_000 });
  const publishButton = page.getByRole("button", { name: "Publish" });
  await assert.equal(await publishButton.isDisabled(), true, "invalid draft publish button should be disabled");
  await page.screenshot({ path: path.join(screenshotDir, "mobile-work-draft-readiness.png"), fullPage: true });

  await page.getByRole("button", { name: "Tools" }).click();
  await page.getByRole("heading", { name: "Tools", exact: true }).waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: /Invoice draft/i }).waitFor({ timeout: 15_000 });
  await assertNoHorizontalOverflow(page, "Tools hub");
  await page.getByRole("button", { name: /Invoice draft/i }).click();
  await page.getByRole("heading", { name: "Invoice draft" }).waitFor({ timeout: 15_000 });
  await assertNoHorizontalOverflow(page, "Invoice app");

  await page.getByLabel("Invoice draft").getByRole("button", { name: "Tools" }).click();
  await page.getByRole("heading", { name: "Tools", exact: true }).waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: "Crew", exact: true }).click();
  await page.getByRole("heading", { name: "Network", exact: true }).waitFor({ timeout: 15_000 });
  await assertNoHorizontalOverflow(page, "Crew");
  const crewInviteInputs = page.locator(".v2-crew-invite-inputs input");
  await assert.equal(await crewInviteInputs.count(), 4, "Crew invite planner should render four contained inputs");
  await crewInviteInputs.nth(1).fill("Electrical framing and service");
  await assertNoHorizontalOverflow(page, "Crew invite planner");
  await page.screenshot({ path: path.join(screenshotDir, "mobile-crew-contained.png"), fullPage: true });

  await page.getByRole("button", { name: "Search" }).click();
  await page.getByRole("dialog", { name: "Search RIVT" }).waitFor({ timeout: 15_000 });
  await page.getByLabel("Search jobs, questions, trades, or tools").fill("invoice");
  await page.getByRole("button", { name: /Open Tools/i }).waitFor({ timeout: 15_000 });
  await assertNoHorizontalOverflow(page, "Search panel");
  await page.screenshot({ path: path.join(screenshotDir, "mobile-search-panel.png"), fullPage: true });
  await page.getByRole("button", { name: /Open Tools/i }).click();
  await page.getByRole("heading", { name: "Tools", exact: true }).waitFor({ timeout: 15_000 });
  await assertNoHorizontalOverflow(page, "Search to Tools route");

  await page.getByRole("button", { name: "Notifications" }).click();
  const notificationsDialog = page.getByRole("dialog", { name: "Notifications" });
  await notificationsDialog.waitFor({ timeout: 15_000 });
  await assertControlCenterClickable(page, '.side-panel[aria-label="Notifications"] button[aria-label="Close notifications"]', "notifications close button");
  await assertControlCenterClickable(page, '.side-panel[aria-label="Notifications"] .quick-actions button:nth-of-type(2)', "notifications messages action");
  await notificationsDialog.getByRole("button", { name: "Messages" }).click();
  await page.getByRole("heading", { name: "Inbox", exact: true }).waitFor({ timeout: 15_000 });
  await assertNoHorizontalOverflow(page, "Messages route");
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await page.getByRole("button", { name: /Post work/i }).waitFor({ timeout: 15_000 });

  await page.getByRole("button", { name: "Notifications" }).click();
  const recordsNotificationsDialog = page.getByRole("dialog", { name: "Notifications" });
  await recordsNotificationsDialog.waitFor({ timeout: 15_000 });
  await recordsNotificationsDialog.getByRole("button", { name: "Records" }).click();
  await page.getByRole("heading", { name: "Records", exact: true }).waitFor({ timeout: 15_000 });
  await assertNoHorizontalOverflow(page, "Records route");
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await page.getByRole("button", { name: /Post work/i }).waitFor({ timeout: 15_000 });

  await page.getByRole("button", { name: /Open profile menu for/i }).click();
  await page.getByRole("dialog", { name: "Settings" }).waitFor({ timeout: 15_000 });
  await assertControlCenterClickable(page, ".account-signout-btn", "account sign-out button");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("heading", { name: "Settings", exact: true }).waitFor({ timeout: 15_000 });
  await assertNoHorizontalOverflow(page, "Settings route");
  await page.getByRole("button", { name: "Crew", exact: true }).click();
  await page.getByRole("heading", { name: "Network", exact: true }).waitFor({ timeout: 15_000 });
  await page.getByPlaceholder("Name or company").fill("First Coast Electric");
  await assertControlCenterClickable(page, ".v2-crew-invite-form .v2-primary-button", "crew plan invite button");
  await page.locator(".v2-crew-invite-form .v2-primary-button").click();
  await page.getByText("First Coast Electric", { exact: true }).waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: /Add member/i }).click();
  await page.getByLabel("Name").waitFor({ timeout: 15_000 });
  await page.getByLabel("Name").fill("Test Electrician");
  await page.getByRole("button", { name: "Cancel" }).click();
  await assertNoHorizontalOverflow(page, "Crew add member form");
}

let browser;

try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });
  await fs.mkdir(screenshotDir, { recursive: true });

  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  const page = await context.newPage();
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await configurePage(page);
  await runMobileFlow(page);
  assert.equal(errors.length, 0, `mobile console errors: ${errors.join("\n")}`);
  await context.close();

  console.log(`Mobile action QA passed. Screenshots: ${screenshotDir}`);
} finally {
  await browser?.close();
  vite.kill();
}
