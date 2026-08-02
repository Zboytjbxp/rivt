import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

test("boot shell keeps executable scripts and styles external for strict CSP", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const serviceWorker = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");
  const inlineExecutableScripts = [...html.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*type=["']application\/ld\+json["'])[^>]*>[\s\S]*?<\/script>/gi)];

  assert.equal(inlineExecutableScripts.length, 0);
  assert.match(html, /href="\/rivt-boot\.css"/);
  assert.match(html, /src="\/rivt-boot\.js"/);
  assert.match(html, /src="\/rivt-service-worker\.js"/);
  assert.match(serviceWorker, /ROOT_SHELL_ASSETS\.has\(url\.pathname\)/);
});

test("unsigned query-string reports cannot render branded RIVT sign-off", () => {
  const appSource = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
  const serverSource = readFileSync(new URL("../server/index.js", import.meta.url), "utf8");
  const landingHtml = readFileSync(new URL("../public/landing.html", import.meta.url), "utf8");

  assert.doesNotMatch(appSource, /ReportViewer/);
  assert.doesNotMatch(appSource, /searchParams\.get\(["']report["']\)/i);
  assert.match(serverSource, /Legacy report links are retired/);
  assert.doesNotMatch(serverSource, /RIVT field report|Open a field report shared through RIVT/);
  assert.doesNotMatch(landingHtml, /Client report share link/);
});

test("offline recovery policy isolates accounts, coalesces drafts, and bounds retries and photos", async () => {
  const {
    OFFLINE_QUEUE_MAX_PHOTOS,
    OFFLINE_QUEUE_MAX_PHOTO_BYTES,
    findReplaceableOfflineOperation,
    isOfflineOperationStale,
    offlineFailureStatus,
    offlinePhotoQueueUsage,
    offlineRetryDelayMs,
  } = await loadModule("/src/lib/offline-queue.ts");
  const createdAt = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
  const base = {
    id: "offline-one",
    accountId: "account-one",
    kind: "daily_log_upsert",
    status: "queued",
    payload: { input: { localId: "daily-log-draft:work-one" } },
    idempotencyKey: "stable-request-key",
    dedupeKey: "daily-log-draft:work-one",
    label: "Daily log",
    destinationLabel: "Job one",
    createdAt,
    updatedAt: createdAt,
    attempts: 0,
    nextAttemptAt: null,
    lastError: null,
  };
  const draftInput = {
    accountId: "account-one",
    kind: "daily_log_upsert",
    payload: { input: { localId: "daily-log-draft:work-one" } },
    idempotencyKey: "new-key-that-must-not-replace-the-original",
    dedupeKey: "daily-log-draft:work-one",
    label: "Daily log",
    destinationLabel: "Job one",
  };

  assert.equal(findReplaceableOfflineOperation([base], draftInput)?.id, base.id);
  assert.equal(findReplaceableOfflineOperation([{ ...base, accountId: "account-two" }], draftInput), null);
  assert.equal(findReplaceableOfflineOperation([{ ...base, status: "syncing" }], draftInput), null);
  assert.equal(offlineFailureStatus(0), "queued");
  assert.equal(offlineFailureStatus(503), "queued");
  assert.equal(offlineFailureStatus(409), "conflicted");
  assert.equal(offlineFailureStatus(422), "failed");
  assert.equal(offlineRetryDelayMs(99), 300_000);
  assert.equal(isOfflineOperationStale(base), true);

  const photo = {
    ...base,
    id: "photo-one",
    kind: "project_media_upload",
    dedupeKey: null,
    payload: {
      projectId: "project-one",
      notes: "Progress",
      file: {
        blob: new Blob(["photo"]),
        name: "photo.jpg",
        type: "image/jpeg",
        lastModified: Date.now(),
        size: 5,
      },
    },
  };
  assert.deepEqual(offlinePhotoQueueUsage([photo, { ...photo, id: "other-photo", accountId: "account-two" }], "account-one"), {
    count: 1,
    bytes: 5,
  });
  assert.equal(OFFLINE_QUEUE_MAX_PHOTOS, 25);
  assert.equal(OFFLINE_QUEUE_MAX_PHOTO_BYTES, 10 * 1024 * 1024);
});

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

test("contact CSV import preserves multi-role identities and skips empty rows", async () => {
  const { parseContactsCsv, contactsCsv } = await loadModule("/src/features/network/contacts-api.ts");
  const parsed = parseContactsCsv(
    "\"Name\",\"Company\",\"Roles\",\"Email\",\"Phone\",\"Tags\",\"Notes\"\n"
    + "\"Morgan Lee\",\"First Coast Supply\",\"supplier; customer\",\"morgan@example.test\",\"904-555-0148\",\"local; fasteners\",\"Net 30\"\n"
    + "\"\",\"\",\"\",\"\",\"\",\"\",\"orphan note\"\n",
  );
  assert.equal(parsed.contacts.length, 1);
  assert.deepEqual(parsed.contacts[0].roles.map(({ role }) => role), ["supplier", "customer"]);
  assert.equal(parsed.contacts[0].methods[0].value, "morgan@example.test");
  assert.equal(parsed.skipped, 1);
  const exported = contactsCsv([{
    id: "contact-1",
    entityType: "person",
    name: "Morgan Lee",
    company: "First Coast Supply",
    notes: "Net 30",
    favorite: false,
    status: "active",
    linkedAccountId: null,
    lastUsedAt: null,
    roles: parsed.contacts[0].roles,
    methods: parsed.contacts[0].methods,
    addresses: [],
    tags: ["local", "fasteners"],
    createdAt: null,
    updatedAt: null,
  }]);
  assert.match(exported, /"supplier; customer"/);
  assert.match(exported, /"morgan@example\.test"/);
});

test("contact vCard import preserves selected details and applies the intended relationship", async () => {
  const { parseContactsVCard } = await loadModule("/src/features/contacts/contact-import.ts");
  const parsed = parseContactsVCard(
    "BEGIN:VCARD\r\n"
    + "VERSION:3.0\r\n"
    + "N:Rivera;Ana;;;\r\n"
    + "FN:Ana Rivera\r\n"
    + "ORG:Rivera Electric\r\n"
    + "EMAIL;TYPE=WORK:ANA@EXAMPLE.TEST\r\n"
    + "TEL;TYPE=CELL:+1 904 555 0124\r\n"
    + "ADR;TYPE=WORK:;;6563 Ector Place;Jacksonville;FL;32211;US\r\n"
    + "END:VCARD\r\n"
    + "BEGIN:VCARD\r\nVERSION:3.0\r\nEND:VCARD\r\n",
    "customer",
  );

  assert.equal(parsed.contacts.length, 1);
  assert.equal(parsed.skipped, 1);
  assert.equal(parsed.contacts[0].name, "Ana Rivera");
  assert.equal(parsed.contacts[0].company, "Rivera Electric");
  assert.deepEqual(parsed.contacts[0].roles.map(({ role }) => role), ["customer"]);
  assert.equal(parsed.contacts[0].methods[0].value, "ana@example.test");
  assert.match(parsed.contacts[0].addresses[0].address, /Jacksonville, FL, 32211/);
});

test("device contact picker imports only the contacts and fields the user selects", async () => {
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  let requestedProperties = [];
  let requestedMultiple = null;
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      contacts: {
        getProperties: async () => ["name", "email", "tel", "address"],
        select: async (properties, options) => {
          requestedProperties = properties;
          requestedMultiple = options.multiple;
          return [{
            name: ["Jordan Miller"],
            email: ["JORDAN@EXAMPLE.TEST"],
            tel: ["+1 904 555 0199"],
            address: [{ addressLine: ["100 Billing Lane"], city: "Jacksonville", region: "FL" }],
          }];
        },
      },
    },
  });
  try {
    const { deviceContactPickerSupported, pickDeviceContacts } = await loadModule("/src/features/contacts/contact-import.ts");
    assert.equal(deviceContactPickerSupported(), true);
    const contacts = await pickDeviceContacts({ multiple: true, role: "customer" });
    assert.deepEqual(requestedProperties, ["name", "email", "tel", "address"]);
    assert.equal(requestedMultiple, true);
    assert.equal(contacts.length, 1);
    assert.equal(contacts[0].name, "Jordan Miller");
    assert.equal(contacts[0].methods[0].value, "jordan@example.test");
    assert.equal(contacts[0].roles[0].role, "customer");
  } finally {
    if (originalNavigator) Object.defineProperty(globalThis, "navigator", originalNavigator);
    else delete globalThis.navigator;
  }
});

test("only account-owned estimate and invoice records receive document deep links", async () => {
  const { linkedRecordTypeForTool } = await loadModule("/src/features/tools/tool-record-links.ts");

  assert.equal(linkedRecordTypeForTool("estimate"), "estimate");
  assert.equal(linkedRecordTypeForTool("invoice"), "invoice_draft");
  assert.equal(linkedRecordTypeForTool("calculator"), null);
  assert.equal(linkedRecordTypeForTool("job-photos"), null);
  assert.equal(linkedRecordTypeForTool(null), null);
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

test("accessibility display preferences read persisted device choices", async () => {
  const previousWindow = globalThis.window;
  const localStorage = createMemoryStorage({
    "rivt-color-safe-status": "on",
    "rivt-enhanced-contrast": "on",
    "rivt-text-scale": "extra-large",
  });
  globalThis.window = { localStorage };

  try {
    const {
      COLOR_VISION_STORAGE_KEY,
      ENHANCED_CONTRAST_STORAGE_KEY,
      LARGE_TEXT_STORAGE_KEY,
      TEXT_SCALE_STORAGE_KEY,
      readAccessibilityPreferences,
    } = await loadModule("/src/app-shell/preferences.ts");

    assert.equal(COLOR_VISION_STORAGE_KEY, "rivt-color-safe-status");
    assert.equal(ENHANCED_CONTRAST_STORAGE_KEY, "rivt-enhanced-contrast");
    assert.equal(LARGE_TEXT_STORAGE_KEY, "rivt-large-text");
    assert.equal(TEXT_SCALE_STORAGE_KEY, "rivt-text-scale");
    assert.deepEqual(readAccessibilityPreferences(), {
      colorSafe: true,
      enhancedContrast: true,
      textScale: "extra-large",
    });
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

test("fresh onboarded accounts see role-specific activation steps", async () => {
  const { TradeFeed } = await loadModule("/src/features/home/TradeFeed.tsx");
  const commonProps = {
    posts: [],
    jobs: [],
    communities: [],
    name: "RIVT Tester",
    location: "Jacksonville, FL",
    onboardingComplete: true,
    profileHasBasics: false,
    profileHasBio: false,
    recordCount: 0,
    safetyCertCount: 0,
    getPostReactionState: () => ({ userReaction: null, upvotes: 0, downvotes: 0, status: "ready" }),
    onVotePost: noop,
    onOpenPost: noop,
    onAsk: noop,
    onPostWork: noop,
    onOpenCommunity: noop,
    onNavigate: noop,
    onOpenProfile: noop,
    onOpenTool: noop,
    onOpenActiveWorkWorkspace: noop,
  };

  const contractorHtml = renderToString(React.createElement(TradeFeed, {
    ...commonProps,
    role: "contractor",
  }));
  assert.match(contractorHtml, /Contractor setup/);
  assert.match(contractorHtml, /Post or draft your first job/);

  const tradespersonHtml = renderToString(React.createElement(TradeFeed, {
    ...commonProps,
    role: "tradesperson",
  }));
  assert.match(tradespersonHtml, /Tradesperson setup/);
  assert.match(tradespersonHtml, /Confirm your trade and location/);
});

test("canonical server trade drives persona without local storage", async () => {
  const { getPersona } = await loadModule("/src/features/persona/tradePersona.ts");
  const { PersonaProvider, usePersona } = await loadModule("/src/features/persona/usePersona.ts");

  const persona = getPersona("Electrical");
  assert.equal(persona?.trade, "Electrician");
  assert.equal(persona?.jobSectionLabel, "Electrical jobs near you");
  assert.equal(getPersona(""), null);

  function PersonaProbe() {
    const resolved = usePersona();
    return React.createElement("span", null, resolved?.jobSectionLabel ?? "No persona");
  }
  const html = renderToString(React.createElement(
    PersonaProvider,
    { trade: "Electrical" },
    React.createElement(PersonaProbe),
  ));
  assert.match(html, /Electrical jobs near you/);
});

test("primary action token meets AA contrast in both themes", () => {
  const tokenSource = readFileSync(new URL("../src/app-shell/tokens.css", import.meta.url), "utf8");
  const fills = [...tokenSource.matchAll(/--v2-accent-fill:\s*(#[0-9a-f]{6})/gi)].map((match) => match[1]);
  assert.ok(fills.length >= 2, "light and dark accent-fill tokens should both be declared");

  const luminance = (hex) => {
    const channels = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255)
      .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  };
  const white = luminance("#ffffff");
  for (const fill of fills) {
    const ratio = (white + 0.05) / (luminance(fill) + 0.05);
    assert.ok(ratio >= 4.5, `${fill} against white should be at least 4.5:1, received ${ratio.toFixed(2)}:1`);
  }
});

test("browser analytics strips direct PII and stays disabled without launch configuration", async () => {
  const { analyticsConfigured, sanitizedAnalyticsProperties } = await loadModule("/src/lib/analytics.ts");
  assert.equal(analyticsConfigured(), false);
  assert.deepEqual(sanitizedAnalyticsProperties({
    account_id: "account-123",
    role: "contractor",
    email: "not-allowed@example.com",
    customer_phone: "555-0100",
    tool: "invoice",
  }), {
    account_id: "account-123",
    role: "contractor",
    tool: "invoice",
  });
});

test("push registration claims a VAPID generation only after the browser key matches", async () => {
  const {
    deviceAlertStatus,
    unsupportedDeviceAlertMessage,
    verifiedSubscriptionGeneration,
  } = await loadModule(
    "/src/features/notifications/usePushNotifications.ts",
  );
  const expectedKey = Uint8Array.from([4, 18, 52, 86, 120, 154, 188, 222, 240]);
  const publicKey = Buffer.from(expectedKey).toString("base64url");
  const generation = "a".repeat(64);
  const exactSubscription = {
    options: { applicationServerKey: expectedKey.buffer },
  };
  const mismatchedSubscription = {
    options: { applicationServerKey: Uint8Array.from([4, 18, 52, 86, 120, 154, 188, 222, 241]).buffer },
  };
  const opaqueSubscription = { options: { applicationServerKey: null } };

  assert.equal(
    verifiedSubscriptionGeneration(exactSubscription, publicKey, generation),
    generation,
  );
  assert.equal(
    verifiedSubscriptionGeneration(mismatchedSubscription, publicKey, generation),
    null,
  );
  assert.equal(
    verifiedSubscriptionGeneration(opaqueSubscription, publicKey, generation),
    null,
  );
  assert.equal(
    verifiedSubscriptionGeneration(exactSubscription, publicKey, null),
    null,
  );
  assert.equal(
    unsupportedDeviceAlertMessage({ isAppleMobile: true, installedAsApp: true }),
    "Device alerts require iOS or iPadOS 16.4 or later. Update this device if possible. In-app alerts still work.",
  );
  assert.equal(
    unsupportedDeviceAlertMessage({ isAppleMobile: true, installedAsApp: false }),
    "On iPhone or iPad, add RIVT to your Home Screen before enabling device alerts.",
  );
  assert.equal(
    unsupportedDeviceAlertMessage({ isAppleMobile: false, installedAsApp: true }),
    "This browser does not support device alerts. In-app alerts still work.",
  );
  assert.equal(deviceAlertStatus({
    loading: false,
    subscribed: false,
    providerConfigured: true,
    browserSupported: false,
    requiresHomeScreenInstall: false,
  }), "Unavailable");
  assert.equal(deviceAlertStatus({
    loading: false,
    subscribed: false,
    providerConfigured: true,
    browserSupported: true,
    requiresHomeScreenInstall: false,
  }), "Off");
  assert.equal(deviceAlertStatus({
    loading: false,
    subscribed: true,
    providerConfigured: true,
    browserSupported: true,
    requiresHomeScreenInstall: false,
  }), "On");
  assert.equal(deviceAlertStatus({
    loading: true,
    subscribed: false,
    providerConfigured: true,
    browserSupported: true,
    requiresHomeScreenInstall: false,
  }), "Checking");
});

test("production entry point self-hosts fonts", () => {
  const entry = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.doesNotMatch(entry, /fonts\.googleapis\.com|fonts\.gstatic\.com/);
  assert.match(entry, /\/assets\/fonts\/instrument-sans-latin\.woff2/);
});

test("production update notice is compact, dismissible, and self-clearing", () => {
  const entry = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const updateScript = readFileSync(new URL("../public/rivt-service-worker.js", import.meta.url), "utf8");
  const bootStyles = readFileSync(new URL("../public/rivt-boot.css", import.meta.url), "utf8");

  assert.match(entry, /id="rivt-update-dismiss"/);
  assert.match(entry, /aria-label="Dismiss update notice"/);
  assert.match(updateScript, /window\.setTimeout\(hideUpdateNotice,\s*15_000\)/);
  assert.match(bootStyles, /min-width:\s*44px;\s*min-height:\s*44px/);
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

test("Home does not present completed or cancelled work as active", async () => {
  const { TradeFeed } = await loadModule("/src/features/home/TradeFeed.tsx");
  const historicalWork = ["completed", "cancelled"].map((status, index) => ({
    id: `historical-work-${index}`,
    jobId: `historical-job-${index}`,
    offerId: `historical-offer-${index}`,
    organizationId: "historical-organization",
    contractorAccountId: "historical-contractor",
    tradespersonAccountId: "historical-tradesperson",
    status,
    startedAt: new Date().toISOString(),
    completedAt: status === "completed" ? new Date().toISOString() : null,
    cancelledAt: status === "cancelled" ? new Date().toISOString() : null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    events: [],
    job: {
      id: `historical-job-${index}`,
      title: status === "completed" ? "Completed trim job" : "Cancelled service call",
      status: "closed",
      organization: { id: "historical-organization", name: "RIVT Test Co." },
      trade: { code: "carpentry", name: "Carpentry" },
      durationHours: 8,
      budget: { amountCents: 85000, currency: "USD", unit: "fixed" },
      publicLocation: { city: "Jacksonville", region: "FL", countryCode: "US" },
    },
  }));

  const html = assertSmokeRender(
    React.createElement(TradeFeed, {
      posts: [],
      activeWork: historicalWork,
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
    /Communities/,
  );

  assert.doesNotMatch(html, /You're active now/i);
  assert.doesNotMatch(html, /Completed trim job/i);
  assert.doesNotMatch(html, /Cancelled service call/i);
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

test("tradesperson Work empty state offers a real next action", async () => {
  const { WorkWorkspace } = await loadModule("/src/features/work/WorkWorkspace.tsx");
  const html = renderToString(React.createElement(WorkWorkspace, {
    role: "tradesperson",
    jobs: [],
    selectedJob: null,
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
    onCompleteProfile: noop,
    onEditJob: noop,
    onTransition: asyncNoop,
    onJobLoaded: noop,
    onRetry: noop,
  }));
  assert.match(html, /No matching work nearby yet/);
  assert.match(html, /Complete profile/);
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

  const html = assertSmokeRender(
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

  for (const destination of ["home", "work", "camera", "shop-talk", "tools"]) {
    assert.equal(
      html.match(new RegExp(`data-app-icon="${destination}"`, "g"))?.length,
      2,
      `${destination} should have one sidebar and one mobile identity icon`,
    );
  }
  for (const command of ["search", "messages", "notifications"]) {
    assert.match(html, new RegExp(`data-command-icon="${command}"`));
  }
  assert.match(html, /aria-label="Messages"[^>]*title="Messages"/);
  assert.match(html, /aria-label="Notifications"[^>]*title="Notifications"/);
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
