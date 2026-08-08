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

  async function requestJson(baseUrl, path, { body, cookie, expectedAccountId, idempotencyKey, method = "GET" } = {}) {
    const headers = { Origin: "https://rivt.pro" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (cookie) headers.Cookie = cookie;
    if (expectedAccountId) headers["X-RIVT-Expected-Account-Id"] = expectedAccountId;
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

  async function createUnverifiedAccount(baseUrl, role, label) {
    const email = `${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${randomUUID()}@example.test`;
    const signup = await requestJson(baseUrl, "/api/v1/auth/signup", {
      method: "POST",
      body: { email, password: "SafePassword!1234", displayName: label, role },
    });
    assert.equal(signup.response.status, 201);
    return { email, cookie: sessionCookie(signup.response) };
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
    const unverified = await createUnverifiedAccount(baseUrl, "contractor", "Unverified Delivery Actor");
    const ownerAccount = await database.query(
      "SELECT account_id AS id FROM auth_identities WHERE lower(email) = lower($1) LIMIT 1",
      [owner.email],
    );
    assert.equal(ownerAccount.rowCount, 1);
    const otherAccount = await database.query(
      "SELECT account_id AS id FROM auth_identities WHERE lower(email) = lower($1) LIMIT 1",
      [other.email],
    );
    assert.equal(otherAccount.rowCount, 1);

    const stalePendingLogout = await requestJson(baseUrl, "/api/v1/auth/logout", {
      method: "POST",
      cookie: other.cookie,
      expectedAccountId: ownerAccount.rows[0].id,
    });
    assert.equal(stalePendingLogout.response.status, 409);
    assert.equal(stalePendingLogout.payload.error.code, "ACCOUNT_CONTEXT_CHANGED");
    const otherSessionSurvives = await requestJson(baseUrl, "/api/v1/me", { cookie: other.cookie });
    assert.equal(otherSessionSurvives.response.status, 200);
    assert.equal(otherSessionSurvives.payload.data.id, otherAccount.rows[0].id);

    const staleOfflineWrite = await requestJson(baseUrl, "/api/v1/tool-records", {
      method: "POST",
      cookie: other.cookie,
      expectedAccountId: ownerAccount.rows[0].id,
      idempotencyKey: randomUUID(),
      body: {
        recordType: "daily_report",
        localId: "stale-offline-account-write",
        title: "Account A daily log",
        status: "active",
        recordDate: "2026-08-02",
        payload: { note: "Must never be written under Account B." },
      },
    });
    assert.equal(staleOfflineWrite.response.status, 409);
    assert.equal(staleOfflineWrite.payload.error.code, "ACCOUNT_CONTEXT_CHANGED");

    const matchingOfflineWrite = await requestJson(baseUrl, "/api/v1/tool-records", {
      method: "POST",
      cookie: other.cookie,
      expectedAccountId: otherAccount.rows[0].id,
      idempotencyKey: randomUUID(),
      body: {
        recordType: "daily_report",
        localId: "matching-offline-account-write",
        title: "Account B daily log",
        status: "active",
        recordDate: "2026-08-02",
        payload: { note: "Expected-account header matches the authenticated actor." },
      },
    });
    assert.equal(matchingOfflineWrite.response.status, 200);
    await database.query(
      `UPDATE accounts
       SET status = 'active', updated_at = now()
       WHERE id = (
         SELECT account_id FROM auth_identities WHERE lower(email) = lower($1) LIMIT 1
       )`,
      [unverified.email],
    );
    for (const path of [
      "/api/v1/estimates/nonexistent/send",
      "/api/v1/invoices/nonexistent/send",
    ]) {
      const unverifiedDelivery = await requestJson(baseUrl, path, {
        method: "POST",
        cookie: unverified.cookie,
        idempotencyKey: randomUUID(),
      });
      assert.equal(unverifiedDelivery.response.status, 403);
      assert.equal(unverifiedDelivery.payload.error.code, "EMAIL_VERIFICATION_REQUIRED");
    }

    const anonymousBrand = await requestJson(baseUrl, "/api/v1/document-brand");
    assert.equal(anonymousBrand.response.status, 401);

    const defaultBrand = await requestJson(baseUrl, "/api/v1/document-brand", { cookie: owner.cookie });
    assert.equal(defaultBrand.response.status, 200);
    assert.equal(defaultBrand.payload.data.brand.businessName, "Tool Records Owner LLC");
    assert.equal(defaultBrand.payload.data.brand.invoiceStyle, "classic");

    const savedBrand = await requestJson(baseUrl, "/api/v1/document-brand", {
      method: "PUT",
      cookie: owner.cookie,
      body: {
        businessName: "River City Cabinet Co.",
        businessEmail: "office@rivercity.example",
        businessPhone: "(904) 555-0199",
        businessAddress: "Jacksonville, FL",
        website: "https://rivercity.example",
        licenseNumber: "CBC-12345",
        estimateStyle: "compact",
        invoiceStyle: "field",
        showContact: true,
        showAddress: true,
        showLicense: true,
      },
    });
    assert.equal(savedBrand.response.status, 200);
    assert.equal(savedBrand.payload.data.brand.businessName, "River City Cabinet Co.");
    assert.equal(savedBrand.payload.data.brand.invoiceStyle, "field");

    const isolatedBrand = await requestJson(baseUrl, "/api/v1/document-brand", { cookie: other.cookie });
    assert.equal(isolatedBrand.response.status, 200);
    assert.notEqual(isolatedBrand.payload.data.brand.businessName, "River City Cabinet Co.");

    const estimateTemplate = await requestJson(baseUrl, "/api/v1/tool-records", {
      method: "POST",
      cookie: owner.cookie,
      idempotencyKey: randomUUID(),
      body: {
        recordType: "estimate_template",
        localId: "estimate-template-standard",
        title: "Standard cabinet estimate",
        status: "active",
        recordDate: "2026-07-14",
        payload: {
          id: "estimate-template-standard",
          name: "Standard cabinet estimate",
          savedAt: "2026-07-14T12:00:00.000Z",
          laborHours: 24,
          hourlyRate: 95,
          crewSize: 2,
          materials: 1200,
          subCosts: 0,
          overheadPct: 12,
          marginPct: 18,
          contingencyPct: 7,
          scope: "Cabinet installation",
          customerNote: "Final site measure required.",
        },
      },
    });
    assert.equal(estimateTemplate.response.status, 200);
    const estimateTemplateList = await requestJson(baseUrl, "/api/v1/tool-records?type=estimate_template", { cookie: owner.cookie });
    assert.equal(estimateTemplateList.response.status, 200);
    assert.equal(estimateTemplateList.payload.data.records.length, 1);
    assert.equal(estimateTemplateList.payload.data.records[0].localId, "estimate-template-standard");
    const isolatedEstimateTemplates = await requestJson(baseUrl, "/api/v1/tool-records?type=estimate_template", { cookie: other.cookie });
    assert.equal(isolatedEstimateTemplates.response.status, 200);
    assert.equal(isolatedEstimateTemplates.payload.data.records.length, 0);

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
    assert.equal(missingKey.response.status, 410);
    assert.equal(missingKey.payload.error.code, "PAYMENT_RECORD_RETIRED");

    const retiredPaymentWrite = await requestJson(baseUrl, "/api/v1/tool-records", {
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
    assert.equal(retiredPaymentWrite.response.status, 410);
    assert.equal(retiredPaymentWrite.payload.error.code, "PAYMENT_RECORD_RETIRED");

    await database.query(
      `INSERT INTO tool_records (
         account_id, record_type, local_id, title, status, record_date, amount_cents, payload
       )
       VALUES ($1, 'payment_record', 'invoice-one', 'Panel trim invoice', 'paid',
         '2026-07-03'::date, 125000, $2::jsonb)`,
      [
        ownerAccount.rows[0].id,
        JSON.stringify({
          id: "invoice-one",
          jobTitle: "Panel trim invoice",
          invoiceDate: "2026-07-03",
          invoiceAmount: 1250,
          paidAmount: 1250,
          status: "paid",
        }),
      ],
    );

    const list = await requestJson(baseUrl, "/api/v1/tool-records?type=payment_record", { cookie: owner.cookie });
    assert.equal(list.response.status, 200);
    assert.equal(list.payload.data.records.length, 1);
    assert.equal(list.payload.data.records[0].localId, "invoice-one");

    const isolated = await requestJson(baseUrl, "/api/v1/tool-records?type=payment_record", { cookie: other.cookie });
    assert.equal(isolated.response.status, 200);
    assert.equal(isolated.payload.data.records.length, 0);

    const oldSessionDate = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const recentSessionDate = new Date().toISOString().slice(0, 10);
    for (const [localId, recordDate] of [["old-session", oldSessionDate], ["recent-session", recentSessionDate]]) {
      const session = await requestJson(baseUrl, "/api/v1/tool-records", {
        method: "POST",
        cookie: owner.cookie,
        idempotencyKey: randomUUID(),
        body: {
          recordType: "time_session",
          localId,
          title: localId,
          status: "complete",
          recordDate,
          payload: { id: localId, startedAt: `${recordDate}T12:00:00.000Z`, endedAt: `${recordDate}T13:00:00.000Z` },
        },
      });
      assert.equal(session.response.status, 200);
    }
    const freeHistory = await requestJson(baseUrl, "/api/v1/tool-records?type=time_session", { cookie: owner.cookie });
    assert.equal(freeHistory.response.status, 200);
    assert.deepEqual(freeHistory.payload.data.records.map((record) => record.localId), ["recent-session"]);
    assert.equal(freeHistory.payload.meta.historyDays, 90);

    const expense = await requestJson(baseUrl, "/api/v1/tool-records", {
      method: "POST",
      cookie: owner.cookie,
      idempotencyKey: randomUUID(),
      body: {
        recordType: "expense",
        localId: "receipt-cents",
        title: "Wire receipt",
        status: "active",
        recordDate: recentSessionDate,
        amountCents: 1249,
        payload: { category: "Materials", description: "Wire receipt" },
      },
    });
    assert.equal(expense.response.status, 200);
    const freeExport = await fetch(`${baseUrl}/api/v1/tool-records/expenses/export.csv`, {
      headers: { Origin: "https://rivt.pro", Cookie: owner.cookie },
    });
    assert.equal(freeExport.status, 403);

    await database.query(
      `INSERT INTO billing_entitlements (account_id, plan, status, source, active_until)
       VALUES ($1, 'pro', 'active', 'stripe', now() + interval '30 days')
       ON CONFLICT (account_id) DO UPDATE
       SET plan = 'pro', status = 'active', source = 'stripe', active_until = now() + interval '30 days'`,
      [ownerAccount.rows[0].id],
    );
    const proExport = await fetch(`${baseUrl}/api/v1/tool-records/expenses/export.csv`, {
      headers: { Origin: "https://rivt.pro", Cookie: owner.cookie },
    });
    assert.equal(proExport.status, 200);
    assert.match(await proExport.text(), /"12\.49"/);
    const proHistory = await requestJson(baseUrl, "/api/v1/tool-records?type=time_session", { cookie: owner.cookie });
    assert.equal(proHistory.response.status, 200);
    assert.equal(proHistory.payload.data.records.some((record) => record.localId === "old-session"), true);
    assert.equal(proHistory.payload.meta.historyDays, null);

    const customerLocalId = `customer-${randomUUID()}`;
    const customerCreated = await requestJson(baseUrl, "/api/v1/customers", {
      method: "POST",
      cookie: owner.cookie,
      idempotencyKey: randomUUID(),
      body: {
        localId: customerLocalId,
        name: "Jordan Client",
        company: "Jordan Property Group",
        email: "jordan.client@example.test",
        phone: "(904) 555-0188",
        billingAddress: "100 Billing Lane, Jacksonville, FL",
        serviceAddress: "200 Kitchen Way, Jacksonville, FL",
        preferredContactMethod: "email",
        defaultTerms: "Due on completion",
        favorite: true,
      },
    });
    assert.equal(customerCreated.response.status, 200);
    const customerId = customerCreated.payload.data.customer.id;
    assert.equal(customerCreated.payload.data.customer.legacyLocalId, customerLocalId);
    assert.equal(customerCreated.payload.data.customer.favorite, true);

    const customerUpserted = await requestJson(baseUrl, "/api/v1/customers", {
      method: "POST",
      cookie: owner.cookie,
      idempotencyKey: randomUUID(),
      body: {
        localId: customerLocalId,
        name: "Jordan Client",
        company: "Jordan Property Group",
        email: "jordan.updated@example.test",
        serviceAddress: "200 Kitchen Way, Jacksonville, FL",
      },
    });
    assert.equal(customerUpserted.response.status, 200);
    assert.equal(customerUpserted.payload.data.customer.id, customerId);
    assert.equal(customerUpserted.payload.data.customer.email, "jordan.updated@example.test");

    const ownerCustomers = await requestJson(baseUrl, "/api/v1/customers?status=all", { cookie: owner.cookie });
    assert.equal(ownerCustomers.response.status, 200);
    assert.equal(ownerCustomers.payload.data.customers.some((customer) => customer.id === customerId), true);
    const isolatedCustomers = await requestJson(baseUrl, "/api/v1/customers?status=all", { cookie: other.cookie });
    assert.equal(isolatedCustomers.response.status, 200);
    assert.equal(isolatedCustomers.payload.data.customers.some((customer) => customer.id === customerId), false);

    const otherCannotUseCustomer = await requestJson(baseUrl, "/api/v1/tool-records", {
      method: "POST",
      cookie: other.cookie,
      idempotencyKey: randomUUID(),
      body: {
        recordType: "estimate",
        localId: "estimate:foreign-customer",
        title: "Unauthorized customer estimate",
        status: "draft",
        amountCents: 100,
        payload: {},
        customerId,
      },
    });
    assert.equal(otherCannotUseCustomer.response.status, 403);
    assert.equal(otherCannotUseCustomer.payload.error.code, "CUSTOMER_ACCESS_DENIED");

    const supplier = await requestJson(baseUrl, "/api/v1/contacts", {
      method: "POST",
      cookie: owner.cookie,
      idempotencyKey: randomUUID(),
      body: {
        entityType: "company",
        name: "Morgan Supply Desk",
        company: "First Coast Fasteners",
        roles: [{ role: "supplier", details: {} }],
        methods: [{
          kind: "email",
          label: "orders",
          value: "tool-record-supplier@example.test",
          isPrimary: true,
        }],
      },
    });
    assert.equal(supplier.response.status, 201);
    const supplierContactId = supplier.payload.data.contact.id;
    const supplierPrice = await requestJson(baseUrl, "/api/v1/tool-records", {
      method: "POST",
      cookie: owner.cookie,
      idempotencyKey: randomUUID(),
      body: {
        recordType: "price_book",
        localId: "price:supplier-owned",
        title: "Concrete anchors",
        status: "saved",
        amountCents: 1899,
        payload: { supplierContactId, supplier: "First Coast Fasteners" },
      },
    });
    assert.equal(supplierPrice.response.status, 200);
    const otherCannotUseSupplier = await requestJson(baseUrl, "/api/v1/tool-records", {
      method: "POST",
      cookie: other.cookie,
      idempotencyKey: randomUUID(),
      body: {
        recordType: "price_book",
        localId: "price:foreign-supplier",
        title: "Unauthorized supplier price",
        status: "saved",
        amountCents: 1899,
        payload: { supplierContactId, supplier: "First Coast Fasteners" },
      },
    });
    assert.equal(otherCannotUseSupplier.response.status, 403);
    assert.equal(otherCannotUseSupplier.payload.error.code, "SUPPLIER_CONTACT_ACCESS_DENIED");

    const projectCreated = await requestJson(baseUrl, "/api/v1/standalone-projects", {
      method: "POST",
      cookie: owner.cookie,
      idempotencyKey: randomUUID(),
      body: {
        title: "Kitchen refresh",
        clientName: "Jordan Property Group",
        customerId,
        locationText: "Jacksonville, FL",
        tradeCode: "carpentry",
      },
    });
    assert.equal(projectCreated.response.status, 201);
    const standaloneProjectId = projectCreated.payload.data.project.id;
    assert.equal(projectCreated.payload.data.project.title, "Kitchen refresh");
    assert.equal(projectCreated.payload.data.project.customerId, customerId);

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
        customerId,
      },
    });
    assert.equal(estimateCreated.response.status, 200);
    assert.equal(estimateCreated.payload.data.record.standaloneProjectId, standaloneProjectId);
    assert.equal(estimateCreated.payload.data.record.customerId, customerId);

    const customerActivity = await requestJson(baseUrl, `/api/v1/customers/${customerId}/activity`, { cookie: owner.cookie });
    assert.equal(customerActivity.response.status, 200);
    assert.equal(customerActivity.payload.data.activity.some((item) => item.kind === "project" && item.id === standaloneProjectId), true);
    assert.equal(customerActivity.payload.data.activity.some((item) => item.kind === "document" && item.localId === `estimate:standalone:${standaloneProjectId}`), true);

    const otherCannotReadActivity = await requestJson(baseUrl, `/api/v1/customers/${customerId}/activity`, { cookie: other.cookie });
    assert.equal(otherCannotReadActivity.response.status, 404);

    const archivedCustomer = await requestJson(baseUrl, `/api/v1/customers/${customerId}`, {
      method: "PUT",
      cookie: owner.cookie,
      idempotencyKey: randomUUID(),
      body: { status: "archived" },
    });
    assert.equal(archivedCustomer.response.status, 200);
    assert.equal(archivedCustomer.payload.data.customer.status, "archived");
    const activeCustomers = await requestJson(baseUrl, "/api/v1/customers?status=active", { cookie: owner.cookie });
    assert.equal(activeCustomers.payload.data.customers.some((customer) => customer.id === customerId), false);
    const restoredCustomer = await requestJson(baseUrl, `/api/v1/customers/${customerId}`, {
      method: "PUT",
      cookie: owner.cookie,
      idempotencyKey: randomUUID(),
      body: { status: "active" },
    });
    assert.equal(restoredCustomer.response.status, 200);
    assert.equal(restoredCustomer.payload.data.customer.status, "active");

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
          estimateDate: "2026-07-14",
          validThrough: "2026-08-13",
          customerNote: "Materials are included.",
          documentFingerprint: "estimate-fingerprint-one",
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
    assert.equal(sentEstimate.payload.data.record.payload.delivery.documentFingerprint, "estimate-fingerprint-one");
    const deliveredEstimate = capturedEmailMessages().find((message) => message.to === "jordan.client@example.test");
    assert.ok(deliveredEstimate);
    assert.match(deliveredEstimate.text, /Kitchen cabinet installation/);
    assert.match(deliveredEstimate.text, /\$2,485\.00/);
    assert.match(deliveredEstimate.text, /Estimate date: 2026-07-14/);
    assert.match(deliveredEstimate.text, /Materials are included/);
    assert.doesNotMatch(deliveredEstimate.text, /margin|overhead|contingency/i);
    assert.match(deliveredEstimate.html, /River City Cabinet Co\./);
    assert.match(deliveredEstimate.html, /office@rivercity\.example/);
    assert.match(deliveredEstimate.html, /Created with RIVT\./);
    assert.match(deliveredEstimate.html, /border-bottom:3px solid/);

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

    const forgedPaidInvoice = await requestJson(baseUrl, "/api/v1/tool-records", {
      method: "POST",
      cookie: owner.cookie,
      idempotencyKey: randomUUID(),
      body: {
        recordType: "invoice_draft",
        localId: "invoice:forged-paid",
        title: "Forged paid invoice",
        status: "paid",
        recordDate: "2026-07-14",
        amountCents: 10000,
        payload: { invoiceNumber: "FORGED-PAID" },
      },
    });
    assert.equal(forgedPaidInvoice.response.status, 422);
    assert.equal(forgedPaidInvoice.payload.error.code, "INVOICE_STATUS_SERVER_OWNED");

    const forgedServerPayload = await requestJson(baseUrl, "/api/v1/tool-records", {
      method: "POST",
      cookie: owner.cookie,
      idempotencyKey: randomUUID(),
      body: {
        recordType: "invoice_draft",
        localId: "invoice:forged-server-payload",
        title: "Forged server payload",
        status: "sent",
        recordDate: "2026-07-14",
        amountCents: 10000,
        payload: {
          invoiceNumber: "FORGED-PAYLOAD",
          delivery: { status: "sent", providerMessageId: "invented" },
          bankPayment: { status: "paid", amountCents: 10000 },
        },
      },
    });
    assert.equal(forgedServerPayload.response.status, 200);
    assert.equal(forgedServerPayload.payload.data.record.status, "draft");
    assert.equal(forgedServerPayload.payload.data.record.payload.delivery, undefined);
    assert.equal(forgedServerPayload.payload.data.record.payload.bankPayment, undefined);
    await database.query(
      `UPDATE tool_records
       SET status = 'sent', updated_at = now()
       WHERE account_id = $1
         AND record_type = 'invoice_draft'
         AND local_id = 'invoice:forged-server-payload'`,
      [ownerAccount.rows[0].id],
    );
    const normalizeLegacyForgedSent = await requestJson(baseUrl, "/api/v1/tool-records", {
      method: "POST",
      cookie: owner.cookie,
      idempotencyKey: randomUUID(),
      body: {
        recordType: "invoice_draft",
        localId: "invoice:forged-server-payload",
        title: "Forged server payload",
        status: "sent",
        recordDate: "2026-07-14",
        amountCents: 10000,
        payload: { invoiceNumber: "FORGED-PAYLOAD" },
      },
    });
    assert.equal(normalizeLegacyForgedSent.response.status, 200);
    assert.equal(normalizeLegacyForgedSent.payload.data.record.status, "draft");

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
          issueDate: "2026-07-14",
          dueDate: "2026-07-31",
          customerNote: "Thank you for your business.",
          terms: "Due on completion",
          paymentMethod: "Secure bank payment or Pay by check to RIVT Cabinet Co.",
          paymentOptions: { bank: true, outside: true },
          outsidePaymentInstructions: "Pay by check to RIVT Cabinet Co.",
          payTo: "RIVT Cabinet Co.",
          documentFingerprint: "invoice-fingerprint-one",
          customerLines: [
            { description: "Cabinet installation", quantity: 24, totalCents: 158500 },
            { description: "Materials and handling", quantity: 1, totalCents: 90000 },
          ],
        },
      },
    });
    assert.equal(deliveryInvoice.response.status, 200);
    const invoiceRecord = await database.query(
      `SELECT id
       FROM tool_records
       WHERE account_id = $1 AND record_type = 'invoice_draft' AND local_id = 'invoice:email-one'
       LIMIT 1`,
      [ownerAccount.rows[0].id],
    );
    const toolPaymentRequestId = randomUUID();
    const stripeSessionId = `cs_live_tool_invoice_${randomUUID().replaceAll("-", "")}`;
    await database.query(
      `INSERT INTO tool_invoice_payment_requests (
         id, tool_record_id, merchant_account_id, stripe_connected_account_id,
         stripe_checkout_session_id, amount_cents, status, checkout_url
       )
       VALUES ($1, $2, $3, 'acct_live_tool_invoice_test',
         $4, 248500, 'open', $5)`,
      [
        toolPaymentRequestId,
        invoiceRecord.rows[0].id,
        ownerAccount.rows[0].id,
        stripeSessionId,
        `https://checkout.stripe.com/c/pay/${stripeSessionId}`,
      ],
    );
    const publicPayRedirect = await fetch(`${baseUrl}/pay/${toolPaymentRequestId}`, { redirect: "manual" });
    assert.equal(publicPayRedirect.status, 303);
    assert.match(publicPayRedirect.headers.get("location") ?? "", /^https:\/\/checkout\.stripe\.com\//);
    assert.equal(publicPayRedirect.headers.get("cache-control"), "no-store");
    assert.equal(publicPayRedirect.headers.get("pragma"), "no-cache");

    await database.query(
      "UPDATE tool_invoice_payment_requests SET status = 'paid' WHERE id = $1",
      [toolPaymentRequestId],
    );
    const publicCompletionRedirect = await fetch(`${baseUrl}/pay/${toolPaymentRequestId}`, { redirect: "manual" });
    assert.equal(publicCompletionRedirect.status, 303);
    assert.match(publicCompletionRedirect.headers.get("location") ?? "", /^https:\/\/rivt\.pro\/payment\/complete/);
    assert.equal(publicCompletionRedirect.headers.get("cache-control"), "no-store");
    assert.equal(publicCompletionRedirect.headers.get("pragma"), "no-cache");
    await database.query(
      "UPDATE tool_invoice_payment_requests SET status = 'open' WHERE id = $1",
      [toolPaymentRequestId],
    );

    const missingPublicPayment = await fetch(`${baseUrl}/pay/${randomUUID()}`, { redirect: "manual" });
    assert.equal(missingPublicPayment.status, 404);
    assert.equal(missingPublicPayment.headers.get("cache-control"), "no-store");
    assert.equal(missingPublicPayment.headers.get("pragma"), "no-cache");

    const changedInvoiceWithActiveLink = await requestJson(baseUrl, "/api/v1/tool-records", {
      method: "POST",
      cookie: owner.cookie,
      idempotencyKey: randomUUID(),
      body: {
        ...deliveryInvoice.payload.data.record,
        recordType: "invoice_draft",
        localId: "invoice:email-one",
        title: "Kitchen cabinet invoice",
        status: "draft",
        recordDate: "2026-07-14",
        amountCents: 248600,
        payload: deliveryInvoice.payload.data.record.payload,
      },
    });
    assert.equal(changedInvoiceWithActiveLink.response.status, 409);
    assert.equal(changedInvoiceWithActiveLink.payload.error.code, "BANK_PAYMENT_AMOUNT_CHANGED");

    const deleteInvoiceWithActiveLink = await requestJson(baseUrl, "/api/v1/tool-records/invoice_draft/invoice%3Aemail-one", {
      method: "DELETE",
      cookie: owner.cookie,
      idempotencyKey: randomUUID(),
    });
    assert.equal(deleteInvoiceWithActiveLink.response.status, 409);
    assert.equal(deleteInvoiceWithActiveLink.payload.error.code, "BANK_PAYMENT_LINK_ACTIVE");

    await database.query(
      "UPDATE tool_invoice_payment_requests SET amount_cents = 248400 WHERE id = $1",
      [toolPaymentRequestId],
    );
    const stalePublicPay = await fetch(`${baseUrl}/pay/${toolPaymentRequestId}`, { redirect: "manual" });
    assert.equal(stalePublicPay.status, 409);
    const staleInvoiceSend = await requestJson(baseUrl, "/api/v1/invoices/invoice%3Aemail-one/send", {
      method: "POST",
      cookie: owner.cookie,
      idempotencyKey: randomUUID(),
    });
    assert.equal(staleInvoiceSend.response.status, 409);
    assert.equal(staleInvoiceSend.payload.error.code, "INVOICE_PAYMENT_AMOUNT_MISMATCH");
    await database.query(
      "UPDATE tool_invoice_payment_requests SET amount_cents = 248500 WHERE id = $1",
      [toolPaymentRequestId],
    );
    await database.query(
      "UPDATE tool_invoice_payment_requests SET status = 'processing' WHERE id = $1",
      [toolPaymentRequestId],
    );
    const editWhileProcessing = await requestJson(baseUrl, "/api/v1/tool-records", {
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
        payload: deliveryInvoice.payload.data.record.payload,
      },
    });
    assert.equal(editWhileProcessing.response.status, 409);
    assert.equal(editWhileProcessing.payload.error.code, "BANK_PAYMENT_PROCESSING");
    await database.query(
      "UPDATE tool_invoice_payment_requests SET status = 'open' WHERE id = $1",
      [toolPaymentRequestId],
    );

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
    const concurrentInvoiceSends = await Promise.all([
      requestJson(baseUrl, "/api/v1/invoices/invoice%3Aemail-one/send", {
        method: "POST",
        cookie: owner.cookie,
        idempotencyKey: invoiceSendKey,
      }),
      requestJson(baseUrl, "/api/v1/invoices/invoice%3Aemail-one/send", {
        method: "POST",
        cookie: owner.cookie,
        idempotencyKey: randomUUID(),
      }),
    ]);
    assert.deepEqual(concurrentInvoiceSends.map((result) => result.response.status), [200, 200]);
    const sentInvoice = concurrentInvoiceSends.find((result) => result.payload.data.replayed === false);
    const concurrentInvoiceReplay = concurrentInvoiceSends.find((result) => result.payload.data.replayed === true);
    assert.ok(sentInvoice);
    assert.ok(concurrentInvoiceReplay);
    assert.equal(concurrentInvoiceReplay.response.headers.get("idempotent-replayed"), "true");
    assert.equal(sentInvoice.response.status, 200);
    assert.equal(sentInvoice.payload.data.record.status, "sent");
    assert.equal(sentInvoice.payload.data.record.payload.delivery.status, "sent");
    assert.equal(sentInvoice.payload.data.record.payload.delivery.recipientEmail, "jordan.client@example.test");
    assert.equal(sentInvoice.payload.data.record.payload.delivery.documentFingerprint, "invoice-fingerprint-one");
    const deliveredInvoice = capturedEmailMessages().find((message) => message.to === "jordan.client@example.test");
    assert.ok(deliveredInvoice);
    assert.match(deliveredInvoice.text, /Kitchen cabinet installation/);
    assert.match(deliveredInvoice.text, /\$2,485\.00/);
    assert.match(deliveredInvoice.text, /Invoice date: 2026-07-14/);
    assert.match(deliveredInvoice.text, /Due date: 2026-07-31/);
    assert.match(deliveredInvoice.text, /Thank you for your business/);
    assert.match(deliveredInvoice.text, /Payment options: Secure bank payment or Pay by check to RIVT Cabinet Co\./);
    assert.match(deliveredInvoice.text, /Other payment instructions: Pay by check to RIVT Cabinet Co\./);
    assert.match(deliveredInvoice.text, new RegExp(`https://rivt\\.pro/pay/${toolPaymentRequestId}`));
    assert.match(deliveredInvoice.html, />Pay from a US bank account</);
    assert.doesNotMatch(deliveredInvoice.html, /checkout\.stripe\.com/);
    assert.doesNotMatch(deliveredInvoice.text, /margin|overhead|contingency/i);
    assert.match(deliveredInvoice.html, /River City Cabinet Co\./);
    assert.match(deliveredInvoice.html, /CBC-12345/);
    assert.match(deliveredInvoice.html, /Created with RIVT\./);
    assert.match(deliveredInvoice.html, /background:#151515/);
    assert.match(deliveredInvoice.idempotencyKey, new RegExp(`^invoice-${invoiceRecord.rows[0].id}-[a-f0-9]{64}$`));

    const invoiceReplay = await requestJson(baseUrl, "/api/v1/invoices/invoice%3Aemail-one/send", {
      method: "POST",
      cookie: owner.cookie,
      idempotencyKey: invoiceSendKey,
    });
    assert.equal(invoiceReplay.response.status, 200);
    assert.equal(invoiceReplay.response.headers.get("idempotent-replayed"), "true");
    assert.equal(capturedEmailMessages().filter((message) => message.to === "jordan.client@example.test").length, 1);

    // Simulate a successful send whose HTTP response was lost, followed by the
    // client's unchanged autosave using its older draft view. Server delivery
    // truth must keep the record sent.
    const autosaveAfterLostResponse = await requestJson(baseUrl, "/api/v1/tool-records", {
      method: "POST",
      cookie: owner.cookie,
      idempotencyKey: randomUUID(),
      body: {
        ...deliveryInvoice.payload.data.record,
        recordType: "invoice_draft",
        status: "draft",
        payload: deliveryInvoice.payload.data.record.payload,
      },
    });
    assert.equal(autosaveAfterLostResponse.response.status, 200);
    assert.equal(autosaveAfterLostResponse.payload.data.record.status, "sent");
    assert.equal(autosaveAfterLostResponse.payload.data.record.payload.delivery.status, "sent");
    const identicalDocumentReplay = await requestJson(baseUrl, "/api/v1/invoices/invoice%3Aemail-one/send", {
      method: "POST",
      cookie: owner.cookie,
      idempotencyKey: randomUUID(),
    });
    assert.equal(identicalDocumentReplay.response.status, 200);
    assert.equal(identicalDocumentReplay.response.headers.get("idempotent-replayed"), "true");
    assert.equal(identicalDocumentReplay.payload.data.replayed, true);
    assert.equal(identicalDocumentReplay.payload.data.record.status, "sent");
    assert.equal(identicalDocumentReplay.payload.meta.replayReason, "identical_document");
    assert.equal(capturedEmailMessages().filter((message) => message.to === "jordan.client@example.test").length, 1);

    const integrityInvoicePayload = {
      recipientEmail: "invoice-integrity@example.test",
      recipientName: "Invoice Integrity Customer",
      invoiceNumber: "RIVT-INTEGRITY",
      paymentOptions: { bank: false, outside: true },
      outsidePaymentInstructions: "Pay by check to RIVT Cabinet Co.",
      customerLines: [],
    };
    const integrityDraft = await requestJson(baseUrl, "/api/v1/tool-records", {
      method: "POST",
      cookie: owner.cookie,
      idempotencyKey: randomUUID(),
      body: {
        recordType: "invoice_draft",
        localId: "invoice:delivery-integrity",
        title: "Original fallback title",
        status: "draft",
        recordDate: "2026-08-01",
        amountCents: 10000,
        payload: integrityInvoicePayload,
      },
    });
    assert.equal(integrityDraft.response.status, 200);

    const firstIntegritySend = await requestJson(baseUrl, "/api/v1/invoices/invoice%3Adelivery-integrity/send", {
      method: "POST",
      cookie: owner.cookie,
      idempotencyKey: randomUUID(),
    });
    assert.equal(firstIntegritySend.response.status, 200);
    assert.equal(firstIntegritySend.payload.data.record.status, "sent");
    assert.equal(firstIntegritySend.payload.data.record.payload.delivery.status, "sent");
    const firstIntegrityHash = firstIntegritySend.payload.data.record.payload.delivery.contentHash;

    const unchangedIntegrityAutosave = await requestJson(baseUrl, "/api/v1/tool-records", {
      method: "POST",
      cookie: owner.cookie,
      idempotencyKey: randomUUID(),
      body: {
        ...integrityDraft.payload.data.record,
        recordType: "invoice_draft",
        status: "draft",
        payload: integrityInvoicePayload,
      },
    });
    assert.equal(unchangedIntegrityAutosave.response.status, 200);
    assert.equal(unchangedIntegrityAutosave.payload.data.record.status, "sent");
    assert.equal(unchangedIntegrityAutosave.payload.data.record.payload.delivery.contentHash, firstIntegrityHash);

    const amountOnlyEdit = await requestJson(baseUrl, "/api/v1/tool-records", {
      method: "POST",
      cookie: owner.cookie,
      idempotencyKey: randomUUID(),
      body: {
        ...integrityDraft.payload.data.record,
        recordType: "invoice_draft",
        status: "draft",
        amountCents: 11000,
        payload: integrityInvoicePayload,
      },
    });
    assert.equal(amountOnlyEdit.response.status, 200);
    assert.equal(amountOnlyEdit.payload.data.record.status, "draft");
    assert.equal(Object.hasOwn(amountOnlyEdit.payload.data.record.payload, "delivery"), false);

    const resendAfterAmountEdit = await requestJson(baseUrl, "/api/v1/invoices/invoice%3Adelivery-integrity/send", {
      method: "POST",
      cookie: owner.cookie,
      idempotencyKey: randomUUID(),
    });
    assert.equal(resendAfterAmountEdit.response.status, 200);
    assert.equal(resendAfterAmountEdit.payload.data.record.status, "sent");
    assert.notEqual(resendAfterAmountEdit.payload.data.record.payload.delivery.contentHash, firstIntegrityHash);
    const amountEditedEmail = capturedEmailMessages()
      .filter((message) => message.to === "invoice-integrity@example.test")
      .at(-1);
    assert.ok(amountEditedEmail);
    assert.match(amountEditedEmail.text, /\$110\.00/);

    const titleOnlyEdit = await requestJson(baseUrl, "/api/v1/tool-records", {
      method: "POST",
      cookie: owner.cookie,
      idempotencyKey: randomUUID(),
      body: {
        ...amountOnlyEdit.payload.data.record,
        recordType: "invoice_draft",
        title: "Changed fallback title",
        status: "draft",
        payload: integrityInvoicePayload,
      },
    });
    assert.equal(titleOnlyEdit.response.status, 200);
    assert.equal(titleOnlyEdit.payload.data.record.status, "draft");
    assert.equal(Object.hasOwn(titleOnlyEdit.payload.data.record.payload, "delivery"), false);

    const resendAfterTitleEdit = await requestJson(baseUrl, "/api/v1/invoices/invoice%3Adelivery-integrity/send", {
      method: "POST",
      cookie: owner.cookie,
      idempotencyKey: randomUUID(),
    });
    assert.equal(resendAfterTitleEdit.response.status, 200);
    assert.equal(resendAfterTitleEdit.payload.data.record.status, "sent");

    const dateOnlyEdit = await requestJson(baseUrl, "/api/v1/tool-records", {
      method: "POST",
      cookie: owner.cookie,
      idempotencyKey: randomUUID(),
      body: {
        ...titleOnlyEdit.payload.data.record,
        recordType: "invoice_draft",
        status: "draft",
        recordDate: "2026-08-02",
        payload: integrityInvoicePayload,
      },
    });
    assert.equal(dateOnlyEdit.response.status, 200);
    assert.equal(dateOnlyEdit.payload.data.record.status, "draft");
    assert.equal(Object.hasOwn(dateOnlyEdit.payload.data.record.payload, "delivery"), false);

    const integrityList = await requestJson(baseUrl, "/api/v1/tool-records?type=invoice_draft", { cookie: owner.cookie });
    assert.equal(integrityList.response.status, 200);
    const persistedIntegrityInvoice = integrityList.payload.data.records
      .find((record) => record.localId === "invoice:delivery-integrity");
    assert.ok(persistedIntegrityInvoice);
    assert.equal(persistedIntegrityInvoice.status, "draft");
    assert.equal(Object.hasOwn(persistedIntegrityInvoice.payload, "delivery"), false);

    const otherCannotSendInvoice = await requestJson(baseUrl, "/api/v1/invoices/invoice%3Aemail-one/send", {
      method: "POST",
      cookie: other.cookie,
      idempotencyKey: randomUUID(),
    });
    assert.equal(otherCannotSendInvoice.response.status, 404);

    await database.query(
      "UPDATE tool_invoice_payment_requests SET status = 'paid', paid_at = now() WHERE id = $1",
      [toolPaymentRequestId],
    );
    await database.query(
      "UPDATE tool_records SET status = 'paid', updated_at = now() WHERE id = $1",
      [invoiceRecord.rows[0].id],
    );
    const settledPublicPay = await fetch(`${baseUrl}/pay/${toolPaymentRequestId}`, { redirect: "manual" });
    assert.equal(settledPublicPay.status, 303);
    assert.match(settledPublicPay.headers.get("location") ?? "", /\/payment\/complete/);

    const editPaidInvoice = await requestJson(baseUrl, "/api/v1/tool-records", {
      method: "POST",
      cookie: owner.cookie,
      idempotencyKey: randomUUID(),
      body: {
        recordType: "invoice_draft",
        localId: "invoice:email-one",
        title: "Kitchen cabinet invoice",
        status: "draft",
        recordDate: "2026-07-14",
        amountCents: 248600,
        payload: deliveryInvoice.payload.data.record.payload,
      },
    });
    assert.equal(editPaidInvoice.response.status, 409);
    assert.equal(editPaidInvoice.payload.error.code, "INVOICE_PAYMENT_HISTORY_LOCKED");

    const resendPaidInvoice = await requestJson(baseUrl, "/api/v1/invoices/invoice%3Aemail-one/send", {
      method: "POST",
      cookie: owner.cookie,
      idempotencyKey: randomUUID(),
    });
    assert.equal(resendPaidInvoice.response.status, 409);
    assert.equal(resendPaidInvoice.payload.error.code, "INVOICE_PAYMENT_HISTORY_LOCKED");

    const deletePaidInvoice = await requestJson(baseUrl, "/api/v1/tool-records/invoice_draft/invoice%3Aemail-one", {
      method: "DELETE",
      cookie: owner.cookie,
      idempotencyKey: randomUUID(),
    });
    assert.equal(deletePaidInvoice.response.status, 409);
    assert.equal(deletePaidInvoice.payload.error.code, "INVOICE_PAYMENT_HISTORY_LOCKED");

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
