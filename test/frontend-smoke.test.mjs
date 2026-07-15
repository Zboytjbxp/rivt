import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import React from "react";
import { renderToString } from "react-dom/server";
import { createServer } from "vite";

let viteServer;

const noop = () => {};
const asyncNoop = async () => {};

const smokeJob = {
  id: 1,
  title: "Panel upgrade support",
  contractor: "RIVT Test Contractor",
  trade: "Electrical",
  location: "Jacksonville, FL",
  state: "FL",
  distance: 4,
  pay: 850,
  durationHours: 8,
  workType: "Side work",
  difficulty: "Moderate",
  insuranceRequired: true,
  tools: ["Voltage tester", "Drill", "Ladder"],
  trustRequirement: "Legal agreement required",
  addressPolicy: "Exact address shared after acceptance",
  posted: "Today",
  match: 86,
  rating: 4.8,
  reviewCount: 12,
  applicants: 2,
  status: "Open",
  summary: "Assist with panel labeling and trim-out under contractor supervision.",
  guidance: ["Bring standard hand tools", "Confirm site access before arrival"],
  risks: ["Electrical work requires contractor oversight"],
  deliverables: ["Panel labels verified", "Work area cleaned"],
  matchFactors: ["Electrical experience", "Owns basic tools"],
};

before(async () => {
  viteServer = await createServer({
    appType: "custom",
    logLevel: "error",
    server: { middlewareMode: true },
  });
});

after(async () => {
  await viteServer?.close();
});

async function loadModule(path) {
  return viteServer.ssrLoadModule(path);
}

function assertSmokeRender(element, expectedText) {
  const html = renderToString(element);
  assert.ok(html.length > 100, "component rendered only a trivial HTML fragment");
  assert.match(html, expectedText);
  return html;
}

function createMemoryStorage(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (key) => store.has(key) ? store.get(key) : null,
    setItem: (key, value) => { store.set(key, String(value)); },
    removeItem: (key) => { store.delete(key); },
    clear: () => { store.clear(); },
  };
}

test("public tool catalog contains launch tools and rejects contained legacy routes", async () => {
  const { isPublicToolMode, PUBLIC_TOOL_MODES, CONTAINED_TOOL_MODES } = await loadModule("/src/features/tools/tool-catalog.ts");

  assert.equal(PUBLIC_TOOL_MODES.includes("invoice"), true);
  assert.equal(PUBLIC_TOOL_MODES.includes("job-photos"), true);
  assert.equal(isPublicToolMode("invoice"), true);
  assert.equal(isPublicToolMode("contracts"), false);
  assert.equal(isPublicToolMode("daily-report"), false);
  assert.equal(isPublicToolMode("not-a-tool"), false);
  assert.deepEqual(CONTAINED_TOOL_MODES, [
    "earnings",
    "bid-builder",
    "tax-estimator",
    "contracts",
    "job-checklist",
    "daily-report",
  ]);
});

test("mileage deductions use the IRS business rate for each trip date", async () => {
  const {
    mileageDeductionForEntries,
    mileageDeductionForEntry,
    mileageRateForDate,
    mileageRateSummaryForYear,
  } = await loadModule("/src/features/tools/mileage-rates.ts");

  assert.equal(mileageRateForDate("2024-01-01"), 0.67);
  assert.equal(mileageRateForDate("2025-12-31"), 0.70);
  assert.equal(mileageRateForDate("2026-06-30"), 0.725);
  assert.equal(mileageRateForDate("2026-07-01"), 0.76);
  assert.equal(mileageRateForDate("2027-01-01"), null);
  assert.equal(mileageDeductionForEntry({ date: "2026-07-01", miles: 10 }), 7.60);

  assert.deepEqual(mileageDeductionForEntries([
    { date: "2026-06-30", miles: 10 },
    { date: "2026-07-01", miles: 10 },
    { date: "2027-01-01", miles: 5 },
  ]), {
    deduction: 14.85,
    ratedMiles: 20,
    unratedMiles: 5,
  });
  assert.match(mileageRateSummaryForYear(2026), /\$0\.725\/mi through Jun 30; \$0\.76\/mi from Jul 1/);
  assert.equal(mileageRateSummaryForYear(2027), "No built-in IRS rate for this year");
});

test("rate card helper migrates legacy object data and reads array data", async () => {
  const previousWindow = globalThis.window;
  const localStorage = createMemoryStorage({
    "rivt.rateCard.v1": JSON.stringify({ hourlyRate: 88, primaryTrade: "Carpentry" }),
  });
  globalThis.window = { localStorage };

  try {
    const { readPrimaryHourlyRate, readPrimaryTradeFromRateCard, readRateCardEntries } = await loadModule("/src/lib/rateCard.ts");
    assert.equal(readPrimaryHourlyRate(65), 88);
    assert.equal(readPrimaryTradeFromRateCard(), "Carpentry");
    assert.equal(Array.isArray(JSON.parse(localStorage.getItem("rivt.rateCard.v1"))), true);

    localStorage.setItem("rivt.rateCard.v1", JSON.stringify([{ id: "finish", trade: "Finish carpentry", hourlyRate: 95, dayRate: 700, minimumCharge: 250, notes: "", updatedAt: new Date().toISOString() }]));
    assert.equal(readPrimaryHourlyRate(65), 95);
    assert.equal(readRateCardEntries()[0].trade, "Finish carpentry");
  } finally {
    if (previousWindow === undefined) {
      delete globalThis.window;
    } else {
      globalThis.window = previousWindow;
    }
  }
});

test("Home trade feed renders without crashing", async () => {
  const { TradeFeed } = await loadModule("/src/features/home/TradeFeed.tsx");

  assertSmokeRender(
    React.createElement(TradeFeed, {
      posts: [],
      name: "RIVT Tester",
      location: "Jacksonville, FL",
      primaryTrade: "Electrical",
      onOpenPost: noop,
      onAsk: noop,
      onPostWork: noop,
      onOpenCommunity: noop,
      onNavigate: noop,
    }),
    /Communities/,
  );
});

test("Home active-work summary hands off to one exact workspace when the project pulse is unavailable", async () => {
  const { TradeFeed } = await loadModule("/src/features/home/TradeFeed.tsx");
  const activeWork = {
    id: "c5ee1300-4a11-4e64-85c5-5f4f8f296204",
    jobId: "9a672730-f3a2-4e90-9716-4349a4daaef0",
    offerId: "d8a5aa73-4f5a-49e1-aa5a-6c2601d81210",
    organizationId: "a38864d0-c3aa-46d3-a72f-98a7b2207b4d",
    contractorAccountId: "e76f323a-f4e9-4e2e-b5f8-c0c547f85a10",
    tradespersonAccountId: "16d6531d-857d-42e8-b3fb-9b098338e926",
    status: "active",
    startedAt: new Date().toISOString(),
    completedAt: null,
    cancelledAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    events: [],
    job: {
      id: "9a672730-f3a2-4e90-9716-4349a4daaef0",
      title: "Warehouse trim closeout",
      status: "closed",
      organization: { id: "a38864d0-c3aa-46d3-a72f-98a7b2207b4d", name: "RIVT Test Co." },
      trade: { code: "carpentry", name: "Carpentry" },
      durationHours: 8,
      budget: { amountCents: 85000, currency: "USD", unit: "fixed" },
      publicLocation: { city: "Jacksonville", region: "FL", countryCode: "US" },
    },
  };

  const html = assertSmokeRender(
    React.createElement(TradeFeed, {
      posts: [],
      activeWork: [activeWork],
      name: "RIVT Tester",
      location: "Jacksonville, FL",
      primaryTrade: "Carpentry",
      onOpenPost: noop,
      onAsk: noop,
      onPostWork: noop,
      onOpenCommunity: noop,
      onNavigate: noop,
      onOpenActiveWorkWorkspace: noop,
    }),
    /Open workspace/,
  );
  assert.doesNotMatch(html, />Messages</, "summary card should hand off to the workspace instead of duplicating workspace actions");
  assert.doesNotMatch(html, />Photos</, "summary card should not duplicate the job photo action");
  assert.doesNotMatch(html, />Daily log</, "summary card should not duplicate the daily log action");
});

test("Work workspace renders without crashing", async () => {
  const { WorkWorkspace } = await loadModule("/src/features/work/WorkWorkspace.tsx");

  assertSmokeRender(
    React.createElement(WorkWorkspace, {
      role: "contractor",
      jobs: [smokeJob],
      selectedJob: smokeJob,
      loading: false,
      error: null,
      query: "",
      trade: "All trades",
      difficulty: "Any difficulty",
      workType: "All work types",
      locationQuery: "",
      verifiedOnly: false,
      onQueryChange: noop,
      onTradeChange: noop,
      onDifficultyChange: noop,
      onWorkTypeChange: noop,
      onLocationChange: noop,
      onVerifiedChange: noop,
      onSelectJob: noop,
      onPostJob: noop,
      onEditJob: noop,
      onTransition: asyncNoop,
      onJobLoaded: noop,
      onRetry: noop,
    }),
    /Panel upgrade support/,
  );
});

test("Profile hub renders without crashing", async () => {
  const { ProfileHub } = await loadModule("/src/features/profile/ProfileHub.tsx");

  assertSmokeRender(
    React.createElement(ProfileHub, {
      view: "Settings",
      role: "contractor",
      profile: {
        email: "tester@rivt.pro",
        displayName: "RIVT Tester",
        organization: "RIVT Test Co.",
        location: "Jacksonville, FL",
        specialties: ["Electrical"],
        plan: "Founding beta",
        authMethod: "Email",
      },
      canonicalProfile: {
        visibility: "network",
        emailVerified: true,
        headline: "Electrical contractor",
        bio: "Test profile for frontend smoke coverage.",
        serviceAreaCity: "Jacksonville",
        serviceAreaRegion: "FL",
        serviceRadiusMiles: 25,
        availabilityStatus: "available",
        contactEmailVisibility: "private",
        phoneE164: null,
        phoneVisibility: "private",
      },
      sessions: [],
      trustReady: true,
      recordCount: 0,
      trainingProgress: 50,
      safetyCertCount: 1,
      communityBadges: ["First Assist"],
      shoutOutCount: 2,
      feedbackCount: 0,
      themeMode: "light",
      themeSource: "light",
      onSetThemeSource: noop,
      onReviewConsent: noop,
      onLogout: noop,
      onSaveProfile: asyncNoop,
      onSetProfileVisibility: asyncNoop,
      onRevokeSession: asyncNoop,
      onRevokeOtherSessions: asyncNoop,
    }),
    /Settings/,
  );
});

test("App shell renders without crashing", async () => {
  const { AppShell } = await loadModule("/src/app-shell/AppShell.tsx");

  assertSmokeRender(
    React.createElement(
      AppShell,
      {
        activeDestination: "home",
        role: "contractor",
        profile: {
          name: "RIVT Tester",
          subtitle: "Electrical contractor",
          location: "Jacksonville, FL",
        },
        activeJob: {
          title: "Panel upgrade support",
          trade: "Electrical",
          location: "Jacksonville, FL",
          status: "Open",
        },
        notificationCount: 2,
        isGuest: false,
        onNavigate: noop,
        onOpenAccount: noop,
        onOpenMessages: noop,
        onOpenNotifications: noop,
        onOpenActiveJob: noop,
        onSearch: noop,
      },
      React.createElement("main", null, "Smoke content"),
    ),
    /Smoke content/,
  );
});

test("Moderation console renders without crashing", async () => {
  const { ModerationConsole } = await loadModule("/src/features/admin/ModerationConsole.tsx");

  assertSmokeRender(
    React.createElement(ModerationConsole, {
      adminRoles: ["moderator", "support"],
      onActivity: noop,
    }),
    /Shop Talk moderation/,
  );
});

test("Shop Talk composer defaults trade from selected community before poster trade", async () => {
  const { inferCommunityDefaultTrade } = await loadModule("/src/features/shop-talk/community-utils.ts");

  assert.equal(
    inferCommunityDefaultTrade({ slug: "carpentry-talk", name: "Carpentry Talk", meta: "Trim and framing" }, "Electrical"),
    "Carpentry",
  );
  assert.equal(
    inferCommunityDefaultTrade({ slug: "jacksonville-carpentry", name: "Jacksonville Carpentry", meta: "Local crews" }, "Electrical"),
    "Carpentry",
  );
  assert.equal(
    inferCommunityDefaultTrade({ slug: "jacksonville-trades", name: "Jacksonville Trades", meta: "Local work and referrals" }, "Plumbing"),
    "Plumbing",
  );
});
