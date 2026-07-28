import "dotenv/config";
import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import pg from "pg";

const baseUrl = (process.env.RIVT_SMOKE_BASE_URL ?? "https://rivt.pro").replace(/\/+$/, "");
const databaseUrl = process.env.DATABASE_URL?.trim();
const expectedCommit = process.env.EXPECTED_SOURCE_COMMIT?.trim() || process.env.SOURCE_COMMIT?.trim();
const smokeRun = `professional-profile-${new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14)}-${randomBytes(3).toString("hex")}`;

if (!databaseUrl) throw new Error("DATABASE_URL is required.");

const pool = new pg.Pool({
  connectionString: databaseUrl,
  ssl: process.env.PGSSL === "disable" || databaseUrl.includes("localhost")
    ? false
    : { rejectUnauthorized: false },
});

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeEmail(email) {
  return String(email).trim().toLowerCase();
}

function sessionCookie(response) {
  return String(response.headers.get("set-cookie") ?? "").split(";", 1)[0];
}

async function requestJson(pathname, {
  body,
  cookie,
  expected,
  idempotencyKey,
  method = "GET",
} = {}) {
  const headers = { Accept: "application/json", Origin: baseUrl };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (cookie) headers.Cookie = cookie;
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  const text = await response.text();
  if (expected !== undefined) {
    assert.equal(response.status, expected, `${method} ${pathname} returned ${response.status}: ${text.slice(0, 500)}`);
  }
  return { response, payload: text ? JSON.parse(text) : null };
}

async function requestForm(pathname, {
  cookie,
  expected,
  fields,
  file,
  method = "POST",
}) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields ?? {})) form.append(key, String(value));
  if (file) form.append("file", new Blob([file.buffer], { type: file.type }), file.name);
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: { Accept: "application/json", Origin: baseUrl, Cookie: cookie },
    body: form,
    signal: AbortSignal.timeout(30_000),
  });
  const text = await response.text();
  assert.equal(response.status, expected, `${method} ${pathname} returned ${response.status}: ${text.slice(0, 500)}`);
  return { response, payload: text ? JSON.parse(text) : null };
}

async function createInvite(email, role) {
  const code = `rivt_${randomBytes(24).toString("base64url")}`;
  const result = await pool.query(
    `INSERT INTO signup_invites (code_hash, email_hash, allowed_role, max_uses, expires_at)
     VALUES ($1, $2, $3, 1, now() + interval '1 day')
     RETURNING id`,
    [sha256(code), sha256(normalizeEmail(email)), role],
  );
  return { code, id: result.rows[0].id };
}

async function verifyEmailDirectly(email) {
  await pool.query(
    `UPDATE auth_users
     SET email_verified_at = COALESCE(email_verified_at, now()), updated_at = now()
     WHERE email_hash = $1`,
    [sha256(normalizeEmail(email))],
  );
}

async function createAccount(role, label) {
  const email = `${smokeRun}-${role}-${randomBytes(2).toString("hex")}@example.test`;
  const invite = await createInvite(email, role);
  const signup = await requestJson("/api/v1/auth/signup", {
    method: "POST",
    expected: 201,
    body: {
      email,
      password: `Profile!${randomBytes(10).toString("base64url")}1a`,
      displayName: `${label} ${smokeRun}`,
      role,
      inviteCode: invite.code,
    },
  });
  const cookie = sessionCookie(signup.response);
  assert.ok(cookie);
  await verifyEmailDirectly(email);
  const onboarded = await requestJson("/api/v1/onboarding/complete", {
    method: "POST",
    cookie,
    expected: 200,
    body: {
      role,
      displayName: `${label} ${smokeRun}`,
      organizationName: role === "contractor" ? `${label} ${smokeRun} LLC` : undefined,
      headline: "Temporary professional profile smoke account",
      bio: "Temporary authenticated production proof.",
      serviceAreaCity: "Jacksonville",
      serviceAreaRegion: "FL",
      serviceRadiusMiles: 35,
      availabilityStatus: "available",
      contactEmailVisibility: "private",
      phoneE164: null,
      phoneVisibility: "private",
      tradeCodes: ["electrical"],
      consentAccepted: true,
      consentVersion: "2026-06-19",
    },
  });
  return {
    accountId: onboarded.payload.data.account.account.id,
    cookie,
    inviteId: invite.id,
  };
}

async function closeArtifacts(accounts) {
  for (const account of accounts) {
    if (!account.accountId) continue;
    await pool.query("UPDATE profiles SET visibility = 'private', updated_at = now() WHERE account_id = $1", [account.accountId]);
    await pool.query("UPDATE auth_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL", [account.accountId]);
    await pool.query("UPDATE accounts SET status = 'closed', updated_at = now() WHERE id = $1", [account.accountId]);
    await pool.query(
      "UPDATE organizations SET status = 'closed', updated_at = now() WHERE created_by_account_id = $1 AND status <> 'closed'",
      [account.accountId],
    );
    if (account.inviteId) await pool.query("DELETE FROM signup_invites WHERE id = $1", [account.inviteId]);
  }
}

function gpsJpeg() {
  const tiff = Buffer.alloc(26);
  tiff.write("II", 0, "ascii");
  tiff.writeUInt16LE(42, 2);
  tiff.writeUInt32LE(8, 4);
  tiff.writeUInt16LE(1, 8);
  tiff.writeUInt16LE(0x8825, 10);
  tiff.writeUInt16LE(4, 12);
  tiff.writeUInt32LE(1, 14);
  tiff.writeUInt32LE(26, 18);
  const exif = Buffer.concat([Buffer.from("Exif\0\0", "binary"), tiff]);
  const segmentLength = Buffer.alloc(2);
  segmentLength.writeUInt16BE(exif.length + 2);
  return Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe1]), segmentLength, exif, Buffer.from([0xff, 0xd9])]);
}

const accounts = [];
let evidenceCredential = null;
let avatarCreated = false;

try {
  const health = await requestJson("/api/health", { expected: 200 });
  if (expectedCommit) assert.equal(health.payload.build.commit, expectedCommit);
  assert.equal(health.payload.migrations.pending.length, 0);
  assert.equal(health.payload.migrations.latest.name, "0039_professional_identity");

  const owner = await createAccount("tradesperson", "Profile Owner");
  accounts.push(owner);
  const viewer = await createAccount("contractor", "Profile Viewer");
  accounts.push(viewer);

  await requestJson("/api/v1/profile/publish", {
    method: "POST",
    cookie: owner.cookie,
    expected: 200,
  });

  await requestJson("/api/v1/profile/credentials", {
    method: "POST",
    cookie: owner.cookie,
    expected: 201,
    idempotencyKey: randomUUID(),
    body: {
      kind: "training",
      name: "Private profile smoke record",
      issuer: "RIVT QA",
      credentialNumber: "",
      issueDate: null,
      expiryDate: null,
      notes: "Must never reach another account.",
      visibility: "private",
    },
  });

  const sharedCredential = await requestJson("/api/v1/profile/credentials", {
    method: "POST",
    cookie: owner.cookie,
    expected: 201,
    idempotencyKey: randomUUID(),
    body: {
      kind: "certification",
      name: "Professional profile smoke credential",
      issuer: "RIVT QA",
      credentialNumber: "SMOKE",
      issueDate: "2026-07-27",
      expiryDate: "2027-07-27",
      notes: "",
      visibility: "network",
    },
  });
  evidenceCredential = sharedCredential.payload.data.credential;

  const evidence = await requestForm(`/api/v1/profile/credentials/${evidenceCredential.id}/evidence`, {
    cookie: owner.cookie,
    expected: 201,
    fields: { expectedVersion: evidenceCredential.version },
    file: { name: "evidence.pdf", type: "application/pdf", buffer: Buffer.from("%PDF-1.4\nRIVT smoke\n%%EOF\n") },
  });
  evidenceCredential = evidence.payload.data.credential;

  await requestJson("/api/v1/profile/availability-windows", {
    method: "POST",
    cookie: owner.cookie,
    expected: 201,
    idempotencyKey: randomUUID(),
    body: {
      availability: "limited",
      startsOn: "2026-07-27",
      endsOn: "2026-08-27",
      notes: "Temporary smoke window",
      visibility: "network",
    },
  });

  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nWQAAAAASUVORK5CYII=",
    "base64",
  );
  await requestForm("/api/v1/profile/avatar", {
    cookie: owner.cookie,
    expected: 201,
    fields: {},
    file: { name: "avatar.png", type: "image/png", buffer: png },
  });
  avatarCreated = true;

  const portfolio = await requestForm("/api/v1/profile/portfolio", {
    cookie: owner.cookie,
    expected: 201,
    fields: {
      title: "Professional profile smoke proof",
      description: "Temporary managed-media proof.",
      tradeCode: "electrical",
      projectLabel: "Temporary QA",
      serviceAreaCity: "Jacksonville",
      serviceAreaRegion: "FL",
      completedOn: "2026-07-27",
      visibility: "private",
      sortOrder: 0,
    },
    file: { name: "work-proof.png", type: "image/png", buffer: png },
  });
  const portfolioItem = portfolio.payload.data.portfolioItem;
  await requestJson(`/api/v1/profile/portfolio/${portfolioItem.id}`, {
    method: "PATCH",
    cookie: owner.cookie,
    expected: 200,
    body: {
      expectedVersion: portfolioItem.version,
      title: portfolioItem.title,
      description: portfolioItem.description,
      tradeCode: portfolioItem.tradeCode,
      projectLabel: portfolioItem.projectLabel,
      serviceAreaCity: portfolioItem.serviceAreaCity,
      serviceAreaRegion: portfolioItem.serviceAreaRegion,
      completedOn: portfolioItem.completedOn,
      visibility: "network",
      sortOrder: 0,
    },
  });

  const gpsRejected = await requestForm("/api/v1/profile/avatar", {
    cookie: owner.cookie,
    expected: 422,
    fields: {},
    file: { name: "gps.jpg", type: "image/jpeg", buffer: gpsJpeg() },
  });
  assert.equal(gpsRejected.payload.error.code, "PROFILE_IMAGE_LOCATION_METADATA");

  const viewerProfile = await requestJson(`/api/v1/profiles/${owner.accountId}`, {
    cookie: viewer.cookie,
    expected: 200,
  });
  const profile = viewerProfile.payload.data.profile;
  assert.equal(profile.credentials.length, 1);
  assert.equal(profile.credentials[0].name, "Professional profile smoke credential");
  assert.equal(profile.credentials[0].evidenceState, "evidence_on_file");
  assert.equal(profile.credentials[0].evidenceUploadId, null);
  assert.equal(profile.credentials[0].evidenceUrl, null);
  assert.equal(profile.availabilityWindows.length, 1);
  assert.equal(profile.portfolioItems.length, 1);
  assert.ok(profile.avatarUrl);
  assert.equal(JSON.stringify(profile).includes("Private profile smoke record"), false);

  await requestJson(`/api/v1/accounts/${owner.accountId}/block`, {
    method: "POST",
    cookie: viewer.cookie,
    expected: 200,
  });
  await requestJson(`/api/v1/profiles/${owner.accountId}`, {
    cookie: viewer.cookie,
    expected: 404,
  });

  console.log(JSON.stringify({
    ok: true,
    sourceCommit: health.payload.build.commit,
    migration: health.payload.migrations.latest.name,
    ownerCrud: true,
    managedAvatar: true,
    managedEvidence: true,
    managedPortfolio: true,
    embeddedGpsRejected: true,
    privateRecordsExcluded: true,
    evidenceFileExcluded: true,
    blockDeniedViewer: true,
  }, null, 2));
} finally {
  const owner = accounts[0];
  if (owner?.cookie && evidenceCredential) {
    await requestJson(`/api/v1/profile/credentials/${evidenceCredential.id}/evidence`, {
      method: "DELETE",
      cookie: owner.cookie,
      body: { expectedVersion: evidenceCredential.version },
    }).catch(() => undefined);
  }
  if (owner?.cookie && avatarCreated) {
    await requestJson("/api/v1/profile/avatar", {
      method: "DELETE",
      cookie: owner.cookie,
    }).catch(() => undefined);
  }
  await closeArtifacts(accounts).catch(() => undefined);
  await pool.end();
}
