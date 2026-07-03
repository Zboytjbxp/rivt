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
      themePalette: "tradeGreen",
      onToggleTheme: noop,
      onSelectThemePalette: noop,
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
