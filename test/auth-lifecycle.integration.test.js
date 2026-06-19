import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import test from "node:test";
import pg from "pg";

const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();

if (!testDatabaseUrl) {
  test("account lifecycle and onboarding", { skip: "TEST_DATABASE_URL is not configured" }, () => {});
} else {
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = testDatabaseUrl;
  process.env.PGSSL = "disable";
  process.env.APP_ORIGIN = "https://rivt.pro";
  process.env.EMAIL_FROM = "RIVT Test <noreply@example.test>";
  process.env.EMAIL_DELIVERY_MODE = "capture";
  process.env.AUTH_METADATA_PEPPER = "auth-lifecycle-test-pepper";
  process.env.REQUIRE_PILOT_INVITE = "false";
  process.env.S3_BUCKET = "";
  process.env.S3_ACCESS_KEY_ID = "";
  process.env.S3_SECRET_ACCESS_KEY = "";

  const { Pool } = pg;
  const database = new Pool({ connectionString: testDatabaseUrl, ssl: false });
  const { app, closeDatabase, ensureDatabaseReady } = await import("../server/index.js");
  const { capturedEmailMessages, clearCapturedEmailMessages } = await import("../server/email.js");

  function sessionCookie(response) {
    return String(response.headers.get("set-cookie") ?? "").split(";", 1)[0];
  }

  async function requestJson(baseUrl, path, { body, cookie, method = "GET", userAgent } = {}) {
    const headers = { Origin: "https://rivt.pro" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (cookie) headers.Cookie = cookie;
    if (userAgent) headers["User-Agent"] = userAgent;
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const payload = await response.json();
    return { response, payload };
  }

  function tokenFromLatestEmail(email, route) {
    const message = [...capturedEmailMessages()].reverse().find((candidate) => candidate.to === email);
    assert.ok(message, `Expected a captured email for ${email}`);
    const match = message.text.match(new RegExp(`${route}\\?token=([^\\s]+)`));
    assert.ok(match, `Expected ${route} token in captured email`);
    return decodeURIComponent(match[1]);
  }

  async function signup(baseUrl, role, label) {
    const email = `${label}-${randomUUID()}@example.test`;
    const result = await requestJson(baseUrl, "/api/v1/auth/signup", {
      method: "POST",
      userAgent: "Mozilla/5.0 (Windows NT 10.0) Chrome/125.0",
      body: {
        email,
        password: "SafePassword!1234",
        displayName: `${label} account`,
        role,
      },
    });
    assert.equal(result.response.status, 201);
    assert.equal(result.payload.data.verificationRequired, true);
    return {
      id: result.payload.data.user.id,
      email,
      cookie: sessionCookie(result.response),
    };
  }

  async function verifyEmail(baseUrl, account) {
    const token = tokenFromLatestEmail(account.email, "verify-email");
    const verified = await requestJson(baseUrl, "/api/v1/auth/email/verify", {
      method: "POST",
      body: { token },
    });
    assert.equal(verified.response.status, 200);
    assert.equal(verified.payload.data.verified, true);
    return token;
  }

  async function completeOnboarding(baseUrl, account, role) {
    const result = await requestJson(baseUrl, "/api/v1/onboarding/complete", {
      method: "POST",
      cookie: account.cookie,
      body: {
        role,
        displayName: role === "contractor" ? "River City Electric" : "Alex Torres",
        headline: role === "contractor" ? "Commercial electrical contractor" : "Journeyman electrician",
        bio: "Jacksonville trade professional focused on reliable field work.",
        serviceAreaCity: "Jacksonville",
        serviceAreaRegion: "FL",
        serviceRadiusMiles: 35,
        availabilityStatus: "available",
        contactEmailVisibility: "private",
        phoneE164: null,
        phoneVisibility: "private",
        tradeCodes: ["electrical"],
        organizationName: role === "contractor" ? "River City Electric" : undefined,
        consentAccepted: true,
        consentVersion: "2026-06-19",
      },
    });
    assert.equal(result.response.status, 200);
    assert.equal(result.payload.data.account.account.primaryRole, role);
  }

  test("account lifecycle and onboarding", async (context) => {
    await ensureDatabaseReady();
    clearCapturedEmailMessages();
    const server = app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    const baseUrl = `http://127.0.0.1:${server.address().port}`;

    context.after(async () => {
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
      await closeDatabase();
      await database.end();
    });

    const contractor = await signup(baseUrl, "contractor", "contractor");
    let me = await requestJson(baseUrl, "/api/v1/me", { cookie: contractor.cookie });
    assert.equal(me.payload.data.emailVerified, false);
    assert.equal(me.payload.data.status, "onboarding");
    assert.equal(me.payload.data.capabilities.canCompleteOnboarding, false);
    assert.equal(me.payload.data.capabilities.canPostWork, false);

    const blockedOnboarding = await requestJson(baseUrl, "/api/v1/onboarding/complete", {
      method: "POST",
      cookie: contractor.cookie,
      body: {
        role: "contractor",
        displayName: "River City Electric",
        serviceAreaCity: "Jacksonville",
        serviceAreaRegion: "FL",
        serviceRadiusMiles: 35,
        tradeCodes: ["electrical"],
        organizationName: "River City Electric",
        consentAccepted: true,
        consentVersion: "2026-06-19",
      },
    });
    assert.equal(blockedOnboarding.response.status, 403);
    assert.equal(blockedOnboarding.payload.error.code, "EMAIL_VERIFICATION_REQUIRED");

    const firstVerificationToken = tokenFromLatestEmail(contractor.email, "verify-email");
    const resent = await requestJson(baseUrl, "/api/v1/auth/email/resend", {
      method: "POST",
      cookie: contractor.cookie,
    });
    assert.equal(resent.response.status, 202);
    const verificationToken = tokenFromLatestEmail(contractor.email, "verify-email");
    assert.notEqual(verificationToken, firstVerificationToken);
    const supersededVerification = await requestJson(baseUrl, "/api/v1/auth/email/verify", {
      method: "POST",
      body: { token: firstVerificationToken },
    });
    assert.equal(supersededVerification.response.status, 400);
    const verified = await requestJson(baseUrl, "/api/v1/auth/email/verify", {
      method: "POST",
      body: { token: verificationToken },
    });
    assert.equal(verified.response.status, 200);
    const replay = await requestJson(baseUrl, "/api/v1/auth/email/verify", {
      method: "POST",
      body: { token: verificationToken },
    });
    assert.equal(replay.response.status, 400);
    assert.equal(replay.payload.error.code, "VERIFICATION_TOKEN_INVALID");

    await completeOnboarding(baseUrl, contractor, "contractor");
    me = await requestJson(baseUrl, "/api/v1/me", { cookie: contractor.cookie });
    assert.equal(me.payload.data.status, "active");
    assert.equal(me.payload.data.primaryRole, "contractor");
    assert.equal(me.payload.data.profile.trades[0].code, "electrical");
    assert.equal(me.payload.data.organizations[0].name, "River City Electric");
    assert.equal(me.payload.data.capabilities.canPostWork, true);
    assert.equal(me.payload.data.capabilities.canApplyToWork, false);

    const publish = await requestJson(baseUrl, "/api/v1/profile/publish", {
      method: "POST",
      cookie: contractor.cookie,
    });
    assert.equal(publish.response.status, 200);
    assert.equal(publish.payload.data.visibility, "network");

    const roleChange = await requestJson(baseUrl, "/api/v1/onboarding/complete", {
      method: "POST",
      cookie: contractor.cookie,
      body: {
        role: "tradesperson",
        displayName: "Role Change",
        serviceAreaCity: "Jacksonville",
        serviceAreaRegion: "FL",
        serviceRadiusMiles: 25,
        tradeCodes: ["electrical"],
        consentAccepted: true,
        consentVersion: "2026-06-19",
      },
    });
    assert.equal(roleChange.response.status, 409);
    assert.equal(roleChange.payload.error.code, "ROLE_IMMUTABLE");

    const tradesperson = await signup(baseUrl, "tradesperson", "tradesperson");
    await verifyEmail(baseUrl, tradesperson);
    await completeOnboarding(baseUrl, tradesperson, "tradesperson");
    const tradespersonMe = await requestJson(baseUrl, "/api/v1/me", { cookie: tradesperson.cookie });
    assert.equal(tradespersonMe.payload.data.capabilities.canApplyToWork, true);
    assert.equal(tradespersonMe.payload.data.organizations.length, 0);

    const secondLogin = await requestJson(baseUrl, "/api/v1/auth/login", {
      method: "POST",
      userAgent: "Mozilla/5.0 (Android) Chrome/125.0",
      body: { email: contractor.email, password: "SafePassword!1234" },
    });
    assert.equal(secondLogin.response.status, 200);
    const secondCookie = sessionCookie(secondLogin.response);
    const sessions = await requestJson(baseUrl, "/api/v1/sessions", { cookie: secondCookie });
    assert.equal(sessions.response.status, 200);
    assert.equal(sessions.payload.data.sessions.length, 2);
    assert.ok(sessions.payload.data.sessions.some((session) => session.deviceLabel === "Chrome on Android" && session.current));

    const revokeOthers = await requestJson(baseUrl, "/api/v1/sessions/revoke-others", {
      method: "POST",
      cookie: secondCookie,
    });
    assert.equal(revokeOthers.payload.data.revokedCount, 1);
    const oldSession = await requestJson(baseUrl, "/api/v1/me", { cookie: contractor.cookie });
    assert.equal(oldSession.response.status, 401);

    clearCapturedEmailMessages();
    const forgot = await requestJson(baseUrl, "/api/v1/auth/password/forgot", {
      method: "POST",
      body: { email: contractor.email },
    });
    assert.equal(forgot.response.status, 202);
    const firstResetToken = tokenFromLatestEmail(contractor.email, "reset-password");
    const forgotAgain = await requestJson(baseUrl, "/api/v1/auth/password/forgot", {
      method: "POST",
      body: { email: contractor.email },
    });
    assert.equal(forgotAgain.response.status, 202);
    const resetToken = tokenFromLatestEmail(contractor.email, "reset-password");
    assert.notEqual(resetToken, firstResetToken);
    const supersededReset = await requestJson(baseUrl, "/api/v1/auth/password/reset", {
      method: "POST",
      body: { token: firstResetToken, password: "UnusedPassword!9876" },
    });
    assert.equal(supersededReset.response.status, 400);
    const reset = await requestJson(baseUrl, "/api/v1/auth/password/reset", {
      method: "POST",
      body: { token: resetToken, password: "NewSafePassword!5678" },
    });
    assert.equal(reset.response.status, 200);
    const resetReplay = await requestJson(baseUrl, "/api/v1/auth/password/reset", {
      method: "POST",
      body: { token: resetToken, password: "AnotherPassword!9" },
    });
    assert.equal(resetReplay.response.status, 400);
    assert.equal(resetReplay.payload.error.code, "RESET_TOKEN_INVALID");
    assert.equal((await requestJson(baseUrl, "/api/v1/me", { cookie: secondCookie })).response.status, 401);

    const oldPassword = await requestJson(baseUrl, "/api/v1/auth/login", {
      method: "POST",
      body: { email: contractor.email, password: "SafePassword!1234" },
    });
    assert.equal(oldPassword.response.status, 401);
    const newPassword = await requestJson(baseUrl, "/api/v1/auth/login", {
      method: "POST",
      body: { email: contractor.email, password: "NewSafePassword!5678" },
    });
    assert.equal(newPassword.response.status, 200);

    process.env.REQUIRE_PILOT_INVITE = "true";
    const missingInvite = await requestJson(baseUrl, "/api/v1/auth/signup", {
      method: "POST",
      body: {
        email: `no-invite-${randomUUID()}@example.test`,
        password: "SafePassword!1234",
        displayName: "No Invite",
        role: "tradesperson",
      },
    });
    assert.equal(missingInvite.response.status, 403);
    assert.equal(missingInvite.payload.error.code, "INVITATION_REQUIRED");

    const inviteCode = `rivt_${randomUUID()}`;
    const invitedEmail = `invited-${randomUUID()}@example.test`;
    const hash = (value) => createHash("sha256").update(value).digest("hex");
    await database.query(
      `INSERT INTO signup_invites (code_hash, email_hash, allowed_role, expires_at)
       VALUES ($1, $2, 'tradesperson', now() + interval '1 day')`,
      [hash(inviteCode), hash(invitedEmail)],
    );
    const invited = await requestJson(baseUrl, "/api/v1/auth/signup", {
      method: "POST",
      body: {
        email: invitedEmail,
        password: "SafePassword!1234",
        displayName: "Invited Pro",
        role: "tradesperson",
        inviteCode,
      },
    });
    assert.equal(invited.response.status, 201);
    const reusedInvite = await requestJson(baseUrl, "/api/v1/auth/signup", {
      method: "POST",
      body: {
        email: `reuse-${randomUUID()}@example.test`,
        password: "SafePassword!1234",
        displayName: "Reuse Invite",
        role: "tradesperson",
        inviteCode,
      },
    });
    assert.equal(reusedInvite.response.status, 403);
    assert.equal(reusedInvite.payload.error.code, "INVITATION_INVALID");
    process.env.REQUIRE_PILOT_INVITE = "false";
  });
}
