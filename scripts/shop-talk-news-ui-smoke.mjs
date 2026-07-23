import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import { newsInternals } from "../server/news.js";

const port = 5194;
const baseUrl = `http://127.0.0.1:${port}`;
const projectRoot = process.cwd();
const viteBin = path.join(projectRoot, "node_modules", "vite", "bin", "vite.js");
const screenshotDir = path.join(os.tmpdir(), "rivt-shop-talk-news-pass");
const reactionStorageKey = "rivt-shop-talk-reactions-v1";
const reactionLedger = new Map();

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

const newsPhotoDataUri = (label, accent = "#ff4b00") =>
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

const hb803FailureSet = [
  ["Florida Law Removes Permits for Small Home Construction Projects - Construction Owners", "Construction Owners", "https://constructionowners.com/hb-803"],
  ["Florida Law Removes Permits for Small Home Construction Projects - constructionowners.com", "constructionowners.com", "https://constructionowners.com/news/hb-803-copy"],
  ["Florida HB 803 drops permitting for small residential projects - ENR", "ENR", "https://enr.com/florida-hb-803"],
  ["New Florida law cuts permit fees for minor home construction - NBC 6 South Florida", "NBC 6 South Florida", "https://nbcmiami.com/news/hb803"],
  ["Florida contractors can drop building permits under HB 803 - Insurance Journal", "Insurance Journal", "https://insurancejournal.com/hb-803"],
  ["Goodbye to these Florida permits as HB 803 takes effect - Florida Politics", "Florida Politics", "https://floridapolitics.com/hb803"],
  ["CS/HB 803 removes select building permits across Florida - Florida House", "Florida House", "https://myfloridahouse.gov/hb803"],
].map(([rawHeadline, source, url]) => ({
  headline: newsInternals._cleanHeadline(rawHeadline, source),
  summary: "Florida HB 803 changes permit requirements for small construction projects.",
  source,
  url,
  date: "May 10, 2026",
  publishedAt: "2026-05-10T12:00:00.000Z",
  category: "Codes",
  topics: ["Permits & inspections", "Codes & standards"],
  trades: ["Electrical", "General construction"],
  impactLevel: "routine",
  impactReason: "Current Florida permit-law coverage; confirm applicability with the official source.",
  sourceKind: source === "Florida House" ? "official" : "publisher",
  geography: "local",
  isLocal: true,
}));
const hb803Story = {
  ...newsInternals._clusterStories(newsInternals._dedupeAndDiversify(hb803FailureSet, 30))[0],
  id: "florida-hb-803",
};

const newsPayload = {
  fallback: false,
  resources: [
    { title: "Florida licensing portal", source: "DBPR", url: "https://www.myfloridalicense.com/" },
    { title: "Jacksonville permit references", source: "City of Jacksonville", url: "https://www.jacksonville.gov/permits" },
  ],
  items: [
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
      publishedAt: "2026-07-21T14:00:00.000Z",
      urgency: "Safety",
      category: "Safety",
      topics: ["Safety & OSHA", "Weather & jobsite"],
      trades: ["General construction"],
      impactLevel: "critical",
      impactReason: "The source describes an urgent jobsite safety issue.",
      sourceKind: "official",
      geography: "local",
      isLocal: true,
    },
    hb803Story,
    {
      id: "refrigerant-transition",
      headline: "HVAC refrigerant transition keeps callback risk high",
      summary:
        "Contractors are watching equipment labels, recovery practices, and compatible tooling as newer refrigerants hit more field installs.",
      source: "EPA SNAP",
      url: "https://www.epa.gov/snap",
      date: "Jun 19, 2026",
      publishedAt: "2026-07-20T14:00:00.000Z",
      trades: ["HVAC"],
      urgency: "Code watch",
      category: "Codes",
      topics: ["Codes & standards", "Tools & equipment"],
      impactLevel: "high",
      impactReason: "The source describes a compliance or equipment change.",
      sourceKind: "official",
      geography: "local",
      isLocal: true,
    },
    {
      id: "florida-labor-market",
      headline: "Florida contractors watch apprenticeship enrollment gains",
      summary: "New enrollment data shows where skilled-trade training capacity is growing.",
      source: "Florida workforce update",
      url: "https://example.com/florida-apprenticeships",
      date: "Jul 19, 2026",
      publishedAt: "2026-07-19T14:00:00.000Z",
      trades: ["General construction"],
      category: "Labor",
      topics: ["Labor & workforce"],
      impactLevel: "routine",
      impactReason: "New workforce data for Florida contractors.",
      sourceKind: "publisher",
      geography: "local",
      isLocal: true,
    },
  ],
};
newsPayload.items = newsInternals._partitionNewsAndResources([
  ...newsPayload.items,
  {
    id: "stale-project-story",
    headline: "Stale civic center construction milestone",
    summary: "A four-month-old project update should not appear in the live feed.",
    source: "Old project desk",
    url: "https://example.com/stale-civic-center",
    date: "Mar 15, 2026",
    publishedAt: "2026-03-15T12:00:00.000Z",
    category: "Projects",
    topics: ["Projects & development"],
    trades: ["General construction"],
    impactLevel: "routine",
    geography: "local",
    isLocal: true,
  },
], Date.parse("2026-07-23T12:00:00.000Z")).news;
const nationalNewsPayload = {
  fallback: false,
  resources: [],
  items: [{
    id: "national-electrical-code",
    headline: "National electrical code update changes service planning",
    summary: "Electrical contractors review updated service and equipment requirements.",
    source: "National trade desk",
    url: "https://example.com/national-electrical-code",
    thumbnailUrl: newsPhotoDataUri("NATIONAL CODE"),
    thumbnailKind: "article",
    date: "Jun 22, 2026",
    publishedAt: "2026-07-22T14:00:00.000Z",
    category: "Codes",
    topics: ["Codes & standards"],
    trades: ["Electrical"],
    impactLevel: "high",
    impactReason: "The source describes a national code change.",
    geography: "national",
  }],
};

function reactionLedgerKey(targetType, targetKey) {
  return `${targetType}:${targetKey}`;
}

function reactionSummary() {
  const active = [...reactionLedger.values()];
  return {
    reactionsGiven: active.length,
    upvotesGiven: active.filter((reaction) => reaction.reaction === "up").length,
    downvotesGiven: active.filter((reaction) => reaction.reaction === "down").length,
    targetsReacted: new Set(active.map((reaction) => reactionLedgerKey(reaction.targetType, reaction.targetKey))).size,
    lastReactedAt: active.length ? new Date().toISOString() : null,
  };
}

function reactionAggregate(target) {
  const active = [...reactionLedger.values()].filter((reaction) => (
    reaction.targetType === target.targetType && reaction.targetKey === target.targetKey
  ));
  return {
    targetType: target.targetType,
    targetKey: target.targetKey,
    upvotes: active.filter((reaction) => reaction.reaction === "up").length,
    downvotes: active.filter((reaction) => reaction.reaction === "down").length,
    score: active.filter((reaction) => reaction.reaction === "up").length - active.filter((reaction) => reaction.reaction === "down").length,
    viewerReaction: reactionLedger.get(reactionLedgerKey(target.targetType, target.targetKey))?.reaction ?? null,
  };
}

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
  await page.route("https://fonts.googleapis.com/**", (route) => route.fulfill({ status: 200, contentType: "text/css", body: "" }));
  await page.addInitScript((storageKey) => {
    window.localStorage.removeItem(storageKey);
  }, reactionStorageKey);
  reactionLedger.clear();
  await page.route("http://127.0.0.1:8787/api/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: {}, meta: { nextCursor: null } }),
    }),
  );
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
  await page.route(/\/api\/v1\/communities(?:\?.*)?$/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          communities: [
            { id: "community-carpentry", slug: "carpentry-talk", name: "Carpentry Talk", description: "Trim, framing, punch-out", audience: "public", memberCount: 2, joined: false, role: null },
            { id: "community-jax", slug: "jacksonville-trades", name: "Jacksonville Trades", description: "Local work and referrals", audience: "public", memberCount: 3, joined: true, role: "member" },
          ],
        },
      }),
    }),
  );
  await page.route(/\/api\/v1\/shop-talk\/posts(?:\?.*)?$/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          posts: [
            {
              id: "shop-talk-ui-scope-change",
              author: "RIVT",
              trade: "General",
              flair: "Question",
              type: "question",
              title: "What's the best way to handle a mid-job scope change without losing margin?",
              body: "Share the field process that keeps the change documented and priced.",
              status: "Needs a pro answer",
              createdAt: "2026-07-15T12:00:00.000Z",
              communitySlug: "jacksonville-trades",
              communityName: "Jacksonville Trades",
              communityAudience: "public",
              answers: [],
              media: [],
            },
            {
              id: "shop-talk-ui-heat-safety",
              author: "RIVT",
              trade: "General",
              flair: "Discussion",
              type: "general",
              title: "How are you handling the new OSHA heat rule on outdoor jobs this summer?",
              body: "Compare practical heat plans, scheduling changes, and field routines.\n\nhttps://www.osha.gov/heat-exposure?ref=shop-talk",
              status: "Open",
              createdAt: "2026-07-15T11:00:00.000Z",
              communitySlug: "jacksonville-trades",
              communityName: "Jacksonville Trades",
              communityAudience: "public",
              answers: [{ id: "heat-reply-1", author: "Field Pro", body: "We moved heavy work earlier.", createdAt: "2026-07-15T11:30:00.000Z" }],
              media: [],
            },
          ],
        },
      }),
    }),
  );
  await page.route(/\/api\/v1\/shop-talk\/posts\/[^/]+\/answers$/, async (route) => {
    const requestBody = route.request().postDataJSON();
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          answer: {
            id: "shop-talk-ui-answer",
            author: account.profile.displayName,
            body: String(requestBody?.body ?? ""),
            verifiedFix: false,
            createdAt: "2026-07-15T12:30:00.000Z",
          },
        },
      }),
    });
  });
  await page.route(/\/api\/v1\/active-work\/?(?:\?.*)?$/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { activeWork: [] } }),
    }),
  );
  await page.route("**/api/v1/shop-talk/reactions/batch", async (route) => {
    const body = route.request().postDataJSON();
    const targets = Array.isArray(body?.targets) ? body.targets : [];
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          reactions: targets.map(reactionAggregate),
          reputation: reactionSummary(),
        },
      }),
    });
  });
  await page.route("**/api/v1/shop-talk/reactions", async (route) => {
    const body = route.request().postDataJSON();
    const target = { targetType: body.targetType, targetKey: body.targetKey };
    const key = reactionLedgerKey(target.targetType, target.targetKey);
    if (body.reaction === "up" || body.reaction === "down") {
      reactionLedger.set(key, { ...target, reaction: body.reaction });
    } else {
      reactionLedger.delete(key);
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          reaction: reactionAggregate(target),
          reputation: reactionSummary(),
        },
      }),
    });
  });
  await page.route("**/api/v1/jobs?**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { jobs: [] }, meta: { nextCursor: null } }),
    }),
  );
  await page.route("**/api/storage", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ usedBytes: 0, objectCount: 0, plan: {} }),
    }),
  );
  await page.route("**/api/news**", (route) => {
    const requestUrl = new URL(route.request().url());
    const payload = requestUrl.searchParams.has("location") ? newsPayload : nationalNewsPayload;
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payload) });
  });
}

async function assertNoHorizontalOverflow(page) {
  const hasOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  assert.equal(hasOverflow, false, "page has horizontal overflow");
}

async function prepareScreenshot(page) {
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  });
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
    page.on("requestfailed", (request) => {
      const failure = request.failure()?.errorText ?? "request failed";
      if (failure.includes("ERR_NETWORK_ACCESS_DENIED")) errors.push(`${failure}: ${request.url()}`);
    });

    await configurePage(page);

    await page.goto(`${baseUrl}/app/network/talk`, { waitUntil: "networkidle" });
    await page.getByLabel("Shop Talk community").getByRole("button", { name: "Feed" }).waitFor({ timeout: 15_000 });
    await page.getByRole("button", { name: "Communities" }).click();
    await page.getByRole("heading", { name: "Discover communities" }).waitFor({ timeout: 15_000 });
    await page.getByRole("button", { name: "Create" }).waitFor({ timeout: 15_000 });
    await assertNoHorizontalOverflow(page);
    await prepareScreenshot(page);
    await page.screenshot({ path: path.join(screenshotDir, `${viewport.name}-communities.png`), fullPage: true });
    await page.locator(".community-directory-main").filter({ hasText: "Carpentry Talk" }).first().click();
    await page.getByRole("heading", { name: "Carpentry Talk", exact: true }).waitFor({ timeout: 15_000 });
    if (viewport.name === "mobile") {
      const communityHeaderBox = await page.locator(".community-page-card").boundingBox();
      const scopedFeedBox = await page.locator(".shop-talk-feed-panel").boundingBox();
      assert.ok(communityHeaderBox && scopedFeedBox && communityHeaderBox.y < scopedFeedBox.y, "selected community identity should precede its mobile feed");
    }
    await page.getByRole("button", { name: "All communities" }).click();
    await page.getByRole("button", { name: "Feed" }).click();
    await page.getByRole("button", { name: "Post", exact: true }).waitFor({ timeout: 15_000 });
    await page.locator(".trade-post").filter({ hasText: "mid-job scope change without losing margin" }).first().waitFor({ timeout: 15_000 });
    await page.getByText(/new OSHA heat rule/i).waitFor({ timeout: 15_000 });
    const talkSearch = page.locator('.shop-talk-search input[type="search"]');
    await talkSearch.fill("scope");
    await assertNoHorizontalOverflow(page);
    await talkSearch.fill("");
    await prepareScreenshot(page);
    await page.screenshot({ path: path.join(screenshotDir, `${viewport.name}-feed.png`), fullPage: true });
    await page.locator(".trade-post").first().click();
    await page.getByText("Good answers get specific.", { exact: true }).waitFor({ timeout: 15_000 });
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

    await assertNoHorizontalOverflow(page);
    await prepareScreenshot(page);
    await page.screenshot({ path: path.join(screenshotDir, `${viewport.name}-talk.png`), fullPage: true });

    const mobileBack = page.locator(".mobile-back-btn").filter({ hasText: "Back" }).first();
    if ((await mobileBack.count()) > 0 && (await mobileBack.isVisible())) {
      await mobileBack.click();
    }
    await page.getByRole("button", { name: "Trade News" }).click();
    const newsList = page.locator(".shop-news-list");
    await newsList.getByText("CS/HB 803 removes select building permits across Florida", { exact: false }).first().waitFor({ timeout: 15_000 });
    assert.equal(await page.locator(".news-channel-nav").count(), 1, "Trade News should have exactly one channel row");
    assert.equal(await page.locator(".news-command").count(), 0, "legacy news hero should be removed");
    assert.equal(await page.locator(".news-briefing-strip").count(), 0, "legacy briefing strip should be removed");
    assert.equal(await page.locator(".shop-news-list select").count(), 0, "feed should not contain select filters");
    assert.ok(await page.getByText("Local references · official portals", { exact: true }).isVisible(), "official references should be separated from news");
    assert.equal(await newsList.getByText(/2014/).count(), 0, "stale dates should never appear as feed news");
    assert.equal(await newsList.getByText("Stale civic center construction milestone", { exact: false }).count(), 0, "stories older than 90 days should not render");
    assert.equal(await newsList.getByText(/Florida Law Removes Permits for Small Home Construction Projects/i).count(), 0, "duplicate HB 803 cards should collapse into the official primary");
    assert.equal(await newsList.getByText(/[5-9] sources/i).count(), 1, "the collapsed HB 803 story should expose its real related-source count");
    const renderedHeadlines = await newsList.locator(".news-card-body > strong, .news-featured-copy > strong").allTextContents();
    const normalizedHeadlines = renderedHeadlines.map((headline) => headline.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim());
    assert.equal(new Set(normalizedHeadlines).size, normalizedHeadlines.length, "rendered news titles should be unique");
    assert.ok(renderedHeadlines.every((headline) => !/\s-\s(?:Construction Owners|constructionowners\.com|ENR|NBC|Insurance Journal|Florida Politics|Florida House)$/i.test(headline)), "publisher suffixes should not render in headlines");
    const visibleTagKinds = await newsList.locator(".news-type-tag").evaluateAll((nodes) => [...new Set(nodes.filter((node) => {
      const style = getComputedStyle(node);
      return style.display !== "none" && style.visibility !== "hidden";
    }).map((node) => [...node.classList].find((name) => name.startsWith("is-"))))]);
    assert.ok(visibleTagKinds.length >= 2, "mixed-category news should render at least two distinct tag kinds");
    assert.equal(await page.getByText(/0 new this week/i).count(), 0, "the intel strip must never headline zero new stories");
    await page.getByText("Featured briefing", { exact: true }).waitFor({ timeout: 15_000 });
    await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
    const darkNewsSurface = await page.locator('[aria-label="Trade News feed"]').evaluate((node) => getComputedStyle(node).backgroundColor);
    await page.screenshot({ path: path.join(screenshotDir, `${viewport.name}-news-featured-dark.png`), fullPage: true });
    await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
    const lightNewsSurface = await page.locator('[aria-label="Trade News feed"]').evaluate((node) => getComputedStyle(node).backgroundColor);
    await page.screenshot({ path: path.join(screenshotDir, `${viewport.name}-news-featured-light.png`), fullPage: true });
    assert.notEqual(darkNewsSurface, lightNewsSurface, "Trade News should inherit distinct dark and light token surfaces");
    const renderedCards = await newsList.locator(".shop-news-card").count();
    const criticalMarkers = await newsList.locator(".news-critical-marker").count();
    assert.ok(criticalMarkers <= Math.floor(renderedCards * 0.25), "critical markers must remain scarce");
    assert.equal(await newsList.getByText("1 replies", { exact: true }).count(), 1, "only the real linked thread should show a reply count");
    assert.equal(await newsList.getByRole("link", { name: "Read original", exact: true }).first().evaluate((node) => getComputedStyle(node).textTransform), "none");
    await assertNoHorizontalOverflow(page);
    await page.getByRole("button", { name: /Customize/i }).click();
    const customize = page.getByLabel("Customize Trade News");
    await customize.getByRole("button", { name: "Follow HVAC", exact: true }).click();
    await customize.getByRole("button", { name: "Close Trade News customization" }).click();
    await page.getByRole("button", { name: "Following", exact: true }).click();
    await newsList.getByText("HVAC refrigerant transition", { exact: false }).first().waitFor();
    await page.getByRole("button", { name: "Critical", exact: true }).click();
    await newsList.getByText("OSHA heat safety", { exact: false }).first().waitFor();
    await page.getByRole("button", { name: "For you", exact: true }).click();
    await page.getByRole("button", { name: "Search Trade News" }).click();
    await page.locator('input[placeholder="Search trades, codes, safety, local"]').fill("permit");
    await page
      .locator(".shop-news-list")
      .getByText("CS/HB 803 removes select building permits across Florida", { exact: false })
      .first()
      .waitFor({ timeout: 15_000 });
    await page.getByRole("link", { name: /Read original/i }).first().waitFor({ timeout: 15_000 });
    await assertNoHorizontalOverflow(page);
    await prepareScreenshot(page);
    await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
    await page.screenshot({ path: path.join(screenshotDir, `${viewport.name}-news-dark.png`), fullPage: true });
    await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
    await page.screenshot({ path: path.join(screenshotDir, `${viewport.name}-news-light.png`), fullPage: true });

    assert.equal(errors.length, 0, `${viewport.name} console errors: ${errors.join("\n")}`);
    await context.close();
  }

  console.log(`Shop Talk / Trade News rendered QA passed. Screenshots: ${screenshotDir}`);
} finally {
  await browser?.close();
  vite.kill();
}
