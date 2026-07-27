import { randomUUID } from "node:crypto";
import { ApiError, asyncRoute, validate, z } from "./api.js";
import { syncContactFromCustomer } from "./contacts.js";

const localIdSchema = z.string().trim().min(1).max(120).regex(/^[A-Za-z0-9:_-]+$/);
const customerMessageSchema = z.object({
  id: z.string().trim().min(1).max(120),
  text: z.string().trim().min(1).max(2000),
  sentAt: z.iso.datetime(),
  from: z.literal("me"),
});

const customerFieldsSchema = z.object({
  name: z.string().trim().min(1).max(160),
  company: z.string().trim().max(160).default(""),
  email: z.union([z.literal(""), z.email().max(320)]).default(""),
  phone: z.string().trim().max(80).default(""),
  billingAddress: z.string().trim().max(500).default(""),
  serviceAddress: z.string().trim().max(500).default(""),
  notes: z.string().trim().max(4000).default(""),
  preferredContactMethod: z.enum(["none", "email", "phone", "sms"]).default("none"),
  defaultTerms: z.string().trim().max(240).default(""),
  favorite: z.boolean().default(false),
  status: z.enum(["active", "archived"]).default("active"),
  threadMessages: z.array(customerMessageSchema).max(100).default([]),
});

const customerCreateSchema = customerFieldsSchema.extend({
  localId: localIdSchema.optional(),
});

const customerUpdateSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  company: z.string().trim().max(160).optional(),
  email: z.union([z.literal(""), z.email().max(320)]).optional(),
  phone: z.string().trim().max(80).optional(),
  billingAddress: z.string().trim().max(500).optional(),
  serviceAddress: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(4000).optional(),
  preferredContactMethod: z.enum(["none", "email", "phone", "sms"]).optional(),
  defaultTerms: z.string().trim().max(240).optional(),
  favorite: z.boolean().optional(),
  status: z.enum(["active", "archived"]).optional(),
  threadMessages: z.array(customerMessageSchema).max(100).optional(),
}).refine(
  (value) => Object.keys(value).length > 0,
  { message: "Choose at least one customer detail to update." },
);

const customerListSchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: z.enum(["active", "archived", "all"]).default("active"),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

function mapCustomer(row) {
  return {
    id: row.id,
    legacyLocalId: row.legacy_local_id,
    name: row.name,
    company: row.company || "",
    email: row.email || "",
    phone: row.phone || "",
    billingAddress: row.billing_address || "",
    serviceAddress: row.service_address || "",
    notes: row.notes || "",
    preferredContactMethod: row.preferred_contact_method,
    defaultTerms: row.default_terms || "",
    favorite: Boolean(row.favorite),
    status: row.status,
    threadMessages: Array.isArray(row.thread_messages) ? row.thread_messages : [],
    lastUsedAt: row.last_used_at ? new Date(row.last_used_at).toISOString() : null,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
}

function legacyPayload(customer) {
  return {
    id: customer.legacy_local_id,
    name: customer.name,
    company: customer.company || "",
    phone: customer.phone || "",
    email: customer.email || "",
    billingAddress: customer.billing_address || "",
    serviceAddress: customer.service_address || "",
    notes: customer.notes || "",
    preferredContactMethod: customer.preferred_contact_method || "none",
    defaultTerms: customer.default_terms || "",
    favorite: Boolean(customer.favorite),
    status: customer.status,
    createdAt: customer.created_at ? new Date(customer.created_at).toISOString() : new Date().toISOString(),
    updatedAt: customer.updated_at ? new Date(customer.updated_at).toISOString() : new Date().toISOString(),
    lastUsedAt: customer.last_used_at ? new Date(customer.last_used_at).toISOString() : null,
    threadMessages: Array.isArray(customer.thread_messages) ? customer.thread_messages : [],
  };
}

async function mirrorLegacyClientRecord(client, customer) {
  const title = customer.company ? `${customer.name} - ${customer.company}` : customer.name;
  await client.query(
    `INSERT INTO tool_records (
       account_id, record_type, local_id, title, status, record_date, payload
     ) VALUES ($1, 'client', $2, $3, $4, $5::date, $6::jsonb)
     ON CONFLICT (account_id, record_type, local_id) WHERE deleted_at IS NULL
     DO UPDATE SET title = EXCLUDED.title,
                   status = EXCLUDED.status,
                   payload = EXCLUDED.payload,
                   updated_at = now()`,
    [
      customer.account_id,
      customer.legacy_local_id,
      title.slice(0, 160),
      customer.status,
      new Date(customer.created_at ?? Date.now()).toISOString().slice(0, 10),
      JSON.stringify(legacyPayload(customer)),
    ],
  );
}

function mapActivity(row) {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    status: row.status,
    date: row.activity_date ? new Date(row.activity_date).toISOString() : null,
    amountCents: row.amount_cents === null ? null : Number(row.amount_cents),
    recordType: row.record_type ?? null,
    localId: row.local_id ?? null,
  };
}

export function registerCustomerRoutes({
  app,
  database,
  requireV1AuthenticatedUser,
  requireV1Actor,
  writeRateLimit,
  runIdempotentMutation,
  sendIdempotentResult,
}) {
  app.get("/api/v1/customers", requireV1AuthenticatedUser, requireV1Actor, asyncRoute(async (request, response) => {
    const input = validate(customerListSchema, request.query);
    const params = [request.actor.account.id];
    const filters = [];
    if (input.status !== "all") {
      params.push(input.status);
      filters.push(`status = $${params.length}`);
    }
    if (input.q) {
      params.push(`%${input.q}%`);
      filters.push(`(
        name ILIKE $${params.length}
        OR company ILIKE $${params.length}
        OR email ILIKE $${params.length}
        OR phone ILIKE $${params.length}
      )`);
    }
    params.push(input.limit);
    const listed = await database.query(
      `SELECT *
       FROM customers
       WHERE account_id = $1
         ${filters.length ? `AND ${filters.join(" AND ")}` : ""}
       ORDER BY favorite DESC, last_used_at DESC NULLS LAST, updated_at DESC, id DESC
       LIMIT $${params.length}`,
      params,
    );
    response.json({
      data: { customers: listed.rows.map(mapCustomer) },
      meta: { requestId: request.requestId },
    });
  }));

  app.post("/api/v1/customers", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
    const input = validate(customerCreateSchema, request.body);
    const legacyLocalId = input.localId ?? randomUUID();
    const result = await runIdempotentMutation(
      request,
      request.actor.account.id,
      `customers.upsert:${legacyLocalId}`,
      async (client) => {
        const upserted = await client.query(
          `INSERT INTO customers (
             account_id, legacy_local_id, name, company, email, phone,
             billing_address, service_address, notes, preferred_contact_method,
             default_terms, favorite, status, thread_messages
           ) VALUES (
             $1, $2, $3, $4, lower($5), $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb
           )
           ON CONFLICT (account_id, legacy_local_id)
           DO UPDATE SET name = EXCLUDED.name,
                         company = EXCLUDED.company,
                         email = EXCLUDED.email,
                         phone = EXCLUDED.phone,
                         billing_address = EXCLUDED.billing_address,
                         service_address = EXCLUDED.service_address,
                         notes = EXCLUDED.notes,
                         preferred_contact_method = EXCLUDED.preferred_contact_method,
                         default_terms = EXCLUDED.default_terms,
                         favorite = EXCLUDED.favorite,
                         status = EXCLUDED.status,
                         thread_messages = EXCLUDED.thread_messages,
                         updated_at = now()
           RETURNING *`,
          [
            request.actor.account.id,
            legacyLocalId,
            input.name,
            input.company,
            input.email,
            input.phone,
            input.billingAddress,
            input.serviceAddress,
            input.notes,
            input.preferredContactMethod,
            input.defaultTerms,
            input.favorite,
            input.status,
            JSON.stringify(input.threadMessages),
          ],
        );
        await syncContactFromCustomer(client, upserted.rows[0]);
        await mirrorLegacyClientRecord(client, upserted.rows[0]);
        return {
          status: 200,
          body: {
            data: { customer: mapCustomer(upserted.rows[0]) },
            meta: { requestId: request.requestId },
          },
        };
      },
    );
    sendIdempotentResult(response, result);
  }));

  app.put("/api/v1/customers/:id", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
    const customerId = validate(z.uuid(), request.params.id);
    const input = validate(customerUpdateSchema, request.body);
    const result = await runIdempotentMutation(
      request,
      request.actor.account.id,
      `customers.update:${customerId}`,
      async (client) => {
        const updated = await client.query(
          `UPDATE customers
           SET name = COALESCE($3, name),
               company = COALESCE($4, company),
               email = COALESCE(lower($5), email),
               phone = COALESCE($6, phone),
               billing_address = COALESCE($7, billing_address),
               service_address = COALESCE($8, service_address),
               notes = COALESCE($9, notes),
               preferred_contact_method = COALESCE($10, preferred_contact_method),
               default_terms = COALESCE($11, default_terms),
               favorite = COALESCE($12, favorite),
               status = COALESCE($13, status),
               thread_messages = COALESCE($14::jsonb, thread_messages),
               updated_at = now()
           WHERE id = $1 AND account_id = $2
           RETURNING *`,
          [
            customerId,
            request.actor.account.id,
            input.name ?? null,
            input.company ?? null,
            input.email ?? null,
            input.phone ?? null,
            input.billingAddress ?? null,
            input.serviceAddress ?? null,
            input.notes ?? null,
            input.preferredContactMethod ?? null,
            input.defaultTerms ?? null,
            input.favorite ?? null,
            input.status ?? null,
            input.threadMessages ? JSON.stringify(input.threadMessages) : null,
          ],
        );
        if (!updated.rowCount) {
          throw new ApiError(404, "CUSTOMER_NOT_FOUND", "That customer does not exist.");
        }
        await syncContactFromCustomer(client, updated.rows[0]);
        await mirrorLegacyClientRecord(client, updated.rows[0]);
        return {
          status: 200,
          body: {
            data: { customer: mapCustomer(updated.rows[0]) },
            meta: { requestId: request.requestId },
          },
        };
      },
    );
    sendIdempotentResult(response, result);
  }));

  app.post("/api/v1/customers/:id/used", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
    const customerId = validate(z.uuid(), request.params.id);
    const result = await runIdempotentMutation(
      request,
      request.actor.account.id,
      `customers.used:${customerId}`,
      async (client) => {
        const updated = await client.query(
          `UPDATE customers
           SET last_used_at = now(), updated_at = now()
           WHERE id = $1 AND account_id = $2
           RETURNING *`,
          [customerId, request.actor.account.id],
        );
        if (!updated.rowCount) {
          throw new ApiError(404, "CUSTOMER_NOT_FOUND", "That customer does not exist.");
        }
        await syncContactFromCustomer(client, updated.rows[0]);
        await mirrorLegacyClientRecord(client, updated.rows[0]);
        return {
          status: 200,
          body: {
            data: { customer: mapCustomer(updated.rows[0]) },
            meta: { requestId: request.requestId },
          },
        };
      },
    );
    sendIdempotentResult(response, result);
  }));

  app.get("/api/v1/customers/:id/activity", requireV1AuthenticatedUser, requireV1Actor, asyncRoute(async (request, response) => {
    const customerId = validate(z.uuid(), request.params.id);
    const owned = await database.query(
      "SELECT 1 FROM customers WHERE id = $1 AND account_id = $2",
      [customerId, request.actor.account.id],
    );
    if (!owned.rowCount) {
      throw new ApiError(404, "CUSTOMER_NOT_FOUND", "That customer does not exist.");
    }
    const activity = await database.query(
      `SELECT *
       FROM (
         SELECT
           tr.id,
           'document'::text AS kind,
           tr.title,
           tr.status,
           COALESCE(tr.updated_at, tr.created_at) AS activity_date,
           tr.amount_cents,
           tr.record_type,
           tr.local_id
         FROM tool_records tr
         WHERE tr.account_id = $1
           AND tr.customer_id = $2
           AND tr.deleted_at IS NULL
         UNION ALL
         SELECT
           sp.id,
           'project'::text AS kind,
           sp.title,
           sp.status,
           COALESCE(sp.updated_at, sp.created_at) AS activity_date,
           NULL::integer AS amount_cents,
           NULL::text AS record_type,
           NULL::text AS local_id
         FROM standalone_projects sp
         WHERE sp.account_id = $1
           AND sp.customer_id = $2
       ) customer_activity
       ORDER BY activity_date DESC, id DESC
       LIMIT 100`,
      [request.actor.account.id, customerId],
    );
    response.json({
      data: { activity: activity.rows.map(mapActivity) },
      meta: { requestId: request.requestId },
    });
  }));
}
