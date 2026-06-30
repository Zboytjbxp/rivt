import { PutObjectCommand } from "@aws-sdk/client-s3";
import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";

const INVOICE_SEND_WINDOW_MS = 15 * 60 * 1000;
const INVOICE_SEND_MAX_PER_RECIPIENT = 5;
const INVOICE_SUBJECT_MAX_LENGTH = 120;
const INVOICE_MESSAGE_MAX_LENGTH = 4_000;
const invoiceSendWindows = new Map();

function sendLegacyBridgeRetired(request, response, code, message) {
  response.status(410).json({
    ok: false,
    code,
    error: message,
    requestId: request.requestId ?? null,
  });
}

function pruneInvoiceSendWindows(now = Date.now()) {
  for (const [key, value] of invoiceSendWindows) {
    if (!value || value.resetAt <= now) invoiceSendWindows.delete(key);
  }
}

function validateInvoiceRecipient(channel, recipient, normalizePhoneNumber) {
  const raw = String(recipient ?? "").trim();
  if (!raw) return { ok: false, error: "Recipient is required." };

  if (channel === "sms") {
    const normalized = normalizePhoneNumber(raw);
    if (!/^\+?[1-9]\d{9,14}$/.test(normalized)) {
      return { ok: false, error: "Enter a valid phone number for invoice text messages." };
    }
    return { ok: true, recipient: normalized };
  }

  if (raw.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) {
    return { ok: false, error: "Enter a valid email address for invoice email delivery." };
  }
  return { ok: true, recipient: raw.toLowerCase() };
}

function validateInvoiceSendPayload({
  appName,
  channel,
  recipient,
  subject,
  text,
  normalizePhoneNumber,
}) {
  const recipientResult = validateInvoiceRecipient(channel, recipient, normalizePhoneNumber);
  if (!recipientResult.ok) return recipientResult;

  const nextSubject = String(subject ?? `${appName} invoice`).trim();
  const nextText = String(text ?? "").trim();
  if (!nextText) return { ok: false, error: "Invoice text is required." };
  if (nextSubject.length > INVOICE_SUBJECT_MAX_LENGTH) {
    return { ok: false, error: `Invoice subject must be ${INVOICE_SUBJECT_MAX_LENGTH} characters or fewer.` };
  }
  if (nextText.length > INVOICE_MESSAGE_MAX_LENGTH) {
    return { ok: false, error: `Invoice message must be ${INVOICE_MESSAGE_MAX_LENGTH} characters or fewer.` };
  }

  return {
    ok: true,
    recipient: recipientResult.recipient,
    subject: nextSubject || `${appName} invoice`,
    text: nextText,
  };
}

function recordInvoiceRecipientSend({ accountId, channel, recipient, now = Date.now() }) {
  pruneInvoiceSendWindows(now);
  const key = `${accountId || "unknown"}:${channel}:${recipient.toLowerCase()}`;
  const current = invoiceSendWindows.get(key);
  const entry = !current || current.resetAt <= now
    ? { count: 0, resetAt: now + INVOICE_SEND_WINDOW_MS }
    : current;

  entry.count += 1;
  invoiceSendWindows.set(key, entry);

  if (entry.count > INVOICE_SEND_MAX_PER_RECIPIENT) {
    return {
      ok: false,
      retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
    };
  }
  return { ok: true, remaining: Math.max(0, INVOICE_SEND_MAX_PER_RECIPIENT - entry.count) };
}

export function registerLegacyIntegrationRoutes({
  app,
  appName,
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
  getTwilioSmsConfig,
  normalizePhoneNumber,
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

  app.post("/api/invoices/send", requireAuthenticatedUser, writeRateLimit, async (request, response) => {
    const channel = request.body?.channel === "sms" ? "sms" : "email";
    const payload = validateInvoiceSendPayload({
      appName,
      channel,
      recipient: request.body?.recipient,
      subject: request.body?.subject,
      text: request.body?.message,
      normalizePhoneNumber,
    });

    if (!payload.ok) {
      response.status(400).json({
        ok: false,
        error: payload.error,
      });
      return;
    }

    const throttle = recordInvoiceRecipientSend({
      accountId: request.actor?.account?.id ?? request.authUser?.id,
      channel,
      recipient: payload.recipient,
    });
    if (!throttle.ok) {
      response.setHeader("Retry-After", String(throttle.retryAfterSeconds));
      response.status(429).json({
        ok: false,
        error: "Too many invoice sends to that recipient. Try again later.",
      });
      return;
    }

    if (channel === "email") {
      const status = integrationStatus("email", ["RESEND_API_KEY", "RESEND_FROM_EMAIL"], "invoice email delivery");
      if (!status.ok) {
        response.status(424).json({
          ok: false,
          ...status,
          message: "Connect Resend and a verified from address before sending invoice email.",
        });
        return;
      }

      const sendResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM_EMAIL,
          to: [payload.recipient],
          subject: payload.subject,
          text: payload.text,
        }),
      });

      if (!sendResponse.ok) {
        await sendResponse.text();
        response.status(502).json({
          ok: false,
          ...status,
          message: "Resend rejected the invoice email.",
        });
        return;
      }

      const body = await sendResponse.json().catch(() => ({}));
      response.json({
        ok: true,
        provider: "email",
        deliveryId: body.id ?? null,
        recipient: payload.recipient,
        message: "Invoice email sent.",
      });
      return;
    }

    const smsConfig = getTwilioSmsConfig();
    const status = buildTwilioSmsStatus("invoice SMS delivery");
    if (!status.ok) {
      response.status(424).json({
        ok: false,
        ...status,
        message: "Connect Twilio and a messaging service SID or sending number before sending invoice text messages.",
      });
      return;
    }

    const twilioBody = new URLSearchParams({
      To: payload.recipient,
      Body: payload.text,
    });

    if (smsConfig.hasMessagingService) {
      twilioBody.set("MessagingServiceSid", smsConfig.messagingServiceSid);
    } else {
      twilioBody.set("From", smsConfig.fromNumber);
    }

    const sendResponse = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: twilioBody,
      },
    );

    if (!sendResponse.ok) {
      await sendResponse.text();
      response.status(502).json({
        ok: false,
        ...status,
        message: "Twilio rejected the invoice SMS.",
      });
      return;
    }

    const body = await sendResponse.json().catch(() => ({}));
    response.json({
      ok: true,
      provider: "sms",
      deliveryId: body.sid ?? null,
      recipient: payload.recipient,
      message: "Invoice text sent.",
    });
  });
}

export const legacyIntegrationInternals = {
  INVOICE_MESSAGE_MAX_LENGTH,
  INVOICE_SEND_MAX_PER_RECIPIENT,
  INVOICE_SEND_WINDOW_MS,
  INVOICE_SUBJECT_MAX_LENGTH,
  invoiceSendWindows,
  recordInvoiceRecipientSend,
  validateInvoiceSendPayload,
};
