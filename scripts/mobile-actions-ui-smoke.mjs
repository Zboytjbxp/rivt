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
  env: { ...process.env, VITE_ENABLE_GUEST_DEMO: "false", VITE_API_URL: baseUrl },
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

const standaloneProject = {
  id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
  accountId: account.id,
  title: "Miller kitchen",
  clientName: "Miller family",
  locationText: "Jacksonville, FL",
  tradeCode: "carpentry",
  status: "active",
  photoCount: 0,
  albumId: null,
  createdAt: "2026-07-11T10:00:00.000Z",
  updatedAt: "2026-07-11T10:00:00.000Z",
};

const defaultPrivateAlbum = {
  id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
  accountId: account.id,
  name: "Private photos",
  standaloneProjectId: null,
  isDefault: true,
  photoCount: 0,
  coverPhoto: null,
  createdAt: "2026-07-11T10:00:00.000Z",
  updatedAt: "2026-07-11T10:00:00.000Z",
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
  const routeResponse = (pattern, body) => {
    const handler = (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    const asArray = Array.isArray(pattern) ? pattern : [pattern];
    for (const item of asArray) {
      if (typeof item === "string" && item.startsWith("**/api/")) {
        const suffix = item.replace(/^\*\*\/api\//, "/api/");
        void page.route(item, handler);
        void page.route(`http://127.0.0.1:8787${suffix}`, handler);
        void page.route(`http://127.0.0.1:8787${suffix.replace(/[?].*$/, "")}`, handler);
      } else {
        void page.route(item, handler);
      }
    }
  };

  const apiFallback = (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ data: {}, meta: { nextCursor: null } }),
  });
  void page.route("**/api/**", apiFallback);
  void page.route("http://127.0.0.1:8787/api/**", apiFallback);

  routeResponse("**/api/v1/me", { data: account });
  routeResponse("**/api/auth/providers", { providers: {} });
  routeResponse("**/api/v1/sessions", { data: { sessions: [] } });
  routeResponse("**/api/storage", { usedBytes: 0, objectCount: 0 });
  routeResponse("**/api/v1/conversations", { data: { conversations: [] } });
  routeResponse("**/api/v1/notifications", { data: { notifications: [], unreadCount: 0 } });
    routeResponse("**/api/v1/notifications/read", { data: { unreadCount: 0 } });
    routeResponse("**/api/v1/push/config", { data: { configured: false, publicKey: null, subscriptionCount: 0 } });
  routeResponse("**/api/v1/profiles?**", { data: { profiles: [] } });
  routeResponse("**/api/v1/billing/status", {
    data: {
      trial: true,
      trialEndsAt: null,
      plan: "professional",
      canPostWork: true,
      canCreateWorkspace: true,
      hasValidPaymentMethod: true,
      remaining: null,
    },
  });
  routeResponse("**/api/v1/shop-talk/reactions/batch", {
    data: {
      reactions: [],
      reputation: {
        reactionsGiven: 0,
        upvotesGiven: 0,
        downvotesGiven: 0,
        targetsReacted: 0,
        lastReactedAt: null,
      },
    },
  });
  routeResponse(/\/api\/v1\/active-work\/?(?:\?.*)?$/, { data: { activeWork: [] } });
  routeResponse("**/api/v1/applications", { data: { applications: [] } });
  routeResponse("**/api/v1/offers", { data: { offers: [] } });
  routeResponse("**/api/v1/standalone-projects", { data: { projects: [standaloneProject] } });
  routeResponse("**/api/v1/albums", { data: { albums: [defaultPrivateAlbum] } });
  routeResponse(`**/api/v1/jobs/${draftJob.id}`, { data: { job: draftJob } });
  routeResponse(`**/api/v1/jobs/${draftJob.id}/applications`, { data: { applications: [] } });
  routeResponse("**/api/v1/jobs?**", { data: { jobs: [draftJob] }, meta: { nextCursor: null } });
}

async function assertNoHorizontalOverflow(page, label) {
  const hasOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  assert.equal(hasOverflow, false, `${label} has horizontal overflow`);
}

function toPatternList(labelMatchers) {
  return Array.isArray(labelMatchers) ? labelMatchers : [labelMatchers];
}

function mergePatternsToRegex(patterns) {
  if (!patterns.length) return /Post work|Create job/i;
  const regexParts = [];
  for (const pattern of patterns) {
    if (pattern instanceof RegExp) {
      if (pattern.flags?.includes("i")) {
        regexParts.push(`(?:${pattern.source})`);
      } else {
        regexParts.push(`(?:${pattern.source})`);
      }
    } else {
      regexParts.push(String(pattern).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    }
  }
  return new RegExp(regexParts.join("|"), "i");
}

async function waitForVisibleButtonByLabel(page, labelMatchers, label) {
  const patterns = toPatternList(labelMatchers);
  const merged = mergePatternsToRegex(patterns);
  const deadline = Date.now() + 15_000;
  const byDataTest = page.locator('[data-action="post-work"]');
  const byRoleName = page.getByRole("button", { name: merged });
  const byRoleLoose = page.getByRole("button", { name: /Post work|Create job|Find work/i });
  const byPrimary = page.locator("button.v2-primary-button", { hasText: merged });

  while (Date.now() < deadline) {
    const direct = byDataTest.first();
    if ((await direct.count()) > 0 && (await direct.isVisible())) return direct;

    if ((await byRoleName.count()) > 0 && (await byRoleName.first().isVisible())) {
      return byRoleName.first();
    }

    const primaryCount = await byPrimary.count();
    for (let index = 0; index < primaryCount; index += 1) {
      const candidate = byPrimary.nth(index);
      if (await candidate.isVisible()) return candidate;
    }

    const looseCount = await byRoleLoose.count();
    for (let index = 0; index < looseCount; index += 1) {
      const candidate = byRoleLoose.nth(index);
      const visible = await candidate.isVisible();
      if (!visible) continue;
      return candidate;
    }

    await page.waitForTimeout(250);
  }

  const candidates = page.getByRole("button");
  const count = await candidates.count();
  const visibleLines = [];
  for (let index = 0; index < count; index += 1) {
    const candidate = candidates.nth(index);
    const text = (await candidate.textContent())?.trim() ?? "";
    if (!text) continue;
    visibleLines.push({
      index,
      text,
      visible: await candidate.isVisible(),
      className: (await candidate.getAttribute("class")) ?? "",
    });
  }

  console.log(`No visible match for ${label}. Candidate snapshot:`, visibleLines);
  assert.fail(`${label} button was not found and visible in timeout`);
}

async function clickVisibleButtonByLabel(page, labelMatchers, label) {
  const button = await waitForVisibleButtonByLabel(page, labelMatchers, label);
  await button.click();
  return button;
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

async function dismissDialogIfOpen(page, options) {
  const dialog = page.getByRole("dialog", { name: options.name });
  const count = await dialog.count();
  if (count === 0) return;

  const target = dialog.first();
  if (!(await target.isVisible())) return;

  const closeSelectors = options.closeSelectors ?? [];
  for (const selector of closeSelectors) {
    const closeBtn = target.locator(selector);
    const closeCount = await closeBtn.count();
    if (closeCount > 0 && (await closeBtn.first().isVisible())) {
      await closeBtn.first().click({ timeout: 2000 });
      await target.waitFor({ state: "hidden", timeout: 3000 }).catch(() => {});
      return;
    }
  }

  const ariaClose = target.getByRole("button", { name: /Close/i });
  if (await ariaClose.count() > 0 && await ariaClose.first().isVisible()) {
    await ariaClose.first().click({ timeout: 2000 });
    await target.waitFor({ state: "hidden", timeout: 3000 }).catch(() => {});
    return;
  }

  const iconClose = target.locator(".v2-modal-close").first();
  if (await iconClose.count() > 0 && await iconClose.isVisible()) {
    await iconClose.click({ timeout: 2000 });
    await target.waitFor({ state: "hidden", timeout: 3000 }).catch(() => {});
  }
}

async function safeCloseOpenPanels(page) {
  const dialogs = [
    { name: /Create (a |job )job|Edit job/i, closeSelectors: [".v2-modal-close", 'button[aria-label="Close"]'] },
    { name: "Search RIVT", closeSelectors: ['button[aria-label="Close search"]'] },
    { name: "Notifications", closeSelectors: ['button[aria-label="Close notifications"]'] },
    { name: "Settings", closeSelectors: ['button[aria-label="Close account"]', "button[aria-label='Close']"] },
  ];

  for (const entry of dialogs) {
    await dismissDialogIfOpen(page, entry);
  }

  await page.keyboard.press("Escape").catch(() => {});
}

async function runMobileFlow(page) {
  await page.goto(`${baseUrl}/app/home`, { waitUntil: "networkidle" });
  await assertNoHorizontalOverflow(page, "Home");
  await page.setViewportSize({ width: 320, height: 568 });
  await page.locator(".trade-feed").waitFor({ timeout: 15_000 });
  await assertNoHorizontalOverflow(page, "Home iPhone SE");
  assert.equal(await page.locator(".trade-feed-pickup").count(), 0, "Home should not repeat recovery actions already available in navigation");
  assert.equal(await page.locator(".trade-feed-nudge").count(), 0, "Home should not repeat the Shop Talk answer action above the feed");
  assert.equal(await page.locator(".trade-feed-fab").count(), 0, "Home should not own a generic creation FAB");
  assert.equal(await page.locator(".v2-sidebar").isVisible(), false, "iPhone SE should not render the desktop sidebar");
  assert.equal(await page.locator(".v2-mobile-nav").isVisible(), true, "iPhone SE should render the mobile nav");
  await page.screenshot({ path: path.join(screenshotDir, "mobile-home-iphone-se.png"), fullPage: false });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.locator(".v2-weather-drive-widget").count(), 0, "Home should not render the static forecast widget");
  assert.equal(await page.locator(".v2-quick-actions").count(), 0, "Home should not render the duplicate quick-action strip");
  assert.equal(await page.locator(".trade-feed-cta-row").count(), 0, "Home should not render duplicate post/crew CTA rows");
  await page.screenshot({ path: path.join(screenshotDir, "mobile-home-clean.png"), fullPage: true });

  await page.getByRole("button", { name: "Camera", exact: true }).click();
  await page.getByRole("heading", { name: "Camera", exact: true }).waitFor({ timeout: 15_000 });
  await page.getByRole("heading", { name: "Private photos", exact: true }).waitFor({ timeout: 15_000 });
  await page.locator(".v2-camera-album-card", { hasText: "Private photos" }).waitFor({ timeout: 15_000 });
  assert.equal(await page.locator(".v2-mobile-nav .is-camera-command").count(), 0, "Camera should be an equal global destination, not an oversized command");
  const cameraDestination = page.getByLabel("Camera actions").getByRole("button", { name: "Destination", exact: true });
  const cameraDestinationBox = await cameraDestination.boundingBox();
  assert.ok(cameraDestinationBox && cameraDestinationBox.y + cameraDestinationBox.height <= 844, `Camera tab destination should stay in the thumb-zone viewport: ${JSON.stringify(cameraDestinationBox)}`);
  await assertNoHorizontalOverflow(page, "Camera tab");
  await page.getByLabel("Camera").getByRole("button", { name: "Tools" }).click();
  await page.getByRole("heading", { name: "Tools", exact: true }).waitFor({ timeout: 15_000 });

  await page.goto(`${baseUrl}/app/work`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Work", exact: true }).waitFor({ timeout: 15_000 });
  await assertNoHorizontalOverflow(page, "Work");
  await page.locator(".v2-work-create-fab").waitFor({ timeout: 15_000 });
  await assertControlCenterClickable(page, ".v2-work-create-fab", "Work post-job action");

  await page.getByRole("navigation", { name: "Work stages" }).getByRole("button", { name: "Hiring", exact: true }).click();
  await page.locator(".v2-mobile-work-select select").first().selectOption("draft");
  await page.locator(".v2-job-row-inner").filter({ hasText: "Kitchen trim-out support" }).first().click();
  await page.getByText("Draft is not publish-ready", { exact: true }).waitFor({ timeout: 15_000 });
  await page.getByText(/Add summary, scope/i).waitFor({ timeout: 15_000 });
  const publishButton = page.getByRole("button", { name: "Publish" });
  await assert.equal(await publishButton.isDisabled(), true, "invalid draft publish button should be disabled");
  await page.screenshot({ path: path.join(screenshotDir, "mobile-work-draft-readiness.png"), fullPage: true });
  await safeCloseOpenPanels(page);

  await page.getByRole("button", { name: "Tools" }).click();
  await page.getByRole("heading", { name: "Tools", exact: true }).waitFor({ timeout: 15_000 });
  const primaryInvoiceTool = page.locator(".v2-tool-launch-card").filter({ hasText: "Invoice" }).first();
  await primaryInvoiceTool.waitFor({ timeout: 15_000 });
  await page.getByLabel("Field shortcuts").getByRole("button", { name: "Camera", exact: true }).waitFor({ timeout: 15_000 });
  assert.equal(await page.locator(".v2-tool-launch-card").count(), 2, "mobile Tools hub should keep only the unpinned core apps in the main grid");
  assert.equal(await page.locator(".v2-tool-mini-card").count(), 2, "mobile Tools hub should expose only the remaining supporting tool set");
  assert.equal(await page.locator(".v2-tool-mini-card").filter({ hasText: "Time & costs" }).count(), 1, "Time & costs should replace the separate record helpers");
  assert.equal(await page.getByLabel("Field shortcuts").getByRole("button", { name: "Jobsite", exact: true }).count(), 1, "Jobsite should replace separate daily log, punch, and safety launchers in the field tray");
  await assertNoHorizontalOverflow(page, "Tools hub");
  await primaryInvoiceTool.click();
  await page.getByRole("heading", { name: "Invoice", exact: true }).first().waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: "Work context: Quick use. Change context." }).waitFor({ timeout: 15_000 });
  await page.getByRole("navigation", { name: "Invoice draft steps" }).getByRole("button", { name: /Customer/ }).click();
  assert.equal(await page.getByLabel("Bill to").inputValue(), "", "Quick-use invoice must not prefill an unrelated job or client");
  const invoiceSaveButton = page.getByLabel("Invoice actions").getByRole("button", { name: /Save/i });
  const invoiceSaveBox = await invoiceSaveButton.boundingBox();
  assert.ok(invoiceSaveBox && invoiceSaveBox.y + invoiceSaveBox.height <= 844, `Invoice save action should stay in the thumb-zone viewport: ${JSON.stringify(invoiceSaveBox)}`);
  await page.getByRole("button", { name: "Work context: Quick use. Change context." }).click();
  await page.getByRole("dialog", { name: "Choose work context" }).getByRole("button", { name: /Miller kitchen/i }).click();
  await page.getByRole("button", { name: "Work context: Miller kitchen. Change context." }).waitFor({ timeout: 15_000 });
  await page.getByRole("navigation", { name: "Invoice draft steps" }).getByRole("button", { name: /Customer/ }).click();
  assert.equal(await page.getByLabel("Bill to").inputValue(), "Miller family", "Standalone context should prefill its own client");
  await assertNoHorizontalOverflow(page, "Invoice app");
  await page.screenshot({ path: path.join(screenshotDir, "mobile-invoice-standalone-context.png"), fullPage: true });

  await page.getByLabel("Invoice", { exact: true }).getByRole("button", { name: "Tools" }).click();
  await page.getByRole("heading", { name: "Tools", exact: true }).waitFor({ timeout: 15_000 });
  await page.getByLabel("Field shortcuts").getByRole("button", { name: "Camera", exact: true }).click();
  await page.getByRole("heading", { name: "Camera", exact: true }).waitFor({ timeout: 15_000 });
  await page.getByRole("heading", { name: "Private photos", exact: true }).waitFor({ timeout: 15_000 });
  await page.getByLabel("Camera actions").getByRole("button", { name: "Destination", exact: true }).click();
  await page.getByRole("dialog", { name: "Choose work context" }).getByRole("button", { name: /Miller kitchen/i }).click();
  await page.getByRole("heading", { name: "Miller kitchen", exact: true }).waitFor({ timeout: 15_000 });
  const cameraAction = page.getByLabel("Camera actions").getByRole("button", { name: "Capture", exact: true });
  const cameraActionBox = await cameraAction.boundingBox();
  assert.ok(cameraActionBox && cameraActionBox.y + cameraActionBox.height <= 844, `Camera action should stay in the thumb-zone viewport: ${JSON.stringify(cameraActionBox)}`);
  for (const actionName of ["Destination", "Open project feed", "Capture"]) {
    const action = page.getByLabel("Camera actions").getByRole("button", { name: actionName, exact: true });
    assert.equal(await action.isVisible(), true, `${actionName} should remain a visible one-handed Camera control`);
  }
  await assertNoHorizontalOverflow(page, "Standalone camera app");
  await page.screenshot({ path: path.join(screenshotDir, "mobile-camera-standalone-context.png"), fullPage: true });
  await page.getByLabel("Camera").getByRole("button", { name: "Tools" }).click();
  await page.getByRole("heading", { name: "Tools", exact: true }).waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: "Work", exact: true }).click();
  await page.getByRole("button", { name: "Find people", exact: true }).click();
  await page.getByRole("heading", { name: "People", exact: true }).waitFor({ timeout: 15_000 });
  await assertNoHorizontalOverflow(page, "People");
  await page.locator(".v2-crew-invite-fold > summary").click();
  await page.getByRole("button", { name: "Plan invite", exact: true }).click();
  const crewInviteInputs = page.locator(".v2-crew-invite-inputs input");
  await assert.equal(await crewInviteInputs.count(), 4, "Crew invite planner should render four contained inputs");
  await crewInviteInputs.nth(1).fill("Electrical framing and service");
  await assertNoHorizontalOverflow(page, "People invite planner");
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
  await assertNoHorizontalOverflow(page, "Home after messages");

  await page.getByRole("button", { name: "Notifications" }).click();
  const recordsNotificationsDialog = page.getByRole("dialog", { name: "Notifications" });
  await recordsNotificationsDialog.waitFor({ timeout: 15_000 });
  await recordsNotificationsDialog.getByRole("button", { name: "Records" }).click();
  await page.getByRole("heading", { name: "Records", exact: true }).waitFor({ timeout: 15_000 });
  await assertNoHorizontalOverflow(page, "Records route");
  await safeCloseOpenPanels(page);
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await assertNoHorizontalOverflow(page, "Home after records");

  await safeCloseOpenPanels(page);
  await page.getByRole("button", { name: /Open profile menu for/i }).click();
  const accountDialog = page.getByRole("dialog", { name: "Account menu" });
  await accountDialog.waitFor({ timeout: 15_000 });
  await assertControlCenterClickable(page, ".account-menu-signout", "account sign-out button");
  assert.equal(await accountDialog.locator(".appearance-preference").count(), 0, "Theme controls belong in Settings, not the account menu");
  await accountDialog.getByRole("button", { name: /^Settings\b/i }).click();
  await page.getByRole("heading", { name: "Settings", exact: true }).waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: "Theme", exact: true }).click();
  const appearance = page.locator(".appearance-preference");
  assert.equal(await appearance.getByRole("button").count(), 3, "Appearance should offer only System, Light, and Dark");
  await appearance.getByRole("button", { name: /Dark/i }).click();
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), "dark", "Dark appearance should update the application immediately");
  await appearance.getByRole("button", { name: /System/i }).click();
  assert.equal(await page.evaluate(() => document.documentElement.dataset.appearance), undefined, "Retired custom appearance state must not remain on the document");
  await assertNoHorizontalOverflow(page, "Appearance preference");
  await page.screenshot({ path: path.join(screenshotDir, "mobile-appearance-studio.png"), fullPage: false });
  await page.getByRole("button", { name: "Alerts", exact: true }).click();
  await page.getByText("In-app alert preferences", { exact: true }).waitFor({ timeout: 15_000 });
    await page.getByText("Device delivery is not configured for this environment.", { exact: true }).waitFor({ timeout: 15_000 });
    assert.equal(await page.getByRole("button", { name: "Enable device alerts", exact: true }).count(), 0);
  await assertNoHorizontalOverflow(page, "Settings route");
  await page.getByRole("button", { name: "Work", exact: true }).click();
  await page.getByRole("button", { name: "Find people", exact: true }).click();
  await page.getByRole("heading", { name: "People", exact: true }).waitFor({ timeout: 15_000 });
  await page.locator(".v2-crew-invite-fold > summary").click();
  await page.getByRole("button", { name: "Plan invite", exact: true }).click();
  await page.getByPlaceholder("Name or company").fill("First Coast Electric");
  await assertControlCenterClickable(page, ".v2-crew-invite-form .v2-primary-button", "crew plan invite button");
  await page.locator(".v2-crew-invite-form .v2-primary-button").click();
  await page.getByText("First Coast Electric", { exact: true }).waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: /Add person/i }).click();
  await page.getByLabel("Name").waitFor({ timeout: 15_000 });
  await page.getByLabel("Name").fill("Test Electrician");
  await page.getByRole("button", { name: "Cancel" }).click();
  await assertNoHorizontalOverflow(page, "People add person form");

  await page.getByRole("button", { name: "Tools", exact: true }).click();
  await page.getByRole("heading", { name: "Tools", exact: true }).waitFor({ timeout: 15_000 });
  await page.getByLabel("Field shortcuts").getByRole("button", { name: "Heavy 16th", exact: true }).click();
  await page.getByRole("heading", { name: "Heavy 16th field calculator", exact: true }).waitFor({ timeout: 15_000 });
  await page.getByLabel("Input unit").getByRole("button", { name: "Switch to metric mode" }).waitFor({ timeout: 15_000 });
  await page.getByLabel("Heavy, light, double, and half controls").getByRole("button", { name: "Heavy plus one thirty-second" }).waitFor({ timeout: 15_000 });
  await page.getByLabel("Heavy, light, double, and half controls").getByRole("button", { name: "Multiply measurement by two" }).waitFor({ timeout: 15_000 });
  await page.setViewportSize({ width: 375, height: 553 });
  await page.evaluate(() => {
    document.documentElement.setAttribute("data-rivt-compact-device", "true");
  });
  const compactFraction = page.locator(".fraction-strip button").filter({ hasText: "5/8" }).first();
  await compactFraction.waitFor({ timeout: 15_000 });
  assert.equal(await page.locator(".v2-mobile-nav").isVisible(), false, "immersive calculator should hide the app bottom nav on compact phones");
  assert.equal(await page.locator(".v2-topbar").isVisible(), false, "immersive calculator should hide the app topbar on compact phones");
  const compactWorkbenchBox = await page.locator(".fraction-calc-workbench").boundingBox();
  assert.ok(compactWorkbenchBox, "compact calculator workbench should have a bounding box");
  assert.ok(
    compactWorkbenchBox.height >= 548,
    `compact calculator should use the full old-SE viewport height: ${JSON.stringify(compactWorkbenchBox)}`,
  );
  const compactFractionBox = await page.evaluate(() => {
    const buttons = [...document.querySelectorAll(".fraction-strip button")];
    const target = buttons.find((button) => button.textContent?.trim() === "5/8");
    if (!(target instanceof HTMLElement)) return null;
    const rect = target.getBoundingClientRect();
    return {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    };
  });
  assert.ok(compactFractionBox, "compact 5/8 fraction button should have a bounding box");
  assert.ok(compactFractionBox.x >= 0 && compactFractionBox.y >= 0, `compact 5/8 button should stay in viewport: ${JSON.stringify(compactFractionBox)}`);
  assert.ok(
    compactFractionBox.x + compactFractionBox.width <= 375 && compactFractionBox.y + compactFractionBox.height <= 553,
    `compact 5/8 button should be fully visible at 375x553: ${JSON.stringify(compactFractionBox)}`,
  );
  const compactHistoryButton = page.getByRole("button", { name: "Calculation history" });
  const compactHistoryButtonBox = await compactHistoryButton.boundingBox();
  assert.ok(compactHistoryButtonBox, "compact calculator history button should have a bounding box");
  assert.ok(
    compactHistoryButtonBox.x >= 0
      && compactHistoryButtonBox.y >= 0
      && compactHistoryButtonBox.x + compactHistoryButtonBox.width <= 375
      && compactHistoryButtonBox.y + compactHistoryButtonBox.height <= 553,
    `compact calculator history button should stay in viewport: ${JSON.stringify(compactHistoryButtonBox)}`,
  );
  await compactHistoryButton.click();
  const compactHistoryDialog = page.getByRole("dialog", { name: "Recent calculations" });
  await compactHistoryDialog.waitFor({ timeout: 15_000 });
  const compactHistoryBox = await compactHistoryDialog.boundingBox();
  assert.ok(compactHistoryBox, "compact calculator history should have a bounding box");
  assert.ok(
    compactHistoryBox.y >= 0 && compactHistoryBox.y + compactHistoryBox.height <= 553,
    `compact calculation history should stay in viewport: ${JSON.stringify(compactHistoryBox)}`,
  );
  await compactHistoryDialog.getByRole("button", { name: "Close calculation history" }).click();
  await page.evaluate(() => {
    document.documentElement.removeAttribute("data-rivt-compact-device");
  });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(new URL(page.url()).searchParams.get("tool"), "calculator", "Calculator should create a tool-specific history entry");
  await page.goBack();
  await page.getByRole("heading", { name: "Tools", exact: true }).waitFor({ timeout: 15_000 });
  assert.equal(new URL(page.url()).pathname, "/app/tools", "Browser back from calculator should return to Tools");
  assert.equal(new URL(page.url()).searchParams.get("tool"), null, "Browser back from calculator should clear tool query state");
  await assertNoHorizontalOverflow(page, "Tools after calculator browser back");

  await page.getByRole("button", { name: "Shop Talk", exact: true }).click();
  await page.getByRole("button", { name: "Feed" }).waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: "Trade News" }).waitFor({ timeout: 15_000 });
  await page.setViewportSize({ width: 390, height: 664 });
  await page.getByRole("button", { name: "Post", exact: true }).click();
  const postButton = page.locator(".new-post-modal-footer .primary-action");
  await postButton.waitFor({ timeout: 15_000 });
  const postButtonBox = await postButton.boundingBox();
  assert.ok(postButtonBox, "Shop Talk post button should have a bounding box");
  assert.ok(postButtonBox.y >= 0, `Shop Talk post button should not sit above the viewport: ${JSON.stringify(postButtonBox)}`);
  assert.ok(postButtonBox.y + postButtonBox.height <= 664, `Shop Talk post button should be visible at 390x664: ${JSON.stringify(postButtonBox)}`);
  await page.getByRole("button", { name: "Close" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Trade News" }).click();
  await page.getByRole("heading", { name: /What's changing in the field/i }).waitFor({ timeout: 15_000 });
  await assertNoHorizontalOverflow(page, "Shop Talk trade news");
}

let browser;

try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });
  await fs.rm(screenshotDir, { recursive: true, force: true });
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
