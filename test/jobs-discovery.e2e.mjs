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

const activeWorkItem = {
  id: "9c72aa97-7a41-47bb-8d67-9b4e12cb83f1",
  jobId: job.id,
  offerId: "6d1ff85f-d6f4-4f85-9bbd-bf2a70cf9cf7",
  organizationId: account.organizations[0].id,
  contractorAccountId: account.id,
  tradespersonAccountId: "9913cfd7-e467-4c4e-91f6-ac40e46f099b",
  status: "in_progress",
  startedAt: "2026-06-24T12:00:00.000Z",
  completedAt: null,
  cancelledAt: null,
  createdAt: "2026-06-24T12:00:00.000Z",
  updatedAt: "2026-06-24T12:00:00.000Z",
  job: {
    id: job.id,
    title: job.title,
    status: "accepted",
    organization: job.organization,
    publicLocation: job.publicLocation,
  },
  events: [],
};

const projectRecord = {
  id: "8ca50a33-f676-450a-b415-df20b3a31d43",
  activeWorkId: activeWorkItem.id,
  jobId: job.id,
  organizationId: account.organizations[0].id,
  status: "open",
  contractorAccountId: account.id,
  tradespersonAccountId: activeWorkItem.tradespersonAccountId,
  job: {
    title: job.title,
    status: "accepted",
    publicLocation: job.publicLocation,
  },
  entries: [
    {
      id: "entry-1",
      projectId: "8ca50a33-f676-450a-b415-df20b3a31d43",
      actorAccountId: account.id,
      entryType: "system",
      body: "Project record opened.",
      checklist: {},
      metadata: {},
      createdAt: "2026-06-24T12:05:00.000Z",
    },
  ],
  media: [
    {
      id: "media-1",
      projectId: "8ca50a33-f676-450a-b415-df20b3a31d43",
      uploadId: "upload-1",
      originalName: "panel-before.jpg",
      mimeType: "image/jpeg",
      sizeBytes: 182400,
      contentSha256: "abc123",
      mediaKind: "photo",
      status: "stored",
      reviewStatus: "accepted",
      failureReason: "",
      createdAt: "2026-06-24T12:10:00.000Z",
      signedUrl: null,
    },
  ],
  completionSubmissions: [],
  updatedAt: "2026-06-24T12:10:00.000Z",
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

async function configurePage(page, jobs, { activeWork = [], project = null } = {}) {
  await page.route("**/api/v1/me", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: account }) }));
  await page.route("**/api/auth/providers", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ providers: {} }) }));
  await page.route("**/api/v1/sessions", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { sessions: [] }, meta: { requestId: "e2e-sessions" } }) }));
  await page.route("**/api/v1/conversations", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { conversations: [] }, meta: { requestId: "e2e-conversations" } }) }));
  await page.route("**/api/v1/notifications", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { notifications: [], unreadCount: 0 }, meta: { requestId: "e2e-notifications" } }) }));
  await page.route("**/api/v1/active-work", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { activeWork }, meta: { requestId: "e2e-active-work" } }) }));
  if (project && activeWork[0]) {
    await page.route(`**/api/v1/active-work/${activeWork[0].id}/project`, (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { project }, meta: { requestId: "e2e-project" } }) }));
    await page.route(`**/api/v1/projects/${project.id}/entries`, (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { entry: project.entries[0] }, meta: { requestId: "e2e-project-note" } }) }));
    await page.route(`**/api/v1/projects/${project.id}/report`, (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { report: { projectId: project.id, entries: project.entries.length, media: project.media.length } }, meta: { requestId: "e2e-project-report" } }) }));
  }
  await page.route("**/api/v1/jobs?**", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 120));
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { jobs }, meta: { nextCursor: null } }) });
  });
  await page.route(`**/api/v1/jobs/${job.id}`, (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { job } }) }));
}

async function assertToolsFlow(page) {
  await page.goto(`${baseUrl}/app/tools`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Tools", exact: true }).waitFor();
  await page.getByRole("button", { name: /Heavy 16th/i }).click();
  await page.getByRole("heading", { name: "Heavy 16th field calculator" }).waitFor();
  await page.getByLabel("Length calculator").getByText("Total length", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Spacing" }).click();
  await page.getByLabel("Equal spacing calculator").getByText("Center-to-center").waitFor();
  await page.getByLabel("Heavy 16th field calculator").getByRole("button", { name: "Tools" }).click();

  await page.getByRole("button", { name: /Estimate builder/i }).click();
  await page.getByRole("heading", { name: "Estimate builder" }).waitFor();
  await page.getByText("Recommended target", { exact: true }).waitFor();
  await page.getByLabel("Estimate builder").getByRole("button", { name: "Tools" }).click();

  await page.getByRole("button", { name: /Invoice draft/i }).click();
  await page.getByRole("heading", { name: "Invoice draft" }).waitFor();
  await page.getByText("Email/text delivery is not represented as production-ready", { exact: false }).waitFor();
  await page.getByLabel("Invoice draft").getByRole("button", { name: "Tools" }).click();

  await page.getByRole("button", { name: /Material takeoff/i }).click();
  await page.getByRole("heading", { name: "Material takeoff" }).waitFor();
  await page.getByText("Sheets needed", { exact: true }).waitFor();
}

async function assertRecordsFlow(page) {
  await page.goto(`${baseUrl}/app/tools/records`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Records", exact: true }).waitFor();
  await page.getByRole("button", { name: new RegExp(projectRecord.job.title) }).click();
  await page.getByText("Field notebook", { exact: true }).waitFor();
  await page.getByText("Evidence", { exact: true }).waitFor();
  await page.getByText("Creates the reviewable closeout step", { exact: true }).waitFor();
  await page.getByText("Review completion", { exact: true }).waitFor();
  await page.getByText("panel-before.jpg", { exact: true }).waitFor();
  await page.getByPlaceholder("What changed on site?").fill("Panel rough-in inspected and photo attached.");
  await page.getByRole("button", { name: "Add note" }).click();
  await page.getByText("Private note added to the project timeline.").waitFor();
  await page.getByRole("button", { name: "Report" }).click();
  await page.getByText("Closeout report loaded from server records.").waitFor();
  await page.getByText(`"projectId": "${projectRecord.id}"`).waitFor();
}

async function assertTopBarActions(page) {
  await page.keyboard.press("Control+K");
  await page.getByRole("dialog", { name: "Search RIVT" }).waitFor();
  await page.getByPlaceholder("Search jobs, people, messages, and tools").fill("electrical");
  await page.keyboard.press("Escape");
  await page.getByRole("dialog", { name: "Search RIVT" }).waitFor({ state: "detached" }).catch(async () => {
    await page.getByRole("dialog", { name: "Search RIVT" }).waitFor({ state: "hidden" });
  });

  await page.getByRole("button", { name: "Notifications" }).click();
  await page.getByRole("dialog", { name: "Notifications" }).waitFor();
  await page.getByRole("button", { name: /Mark read/i }).waitFor();
  await page.getByRole("button", { name: "Messages" }).last().waitFor();
  await page.getByRole("button", { name: "Close notifications" }).click();

  await page.getByRole("button", { name: /Open profile menu for/i }).last().click();
  await page.getByRole("dialog", { name: "Settings" }).waitFor();
  await page.getByRole("button", { name: "Sign out" }).waitFor();
  await page.getByRole("button", { name: "Close account" }).click();

  await page.getByRole("button", { name: "Messages" }).click();
  await page.getByRole("heading", { name: "Inbox", exact: true }).waitFor();
  await page.getByText("Server-owned job messages and notifications", { exact: false }).waitFor();
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
    await assertTopBarActions(page);
    await assertToolsFlow(page);
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
  await page.close();

  const recordsPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await configurePage(recordsPage, [job], { activeWork: [activeWorkItem], project: projectRecord });
  await assertRecordsFlow(recordsPage);
  await recordsPage.close();
  console.log("Jobs and discovery E2E passed at desktop and mobile viewports.");
} finally {
  await browser?.close();
  vite.kill();
}
