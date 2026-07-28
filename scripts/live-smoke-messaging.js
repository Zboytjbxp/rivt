import "dotenv/config";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import pg from "pg";

const baseUrl = process.env.RIVT_SMOKE_BASE_URL ?? "https://rivt.pro";
const databaseUrl = process.env.DATABASE_URL?.trim();
const sourceCommit = process.env.SOURCE_COMMIT?.trim();
const smokeRun = `packet82-${new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14)}-${randomBytes(3).toString("hex")}`;

if (!databaseUrl) throw new Error("DATABASE_URL is required.");

const pool = new pg.Pool({
  connectionString: databaseUrl,
  ssl: process.env.PGSSL === "disable" || databaseUrl.includes("localhost") ? false : { rejectUnauthorized: false },
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

async function requestMultipart(path, { cookie, expected, fields = {}, file } = {}) {
  const body = new FormData();
  for (const [name, value] of Object.entries(fields)) body.append(name, String(value));
  if (file) body.append("file", new Blob([file.contents], { type: file.mimeType }), file.name);
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { Origin: baseUrl, Cookie: cookie },
    body,
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  assert.equal(response.status, expected, `POST ${path} returned ${response.status}: ${text}`);
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
  const password = `Smoke!${randomBytes(10).toString("base64url")}1a`;
  const invite = await createInvite(pool, { email, role });
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
  await verifyEmailDirectly(pool, email);
  await requestJson("/api/v1/onboarding/complete", {
    method: "POST",
    cookie,
    expected: 200,
    body: {
      role,
      displayName: `${label} ${smokeRun}`,
      headline: role === "contractor" ? "RIVT smoke contractor" : "RIVT smoke electrician",
      bio: "Temporary Packet 82 production smoke account.",
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
    email,
    password,
    cookie,
    inviteId: invite.id,
    accountId: me.payload.data.id,
    organizationId: me.payload.data.organizations[0]?.id,
  };
}

async function login(account) {
  const response = await requestJson("/api/v1/auth/login", {
    method: "POST",
    expected: 200,
    body: { email: account.email, password: account.password },
  });
  return sessionCookie(response.response);
}

async function closeSmokeArtifacts(accounts) {
  const accountIds = accounts.map((account) => account.accountId).filter(Boolean);
  if (accountIds.length > 0) {
    await pool.query("UPDATE profiles SET visibility = 'private', updated_at = now() WHERE account_id = ANY($1::uuid[])", [accountIds]);
    await pool.query("UPDATE auth_sessions SET revoked_at = now() WHERE user_id = ANY($1::uuid[]) AND revoked_at IS NULL", [accountIds]);
    await pool.query("UPDATE accounts SET status = 'closed', updated_at = now() WHERE id = ANY($1::uuid[])", [accountIds]);
    await pool.query(
      "UPDATE organizations SET status = 'closed', updated_at = now() WHERE created_by_account_id = ANY($1::uuid[]) AND status <> 'closed'",
      [accountIds],
    );
  }
  await pool.query(
    `UPDATE active_work
     SET status = 'cancelled', updated_at = now()
     WHERE id IN (
       SELECT aw.id
       FROM active_work aw
       INNER JOIN jobs j ON j.id = aw.job_id
       WHERE j.title LIKE $1
     )
     AND status <> 'cancelled'`,
    [`%${smokeRun}%`],
  );
  await pool.query(
    "UPDATE jobs SET status = 'closed', closed_at = COALESCE(closed_at, now()), updated_at = now() WHERE title LIKE $1 AND status <> 'closed'",
    [`%${smokeRun}%`],
  );
}

async function createPublishedJob(contractor) {
  const created = await requestJson("/api/v1/jobs", {
    method: "POST",
    cookie: contractor.cookie,
    idempotencyKey: `msg-create-${smokeRun}`,
    expected: 201,
    body: {
      organizationId: contractor.organizationId,
      title: `Packet 82 messaging ${smokeRun}`,
      tradeCode: "electrical",
      summary: "Temporary production smoke test job for Packet 82.",
      scopeDescription: "Verify conversations, notification state, mute, report, block, and private-address safety.",
      difficulty: "advanced",
      workType: "side_work",
      budgetCents: 95000,
      budgetUnit: "fixed",
      durationHours: 8,
      insuranceRequired: true,
      tools: ["Multimeter", "Conduit bender"],
      deliverables: ["Conversation", "Unread state", "Notification record"],
      publicLocation: { city: "Jacksonville", region: "FL", countryCode: "US", postalPrefix: "322" },
      privateLocation: {
        addressLine1: "404 Messaging Way",
        addressLine2: "Unit 5",
        city: "Jacksonville",
        region: "FL",
        postalCode: "32202",
        countryCode: "US",
        accessNotes: "Meet at the loading dock.",
      },
    },
  });
  const published = await requestJson(`/api/v1/jobs/${created.payload.data.job.id}/publish`, {
    method: "POST",
    cookie: contractor.cookie,
    idempotencyKey: `msg-publish-${smokeRun}`,
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
    idempotencyKey: `msg-apply-${smokeRun}`,
    expected: 201,
    body: {
      message: "I can handle this Packet 82 smoke scope.",
      proposedStartDate: "2026-07-01",
      consentAccepted: true,
      consentVersion: "2026-06-19",
    },
  });
  const offer = await requestJson(`/api/v1/applications/${submitted.payload.data.application.id}/offer`, {
    method: "POST",
    cookie: contractor.cookie,
    idempotencyKey: `msg-offer-${smokeRun}`,
    expected: 201,
    body: {
      startDate: "2026-07-02",
      agreedAmountCents: 95000,
      agreedUnit: "fixed",
      scopeSummary: "Panel scope accepted through Packet 82 smoke.",
      message: "Confirm and the address unlocks.",
    },
  });
  const accepted = await requestJson(`/api/v1/offers/${offer.payload.data.offer.id}/accept`, {
    method: "POST",
    cookie: tradesperson.cookie,
    idempotencyKey: `msg-accept-${smokeRun}`,
    expected: 200,
    body: {
      reason: "Confirmed.",
      consentAccepted: true,
      consentVersion: "2026-06-19",
    },
  });
  return accepted.payload.data.activeWork;
}

const accounts = [];

try {
  const contractor = await signupAndOnboard("contractor", "Packet05 Owner");
  accounts.push(contractor);
  const tradesperson = await signupAndOnboard("tradesperson", "Packet05 Trade");
  accounts.push(tradesperson);
  const outsider = await signupAndOnboard("tradesperson", "Packet05 Outsider");
  accounts.push(outsider);

  const readiness = await requestJson("/api/readiness", { cookie: contractor.cookie, expected: 200 });
  assert.equal(readiness.payload.migrations.pending.length, 0);
  assert.ok(readiness.payload.migrations.applied.some((migration) => migration.version === 6));
  if (sourceCommit) assert.equal(readiness.payload.build.commit, sourceCommit);

  const job = await createPublishedJob(contractor);
  const activeWork = await createActiveWork(contractor, tradesperson, job);
  const opened = await requestJson(`/api/v1/active-work/${activeWork.id}/conversation`, {
    method: "POST",
    cookie: contractor.cookie,
    idempotencyKey: `msg-open-${smokeRun}`,
    expected: 200,
    body: {},
  });
  const conversationId = opened.payload.data.conversation.id;

  const outsiderConversations = await requestJson("/api/v1/conversations", { cookie: outsider.cookie, expected: 200 });
  assert.equal(outsiderConversations.payload.data.conversations.length, 0);
  await requestJson(`/api/v1/conversations/${conversationId}/messages`, { cookie: outsider.cookie, expected: 404 });

  const firstBody = `Packet 05 smoke update ${smokeRun}`;
  const firstMessage = await requestJson(`/api/v1/conversations/${conversationId}/messages`, {
    method: "POST",
    cookie: tradesperson.cookie,
    idempotencyKey: `msg-send-${smokeRun}`,
    expected: 201,
    body: { body: firstBody },
  });
  const replay = await requestJson(`/api/v1/conversations/${conversationId}/messages`, {
    method: "POST",
    cookie: tradesperson.cookie,
    idempotencyKey: `msg-send-${smokeRun}`,
    expected: 201,
    body: { body: firstBody },
  });
  assert.equal(replay.response.headers.get("idempotent-replayed"), "true");
  assert.equal(replay.payload.data.message.id, firstMessage.payload.data.message.id);

  const preference = await requestJson(`/api/v1/conversations/${conversationId}/preference`, {
    method: "PUT",
    cookie: contractor.cookie,
    expected: 200,
    body: { pinned: true, archived: false, expectedVersion: 0 },
  });
  assert.equal(preference.payload.data.preference.pinned, true);

  const template = await requestJson("/api/v1/message-templates", {
    method: "POST",
    cookie: contractor.cookie,
    idempotencyKey: `msg-template-${smokeRun}`,
    expected: 201,
    body: { body: "Gate is open. Meet at the south entrance.", sortOrder: 0 },
  });
  assert.equal(template.payload.data.template.version, 1);

  const reacted = await requestJson(
    `/api/v1/conversations/${conversationId}/messages/${firstMessage.payload.data.message.id}/reaction`,
    {
      method: "PUT",
      cookie: contractor.cookie,
      expected: 200,
      body: { emoji: "✅" },
    },
  );
  assert.deepEqual(reacted.payload.data.reactions, [{ emoji: "✅", count: 1, reactedByMe: true }]);
  const sharedReaction = await requestJson(`/api/v1/conversations/${conversationId}/messages`, {
    cookie: tradesperson.cookie,
    expected: 200,
  });
  assert.deepEqual(
    sharedReaction.payload.data.messages.find((message) => message.id === firstMessage.payload.data.message.id).reactions,
    [{ emoji: "✅", count: 1, reactedByMe: false }],
  );

  const messageDraft = await requestMultipart(`/api/v1/conversations/${conversationId}/attachments`, {
    cookie: tradesperson.cookie,
    expected: 201,
    file: {
      name: `field-note-${smokeRun}.txt`,
      mimeType: "text/plain",
      contents: `Managed message attachment ${smokeRun}`,
    },
  });
  const attachmentMessage = await requestJson(`/api/v1/conversations/${conversationId}/messages`, {
    method: "POST",
    cookie: tradesperson.cookie,
    idempotencyKey: `msg-attachment-send-${smokeRun}`,
    expected: 201,
    body: { body: "", attachments: [{ uploadId: messageDraft.payload.data.attachment.uploadId }] },
  });
  assert.equal(attachmentMessage.payload.data.message.attachments.length, 1);
  const attachedMessageId = attachmentMessage.payload.data.message.id;
  const messageAttachment = attachmentMessage.payload.data.message.attachments[0];
  const attachmentRead = await requestJson(`/api/v1/conversations/${conversationId}/messages`, {
    cookie: contractor.cookie,
    expected: 200,
  });
  const signedMessageUrl = attachmentRead.payload.data.messages
    .find((message) => message.id === attachedMessageId).attachments[0].url;
  assert.ok(signedMessageUrl);
  assert.equal((await fetch(signedMessageUrl)).status, 200);
  await requestJson(`/api/v1/conversations/${conversationId}/attachments/${messageAttachment.id}`, {
    method: "DELETE",
    cookie: tradesperson.cookie,
    expected: 200,
  });

  const createdContact = await requestJson("/api/v1/contacts", {
    method: "POST",
    cookie: contractor.cookie,
    idempotencyKey: `msg-contact-${smokeRun}`,
    expected: 201,
    body: {
      entityType: "person",
      name: `Private Notes Customer ${smokeRun}`,
      company: "",
      notes: "",
      favorite: false,
      status: "active",
      roles: [{ role: "customer", status: "active", details: {} }],
      methods: [],
      addresses: [],
      tags: [],
    },
  });
  const contactId = createdContact.payload.data.contact.id;
  const contactNote = await requestJson(`/api/v1/contacts/${contactId}/notes`, {
    method: "POST",
    cookie: contractor.cookie,
    idempotencyKey: `msg-contact-note-${smokeRun}`,
    expected: 201,
    body: {
      body: "Gate code is recorded in the signed work order.",
      occurredAt: "2026-07-01T14:30:00.000Z",
    },
  });
  const noteId = contactNote.payload.data.note.id;
  assert.equal(contactNote.payload.data.note.occurredAt, "2026-07-01T14:30:00.000Z");
  await requestJson(`/api/v1/contacts/${contactId}/notes`, { cookie: outsider.cookie, expected: 404 });
  const updatedNote = await requestJson(`/api/v1/contacts/${contactId}/notes/${noteId}`, {
    method: "PATCH",
    cookie: contractor.cookie,
    expected: 200,
    body: {
      body: "Gate code and lockbox details are recorded in the signed work order.",
      expectedVersion: 1,
    },
  });
  const noteUpload = await requestMultipart(`/api/v1/contacts/${contactId}/notes/${noteId}/attachments`, {
    cookie: contractor.cookie,
    expected: 201,
    fields: { expectedVersion: updatedNote.payload.data.note.version },
    file: {
      name: `customer-note-${smokeRun}.txt`,
      mimeType: "text/plain",
      contents: `Private customer note attachment ${smokeRun}`,
    },
  });
  assert.equal(noteUpload.payload.data.note.attachments.length, 1);
  const noteAttachment = noteUpload.payload.data.note.attachments[0];
  assert.equal((await fetch(noteAttachment.url)).status, 200);
  const archivedNote = await requestJson(`/api/v1/contacts/${contactId}/notes/${noteId}/archive`, {
    method: "POST",
    cookie: contractor.cookie,
    expected: 200,
    body: { expectedVersion: noteUpload.payload.data.note.version },
  });
  const restoredNote = await requestJson(`/api/v1/contacts/${contactId}/notes/${noteId}/restore`, {
    method: "POST",
    cookie: contractor.cookie,
    expected: 200,
    body: { expectedVersion: archivedNote.payload.data.note.version },
  });
  await requestJson(`/api/v1/contacts/${contactId}/notes/${noteId}/attachments/${noteAttachment.id}`, {
    method: "DELETE",
    cookie: contractor.cookie,
    expected: 200,
    body: { expectedVersion: restoredNote.payload.data.note.version },
  });
  const noteHistory = await requestJson(`/api/v1/contacts/${contactId}/notes/${noteId}/history`, {
    cookie: contractor.cookie,
    expected: 200,
  });
  assert.deepEqual(
    new Set(noteHistory.payload.data.history.map((entry) => entry.action)),
    new Set(["created", "updated", "uploaded", "archived", "restored", "removed"]),
  );
  await requestJson(`/api/v1/contacts/${contactId}/notes/${noteId}/history`, {
    cookie: outsider.cookie,
    expected: 404,
  });

  const contractorConversations = await requestJson("/api/v1/conversations", { cookie: contractor.cookie, expected: 200 });
  assert.equal(contractorConversations.payload.data.conversations.find((conversation) => conversation.id === conversationId).unreadCount, 2);

  const reloginCookie = await login(contractor);
  const reloginConversations = await requestJson("/api/v1/conversations", { cookie: reloginCookie, expected: 200 });
  assert.equal(reloginConversations.payload.data.conversations.find((conversation) => conversation.id === conversationId).unreadCount, 2);
  const reloginSettings = await requestJson("/api/v1/messaging/settings", { cookie: reloginCookie, expected: 200 });
  assert.equal(
    reloginSettings.payload.data.conversationPreferences.find((item) => item.conversationId === conversationId).pinned,
    true,
  );
  assert.equal(reloginSettings.payload.data.templates.some((item) => item.id === template.payload.data.template.id), true);

  const notifications = await requestJson("/api/v1/notifications", { cookie: reloginCookie, expected: 200 });
  const notificationText = JSON.stringify(notifications.payload.data.notifications);
  assert.match(notificationText, /sent a message|Offer accepted/);
  assert.equal(notificationText.includes("404 Messaging Way"), false);
  assert.equal(notificationText.includes("Unit 5"), false);

  const read = await requestJson(`/api/v1/conversations/${conversationId}/read`, {
    method: "POST",
    cookie: reloginCookie,
    expected: 200,
    body: {},
  });
  assert.equal(read.payload.data.conversation.unreadCount, 0);
  await requestJson("/api/v1/notifications/read", {
    method: "POST",
    cookie: reloginCookie,
    expected: 200,
    body: { all: true },
  });

  await requestJson(`/api/v1/conversations/${conversationId}/mute`, {
    method: "POST",
    cookie: reloginCookie,
    expected: 200,
    body: { mutedUntil: new Date(Date.now() + 60 * 60 * 1000).toISOString() },
  });
  await requestJson(`/api/v1/conversations/${conversationId}/messages`, {
    method: "POST",
    cookie: tradesperson.cookie,
    idempotencyKey: `msg-muted-send-${smokeRun}`,
    expected: 201,
    body: { body: "Muted recipient should not get a second message notification." },
  });
  const messageNotifications = await pool.query(
    "SELECT count(*)::int AS count FROM in_app_notifications WHERE account_id = $1 AND source_type = 'message'",
    [contractor.accountId],
  );
  assert.equal(messageNotifications.rows[0].count, 2);

  await requestJson(`/api/v1/conversations/${conversationId}/report`, {
    method: "POST",
    cookie: reloginCookie,
    idempotencyKey: `msg-report-${smokeRun}`,
    expected: 201,
    body: {
      reason: "safety",
      note: "Packet 05 smoke report.",
      reportedAccountId: tradesperson.accountId,
    },
  });
  await requestJson(`/api/v1/accounts/${tradesperson.accountId}/block`, {
    method: "POST",
    cookie: reloginCookie,
    expected: 200,
    body: { reason: "Packet 05 smoke block." },
  });
  const blocked = await requestJson(`/api/v1/conversations/${conversationId}/messages`, {
    method: "POST",
    cookie: tradesperson.cookie,
    idempotencyKey: `msg-blocked-send-${smokeRun}`,
    expected: 403,
    body: { body: "Blocked accounts should fail." },
  });
  assert.equal(blocked.payload.error.code, "ACCOUNT_BLOCKED");

  const counts = await pool.query(
    `SELECT
       (SELECT count(*)::int FROM conversations WHERE id = $1) AS conversations,
       (SELECT count(*)::int FROM conversation_messages WHERE conversation_id = $1) AS messages,
       (SELECT count(*)::int FROM conversation_reports WHERE conversation_id = $1) AS reports`,
    [conversationId],
  );
  assert.equal(counts.rows[0].conversations, 1);
  assert.equal(counts.rows[0].messages, 3);
  assert.equal(counts.rows[0].reports, 1);

  console.log(JSON.stringify({
    ok: true,
    run: smokeRun,
    buildCommit: readiness.payload.build.commit,
    latestMigration: readiness.payload.migrationVersion,
    jobId: job.id,
    activeWorkId: activeWork.id,
    conversationId,
    messagesPersisted: counts.rows[0].messages,
    unreadSurvivedRelogin: true,
    accountPreferencesSurvivedRelogin: true,
    realReactionVisibleToBothParticipants: true,
    managedMessageAttachmentReadAndRemoved: true,
    privateContactNoteCrudHistoryMediaAndIsolation: true,
    privateAddressExcludedFromNotifications: true,
    muteSuppressedSecondMessageNotification: true,
    reportCreated: true,
    blockEnforced: true,
    smokeAccountsClosed: accounts.length,
  }, null, 2));
} finally {
  await closeSmokeArtifacts(accounts);
  await pool.end();
}
