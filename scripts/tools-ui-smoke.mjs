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
  id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
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

const defaultPrivateAlbum = {
  id: "dddddddd-dddd-dddd-dddd-dddddddddddd",
  accountId: account.id,
  name: "Private photos",
  standaloneProjectId: null,
  isDefault: true,
  photoCount: 0,
  coverPhoto: null,
  createdAt: "2026-06-21T12:00:00.000Z",
  updatedAt: "2026-06-21T12:00:00.000Z",
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
  await page.addInitScript(() => {
    localStorage.setItem("rivt.priceBook.v1", JSON.stringify([{
      id: "saved-price-1",
      name: "3/4 plywood",
      unit: "sheet",
      price: 52.75,
      supplier: "Local yard",
      notes: "Birch",
      updatedAt: "2026-07-14T12:00:00.000Z",
    }]));
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => {
          const canvas = document.createElement("canvas");
          canvas.width = 640;
          canvas.height = 480;
          const context = canvas.getContext("2d");
          if (context) {
            context.fillStyle = "#101820";
            context.fillRect(0, 0, canvas.width, canvas.height);
            context.fillStyle = "#ff4b00";
            context.fillRect(48, 48, 220, 120);
            context.fillStyle = "#ffffff";
            context.font = "42px sans-serif";
            context.fillText("RIVT", 72, 124);
          }
          return canvas.captureStream(5);
        },
      },
    });
  });
  let mediaCounter = 0;
  let rejectNextMediaUpload = true;
  const pageProjectRecord = {
    ...projectRecord,
    entries: [...projectRecord.entries],
    media: [],
    completionSubmissions: [...projectRecord.completionSubmissions],
  };
  await page.route(`**/api/v1/active-work/${activeWorkItem.id}/project`, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { project: pageProjectRecord } }) }),
  );
  await page.route(`**/api/v1/projects/${projectRecord.id}`, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { project: pageProjectRecord } }) }),
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
  await page.route(`**/api/v1/projects/${projectRecord.id}/media`, (route) => {
    if (rejectNextMediaUpload) {
      rejectNextMediaUpload = false;
      return route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "UPLOAD_TEMPORARILY_UNAVAILABLE", message: "Photo upload was interrupted." } }),
      });
    }
    mediaCounter += 1;
    const uploadId = `tools-media-upload-${mediaCounter}`;
    const createdAt = `2026-06-21T13:0${mediaCounter}:00.000Z`;
    const media = {
      id: `tools-media-${mediaCounter}`,
      projectId: projectRecord.id,
      uploadId,
      originalName: `photo-${mediaCounter}.jpg`,
      mimeType: "image/jpeg",
      sizeBytes: 2048,
      contentSha256: `tools-hash-${mediaCounter}`,
      mediaKind: "photo",
      status: "stored",
      reviewStatus: "accepted",
      failureReason: "",
      createdAt,
      signedUrl: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='220' viewBox='0 0 320 220'%3E%3Crect width='320' height='220' fill='%23101820'/%3E%3Crect x='36' y='42' width='248' height='136' rx='14' fill='%23ff4b00'/%3E%3Ctext x='160' y='124' text-anchor='middle' font-family='Arial' font-size='42' font-weight='700' fill='white'%3ERIVT%3C/text%3E%3C/svg%3E",
    };
    const entry = {
      id: `tools-media-entry-${mediaCounter}`,
      projectId: projectRecord.id,
      actorAccountId: account.id,
      entryType: "media",
      body: "Progress photo",
      checklist: {},
      metadata: { uploadId },
      createdAt,
    };
    pageProjectRecord.media = [media, ...pageProjectRecord.media];
    pageProjectRecord.entries = [entry, ...pageProjectRecord.entries];
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { media, entry } }),
    });
  });
  await page.route("**/api/v1/me", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: account }) }),
  );
  await page.route("**/api/auth/providers", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ providers: {} }) }),
  );
  await page.route("**/api/v1/push/config", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { enabled: false } }) }),
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
  await page.route("**/api/v1/notification-preferences", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { preferences: [] } }) }),
  );
  await page.route("**/api/v1/billing/status", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          plan: "free",
          active: false,
          status: "inactive",
          cancelAtPeriodEnd: false,
          provider: { checkoutConfigured: false, webhookConfigured: false, portalConfigured: false },
        },
      }),
    }),
  );
  await page.route("**/api/v1/shop-talk/posts", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { posts: [] } }) }),
  );
  await page.route("**/api/v1/communities", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { communities: [] } }) }),
  );
  await page.route("**/api/v1/albums", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { albums: [defaultPrivateAlbum] } }) }),
  );
  await page.route("**/api/v1/standalone-projects", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { projects: [] } }) }),
  );
  await page.route(/\/api\/v1\/tool-records(?:\/.*|\?.*)?$/, (route) => {
    const method = route.request().method();
    if (method === "GET") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { records: [] } }) });
    }
    if (method === "POST") {
      const input = route.request().postDataJSON();
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            record: {
              id: `tool-record-${input?.localId ?? "saved"}`,
              recordType: input?.recordType ?? "daily_report",
              localId: input?.localId ?? "saved",
              title: input?.title ?? "Saved record",
              status: input?.status ?? "active",
              recordDate: input?.recordDate ?? null,
              amountCents: input?.amountCents ?? null,
              payload: input?.payload ?? {},
              createdAt: "2026-07-04T12:00:00.000Z",
              updatedAt: "2026-07-04T12:00:00.000Z",
            },
          },
        }),
      });
    }
    return route.fulfill({ status: 204, body: "" });
  });
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

async function assertCalculatorOwnsHandsetWidth(page) {
  const metrics = await page.locator(".fraction-calc-workbench").evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      width: rect.width,
      left: rect.left,
      right: rect.right,
      viewportWidth: window.innerWidth,
    };
  });
  assert.ok(
    metrics.width >= metrics.viewportWidth * 0.9,
    `calculator should fill the handset width; got ${metrics.width}px inside ${metrics.viewportWidth}px viewport`,
  );
  assert.ok(
    metrics.left <= 12 && metrics.right >= metrics.viewportWidth - 12,
    `calculator should sit edge-to-edge on handset; got bounds ${JSON.stringify(metrics)}`,
  );
  assert.equal(
    await page.locator(".v2-mobile-nav").isVisible(),
    false,
    "immersive calculator should hide the app mobile nav",
  );
}

async function assertCalculatorKeyRowsBalanced(page, viewportName) {
  const metrics = await page.evaluate(() => {
    const fractionKey = Array.from(document.querySelectorAll(".fraction-strip button"))
      .find((element) => element.textContent?.trim() === "1/2");
    const wholeNumberKey = Array.from(document.querySelectorAll(".fraction-pad button"))
      .find((element) => element.textContent?.trim() === "8");
    if (!(fractionKey instanceof HTMLElement) || !(wholeNumberKey instanceof HTMLElement)) return null;
    return {
      fractionHeight: fractionKey.getBoundingClientRect().height,
      wholeNumberHeight: wholeNumberKey.getBoundingClientRect().height,
    };
  });
  assert.ok(metrics, `calculator keys should render in the ${viewportName} viewport`);
  const ratio = metrics.fractionHeight / metrics.wholeNumberHeight;
  assert.ok(
    ratio >= 0.82 && ratio <= 1.18,
    `fraction and whole-number keys should have a balanced height in ${viewportName}; got ${JSON.stringify(metrics)}`,
  );
}

async function assertImmersiveToolChromeHidden(page, toolName) {
  assert.equal(
    await page.locator(".v2-mobile-nav").isVisible(),
    false,
    `${toolName} should hide the app mobile nav while open`,
  );
}

async function clickVisibleFraction(page, label, viewportName) {
  const selector = ".fraction-strip button";
  const result = await page.evaluate(
    ({ selector, label }) => {
      const isVisible = (element) => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none"
          && style.visibility !== "hidden"
          && rect.width > 0
          && rect.height > 0;
      };
      const visibleLabels = Array.from(document.querySelectorAll(selector))
        .filter((element) => isVisible(element))
        .map((element) => element.textContent?.trim() ?? "");
      const target = Array.from(document.querySelectorAll(selector)).find(
        (element) => element.textContent?.trim() === label && isVisible(element),
      );
      if (!(target instanceof HTMLElement)) return { clicked: false, visibleLabels };
      target.click();
      return { clicked: true, visibleLabels };
    },
    { selector, label },
  );
  assert.equal(
    result.clicked,
    true,
    `expected visible fraction control ${label} in ${viewportName} viewport; visible: ${result.visibleLabels.join(", ")}`,
  );
}

async function runToolsFlow(page, viewportName) {
  const isHandsetViewport = viewportName !== "desktop";
  await page.goto(`${baseUrl}/app/tools?tool=contracts`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Tools", exact: true }).waitFor({ timeout: 15_000 });
  assert.equal(
    await page.getByRole("heading", { name: "Contract templates", exact: true }).count(),
    0,
    "contained tool URLs should fall back to the public Tools hub",
  );

  await page.goto(`${baseUrl}/app/tools`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Tools", exact: true }).waitFor({ timeout: 15_000 });
  const primaryTool = (name) => page.locator(".v2-tool-launch-card").filter({ hasText: name }).first();
  const fieldToolsTray = page.getByLabel("Field shortcuts", { exact: true });
  await fieldToolsTray.waitFor({ timeout: 15_000 });
  await fieldToolsTray.getByRole("button", { name: "Heavy 16th", exact: true }).waitFor({ timeout: 15_000 });
  await fieldToolsTray.getByRole("button", { name: "Camera", exact: true }).waitFor({ timeout: 15_000 });
  await fieldToolsTray.getByRole("button", { name: "Jobsite", exact: true }).waitFor({ timeout: 15_000 });
  assert.equal(
    await fieldToolsTray.locator(".v2-field-tools-actions > button").count(),
    4,
    "Field shortcuts should contain three user tools and one Utilities jump",
  );
  assert.equal(await page.locator(".v2-tool-launch-card").count(), 2, "Pinned defaults should not repeat in the core-app launcher");
  assert.equal(await page.locator(".v2-tool-group").count(), 1, "Supporting helpers should live in one utilities drawer");
  await page.locator(".v2-tool-group").filter({ hasText: "Utilities" }).locator("summary").click();
  await page.getByRole("button", { name: /Materials/i }).waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: /Time & costs/i }).waitFor({ timeout: 15_000 });
  assert.equal(
    await page.locator(".v2-tool-mini-card").count(),
    2,
    "The final utilities group should expose exactly Materials and Time & costs",
  );
  assert.equal(await page.getByRole("button", { name: /Safety/i }).count(), 0, "Safety should live inside Jobsite instead of appearing as a separate launcher");
  assert.equal(await page.getByRole("button", { name: /Punch list/i }).count(), 0, "Punch should live inside Jobsite instead of appearing as a separate launcher");
  assert.equal(
    await page.getByRole("button", { name: /Receivables/i }).count(),
    0,
    "Receivables should live inside Invoice instead of appearing as a separate launcher",
  );
  assert.equal(
    await page.getByRole("button", { name: /Price book/i }).count(),
    0,
    "Price Book should be consolidated into Materials instead of appearing as a second launcher",
  );
  for (const oldLauncher of ["Time", "Expenses", "Mileage", "Tax summary"]) {
    assert.equal(
      await page.getByRole("button", { name: oldLauncher, exact: true }).count(),
      0,
      `${oldLauncher} should live inside Time & costs instead of appearing as a separate launcher`,
    );
  }
  await assertNoHorizontalOverflow(page);
  await page.screenshot({ path: path.join(screenshotDir, `${viewportName}-tools-hub.png`), fullPage: true });

  await page.getByRole("button", { name: /Time & costs/i }).click();
  await page.getByRole("heading", { name: "Time & costs", exact: true }).waitFor({ timeout: 15_000 });
  const timeCostsTabs = page.getByRole("navigation", { name: "Time and costs sections" });
  for (const tab of ["Time", "Expenses", "Mileage", "Summary"]) {
    await timeCostsTabs.getByRole("button", { name: tab, exact: true }).click();
    assert.equal(
      await timeCostsTabs.getByRole("button", { name: tab, exact: true }).getAttribute("aria-current"),
      "page",
      `${tab} should be selected inside Time & costs`,
    );
  }
  await assertNoHorizontalOverflow(page);
  await page.screenshot({ path: path.join(screenshotDir, `${viewportName}-time-costs.png`), fullPage: true });
  await page.getByLabel("Time & costs").getByRole("button", { name: "All tools" }).click();

  for (const [legacyMode, expectedTab] of [["time-tracker", "Time"], ["expense-logger", "Expenses"], ["mileage", "Mileage"], ["tax-summary", "Summary"]]) {
    await page.goto(`${baseUrl}/app/tools?tool=${legacyMode}`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "Time & costs", exact: true }).waitFor({ timeout: 15_000 });
    assert.equal(
      await page.getByRole("navigation", { name: "Time and costs sections" }).getByRole("button", { name: expectedTab, exact: true }).getAttribute("aria-current"),
      "page",
      `Legacy ${legacyMode} links should open the ${expectedTab} tab`,
    );
  }
  await page.getByLabel("Time & costs").getByRole("button", { name: "All tools" }).click();
  await page.locator(".v2-tool-group").filter({ hasText: "Utilities" }).locator("summary").click();

  await page.getByRole("button", { name: /Materials/i }).click();
  await page.getByRole("heading", { name: "Materials", exact: true }).waitFor({ timeout: 15_000 });
  const materialsViews = page.getByRole("navigation", { name: "Materials views" });
  await materialsViews.getByRole("button", { name: "Takeoff", exact: true }).waitFor({ timeout: 15_000 });
  await page.getByText("RIVT does not guess supplier pricing.", { exact: false }).waitFor({ timeout: 15_000 });
  await materialsViews.getByRole("button", { name: "Sheets", exact: true }).click();
  await page.getByRole("heading", { name: "Quick sheet count", exact: true }).waitFor({ timeout: 15_000 });
  await materialsViews.getByRole("button", { name: "Price library", exact: true }).click();
  await page.getByRole("heading", { name: "Price library", exact: true }).waitFor({ timeout: 15_000 });
  await page.getByText("3/4 plywood", { exact: true }).waitFor({ timeout: 15_000 });
  await page.getByText("Local yard", { exact: true }).waitFor({ timeout: 15_000 });
  await assertNoHorizontalOverflow(page);
  await page.screenshot({ path: path.join(screenshotDir, `${viewportName}-materials.png`), fullPage: true });
  await page.getByLabel("Materials").getByRole("button", { name: "Tools" }).click();

  await page.goto(`${baseUrl}/app/tools?tool=price-book`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Materials", exact: true }).waitFor({ timeout: 15_000 });
  assert.equal(
    await page.getByRole("navigation", { name: "Materials views" }).getByRole("button", { name: "Price library", exact: true }).getAttribute("aria-pressed"),
    "true",
    "Legacy Price Book links should open the consolidated Materials library",
  );
  await page.getByText("3/4 plywood", { exact: true }).waitFor({ timeout: 15_000 });
  await page.getByLabel("Materials").getByRole("button", { name: "Tools" }).click();

  await fieldToolsTray.getByRole("button", { name: "Heavy 16th", exact: true }).click();
  await page.getByRole("heading", { name: "Heavy 16th field calculator" }).waitFor({ timeout: 15_000 });
  if (viewportName === "se") {
    await page.evaluate(() => {
      document.documentElement.setAttribute("data-rivt-compact-device", "true");
    });
  }
  await page.getByLabel("Length calculator").getByText("Decimal", { exact: true }).waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: "Copy" }).waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: "Calculator settings", exact: true }).click();
  const calculatorSettings = page.getByRole("dialog", { name: "Calculator settings" });
  await calculatorSettings.getByRole("button", { name: "Metric" }).click();
  await calculatorSettings.getByRole("button", { name: "Close calculator settings" }).click();
  await page.getByLabel("Length calculator").getByText("Metres", { exact: true }).waitFor({ timeout: 15_000 });
  await page.getByLabel("Heavy, light, double, and half controls").getByRole("button", { name: "Heavy plus half millimetre" }).waitFor({ timeout: 15_000 });
  await page.getByLabel("Heavy, light, double, and half controls").getByRole("button", { name: "Light minus half millimetre" }).waitFor({ timeout: 15_000 });
  await page.getByLabel("Heavy, light, double, and half controls").getByRole("button", { name: "Multiply measurement by two" }).waitFor({ timeout: 15_000 });
  await page.getByLabel("Heavy, light, double, and half controls").getByRole("button", { name: "Divide measurement by two" }).waitFor({ timeout: 15_000 });
  await page.getByLabel("Metric calculator keypad").getByRole("button", { name: "2" }).click();
  await page.getByLabel("Metric calculator keypad").getByRole("button", { name: "4" }).click();
  await page.getByLabel("Metric calculator keypad").getByRole("button", { name: "0" }).click();
  await page.locator(".calc-primary-value", { hasText: "240 mm" }).waitFor({ timeout: 15_000 });
  await page.getByLabel("Heavy, light, double, and half controls").getByRole("button", { name: "Heavy plus half millimetre" }).click();
  await page.locator(".calc-primary-value", { hasText: "240.5 mm" }).waitFor({ timeout: 15_000 });
  await page.getByLabel("Heavy, light, double, and half controls").getByRole("button", { name: "Light minus half millimetre" }).click();
  await page.locator(".calc-primary-value", { hasText: "240 mm" }).waitFor({ timeout: 15_000 });
  await page.getByLabel("Heavy, light, double, and half controls").getByRole("button", { name: "Divide measurement by two" }).click();
  await page.locator(".calc-primary-value", { hasText: "120 mm" }).waitFor({ timeout: 15_000 });
  await page.getByLabel("Heavy, light, double, and half controls").getByRole("button", { name: "Multiply measurement by two" }).click();
  await page.locator(".calc-primary-value", { hasText: "240 mm" }).waitFor({ timeout: 15_000 });
  await page.getByLabel("Metric decimal tenths").getByRole("button", { name: ".5" }).click();
  await page.locator(".calc-primary-value", { hasText: "240.5 mm" }).waitFor({ timeout: 15_000 });
  await page.getByLabel("Metric calculator keypad").getByRole("button", { name: "Backspace" }).click();
  await page.locator(".calc-primary-value", { hasText: "240 mm" }).waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: "Calculator settings", exact: true }).click();
  await calculatorSettings.getByRole("button", { name: "Imperial" }).click();
  await calculatorSettings.getByRole("button", { name: "Feet + inches" }).click();
  await calculatorSettings.getByRole("button", { name: "Close calculator settings" }).click();
  await page.getByLabel("Length calculator").getByText("Decimal", { exact: true }).waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: "Clear calculator" }).click();
  await page.locator(".calc-primary-value", { hasText: '0"' }).waitFor({ timeout: 15_000 });
  await page.getByLabel("Fraction calculator keypad").getByRole("button", { name: "2" }).click();
  await page.getByLabel("Fraction calculator keypad").getByRole("button", { name: "7" }).click();
  await clickVisibleFraction(page, "5/16", viewportName);
  await page.locator(".calc-primary-value", { hasText: '27 5/16"' }).waitFor({ timeout: 15_000 });
  assert.equal(
    await page.locator(".calc-primary-value").textContent(),
    '27 5/16"',
    "inches mode should keep measurements above 12 inches instead of normalizing to feet",
  );
  await page.getByLabel("Input unit").getByRole("button", { name: "Feet input" }).click();
  await page.locator(".calc-primary-value", { hasText: `2' 3 5/16"` }).waitFor({ timeout: 15_000 });
  await page.getByLabel("Input unit").getByRole("button", { name: "Inches input" }).click();
  await page.locator(".calc-primary-value", { hasText: '27 5/16"' }).waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: "Clear calculator" }).click();
  await page.getByLabel("Fraction calculator keypad").getByRole("button", { name: "9" }).click();
  await clickVisibleFraction(page, "5/16", viewportName);
  await page.getByLabel("Heavy, light, double, and half controls").getByRole("button", { name: "Mark measurement heavy" }).click();
  await page.locator(".calc-primary-value", { hasText: '9 5/16" H' }).waitFor({ timeout: 15_000 });
  await page.getByLabel("Fraction calculator keypad").getByRole("button", { name: "+" }).click();
  await clickVisibleFraction(page, "1/4", viewportName);
  await page.getByLabel("Heavy, light, double, and half controls").getByRole("button", { name: "Mark measurement heavy" }).click();
  await page.getByLabel("Fraction calculator keypad").getByRole("button", { name: "=" }).click();
  await page.locator(".calc-primary-value", { hasText: '9 5/8"' }).waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: "Clear calculator" }).click();
  await clickVisibleFraction(page, "1/2", viewportName);
  await page.getByLabel("Fraction calculator keypad").getByRole("button", { name: "+" }).click();
  await page.getByLabel("Fraction calculator keypad").getByRole("button", { name: "2" }).click();
  await clickVisibleFraction(page, "1/4", viewportName);
  await page.getByLabel("Fraction calculator keypad").getByRole("button", { name: "=" }).click();
  await page.locator(".calc-primary-value", { hasText: '2 3/4"' }).waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: "Calculation history" }).click();
  const calculationHistory = page.getByRole("dialog", { name: "Recent calculations" });
  await calculationHistory.waitFor({ timeout: 15_000 });
  const completedEquation = calculationHistory.getByRole("button").filter({ hasText: '1/2" + 2 1/4"' }).first();
  await completedEquation.getByText('2 3/4"', { exact: true }).waitFor({ timeout: 15_000 });
  await completedEquation.click();
  await calculationHistory.waitFor({ state: "hidden", timeout: 15_000 });
  await page.locator(".calc-primary-value", { hasText: '2 3/4"' }).waitFor({ timeout: 15_000 });
  if (isHandsetViewport) {
    await assertCalculatorNoVerticalOverflow(page);
    await assertCalculatorOwnsHandsetWidth(page);
    await assertCalculatorKeyRowsBalanced(page, viewportName);
    assert.equal(
      await page.locator(".heavy-calc-ruler").isVisible(),
      false,
      "Handset calculator should use the visible fraction strip instead of the ruler rail",
    );
    if (viewportName === "se") {
      assert.equal(
        await page.locator(".fraction-action-row button small").first().isVisible(),
        false,
        "compact calculator helper labels should collapse on SE-sized screens",
      );
    }
  }
  await assertNoHorizontalOverflow(page);
  await page.screenshot({ path: path.join(screenshotDir, `${viewportName}-calculator.png`), fullPage: true });
  await page.getByLabel("Heavy 16th field calculator").getByRole("button", { name: "Back to tools" }).click();

  await primaryTool("Estimate").click();
  await page.getByRole("heading", { name: "Estimate builder" }).waitFor({ timeout: 15_000 });
  const estimateSteps = page.getByRole("navigation", { name: "Estimate steps" });
  assert.equal(await estimateSteps.getByRole("button", { name: "1 Price" }).getAttribute("aria-current"), "step");
  await page.getByText("Recommended target", { exact: true }).waitFor({ timeout: 15_000 });
  assert.equal(await page.getByLabel("Customer email").count(), 0, "Customer fields should stay out of the pricing step");
  await estimateSteps.getByRole("button", { name: "2 Customer" }).click();
  await page.getByLabel("Customer email").fill("estimate@example.com");
  await estimateSteps.getByRole("button", { name: "3 Review" }).click();
  await page.getByText(/labor load/i).waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: "Send" }).waitFor({ timeout: 15_000 });
  await assertNoHorizontalOverflow(page);
  await page.screenshot({ path: path.join(screenshotDir, `${viewportName}-estimate.png`), fullPage: true });
  await page.getByLabel("Estimate builder").getByRole("button", { name: "Tools" }).click();

  await primaryTool("Invoice").click();
  await page.getByRole("heading", { name: "Invoice", exact: true }).first().waitFor({ timeout: 15_000 });
  const invoiceTabs = page.getByRole("navigation", { name: "Invoice sections" });
  assert.equal(
    await invoiceTabs.getByRole("button", { name: "Draft", exact: true }).getAttribute("aria-current"),
    "page",
    "Invoice should open on the Draft section",
  );
  await page.getByLabel("Invoice templates").getByText("Templates", { exact: true }).click();
  await page.getByLabel("Template name").fill(`${viewportName} invoice template`);
  await page.getByRole("button", { name: "Save template" }).click();
  await page.getByText("Template saved.", { exact: true }).waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: "Load" }).first().waitFor({ timeout: 15_000 });
  const invoiceDraftSteps = page.getByRole("navigation", { name: "Invoice draft steps" });
  assert.equal(await invoiceDraftSteps.getByRole("button", { name: "1 Items" }).getAttribute("aria-current"), "step");
  await invoiceDraftSteps.getByRole("button", { name: "2 Customer" }).click();
  await page.getByLabel("Recipient email").fill("billing@example.com");
  await page.getByLabel("Recipient phone").fill("+19045550123");
  await invoiceDraftSteps.getByRole("button", { name: "3 Review" }).click();
  await page.getByRole("link", { name: "Email draft" }).waitFor({ timeout: 15_000 });
  await page.getByRole("link", { name: "Text draft" }).waitFor({ timeout: 15_000 });
  await page.getByRole("heading", { name: "Preview before delivery" }).waitFor({ timeout: 15_000 });
  await page.getByLabel("Printable invoice preview").getByText("Total due", { exact: true }).waitFor({ timeout: 15_000 });
  await page.getByText("Email and text open on your device.", { exact: false }).waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: "Print / save PDF" }).waitFor({ timeout: 15_000 });
  if (isHandsetViewport) {
    await assertImmersiveToolChromeHidden(page, "invoice draft");
  }
  await assertNoHorizontalOverflow(page);
  await page.screenshot({ path: path.join(screenshotDir, `${viewportName}-invoice.png`), fullPage: true });
  await invoiceTabs.getByRole("button", { name: "Receivables", exact: true }).click();
  assert.equal(
    await invoiceTabs.getByRole("button", { name: "Receivables", exact: true }).getAttribute("aria-current"),
    "page",
    "Receivables should be reachable inside Invoice",
  );
  await page.screenshot({ path: path.join(screenshotDir, `${viewportName}-invoice-receivables.png`), fullPage: true });
  await page.getByLabel("Invoice", { exact: true }).getByRole("button", { name: "Tools" }).click();

  await page.goto(`${baseUrl}/app/tools?tool=payments`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Invoice", exact: true }).first().waitFor({ timeout: 15_000 });
  assert.equal(
    await page.getByRole("navigation", { name: "Invoice sections" }).getByRole("button", { name: "Receivables", exact: true }).getAttribute("aria-current"),
    "page",
    "Legacy payments links should open Invoice on the Receivables section",
  );
  await page.getByLabel("Invoice", { exact: true }).getByRole("button", { name: "Tools" }).click();

  await fieldToolsTray.getByRole("button", { name: "Jobsite", exact: true }).click();
  await page.getByRole("heading", { name: "Jobsite", exact: true }).waitFor({ timeout: 15_000 });
  await page.getByLabel("Jobsite sections").getByRole("button", { name: "Log", exact: true }).waitFor({ timeout: 15_000 });
  await page.getByRole("heading", { name: "Today's jobsite", exact: true }).waitFor({ timeout: 15_000 });
  await page.getByLabel("Site / job").waitFor({ timeout: 15_000 });
  await page.getByLabel("Daily log steps").getByRole("button", { name: /Work/ }).click();
  await page.getByLabel("Work completed").fill("Installed devices, labeled panel schedule, and cleaned up the work area.");
  await page.getByText("Blockers, materials, and safety", { exact: true }).click();
  await page.getByLabel("Blockers / changes").fill("Waiting on final fixture selections before trim-out can close.");
  await page.getByLabel("Safety note").fill("Verified ladder setup and kept panel covered while working.");
  await page.getByLabel("Daily log steps").getByRole("button", { name: /Review/ }).click();
  await page.getByText("Records-ready", { exact: true }).waitFor({ timeout: 15_000 });
  await page.getByText("Tenant Build-Out", { exact: true }).waitFor({ timeout: 15_000 });
  await page.getByLabel("Daily log checklist").getByText("Checklist", { exact: true }).click();
  await page.getByRole("button", { name: "Photos captured" }).click();
  await page.getByRole("button", { name: "Safety condition checked" }).click();
  await page.getByLabel("Daily log text preview").getByText("Open text preview", { exact: true }).click();
  await page.locator(".v2-daily-log-preview").waitFor({ timeout: 15_000 });
  await page.locator(".v2-daily-log-preview").getByText("Installed devices", { exact: false }).waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: "Save to Records" }).click();
  await page.getByText("Daily log saved to the server-backed Records timeline.", { exact: true }).waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: "Save draft" }).click();
  await page.getByText("Daily log draft saved.", { exact: true }).waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: "Copy daily log" }).waitFor({ timeout: 15_000 });
  await assertNoHorizontalOverflow(page);
  await page.screenshot({ path: path.join(screenshotDir, `${viewportName}-daily-log.png`), fullPage: true });
  await page.getByLabel("Jobsite").getByRole("button", { name: "Tools" }).click();

  await page.goto(`${baseUrl}/app/tools?tool=punch-list`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Jobsite", exact: true }).waitFor({ timeout: 15_000 });
  await page.getByLabel("Jobsite sections").getByRole("button", { name: "Punch", exact: true }).waitFor({ timeout: 15_000 });
  await page.getByRole("heading", { name: "Punch list", exact: true }).waitFor({ timeout: 15_000 });
  await page.getByLabel("Punch list sections").getByRole("button", { name: /Add item/ }).click();
  await page.getByRole("heading", { name: "What needs fixing?", exact: true }).waitFor({ timeout: 15_000 });
  await page.getByLabel("Punch list sections").getByRole("button", { name: /Open/ }).click();
  await page.getByLabel("Jobsite sections").getByRole("button", { name: "Safety", exact: true }).click();
  await page.getByLabel("Safety check steps").getByRole("button", { name: /Check/ }).waitFor({ timeout: 15_000 });
  await page.getByRole("heading", { name: "PPE", exact: true }).waitFor({ timeout: 15_000 });
  await page.getByLabel("Safety check steps").getByRole("button", { name: /Details/ }).click();
  await page.getByRole("heading", { name: "Site details", exact: true }).waitFor({ timeout: 15_000 });
  await page.getByLabel("Safety check steps").getByRole("button", { name: /Sign off/ }).click();
  await page.getByRole("heading", { name: "Review and sign off", exact: true }).waitFor({ timeout: 15_000 });
  await assertNoHorizontalOverflow(page);
  await page.screenshot({ path: path.join(screenshotDir, `${viewportName}-jobsite.png`), fullPage: true });
  await page.getByLabel("Jobsite").getByRole("button", { name: "Tools" }).click();

  await fieldToolsTray.getByRole("button", { name: "Camera", exact: true }).click();
  await page.getByRole("heading", { name: "Private photos", exact: true }).waitFor({ timeout: 15_000 });
  await page.getByLabel("Camera actions").getByRole("button", { name: "Destination", exact: true }).click();
  const destinationDialog = page.getByRole("dialog", { name: "Choose work context" });
  await destinationDialog.getByText("Private albums", { exact: true }).waitFor({ timeout: 15_000 });
  await destinationDialog.getByRole("button", { name: /Private photos/i }).waitFor({ timeout: 15_000 });
  await destinationDialog.getByRole("button", { name: /Tenant Build-Out/i }).click();
  await page.getByRole("heading", { name: "Tenant Build-Out", exact: true }).waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: "Capture", exact: true }).waitFor({ timeout: 15_000 });
  assert.equal(await page.getByText("Private albums", { exact: true }).count(), 0, "RIVT job context should not mix in private albums");
  await assertNoHorizontalOverflow(page);
  await page.screenshot({ path: path.join(screenshotDir, `${viewportName}-camera-home.png`), fullPage: true });
  await page.getByRole("button", { name: "Capture", exact: true }).click();
  await page.getByLabel("Take photo").waitFor({ timeout: 15_000 });
  await page.getByLabel("Saving photos to Tenant Build-Out").waitFor({ timeout: 15_000 });
  const captureTypes = page.getByRole("group", { name: "Capture type" });
  await captureTypes.getByRole("button", { name: "Issue" }).click();
  await assert.equal(await captureTypes.getByRole("button", { name: "Issue" }).getAttribute("aria-pressed"), "true");
  await page.getByRole("button", { name: "Switch camera" }).click();
  await page.waitForFunction(() => {
    const shutter = document.querySelector(".v2-camera-shutter");
    return shutter instanceof HTMLButtonElement && !shutter.disabled;
  }, null, { timeout: 15_000 });
  await page.getByLabel("Take photo").click();
  await page.locator(".v2-camera-save-status", { hasText: "1 of 1 didn't upload - retry the failed photo." }).waitFor({ timeout: 15_000 });
  await page.locator(".v2-camera-retry").click();
  await page.getByText("Saved to Tenant Build-Out.", { exact: true }).waitFor({ timeout: 15_000 });
  await page.getByLabel("1 photos saved in this camera session").waitFor({ timeout: 15_000 });
  await assertNoHorizontalOverflow(page);
  await page.screenshot({ path: path.join(screenshotDir, `${viewportName}-camera.png`) });
  await page.getByRole("button", { name: "Back" }).click();
  await page.locator(".v2-job-photos-stats strong", { hasText: "1" }).waitFor({ timeout: 15_000 });
  await page.locator(".v2-job-photo-timeline-row").first().waitFor({ timeout: 15_000 });
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
    { name: "se", width: 320, height: 568 },
  ]) {
    const context = await browser.newContext({ viewport, serviceWorkers: "block" });
    const page = await context.newPage();
    const errors = [];
    page.on("console", (message) => {
      if (message.type() === "error" && !/status of 503 \(Service Unavailable\)/i.test(message.text())) {
        errors.push(message.text());
      }
    });
    page.on("requestfailed", (request) => {
      errors.push(`${request.url()} :: ${request.failure()?.errorText ?? "request failed"}`);
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


