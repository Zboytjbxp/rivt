import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import pg from "pg";

const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();

if (!testDatabaseUrl) {
  test("contacts are canonical and account-owned", { skip: "TEST_DATABASE_URL is not configured" }, () => {});
} else {
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = testDatabaseUrl;
  process.env.PGSSL = "disable";
  process.env.APP_ORIGIN = "https://rivt.pro";
  process.env.EMAIL_FROM = "RIVT Test <noreply@example.test>";
  process.env.EMAIL_DELIVERY_MODE = "capture";
  process.env.AUTH_METADATA_PEPPER = "contacts-test-pepper";
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
    return { response, payload: await response.json() };
  }

  function tokenFor(email) {
    const message = [...capturedEmailMessages()].reverse().find((candidate) => candidate.to === email);
    const match = message?.text.match(/verify-email\?token=([^\s]+)/);
    assert.ok(match);
    return decodeURIComponent(match[1]);
  }

  async function createAccount(baseUrl, label) {
    const email = `${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${randomUUID()}@example.test`;
    const signup = await requestJson(baseUrl, "/api/v1/auth/signup", {
      method: "POST",
      body: {
        email,
        password: "SafePassword!1234",
        displayName: label,
        role: "contractor",
      },
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
        role: "contractor",
        displayName: label,
        organizationName: `${label} LLC`,
        serviceAreaCity: "Jacksonville",
        serviceAreaRegion: "FL",
        serviceRadiusMiles: 35,
        tradeCodes: ["carpentry"],
        consentAccepted: true,
        consentVersion: "2026-06-19",
      },
    });
    assert.equal(onboarded.response.status, 200);
    return account;
  }

  test("contacts are canonical and account-owned", async (context) => {
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

    const owner = await createAccount(baseUrl, "Contacts Owner");
    const other = await createAccount(baseUrl, "Contacts Other");

    const anonymous = await requestJson(baseUrl, "/api/v1/contacts");
    assert.equal(anonymous.response.status, 401);

    const customer = await requestJson(baseUrl, "/api/v1/customers", {
      method: "POST",
      cookie: owner.cookie,
      idempotencyKey: randomUUID(),
      body: {
        localId: `customer-${randomUUID()}`,
        name: "Anya Brooks",
        company: "Northbank Interiors",
        email: "anya@example.test",
        phone: "(904) 555-0101",
        billingAddress: "100 Bay Street, Jacksonville, FL",
        serviceAddress: "200 Laura Street, Jacksonville, FL",
        notes: "Prefers email",
        preferredContactMethod: "email",
        defaultTerms: "Net 15",
        favorite: true,
        status: "active",
        threadMessages: [],
      },
    });
    assert.equal(customer.response.status, 200);
    const customerId = customer.payload.data.customer.id;

    const customerContacts = await requestJson(
      baseUrl,
      "/api/v1/contacts?role=customer",
      { cookie: owner.cookie },
    );
    assert.equal(customerContacts.response.status, 200);
    assert.equal(customerContacts.payload.data.contacts.length, 1);
    assert.equal(customerContacts.payload.data.contacts[0].id, customerId);
    assert.equal(customerContacts.payload.data.contacts[0].name, "Anya Brooks");

    const supplier = await requestJson(baseUrl, "/api/v1/contacts", {
      method: "POST",
      cookie: owner.cookie,
      idempotencyKey: randomUUID(),
      body: {
        entityType: "company",
        name: "Morgan Supply Desk",
        company: "First Coast Fasteners",
        notes: "Commercial fasteners and anchors",
        favorite: true,
        status: "active",
        roles: [{
          role: "supplier",
          details: {
            accountNumber: "JAX-204",
            representative: "Morgan Lee",
            paymentTerms: "Net 30",
          },
        }],
        methods: [
          {
            kind: "email",
            label: "orders",
            value: "orders@firstcoast.example",
            isPrimary: true,
          },
          {
            kind: "phone",
            label: "main",
            value: "904-555-0148",
            isPrimary: true,
          },
        ],
        addresses: [{
          kind: "mailing",
          label: "Warehouse",
          address: "300 Beaver Street, Jacksonville, FL",
          isPrimary: true,
        }],
        tags: ["fasteners", "local"],
      },
    });
    assert.equal(supplier.response.status, 201);
    const supplierId = supplier.payload.data.contact.id;
    assert.deepEqual(
      supplier.payload.data.contact.roles.map(({ role }) => role),
      ["supplier"],
    );

    const multiRole = await requestJson(baseUrl, `/api/v1/contacts/${supplierId}`, {
      method: "PUT",
      cookie: owner.cookie,
      idempotencyKey: randomUUID(),
      body: {
        roles: [
          {
            role: "customer",
            details: {
              preferredContactMethod: "email",
              defaultTerms: "Due on receipt",
            },
          },
          {
            role: "supplier",
            details: {
              accountNumber: "JAX-204",
              representative: "Morgan Lee",
              paymentTerms: "Net 30",
            },
          },
        ],
      },
    });
    assert.equal(multiRole.response.status, 200);
    assert.deepEqual(
      multiRole.payload.data.contact.roles.map(({ role }) => role),
      ["customer", "supplier"],
    );

    const projectedCustomers = await requestJson(baseUrl, "/api/v1/customers", {
      cookie: owner.cookie,
    });
    assert.equal(projectedCustomers.response.status, 200);
    assert.ok(projectedCustomers.payload.data.customers.some(({ id }) => id === supplierId));

    const ownerRows = await database.query(
      `SELECT account.id AS account_id, organization_member.organization_id
       FROM accounts account
       INNER JOIN auth_identities identity
         ON identity.account_id = account.id
       INNER JOIN organization_memberships organization_member
         ON organization_member.account_id = account.id
       WHERE identity.email = $1
       LIMIT 1`,
      [owner.email],
    );
    const jobId = randomUUID();
    await database.query(
      `INSERT INTO jobs (
         id, organization_id, created_by_account_id, title, trade_code,
         summary, scope_description, status
       ) VALUES ($1, $2, $3, $4, 'carpentry', '', '', 'draft')`,
      [
        jobId,
        ownerRows.rows[0].organization_id,
        ownerRows.rows[0].account_id,
        "Contacts integration job",
      ],
    );

    const linked = await requestJson(baseUrl, `/api/v1/jobs/${jobId}/contacts`, {
      method: "POST",
      cookie: owner.cookie,
      idempotencyKey: randomUUID(),
      body: {
        contactId: supplierId,
        relationshipRole: "Supplier",
        notes: "Call Morgan before pickup",
        isPrimary: true,
      },
    });
    assert.equal(linked.response.status, 200);
    assert.equal(linked.payload.data.link.contact.id, supplierId);
    assert.equal(linked.payload.data.link.relationshipRole, "Supplier");
    assert.equal(linked.payload.data.link.isPrimary, true);
    const linkId = linked.payload.data.link.id;

    const jobContacts = await requestJson(baseUrl, `/api/v1/jobs/${jobId}/contacts`, {
      cookie: owner.cookie,
    });
    assert.equal(jobContacts.response.status, 200);
    assert.equal(jobContacts.payload.data.links.length, 1);
    assert.equal(jobContacts.payload.data.links[0].notes, "Call Morgan before pickup");

    const otherJobContacts = await requestJson(baseUrl, `/api/v1/jobs/${jobId}/contacts`, {
      cookie: other.cookie,
    });
    assert.equal(otherJobContacts.response.status, 404);

    const duplicate = await requestJson(baseUrl, "/api/v1/contacts", {
      method: "POST",
      cookie: owner.cookie,
      idempotencyKey: randomUUID(),
      body: {
        entityType: "company",
        name: "Duplicate Supplier",
        company: "Duplicate Supplier",
        roles: [{ role: "supplier", details: {} }],
        methods: [{
          kind: "email",
          label: "work",
          value: "ORDERS@FIRSTCOAST.EXAMPLE",
          isPrimary: true,
        }],
      },
    });
    assert.equal(duplicate.response.status, 409);
    assert.equal(duplicate.payload.error.code, "CONTACT_DUPLICATE");
    assert.ok(duplicate.payload.error.details.candidates.some(({ id }) => id === supplierId));

    const unsafeWebsite = await requestJson(baseUrl, "/api/v1/contacts", {
      method: "POST",
      cookie: owner.cookie,
      idempotencyKey: randomUUID(),
      body: {
        entityType: "company",
        name: "Unsafe Website Supplier",
        company: "Unsafe Website Supplier",
        roles: [{ role: "supplier", details: {} }],
        methods: [{
          kind: "website",
          label: "website",
          value: "javascript:alert(1)",
          isPrimary: true,
        }],
      },
    });
    assert.equal(unsafeWebsite.response.status, 422);

    const crew = await requestJson(baseUrl, "/api/v1/network-records", {
      method: "POST",
      cookie: owner.cookie,
      idempotencyKey: randomUUID(),
      body: {
        recordType: "crew_member",
        localId: `crew-${randomUUID()}`,
        title: "Luis Hernandez",
        status: "available",
        recordDate: "2026-07-27",
        payload: {
          name: "Luis Hernandez",
          type: "crew",
          trade: "Finish carpentry",
          email: "luis@example.test",
          availability: "available",
        },
      },
    });
    assert.equal(crew.response.status, 200);
    const crewContacts = await requestJson(baseUrl, "/api/v1/contacts?role=crew", {
      cookie: owner.cookie,
    });
    assert.equal(crewContacts.response.status, 200);
    assert.ok(crewContacts.payload.data.contacts.some(({ name }) => name === "Luis Hernandez"));

    const isolated = await requestJson(baseUrl, "/api/v1/contacts", {
      cookie: other.cookie,
    });
    assert.equal(isolated.response.status, 200);
    assert.equal(isolated.payload.data.contacts.length, 0);

    const otherRead = await requestJson(baseUrl, `/api/v1/contacts/${supplierId}`, {
      cookie: other.cookie,
    });
    assert.equal(otherRead.response.status, 404);

    const activity = await requestJson(baseUrl, `/api/v1/contacts/${supplierId}/activity`, {
      cookie: owner.cookie,
    });
    assert.equal(activity.response.status, 200);
    assert.ok(activity.payload.data.activity.some((item) =>
      item.kind === "job" && item.title === "Contacts integration job"
    ));

    const removedLink = await requestJson(
      baseUrl,
      `/api/v1/jobs/${jobId}/contacts/${linkId}`,
      {
        method: "DELETE",
        cookie: owner.cookie,
        idempotencyKey: randomUUID(),
      },
    );
    assert.equal(removedLink.response.status, 200);
    const emptyJobContacts = await requestJson(baseUrl, `/api/v1/jobs/${jobId}/contacts`, {
      cookie: owner.cookie,
    });
    assert.deepEqual(emptyJobContacts.payload.data.links, []);

    const archived = await requestJson(baseUrl, `/api/v1/contacts/${supplierId}`, {
      method: "PUT",
      cookie: owner.cookie,
      idempotencyKey: randomUUID(),
      body: { status: "archived" },
    });
    assert.equal(archived.response.status, 200);
    assert.equal(archived.payload.data.contact.status, "archived");

    const activeSuppliers = await requestJson(baseUrl, "/api/v1/contacts?role=supplier", {
      cookie: owner.cookie,
    });
    assert.equal(activeSuppliers.response.status, 200);
    assert.equal(activeSuppliers.payload.data.contacts.length, 0);

    const archivedSuppliers = await requestJson(
      baseUrl,
      "/api/v1/contacts?role=supplier&status=archived",
      { cookie: owner.cookie },
    );
    assert.equal(archivedSuppliers.response.status, 200);
    assert.equal(archivedSuppliers.payload.data.contacts.length, 1);
  });
}
