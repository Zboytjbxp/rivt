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

let browser;
try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: "allow",
  });
  const page = await context.newPage();
  let serveApi = true;

  await page.route("**/api/**", (route) => {
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
  await page.getByRole("button", { name: "Tools", exact: true }).waitFor({ timeout: 15_000 });
  await page.waitForFunction(() => {
    const raw = localStorage.getItem("rivt.offlineSession.v1");
    if (!raw) return false;
    const snapshot = JSON.parse(raw);
    return snapshot?.account?.id === "offline-account" && snapshot?.activeWork?.[0]?.id === "offline-work";
  });
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (navigator.serviceWorker.controller) return;
    await new Promise((resolve) => {
      navigator.serviceWorker.addEventListener("controllerchange", resolve, { once: true });
    });
  });
  const cachedPaths = await page.evaluate(async () => {
    const keys = await caches.keys();
    const requests = (await Promise.all(keys.map(async (key) => (await caches.open(key)).keys()))).flat();
    return requests.map((request) => new URL(request.url).pathname);
  });
  assert.ok(cachedPaths.some((value) => /^\/assets\/index-.*\.js$/.test(value)), `App entry was not precached: ${cachedPaths.join(", ")}`);
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
  await page.reload({ waitUntil: "domcontentloaded", timeout: 20_000 });
  await page.getByRole("button", { name: "Tools", exact: true }).waitFor({ timeout: 15_000 });
  await page.getByText("You're offline. Supported field work can be saved on this device.", { exact: true }).waitFor({ timeout: 15_000 });
  assert.equal(await page.getByText(/RIVT is having trouble connecting/i).count(), 0, "An explicitly offline device should reopen its limited cached workspace");

  await page.getByRole("button", { name: "Work", exact: true }).click();
  await page.getByText("Riverside Service Upgrade", { exact: true }).first().waitFor({ timeout: 15_000 });

  await context.setOffline(false);
  await page.waitForFunction(() => navigator.onLine === true);
  await page.getByText(/RIVT is having trouble connecting/i).waitFor({ timeout: 15_000 });
  serveApi = true;
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await page.getByRole("button", { name: "Tools", exact: true }).waitFor({ timeout: 15_000 });
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

  console.log("Offline recovery E2E passed.");
  await context.close();
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
