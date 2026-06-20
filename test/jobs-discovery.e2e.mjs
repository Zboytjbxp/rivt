import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const port = 5188;
const baseUrl = `http://127.0.0.1:${port}`;
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const viteBin = path.join(projectRoot, "node_modules", "vite", "bin", "vite.js");
const vite = spawn(process.execPath, [viteBin, "--host", "127.0.0.1", "--port", String(port)], {
  cwd: projectRoot,
  env: { ...process.env, VITE_ENABLE_GUEST_DEMO: "false" },
  stdio: ["ignore", "pipe", "pipe"],
});

const account = {
  id: "0d29894e-630f-4ec1-97bc-7e1d1995b9ec",
  status: "active",
  primaryRole: "contractor",
  email: "contractor@example.com",
  provider: "email",
  emailVerified: true,
  profile: {
    displayName: "Jordan Rivera",
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
  organizations: [{ id: "a1a18923-ae27-40c7-a1e8-e39ec7973f4a", name: "River City Electric", role: "owner" }],
  capabilities: { canCompleteOnboarding: false, canPostWork: true, canApplyToWork: false, canPublishProfile: true },
};

const job = {
  id: "6a6b46c8-0870-44fd-97f9-07b061734d58",
  organization: { id: account.organizations[0].id, name: account.organizations[0].name },
  createdByAccountId: account.id,
  title: "Commercial panel rough-in",
  trade: { code: "electrical", name: "Electrical" },
  summary: "Rough in a new commercial service panel and branch circuits.",
  scopeDescription: "Install panel, conduit, branch wiring, labels, and prepare the work for inspection.",
  status: "draft",
  difficulty: "advanced",
  workType: "multi_day",
  budget: { amountCents: 180000, currency: "USD", unit: "fixed" },
  durationHours: 16,
  preferredStartDate: "2026-06-24",
  applicationDeadline: null,
  insuranceRequired: true,
  publicLocation: { city: "Jacksonville", region: "FL", countryCode: "US", postalPrefix: "322" },
  privateLocation: { addressLine1: "100 Private Way", addressLine2: "", city: "Jacksonville", region: "FL", postalCode: "32202", countryCode: "US", accessNotes: "Call on arrival" },
  requirements: { tools: ["Conduit bender"], materials: ["Materials onsite"], deliverables: ["Inspection-ready rough-in"], certificationCodes: [] },
  addressPrivacy: "Exact address is shared only after acceptance.",
  matchScore: null,
  version: 1,
  publishedAt: null,
  pausedAt: null,
  closedAt: null,
  createdAt: "2026-06-19T12:00:00.000Z",
  updatedAt: "2026-06-19T12:00:00.000Z",
  events: [],
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

async function configurePage(page, jobs) {
  await page.route("**/api/v1/me", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: account }) }));
  await page.route("**/api/auth/providers", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ providers: {} }) }));
  await page.route("**/api/app-state", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(route.request().method() === "GET" ? { state: null, updatedAt: null } : { ok: true, updatedAt: new Date().toISOString() }) }));
  await page.route("**/api/v1/conversations", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { conversations: [] }, meta: { requestId: "e2e-conversations" } }) }));
  await page.route("**/api/v1/notifications", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { notifications: [], unreadCount: 0 }, meta: { requestId: "e2e-notifications" } }) }));
  await page.route("**/api/v1/jobs?**", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 120));
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { jobs }, meta: { nextCursor: null } }) });
  });
  await page.route(`**/api/v1/jobs/${job.id}`, (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { job } }) }));
}

let browser;
try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });

  for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport });
    const consoleErrors = [];
    page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
    await configurePage(page, []);
    await page.goto(`${baseUrl}/app/work`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "Work", exact: true }).waitFor();
    await page.getByText("No open jobs", { exact: true }).waitFor();
    for (const label of ["Home", "Work", "Crew", "Shop Talk", "Tools"]) {
      assert.equal(await page.getByRole("button", { name: new RegExp(`^${label}$`) }).count() > 0, true);
    }
    assert.equal(await page.getByRole("button", { name: "Messages" }).count(), 1);
    assert.equal(await page.getByRole("button", { name: "Notifications" }).count(), 1);
    assert.equal(await page.getByText("Marcus Webb").count(), 0);
    assert.deepEqual(consoleErrors, []);
    await page.close();
  }

  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await configurePage(page, [job]);
  await page.goto(`${baseUrl}/app/work`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Draft" }).click();
  await page.getByText(job.title, { exact: true }).first().waitFor();
  await page.getByRole("button", { name: "Edit" }).click();
  await page.getByRole("dialog", { name: "Edit job" }).waitFor();
  assert.equal(await page.getByLabel("Job title").inputValue(), job.title);
  assert.equal(await page.getByText("Exact address is private", { exact: true }).count(), 0);
  await page.getByRole("dialog", { name: "Edit job" }).getByRole("button", { name: "Close" }).click();
  console.log("Jobs and discovery E2E passed at desktop and mobile viewports.");
} finally {
  await browser?.close();
  vite.kill();
}
