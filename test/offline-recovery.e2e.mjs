import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const port = 5198;
const baseUrl = `http://127.0.0.1:${port}`;
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const viteBin = path.join(projectRoot, "node_modules", "vite", "bin", "vite.js");

if (!existsSync(path.join(projectRoot, "dist", "index.html"))) {
  throw new Error("Offline recovery E2E requires a production build. Run npm run build first.");
}

const vite = spawn(process.execPath, [viteBin, "preview", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
  cwd: projectRoot,
  env: { ...process.env, VITE_ENABLE_GUEST_DEMO: "false" },
  stdio: ["ignore", "ignore", "inherit"],
});

const account = {
  id: "offline-account",
  status: "active",
  primaryRole: "contractor",
  email: "offline@example.test",
  provider: "email",
  emailVerified: true,
  profile: {
    displayName: "Offline Foreman",
    headline: "Electrical contractor",
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
  organizations: [{ id: "offline-org", name: "Offline Electric", role: "owner" }],
  adminRoles: [],
  capabilities: {
    canCompleteOnboarding: false,
    canPostWork: true,
    canApplyToWork: false,
    canPublishProfile: true,
  },
};

const activeWork = {
  id: "offline-work",
  jobId: "offline-job",
  offerId: "offline-offer",
  organizationId: "offline-org",
  contractorAccountId: account.id,
  tradespersonAccountId: "offline-tradesperson",
  status: "active",
  startedAt: "2026-07-28T12:00:00.000Z",
  completedAt: null,
  cancelledAt: null,
  createdAt: "2026-07-28T12:00:00.000Z",
  updatedAt: "2026-07-28T12:00:00.000Z",
  job: {
    id: "offline-job",
    title: "Riverside Service Upgrade",
    status: "accepted",
    organization: { id: "offline-org", name: "Offline Electric" },
    trade: { code: "electrical", name: "Electrical" },
    durationHours: 8,
    budget: { amountCents: 125000, currency: "USD", unit: "fixed" },
    publicLocation: { city: "Jacksonville", region: "FL", countryCode: "US" },
  },
  events: [],
};

const DAY_MS = 24 * 60 * 60 * 1000;

function authUserFor(source) {
  return {
    id: source.id,
    email: source.email,
    provider: source.provider,
    display_name: source.profile.displayName,
    role: source.primaryRole,
    organization: source.organizations[0]?.name ?? "",
    location: source.profile.locationText,
    email_verified: source.emailVerified,
    account_status: source.status,
    onboarding_status: source.profile.onboardingStatus,
  };
}

const accountB = {
  ...account,
  id: "second-account",
  email: "second@example.test",
  profile: {
    ...account.profile,
    displayName: "Second Foreman",
  },
  organizations: [{ id: "second-org", name: "Second Electric", role: "owner" }],
};

const activeWorkB = {
  ...activeWork,
  id: "second-work",
  jobId: "second-job",
  offerId: "second-offer",
  organizationId: "second-org",
  contractorAccountId: accountB.id,
  job: {
    ...activeWork.job,
    id: "second-job",
    title: "Second Account Service Call",
    organization: { id: "second-org", name: "Second Electric" },
  },
};

const onboardingAccountA = {
  ...account,
  status: "onboarding",
  profile: {
    ...account.profile,
    onboardingStatus: "draft",
  },
  capabilities: {
    ...account.capabilities,
    canCompleteOnboarding: true,
  },
};

const completedOnboardingAccountA = {
  ...onboardingAccountA,
  status: "active",
  profile: {
    ...onboardingAccountA.profile,
    onboardingStatus: "complete",
  },
  capabilities: {
    ...onboardingAccountA.capabilities,
    canCompleteOnboarding: false,
  },
};

const tradespersonAccountB = {
  ...account,
  id: "second-tradesperson-account",
  primaryRole: "tradesperson",
  email: "second-tradesperson@example.test",
  profile: {
    ...account.profile,
    displayName: "Second Carpenter",
    headline: "Finish carpenter",
    trades: [{ code: "carpentry", name: "Carpentry", primary: true }],
  },
  organizations: [{ id: "second-crew", name: "Second Finish Crew", role: "member" }],
  capabilities: {
    ...account.capabilities,
    canPostWork: false,
    canApplyToWork: true,
  },
};

const contractorCommunity = {
  id: "contractor-community",
  slug: "contractor-bench",
  name: "Contractor Bench",
  description: "Private contractor coordination",
  audience: "contractors",
  memberCount: 1,
  joined: true,
  role: "member",
  createdByAccountId: account.id,
};

function json(route, payload, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(payload),
  });
}

async function waitForServer() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch {
      // Preview is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Timed out waiting for production preview.");
}

function defaultApiResponse(route, url, options = {}) {
  const selectedAccount = options.account ?? account;
  const selectedActiveWork = options.activeWork ?? [];
  if (url.pathname === "/api/v1/me") return json(route, { data: selectedAccount });
  if (url.pathname === "/api/v1/active-work") return json(route, { data: { activeWork: selectedActiveWork } });
  if (url.pathname === "/api/v1/jobs") return json(route, { data: { jobs: [] }, meta: { nextCursor: null } });
  if (url.pathname === "/api/v1/conversations") return json(route, { data: { conversations: [] } });
  if (url.pathname === "/api/v1/notifications") return json(route, { data: { notifications: [] } });
  if (url.pathname === "/api/v1/shop-talk/posts") return json(route, { data: { posts: [] } });
  if (url.pathname === "/api/v1/communities") return json(route, { data: { communities: [] } });
  if (url.pathname === "/api/v1/shop-talk/reactions/batch") return json(route, { data: { reactions: [] } });
  if (url.pathname === "/api/news") return json(route, { items: [], resources: [], fallback: false, cached: false });
  if (url.pathname === "/api/v1/push/config") {
    return json(route, {
      data: { configured: false, publicKey: null, vapidGeneration: null, subscriptionCount: 0 },
      meta: { requestId: "offline-push-config" },
    });
  }
  if (url.pathname === "/api/v1/notification-preferences") return json(route, { data: { preferences: [] } });
  if (url.pathname === "/api/v1/billing/status") return json(route, { data: { status: "inactive" } });
  if (url.pathname === "/api/auth/providers") {
    return json(route, {
      providers: {
        email: { ok: true, mode: "live", missing: [], purpose: "Email sign-in" },
      },
      inviteRequired: false,
    });
  }
  if (url.pathname === "/api/v1/auth/logout") return json(route, { data: { loggedOut: true } });
  return json(route, { data: {} });
}

function signedOutApiResponse(route, url) {
  if (url.pathname === "/api/v1/me") {
    return json(route, { error: { code: "UNAUTHENTICATED", message: "Sign in required" } }, 401);
  }
  return defaultApiResponse(route, url, { account, activeWork: [] });
}

async function waitForOfflineSnapshot(page, accountId, activeWorkId) {
  await page.waitForFunction(({ expectedAccountId, expectedActiveWorkId }) => {
    const raw = localStorage.getItem("rivt.offlineSession.v1");
    if (!raw) return false;
    const snapshot = JSON.parse(raw);
    return snapshot?.account?.id === expectedAccountId
      && (!expectedActiveWorkId || snapshot?.activeWork?.some((item) => item.id === expectedActiveWorkId));
  }, { expectedAccountId: accountId, expectedActiveWorkId: activeWorkId ?? null });
}

async function ensureServiceWorkerControl(page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (navigator.serviceWorker.controller) return;
    await new Promise((resolve) => {
      navigator.serviceWorker.addEventListener("controllerchange", resolve, { once: true });
    });
  });
}

async function reopenInstalledAppOffline(page) {
  // `page.reload()` asks Chromium for a reload navigation. Under DevTools'
  // emulated-offline mode Chromium can intermittently bypass the controlling
  // worker for that reload's subresources, even when those exact assets are
  // present in Cache Storage. A same-URL `goto()` can take that same reload
  // path, so first close the current document and then model a fresh installed-
  // app navigation. This keeps the assertion focused on RIVT's cached-shell
  // behavior instead of Chromium's reload-cache semantics.
  await page.goto("about:blank", { waitUntil: "domcontentloaded" });
  await page.goto(`${baseUrl}/app`, { waitUntil: "domcontentloaded", timeout: 20_000 });
}

async function reopenInstalledAppOfflineInFreshPage(context, page, configurePage) {
  // A real installed-app relaunch creates a fresh window in the existing
  // browser profile. Model that boundary directly: Cache Storage,
  // localStorage, IndexedDB, and the active service-worker registration stay
  // in the context, while Chromium cannot reuse the prior tab's DevTools
  // reload/navigation state for module subresources.
  await page.close();
  const nextPage = await context.newPage();
  configurePage(nextPage);
  await nextPage.goto(`${baseUrl}/app`, { waitUntil: "domcontentloaded", timeout: 20_000 });
  return nextPage;
}

async function signOutThroughAccountMenu(page) {
  await page.locator(".v2-account-button").click();
  await page.getByRole("dialog", { name: "Account menu" }).getByRole("button", { name: "Sign out" }).click();
}

async function logInThroughEmailForm(page, source) {
  await page.getByRole("button", { name: "Log in", exact: true }).first().click();
  const email = page.getByLabel("Email");
  const password = page.getByLabel("Password");
  const submit = page.locator('form button[type="submit"]');
  await email.waitFor({ state: "visible", timeout: 10_000 });
  await email.fill(source.email);
  await password.fill("Valid-password-1!");
  await submit.click();
}

async function logInThroughEmailFormAndWait(page, source) {
  await logInThroughEmailForm(page, source);
  try {
    await waitForToolsWithDiagnostics(page, 8_000);
  } catch (error) {
    // A fast mocked account retirement can finish replacing the auth screen
    // after the first synthetic pointer event. Retry the still-visible form
    // once; a real workspace failure or a second missed submit remains fatal.
    if (!await page.getByLabel("Email").isVisible().catch(() => false)) throw error;
    await logInThroughEmailForm(page, source);
    await waitForToolsWithDiagnostics(page, 15_000);
  }
}

async function switchToSecondAccount(page) {
  await page.evaluate((accountId) => {
    window.dispatchEvent(new CustomEvent("rivt:session-expired", { detail: { accountId } }));
  }, account.id);
  await page.getByRole("button", { name: "Log in", exact: true }).first().waitFor({ timeout: 10_000 });
  await logInThroughEmailForm(page, accountB);
  try {
    await page.getByRole("button", { name: "Tools", exact: true }).waitFor({ state: "visible", timeout: 8_000 });
  } catch (error) {
    // The auth screen can finish re-rendering after the first pointer event on
    // a fast account retirement. Retry the visible credentials form once;
    // no provider or external service is involved in this deterministic mock.
    if (await page.getByLabel("Email").isVisible().catch(() => false)) {
      await page.getByLabel("Email").fill(accountB.email);
      await page.getByLabel("Password").fill("Valid-password-1!");
      await page.locator('form button[type="submit"]').click();
    }
    try {
      await waitForToolsWithDiagnostics(page, 15_000);
    } catch (retryError) {
      throw new Error(`Account B did not finish signing in at ${page.url()}. Visible page: ${(await page.locator("body").innerText()).slice(0, 1600)}`, { cause: retryError ?? error });
    }
  }
}

async function assertSecondAccountStillActive(page, message) {
  await page.locator(".v2-account-button").click();
  const accountMenu = page.getByRole("dialog", { name: "Account menu" });
  await accountMenu.getByText(accountB.profile.displayName, { exact: true }).waitFor({ timeout: 10_000 });
  assert.equal(await accountMenu.getByText(account.profile.displayName, { exact: true }).count(), 0, message);
  await accountMenu.getByRole("button", { name: "Close account menu" }).click();
}

async function openSettingsSection(page, section) {
  await page.locator(".v2-account-button").click();
  await page.getByRole("dialog", { name: "Account menu" }).getByRole("button", { name: /^Settings\b/i }).click();
  await page.getByRole("heading", { name: "Settings", exact: true }).waitFor({ timeout: 10_000 });
  const sectionButton = page.getByRole("button", { name: section, exact: true });
  // Settings uses a section tab rail on phones and exposes the complete grid
  // on desktop. Only select a tab when the responsive rail is rendered.
  if (await sectionButton.count()) await sectionButton.click();
}

function accountBillingStatus(active) {
  return {
    active,
    plan: active ? "pro" : "free",
    status: active ? "active" : "inactive",
    source: "stripe",
    activeUntil: active ? "2026-09-01T00:00:00.000Z" : null,
    cancelAtPeriodEnd: false,
    stripeSubscriptionId: active ? "sub_offline_account" : null,
    provider: {
      checkoutConfigured: true,
      webhookConfigured: true,
      portalConfigured: true,
      missing: [],
    },
  };
}

async function installPushBrowserMock(context) {
  await context.addInitScript(() => {
    const applicationServerKey = new Uint8Array([1, 2, 3, 4]).buffer;
    const subscription = {
      endpoint: "https://push.example.test/rivt-offline-device",
      expirationTime: null,
      options: { applicationServerKey },
      toJSON() {
        return {
          endpoint: this.endpoint,
          expirationTime: null,
          keys: { p256dh: "offline-p256dh", auth: "offline-auth" },
        };
      },
      async unsubscribe() {
        window.__rivtMockPushSubscribed = false;
        window.__rivtMockPushUnsubscribeCount = (window.__rivtMockPushUnsubscribeCount ?? 0) + 1;
        return true;
      },
    };
    const pushManager = {
      async getSubscription() {
        return window.__rivtMockPushSubscribed ? subscription : null;
      },
      async subscribe() {
        window.__rivtMockPushSubscribed = true;
        window.__rivtMockPushSubscribeCount = (window.__rivtMockPushSubscribeCount ?? 0) + 1;
        return subscription;
      },
    };
    const registration = {
      pushManager,
      active: {},
      installing: null,
      waiting: null,
      async update() {},
      async unregister() { return true; },
    };
    class MockNotification {}
    Object.defineProperty(MockNotification, "permission", { configurable: true, get: () => "granted" });
    MockNotification.requestPermission = async () => "granted";
    Object.defineProperty(window, "Notification", { configurable: true, value: MockNotification });
    Object.defineProperty(window, "PushManager", { configurable: true, value: class PushManager {} });
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        controller: {},
        ready: Promise.resolve(registration),
        async register() { return registration; },
        async getRegistrations() { return [registration]; },
        addEventListener() {},
        removeEventListener() {},
      },
    });
    window.__rivtMockPushSubscribed = false;
    window.__rivtMockPushSubscribeCount = 0;
    window.__rivtMockPushUnsubscribeCount = 0;
  });
}

async function enterContractorGuestPreview(page) {
  await page.getByRole("button", { name: "Preview RIVT", exact: true }).click();
  await page.getByRole("button", { name: "Open contractor demo", exact: true }).click();
  await waitForToolsWithDiagnostics(page, 10_000);
  await page.locator(".guest-banner").waitFor({ timeout: 10_000 });
  assert.equal(
    await page.evaluate(() => sessionStorage.getItem("rivt.guestPreview.session.v1")),
    "active",
    "Entering the guest preview must establish only the labeled, tab-scoped guest session",
  );
}

async function installPendingLogoutWriteMonitor(page) {
  await page.evaluate(() => {
    window.__rivtPendingLogoutWrites = [];
    const nativeSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function monitoredSetItem(key, value) {
      if (this === localStorage && key === "rivt.auth.pendingServerLogout.v1") {
        window.__rivtPendingLogoutWrites.push(value);
      }
      return nativeSetItem.call(this, key, value);
    };
  });
}

async function assertGuestExitState(page, messagePrefix) {
  assert.equal(
    await page.evaluate(() => sessionStorage.getItem("rivt.guestPreview.session.v1")),
    null,
    `${messagePrefix} must retire the tab-scoped guest session`,
  );
  assert.equal(
    await page.evaluate(() => localStorage.getItem("rivt.auth.pendingServerLogout.v1")),
    null,
    `${messagePrefix} must not leave a pending server-logout marker`,
  );
  assert.deepEqual(
    await page.evaluate(() => window.__rivtPendingLogoutWrites ?? []),
    [],
    `${messagePrefix} must never write a pending server-logout marker`,
  );
  assert.equal(await page.getByText("Contractor demo", { exact: true }).count(), 0, `${messagePrefix} must remove the guest banner`);
  assert.equal(await page.getByText(/RIVT is having trouble connecting/i).count(), 0, `${messagePrefix} must not enter the connection-recovery gate`);
  assert.equal(
    await page.getByText(/Reconnect so RIVT can finish ending the server session/i).count(),
    0,
    `${messagePrefix} must not enter the pending-logout recovery gate`,
  );
}

async function runSnapshotBoundaryRegressions(browserInstance) {
  const context = await browserInstance.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: "allow",
  });
  const page = await context.newPage();
  const apiRequests = [];
  let recordApiRequests = false;

  page.on("request", (request) => {
    const pathname = new URL(request.url()).pathname;
    if (recordApiRequests && pathname.startsWith("/api/")) apiRequests.push(pathname);
  });
  await page.route("**/api/**", (route) => {
    const url = new URL(route.request().url());
    return defaultApiResponse(route, url, { account, activeWork: [activeWork] });
  });

  try {
    await page.goto(`${baseUrl}/app`, { waitUntil: "networkidle" });
    await waitForToolsWithDiagnostics(page, 15_000);
    await waitForOfflineSnapshot(page, account.id, activeWork.id);
    await ensureServiceWorkerControl(page);

    const day29 = new Date(Date.now() - (29 * DAY_MS)).toISOString();
    await page.evaluate((lastServerValidatedAt) => {
      const snapshot = JSON.parse(localStorage.getItem("rivt.offlineSession.v1"));
      localStorage.setItem("rivt.offlineSession.v1", JSON.stringify({ ...snapshot, lastServerValidatedAt }));
    }, day29);

    await context.setOffline(true);
    await page.waitForFunction(() => navigator.onLine === false);
    apiRequests.length = 0;
    recordApiRequests = true;
    await reopenInstalledAppOffline(page);
    // This regression verifies snapshot age and purge boundaries, not the
    // separate sub-10-second cold-start requirement asserted by the primary
    // installed-app scenario below. Give a contended CI runner the same
    // bounded 15-second recovery allowance used by the surrounding boundary
    // regressions while still failing if the cached app never leaves boot.
    await waitForToolsWithDiagnostics(page, 15_000);
    await page.getByRole("button", { name: "Work", exact: true }).click();
    await page.getByRole("navigation", { name: "Work stages" }).getByRole("button", { name: /^Active\b/ }).click();
    await page.getByRole("heading", { name: activeWork.job.title, exact: true }).waitFor({ timeout: 10_000 });
    assert.equal(
      await page.evaluate(() => JSON.parse(localStorage.getItem("rivt.offlineSession.v1")).lastServerValidatedAt),
      day29,
      "Reading a valid offline snapshot must not renew its 30-day server-validation lifetime",
    );
    assert.equal(
      apiRequests.includes("/api/v1/me"),
      false,
      "A known-offline cached boot must restore before attempting the boot-critical identity request",
    );

    const expired = new Date(Date.now() - (31 * DAY_MS)).toISOString();
    await page.evaluate((lastServerValidatedAt) => {
      const snapshot = JSON.parse(localStorage.getItem("rivt.offlineSession.v1"));
      localStorage.setItem("rivt.offlineSession.v1", JSON.stringify({ ...snapshot, lastServerValidatedAt }));
    }, expired);
    apiRequests.length = 0;
    await reopenInstalledAppOffline(page);
    await page.getByText(/RIVT is having trouble connecting/i).waitFor({ timeout: 10_000 });
    assert.equal(await page.evaluate(() => localStorage.getItem("rivt.offlineSession.v1")), null, "An expired offline snapshot must be purged");
    assert.equal(await page.getByText(activeWork.job.title, { exact: true }).count(), 0, "Expired private work must not render");
    assert.deepEqual(apiRequests, [], "An expired known-offline boot must fail locally without attempting account APIs");

    await page.evaluate(({ sourceAccount, sourceWork }) => {
      localStorage.setItem("rivt.offlineSession.v1", JSON.stringify({
        account: sourceAccount,
        jobs: [],
        activeWork: [sourceWork],
        updatedAt: new Date().toISOString(),
      }));
    }, { sourceAccount: account, sourceWork: activeWork });
    apiRequests.length = 0;
    await reopenInstalledAppOffline(page);
    await page.getByText(/RIVT is having trouble connecting/i).waitFor({ timeout: 10_000 });
    assert.equal(await page.evaluate(() => localStorage.getItem("rivt.offlineSession.v1")), null, "A legacy renewable snapshot must be purged instead of migrated as trusted identity");
    assert.equal(await page.getByText(activeWork.job.title, { exact: true }).count(), 0, "Legacy cached private work must not render");
    assert.deepEqual(apiRequests, [], "A rejected legacy snapshot must not trigger account APIs while offline");
  } finally {
    await context.close();
  }
}

async function runUnauthorizedPurgeRegression(browserInstance) {
  const context = await browserInstance.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "allow" });
  const page = await context.newPage();
  const bootRequests = [];
  let unauthorized = false;
  let recordBoot = false;

  await page.route("**/api/**", (route) => {
    const url = new URL(route.request().url());
    if (recordBoot) bootRequests.push(url.pathname);
    if (url.pathname === "/api/v1/me" && unauthorized) {
      return json(route, { error: { code: "UNAUTHENTICATED", message: "Sign in required" } }, 401);
    }
    return defaultApiResponse(route, url, { account, activeWork: [activeWork] });
  });

  try {
    await page.goto(`${baseUrl}/app`, { waitUntil: "networkidle" });
    await waitForToolsWithDiagnostics(page, 15_000);
    await waitForOfflineSnapshot(page, account.id, activeWork.id);

    unauthorized = true;
    recordBoot = true;
    await reopenInstalledAppOffline(page);
    await page.getByRole("button", { name: "Log in", exact: true }).first().waitFor({ timeout: 10_000 });
    assert.equal(await page.evaluate(() => localStorage.getItem("rivt.offlineSession.v1")), null, "A server 401 must purge the offline identity snapshot");
    assert.equal(await page.getByText(activeWork.job.title, { exact: true }).count(), 0, "A server 401 must remove cached private work from the UI");
    assert.ok(bootRequests.includes("/api/v1/me"), "The unauthorized boot must ask the server for the current identity");
    assert.ok(bootRequests.includes("/api/auth/providers"), "The signed-out screen must still load public provider configuration");
    assert.equal(bootRequests.filter((pathname) => pathname === "/api/v1/active-work").length, 0, "A 401 boot must not load private active work");
  } finally {
    await context.close();
  }
}

async function runAccountTransitionRegression(browserInstance) {
  const context = await browserInstance.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: "allow" });
  const page = await context.newPage();
  const semanticOrder = [];
  let currentAccount = account;
  let failShopTalkForA = false;
  let releaseA;
  let markAStarted;
  let markAFulfilled;
  const aRelease = new Promise((resolve) => { releaseA = resolve; });
  const aStarted = new Promise((resolve) => { markAStarted = resolve; });
  const aFulfilled = new Promise((resolve) => { markAFulfilled = resolve; });

  await page.addInitScript(() => {
    const nativeSetTimeout = window.setTimeout.bind(window);
    window.setTimeout = (handler, delay, ...args) => nativeSetTimeout(handler, delay === 3200 ? 60_000 : delay, ...args);
  });
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/v1/auth/logout") {
      semanticOrder.push("logout:200");
      return json(route, { data: { loggedOut: true } });
    }
    if (url.pathname === "/api/v1/auth/login") {
      currentAccount = accountB;
      semanticOrder.push("login:B:200");
      return json(route, { data: { user: authUserFor(accountB), verificationRequired: false } });
    }
    if (url.pathname === "/api/v1/me") {
      semanticOrder.push(`me:${currentAccount.id === account.id ? "A" : "B"}:200`);
      return json(route, { data: currentAccount });
    }
    if (url.pathname === "/api/v1/active-work") {
      if (currentAccount.id === account.id) {
        semanticOrder.push("active-work:A:start");
        markAStarted();
        await aRelease;
        await json(route, { data: { activeWork: [activeWork] } });
        semanticOrder.push("active-work:A:fulfill");
        markAFulfilled();
        return;
      }
      semanticOrder.push("active-work:B:fulfill");
      return json(route, { data: { activeWork: [activeWorkB] } });
    }
    if (url.pathname === "/api/v1/shop-talk/posts" && currentAccount.id === account.id && failShopTalkForA) {
      return json(route, { error: { code: "TEST_FAILURE", message: "A-only private diagnostic" } }, 500);
    }
    return defaultApiResponse(route, url, {
      account: currentAccount,
      activeWork: currentAccount.id === account.id ? [activeWork] : [activeWorkB],
    });
  });

  try {
    await page.goto(`${baseUrl}/app`, { waitUntil: "domcontentloaded" });
    await waitForToolsWithDiagnostics(page, 15_000);
    await aStarted;

    failShopTalkForA = true;
    await page.getByRole("button", { name: "Shop Talk", exact: true }).click();
    await page.locator(".activity-toast").getByText("A-only private diagnostic", { exact: true }).waitFor({ timeout: 10_000 });
    await page.getByRole("button", { name: "Notifications", exact: true }).click();
    const aNotifications = page.getByRole("dialog", { name: "Notifications" });
    await aNotifications.getByText("A-only private diagnostic", { exact: true }).waitFor();
    await aNotifications.getByRole("button", { name: "Close notifications" }).click();

    await signOutThroughAccountMenu(page);
    await page.getByRole("button", { name: "Log in", exact: true }).first().waitFor({ timeout: 10_000 });
    assert.equal(await page.locator(".activity-toast").count(), 0, "Account A's toast must be cleared at sign-out");

    await logInThroughEmailFormAndWait(page, accountB);
    await page.getByRole("button", { name: "Work", exact: true }).click();
    await page.getByRole("navigation", { name: "Work stages" }).getByRole("button", { name: /^Active\b/ }).click();
    await page.getByRole("heading", { name: activeWorkB.job.title, exact: true }).waitFor({ timeout: 10_000 });

    releaseA();
    await aFulfilled;
    await page.waitForTimeout(100);
    assert.equal(await page.getByText(activeWork.job.title, { exact: true }).count(), 0, "A delayed Account A response must not overwrite Account B's work");
    assert.equal(await page.getByRole("heading", { name: activeWorkB.job.title, exact: true }).count(), 1, "Account B's active work must remain after Account A's delayed response arrives");
    await page.waitForFunction(({ accountId, workId }) => {
      const snapshot = JSON.parse(localStorage.getItem("rivt.offlineSession.v1"));
      return snapshot?.account?.id === accountId
        && snapshot?.activeWork?.length === 1
        && snapshot.activeWork[0]?.id === workId;
    }, { accountId: accountB.id, workId: activeWorkB.id });

    await page.getByRole("button", { name: "Notifications", exact: true }).click();
    const bNotifications = page.getByRole("dialog", { name: "Notifications" });
    assert.equal(await bNotifications.getByText("A-only private diagnostic", { exact: true }).count(), 0, "Account A's local activity must not cross into Account B");
    assert.ok(semanticOrder.indexOf("active-work:B:fulfill") < semanticOrder.indexOf("active-work:A:fulfill"), `The test did not exercise a stale completion: ${semanticOrder.join(", ")}`);
  } finally {
    releaseA();
    await context.close();
  }
}

async function runBillingActionAccountTransitionRegression(browserInstance, action) {
  const context = await browserInstance.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: "allow" });
  const page = await context.newPage();
  let currentAccount = account;
  let releaseAction;
  let markActionStarted;
  let markActionSettled;
  const actionRelease = new Promise((resolve) => { releaseAction = resolve; });
  const actionStarted = new Promise((resolve) => { markActionStarted = resolve; });
  const actionSettled = new Promise((resolve) => { markActionSettled = resolve; });
  const expectedPath = action === "checkout" ? "/api/v1/billing/checkout" : "/api/v1/billing/portal";
  let actionAccountHeader = null;

  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/v1/auth/login") {
      currentAccount = accountB;
      return json(route, { data: { user: authUserFor(accountB), verificationRequired: false } });
    }
    if (url.pathname === "/api/v1/me") return json(route, { data: currentAccount });
    if (url.pathname === "/api/v1/billing/status") {
      const active = currentAccount.id === account.id && action === "portal";
      return json(route, { data: { billing: accountBillingStatus(active) } });
    }
    if (url.pathname === expectedPath && route.request().method() === "POST") {
      actionAccountHeader = route.request().headers()["x-rivt-expected-account-id"] ?? null;
      markActionStarted();
      await actionRelease;
      try {
        await json(route, {
          data: action === "checkout"
            ? { url: "https://checkout.example.test/account-a", sessionId: "cs_account_a" }
            : { url: "https://billing.example.test/account-a" },
        });
      } catch (error) {
        if (!/abort|closed|handled/i.test(error instanceof Error ? error.message : String(error))) throw error;
      } finally {
        markActionSettled();
      }
      return;
    }
    return defaultApiResponse(route, url, { account: currentAccount, activeWork: [] });
  });

  try {
    await page.goto(`${baseUrl}/app`, { waitUntil: "domcontentloaded" });
    await waitForToolsWithDiagnostics(page, 15_000);
    await openSettingsSection(page, "Plan");
    if (action === "checkout") {
      await page.getByText("Free plan", { exact: true }).waitFor({ timeout: 10_000 });
      await page.locator(".v2-plan-upgrade-btn").click();
      const dialog = page.getByRole("dialog");
      await dialog.getByRole("button", { name: "Start RIVT Pro", exact: true }).click();
      await dialog.getByRole("button", { name: "Redirecting to checkout...", exact: true }).waitFor();
    } else {
      await page.getByText("RIVT Pro", { exact: true }).first().waitFor({ timeout: 10_000 });
      await page.getByRole("button", { name: "Manage payment details", exact: true }).click();
      await page.getByRole("button", { name: "Opening...", exact: true }).waitFor();
    }
    await actionStarted;
    assert.equal(actionAccountHeader, account.id, `${action} must send Account A in the expected-account header`);

    await switchToSecondAccount(page);
    releaseAction();
    await actionSettled;
    await page.waitForTimeout(100);

    assert.equal(new URL(page.url()).origin, baseUrl, `Account A's delayed ${action} response must not redirect Account B`);
    assert.equal(await page.getByRole("button", { name: "Log in", exact: true }).count(), 0, `Account A's delayed ${action} response must not sign Account B out`);
    await assertSecondAccountStillActive(page, `Account A's delayed ${action} response must not replace Account B`);
  } finally {
    releaseAction();
    await context.close();
  }
}

async function runPushActionAccountTransitionRegression(browserInstance, action) {
  const context = await browserInstance.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: "block" });
  await installPushBrowserMock(context);
  const page = await context.newPage();
  let currentAccount = account;
  let releaseAction;
  let markActionStarted;
  let markActionSettled;
  const actionRelease = new Promise((resolve) => { releaseAction = resolve; });
  const actionStarted = new Promise((resolve) => { markActionStarted = resolve; });
  const actionSettled = new Promise((resolve) => { markActionSettled = resolve; });
  const actionRequests = [];

  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    if (url.pathname === "/api/v1/auth/login") {
      currentAccount = accountB;
      return json(route, { data: { user: authUserFor(accountB), verificationRequired: false } });
    }
    if (url.pathname === "/api/v1/me") return json(route, { data: currentAccount });
    if (url.pathname === "/api/v1/push/config") {
      return json(route, {
        data: { configured: true, publicKey: "AQIDBA", vapidGeneration: "offline-vapid", subscriptionCount: 0 },
      });
    }
    const isActionRequest = action === "enable"
      ? url.pathname === "/api/v1/push-subscriptions" && method === "POST"
      : action === "test"
      ? url.pathname === "/api/v1/push/test" && method === "POST"
      : url.pathname === "/api/v1/push-subscriptions" && method === "DELETE";
    if (isActionRequest) {
      actionRequests.push(route.request().headers()["x-rivt-expected-account-id"] ?? null);
      markActionStarted();
      await actionRelease;
      try {
        await json(route, action === "test" ? { data: { queued: true } } : { data: { ok: true } });
      } catch (error) {
        if (!/abort|closed|handled/i.test(error instanceof Error ? error.message : String(error))) throw error;
      } finally {
        markActionSettled();
      }
      return;
    }
    return defaultApiResponse(route, url, { account: currentAccount, activeWork: [] });
  });

  try {
    await page.goto(`${baseUrl}/app`, { waitUntil: "domcontentloaded" });
    await waitForToolsWithDiagnostics(page, 15_000);
    if (action !== "enable") await page.evaluate(() => { window.__rivtMockPushSubscribed = true; });
    await openSettingsSection(page, "Alerts");
    await page.getByText("Device alerts", { exact: true }).waitFor({ timeout: 10_000 });
    const actionLabel = action === "enable" ? "Enable device alerts" : action === "test" ? "Send test" : "Turn off";
    await page.getByRole("button", { name: actionLabel, exact: true }).click();
    await actionStarted;
    assert.deepEqual(actionRequests, [account.id], `${actionLabel} must issue one account-bound mutation for Account A`);

    // Keep Account B's browser mock unsubscribed so its clean hydration cannot
    // be confused with Account A's held action completing later.
    await page.evaluate(() => { window.__rivtMockPushSubscribed = false; });
    await switchToSecondAccount(page);
    releaseAction();
    await actionSettled;
    await page.waitForTimeout(100);

    assert.deepEqual(actionRequests, [account.id], `Account A's delayed ${action} response must not submit a mutation as Account B`);
    await assertSecondAccountStillActive(page, `Account A's delayed ${action} response must not replace Account B`);
    await openSettingsSection(page, "Alerts");
    await page.getByText("Device alerts", { exact: true }).waitFor({ timeout: 10_000 });
    assert.equal(await page.getByText("Device alerts are on for this browser.", { exact: true }).count(), 0, "Account A's enable notice must not enter Account B's UI");
    assert.equal(await page.getByText("Test alert queued. It should arrive in a few seconds.", { exact: true }).count(), 0, "Account A's test notice must not enter Account B's UI");
    assert.equal(await page.getByText("Device alerts are off for this browser.", { exact: true }).count(), 0, "Account A's disable notice must not enter Account B's UI");
  } finally {
    releaseAction();
    await context.close();
  }
}

async function runCurrentSessionRevokeAccountTransitionRegression(browserInstance) {
  const context = await browserInstance.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: "allow" });
  const page = await context.newPage();
  let currentAccount = account;
  let releaseRevoke;
  let markRevokeStarted;
  let markRevokeSettled;
  const revokeRelease = new Promise((resolve) => { releaseRevoke = resolve; });
  const revokeStarted = new Promise((resolve) => { markRevokeStarted = resolve; });
  const revokeSettled = new Promise((resolve) => { markRevokeSettled = resolve; });
  let revokeAccountHeader = null;
  const accountASessions = [
    { id: "session-a-current", deviceLabel: "Chrome on Windows", createdAt: "2026-08-01T12:00:00.000Z", lastSeenAt: "2026-08-02T12:00:00.000Z", expiresAt: "2026-09-01T12:00:00.000Z", current: true },
    { id: "session-a-delayed", deviceLabel: "Old Android", createdAt: "2026-07-01T12:00:00.000Z", lastSeenAt: "2026-07-15T12:00:00.000Z", expiresAt: "2026-09-01T12:00:00.000Z", current: false },
  ];
  const accountBSessions = [
    { id: "session-b-current", deviceLabel: "Safari on iPhone", createdAt: "2026-08-02T12:00:00.000Z", lastSeenAt: "2026-08-02T12:00:00.000Z", expiresAt: "2026-09-01T12:00:00.000Z", current: true },
  ];

  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/v1/auth/login") {
      currentAccount = accountB;
      return json(route, { data: { user: authUserFor(accountB), verificationRequired: false } });
    }
    if (url.pathname === "/api/v1/me") return json(route, { data: currentAccount });
    if (url.pathname === "/api/v1/sessions" && route.request().method() === "GET") {
      return json(route, { data: { sessions: currentAccount.id === account.id ? accountASessions : accountBSessions } });
    }
    if (url.pathname === "/api/v1/sessions/session-a-delayed" && route.request().method() === "DELETE") {
      revokeAccountHeader = route.request().headers()["x-rivt-expected-account-id"] ?? null;
      markRevokeStarted();
      await revokeRelease;
      try {
        await json(route, { data: { revoked: true, current: true } });
      } finally {
        markRevokeSettled();
      }
      return;
    }
    return defaultApiResponse(route, url, { account: currentAccount, activeWork: [] });
  });

  try {
    await page.goto(`${baseUrl}/app`, { waitUntil: "domcontentloaded" });
    await waitForToolsWithDiagnostics(page, 15_000);
    await openSettingsSection(page, "Security");
    const oldAndroid = page.locator(".v2-session-list article").filter({ hasText: "Old Android" });
    await oldAndroid.getByRole("button", { name: "Sign out", exact: true }).click();
    await revokeStarted;
    assert.equal(revokeAccountHeader, account.id, "Session revocation must send Account A in the expected-account header");

    await switchToSecondAccount(page);
    releaseRevoke();
    await revokeSettled;
    await page.waitForTimeout(100);

    assert.equal(await page.getByRole("button", { name: "Log in", exact: true }).count(), 0, "Account A's delayed current-session response must not clear Account B");
    await assertSecondAccountStillActive(page, "Account A's delayed current-session response must leave Account B active");
    await openSettingsSection(page, "Security");
    await page.getByText("Safari on iPhone · This device", { exact: true }).waitFor({ timeout: 10_000 });
    assert.equal(await page.getByText("Old Android", { exact: true }).count(), 0, "Account A's session list must not enter Account B's Security view");
  } finally {
    releaseRevoke();
    await context.close();
  }
}

async function runOnboardingRefreshIsolationRegression(browserInstance) {
  const context = await browserInstance.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: "allow" });
  const page = await context.newPage();
  const semanticOrder = [];
  let currentAccount = onboardingAccountA;
  let holdCompletedAccountRefresh = false;
  const onboardingDraftAccountHeaders = [];
  let onboardingCompleteAccountHeader = null;
  let onboardingRefreshAccountHeader = null;
  let releaseAccountARefresh;
  let markAccountARefreshStarted;
  let markAccountARefreshFulfilled;
  const accountARefreshRelease = new Promise((resolve) => { releaseAccountARefresh = resolve; });
  const accountARefreshStarted = new Promise((resolve) => { markAccountARefreshStarted = resolve; });
  const accountARefreshFulfilled = new Promise((resolve) => { markAccountARefreshFulfilled = resolve; });

  await page.addInitScript(() => {
    const nativeSetTimeout = window.setTimeout.bind(window);
    window.setTimeout = (handler, delay, ...args) => nativeSetTimeout(handler, delay === 3200 ? 60_000 : delay, ...args);
  });
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    if (url.pathname === "/api/v1/auth/login" && method === "POST") {
      currentAccount = tradespersonAccountB;
      semanticOrder.push("login:B:200");
      return json(route, { data: { user: authUserFor(tradespersonAccountB), verificationRequired: false } });
    }
    if (url.pathname === "/api/v1/profile" && method === "PATCH") {
      onboardingDraftAccountHeaders.push(route.request().headers()["x-rivt-expected-account-id"] ?? null);
    }
    if (url.pathname === "/api/v1/onboarding/complete" && method === "POST") {
      onboardingCompleteAccountHeader = route.request().headers()["x-rivt-expected-account-id"] ?? null;
      holdCompletedAccountRefresh = true;
      semanticOrder.push("onboarding:A:200");
      return json(route, { data: { completed: true } });
    }
    if (url.pathname === "/api/v1/me") {
      if (currentAccount.id === onboardingAccountA.id && holdCompletedAccountRefresh) {
        onboardingRefreshAccountHeader = route.request().headers()["x-rivt-expected-account-id"] ?? null;
        semanticOrder.push("me:A:refresh:start");
        markAccountARefreshStarted();
        await accountARefreshRelease;
        await json(route, { data: completedOnboardingAccountA });
        semanticOrder.push("me:A:refresh:fulfill");
        markAccountARefreshFulfilled();
        return;
      }
      semanticOrder.push(`me:${currentAccount.id === tradespersonAccountB.id ? "B" : "A"}:200`);
      return json(route, { data: currentAccount });
    }
    return defaultApiResponse(route, url, { account: currentAccount, activeWork: [] });
  });

  try {
    await page.goto(`${baseUrl}/app`, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "What are you here to do first?", exact: true }).waitFor({ timeout: 15_000 });
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByRole("heading", { name: "Contractor profile", exact: true }).waitFor();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByRole("heading", { name: "Shape your feed", exact: true }).waitFor();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByRole("heading", { name: "Consent agreement", exact: true }).first().waitFor();
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Open RIVT", exact: true }).click();
    await accountARefreshStarted;
    assert.ok(onboardingDraftAccountHeaders.length > 0, "Onboarding must persist at least one account-bound profile draft");
    assert.ok(
      onboardingDraftAccountHeaders.every((accountId) => accountId === onboardingAccountA.id),
      `Every onboarding profile draft must carry Account A in the expected-account header: ${JSON.stringify(onboardingDraftAccountHeaders)}`,
    );
    assert.equal(onboardingCompleteAccountHeader, onboardingAccountA.id, "Onboarding completion must carry Account A in the expected-account header");
    assert.equal(onboardingRefreshAccountHeader, onboardingAccountA.id, "Post-onboarding refresh must carry Account A in the expected-account header");

    await page.evaluate((accountId) => {
      window.dispatchEvent(new CustomEvent("rivt:session-expired", { detail: { accountId } }));
    }, onboardingAccountA.id);
    await page.getByRole("button", { name: "Log in", exact: true }).first().waitFor({ timeout: 10_000 });
    await logInThroughEmailFormAndWait(page, tradespersonAccountB);
    const accountBDestination = await page.locator("main.v2-main").getAttribute("data-destination");
    assert.ok(accountBDestination, "Account B must reach a canonical app destination before the stale Account A refresh is released");

    await page.locator(".v2-account-button").click();
    let accountMenu = page.getByRole("dialog", { name: "Account menu" });
    await accountMenu.getByText("Tradesperson account", { exact: true }).waitFor();
    await accountMenu.getByText(tradespersonAccountB.profile.displayName, { exact: true }).waitFor();
    await accountMenu.getByText(new RegExp(tradespersonAccountB.email.replace(".", "\\."))).waitFor();
    await accountMenu.getByRole("button", { name: "Close account menu" }).click();

    releaseAccountARefresh();
    await accountARefreshFulfilled;
    await page.waitForTimeout(100);
    assert.equal(
      await page.locator("main.v2-main").getAttribute("data-destination"),
      accountBDestination,
      "Account A's stale onboarding result must not redirect Account B",
    );
    assert.equal(await page.getByText(onboardingAccountA.profile.displayName, { exact: true }).count(), 0, "Account A's delayed onboarding refresh must not render its profile over Account B");
    assert.equal(await page.locator(".activity-toast").getByText("Account setup complete", { exact: true }).count(), 0, "Account A's delayed onboarding completion must not create Account B activity");

    await page.locator(".v2-account-button").click();
    accountMenu = page.getByRole("dialog", { name: "Account menu" });
    await accountMenu.getByText("Tradesperson account", { exact: true }).waitFor();
    await accountMenu.getByText(tradespersonAccountB.profile.displayName, { exact: true }).waitFor();
    assert.equal(await accountMenu.getByText(onboardingAccountA.email, { exact: false }).count(), 0, "Account A's email must not replace Account B after the stale onboarding refresh");
    await accountMenu.getByRole("button", { name: "Close account menu" }).click();

    await page.getByRole("button", { name: "Notifications", exact: true }).click();
    const notifications = page.getByRole("dialog", { name: "Notifications" });
    assert.equal(await notifications.getByText("Account setup complete", { exact: true }).count(), 0, "Account A onboarding activity must not enter Account B's notification panel");
    assert.ok(
      semanticOrder.indexOf("me:B:200") < semanticOrder.indexOf("me:A:refresh:fulfill"),
      `The test did not exercise an Account A onboarding refresh completing after Account B login: ${semanticOrder.join(", ")}`,
    );
  } finally {
    releaseAccountARefresh();
    await context.close();
  }
}

async function runRestrictedShopTalkCreateIsolationRegression(browserInstance) {
  const context = await browserInstance.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: "allow" });
  const page = await context.newPage();
  const semanticOrder = [];
  const postTitle = "Account A private panel schedule";
  const postBody = "Account A-only coordination details must never cross identities.";
  let currentAccount = account;
  let releaseAccountAPost;
  let markAccountAPostStarted;
  let markAccountAPostFulfilled;
  const accountAPostRelease = new Promise((resolve) => { releaseAccountAPost = resolve; });
  const accountAPostStarted = new Promise((resolve) => { markAccountAPostStarted = resolve; });
  const accountAPostFulfilled = new Promise((resolve) => { markAccountAPostFulfilled = resolve; });

  await page.addInitScript(() => {
    const nativeSetTimeout = window.setTimeout.bind(window);
    window.setTimeout = (handler, delay, ...args) => nativeSetTimeout(handler, delay === 3200 ? 60_000 : delay, ...args);
  });
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    if (url.pathname === "/api/v1/auth/login" && method === "POST") {
      currentAccount = tradespersonAccountB;
      semanticOrder.push("login:B:200");
      return json(route, { data: { user: authUserFor(tradespersonAccountB), verificationRequired: false } });
    }
    if (url.pathname === "/api/v1/me") {
      semanticOrder.push(`me:${currentAccount.id === tradespersonAccountB.id ? "B" : "A"}:200`);
      return json(route, { data: currentAccount });
    }
    if (url.pathname === "/api/v1/communities" && method === "GET") {
      return json(route, { data: { communities: [contractorCommunity] } });
    }
    if (url.pathname === "/api/v1/shop-talk/posts" && method === "POST") {
      const requestBody = route.request().postDataJSON();
      assert.equal(currentAccount.id, account.id, "The delayed restricted post must originate under Account A");
      assert.equal(requestBody.communitySlug, contractorCommunity.slug, "The regression must exercise a role-restricted contractor community");
      assert.equal(requestBody.webVisibility, "members", "A role-restricted post must remain member-only");
      semanticOrder.push("shop-talk:A:create:start");
      markAccountAPostStarted();
      await accountAPostRelease;
      await json(route, {
        data: {
          post: {
            id: "account-a-restricted-post",
            authorAccountId: account.id,
            author: account.profile.displayName,
            trade: "Electrical",
            flair: "Question",
            type: "question",
            title: postTitle,
            body: postBody,
            status: "Open",
            createdAt: "2026-08-02T12:00:00.000Z",
            communityId: contractorCommunity.id,
            communitySlug: contractorCommunity.slug,
            communityName: contractorCommunity.name,
            communityAudience: contractorCommunity.audience,
            answers: [],
            media: [],
            viewerCanDelete: true,
            webVisibility: "members",
          },
        },
      });
      semanticOrder.push("shop-talk:A:create:fulfill");
      markAccountAPostFulfilled();
      return;
    }
    if (url.pathname === "/api/v1/shop-talk/posts" && method === "GET") {
      return json(route, { data: { posts: [] } });
    }
    return defaultApiResponse(route, url, { account: currentAccount, activeWork: [] });
  });

  try {
    await page.goto(`${baseUrl}/app`, { waitUntil: "domcontentloaded" });
    await waitForToolsWithDiagnostics(page, 15_000);
    await page.getByRole("button", { name: "Shop Talk", exact: true }).click();
    await page.getByRole("button", { name: "Post", exact: true }).click();
    const composer = page.locator(".new-post-modal");
    await composer.getByRole("heading", { name: "Create a post", exact: true }).waitFor();
    await composer.getByLabel("Community").selectOption(contractorCommunity.slug);
    await composer.getByLabel("Title").fill(postTitle);
    await composer.getByLabel("Body").fill(postBody);
    await composer.getByRole("button", { name: "Post", exact: true }).click();
    await accountAPostStarted;

    await page.evaluate((accountId) => {
      window.dispatchEvent(new CustomEvent("rivt:session-expired", { detail: { accountId } }));
    }, account.id);
    await page.getByRole("button", { name: "Log in", exact: true }).first().waitFor({ timeout: 10_000 });
    await logInThroughEmailFormAndWait(page, tradespersonAccountB);
    await page.getByRole("button", { name: "Shop Talk", exact: true }).click();
    await page.getByText("No matching Shop Talk posts", { exact: true }).waitFor({ timeout: 10_000 });
    await page.evaluate(({ title, body }) => {
      const leakText = [title, body, "Shop Talk post created"];
      const check = () => {
        if (leakText.some((value) => document.body.innerText.includes(value))) window.__rivtShopTalkAccountLeakSeen = true;
      };
      window.__rivtShopTalkAccountLeakSeen = false;
      new MutationObserver(check).observe(document.body, { childList: true, subtree: true, characterData: true });
      check();
    }, { title: postTitle, body: postBody });

    releaseAccountAPost();
    await accountAPostFulfilled;
    await page.waitForTimeout(100);
    assert.equal(await page.getByText(postTitle, { exact: true }).count(), 0, "Account A's delayed restricted post title must not render in Account B");
    assert.equal(await page.getByText(postBody, { exact: true }).count(), 0, "Account A's delayed restricted post body must not render in Account B");
    assert.equal(await page.evaluate(() => window.__rivtShopTalkAccountLeakSeen), false, "Account A's delayed restricted post or activity rendered transiently in Account B");
    assert.equal(await page.locator(".activity-toast").getByText("Shop Talk post created", { exact: true }).count(), 0, "Account A's delayed post must not create Account B activity");

    await page.getByRole("button", { name: "Notifications", exact: true }).click();
    const notifications = page.getByRole("dialog", { name: "Notifications" });
    assert.equal(await notifications.getByText(postTitle, { exact: false }).count(), 0, "Account A's restricted post title must not enter Account B notifications");
    assert.equal(await notifications.getByText(postBody, { exact: false }).count(), 0, "Account A's restricted post body must not enter Account B notifications");
    assert.equal(await notifications.getByText("Shop Talk post created", { exact: true }).count(), 0, "Account A's delayed create activity must not enter Account B notifications");
    assert.ok(
      semanticOrder.indexOf("me:B:200") < semanticOrder.indexOf("shop-talk:A:create:fulfill"),
      `The test did not exercise an Account A post completing after Account B login: ${semanticOrder.join(", ")}`,
    );
  } finally {
    releaseAccountAPost();
    await context.close();
  }
}

async function runOfflineQueueAccountTransitionRegression(browserInstance) {
  const context = await browserInstance.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: "allow" });
  const page = await context.newPage();
  const firstLabel = "Account A daily log one";
  const secondLabel = "Account A daily log two";
  const firstLocalId = "daily-log-draft:account-a-one";
  const secondLocalId = "daily-log-draft:account-a-two";
  const queueRequests = [];
  const semanticOrder = [];
  let currentAccount = account;
  let releaseFirstQueueRequest;
  let markFirstQueueRequestStarted;
  let markFirstQueueRequestSettled;
  const firstQueueRequestRelease = new Promise((resolve) => { releaseFirstQueueRequest = resolve; });
  const firstQueueRequestStarted = new Promise((resolve) => { markFirstQueueRequestStarted = resolve; });
  const firstQueueRequestSettled = new Promise((resolve) => { markFirstQueueRequestSettled = resolve; });

  await page.addInitScript(() => {
    const nativeSetTimeout = window.setTimeout.bind(window);
    window.setTimeout = (handler, delay, ...args) => nativeSetTimeout(handler, delay === 3200 ? 60_000 : delay, ...args);
  });
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    if (url.pathname === "/api/v1/auth/login" && method === "POST") {
      currentAccount = tradespersonAccountB;
      semanticOrder.push("login:B:200");
      return json(route, { data: { user: authUserFor(tradespersonAccountB), verificationRequired: false } });
    }
    if (url.pathname === "/api/v1/me") {
      semanticOrder.push(`me:${currentAccount.id === tradespersonAccountB.id ? "B" : "A"}:200`);
      return json(route, { data: currentAccount });
    }
    if (url.pathname === "/api/v1/tool-records" && method === "POST") {
      const headers = route.request().headers();
      const requestBody = route.request().postDataJSON();
      const expectedAccountId = headers["x-rivt-expected-account-id"];
      queueRequests.push({
        localId: requestBody.localId,
        expectedAccountId,
        sessionAccountId: currentAccount.id,
      });
      assert.equal(expectedAccountId, account.id, "Every Account A offline queue request must carry Account A in X-RIVT-Expected-Account-Id");
      if (requestBody.localId === firstLocalId) {
        semanticOrder.push("queue:A:first:start");
        markFirstQueueRequestStarted();
        await firstQueueRequestRelease;
        try {
          await json(route, {
            data: {
              record: {
                id: "synced-account-a-log-one",
                localId: firstLocalId,
                recordType: "daily_report",
              },
            },
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (!/abort|closed|handled|target/i.test(message)) throw error;
        } finally {
          semanticOrder.push("queue:A:first:settle");
          markFirstQueueRequestSettled();
        }
        return;
      }
      semanticOrder.push(`queue:A:later:${requestBody.localId}:session:${currentAccount.id}`);
      return json(route, currentAccount.id === account.id
        ? { data: { record: { id: "unexpected-second-sync", localId: requestBody.localId, recordType: "daily_report" } } }
        : { error: { code: "OFFLINE_ACCOUNT_CHANGED", message: "The signed-in account changed before this saved item could sync." } },
      currentAccount.id === account.id ? 200 : 409);
    }
    return defaultApiResponse(route, url, { account: currentAccount, activeWork: [] });
  });

  try {
    await page.goto(`${baseUrl}/app`, { waitUntil: "domcontentloaded" });
    await waitForToolsWithDiagnostics(page, 15_000);
    await context.setOffline(true);
    await page.waitForFunction(() => navigator.onLine === false);
    await page.evaluate(({ accountId, first, second }) => new Promise((resolve, reject) => {
      const request = indexedDB.open("rivt-offline-recovery", 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction("operations", "readwrite");
        const store = transaction.objectStore("operations");
        const now = Date.now();
        const operation = (id, localId, label, offsetMs) => ({
          id,
          accountId,
          kind: "daily_log_upsert",
          status: "queued",
          payload: {
            input: {
              recordType: "daily_report",
              localId,
              title: label,
              status: "draft",
              recordDate: "2026-08-02",
              amountCents: null,
              activeWorkId: null,
              customerId: null,
              payload: { site: label, notes: `${label} private notes` },
            },
          },
          idempotencyKey: `idempotency-${id}`,
          dedupeKey: localId,
          label,
          destinationLabel: "Account A private records",
          createdAt: new Date(now + offsetMs).toISOString(),
          updatedAt: new Date(now + offsetMs).toISOString(),
          attempts: 0,
          nextAttemptAt: null,
          lastError: null,
        });
        store.put(operation("account-a-log-one", first.localId, first.label, -2_000));
        store.put(operation("account-a-log-two", second.localId, second.label, -1_000));
        transaction.oncomplete = () => {
          database.close();
          window.dispatchEvent(new CustomEvent("rivt:offline-queue-changed"));
          resolve();
        };
        transaction.onerror = () => reject(transaction.error);
      };
    }), {
      accountId: account.id,
      first: { localId: firstLocalId, label: firstLabel },
      second: { localId: secondLocalId, label: secondLabel },
    });
    await page.getByText("2 field items are saved on this device.", { exact: true }).waitFor({ timeout: 10_000 });

    await context.setOffline(false);
    await page.waitForFunction(() => navigator.onLine === true);
    await firstQueueRequestStarted;
    assert.deepEqual(queueRequests, [{
      localId: firstLocalId,
      expectedAccountId: account.id,
      sessionAccountId: account.id,
    }], "Only Account A's first queued operation may be in flight before the identity transition");

    await page.evaluate((accountId) => {
      window.dispatchEvent(new CustomEvent("rivt:session-expired", { detail: { accountId } }));
    }, account.id);
    await page.getByRole("button", { name: "Log in", exact: true }).first().waitFor({ timeout: 10_000 });
    await logInThroughEmailFormAndWait(page, tradespersonAccountB);
    await page.evaluate(({ first, second }) => {
      const accountALeakText = [first, second, "Account A private records"];
      const check = () => {
        if (accountALeakText.some((value) => document.body.innerText.includes(value))) window.__rivtOfflineQueueAccountLeakSeen = true;
      };
      window.__rivtOfflineQueueAccountLeakSeen = false;
      new MutationObserver(check).observe(document.body, { childList: true, subtree: true, characterData: true });
      check();
    }, { first: firstLabel, second: secondLabel });
    assert.equal(await page.getByLabel("Offline and sync status").count(), 0, "Account B must not inherit Account A's queued-work banner");

    releaseFirstQueueRequest();
    await firstQueueRequestSettled;
    await page.waitForTimeout(250);
    assert.equal(queueRequests.length, 1, `Account A's second queued operation was sent after Account B login: ${JSON.stringify(queueRequests)}`);
    assert.ok(queueRequests.every((request) => request.expectedAccountId === account.id), "Every queue request must bind to its originating Account A identity");
    assert.equal(await page.evaluate(() => window.__rivtOfflineQueueAccountLeakSeen), false, "Account A's queued-work status rendered transiently under Account B");
    assert.equal(await page.getByLabel("Offline and sync status").count(), 0, "Account A queue completion must not create a success banner under Account B");
    assert.equal(await page.locator(".activity-toast").count(), 0, "Account A queue completion must not create Account B activity");

    const remainingAccountAOperations = await page.evaluate((accountId) => new Promise((resolve, reject) => {
      const request = indexedDB.open("rivt-offline-recovery", 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction("operations", "readonly");
        const getAll = transaction.objectStore("operations").getAll();
        getAll.onsuccess = () => {
          database.close();
          resolve(getAll.result.filter((operation) => operation.accountId === accountId));
        };
        getAll.onerror = () => reject(getAll.error);
      };
    }), account.id);
    const secondOperation = remainingAccountAOperations.find((operation) => operation.id === "account-a-log-two");
    assert.equal(secondOperation?.status, "queued", "Account A's second operation must remain queued for Account A instead of being attempted under Account B");

    await page.getByRole("button", { name: "Notifications", exact: true }).click();
    const notifications = page.getByRole("dialog", { name: "Notifications" });
    assert.equal(await notifications.getByText(firstLabel, { exact: false }).count(), 0, "Account A's first queue result must not enter Account B notifications");
    assert.equal(await notifications.getByText(secondLabel, { exact: false }).count(), 0, "Account A's second queued item must not enter Account B notifications");
    assert.ok(
      semanticOrder.indexOf("login:B:200") < semanticOrder.indexOf("queue:A:first:settle"),
      `The test did not release Account A's held sync after Account B login: ${semanticOrder.join(", ")}`,
    );
  } finally {
    releaseFirstQueueRequest();
    await context.close();
  }
}

async function runOnlineGuestExitRegression(browserInstance) {
  const context = await browserInstance.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "allow" });
  const page = await context.newPage();
  const logoutRequests = [];

  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/v1/auth/logout") logoutRequests.push(request.method());
  });
  await page.route("**/api/**", (route) => signedOutApiResponse(route, new URL(route.request().url())));

  try {
    await page.goto(`${baseUrl}/app`, { waitUntil: "networkidle" });
    await enterContractorGuestPreview(page);
    assert.equal(await page.evaluate(() => localStorage.getItem("rivt.auth.pendingServerLogout.v1")), null);
    await installPendingLogoutWriteMonitor(page);

    await signOutThroughAccountMenu(page);
    await page.getByRole("button", { name: "Log in", exact: true }).first().waitFor({ timeout: 2_000 });
    await assertGuestExitState(page, "Online guest sign-out");
    assert.deepEqual(logoutRequests, [], "Guest sign-out must not call the authenticated server logout endpoint");

    await page.reload({ waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Log in", exact: true }).first().waitFor({ timeout: 10_000 });
    await assertGuestExitState(page, "Online guest reload");
    assert.equal(await page.getByRole("button", { name: "Tools", exact: true }).count(), 0, "A signed-out reload must not resume the guest workspace");
    assert.deepEqual(logoutRequests, [], "Reloading after guest sign-out must not trigger authenticated logout recovery");
  } finally {
    await context.close();
  }
}

async function runOfflineGuestExitRegression(browserInstance) {
  const context = await browserInstance.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "allow" });
  const page = await context.newPage();
  const logoutRequests = [];

  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/v1/auth/logout") logoutRequests.push(request.method());
  });
  await page.route("**/api/**", (route) => signedOutApiResponse(route, new URL(route.request().url())));

  try {
    await page.goto(`${baseUrl}/app`, { waitUntil: "networkidle" });
    await enterContractorGuestPreview(page);
    assert.equal(await page.evaluate(() => localStorage.getItem("rivt.auth.pendingServerLogout.v1")), null);
    await installPendingLogoutWriteMonitor(page);

    await context.setOffline(true);
    await page.waitForFunction(() => navigator.onLine === false);
    await page.locator(".v2-account-button").click();
    const exitStartedAt = Date.now();
    await page.getByRole("dialog", { name: "Account menu" }).getByRole("button", { name: "Sign out" }).click();
    await page.getByRole("button", { name: "Log in", exact: true }).first().waitFor({ timeout: 2_000 });
    assert.ok(Date.now() - exitStartedAt < 2_000, "Offline guest sign-out must return to signed-out entry immediately");
    await assertGuestExitState(page, "Offline guest sign-out");
    assert.deepEqual(logoutRequests, [], "Offline guest sign-out must not attempt the authenticated server logout endpoint");

    await context.setOffline(false);
    await page.waitForFunction(() => navigator.onLine === true);
    await page.reload({ waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Log in", exact: true }).first().waitFor({ timeout: 10_000 });
    await assertGuestExitState(page, "Offline guest reconnect reload");
    assert.equal(await page.getByRole("button", { name: "Tools", exact: true }).count(), 0, "Reconnecting after offline guest exit must not resume the guest workspace");
    assert.deepEqual(logoutRequests, [], "Guest reconnect must not trigger pending authenticated logout recovery");
  } finally {
    await context.close();
  }
}

async function runPendingLogoutRegression(browserInstance) {
  const context = await browserInstance.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "allow" });
  const page = await context.newPage();
  const reconnectOrder = [];
  let serveApi = true;
  let logoutStatus = 200;
  let sessionEnded = false;
  let recordReconnect = false;

  await page.route("**/api/**", (route) => {
    if (!serveApi) return route.abort("internetdisconnected");
    const url = new URL(route.request().url());
    if (url.pathname === "/api/v1/auth/logout") {
      if (recordReconnect) reconnectOrder.push(`logout:${logoutStatus}`);
      if (logoutStatus === 200) sessionEnded = true;
      return json(route, logoutStatus === 200
        ? { data: { loggedOut: true } }
        : { error: { code: "LOGOUT_UNAVAILABLE", message: "Logout is temporarily unavailable" } }, logoutStatus);
    }
    if (url.pathname === "/api/v1/me" && sessionEnded) {
      if (recordReconnect) reconnectOrder.push("me:401");
      return json(route, { error: { code: "UNAUTHENTICATED", message: "Sign in required" } }, 401);
    }
    if (url.pathname === "/api/auth/providers" && recordReconnect) reconnectOrder.push("providers:200");
    return defaultApiResponse(route, url, { account, activeWork: [activeWork] });
  });

  try {
    await page.goto(`${baseUrl}/app`, { waitUntil: "networkidle" });
    await waitForToolsWithDiagnostics(page, 15_000);
    await waitForOfflineSnapshot(page, account.id, activeWork.id);
    await ensureServiceWorkerControl(page);

    serveApi = false;
    await context.setOffline(true);
    await page.waitForFunction(() => navigator.onLine === false);
    await signOutThroughAccountMenu(page);
    await page.waitForFunction((accountId) => {
      const pending = JSON.parse(localStorage.getItem("rivt.auth.pendingServerLogout.v1"));
      return pending?.accountId === accountId && localStorage.getItem("rivt.offlineSession.v1") === null;
    }, account.id);
    assert.equal(await page.getByText(activeWork.job.title, { exact: true }).count(), 0, "Offline sign-out must retire private work immediately");

    reconnectOrder.length = 0;
    recordReconnect = true;
    await page.reload({ waitUntil: "domcontentloaded", timeout: 20_000 });
    await page.getByText(/RIVT is having trouble connecting/i).waitFor({ timeout: 10_000 });
    assert.deepEqual(reconnectOrder, [], "An offline pending-logout boot must not try /me or restore the account");
    assert.equal(await page.getByText(activeWork.job.title, { exact: true }).count(), 0, "A pending logout must block cached identity restoration");

    serveApi = true;
    logoutStatus = 500;
    await context.setOffline(false);
    await page.waitForFunction(() => navigator.onLine === true);
    await page.getByText(/RIVT is having trouble connecting/i).waitFor({ timeout: 10_000 });
    await page.waitForFunction(() => {
      const pending = JSON.parse(localStorage.getItem("rivt.auth.pendingServerLogout.v1"));
      return Boolean(pending?.accountId);
    });
    assert.deepEqual(reconnectOrder, ["logout:500"], `A failed pending logout must stop before /me: ${reconnectOrder.join(", ")}`);

    logoutStatus = 200;
    await page.getByRole("button", { name: "Retry", exact: true }).click();
    await page.getByRole("button", { name: "Log in", exact: true }).first().waitFor({ timeout: 10_000 });
    assert.deepEqual(
      reconnectOrder,
      ["logout:500", "logout:200", "me:401", "providers:200"],
      "RIVT must finish the pending server logout before checking /me",
    );
    assert.equal(await page.evaluate(() => localStorage.getItem("rivt.auth.pendingServerLogout.v1")), null, "A confirmed server logout must clear the pending marker");
    assert.equal(await page.evaluate(() => localStorage.getItem("rivt.offlineSession.v1")), null, "Pending logout resolution must not restore the old offline snapshot");
    assert.equal(await page.getByText(activeWork.job.title, { exact: true }).count(), 0, "The signed-out account's private work must remain absent");
  } finally {
    await context.close();
  }
}

async function waitForToolsWithDiagnostics(page, timeout, browserEvents = []) {
  try {
    await page.getByRole("button", { name: "Tools", exact: true }).waitFor({ timeout });
  } catch (error) {
    const diagnostics = await page.evaluate(async () => {
      const cacheNames = await caches.keys();
      const cachePaths = (await Promise.all(cacheNames.map(async (cacheName) => (
        await (await caches.open(cacheName)).keys()
      )))).flat().map((request) => new URL(request.url).pathname).sort();
      return {
        pathname: window.location.pathname,
        online: navigator.onLine,
        appReady: document.documentElement.classList.contains("rivt-app-ready"),
        serviceWorkerControlled: Boolean(navigator.serviceWorker?.controller),
        offlineSnapshotPresent: Boolean(localStorage.getItem("rivt.offlineSession.v1")),
        launchLoaderVisible: document.body.textContent?.includes("Preparing your workspace...") ?? false,
        staticBootVisible: document.body.textContent?.includes("Loading your workspace.") ?? false,
        connectionErrorVisible: document.body.textContent?.includes("RIVT is having trouble connecting") ?? false,
        offlineDocumentVisible: document.body.textContent?.includes("Connect to open RIVT") ?? false,
        cacheNames,
        cachePaths,
      };
    }).catch((cause) => ({ diagnosticError: cause instanceof Error ? cause.message : String(cause) }));
    console.error(`Offline recovery diagnostics: ${JSON.stringify({ ...diagnostics, browserEvents })}`);
    throw error;
  }
}

let browser;
try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: "allow",
  });
  let page = await context.newPage();
  const browserEvents = [];
  const configurePage = (targetPage) => {
    targetPage.on("pageerror", (error) => browserEvents.push(`pageerror:${error.message}`));
    targetPage.on("requestfailed", (request) => {
      const url = new URL(request.url());
      if (!url.pathname.startsWith("/api/")) {
        browserEvents.push(`requestfailed:${url.pathname}:${request.failure()?.errorText ?? "unknown"}`);
      }
    });
  };
  configurePage(page);
  let serveApi = true;

  await context.route("**/api/**", (route) => {
    if (!serveApi) return route.abort("internetdisconnected");
    const url = new URL(route.request().url());
    if (url.pathname === "/api/v1/me") return json(route, { data: account });
    if (url.pathname === "/api/v1/active-work") return json(route, { data: { activeWork: [activeWork] } });
    if (url.pathname === "/api/v1/jobs") return json(route, { data: { jobs: [] }, meta: { nextCursor: null } });
    if (url.pathname === "/api/v1/conversations") return json(route, { data: { conversations: [] } });
    if (url.pathname === "/api/v1/notifications") return json(route, { data: { notifications: [] } });
    if (url.pathname === "/api/v1/shop-talk/posts") return json(route, { data: { posts: [] } });
    if (url.pathname === "/api/v1/communities") return json(route, { data: { communities: [] } });
    if (url.pathname === "/api/v1/shop-talk/reactions/batch") return json(route, { data: { reactions: [] } });
    if (url.pathname === "/api/news") return json(route, { items: [], resources: [], fallback: false, cached: false });
    if (url.pathname === "/api/v1/push/config") {
      return json(route, {
        data: { configured: false, publicKey: null, vapidGeneration: null, subscriptionCount: 0 },
        meta: { requestId: "offline-push-config" },
      });
    }
    if (url.pathname === "/api/v1/notification-preferences") return json(route, { data: { preferences: [] } });
    if (url.pathname === "/api/v1/billing/status") return json(route, { data: { status: "inactive" } });
    return json(route, { data: {} });
  });

  await page.goto(`${baseUrl}/app`, { waitUntil: "networkidle" });
  await waitForToolsWithDiagnostics(page, 15_000, browserEvents);
  await page.waitForFunction(() => {
    const raw = localStorage.getItem("rivt.offlineSession.v1");
    if (!raw) return false;
    const snapshot = JSON.parse(raw);
    return snapshot?.account?.id === "offline-account"
      && snapshot?.activeWork?.[0]?.id === "offline-work"
      && typeof snapshot?.lastServerValidatedAt === "string"
      && !("updatedAt" in snapshot);
  });
  const immutableValidationTime = new Date(Date.now() - (29 * 24 * 60 * 60 * 1000)).toISOString();
  await page.evaluate((lastServerValidatedAt) => {
    const raw = localStorage.getItem("rivt.offlineSession.v1");
    const snapshot = JSON.parse(raw);
    localStorage.setItem("rivt.offlineSession.v1", JSON.stringify({ ...snapshot, lastServerValidatedAt }));
  }, immutableValidationTime);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (navigator.serviceWorker.controller) return;
    await new Promise((resolve) => {
      navigator.serviceWorker.addEventListener("controllerchange", resolve, { once: true });
    });
  });
  const cacheCoverage = await page.evaluate(async () => {
    const keys = await caches.keys();
    const requests = (await Promise.all(keys.map(async (key) => (await caches.open(key)).keys()))).flat();
    const cachedPaths = requests.map((request) => new URL(request.url).pathname);
    const manifest = await fetch('/asset-manifest.json').then((response) => response.json());
    const manifestPaths = Object.values(manifest).flatMap((entry) => [
      entry?.file,
      ...(Array.isArray(entry?.css) ? entry.css : []),
      ...(Array.isArray(entry?.assets) ? entry.assets : []),
    ]).filter((value) => typeof value === 'string' && value.startsWith('assets/'))
      .map((value) => `/${value}`);
    return {
      cachedPaths,
      missingManifestPaths: [...new Set(manifestPaths)].filter((value) => !cachedPaths.includes(value)),
    };
  });
  const cachedEntryPath = cacheCoverage.cachedPaths.find((value) => /^\/assets\/index-.*\.js$/.test(value));
  assert.ok(cachedEntryPath, `App entry was not precached: ${cacheCoverage.cachedPaths.join(", ")}`);
  assert.deepEqual(
    cacheCoverage.missingManifestPaths,
    [],
    `The installed shell omitted lazy build assets: ${cacheCoverage.missingManifestPaths.join(", ")}`,
  );
  for (const brandAsset of [
    "/brand/rivt-lockup-light-transparent.png",
    "/brand/rivt-lockup-dark-transparent.png",
  ]) {
    assert.ok(cacheCoverage.cachedPaths.includes(brandAsset), `The installed shell omitted ${brandAsset}`);
  }
  await page.evaluate(async () => {
    await new Promise((resolve, reject) => {
      const request = indexedDB.open("rivt-offline-recovery", 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction("operations", "readwrite");
        transaction.objectStore("operations").put({
          id: "foreign-account-operation",
          accountId: "different-account",
          kind: "workspace_record_create",
          status: "queued",
          payload: {
            projectId: "private-project",
            recordType: "note",
            input: {
              recordType: "note",
              visibility: "private",
              title: "",
              details: "Private note for a different account",
              requestedBy: "",
              amountCents: 0,
              dueNote: "",
              state: "active",
            },
          },
          idempotencyKey: "foreign-account-key",
          dedupeKey: null,
          label: "Private note",
          destinationLabel: "Different account",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          attempts: 0,
          nextAttemptAt: null,
          lastError: null,
        });
        transaction.oncomplete = () => {
          database.close();
          resolve();
        };
        transaction.onerror = () => reject(transaction.error);
      };
    });
    window.dispatchEvent(new CustomEvent("rivt:offline-queue-changed"));
  });
  await page.waitForTimeout(100);
  assert.equal(await page.getByLabel("Offline and sync status").count(), 0, "Another account's outbox must not appear or replay");

  serveApi = false;
  await context.setOffline(true);
  await page.waitForFunction(() => navigator.onLine === false);
  const offlineReloadStartedAt = Date.now();
  page = await reopenInstalledAppOfflineInFreshPage(context, page, configurePage);
  const freshPageWorkerState = await page.evaluate(async (entryPath) => {
    const controllerUrl = navigator.serviceWorker.controller?.scriptURL ?? null;
    const cacheNames = await caches.keys();
    const cachedPaths = (await Promise.all(cacheNames.map(async (cacheName) => (
      await (await caches.open(cacheName)).keys()
    )))).flat().map((request) => new URL(request.url).pathname);
    return { controllerUrl, entryCached: cachedPaths.includes(entryPath), cachedPaths };
  }, cachedEntryPath);
  assert.ok(freshPageWorkerState.controllerUrl, "The fresh installed-app page must start under service-worker control");
  assert.equal(
    new URL(freshPageWorkerState.controllerUrl).searchParams.get("build"),
    cachedEntryPath,
    "The fresh installed-app page must use the worker registered for the cached entry build",
  );
  assert.equal(
    freshPageWorkerState.entryCached,
    true,
    `The fresh installed-app page must retain the cached entry module: ${freshPageWorkerState.cachedPaths.join(", ")}`,
  );
  await waitForToolsWithDiagnostics(page, 10_000, browserEvents);
  assert.ok(
    Date.now() - offlineReloadStartedAt < 10_000,
    "A known-offline device should restore its cached workspace without waiting for the 15-second API timeout",
  );
  await page.getByText("You're offline. Supported field work can be saved on this device.", { exact: true }).waitFor({ timeout: 15_000 });
  assert.equal(await page.getByText(/RIVT is having trouble connecting/i).count(), 0, "An explicitly offline device should reopen its limited cached workspace");

  await page.getByRole("button", { name: "Work", exact: true }).click();
  await page.getByRole("navigation", { name: "Work stages" }).getByRole("button", { name: /^Active\b/ }).click();
  await page.getByRole("heading", { name: "Riverside Service Upgrade", exact: true }).waitFor({ timeout: 15_000 });

  await context.setOffline(false);
  await page.waitForFunction(() => navigator.onLine === true);
  await page.getByText(/RIVT is having trouble connecting/i).waitFor({ timeout: 20_000 });
  assert.equal(
    await page.evaluate(() => JSON.parse(localStorage.getItem("rivt.offlineSession.v1")).lastServerValidatedAt),
    immutableValidationTime,
    "Offline reads must not renew the server-validated session timestamp",
  );
  serveApi = true;
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await waitForToolsWithDiagnostics(page, 15_000, browserEvents);
  await page.getByRole("button", { name: /Open profile menu for/i }).click();
  await page.getByRole("dialog", { name: "Account menu" }).getByRole("button", { name: "Sign out" }).click();
  await page.waitForFunction(() => localStorage.getItem("rivt.offlineSession.v1") === null);
  const retainedForeignOutbox = await page.evaluate(async () => new Promise((resolve, reject) => {
    const request = indexedDB.open("rivt-offline-recovery", 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction("operations", "readonly");
      const getAll = transaction.objectStore("operations").getAll();
      getAll.onsuccess = () => {
        database.close();
        resolve(getAll.result.some((operation) => operation.id === "foreign-account-operation"));
      };
      getAll.onerror = () => reject(getAll.error);
    };
  }));
  assert.equal(retainedForeignOutbox, true, "Sign-out should clear the cached session without deleting another account's recovery queue");

  await context.close();
  await runSnapshotBoundaryRegressions(browser);
  await runUnauthorizedPurgeRegression(browser);
  await runAccountTransitionRegression(browser);
  await runBillingActionAccountTransitionRegression(browser, "checkout");
  await runBillingActionAccountTransitionRegression(browser, "portal");
  await runPushActionAccountTransitionRegression(browser, "enable");
  await runPushActionAccountTransitionRegression(browser, "test");
  await runPushActionAccountTransitionRegression(browser, "disable");
  await runCurrentSessionRevokeAccountTransitionRegression(browser);
  await runOnboardingRefreshIsolationRegression(browser);
  await runRestrictedShopTalkCreateIsolationRegression(browser);
  await runOfflineQueueAccountTransitionRegression(browser);
  await runOnlineGuestExitRegression(browser);
  await runOfflineGuestExitRegression(browser);
  await runPendingLogoutRegression(browser);
  console.log("Offline recovery E2E passed.");
} finally {
  await browser?.close();
  if (vite.exitCode === null) {
    const exited = once(vite, "exit");
    vite.kill();
    await Promise.race([
      exited,
      new Promise((_, reject) => setTimeout(
        () => reject(new Error("Timed out stopping the offline-recovery E2E Vite server.")),
        5_000,
      )),
    ]);
  }
}
