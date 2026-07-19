import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import pg from "pg";

const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();

if (!testDatabaseUrl) {
  test("tool records are server-owned", { skip: "TEST_DATABASE_URL is not configured" }, () => {});
} else {
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = testDatabaseUrl;
  process.env.PGSSL = "disable";
  process.env.APP_ORIGIN = "https://rivt.pro";
  process.env.EMAIL_FROM = "RIVT Test <noreply@example.test>";
  process.env.EMAIL_DELIVERY_MODE = "capture";
  process.env.AUTH_METADATA_PEPPER = "tool-records-test-pepper";
  process.env.REQUIRE_PILOT_INVITE = "false";
  process.env.AUTH_RATE_LIMIT = "10000";
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

  async function requestJson(baseUrl, path, { body, cookie, idempotencyKey, method = "GET" } = {}) {
    const headers = { Origin: "https://rivt.pro" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (cookie) headers.Cookie = cookie;
    if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const payload = await response.json();
    return { response, payload };
  }

  function tokenFor(email) {
    const message = [...capturedEmailMessages()].reverse().find((candidate) => candidate.to === email);
    const match = message?.text.match(/verify-email\?token=([^\s]+)/);
    assert.ok(match);
    return decodeURIComponent(match[1]);
  }

  async function createAccount(baseUrl, role, label) {
    const email = `${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${randomUUID()}@example.test`;
    const signup = await requestJson(baseUrl, "/api/v1/auth/signup", {
      method: "POST",
      body: { email, password: "SafePassword!1234", displayName: label, role },
    });
    assert.equal(signup.response.status, 201);
    const account = { email, cookie: sessionCookie(signup.response) };
    const verified = await requestJson(baseUrl, "/api/v1/auth/email/verify", {
      method: "POST",
      body: { token: tokenFor(email) },
    });
    assert.equal(verified.response.status, 200);
    const onboarded = await requestJson(baseUrl, "/api/v1/onboarding/complete", {
      method: "POST",
      cookie: account.cookie,
      body: {
        role,
        displayName: label,
        serviceAreaCity: "Jacksonville",
        serviceAreaRegion: "FL",
        serviceRadiusMiles: 35,
        tradeCodes: ["electrical"],
        organizationName: role === "contractor" ? `${label} LLC` : undefined,
        consentAccepted: true,
        consentVersion: "2026-06-19",
      },
    });
    assert.equal(onboarded.response.status, 200);
    return account;
  }

  test("tool records are server-owned", async (context) => {
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

    const owner = await createAccount(baseUrl, "contractor", "Tool Records Owner");
    const other = await createAccount(baseUrl, "contractor", "Tool Records Other");

    const anonList = await requestJson(baseUrl, "/api/v1/tool-records?type=payment_record");
    assert.equal(anonList.response.status, 401);

    const missingKey = await requestJson(baseUrl, "/api/v1/tool-records", {
      method: "POST",
      cookie: owner.cookie,
      body: {
        recordType: "payment_record",
        localId: "invoice-one",
        title: "Panel trim invoice",
        status: "invoiced",
        recordDate: "2026-07-03",
        amountCents: 125000,
        payload: { id: "invoice-one", jobId: "", jobTitle: "Panel trim invoice", invoiceDate: "2026-07-03", invoiceAmount: 1250, status: "invoiced" },
      },
    });
    assert.equal(missingKey.response.status, 400);
    assert.equal(missingKey.payload.error.code, "IDEMPOTENCY_KEY_REQUIRED");

    const idempotencyKey = randomUUID();
    const created = await requestJson(baseUrl, "/api/v1/tool-records", {
      method: "POST",
      cookie: owner.cookie,
      idempotencyKey,
      body: {
        recordType: "payment_record",
        localId: "invoice-one",
        title: "Panel trim invoice",
        status: "invoiced",
        recordDate: "2026-07-03",
        amountCents: 125000,
        payload: { id: "invoice-one", jobId: "", jobTitle: "Panel trim invoice", invoiceDate: "2026-07-03", invoiceAmount: 1250, status: "invoiced" },
      },
    });
    assert.equal(created.response.status, 200);
    assert.equal(created.payload.data.record.recordType, "payment_record");
    assert.equal(created.payload.data.record.localId, "invoice-one");
    assert.equal(created.payload.data.record.amountCents, 125000);
    assert.equal(created.payload.data.record.payload.jobTitle, "Panel trim invoice");

    const replay = await requestJson(baseUrl, "/api/v1/tool-records", {
      method: "POST",
      cookie: owner.cookie,
      idempotencyKey,
      body: {
        recordType: "payment_record",
        localId: "invoice-one",
        title: "Panel trim invoice",
        status: "invoiced",
        recordDate: "2026-07-03",
        amountCents: 125000,
        payload: { id: "invoice-one", jobId: "", jobTitle: "Panel trim invoice", invoiceDate: "2026-07-03", invoiceAmount: 1250, status: "invoiced" },
      },
    });
    assert.equal(replay.response.status, 200);
    assert.equal(replay.response.headers.get("idempotent-replayed"), "true");
    assert.equal(replay.payload.data.record.id, created.payload.data.record.id);

    const updated = await requestJson(baseUrl, "/api/v1/tool-records", {
      method: "POST",
      cookie: owner.cookie,
      idempotencyKey: randomUUID(),
      body: {
        recordType: "payment_record",
        localId: "invoice-one",
        title: "Panel trim invoice",
        status: "paid",
        recordDate: "2026-07-03",
        amountCents: 125000,
        payload: {
          id: "invoice-one",
          jobId: "",
          jobTitle: "Panel trim invoice",
          invoiceDate: "2026-07-03",
          invoiceAmount: 1250,
          paidDate: "2026-07-03",
          paidAmount: 1250,
          status: "paid",
        },
      },
    });
    assert.equal(updated.response.status, 200);
    assert.equal(updated.payload.data.record.id, created.payload.data.record.id);
    assert.equal(updated.payload.data.record.status, "paid");

    const list = await requestJson(baseUrl, "/api/v1/tool-records?type=payment_record", { cookie: owner.cookie });
    assert.equal(list.response.status, 200);
    assert.equal(list.payload.data.records.length, 1);
    assert.equal(list.payload.data.records[0].localId, "invoice-one");

    const isolated = await requestJson(baseUrl, "/api/v1/tool-records?type=payment_record", { cookie: other.cookie });
    assert.equal(isolated.response.status, 200);
    assert.equal(isolated.payload.data.records.length, 0);

    const projectCreated = await requestJson(baseUrl, "/api/v1/standalone-projects", {
      method: "POST",
      cookie: owner.cookie,
      idempotencyKey: randomUUID(),
      body: {
        title: "Kitchen refresh",
        clientName: "Jordan Client",
        locationText: "Jacksonville, FL",
        tradeCode: "carpentry",
      },
    });
    assert.equal(projectCreated.response.status, 201);
    const standaloneProjectId = projectCreated.payload.data.project.id;
    assert.equal(projectCreated.payload.data.project.title, "Kitchen refresh");

    const ownerProjects = await requestJson(baseUrl, "/api/v1/standalone-projects", { cookie: owner.cookie });
    assert.equal(ownerProjects.response.status, 200);
    assert.equal(ownerProjects.payload.data.projects.some((project) => project.id === standaloneProjectId), true);

    const otherProjects = await requestJson(baseUrl, "/api/v1/standalone-projects", { cookie: other.cookie });
    assert.equal(otherProjects.response.status, 200);
    assert.equal(otherProjects.payload.data.projects.some((project) => project.id === standaloneProjectId), false);

    const otherCannotEdit = await requestJson(baseUrl, `/api/v1/standalone-projects/${standaloneProjectId}`, {
      method: "PATCH",
      cookie: other.cookie,
      idempotencyKey: randomUUID(),
      body: { title: "Taken over" },
    });
    assert.equal(otherCannotEdit.response.status, 404);

    const estimateCreated = await requestJson(baseUrl, "/api/v1/tool-records", {
      method: "POST",
      cookie: owner.cookie,
      idempotencyKey: randomUUID(),
      body: {
        recordType: "estimate",
        localId: `estimate:standalone:${standaloneProjectId}`,
        title: "Kitchen refresh estimate",
        status: "draft",
        amountCents: 248500,
        payload: { laborHours: 24, materialCost: 900 },
        standaloneProjectId,
      },
    });
    assert.equal(estimateCreated.response.status, 200);
    assert.equal(estimateCreated.payload.data.record.standaloneProjectId, standaloneProjectId);

    const otherCannotAttach = await requestJson(baseUrl, "/api/v1/tool-records", {
      method: "POST",
      cookie: other.cookie,
      idempotencyKey: randomUUID(),
      body: {
        recordType: "estimate",
        localId: `estimate:standalone:${standaloneProjectId}`,
        title: "Unauthorized estimate",
        status: "draft",
        amountCents: 100,
        payload: {},
        standaloneProjectId,
      },
    });
    assert.equal(otherCannotAttach.response.status, 403);
    assert.equal(otherCannotAttach.payload.error.code, "STANDALONE_PROJECT_ACCESS_DENIED");

    const ambiguousContext = await requestJson(baseUrl, "/api/v1/tool-records", {
      method: "POST",
      cookie: owner.cookie,
      idempotencyKey: randomUUID(),
      body: {
        recordType: "estimate",
        localId: "estimate:ambiguous",
        title: "Ambiguous estimate",
        status: "draft",
        payload: {},
        standaloneProjectId,
        activeWorkId: randomUUID(),
      },
    });
    assert.equal(ambiguousContext.response.status, 422);

    const deliveryEstimate = await requestJson(baseUrl, "/api/v1/tool-records", {
      method: "POST",
      cookie: owner.cookie,
      idempotencyKey: randomUUID(),
      body: {
        recordType: "estimate",
        localId: "estimate:email-one",
        title: "Kitchen cabinet installation",
        status: "draft",
        recordDate: "2026-07-14",
        amountCents: 248500,
        payload: {
          estimateNumber: "EST-KITCHEN-01",
          recipientName: "Jordan Client",
          recipientEmail: "jordan.client@example.test",
          scope: "Kitchen cabinet installation",
          validThrough: "2026-08-13",
          customerNote: "Materials are included.",
          customerLines: [
            { description: "Cabinet installation", quantity: 24, totalCents: 158500 },
            { description: "Materials and handling", quantity: 1, totalCents: 90000 },
          ],
        },
      },
    });
    assert.equal(deliveryEstimate.response.status, 200);

    const invalidDeliveryEstimate = await requestJson(baseUrl, "/api/v1/tool-records", {
      method: "POST",
      cookie: owner.cookie,
      idempotencyKey: randomUUID(),
      body: {
        recordType: "estimate",
        localId: "estimate:missing-recipient",
        title: "Missing recipient estimate",
        status: "draft",
        recordDate: "2026-07-14",
        amountCents: 10000,
        payload: { customerLines: [{ description: "Labor", quantity: 1, totalCents: 10000 }] },
      },
    });
    assert.equal(invalidDeliveryEstimate.response.status, 200);

    const missingRecipient = await requestJson(baseUrl, "/api/v1/estimates/estimate%3Amissing-recipient/send", {
      method: "POST",
      cookie: owner.cookie,
      idempotencyKey: randomUUID(),
    });
    assert.equal(missingRecipient.response.status, 422);
    assert.equal(missingRecipient.payload.error.code, "ESTIMATE_RECIPIENT_REQUIRED");

    clearCapturedEmailMessages();
    const estimateSendKey = randomUUID();
    const sentEstimate = await requestJson(baseUrl, "/api/v1/estimates/estimate%3Aemail-one/send", {
      method: "POST",
      cookie: owner.cookie,
      idempotencyKey: estimateSendKey,
    });
    assert.equal(sentEstimate.response.status, 200);
    assert.equal(sentEstimate.payload.data.record.status, "sent");
    assert.equal(sentEstimate.payload.data.record.payload.delivery.status, "sent");
    assert.equal(sentEstimate.payload.data.record.payload.delivery.recipientEmail, "jordan.client@example.test");
    const deliveredEstimate = capturedEmailMessages().find((message) => message.to === "jordan.client@example.test");
    assert.ok(deliveredEstimate);
    assert.match(deliveredEstimate.text, /Kitchen cabinet installation/);
    assert.match(deliveredEstimate.text, /\$2,485\.00/);
    assert.doesNotMatch(deliveredEstimate.text, /margin|overhead|contingency/i);

    const sentReplay = await requestJson(baseUrl, "/api/v1/estimates/estimate%3Aemail-one/send", {
      method: "POST",
      cookie: owner.cookie,
      idempotencyKey: estimateSendKey,
    });
    assert.equal(sentReplay.response.status, 200);
    assert.equal(sentReplay.response.headers.get("idempotent-replayed"), "true");
    assert.equal(capturedEmailMessages().filter((message) => message.to === "jordan.client@example.test").length, 1);

    const otherCannotSendEstimate = await requestJson(baseUrl, "/api/v1/estimates/estimate%3Aemail-one/send", {
      method: "POST",
      cookie: other.cookie,
      idempotencyKey: randomUUID(),
    });
    assert.equal(otherCannotSendEstimate.response.status, 404);

    const deliveryInvoice = await requestJson(baseUrl, "/api/v1/tool-records", {
      method: "POST",
      cookie: owner.cookie,
      idempotencyKey: randomUUID(),
      body: {
        recordType: "invoice_draft",
        localId: "invoice:email-one",
        title: "Kitchen cabinet invoice",
        status: "draft",
        recordDate: "2026-07-14",
        amountCents: 248500,
        payload: {
          invoiceNumber: "INV-KITCHEN-01",
          recipientName: "Jordan Client",
          recipientEmail: "jordan.client@example.test",
          workLabel: "Kitchen cabinet installation",
          terms: "Due on completion",
          paymentMethod: "Direct payment",
          payTo: "RIVT Cabinet Co.",
          customerLines: [
            { description: "Cabinet installation", quantity: 24, totalCents: 158500 },
            { description: "Materials and handling", quantity: 1, totalCents: 90000 },
          ],
        },
      },
    });
    assert.equal(deliveryInvoice.response.status, 200);

    const invalidDeliveryInvoice = await requestJson(baseUrl, "/api/v1/tool-records", {
      method: "POST",
      cookie: owner.cookie,
      idempotencyKey: randomUUID(),
      body: {
        recordType: "invoice_draft",
        localId: "invoice:missing-recipient",
        title: "Missing recipient invoice",
        status: "draft",
        recordDate: "2026-07-14",
        amountCents: 10000,
        payload: { customerLines: [{ description: "Labor", quantity: 1, totalCents: 10000 }] },
      },
    });
    assert.equal(invalidDeliveryInvoice.response.status, 200);

    const missingInvoiceRecipient = await requestJson(baseUrl, "/api/v1/invoices/invoice%3Amissing-recipient/send", {
      method: "POST",
      cookie: owner.cookie,
      idempotencyKey: randomUUID(),
    });
    assert.equal(missingInvoiceRecipient.response.status, 422);
    assert.equal(missingInvoiceRecipient.payload.error.code, "INVOICE_RECIPIENT_REQUIRED");

    clearCapturedEmailMessages();
    const invoiceSendKey = randomUUID();
    const sentInvoice = await requestJson(baseUrl, "/api/v1/invoices/invoice%3Aemail-one/send", {
      method: "POST",
      cookie: owner.cookie,
      idempotencyKey: invoiceSendKey,
    });
    assert.equal(sentInvoice.response.status, 200);
    assert.equal(sentInvoice.payload.data.record.status, "sent");
    assert.equal(sentInvoice.payload.data.record.payload.delivery.status, "sent");
    assert.equal(sentInvoice.payload.data.record.payload.delivery.recipientEmail, "jordan.client@example.test");
    const deliveredInvoice = capturedEmailMessages().find((message) => message.to === "jordan.client@example.test");
    assert.ok(deliveredInvoice);
    assert.match(deliveredInvoice.text, /Kitchen cabinet installation/);
    assert.match(deliveredInvoice.text, /\$2,485\.00/);
    assert.doesNotMatch(deliveredInvoice.text, /margin|overhead|contingency/i);

    const invoiceReplay = await requestJson(baseUrl, "/api/v1/invoices/invoice%3Aemail-one/send", {
      method: "POST",
      cookie: owner.cookie,
      idempotencyKey: invoiceSendKey,
    });
    assert.equal(invoiceReplay.response.status, 200);
    assert.equal(invoiceReplay.response.headers.get("idempotent-replayed"), "true");
    assert.equal(capturedEmailMessages().filter((message) => message.to === "jordan.client@example.test").length, 1);

    const otherCannotSendInvoice = await requestJson(baseUrl, "/api/v1/invoices/invoice%3Aemail-one/send", {
      method: "POST",
      cookie: other.cookie,
      idempotencyKey: randomUUID(),
    });
    assert.equal(otherCannotSendInvoice.response.status, 404);

    const projectAlbum = await requestJson(baseUrl, "/api/v1/albums", {
      method: "POST",
      cookie: owner.cookie,
      body: { name: "Kitchen refresh", standaloneProjectId },
    });
    assert.equal(projectAlbum.response.status, 201);
    assert.equal(projectAlbum.payload.data.album.standaloneProjectId, standaloneProjectId);

    const otherCannotCreateAlbum = await requestJson(baseUrl, "/api/v1/albums", {
      method: "POST",
      cookie: other.cookie,
      body: { name: "Unauthorized album", standaloneProjectId },
    });
    assert.equal(otherCannotCreateAlbum.response.status, 403);
    assert.equal(otherCannotCreateAlbum.payload.error.code, "STANDALONE_PROJECT_ACCESS_DENIED");

    const defaultAlbum = await requestJson(baseUrl, "/api/v1/albums/default", {
      method: "POST",
      cookie: owner.cookie,
    });
    assert.equal(defaultAlbum.response.status, 200);
    assert.equal(defaultAlbum.payload.data.album.name, "Private photos");
    assert.equal(defaultAlbum.payload.data.album.isDefault, true);
    assert.equal(defaultAlbum.payload.data.album.standaloneProjectId, null);

    const defaultAlbumAgain = await requestJson(baseUrl, "/api/v1/albums/default", {
      method: "POST",
      cookie: owner.cookie,
    });
    assert.equal(defaultAlbumAgain.response.status, 200);
    assert.equal(defaultAlbumAgain.payload.data.album.id, defaultAlbum.payload.data.album.id);

    const otherDefaultAlbum = await requestJson(baseUrl, "/api/v1/albums/default", {
      method: "POST",
      cookie: other.cookie,
    });
    assert.equal(otherDefaultAlbum.response.status, 200);
    assert.notEqual(otherDefaultAlbum.payload.data.album.id, defaultAlbum.payload.data.album.id);

    const accountRows = await database.query(
      "SELECT id, email FROM accounts WHERE email = ANY($1::text[])",
      [[owner.email, other.email]],
    );
    const ownerAccountId = accountRows.rows.find((row) => row.email === owner.email)?.id;
    const otherAccountId = accountRows.rows.find((row) => row.email === other.email)?.id;
    assert.ok(ownerAccountId);
    assert.ok(otherAccountId);

    const ownerUploadId = randomUUID();
    const ownerPhotoId = randomUUID();
    const otherUploadId = randomUUID();
    const otherPhotoId = randomUUID();
    await database.query(
      `INSERT INTO uploads
         (id, account_id, kind, name, object_key, original_name, mime_type, size_bytes,
          upload_status, storage_scope, verified_at)
       VALUES
         ($1, $2, 'album_photo', 'featured-cabinet.jpg', $3, 'featured-cabinet.jpg', 'image/jpeg', 1024,
          'stored', 'album', now()),
         ($4, $5, 'album_photo', 'other-private.jpg', $6, 'other-private.jpg', 'image/jpeg', 2048,
          'stored', 'album', now())`,
      [
        ownerUploadId,
        ownerAccountId,
        `tests/${ownerUploadId}.jpg`,
        otherUploadId,
        otherAccountId,
        `tests/${otherUploadId}.jpg`,
      ],
    );
    await database.query(
      `INSERT INTO album_photos (id, album_id, upload_id, caption)
       VALUES ($1, $2, $3, 'Finished cabinet install'),
              ($4, $5, $6, 'Private competitor photo')`,
      [
        ownerPhotoId,
        defaultAlbum.payload.data.album.id,
        ownerUploadId,
        otherPhotoId,
        otherDefaultAlbum.payload.data.album.id,
        otherUploadId,
      ],
    );

    const cannotFeatureAnotherAccountPhoto = await requestJson(baseUrl, "/api/v1/profile/work-samples", {
      method: "POST",
      cookie: owner.cookie,
      body: { albumPhotoId: otherPhotoId, title: "Not mine" },
    });
    assert.equal(cannotFeatureAnotherAccountPhoto.response.status, 404);
    assert.equal(cannotFeatureAnotherAccountPhoto.payload.error.code, "PHOTO_NOT_FOUND");

    const featuredWork = await requestJson(baseUrl, "/api/v1/profile/work-samples", {
      method: "POST",
      cookie: owner.cookie,
      body: {
        albumPhotoId: ownerPhotoId,
        title: "Custom cabinet install",
        caption: "Inset cabinets fitted and finished in Jacksonville.",
      },
    });
    assert.equal(featuredWork.response.status, 201);
    assert.equal(featuredWork.payload.data.samples.length, 1);
    assert.equal(featuredWork.payload.data.samples[0].albumPhotoId, ownerPhotoId);

    const visibleToAnotherSignedInAccount = await requestJson(
      baseUrl,
      `/api/v1/profiles/${ownerAccountId}/work-samples`,
      { cookie: other.cookie },
    );
    assert.equal(visibleToAnotherSignedInAccount.response.status, 200);
    assert.equal(visibleToAnotherSignedInAccount.payload.data.samples.length, 1);
    assert.equal(visibleToAnotherSignedInAccount.payload.data.samples[0].title, "Custom cabinet install");
    assert.ok(!visibleToAnotherSignedInAccount.payload.data.samples.some((sample) => sample.albumPhotoId === otherPhotoId));

    const removedFeaturedWork = await requestJson(
      baseUrl,
      `/api/v1/profile/work-samples/${featuredWork.payload.data.samples[0].id}`,
      { method: "DELETE", cookie: owner.cookie },
    );
    assert.equal(removedFeaturedWork.response.status, 200);
    assert.deepEqual(removedFeaturedWork.payload.data.samples, []);

    const noLongerVisible = await requestJson(
      baseUrl,
      `/api/v1/profiles/${ownerAccountId}/work-samples`,
      { cookie: other.cookie },
    );
    assert.equal(noLongerVisible.response.status, 200);
    assert.deepEqual(noLongerVisible.payload.data.samples, []);

    const albumList = await requestJson(baseUrl, "/api/v1/albums", { cookie: owner.cookie });
    assert.equal(albumList.response.status, 200);
    const listedDefault = albumList.payload.data.albums.find((album) => album.id === defaultAlbum.payload.data.album.id);
    assert.ok(listedDefault);
    assert.equal(listedDefault.coverPhoto, null);

    const invalidType = await requestJson(baseUrl, "/api/v1/tool-records?type=not-real", { cookie: owner.cookie });
    assert.equal(invalidType.response.status, 422);

    const invalidLocalId = await requestJson(baseUrl, "/api/v1/tool-records", {
      method: "POST",
      cookie: owner.cookie,
      idempotencyKey: randomUUID(),
      body: {
        recordType: "payment_record",
        localId: "bad local id!",
        title: "Bad local id",
        status: "invoiced",
        payload: {},
      },
    });
    assert.equal(invalidLocalId.response.status, 422);

    const deleted = await requestJson(baseUrl, "/api/v1/tool-records/payment_record/invoice-one", {
      method: "DELETE",
      cookie: owner.cookie,
      idempotencyKey: randomUUID(),
    });
    assert.equal(deleted.response.status, 200);
    assert.equal(deleted.payload.data.deleted, true);

    const afterDelete = await requestJson(baseUrl, "/api/v1/tool-records?type=payment_record", { cookie: owner.cookie });
    assert.equal(afterDelete.response.status, 200);
    assert.equal(afterDelete.payload.data.records.length, 0);
  });
}
