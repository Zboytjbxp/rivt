import "dotenv/config";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import pg from "pg";
import { chromium } from "playwright";

const baseUrl = process.env.RIVT_SMOKE_BASE_URL ?? "https://rivt.pro";
const databaseUrl = process.env.DATABASE_URL?.trim();
const expectedCommit = process.env.EXPECTED_SOURCE_COMMIT?.trim() || process.env.SOURCE_COMMIT?.trim();
const smokeRun = `daily-log-ui-${new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14)}-${randomBytes(3).toString("hex")}`;
const screenshotDir = path.join(os.tmpdir(), "rivt-daily-log-live-smoke");
const args = process.argv.slice(2);
const setupOnly = args.includes("--setup-only");
const browserOnlyFile = argValue("--browser-only");
const cleanupRun = argValue("--cleanup-run");

const pool = databaseUrl
  ? new pg.Pool({
      connectionString: databaseUrl,
      ssl: process.env.PGSSL === "disable" || databaseUrl.includes("localhost") ? false : { rejectUnauthorized: false },
    })
  : null;

function argValue(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
}

function requirePool() {
  if (!pool) throw new Error("DATABASE_URL is required for setup, cleanup, or full Daily Log Records smoke mode.");
  return pool;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeEmail(email) {
  return String(email).trim().toLowerCase();
}

function sessionCookie(response) {
  return String(response.headers.get("set-cookie") ?? "").split(";", 1)[0];
}

async function requestJson(pathname, { body, cookie, idempotencyKey, method = "GET", expected } = {}) {
  const headers = { Origin: baseUrl };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (cookie) headers.Cookie = cookie;
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;

  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (expected !== undefined) {
    assert.equal(response.status, expected, `${method} ${pathname} returned ${response.status}: ${text}`);
  }
  return { response, payload };
}

async function createInvite(client, { email, role }) {
  const code = `rivt_${randomBytes(24).toString("base64url")}`;
  const result = await client.query(
    `INSERT INTO signup_invites (code_hash, email_hash, allowed_role, max_uses, expires_at)
     VALUES ($1, $2, $3, 1, now() + interval '1 day')
     RETURNING id`,
    [sha256(code), sha256(normalizeEmail(email)), role],
  );
  return { code, id: result.rows[0].id };
}

async function verifyEmailDirectly(client, email) {
  await client.query(
    "UPDATE auth_users SET email_verified_at = COALESCE(email_verified_at, now()), updated_at = now() WHERE email_hash = $1",
    [sha256(normalizeEmail(email))],
  );
}

async function signupAndOnboard(role, label) {
  const email = `${smokeRun}-${role}-${randomBytes(2).toString("hex")}@example.test`;
  const password = `DailyLog!${randomBytes(10).toString("base64url")}1a`;
  const invite = await createInvite(requirePool(), { email, role });
  const signup = await requestJson("/api/v1/auth/signup", {
    method: "POST",
    expected: 201,
    body: { email, password, displayName: `${label} ${smokeRun}`, role, inviteCode: invite.code },
  });
  const cookie = sessionCookie(signup.response);
  await verifyEmailDirectly(requirePool(), email);
  await requestJson("/api/v1/onboarding/complete", {
    method: "POST",
    cookie,
    expected: 200,
    body: {
      role,
      displayName: `${label} ${smokeRun}`,
      headline: role === "contractor" ? "RIVT daily-log smoke contractor" : "RIVT daily-log smoke electrician",
      bio: "Temporary Daily Log Records UI smoke account.",
      serviceAreaCity: "Jacksonville",
      serviceAreaRegion: "FL",
      serviceRadiusMiles: 35,
      availabilityStatus: "available",
      contactEmailVisibility: "private",
      phoneE164: null,
      phoneVisibility: "private",
      tradeCodes: ["electrical"],
      organizationName: role === "contractor" ? `${label} ${smokeRun} LLC` : undefined,
      consentAccepted: true,
      consentVersion: "2026-06-19",
    },
  });
  const me = await requestJson("/api/v1/me", { cookie, expected: 200 });
  return {
    role,
    email,
    password,
    cookie,
    inviteId: invite.id,
    accountId: me.payload.data.id,
    organizationId: me.payload.data.organizations[0]?.id,
  };
}

async function createPublishedJob(contractor) {
  const created = await requestJson("/api/v1/jobs", {
    method: "POST",
    cookie: contractor.cookie,
    idempotencyKey: `daily-log-create-${smokeRun}`,
    expected: 201,
    body: {
      organizationId: contractor.organizationId,
      title: `Daily Log Records UI ${smokeRun}`,
      tradeCode: "electrical",
      summary: "Temporary production UI smoke job for Daily Log Records.",
      scopeDescription: "Verify the Tools Daily Log can save a project timeline note through the authenticated Records API.",
      difficulty: "moderate",
      workType: "side_work",
      budgetCents: 72500,
      budgetUnit: "fixed",
      durationHours: 6,
      insuranceRequired: true,
      tools: ["Voltage tester", "Ladder"],
      deliverables: ["Daily log", "Project note"],
      publicLocation: { city: "Jacksonville", region: "FL", countryCode: "US", postalPrefix: "322" },
      privateLocation: {
        addressLine1: "808 Daily Log Smoke Way",
        addressLine2: "",
        city: "Jacksonville",
        region: "FL",
        postalCode: "32202",
        countryCode: "US",
        accessNotes: "Temporary smoke fixture.",
      },
    },
  });

  const published = await requestJson(`/api/v1/jobs/${created.payload.data.job.id}/publish`, {
    method: "POST",
    cookie: contractor.cookie,
    idempotencyKey: `daily-log-publish-${smokeRun}`,
    expected: 200,
    body: {
      expectedVersion: created.payload.data.job.version,
      consentAccepted: true,
      consentVersion: "2026-06-19",
    },
  });

  return published.payload.data.job;
}

async function createActiveWork(contractor, tradesperson, job) {
  const submitted = await requestJson(`/api/v1/jobs/${job.id}/applications`, {
    method: "POST",
    cookie: tradesperson.cookie,
    idempotencyKey: `daily-log-apply-${smokeRun}`,
    expected: 201,
    body: {
      message: "I can handle this Daily Log Records smoke scope.",
      proposedStartDate: "2026-07-01",
      consentAccepted: true,
      consentVersion: "2026-06-19",
    },
  });
  const offer = await requestJson(`/api/v1/applications/${submitted.payload.data.application.id}/offer`, {
    method: "POST",
    cookie: contractor.cookie,
    idempotencyKey: `daily-log-offer-${smokeRun}`,
    expected: 201,
    body: {
      startDate: "2026-07-02",
      scopeSummary: "Daily Log Records smoke scope accepted.",
      message: "Confirm the work and test the field log.",
    },
  });
  const accepted = await requestJson(`/api/v1/offers/${offer.payload.data.offer.id}/accept`, {
    method: "POST",
    cookie: tradesperson.cookie,
    idempotencyKey: `daily-log-accept-${smokeRun}`,
    expected: 200,
    body: {
      reason: "Confirmed for Daily Log UI smoke.",
      consentAccepted: true,
      consentVersion: "2026-06-19",
    },
  });
  return accepted.payload.data.activeWork;
}

async function closeSmokeArtifacts(accounts, run = smokeRun) {
  const accountIds = accounts.map((account) => account.accountId).filter(Boolean);
  if (accountIds.length > 0) {
    await requirePool().query("UPDATE profiles SET visibility = 'private', updated_at = now() WHERE account_id = ANY($1::uuid[])", [accountIds]);
    await requirePool().query("UPDATE auth_sessions SET revoked_at = now() WHERE user_id = ANY($1::uuid[]) AND revoked_at IS NULL", [accountIds]);
    await requirePool().query("UPDATE organizations SET status = 'closed', updated_at = now() WHERE created_by_account_id = ANY($1::uuid[]) AND status <> 'closed'", [accountIds]);
    await requirePool().query("UPDATE accounts SET status = 'closed', updated_at = now() WHERE id = ANY($1::uuid[])", [accountIds]);
  }
  await requirePool().query("UPDATE jobs SET status = 'closed', closed_at = COALESCE(closed_at, now()), updated_at = now() WHERE title LIKE $1", [`%${run}%`]);
}

async function closeSmokeRun(run) {
  assert.match(run, /^daily-log-ui-\d{14}-[a-f0-9]{6}$/);
  const result = await requirePool().query(
    "SELECT id::text AS id FROM auth_users WHERE email LIKE $1",
    [`${run}-%@example.test`],
  );
  const accounts = result.rows.map((row) => ({ accountId: row.id }));
  await closeSmokeArtifacts(accounts, run);
  return accounts.length;
}

async function assertNoHorizontalOverflow(page, label) {
  const overflow = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    offenders: [...document.body.querySelectorAll("*")]
      .map((el) => {
        const rect = el.getBoundingClientRect();
        return {
          text: (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 80),
          tag: el.tagName.toLowerCase(),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
        };
      })
      .filter((entry) => entry.left < -2 || entry.right > window.innerWidth + 2)
      .slice(0, 10),
  }));
  assert.equal(overflow.scrollWidth <= overflow.width + 2, true, `${label} has horizontal overflow: ${JSON.stringify(overflow)}`);
  assert.deepEqual(overflow.offenders, [], `${label} has off-screen elements: ${JSON.stringify(overflow.offenders)}`);
}

async function loginAndSaveDailyLog(account, jobTitle, marker) {
  await mkdir(screenshotDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const page = await context.newPage();
  const errors = [];

  page.on("console", (message) => {
    if (["warning", "error"].includes(message.type())) errors.push({ type: message.type(), text: message.text().slice(0, 300) });
  });
  page.on("pageerror", (error) => errors.push({ type: "pageerror", text: error.message.slice(0, 300) }));

  try {
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await page.locator("form input[type='email']").fill(account.email);
    await page.locator("form input[type='password']").fill(account.password);
    await Promise.all([
      page.waitForResponse((response) => response.url().includes("/api/v1/auth/login"), { timeout: 20_000 }),
      page.locator("form button[type='submit']").click(),
    ]);
    await page.waitForFunction(() => document.body.innerText.includes("Home") && document.body.innerText.includes("Tools"), null, { timeout: 20_000 });

    errors.length = 0;
    await page.goto(`${baseUrl}/app/tools`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "Tools", exact: true }).waitFor({ timeout: 20_000 });
    await page.locator("button.v2-tool-launch-card").filter({ hasText: "Jobsite" }).first().click();
    await page.getByRole("heading", { name: "Jobsite", exact: true }).waitFor({ timeout: 20_000 });
    await page.getByLabel("Jobsite sections").getByRole("button", { name: "Log", exact: true }).waitFor({ timeout: 20_000 });
    await page.getByText("Records-ready", { exact: true }).waitFor({ timeout: 20_000 });
    await page.locator(".v2-daily-log-record-target").getByText(jobTitle, { exact: true }).waitFor({ timeout: 20_000 });

    await page.getByLabel("Work completed").fill(`Installed labels and captured Daily Log UI marker ${marker}.`);
    await page.getByLabel("Blockers / changes").fill(`No blockers for ${marker}.`);
    await page.getByLabel("Safety note").fill(`Verified PPE and panel cover before saving ${marker}.`);
    await page.getByRole("button", { name: "Photos captured" }).click();
    await page.getByRole("button", { name: "Safety condition checked" }).click();
    await page.locator(".v2-daily-log-preview").getByText(marker, { exact: false }).waitFor({ timeout: 20_000 });
    await page.getByRole("button", { name: "Save to Records" }).click();
    await page.getByText("Daily log saved to the server-backed Records timeline.", { exact: true }).waitFor({ timeout: 20_000 });
    await assertNoHorizontalOverflow(page, "Daily Log Records live UI");
    await page.screenshot({ path: path.join(screenshotDir, `${smokeRun}-daily-log-records.png`), fullPage: true });
    assert.deepEqual(errors, [], `Daily Log Records live UI produced console/page errors: ${JSON.stringify(errors)}`);
  } finally {
    await context.close();
    await browser.close();
  }
}

async function createAcceptedWorkFixture() {
  const health = await requestJson("/api/health", { expected: 200 });
  assert.equal(health.payload.ok, true);
  if (expectedCommit) assert.equal(health.payload.build.commit, expectedCommit);

  const accounts = [];
  const contractor = await signupAndOnboard("contractor", "DailyLog UI Contractor");
  accounts.push(contractor);
  const tradesperson = await signupAndOnboard("tradesperson", "DailyLog UI Trade");
  accounts.push(tradesperson);

  const job = await createPublishedJob(contractor);
  const activeWork = await createActiveWork(contractor, tradesperson, job);
  const marker = `daily-log-live-marker-${smokeRun}`;
  return {
    ok: true,
    mode: "setup",
    run: smokeRun,
    baseUrl,
    buildCommit: health.payload.build.commit,
    accounts,
    contractor,
    tradesperson,
    jobTitle: job.title,
    activeWorkId: activeWork.id,
    marker,
  };
}

async function verifyDailyLogProjectEntry({ contractor, activeWorkId, marker, checkDatabase = false }) {
  const opened = await requestJson(`/api/v1/active-work/${activeWorkId}/project`, {
    method: "POST",
    cookie: contractor.cookie,
    idempotencyKey: `daily-log-verify-project-${smokeRun}`,
    expected: 200,
    body: {},
  });
  const project = opened.payload.data.project;
  assert.ok(project.entries.some((entry) => entry.body.includes(marker)), "Project bundle did not include the Daily Log UI marker.");

  let dailyLogEntries = project.entries.filter((entry) => entry.body.includes(marker)).length;
  if (checkDatabase) {
    const persisted = await requirePool().query(
      `SELECT count(*)::int AS count
       FROM project_entries pe
       INNER JOIN projects p ON p.id = pe.project_id
       WHERE p.active_work_id = $1 AND pe.body LIKE $2`,
      [activeWorkId, `%${marker}%`],
    );
    assert.equal(persisted.rows[0].count, 1, "Daily Log UI marker was not persisted exactly once.");
    dailyLogEntries = persisted.rows[0].count;
  }

  return { project, dailyLogEntries };
}

async function runBrowserOnly(filePath) {
  const setup = JSON.parse(await readFile(filePath, "utf8"));
  assert.equal(setup.ok, true);
  assert.ok(setup.contractor, "Browser-only mode requires a contractor account.");
  assert.ok(setup.activeWorkId, "Browser-only mode requires an activeWorkId.");
  assert.ok(setup.jobTitle, "Browser-only mode requires a jobTitle.");
  assert.ok(setup.marker, "Browser-only mode requires a Daily Log marker.");
  await loginAndSaveDailyLog(setup.contractor, setup.jobTitle, setup.marker);
  const verified = await verifyDailyLogProjectEntry({
    contractor: setup.contractor,
    activeWorkId: setup.activeWorkId,
    marker: setup.marker,
    checkDatabase: false,
  });

  console.log(JSON.stringify({
    ok: true,
    mode: "browser-only",
    smokeRun: setup.run,
    baseUrl,
    buildCommit: setup.buildCommit,
    activeWorkId: setup.activeWorkId,
    projectId: verified.project.id,
    dailyLogEntries: verified.dailyLogEntries,
    screenshotDir,
  }, null, 2));
}

async function runFullSmoke() {
  const setup = await createAcceptedWorkFixture();
  try {
    await loginAndSaveDailyLog(setup.contractor, setup.jobTitle, setup.marker);
    const verified = await verifyDailyLogProjectEntry({
      contractor: setup.contractor,
      activeWorkId: setup.activeWorkId,
      marker: setup.marker,
      checkDatabase: true,
    });
    console.log(JSON.stringify({
      ok: true,
      mode: "full",
      smokeRun,
      baseUrl,
      buildCommit: setup.buildCommit,
      activeWorkId: setup.activeWorkId,
      projectId: verified.project.id,
      dailyLogEntries: verified.dailyLogEntries,
      screenshotDir,
    }, null, 2));
  } finally {
    await closeSmokeArtifacts(setup.accounts).catch((error) => {
      console.error("cleanup failed", error);
    });
  }
}

async function main() {
  if (cleanupRun) {
    const accountsClosed = await closeSmokeRun(cleanupRun);
    console.log(JSON.stringify({ ok: true, mode: "cleanup", run: cleanupRun, accountsClosed }, null, 2));
    return;
  }

  if (browserOnlyFile) {
    await runBrowserOnly(browserOnlyFile);
    return;
  }

  if (setupOnly) {
    const setup = await createAcceptedWorkFixture();
    console.log(`RIVT_DAILY_LOG_UI_SETUP_JSON=${JSON.stringify(setup)}`);
    return;
  }

  await runFullSmoke();
}

try {
  await main();
} finally {
  if (pool) await pool.end();
}
