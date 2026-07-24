import { PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";

function sendLegacyBridgeRetired(request, response, code, message) {
  response.status(410).json({
    ok: false,
    code,
    error: message,
    requestId: request.requestId ?? null,
  });
}

export function registerLegacyIntegrationRoutes({
  app,
  appSlug,
  database,
  requireAuthenticatedUser,
  requireV1Actor,
  writeRateLimit,
  uploadRateLimit,
  upload,
  runWithDatabase,
  mapUploadRow,
  signedObjectUrl,
  signedUrlSeconds,
  requireObjectStorage,
  safeObjectName,
  s3Client,
  s3Bucket,
  integrationStatus,
  buildTwilioSmsStatus,
}) {
  app.post("/api/auth/guest", (_request, response) => {
    response.status(404).json({ ok: false, error: "Guest authentication is not available." });
  });

  app.get("/api/app-state", requireAuthenticatedUser, (request, response) => {
    sendLegacyBridgeRetired(
      request,
      response,
      "LEGACY_APP_STATE_RETIRED",
      "Legacy app-state storage is retired. RIVT now uses server-owned domain records.",
    );
  });

  app.put("/api/app-state", requireAuthenticatedUser, (request, response) => {
    sendLegacyBridgeRetired(
      request,
      response,
      "LEGACY_APP_STATE_RETIRED",
      "Legacy app-state writes are retired. Use canonical RIVT workflows instead.",
    );
  });

  app.post("/api/events", requireAuthenticatedUser, (request, response) => {
    sendLegacyBridgeRetired(
      request,
      response,
      "LEGACY_EVENTS_RETIRED",
      "Legacy generic event logging is retired. Canonical workflows now write auditable server events.",
    );
  });

  app.get("/api/payments/export.csv", requireAuthenticatedUser, (request, response) => {
    sendLegacyBridgeRetired(
      request,
      response,
      "LEGACY_PAYMENT_EXPORT_RETIRED",
      "Legacy payment export is retired until canonical payment records are available.",
    );
  });

  app.get("/api/uploads", requireAuthenticatedUser, async (request, response, next) => {
    await runWithDatabase(response, next, async () => {
      const scopeId = request.authUser.id;
      const result = await database.query(
        `
          SELECT *
          FROM uploads
          WHERE session_id = $1
          ORDER BY created_at DESC
          LIMIT 200
        `,
        [scopeId],
      );
      const uploads = await Promise.all(
        result.rows.map(async (row) => mapUploadRow(row, await signedObjectUrl(row.object_key))),
      );

      response.json({ uploads });
    });
  });

  app.get("/api/uploads/:id/url", requireAuthenticatedUser, async (request, response, next) => {
    await runWithDatabase(response, next, async () => {
      const scopeId = request.authUser.id;
      const result = await database.query(
        "SELECT object_key FROM uploads WHERE id = $1 AND session_id = $2",
        [request.params.id, scopeId],
      );

      if (!result.rowCount || !result.rows[0].object_key) {
        response.status(404).json({ ok: false, error: "Upload not found." });
        return;
      }

      response.json({
        ok: true,
        signedUrl: await signedObjectUrl(result.rows[0].object_key),
        expiresIn: signedUrlSeconds,
      });
    });
  });

  app.post("/api/uploads", requireAuthenticatedUser, requireV1Actor, uploadRateLimit, upload.single("file"), async (request, response, next) => {
    if (!requireObjectStorage(response)) {
      return;
    }

    if (!request.file) {
      response.status(400).json({ ok: false, error: "A file field named `file` is required." });
      return;
    }

    await runWithDatabase(response, next, async () => {
      const scopeId = request.authUser.id;
      const id = randomUUID();
      const kind = request.body?.kind ?? "record";
      const jobId = Number(request.body?.jobId);
      const objectKey = `${safeObjectName(scopeId)}/${safeObjectName(kind)}/${new Date().toISOString().slice(0, 10)}/${id}-${safeObjectName(
        request.file.originalname,
      )}`;

      await s3Client.send(
        new PutObjectCommand({
          Bucket: s3Bucket,
          Key: objectKey,
          Body: request.file.buffer,
          ContentType: request.file.mimetype,
          Metadata: {
            originalName: request.file.originalname.slice(0, 256),
            source: appSlug,
          },
        }),
      );

      const result = await database.query(
        `
          INSERT INTO uploads (
            id, session_id, kind, name, job_id, notes, object_key, original_name, mime_type, size_bytes
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING *
        `,
        [
          id,
          scopeId,
          kind,
          request.body?.name ?? request.file.originalname,
          Number.isFinite(jobId) ? jobId : null,
          request.body?.notes ?? "",
          objectKey,
          request.file.originalname,
          request.file.mimetype,
          request.file.size,
        ],
      );

      response.status(201).json({
        ok: true,
        upload: mapUploadRow(result.rows[0], await signedObjectUrl(objectKey)),
      });
    });
  });

  app.post("/api/identity/verify", requireAuthenticatedUser, writeRateLimit, (_request, response) => {
    const status = integrationStatus("identity", ["IDENTITY_PROVIDER_KEY"], "government ID verification");

    if (!status.ok) {
      response.status(424).json({
        ...status,
        message: "Connect Persona, Stripe Identity, or another ID provider before running live verifications.",
      });
      return;
    }

    response.status(501).json({
      ok: false,
      provider: "identity",
      mode: "not_implemented",
      message: "Identity verification is not available until a provider workflow is implemented and tested.",
    });
  });

  app.post("/api/subscriptions/checkout", requireAuthenticatedUser, writeRateLimit, (_request, response) => {
    const status = integrationStatus("stripe", ["STRIPE_SECRET_KEY"], "subscription billing");

    if (!status.ok) {
      response.status(424).json({
        ...status,
        message: "Add Stripe keys before sending real customers through subscription checkout.",
      });
      return;
    }

    response.status(501).json({
      ok: false,
      provider: "stripe",
      mode: "not_implemented",
      message: "Subscription checkout is not available until the Stripe workflow is implemented and tested.",
    });
  });

  app.post("/api/notifications/test", requireAuthenticatedUser, writeRateLimit, (request, response) => {
    const email = integrationStatus("email", ["RESEND_API_KEY"], "email notifications");
    const sms = buildTwilioSmsStatus("SMS notifications");
    const ok = email.ok || sms.ok;

    response.status(ok ? 200 : 424).json({
      ok,
      email,
      sms,
      channel: request.body?.channel ?? "email",
      message: ok
        ? "Notification provider is configured."
        : "Add Resend or Twilio account, auth, and a messaging service SID or sending number before sending customer notifications.",
    });
  });

  app.post("/api/invoices/send", requireAuthenticatedUser, (request, response) => {
    sendLegacyBridgeRetired(
      request,
      response,
      "LEGACY_INVOICE_SEND_RETIRED",
      "Legacy invoice delivery is retired. Send saved estimates and invoices from their RIVT records.",
    );
  });
}
