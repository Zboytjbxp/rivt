import "dotenv/config";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import pg from "pg";
import { chromium } from "playwright";

const baseUrl = process.env.RIVT_SMOKE_BASE_URL ?? "https://rivt.pro";
const databaseUrl = process.env.DATABASE_URL?.trim();
const expectedCommit = process.env.EXPECTED_SOURCE_COMMIT?.trim() || process.env.SOURCE_COMMIT?.trim();
const smokeRun = `ui-a11y-${new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14)}-${randomBytes(3).toString("hex")}`;
const args = process.argv.slice(2);
const setupOnly = args.includes("--setup-only");
const cleanupRun = argValue("--cleanup-run");
const browserOnlyFile = argValue("--browser-only");

const auditScenarios = [
  { name: "phone-compact", viewport: { width: 360, height: 800 }, roles: ["contractor", "tradesperson"] },
  { name: "phone-standard", viewport: { width: 390, height: 844 }, roles: ["contractor", "tradesperson"] },
  { name: "tablet", viewport: { width: 768, height: 1024 }, roles: ["contractor"] },
  { name: "laptop", viewport: { width: 1366, height: 768 }, roles: ["contractor"] },
  { name: "desktop-wide", viewport: { width: 1440, height: 900 }, roles: ["contractor"] },
  { name: "phone-200-percent-text", viewport: { width: 390, height: 844 }, roles: ["contractor"], textScale: 2 },
];

let pool;

if (databaseUrl) {
  pool = new pg.Pool({
    connectionString: databaseUrl,
    ssl: process.env.PGSSL === "disable" || databaseUrl.includes("localhost") ? false : { rejectUnauthorized: false },
  });
}

function argValue(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
}

function requirePool() {
  if (!pool) throw new Error("DATABASE_URL is required for setup or cleanup modes.");
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

async function requestJson(path, { body, cookie, idempotencyKey, method = "GET", expected } = {}) {
  const headers = { Origin: baseUrl };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (cookie) headers.Cookie = cookie;
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (expected !== undefined) {
    assert.equal(response.status, expected, `${method} ${path} returned ${response.status}: ${text}`);
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
  const password = `UiSmoke!${randomBytes(10).toString("base64url")}1a`;
  const invite = await createInvite(requirePool(), { email, role });
  const signup = await requestJson("/api/v1/auth/signup", {
    method: "POST",
    expected: 201,
    body: {
      email,
      password,
      displayName: `${label} ${smokeRun}`,
      role,
      inviteCode: invite.code,
    },
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
      headline: role === "contractor" ? "RIVT UI smoke contractor" : "RIVT UI smoke electrician",
      bio: "Temporary Gate A authenticated UI accessibility smoke account.",
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

async function closeSmokeArtifacts(accounts) {
  const accountIds = accounts.map((account) => account.accountId).filter(Boolean);
  if (accountIds.length === 0) return;

  await requirePool().query("UPDATE profiles SET visibility = 'private', updated_at = now() WHERE account_id = ANY($1::uuid[])", [accountIds]);
  await requirePool().query("UPDATE auth_sessions SET revoked_at = now() WHERE user_id = ANY($1::uuid[]) AND revoked_at IS NULL", [accountIds]);
  await requirePool().query("UPDATE jobs SET status = 'closed', closed_at = COALESCE(closed_at, now()), updated_at = now() WHERE created_by_account_id = ANY($1::uuid[]) AND status <> 'closed'", [accountIds]);
  await requirePool().query("UPDATE organizations SET status = 'closed', updated_at = now() WHERE created_by_account_id = ANY($1::uuid[]) AND status <> 'closed'", [accountIds]);
  await requirePool().query("UPDATE accounts SET status = 'closed', updated_at = now() WHERE id = ANY($1::uuid[])", [accountIds]);
}

async function closeSmokeRun(run) {
  assert.match(run, /^ui-a11y-\d{14}-[a-f0-9]{6}$/);
  const result = await requirePool().query(
    "SELECT id::text AS id FROM auth_users WHERE email LIKE $1",
    [`${run}-%@example.test`],
  );
  const accounts = result.rows.map((row) => ({ accountId: row.id }));
  await closeSmokeArtifacts(accounts);
  return accounts.length;
}

async function firstVisibleClick(page, label) {
  const count = await page.evaluate((text) => {
    function visible(el) {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    }
    const matches = [...document.querySelectorAll("button,a")]
      .filter((el) => visible(el) && (el.textContent || "").replace(/\s+/g, " ").trim() === text);
    matches.at(-1)?.click();
    return matches.length;
  }, label);
  assert.ok(count > 0, `No visible ${label} navigation control was found.`);
  await page.waitForTimeout(350);
}

async function clickVisibleControl(page, { pattern, flags = "i", description }) {
  const count = await page.evaluate(({ pattern: patternText, flags: patternFlags }) => {
    const matcher = new RegExp(patternText, patternFlags);
    function textOf(el) {
      return (el.getAttribute("aria-label") || el.getAttribute("title") || el.textContent || el.getAttribute("placeholder") || "")
        .replace(/\s+/g, " ")
        .trim();
    }
    function visible(el) {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    }
    const matches = [...document.querySelectorAll("button,a,input,[role='button']")]
      .filter((el) => visible(el) && matcher.test(textOf(el)));
    matches.at(-1)?.click();
    return matches.length;
  }, { pattern, flags });
  assert.ok(count > 0, `No visible ${description} control was found.`);
  await page.waitForTimeout(350);
}

async function collectUiAudit(page, label) {
  return page.evaluate((auditLabel) => {
    function textOf(el) {
      return (el.getAttribute("aria-label") || el.getAttribute("title") || el.textContent || el.getAttribute("placeholder") || "")
        .replace(/\s+/g, " ")
        .trim();
    }
    function visible(el) {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    }
    const interactive = [...document.querySelectorAll("button,a,input,select,textarea,[role='button'],[tabindex]:not([tabindex='-1'])")]
      .filter(visible);
    const controls = interactive.map((el) => {
      const rect = el.getBoundingClientRect();
      return {
        name: textOf(el),
        tag: el.tagName.toLowerCase(),
        className: typeof el.className === "string" ? el.className : "",
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      };
    });
    const bodyText = document.body.innerText.replace(/\s+/g, " ").trim();
    const overflow = [...document.body.querySelectorAll("*")]
      .filter(visible)
      .map((el) => {
        const rect = el.getBoundingClientRect();
        return {
          name: textOf(el).slice(0, 80),
          tag: el.tagName.toLowerCase(),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
        };
      })
      .filter((entry) => entry.left < -2 || entry.right > window.innerWidth + 2)
      .slice(0, 20);

    return {
      label: auditLabel,
      url: window.location.href,
      title: document.title,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight,
      },
      requiredNav: ["Home", "Work", "Crew", "Shop Talk", "Tools"].map((name) => ({
        name,
        visible: controls.some((control) => control.name === name),
      })),
      topBarSignals: {
        search: controls.some((control) => /search/i.test(control.name)),
        messages: controls.some((control) => /message|chat/i.test(control.name)),
        notifications: controls.some((control) => /notification|bell/i.test(control.name)),
        profile: controls.some((control) => /profile|account|avatar|sign out/i.test(control.name)),
      },
      hasMoreNav: controls.some((control) => control.name === "More"),
      roleToggleVisible: [...document.querySelectorAll(".role-toggle")].some(visible),
      missingNames: controls.filter((control) => !control.name).slice(0, 15),
      smallTargets: controls.filter((control) => control.width < 44 || control.height < 44).slice(0, 20),
      overflow,
      bodyStart: bodyText.slice(0, 500),
      frameworkOverlay: Boolean(document.querySelector("vite-error-overlay, nextjs-portal, [data-nextjs-dialog-overlay]"))
        || /\b(Vite|Webpack|Next\.js)\b.*\b(error|overlay)\b/i.test(bodyText)
        || /\b(Runtime Error|Failed to compile|Internal server error)\b/i.test(bodyText),
    };
  }, label);
}

async function collectKeyboardAudit(page, label) {
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });

  const focusSteps = [];
  for (let index = 0; index < 32; index += 1) {
    await page.keyboard.press("Tab");
    const step = await page.evaluate(() => {
      function textOf(el) {
        return (el.getAttribute("aria-label") || el.getAttribute("title") || el.textContent || el.getAttribute("placeholder") || "")
          .replace(/\s+/g, " ")
          .trim();
      }
      function visible(el) {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
      }
      const element = document.activeElement;
      if (!(element instanceof HTMLElement) || element === document.body || element === document.documentElement) return null;
      const rect = element.getBoundingClientRect();
      return {
        name: textOf(element),
        tag: element.tagName.toLowerCase(),
        className: typeof element.className === "string" ? element.className : "",
        visible: visible(element),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        left: Math.round(rect.left),
        top: Math.round(rect.top),
      };
    });
    if (step) focusSteps.push(step);
  }

  const visibleFocusSteps = focusSteps.filter((step) => step.visible);
  assert.ok(visibleFocusSteps.length > 0, `${label} did not expose any visible keyboard focus targets.`);
  const unnamedVisibleFocus = visibleFocusSteps.filter((step) => !step.name);
  assert.deepEqual(unnamedVisibleFocus, [], `${label} has visible keyboard focus targets without names: ${JSON.stringify(unnamedVisibleFocus)}`);
  assert.ok(
    visibleFocusSteps.some((step) => /search/i.test(step.name)),
    `${label} keyboard focus did not reach the top-bar search control within 32 Tab presses.`,
  );
  assert.ok(
    visibleFocusSteps.some((step) => /home|work|crew|shop talk|tools/i.test(step.name)),
    `${label} keyboard focus did not reach primary navigation within 32 Tab presses.`,
  );

  return {
    label,
    focusStepCount: visibleFocusSteps.length,
    firstFocusNames: visibleFocusSteps.map((step) => step.name).slice(0, 12),
  };
}

async function assertNoDialog(page, name) {
  await page.getByRole("dialog", { name }).waitFor({ state: "detached", timeout: 5000 }).catch(async () => {
    await page.getByRole("dialog", { name }).waitFor({ state: "hidden", timeout: 5000 });
  });
}

async function collectTopBarActionAudits(page, scenarioLabel) {
  const audits = [];

  await page.keyboard.press("Control+K");
  await page.getByRole("dialog", { name: "Search RIVT" }).waitFor({ timeout: 5000 });
  audits.push(await collectUiAudit(page, `${scenarioLabel}-search-dialog`));
  await page.keyboard.press("Escape");
  await assertNoDialog(page, "Search RIVT");

  await clickVisibleControl(page, { pattern: "^Notifications$", description: "notifications" });
  await page.getByRole("dialog", { name: "Notifications" }).waitFor({ timeout: 5000 });
  await page.getByRole("button", { name: /Mark read/i }).waitFor({ timeout: 5000 });
  audits.push(await collectUiAudit(page, `${scenarioLabel}-notifications-panel`));
  await page.getByRole("button", { name: "Close notifications" }).click();
  await assertNoDialog(page, "Notifications");

  await clickVisibleControl(page, { pattern: "Open profile menu", description: "profile menu" });
  await page.getByRole("dialog", { name: "Settings" }).waitFor({ timeout: 5000 });
  await page.getByRole("button", { name: "Sign out" }).waitFor({ timeout: 5000 });
  audits.push(await collectUiAudit(page, `${scenarioLabel}-account-panel`));
  await page.getByRole("button", { name: "Close account" }).click();
  await assertNoDialog(page, "Settings");

  await clickVisibleControl(page, { pattern: "^Messages$", description: "messages" });
  await page.getByRole("heading", { name: "Inbox", exact: true }).waitFor({ timeout: 10000 });
  await page.getByText("Server-owned job messages and notifications", { exact: false }).waitFor({ timeout: 5000 });
  audits.push(await collectUiAudit(page, `${scenarioLabel}-messages-page`));
  await firstVisibleClick(page, "Home");

  return audits;
}

async function loginAndAudit(browser, account, scenario) {
  const context = await browser.newContext({ viewport: scenario.viewport, reducedMotion: "reduce" });
  const page = await context.newPage();
  const logs = [];
  page.on("console", (message) => {
    if (["warning", "error"].includes(message.type())) {
      logs.push({ type: message.type(), text: message.text().slice(0, 300) });
    }
  });

  try {
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await page.locator("form input[type='email']").fill(account.email);
    await page.locator("form input[type='password']").fill(account.password);
    await Promise.all([
      page.waitForResponse((response) => response.url().includes("/api/v1/auth/login"), { timeout: 20000 }),
      page.locator("form button[type='submit']").click(),
    ]);
    await page.waitForFunction(() => document.body.innerText.includes("Home") && document.body.innerText.includes("Work"), null, { timeout: 20000 });
    if (scenario.textScale && scenario.textScale !== 1) {
      await page.addStyleTag({ content: `html { font-size: ${16 * scenario.textScale}px !important; }` });
      await page.waitForTimeout(150);
    }
    logs.length = 0;

    const scenarioLabel = `${account.role}-${scenario.name}-${scenario.viewport.width}x${scenario.viewport.height}`;
    const audits = [await collectUiAudit(page, `${scenarioLabel}-home`)];
    for (const navItem of ["Work", "Crew", "Shop Talk", "Tools", "Home"]) {
      await firstVisibleClick(page, navItem);
      audits.push(await collectUiAudit(page, `${scenarioLabel}-${navItem.toLowerCase().replace(/\s+/g, "-")}`));
    }
    const topBarActionAudits = await collectTopBarActionAudits(page, scenarioLabel);

    for (const audit of [...audits, ...topBarActionAudits]) {
      assert.equal(audit.title, "RIVT | Where skilled trades connect", `${audit.label} has unexpected title.`);
      assert.equal(audit.frameworkOverlay, false, `${audit.label} shows a framework/runtime overlay.`);
      assert.equal(audit.viewport.scrollWidth <= audit.viewport.width + 2, true, `${audit.label} has horizontal page overflow.`);
      assert.deepEqual(audit.overflow, [], `${audit.label} has off-screen visible elements: ${JSON.stringify(audit.overflow)}`);
      assert.deepEqual(audit.requiredNav.filter((item) => !item.visible), [], `${audit.label} is missing primary nav.`);
      assert.equal(audit.hasMoreNav, false, `${audit.label} still exposes a More nav control.`);
      assert.equal(audit.roleToggleVisible, false, `${audit.label} still exposes a role toggle.`);
      assert.deepEqual(audit.missingNames, [], `${audit.label} has visible interactive controls without names: ${JSON.stringify(audit.missingNames)}`);
      assert.deepEqual(audit.smallTargets, [], `${audit.label} has visible interactive controls below 44px: ${JSON.stringify(audit.smallTargets)}`);
      for (const [signal, present] of Object.entries(audit.topBarSignals)) {
        assert.equal(present, true, `${audit.label} is missing top-bar ${signal}.`);
      }
    }
    assert.deepEqual(logs, [], `${scenarioLabel} produced post-login console warnings/errors: ${JSON.stringify(logs)}`);
    const keyboard = await collectKeyboardAudit(page, `${scenarioLabel}-keyboard`);

    return {
      role: account.role,
      scenario: scenario.name,
      viewport: scenario.viewport,
      textScale: scenario.textScale ?? 1,
      logs,
      reducedMotion: true,
      keyboard,
      topBarActionAudits: topBarActionAudits.map((audit) => ({
        label: audit.label,
        url: audit.url,
        topBarSignals: audit.topBarSignals,
        smallTargets: audit.smallTargets,
        bodyStart: audit.bodyStart,
      })),
      audits: audits.map((audit) => ({
        label: audit.label,
        url: audit.url,
        requiredNav: audit.requiredNav,
        topBarSignals: audit.topBarSignals,
        smallTargets: audit.smallTargets,
        bodyStart: audit.bodyStart,
      })),
    };
  } finally {
    await context.close();
  }
}

async function runBrowserOnly(filePath) {
  const setup = JSON.parse(await readFile(filePath, "utf8"));
  assert.equal(setup.ok, true);
  assert.ok(Array.isArray(setup.accounts));
  const browser = await chromium.launch({ headless: true });
  try {
    const results = [];
    for (const scenario of auditScenarios) {
      for (const role of scenario.roles) {
        const account = setup.accounts.find((candidate) => candidate.role === role);
        assert.ok(account, `Browser-only mode requires a ${role} account for ${scenario.name}.`);
        results.push(await loginAndAudit(browser, account, scenario));
      }
    }
    console.log(JSON.stringify(summarizeResults({
      run: setup.run,
      buildCommit: setup.buildCommit,
      accountsClosed: 0,
      results,
      mode: "browser-only",
    }), null, 2));
  } finally {
    await browser.close();
  }
}

function summarizeResults({ run, buildCommit, accountsClosed, results, mode = "full" }) {
  return {
    ok: true,
    mode,
    run,
    buildCommit,
    baseUrl,
    accountsClosed,
    viewports: results.map((result) => ({
      role: result.role,
      scenario: result.scenario,
      viewport: result.viewport,
      textScale: result.textScale,
      auditCount: result.audits.length,
      reducedMotion: result.reducedMotion,
      keyboard: result.keyboard,
      topBarActionAuditCount: result.topBarActionAudits.length,
      consoleWarningsOrErrors: result.logs.length,
      consoleSamples: result.logs.slice(0, 3),
      topBarSignals: result.audits[0]?.topBarSignals ?? null,
      smallTargetCount: [...result.audits, ...result.topBarActionAudits].reduce((count, audit) => count + audit.smallTargets.length, 0),
      smallTargetSamples: [...result.audits, ...result.topBarActionAudits].flatMap((audit) =>
        audit.smallTargets.map((target) => ({
          screen: audit.label,
          ...target,
        })),
      ).slice(0, 10),
    })),
  };
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

  const accounts = [];
  let browser;
  try {
    const health = await requestJson("/api/health", { expected: 200 });
    assert.equal(health.payload.ok, true);
    if (expectedCommit) assert.equal(health.payload.build.commit, expectedCommit);

    accounts.push(await signupAndOnboard("contractor", "GateA UI Contractor"));
    accounts.push(await signupAndOnboard("tradesperson", "GateA UI Trade"));

    if (setupOnly) {
      console.log(`RIVT_UI_SMOKE_SETUP_JSON=${JSON.stringify({
        ok: true,
        mode: "setup",
        run: smokeRun,
        buildCommit: health.payload.build.commit,
        baseUrl,
        accounts,
      })}`);
      return;
    }

    browser = await chromium.launch({ headless: true });
    const results = [];
    for (const scenario of auditScenarios) {
      for (const role of scenario.roles) {
        const account = accounts.find((candidate) => candidate.role === role);
        assert.ok(account, `Missing ${role} account for ${scenario.name}.`);
        results.push(await loginAndAudit(browser, account, scenario));
      }
    }

    await closeSmokeArtifacts(accounts);

    console.log(JSON.stringify(summarizeResults({
      run: smokeRun,
      buildCommit: health.payload.build.commit,
      accountsClosed: accounts.length,
      results,
    }), null, 2));
  } finally {
    if (browser) await browser.close();
    if (!setupOnly) await closeSmokeArtifacts(accounts).catch(() => {});
  }
}

try {
  await main();
} finally {
  if (pool) await pool.end();
}
