import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";

const port = 5194;
const baseUrl = `http://127.0.0.1:${port}`;
const projectRoot = process.cwd();
const viteBin = path.join(projectRoot, "node_modules", "vite", "bin", "vite.js");
const screenshotDir = path.join(os.tmpdir(), "rivt-shop-talk-news-pass");

const vite = spawn(process.execPath, [viteBin, "--host", "127.0.0.1", "--port", String(port)], {
  cwd: projectRoot,
  env: { ...process.env, VITE_ENABLE_GUEST_DEMO: "false" },
  stdio: ["ignore", "pipe", "pipe"],
});

const account = {
  id: "shop-talk-ui-account",
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
  organizations: [{ id: "org-shop-talk-ui", name: "RIVT Test Crew", role: "owner" }],
  capabilities: {
    canCompleteOnboarding: false,
    canPostWork: true,
    canApplyToWork: false,
    canPublishProfile: true,
  },
};

const newsPayload = {
  items: [
    {
      id: "jax-permit-watch",
      headline: "Jacksonville permit desk adds same-day trade inspection slots",
      summary:
        "City update: contractors can request select same-day inspection windows for electrical, plumbing, HVAC, and closeout work in active neighborhoods.",
      source: "Jacksonville Building Inspection Division",
      url: "https://www.jacksonville.gov/departments/planning-and-development/building-inspection-division",
      thumbnailUrl: "/news/permit-watch.svg",
      date: "Jun 21, 2026",
      urgency: "Local update",
    },
    {
      id: "osha-heat-safety",
      headline: "OSHA heat safety push changes how crews plan afternoon work",
      summary:
        "Heat plans, water/rest/shade routines, and documented communication matter more during summer jobsite scheduling.",
      source: "OSHA",
      url: "https://www.osha.gov/heat-exposure",
      thumbnailUrl: "/news/heat-safety.svg",
      date: "Jun 20, 2026",
      urgency: "Safety",
    },
    {
      id: "refrigerant-transition",
      headline: "HVAC refrigerant transition keeps callback risk high",
      summary:
        "Contractors are watching equipment labels, recovery practices, and compatible tooling as newer refrigerants hit more field installs.",
      source: "EPA SNAP",
      url: "https://www.epa.gov/snap",
      thumbnailUrl: "/news/hvac-refrigerant.svg",
      date: "Jun 19, 2026",
      urgency: "Code watch",
    },
  ],
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
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: account }),
    }),
  );
  await page.route("**/api/auth/providers", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ providers: {} }) }),
  );
  await page.route("**/api/v1/sessions", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { sessions: [] } }),
    }),
  );
  await page.route("**/api/v1/conversations", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { conversations: [] } }),
    }),
  );
  await page.route("**/api/v1/notifications", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { notifications: [], unreadCount: 0 } }),
    }),
  );
  await page.route("**/api/v1/active-work", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { activeWork: [] } }),
    }),
  );
  await page.route("**/api/v1/jobs?**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { jobs: [] }, meta: { nextCursor: null } }),
    }),
  );
  await page.route("**/api/news?**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(newsPayload) }),
  );
}

async function assertNoHorizontalOverflow(page) {
  const hasOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  assert.equal(hasOverflow, false, "page has horizontal overflow");
}

let browser;

try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });
  await fs.mkdir(screenshotDir, { recursive: true });

  for (const viewport of [
    { name: "desktop", width: 1440, height: 900 },
    { name: "mobile", width: 390, height: 844 },
  ]) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));

    await configurePage(page);

    await page.goto(`${baseUrl}/app/network/talk`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: /Field answers/i }).waitFor({ timeout: 15_000 });
    await page.locator('input[placeholder="Search questions, trades, fixes"]').fill("safety");
    await assertNoHorizontalOverflow(page);
    await page.screenshot({ path: path.join(screenshotDir, `${viewport.name}-talk.png`), fullPage: true });

    await page.getByRole("button", { name: "Trade News" }).click();
    await page.getByRole("heading", { name: /Original sources/i }).waitFor({ timeout: 15_000 });
    await page.locator('input[placeholder="Search sources, codes, safety, local"]').fill("permit");
    await page
      .locator(".shop-news-list")
      .getByText("Jacksonville permit desk", { exact: false })
      .first()
      .waitFor({ timeout: 15_000 });
    await page.getByRole("link", { name: /Read original/i }).first().waitFor({ timeout: 15_000 });
    await assertNoHorizontalOverflow(page);
    await page.screenshot({ path: path.join(screenshotDir, `${viewport.name}-news.png`), fullPage: true });

    assert.equal(errors.length, 0, `${viewport.name} console errors: ${errors.join("\n")}`);
    await page.close();
  }

  console.log(`Shop Talk / Trade News rendered QA passed. Screenshots: ${screenshotDir}`);
} finally {
  await browser?.close();
  vite.kill();
}
