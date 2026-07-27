import { randomUUID } from "node:crypto";
import { ApiError, asyncRoute, validate, z } from "./api.js";

const contactRoleSchema = z.enum([
  "crew",
  "subcontractor",
  "customer",
  "supplier",
  "other",
]);
const contactStatusSchema = z.enum(["active", "archived"]);
const contactMethodKindSchema = z.enum(["email", "phone", "website"]);
const contactAddressKindSchema = z.enum(["billing", "service", "mailing", "other"]);

const contactMethodSchema = z.object({
  id: z.uuid().optional(),
  kind: contactMethodKindSchema,
  label: z.string().trim().max(80).default(""),
  value: z.string().trim().min(1).max(500),
  isPrimary: z.boolean().default(false),
}).superRefine((method, context) => {
  if (method.kind === "email" && !z.email().safeParse(method.value).success) {
    context.addIssue({
      code: "custom",
      path: ["value"],
      message: "Enter a valid email address.",
    });
  }
  if (method.kind === "phone" && method.value.replace(/[^0-9]/g, "").length < 7) {
    context.addIssue({
      code: "custom",
      path: ["value"],
      message: "Enter a valid phone number.",
    });
  }
  if (method.kind === "website") {
    try {
      const url = new URL(method.value);
      if (!["http:", "https:"].includes(url.protocol)) throw new Error("unsupported protocol");
    } catch {
      context.addIssue({
        code: "custom",
        path: ["value"],
        message: "Enter a full http or https website address.",
      });
    }
  }
});

const contactAddressSchema = z.object({
  id: z.uuid().optional(),
  kind: contactAddressKindSchema,
  label: z.string().trim().max(80).default(""),
  address: z.string().trim().min(1).max(500),
  isPrimary: z.boolean().default(false),
});

const contactRoleInputSchema = z.object({
  role: contactRoleSchema,
  status: contactStatusSchema.default("active"),
  details: z.object({}).passthrough().default({}),
});

const contactRolesSchema = z.array(contactRoleInputSchema).min(1).max(5)
  .refine(
    (roles) => new Set(roles.map(({ role }) => role)).size === roles.length,
    { message: "Each contact role can appear only once." },
  );
const contactMethodsSchema = z.array(contactMethodSchema).max(20);
const contactAddressesSchema = z.array(contactAddressSchema).max(20);
const contactTagsSchema = z.array(
  z.string().trim().min(1).max(60)
    .transform((tag) => tag.toLowerCase()),
).max(20).transform((tags) => [...new Set(tags)]);

const contactFieldsSchema = z.object({
  entityType: z.enum(["person", "company"]).default("person"),
  name: z.string().trim().min(1).max(160),
  company: z.string().trim().max(160).default(""),
  notes: z.string().trim().max(4000).default(""),
  favorite: z.boolean().default(false),
  status: contactStatusSchema.default("active"),
  roles: contactRolesSchema,
  methods: contactMethodsSchema.default([]),
  addresses: contactAddressesSchema.default([]),
  tags: contactTagsSchema.default([]),
});

const contactCreateSchema = contactFieldsSchema;
const contactUpdateSchema = z.object({
  entityType: z.enum(["person", "company"]).optional(),
  name: z.string().trim().min(1).max(160).optional(),
  company: z.string().trim().max(160).optional(),
  notes: z.string().trim().max(4000).optional(),
  favorite: z.boolean().optional(),
  status: contactStatusSchema.optional(),
  roles: contactRolesSchema.optional(),
  methods: contactMethodsSchema.optional(),
  addresses: contactAddressesSchema.optional(),
  tags: contactTagsSchema.optional(),
}).refine(
  (value) => Object.keys(value).length > 0,
  { message: "Choose at least one contact detail to update." },
);

const contactListSchema = z.object({
  role: contactRoleSchema.optional(),
  q: z.string().trim().max(120).optional(),
  status: z.enum(["active", "archived", "all"]).default("active"),
  limit: z.coerce.number().int().min(1).max(250).default(200),
});

const jobContactLinkSchema = z.object({
  contactId: z.uuid(),
  relationshipRole: z.string().trim().min(1).max(80),
  notes: z.string().trim().max(1000).default(""),
  isPrimary: z.boolean().default(false),
});

function normalizeMethod(kind, value) {
  const trimmed = String(value ?? "").trim();
  if (kind === "email") return trimmed.toLowerCase();
  if (kind === "phone") return trimmed.replace(/[^0-9]/g, "");
  return trimmed.toLowerCase().replace(/\/+$/, "");
}

function primaryMethod(methods, kind) {
  const matches = methods.filter((method) => method.kind === kind);
  return matches.find((method) => method.isPrimary) ?? matches[0] ?? null;
}

function primaryAddress(addresses, kind) {
  const matches = addresses.filter((address) => address.kind === kind);
  return matches.find((address) => address.isPrimary) ?? matches[0] ?? null;
}

function mapContact(row) {
  const roles = Array.isArray(row.roles) ? row.roles : [];
  const methods = Array.isArray(row.methods) ? row.methods : [];
  const addresses = Array.isArray(row.addresses) ? row.addresses : [];
  return {
    id: row.id,
    entityType: row.entity_type,
    name: row.name,
    company: row.company || "",
    notes: row.notes || "",
    favorite: Boolean(row.favorite),
    status: row.status,
    linkedAccountId: row.linked_account_id ?? null,
    lastUsedAt: row.last_used_at ? new Date(row.last_used_at).toISOString() : null,
    roles: roles.map((role) => ({
      role: role.role,
      status: role.status ?? "active",
      details: role.details ?? {},
      createdAt: role.createdAt ?? null,
      updatedAt: role.updatedAt ?? null,
    })),
    methods: methods.map((method) => ({
      id: method.id,
      kind: method.kind,
      label: method.label || "",
      value: method.value,
      isPrimary: Boolean(method.isPrimary),
    })),
    addresses: addresses.map((address) => ({
      id: address.id,
      kind: address.kind,
      label: address.label || "",
      address: address.address,
      isPrimary: Boolean(address.isPrimary),
    })),
    tags: Array.isArray(row.tags) ? row.tags : [],
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
}

const contactProjectionSql = `
  SELECT
    contact.*,
    COALESCE(role_rows.roles, '[]'::jsonb) AS roles,
    COALESCE(method_rows.methods, '[]'::jsonb) AS methods,
    COALESCE(address_rows.addresses, '[]'::jsonb) AS addresses,
    COALESCE(tag_rows.tags, '[]'::jsonb) AS tags
  FROM contacts contact
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(
      jsonb_build_object(
        'role', role.role,
        'status', role.status,
        'details', role.details,
        'createdAt', role.created_at,
        'updatedAt', role.updated_at
      )
      ORDER BY role.role
    ) AS roles
    FROM contact_roles role
    WHERE role.contact_id = contact.id
  ) role_rows ON true
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', method.id,
        'kind', method.kind,
        'label', method.label,
        'value', method.value,
        'isPrimary', method.is_primary
      )
      ORDER BY method.kind, method.is_primary DESC, method.id
    ) AS methods
    FROM contact_methods method
    WHERE method.contact_id = contact.id
  ) method_rows ON true
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', address.id,
        'kind', address.kind,
        'label', address.label,
        'address', address.address,
        'isPrimary', address.is_primary
      )
      ORDER BY address.kind, address.is_primary DESC, address.id
    ) AS addresses
    FROM contact_addresses address
    WHERE address.contact_id = contact.id
  ) address_rows ON true
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(tag.tag ORDER BY tag.tag) AS tags
    FROM contact_tags tag
    WHERE tag.contact_id = contact.id
  ) tag_rows ON true
`;

async function readContact(client, accountId, contactId) {
  const result = await client.query(
    `${contactProjectionSql}
     WHERE contact.account_id = $1
       AND contact.id = $2`,
    [accountId, contactId],
  );
  return result.rows[0] ? mapContact(result.rows[0]) : null;
}

async function assertNoDuplicateMethods(client, accountId, methods, excludeContactId = null) {
  const normalized = methods
    .map((method) => ({
      kind: method.kind,
      normalizedValue: normalizeMethod(method.kind, method.value),
    }))
    .filter((method) => method.normalizedValue);
  if (!normalized.length) return;

  const candidates = await client.query(
    `SELECT DISTINCT contact.id, contact.name, contact.company
     FROM contacts contact
     INNER JOIN contact_methods method ON method.contact_id = contact.id
     WHERE contact.account_id = $1
       AND contact.status = 'active'
       AND ($2::uuid IS NULL OR contact.id <> $2::uuid)
       AND (method.kind, method.normalized_value) IN (
         SELECT item.kind, item.normalized_value
         FROM jsonb_to_recordset($3::jsonb)
           AS item(kind text, normalized_value text)
       )
     ORDER BY contact.company, contact.name, contact.id
     LIMIT 5`,
    [
      accountId,
      excludeContactId,
      JSON.stringify(normalized.map((method) => ({
        kind: method.kind,
        normalized_value: method.normalizedValue,
      }))),
    ],
  );
  if (candidates.rowCount) {
    throw new ApiError(
      409,
      "CONTACT_DUPLICATE",
      "That email or phone is already attached to a saved contact.",
      {
        candidates: candidates.rows.map((candidate) => ({
          id: candidate.id,
          name: candidate.name,
          company: candidate.company || "",
        })),
      },
    );
  }
}

function normalizePrimaryFlags(items, key) {
  const seen = new Set();
  return items.map((item) => {
    if (!item.isPrimary || seen.has(item[key])) return { ...item, isPrimary: false };
    seen.add(item[key]);
    return item;
  });
}

async function replaceContactParts(client, accountId, contactId, input) {
  if (input.roles) {
    await client.query(
      "DELETE FROM contact_roles WHERE account_id = $1 AND contact_id = $2",
      [accountId, contactId],
    );
    for (const role of input.roles) {
      await client.query(
        `INSERT INTO contact_roles (
           contact_id, account_id, role, status, details
         ) VALUES ($1, $2, $3, $4, $5::jsonb)`,
        [
          contactId,
          accountId,
          role.role,
          role.status ?? "active",
          JSON.stringify(role.details ?? {}),
        ],
      );
    }
  }

  if (input.methods) {
    const methods = normalizePrimaryFlags(input.methods, "kind");
    await client.query(
      "DELETE FROM contact_methods WHERE account_id = $1 AND contact_id = $2",
      [accountId, contactId],
    );
    for (const method of methods) {
      const normalizedValue = normalizeMethod(method.kind, method.value);
      if (!normalizedValue) continue;
      await client.query(
        `INSERT INTO contact_methods (
           id, contact_id, account_id, kind, label, value,
           normalized_value, is_primary
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          method.id ?? randomUUID(),
          contactId,
          accountId,
          method.kind,
          method.label,
          method.value,
          normalizedValue,
          method.isPrimary,
        ],
      );
    }
  }

  if (input.addresses) {
    const addresses = normalizePrimaryFlags(input.addresses, "kind");
    await client.query(
      "DELETE FROM contact_addresses WHERE account_id = $1 AND contact_id = $2",
      [accountId, contactId],
    );
    for (const address of addresses) {
      await client.query(
        `INSERT INTO contact_addresses (
           id, contact_id, account_id, kind, label, address, is_primary
         ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          address.id ?? randomUUID(),
          contactId,
          accountId,
          address.kind,
          address.label,
          address.address,
          address.isPrimary,
        ],
      );
    }
  }

  if (input.tags) {
    await client.query(
      "DELETE FROM contact_tags WHERE account_id = $1 AND contact_id = $2",
      [accountId, contactId],
    );
    for (const tag of input.tags) {
      await client.query(
        `INSERT INTO contact_tags (contact_id, account_id, tag)
         VALUES ($1, $2, $3)
         ON CONFLICT (contact_id, tag) DO NOTHING`,
        [contactId, accountId, tag],
      );
    }
  }
}

async function syncCustomerProjection(client, contact) {
  const customerRole = contact.roles.find(
    ({ role, status }) => role === "customer" && status === "active",
  );
  const existing = await client.query(
    "SELECT * FROM customers WHERE account_id = $1 AND contact_id = $2",
    [contact.accountId, contact.id],
  );
  if (!customerRole) {
    if (existing.rowCount) {
      await client.query(
        `UPDATE customers
         SET status = 'archived', updated_at = now()
         WHERE account_id = $1 AND contact_id = $2`,
        [contact.accountId, contact.id],
      );
    }
    return;
  }

  const email = primaryMethod(contact.methods, "email")?.value ?? "";
  const phone = primaryMethod(contact.methods, "phone")?.value ?? "";
  const billingAddress = primaryAddress(contact.addresses, "billing")?.address ?? "";
  const serviceAddress = primaryAddress(contact.addresses, "service")?.address ?? "";
  const preferredContactMethod = ["email", "phone", "sms"].includes(
    customerRole.details?.preferredContactMethod,
  )
    ? customerRole.details.preferredContactMethod
    : "none";
  const defaultTerms = typeof customerRole.details?.defaultTerms === "string"
    ? customerRole.details.defaultTerms
    : "";

  await client.query(
    `INSERT INTO customers (
       id, account_id, legacy_local_id, contact_id, name, company, email,
       phone, billing_address, service_address, notes,
       preferred_contact_method, default_terms, favorite, status,
       thread_messages, last_used_at, created_at, updated_at
     ) VALUES (
       $1::uuid, $2::uuid, ($1::uuid)::text, $1::uuid,
       $3, $4, lower($5), $6, $7, $8, $9,
       $10, $11, $12, $13, '[]'::jsonb, $14, $15, now()
     )
     ON CONFLICT (id) DO UPDATE SET
       contact_id = EXCLUDED.contact_id,
       name = EXCLUDED.name,
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
       last_used_at = EXCLUDED.last_used_at,
       updated_at = now()`,
    [
      contact.id,
      contact.accountId,
      contact.name,
      contact.company,
      email,
      phone,
      billingAddress,
      serviceAddress,
      contact.notes,
      preferredContactMethod,
      defaultTerms,
      contact.favorite,
      contact.status,
      contact.lastUsedAt,
      contact.createdAt,
    ],
  );
}

async function syncCrewProjection(client, contact) {
  const subcontractorRole = contact.roles.find(
    ({ role, status }) => role === "subcontractor" && status === "active",
  );
  const crewRole = contact.roles.find(
    ({ role, status }) => role === "crew" && status === "active",
  );
  const role = subcontractorRole ?? crewRole;
  const existing = await client.query(
    `SELECT id, local_id
     FROM network_records
     WHERE account_id = $1
       AND record_type = 'crew_member'
       AND contact_id = $2
       AND deleted_at IS NULL
     ORDER BY updated_at DESC
     LIMIT 1`,
    [contact.accountId, contact.id],
  );
  if (!role) {
    if (existing.rowCount) {
      await client.query(
        `UPDATE network_records
         SET deleted_at = now(), updated_at = now()
         WHERE account_id = $1
           AND record_type = 'crew_member'
           AND contact_id = $2
           AND deleted_at IS NULL`,
        [contact.accountId, contact.id],
      );
    }
    return;
  }

  const email = primaryMethod(contact.methods, "email")?.value ?? "";
  const phone = primaryMethod(contact.methods, "phone")?.value ?? "";
  const details = role.details ?? {};
  const type = role.role === "subcontractor" ? "sub" : "crew";
  const payload = {
    id: existing.rows[0]?.local_id ?? contact.id,
    type,
    name: contact.name,
    company: contact.company,
    trade: typeof details.trade === "string" ? details.trade : "",
    license: typeof details.license === "string" ? details.license : "",
    licenseExpiry: typeof details.licenseExpiry === "string" ? details.licenseExpiry : "",
    phone,
    email,
    hourlyRate: typeof details.hourlyRate === "number" ? details.hourlyRate : undefined,
    availability: ["busy", "unavailable"].includes(details.availability)
      ? details.availability
      : "available",
    currentJobId: typeof details.currentJobId === "string" ? details.currentJobId : undefined,
    notes: contact.notes,
    addedAt: contact.createdAt,
  };
  const localId = existing.rows[0]?.local_id ?? contact.id;
  await client.query(
    `INSERT INTO network_records (
       account_id, record_type, local_id, contact_id, title, status,
       record_date, payload
     ) VALUES (
       $1, 'crew_member', $2, $3, $4, $5, $6::date, $7::jsonb
     )
     ON CONFLICT (account_id, record_type, local_id)
       WHERE deleted_at IS NULL
     DO UPDATE SET
       contact_id = EXCLUDED.contact_id,
       title = EXCLUDED.title,
       status = EXCLUDED.status,
       payload = EXCLUDED.payload,
       updated_at = now()`,
    [
      contact.accountId,
      localId,
      contact.id,
      contact.name,
      payload.availability,
      contact.createdAt?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
      JSON.stringify(payload),
    ],
  );
}

async function syncCompatibilityProjections(client, accountId, contactId) {
  const contact = await readContact(client, accountId, contactId);
  if (!contact) return null;
  const internal = { ...contact, accountId };
  await syncCustomerProjection(client, internal);
  await syncCrewProjection(client, internal);
  return contact;
}

export async function syncContactFromCustomer(client, customer) {
  const contactId = customer.contact_id ?? customer.id;
  await client.query(
    `INSERT INTO contacts (
       id, account_id, entity_type, name, company, notes, favorite, status,
       last_used_at, created_at, updated_at
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
     )
     ON CONFLICT (id) DO UPDATE SET
       entity_type = EXCLUDED.entity_type,
       name = EXCLUDED.name,
       company = EXCLUDED.company,
       notes = EXCLUDED.notes,
       favorite = EXCLUDED.favorite,
       last_used_at = EXCLUDED.last_used_at,
       updated_at = EXCLUDED.updated_at`,
    [
      contactId,
      customer.account_id,
      customer.company ? "company" : "person",
      customer.name,
      customer.company || "",
      customer.notes || "",
      Boolean(customer.favorite),
      customer.status,
      customer.last_used_at,
      customer.created_at,
      customer.updated_at,
    ],
  );
  await client.query(
    `UPDATE customers
     SET contact_id = $3
     WHERE id = $1 AND account_id = $2`,
    [customer.id, customer.account_id, contactId],
  );
  await client.query(
    `INSERT INTO contact_roles (
       contact_id, account_id, role, status, details, created_at, updated_at
     ) VALUES ($1, $2, 'customer', $3, $4::jsonb, $5, $6)
     ON CONFLICT (contact_id, role) DO UPDATE SET
       status = EXCLUDED.status,
       details = EXCLUDED.details,
       updated_at = EXCLUDED.updated_at`,
    [
      contactId,
      customer.account_id,
      customer.status,
      JSON.stringify({
        preferredContactMethod: customer.preferred_contact_method || "none",
        defaultTerms: customer.default_terms || "",
      }),
      customer.created_at,
      customer.updated_at,
    ],
  );
  await client.query(
    `UPDATE contacts contact
     SET status = CASE
           WHEN EXISTS (
             SELECT 1
             FROM contact_roles active_role
             WHERE active_role.contact_id = contact.id
               AND active_role.status = 'active'
           ) THEN 'active'
           ELSE 'archived'
         END,
         updated_at = GREATEST(contact.updated_at, $3)
     WHERE contact.id = $1
       AND contact.account_id = $2`,
    [contactId, customer.account_id, customer.updated_at],
  );
  await client.query(
    `DELETE FROM contact_methods
     WHERE account_id = $1
       AND contact_id = $2
       AND kind IN ('email', 'phone')
       AND is_primary`,
    [customer.account_id, contactId],
  );
  if (customer.email) {
    await client.query(
      `INSERT INTO contact_methods (
         contact_id, account_id, kind, label, value, normalized_value,
         is_primary
       ) VALUES ($1, $2, 'email', 'work', $3, lower(trim($3)), true)
       ON CONFLICT (contact_id, kind, normalized_value) DO UPDATE SET
         label = EXCLUDED.label,
         value = EXCLUDED.value,
         is_primary = true,
         updated_at = now()`,
      [contactId, customer.account_id, customer.email],
    );
  }
  const normalizedPhone = normalizeMethod("phone", customer.phone);
  if (normalizedPhone) {
    await client.query(
      `INSERT INTO contact_methods (
         contact_id, account_id, kind, label, value, normalized_value,
         is_primary
       ) VALUES ($1, $2, 'phone', 'mobile', $3, $4, true)
       ON CONFLICT (contact_id, kind, normalized_value) DO UPDATE SET
         label = EXCLUDED.label,
         value = EXCLUDED.value,
         is_primary = true,
         updated_at = now()`,
      [contactId, customer.account_id, customer.phone, normalizedPhone],
    );
  }
  await client.query(
    `DELETE FROM contact_addresses
     WHERE account_id = $1
       AND contact_id = $2
       AND kind IN ('billing', 'service')
       AND is_primary`,
    [customer.account_id, contactId],
  );
  if (customer.billing_address) {
    await client.query(
      `INSERT INTO contact_addresses (
         contact_id, account_id, kind, label, address, is_primary
       ) VALUES ($1, $2, 'billing', 'Billing', $3, true)`,
      [contactId, customer.account_id, customer.billing_address],
    );
  }
  if (customer.service_address) {
    await client.query(
      `INSERT INTO contact_addresses (
         contact_id, account_id, kind, label, address, is_primary
       ) VALUES ($1, $2, 'service', 'Service', $3, true)`,
      [contactId, customer.account_id, customer.service_address],
    );
  }
  return contactId;
}

export async function syncContactFromNetworkRecord(client, record) {
  if (record.record_type !== "crew_member") return record.contact_id ?? null;
  const payload = record.payload ?? {};
  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  const phone = typeof payload.phone === "string" ? payload.phone.trim() : "";
  const normalizedPhone = normalizeMethod("phone", phone);
  let contactId = record.contact_id ?? null;
  if (!contactId && (email || normalizedPhone)) {
    const match = await client.query(
      `SELECT min(contact_id::text)::uuid AS contact_id,
              count(DISTINCT contact_id)::int AS match_count
       FROM contact_methods
       WHERE account_id = $1
         AND (
           (kind = 'email' AND normalized_value = $2)
           OR (kind = 'phone' AND normalized_value = $3)
         )`,
      [record.account_id, email, normalizedPhone],
    );
    if (match.rows[0]?.match_count === 1) contactId = match.rows[0].contact_id;
  }
  contactId ??= record.id;
  await client.query(
    `INSERT INTO contacts (
       id, account_id, entity_type, name, company, notes, status,
       created_at, updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (id) DO UPDATE SET
       entity_type = EXCLUDED.entity_type,
       name = EXCLUDED.name,
       company = EXCLUDED.company,
       notes = EXCLUDED.notes,
       updated_at = EXCLUDED.updated_at`,
    [
      contactId,
      record.account_id,
      payload.company ? "company" : "person",
      String(payload.name || record.title).slice(0, 160),
      String(payload.company || "").slice(0, 160),
      String(payload.notes || "").slice(0, 4000),
      record.deleted_at ? "archived" : "active",
      record.created_at,
      record.updated_at,
    ],
  );
  await client.query(
    "UPDATE network_records SET contact_id = $2 WHERE id = $1",
    [record.id, contactId],
  );
  const role = payload.type === "sub" ? "subcontractor" : "crew";
  await client.query(
    `DELETE FROM contact_roles
     WHERE contact_id = $1
       AND role IN ('crew', 'subcontractor')
       AND role <> $2`,
    [contactId, role],
  );
  await client.query(
    `INSERT INTO contact_roles (
       contact_id, account_id, role, status, details
     )
     VALUES ($1, $2, $3, 'active', $4::jsonb)
     ON CONFLICT (contact_id, role) DO UPDATE SET
       status = 'active',
       details = EXCLUDED.details,
       updated_at = now()`,
    [
      contactId,
      record.account_id,
      role,
      JSON.stringify({
        trade: payload.trade || "",
        license: payload.license || "",
        licenseExpiry: payload.licenseExpiry || "",
        hourlyRate: payload.hourlyRate,
        availability: payload.availability || record.status,
        currentJobId: payload.currentJobId,
      }),
    ],
  );
  await client.query(
    `UPDATE contacts
     SET status = 'active', updated_at = now()
     WHERE id = $1 AND account_id = $2`,
    [contactId, record.account_id],
  );
  if (email) {
    await client.query(
      `DELETE FROM contact_methods
       WHERE account_id = $1
         AND contact_id = $2
         AND kind = 'email'
         AND is_primary`,
      [record.account_id, contactId],
    );
    await client.query(
      `INSERT INTO contact_methods (
         contact_id, account_id, kind, label, value, normalized_value,
         is_primary
       ) VALUES ($1, $2, 'email', 'work', $3, $4, true)
       ON CONFLICT (contact_id, kind, normalized_value) DO UPDATE SET
         label = EXCLUDED.label,
         value = EXCLUDED.value,
         is_primary = true,
         updated_at = now()`,
      [contactId, record.account_id, email, email],
    );
  }
  if (normalizedPhone) {
    await client.query(
      `DELETE FROM contact_methods
       WHERE account_id = $1
         AND contact_id = $2
         AND kind = 'phone'
         AND is_primary`,
      [record.account_id, contactId],
    );
    await client.query(
      `INSERT INTO contact_methods (
         contact_id, account_id, kind, label, value, normalized_value,
         is_primary
       ) VALUES ($1, $2, 'phone', 'mobile', $3, $4, true)
       ON CONFLICT (contact_id, kind, normalized_value) DO UPDATE SET
         label = EXCLUDED.label,
         value = EXCLUDED.value,
         is_primary = true,
         updated_at = now()`,
      [contactId, record.account_id, phone, normalizedPhone],
    );
  }
  return contactId;
}

export async function removeContactRoleForNetworkRecord(client, record) {
  if (record.record_type !== "crew_member" || !record.contact_id) return;
  const role = record.payload?.type === "sub" ? "subcontractor" : "crew";
  await client.query(
    `DELETE FROM contact_roles
     WHERE contact_id = $1
       AND account_id = $2
       AND role = $3`,
    [record.contact_id, record.account_id, role],
  );
  await client.query(
    `UPDATE contacts contact
     SET status = CASE
           WHEN EXISTS (
             SELECT 1
             FROM contact_roles remaining
             WHERE remaining.contact_id = contact.id
           ) THEN contact.status
           ELSE 'archived'
         END,
         updated_at = now()
     WHERE contact.id = $1
       AND contact.account_id = $2`,
    [record.contact_id, record.account_id],
  );
}

function mapContactActivity(row) {
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

function mapContactJobLink(row) {
  return {
    id: row.link_id,
    relationshipRole: row.relationship_role,
    notes: row.link_notes || "",
    isPrimary: Boolean(row.link_is_primary),
    createdAt: row.link_created_at ? new Date(row.link_created_at).toISOString() : null,
    updatedAt: row.link_updated_at ? new Date(row.link_updated_at).toISOString() : null,
    contact: mapContact(row),
  };
}

async function assertJobContactAccess(client, accountId, jobId) {
  const result = await client.query(
    `SELECT job.id
     FROM jobs job
     WHERE job.id = $1
       AND (
         job.created_by_account_id = $2
         OR EXISTS (
           SELECT 1
           FROM active_work work
           WHERE work.job_id = job.id
             AND (
               work.contractor_account_id = $2
               OR work.tradesperson_account_id = $2
             )
         )
       )`,
    [jobId, accountId],
  );
  if (!result.rowCount) {
    throw new ApiError(404, "JOB_NOT_FOUND", "That job is not available to this account.");
  }
}

async function readJobContactLink(client, accountId, jobId, linkId) {
  const result = await client.query(
    `SELECT
       link.id AS link_id,
       link.relationship_role,
       link.notes AS link_notes,
       link.is_primary AS link_is_primary,
       link.created_at AS link_created_at,
       link.updated_at AS link_updated_at,
       contact_row.*
     FROM contact_job_links link
     INNER JOIN LATERAL (
       ${contactProjectionSql}
       WHERE contact.id = link.contact_id
         AND contact.account_id = link.account_id
     ) contact_row ON true
     WHERE link.account_id = $1
       AND link.job_id = $2
       AND link.id = $3`,
    [accountId, jobId, linkId],
  );
  return result.rows[0] ? mapContactJobLink(result.rows[0]) : null;
}

export function registerContactRoutes({
  app,
  database,
  requireV1AuthenticatedUser,
  requireV1Actor,
  writeRateLimit,
  runIdempotentMutation,
  sendIdempotentResult,
}) {
  app.get("/api/v1/contacts", requireV1AuthenticatedUser, requireV1Actor, asyncRoute(async (request, response) => {
    const input = validate(contactListSchema, request.query);
    const params = [request.actor.account.id];
    const filters = [];
    if (input.status !== "all") {
      params.push(input.status);
      filters.push(`contact.status = $${params.length}`);
    }
    if (input.role) {
      params.push(input.role);
      filters.push(`EXISTS (
        SELECT 1 FROM contact_roles filter_role
        WHERE filter_role.contact_id = contact.id
          AND filter_role.role = $${params.length}
          AND filter_role.status = 'active'
      )`);
    }
    if (input.q) {
      params.push(`%${input.q}%`);
      filters.push(`(
        contact.name ILIKE $${params.length}
        OR contact.company ILIKE $${params.length}
        OR EXISTS (
          SELECT 1 FROM contact_methods filter_method
          WHERE filter_method.contact_id = contact.id
            AND filter_method.value ILIKE $${params.length}
        )
        OR EXISTS (
          SELECT 1 FROM contact_tags filter_tag
          WHERE filter_tag.contact_id = contact.id
            AND filter_tag.tag ILIKE $${params.length}
        )
      )`);
    }
    params.push(input.limit);
    const result = await database.query(
      `${contactProjectionSql}
       WHERE contact.account_id = $1
         ${filters.length ? `AND ${filters.join(" AND ")}` : ""}
       ORDER BY
         contact.favorite DESC,
         contact.last_used_at DESC NULLS LAST,
         contact.updated_at DESC,
         contact.id DESC
       LIMIT $${params.length}`,
      params,
    );
    response.json({
      data: { contacts: result.rows.map(mapContact) },
      meta: { requestId: request.requestId },
    });
  }));

  app.get("/api/v1/contacts/:id", requireV1AuthenticatedUser, requireV1Actor, asyncRoute(async (request, response) => {
    const contactId = validate(z.uuid(), request.params.id);
    const contact = await readContact(database, request.actor.account.id, contactId);
    if (!contact) {
      throw new ApiError(404, "CONTACT_NOT_FOUND", "That contact does not exist.");
    }
    response.json({
      data: { contact },
      meta: { requestId: request.requestId },
    });
  }));

  app.post("/api/v1/contacts", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
    const input = validate(contactCreateSchema, request.body);
    const result = await runIdempotentMutation(
      request,
      request.actor.account.id,
      "contacts.create",
      async (client) => {
        await assertNoDuplicateMethods(client, request.actor.account.id, input.methods);
        const created = await client.query(
          `INSERT INTO contacts (
             account_id, entity_type, name, company, notes, favorite, status
           ) VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id`,
          [
            request.actor.account.id,
            input.entityType,
            input.name,
            input.company,
            input.notes,
            input.favorite,
            input.status,
          ],
        );
        const contactId = created.rows[0].id;
        await replaceContactParts(client, request.actor.account.id, contactId, input);
        const contact = await syncCompatibilityProjections(
          client,
          request.actor.account.id,
          contactId,
        );
        return {
          status: 201,
          body: {
            data: { contact },
            meta: { requestId: request.requestId },
          },
        };
      },
    );
    sendIdempotentResult(response, result);
  }));

  app.put("/api/v1/contacts/:id", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
    const contactId = validate(z.uuid(), request.params.id);
    const input = validate(contactUpdateSchema, request.body);
    const result = await runIdempotentMutation(
      request,
      request.actor.account.id,
      `contacts.update:${contactId}`,
      async (client) => {
        const current = await readContact(client, request.actor.account.id, contactId);
        if (!current) {
          throw new ApiError(404, "CONTACT_NOT_FOUND", "That contact does not exist.");
        }
        const nextMethods = input.methods ?? current.methods;
        await assertNoDuplicateMethods(
          client,
          request.actor.account.id,
          nextMethods,
          contactId,
        );
        await client.query(
          `UPDATE contacts
           SET entity_type = COALESCE($3, entity_type),
               name = COALESCE($4, name),
               company = COALESCE($5, company),
               notes = COALESCE($6, notes),
               favorite = COALESCE($7, favorite),
               status = COALESCE($8, status),
               updated_at = now()
           WHERE id = $1 AND account_id = $2`,
          [
            contactId,
            request.actor.account.id,
            input.entityType ?? null,
            input.name ?? null,
            input.company ?? null,
            input.notes ?? null,
            input.favorite ?? null,
            input.status ?? null,
          ],
        );
        await replaceContactParts(client, request.actor.account.id, contactId, input);
        const contact = await syncCompatibilityProjections(
          client,
          request.actor.account.id,
          contactId,
        );
        return {
          status: 200,
          body: {
            data: { contact },
            meta: { requestId: request.requestId },
          },
        };
      },
    );
    sendIdempotentResult(response, result);
  }));

  app.post("/api/v1/contacts/:id/used", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
    const contactId = validate(z.uuid(), request.params.id);
    const result = await runIdempotentMutation(
      request,
      request.actor.account.id,
      `contacts.used:${contactId}`,
      async (client) => {
        const updated = await client.query(
          `UPDATE contacts
           SET last_used_at = now(), updated_at = now()
           WHERE id = $1 AND account_id = $2
           RETURNING id`,
          [contactId, request.actor.account.id],
        );
        if (!updated.rowCount) {
          throw new ApiError(404, "CONTACT_NOT_FOUND", "That contact does not exist.");
        }
        const contact = await syncCompatibilityProjections(
          client,
          request.actor.account.id,
          contactId,
        );
        return {
          status: 200,
          body: {
            data: { contact },
            meta: { requestId: request.requestId },
          },
        };
      },
    );
    sendIdempotentResult(response, result);
  }));

  app.get("/api/v1/jobs/:jobId/contacts", requireV1AuthenticatedUser, requireV1Actor, asyncRoute(async (request, response) => {
    const jobId = validate(z.uuid(), request.params.jobId);
    await assertJobContactAccess(database, request.actor.account.id, jobId);
    const result = await database.query(
      `SELECT
         link.id AS link_id,
         link.relationship_role,
         link.notes AS link_notes,
         link.is_primary AS link_is_primary,
         link.created_at AS link_created_at,
         link.updated_at AS link_updated_at,
         contact_row.*
       FROM contact_job_links link
       INNER JOIN LATERAL (
         ${contactProjectionSql}
         WHERE contact.id = link.contact_id
           AND contact.account_id = link.account_id
       ) contact_row ON true
       WHERE link.account_id = $1
         AND link.job_id = $2
       ORDER BY
         link.is_primary DESC,
         lower(link.relationship_role),
         lower(contact_row.company),
         lower(contact_row.name),
         link.id`,
      [request.actor.account.id, jobId],
    );
    response.json({
      data: { links: result.rows.map(mapContactJobLink) },
      meta: { requestId: request.requestId },
    });
  }));

  app.post("/api/v1/jobs/:jobId/contacts", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
    const jobId = validate(z.uuid(), request.params.jobId);
    const input = validate(jobContactLinkSchema, request.body);
    const result = await runIdempotentMutation(
      request,
      request.actor.account.id,
      `contacts.job-link:${jobId}:${input.contactId}:${input.relationshipRole}`,
      async (client) => {
        await assertJobContactAccess(client, request.actor.account.id, jobId);
        const ownedContact = await client.query(
          `SELECT id
           FROM contacts
           WHERE id = $1
             AND account_id = $2
             AND status = 'active'`,
          [input.contactId, request.actor.account.id],
        );
        if (!ownedContact.rowCount) {
          throw new ApiError(404, "CONTACT_NOT_FOUND", "That active contact does not exist.");
        }
        if (input.isPrimary) {
          await client.query(
            `UPDATE contact_job_links
             SET is_primary = false, updated_at = now()
             WHERE account_id = $1
               AND job_id = $2
               AND lower(relationship_role) = lower($3)`,
            [request.actor.account.id, jobId, input.relationshipRole],
          );
        }
        const saved = await client.query(
          `INSERT INTO contact_job_links (
             account_id, contact_id, job_id, relationship_role, notes, is_primary
           ) VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (account_id, contact_id, job_id, relationship_role)
           DO UPDATE SET
             notes = EXCLUDED.notes,
             is_primary = EXCLUDED.is_primary,
             updated_at = now()
           RETURNING id`,
          [
            request.actor.account.id,
            input.contactId,
            jobId,
            input.relationshipRole,
            input.notes,
            input.isPrimary,
          ],
        );
        const link = await readJobContactLink(
          client,
          request.actor.account.id,
          jobId,
          saved.rows[0].id,
        );
        return {
          status: 200,
          body: {
            data: { link },
            meta: { requestId: request.requestId },
          },
        };
      },
    );
    sendIdempotentResult(response, result);
  }));

  app.delete("/api/v1/jobs/:jobId/contacts/:linkId", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
    const jobId = validate(z.uuid(), request.params.jobId);
    const linkId = validate(z.uuid(), request.params.linkId);
    const result = await runIdempotentMutation(
      request,
      request.actor.account.id,
      `contacts.job-unlink:${jobId}:${linkId}`,
      async (client) => {
        await assertJobContactAccess(client, request.actor.account.id, jobId);
        const removed = await client.query(
          `DELETE FROM contact_job_links
           WHERE id = $1
             AND job_id = $2
             AND account_id = $3
           RETURNING id`,
          [linkId, jobId, request.actor.account.id],
        );
        if (!removed.rowCount) {
          throw new ApiError(404, "CONTACT_LINK_NOT_FOUND", "That job contact link does not exist.");
        }
        return {
          status: 200,
          body: {
            data: { deleted: true },
            meta: { requestId: request.requestId },
          },
        };
      },
    );
    sendIdempotentResult(response, result);
  }));

  app.get("/api/v1/contacts/:id/activity", requireV1AuthenticatedUser, requireV1Actor, asyncRoute(async (request, response) => {
    const contactId = validate(z.uuid(), request.params.id);
    const owned = await database.query(
      "SELECT 1 FROM contacts WHERE id = $1 AND account_id = $2",
      [contactId, request.actor.account.id],
    );
    if (!owned.rowCount) {
      throw new ApiError(404, "CONTACT_NOT_FOUND", "That contact does not exist.");
    }
    const activity = await database.query(
      `SELECT *
       FROM (
         SELECT
           record.id,
           'document'::text AS kind,
           record.title,
           record.status,
           COALESCE(record.updated_at, record.created_at) AS activity_date,
           record.amount_cents,
           record.record_type,
           record.local_id
         FROM tool_records record
         INNER JOIN customers customer ON customer.id = record.customer_id
         WHERE customer.account_id = $1
           AND customer.contact_id = $2
           AND record.deleted_at IS NULL
         UNION ALL
         SELECT
           project.id,
           'project'::text AS kind,
           project.title,
           project.status,
           COALESCE(project.updated_at, project.created_at) AS activity_date,
           NULL::integer AS amount_cents,
           NULL::text AS record_type,
           NULL::text AS local_id
         FROM standalone_projects project
         INNER JOIN customers customer ON customer.id = project.customer_id
         WHERE customer.account_id = $1
           AND customer.contact_id = $2
         UNION ALL
         SELECT
           job.id,
           'job'::text AS kind,
           job.title,
           job.status,
           COALESCE(link.updated_at, link.created_at) AS activity_date,
           job.budget_cents AS amount_cents,
           NULL::text AS record_type,
           NULL::text AS local_id
         FROM contact_job_links link
         INNER JOIN jobs job ON job.id = link.job_id
         WHERE link.account_id = $1
           AND link.contact_id = $2
       ) contact_activity
       ORDER BY activity_date DESC, id DESC
       LIMIT 150`,
      [request.actor.account.id, contactId],
    );
    response.json({
      data: { activity: activity.rows.map(mapContactActivity) },
      meta: { requestId: request.requestId },
    });
  }));
}

export const contactInternals = {
  normalizeMethod,
  mapContact,
};
