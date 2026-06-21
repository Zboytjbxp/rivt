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
const reactionStorageKey = "rivt-shop-talk-reactions-v1";

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

const newsPhotoDataUri = (label, accent = "#ff6a00") =>
  `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 560">
      <defs>
        <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="#17242c"/>
          <stop offset="0.52" stop-color="#2d3940"/>
          <stop offset="1" stop-color="#0a0f12"/>
        </linearGradient>
      </defs>
      <rect width="900" height="560" fill="url(#bg)"/>
      <rect x="0" y="390" width="900" height="170" fill="#111" opacity="0.42"/>
      <path d="M90 360h720v26H90zM140 306h620v22H140zM190 254h520v20H190z" fill="${accent}" opacity="0.72"/>
      <circle cx="710" cy="138" r="58" fill="${accent}" opacity="0.86"/>
      <text x="64" y="98" fill="#fff" font-family="Arial, sans-serif" font-size="44" font-weight="800">${label}</text>
    </svg>
  `)}`;

const newsPayload = {
  items: [
    {
      id: "jax-permit-watch",
      headline: "Jacksonville permit desk adds same-day trade inspection slots",
      summary:
        "City update: contractors can request select same-day inspection windows for electrical, plumbing, HVAC, and closeout work in active neighborhoods.",
      source: "Jacksonville Building Inspection Division",
      url: "https://www.jacksonville.gov/departments/planning-and-development/building-inspection-division",
      thumbnailUrl: newsPhotoDataUri("JAX PERMIT WATCH"),
      thumbnailKind: "article",
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
      thumbnailUrl: newsPhotoDataUri("HEAT SAFETY", "#f97316"),
      thumbnailKind: "article",
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
      thumbnailKind: "fallback",
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
  await page.addInitScript((storageKey) => {
    window.localStorage.removeItem(storageKey);
  }, reactionStorageKey);
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
    await page.getByText("Social hub", { exact: true }).waitFor({ timeout: 15_000 });
    await page.locator(".shop-post-card").first().click();
    const upvoteThread = page.getByRole("button", { name: "Upvote thread" }).first();
    const threadInitial = (await upvoteThread.textContent())?.trim() ?? "";
    await upvoteThread.click();
    const removeThreadUpvote = page.getByRole("button", { name: "Remove upvote from thread" }).first();
    await removeThreadUpvote.waitFor({ timeout: 15_000 });
    const threadUpvoted = (await removeThreadUpvote.textContent())?.trim() ?? "";
    assert.notEqual(threadUpvoted, threadInitial, "thread upvote should move the count once");
    await removeThreadUpvote.click();
    await page.getByRole("button", { name: "Upvote thread" }).first().waitFor({ timeout: 15_000 });
    const threadCleared = (await page.getByRole("button", { name: "Upvote thread" }).first().textContent())?.trim() ?? "";
    assert.equal(threadCleared, threadInitial, "clicking the same thread reaction again should clear it");

    await page
      .locator('textarea[placeholder^="Share the field habit"]')
      .fill("Document the condition, price the change order, and get written approval before the crew keeps going.");
    await page.getByRole("button", { name: /Post answer/i }).click();
    await page.getByText("Document the condition", { exact: false }).waitFor({ timeout: 15_000 });
    const upvoteAnswer = page.getByRole("button", { name: "Upvote answer" }).first();
    const answerInitial = (await upvoteAnswer.textContent())?.trim() ?? "";
    await upvoteAnswer.click();
    const removeAnswerUpvote = page.getByRole("button", { name: "Remove upvote from answer" }).first();
    await removeAnswerUpvote.waitFor({ timeout: 15_000 });
    const answerUpvoted = (await removeAnswerUpvote.textContent())?.trim() ?? "";
    assert.notEqual(answerUpvoted, answerInitial, "answer upvote should move the count once");
    await removeAnswerUpvote.click();
    await page.getByRole("button", { name: "Upvote answer" }).first().waitFor({ timeout: 15_000 });
    const answerCleared = (await page.getByRole("button", { name: "Upvote answer" }).first().textContent())?.trim() ?? "";
    assert.equal(answerCleared, answerInitial, "clicking the same answer reaction again should clear it");

    const talkSearch = page.locator('input[placeholder="Search questions, trades, fixes"]');
    if (!(await talkSearch.isVisible())) {
      await page.getByRole("button", { name: /Back/i }).first().click();
    }
    await talkSearch.fill("scope");
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
    await page.locator(".shop-news-list .news-card-thumb.is-real img").first().waitFor({ timeout: 15_000 });
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
