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

test("Home dashboard renders without crashing", async () => {
  const { HomeDashboard } = await loadModule("/src/features/home/HomeDashboard.tsx");

  assertSmokeRender(
    React.createElement(HomeDashboard, {
      role: "contractor",
      name: "RIVT Tester",
      location: "Jacksonville, FL",
      activeJob: smokeJob,
      upcomingJobs: [smokeJob],
      applicationCount: 2,
      unreadCount: 1,
      pendingPaymentCount: 0,
      communityCount: 3,
      shoutOutCount: 1,
      availabilityStatus: "available",
      primaryTrade: "Electrical",
      newsCount: 4,
      answerQueueCount: 1,
      onPostJob: noop,
      onOpenJob: noop,
      onNavigate: noop,
      onSetAvailability: asyncNoop,
    }),
    /RIVT Daily/,
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
