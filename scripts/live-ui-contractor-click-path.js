import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.RIVT_SMOKE_BASE_URL ?? "https://rivt.pro";
const email = process.env.RIVT_LIVE_TEST_EMAIL ?? "rivttesting@gmail.com";
const password = process.env.RIVT_LIVE_TEST_PASSWORD;
const runId = `contractor-click-${new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14)}-${randomBytes(3).toString("hex")}`;
const screenshotDir = path.join(os.tmpdir(), "rivt-contractor-click-path-live");

if (!password) {
  throw new Error("RIVT_LIVE_TEST_PASSWORD is required.");
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

async function loginApi() {
  const login = await requestJson("/api/v1/auth/login", {
    method: "POST",
    expected: 200,
    body: { email, password },
  });
  const cookie = sessionCookie(login.response);
  assert.ok(cookie, "login did not return a session cookie");
  const me = await requestJson("/api/v1/me", { cookie, expected: 200 });
  const account = me.payload.data;
  assert.equal(account.primaryRole, "contractor", "live test account must be a contractor");
  assert.ok(account.organizations?.[0]?.id, "contractor test account must own an organization");
  return { cookie, account };
}

async function createPublishReadyDraft(cookie, organizationId) {
  const created = await requestJson("/api/v1/jobs", {
    method: "POST",
    cookie,
    idempotencyKey: `contractor-click-create-${runId}`,
    expected: 201,
    body: {
      organizationId,
      title: `RIVT Click Path Draft ${runId}`,
      tradeCode: "electrical",
      summary: "Temporary production UI smoke job for validating contractor publish controls.",
      scopeDescription: "Validate that a complete draft can be opened from Work and published through the live mobile interface.",
      difficulty: "moderate",
      workType: "side_work",
      budgetCents: 65000,
      budgetUnit: "fixed",
      durationHours: 6,
      preferredStartDate: null,
      applicationDeadline: null,
      insuranceRequired: true,
      tools: ["Voltage tester", "Ladder"],
      materials: ["Materials provided by contractor"],
      deliverables: ["Completion photos", "Daily log"],
      certificationCodes: [],
      publicLocation: { city: "Jacksonville", region: "FL", countryCode: "US", postalPrefix: "322" },
      privateLocation: {
        addressLine1: "808 RIVT Smoke Way",
        addressLine2: "",
        city: "Jacksonville",
        region: "FL",
        postalCode: "32202",
        countryCode: "US",
        accessNotes: "Temporary click-path smoke fixture.",
      },
    },
  });
  return created.payload.data.job;
}

async function closeJobIfNeeded(cookie, jobId) {
  if (!jobId) return;
  try {
    const latest = await requestJson(`/api/v1/jobs/${jobId}`, { cookie, expected: 200 });
    const job = latest.payload.data.job;
    if (job.status === "closed") return;
    await requestJson(`/api/v1/jobs/${jobId}/close`, {
      method: "POST",
      cookie,
      idempotencyKey: `contractor-click-close-${runId}`,
      expected: 200,
      body: { expectedVersion: job.version, reason: "Closed after production contractor UI click-path smoke." },
    });
  } catch (error) {
    console.error("cleanup failed", error);
  }
}

async function assertNoHorizontalOverflow(page, label) {
  const overflow = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    offenders: [...document.body.querySelectorAll("*")]
      .map((el) => {
        const rect = el.getBoundingClientRect();
        return {
          tag: el.tagName.toLowerCase(),
          className: el instanceof HTMLElement ? el.className : "",
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          text: (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 80),
        };
      })
      .filter((entry) => entry.left < -2 || entry.right > window.innerWidth + 2)
      .slice(0, 8),
  }));
  assert.equal(overflow.scrollWidth <= overflow.width + 2, true, `${label} has horizontal overflow: ${JSON.stringify(overflow)}`);
  assert.deepEqual(overflow.offenders, [], `${label} has off-screen elements: ${JSON.stringify(overflow.offenders)}`);
}

async function assertClickable(page, locator, label) {
  await locator.evaluate((element) => element.scrollIntoView({ block: "center", inline: "nearest" }));
  await page.waitForTimeout(100);
  const result = await locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const x = Math.max(0, Math.min(window.innerWidth - 1, rect.left + rect.width / 2));
    const y = Math.max(0, Math.min(window.innerHeight - 1, rect.top + rect.height / 2));
    const hit = document.elementFromPoint(x, y);
    return {
      rect: {
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        top: Math.round(rect.top),
        bottom: Math.round(rect.bottom),
      },
      viewport: { width: window.innerWidth, height: window.innerHeight },
      clickable: Boolean(hit && (element === hit || element.contains(hit))),
      hitTag: hit?.tagName ?? null,
      hitClass: hit instanceof HTMLElement ? hit.className : null,
    };
  });
  assert.equal(result.clickable, true, `${label} is occluded: ${JSON.stringify(result)}`);
}

async function loginUi(page) {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.locator("form input[type='email']").fill(email);
  await page.locator("form input[type='password']").fill(password);
  await Promise.all([
    page.waitForResponse((response) => response.url().includes("/api/v1/auth/login"), { timeout: 20_000 }),
    page.locator("form button[type='submit']").click(),
  ]);
  await page.getByRole("button", { name: "Work", exact: true }).waitFor({ timeout: 20_000 });
}

async function runUi(jobTitle) {
  await mkdir(screenshotDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block", reducedMotion: "reduce" });
  const page = await context.newPage();
  const errors = [];
  const failedResponses = [];
  let auditNetworkFailures = false;
  page.on("console", (message) => {
    const text = message.text();
    if (text.includes("Service Worker registration blocked by Playwright")) return;
    if (text.includes("Failed to load resource: the server responded with a status of 401")) return;
    if (["warning", "error"].includes(message.type())) errors.push({ type: message.type(), text: text.slice(0, 300) });
  });
  page.on("pageerror", (error) => errors.push({ type: "pageerror", text: error.message.slice(0, 300) }));
  page.on("response", (response) => {
    if (auditNetworkFailures && response.status() >= 400) {
      failedResponses.push({ status: response.status(), url: response.url() });
    }
  });

  try {
    await loginUi(page);
    auditNetworkFailures = true;

    await page.getByRole("button", { name: "Search" }).click();
    await page.getByRole("dialog", { name: "Search RIVT" }).waitFor({ timeout: 15_000 });
    await page.getByLabel("Search jobs, questions, trades, or tools").fill("invoice");
    await page.locator(".v2-search-command-list button").filter({ hasText: "Open Tools" }).click();
    await page.getByRole("heading", { name: "Tools", exact: true }).waitFor({ timeout: 15_000 });
    await assertNoHorizontalOverflow(page, "live search to tools");

    await page.getByRole("button", { name: "Work", exact: true }).click();
    await page.getByRole("heading", { name: "Work", exact: true }).waitFor({ timeout: 15_000 });
    await page.getByRole("button", { name: "Drafts" }).click();
    const draftRow = page.locator(".v2-job-row-inner").filter({ hasText: jobTitle }).first();
    await draftRow.waitFor({ timeout: 20_000 });
    await assertClickable(page, draftRow, "draft job row");
    await draftRow.click();
    await page.getByRole("button", { name: "Publish" }).waitFor({ timeout: 15_000 });
    await assertNoHorizontalOverflow(page, "live draft detail");
    await page.screenshot({ path: path.join(screenshotDir, `${runId}-draft-detail.png`), fullPage: true });

    await page.getByRole("button", { name: "Edit" }).first().click();
    await page.getByRole("dialog", { name: "Edit job" }).waitFor({ timeout: 15_000 });
    await Promise.all([
      page.waitForResponse((response) => response.url().includes("/api/v1/jobs/") && response.status() === 200, { timeout: 20_000 }),
      page.getByRole("button", { name: "Save draft" }).click(),
    ]);
    assert.equal(await page.getByText(/Request validation failed/i).count(), 0, "draft edit should save without preferredStartDate validation failure");
    await page.getByRole("button", { name: "Publish" }).waitFor({ timeout: 15_000 });
    await assertClickable(page, page.getByRole("button", { name: "Publish" }), "publish button after draft edit");

    const [publishResponse] = await Promise.all([
      page.waitForResponse((response) => response.url().includes("/publish"), { timeout: 20_000 }),
      page.getByRole("button", { name: "Publish" }).click(),
    ]);
    const publishText = await publishResponse.text();
    assert.equal(publishResponse.status(), 200, `publish returned ${publishResponse.status()}: ${publishText}`);
    await page.getByRole("button", { name: "Open", exact: true }).click();
    await page.locator(".v2-job-row-inner").filter({ hasText: jobTitle }).first().waitFor({ timeout: 20_000 });

    await page.getByRole("button", { name: "Work", exact: true }).click();
    await page.getByRole("button", { name: "People", exact: true }).click();
    await page.getByRole("heading", { name: "Network", exact: true }).waitFor({ timeout: 15_000 });
    const planInvite = page.locator(".v2-crew-invite-form .v2-primary-button");
    await page.getByPlaceholder("Name or company").fill("First Coast Electric");
    await assertClickable(page, planInvite, "crew plan invite button");
    await assertNoHorizontalOverflow(page, "live crew");

    await page.getByRole("button", { name: "Shop Talk", exact: true }).click();
    await page.getByRole("button", { name: "Trade News" }).waitFor({ timeout: 15_000 });
    await page.getByRole("button", { name: "Trade News" }).click();
    await page.getByRole("heading", { name: /Code, safety, and permitting updates/i }).waitFor({ timeout: 15_000 });
    await assertNoHorizontalOverflow(page, "live trade news");

    await page.getByRole("button", { name: "Notifications" }).click();
    await page.getByRole("dialog", { name: "Notifications" }).waitFor({ timeout: 15_000 });
    await page.getByRole("button", { name: "Records" }).click();
    await page.getByRole("heading", { name: "Records", exact: true }).waitFor({ timeout: 15_000 });
    await assertNoHorizontalOverflow(page, "live records route");

    await page.screenshot({ path: path.join(screenshotDir, `${runId}-final.png`), fullPage: true });
    assert.deepEqual(errors, [], `live contractor UI produced console/page errors: ${JSON.stringify(errors)}`);
    assert.deepEqual(failedResponses, [], `live contractor UI produced failing responses: ${JSON.stringify(failedResponses)}`);
  } finally {
    await context.close();
    await browser.close();
  }
}

async function main() {
  const { cookie, account } = await loginApi();
  const job = await createPublishReadyDraft(cookie, account.organizations[0].id);
  try {
    await runUi(job.title);
    const latest = await requestJson(`/api/v1/jobs/${job.id}`, { cookie, expected: 200 });
    assert.equal(latest.payload.data.job.status, "open", "publish button did not move the draft to open status");
    console.log(JSON.stringify({
      ok: true,
      mode: "live-contractor-click-path",
      runId,
      baseUrl,
      jobId: job.id,
      screenshotDir,
    }, null, 2));
  } finally {
    await closeJobIfNeeded(cookie, job.id);
  }
}

await main();
