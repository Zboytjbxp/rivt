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
  database,
  requireAuthenticatedUser,
  writeRateLimit,
  runWithDatabase,
  mapUploadRow,
  signedObjectUrl,
  signedUrlSeconds,
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

  app.post("/api/uploads", requireAuthenticatedUser, (request, response) => {
    sendLegacyBridgeRetired(
      request,
      response,
      "LEGACY_UPLOAD_WRITE_RETIRED",
      "Legacy generic uploads are retired. Use a current RIVT photo, message, profile, or document workflow.",
    );
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
