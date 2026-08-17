import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";
import { ApiError, asyncRoute, validate, z } from "./api.js";

const visibilitySchema = z.enum(["private", "network"]);
const recordStatusSchema = z.enum(["active", "archived"]);
const credentialKindSchema = z.enum(["license", "certification", "training", "insurance", "other"]);
const availabilitySchema = z.enum(["available", "limited", "unavailable"]);
const dateSchema = z.string().date();
const optionalDateSchema = z.union([dateSchema, z.literal(""), z.null()]).transform((value) => value || null);

export const credentialCreateSchema = z.object({
  kind: credentialKindSchema,
  name: z.string().trim().min(1).max(160),
  issuer: z.string().trim().max(160).default(""),
  credentialNumber: z.string().trim().max(120).default(""),
  issueDate: optionalDateSchema.default(null),
  expiryDate: optionalDateSchema.default(null),
  notes: z.string().trim().max(1000).default(""),
  visibility: visibilitySchema.default("private"),
}).refine(
  ({ issueDate, expiryDate }) => !issueDate || !expiryDate || expiryDate >= issueDate,
  { message: "Expiry date must be on or after the issue date.", path: ["expiryDate"] },
);

export const credentialUpdateSchema = credentialCreateSchema.extend({
  expectedVersion: z.number().int().positive(),
});

export const availabilityWindowCreateSchema = z.object({
  availability: availabilitySchema,
  startsOn: dateSchema,
  endsOn: dateSchema,
  notes: z.string().trim().max(500).default(""),
  visibility: visibilitySchema.default("network"),
}).refine(
  ({ startsOn, endsOn }) => endsOn >= startsOn,
  { message: "End date must be on or after the start date.", path: ["endsOn"] },
).refine(
  ({ startsOn, endsOn }) => {
    const duration = new Date(`${endsOn}T00:00:00Z`).getTime() - new Date(`${startsOn}T00:00:00Z`).getTime();
    return duration <= 366 * 24 * 60 * 60 * 1000;
  },
  { message: "Availability windows can span no more than 366 days.", path: ["endsOn"] },
);

export const availabilityWindowUpdateSchema = availabilityWindowCreateSchema.extend({
  expectedVersion: z.number().int().positive(),
});

export const portfolioUpdateSchema = z.object({
  expectedVersion: z.number().int().positive(),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1500).default(""),
  tradeCode: z.string().trim().min(1).max(80).nullable().default(null),
  projectLabel: z.string().trim().max(160).default(""),
  serviceAreaCity: z.string().trim().max(100).default(""),
  serviceAreaRegion: z.string().trim().max(100).default(""),
  completedOn: optionalDateSchema.default(null),
  visibility: visibilitySchema.default("private"),
  sortOrder: z.number().int().min(0).max(10000).default(0),
});

const versionSchema = z.object({ expectedVersion: z.number().int().positive() });
const accountIdSchema = z.uuid();
const recordIdSchema = z.uuid();

function exifPayloadHasGps(payload) {
  if (!Buffer.isBuffer(payload) || payload.length < 8) return false;
  let start = 0;
  if (payload.subarray(0, 6).equals(Buffer.from("Exif\0\0", "binary"))) start = 6;
  if (payload.length - start < 8) return false;
  const littleEndian = payload[start] === 0x49 && payload[start + 1] === 0x49;
  const bigEndian = payload[start] === 0x4d && payload[start + 1] === 0x4d;
  if (!littleEndian && !bigEndian) return false;
  const readUInt16 = (offset) => littleEndian
    ? payload.readUInt16LE(offset)
    : payload.readUInt16BE(offset);
  const readUInt32 = (offset) => littleEndian
    ? payload.readUInt32LE(offset)
    : payload.readUInt32BE(offset);
  if (readUInt16(start + 2) !== 42) return false;
  const ifdOffset = readUInt32(start + 4);
  const ifdStart = start + ifdOffset;
  if (ifdStart < start || ifdStart + 2 > payload.length) return false;
  const entryCount = Math.min(readUInt16(ifdStart), 512);
  for (let index = 0; index < entryCount; index += 1) {
    const entryOffset = ifdStart + 2 + (index * 12);
    if (entryOffset + 12 > payload.length) return false;
    if (readUInt16(entryOffset) === 0x8825 && readUInt32(entryOffset + 8) !== 0) return true;
  }
  return false;
}

function imageHasEmbeddedGps(file) {
  const buffer = file?.buffer;
  if (!Buffer.isBuffer(buffer)) return false;
  if (file.mimetype === "image/jpeg" && buffer.length >= 4) {
    let offset = 2;
    while (offset + 4 <= buffer.length) {
      if (buffer[offset] !== 0xff) break;
      const marker = buffer[offset + 1];
      if (marker === 0xda || marker === 0xd9) break;
      const segmentLength = buffer.readUInt16BE(offset + 2);
      if (segmentLength < 2 || offset + 2 + segmentLength > buffer.length) break;
      if (marker === 0xe1 && exifPayloadHasGps(buffer.subarray(offset + 4, offset + 2 + segmentLength))) return true;
      offset += 2 + segmentLength;
    }
  }
  if (file.mimetype === "image/png" && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    let offset = 8;
    while (offset + 12 <= buffer.length) {
      const chunkLength = buffer.readUInt32BE(offset);
      const type = buffer.subarray(offset + 4, offset + 8).toString("ascii");
      const dataStart = offset + 8;
      const dataEnd = dataStart + chunkLength;
      if (dataEnd + 4 > buffer.length) break;
      if (type === "eXIf" && exifPayloadHasGps(buffer.subarray(dataStart, dataEnd))) return true;
      if (type === "IEND") break;
      offset = dataEnd + 4;
    }
  }
  if (file.mimetype === "image/webp" && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") {
    let offset = 12;
    while (offset + 8 <= buffer.length) {
      const type = buffer.subarray(offset, offset + 4).toString("ascii");
      const chunkLength = buffer.readUInt32LE(offset + 4);
      const dataStart = offset + 8;
      const dataEnd = dataStart + chunkLength;
      if (dataEnd > buffer.length) break;
      if (type === "EXIF" && exifPayloadHasGps(buffer.subarray(dataStart, dataEnd))) return true;
      offset = dataEnd + (chunkLength % 2);
    }
  }
  return false;
}

function rejectEmbeddedGps(file) {
  if (imageHasEmbeddedGps(file)) {
    throw new ApiError(
      422,
      "PROFILE_IMAGE_LOCATION_METADATA",
      "This photo contains embedded GPS location data. Remove location metadata or use a screenshot, then upload it again.",
    );
  }
}

function isoDate(value) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

function isoTimestamp(value) {
  return value ? new Date(value).toISOString() : null;
}

function mapCredential(row, evidenceUrl = null) {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    issuer: row.issuer,
    credentialNumber: row.credential_number,
    issueDate: isoDate(row.issue_date),
    expiryDate: isoDate(row.expiry_date),
    notes: row.notes,
    evidenceState: row.evidence_state,
    evidenceUploadId: row.evidence_upload_id ?? null,
    evidenceUrl,
    visibility: row.visibility,
    status: row.status,
    version: row.version,
    archivedAt: isoTimestamp(row.archived_at),
    createdAt: isoTimestamp(row.created_at),
    updatedAt: isoTimestamp(row.updated_at),
  };
}

function mapAvailabilityWindow(row) {
  return {
    id: row.id,
    availability: row.availability,
    startsOn: isoDate(row.starts_on),
    endsOn: isoDate(row.ends_on),
    notes: row.notes,
    visibility: row.visibility,
    status: row.status,
    version: row.version,
    archivedAt: isoTimestamp(row.archived_at),
    createdAt: isoTimestamp(row.created_at),
    updatedAt: isoTimestamp(row.updated_at),
  };
}

function mapPortfolioItem(row, imageUrl = null) {
  return {
    id: row.id,
    uploadId: row.upload_id,
    title: row.title,
    description: row.description,
    tradeCode: row.trade_code ?? null,
    tradeName: row.trade_name ?? null,
    projectLabel: row.project_label,
    serviceAreaCity: row.service_area_city,
    serviceAreaRegion: row.service_area_region,
    completedOn: isoDate(row.completed_on),
    visibility: row.visibility,
    status: row.status,
    sortOrder: row.sort_order,
    version: row.version,
    imageUrl,
    imageAlt: row.title,
    archivedAt: isoTimestamp(row.archived_at),
    createdAt: isoTimestamp(row.created_at),
    updatedAt: isoTimestamp(row.updated_at),
  };
}

function mapEvent(row) {
  return {
    id: row.id,
    subjectType: row.subject_type,
    subjectId: row.subject_id,
    action: row.action,
    fromVersion: row.from_version,
    toVersion: row.to_version,
    metadata: row.metadata ?? {},
    createdAt: isoTimestamp(row.created_at),
  };
}

async function insertEvent(client, {
  accountId,
  actorAccountId,
  subjectType,
  subjectId,
  action,
  fromVersion = null,
  toVersion = null,
  metadata = {},
}) {
  await client.query(
    `INSERT INTO professional_profile_events (
       account_id, actor_account_id, subject_type, subject_id, action,
       from_version, to_version, metadata
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
    [accountId, actorAccountId, subjectType, String(subjectId), action, fromVersion, toVersion, JSON.stringify(metadata)],
  );
}

async function assertTradeCode(client, tradeCode) {
  if (!tradeCode) return;
  const result = await client.query("SELECT code FROM trades WHERE code = $1 AND active = true", [tradeCode]);
  if (!result.rowCount) throw new ApiError(422, "TRADE_INVALID", "Choose an available RIVT trade.");
}

async function signedUrlForRow(signedObjectUrl, row) {
  if (!row?.object_key) return null;
  return signedObjectUrl(row.object_key).catch(() => null);
}

async function loadOwnProfessionalProfile(database, accountId, signedObjectUrl) {
  const [profileResult, credentialResult, availabilityResult, portfolioResult, eventResult] = await Promise.all([
    database.query(
      `SELECT p.avatar_upload_id, upload.object_key AS avatar_object_key
       FROM profiles p
       LEFT JOIN uploads upload
         ON upload.id = p.avatar_upload_id
        AND upload.account_id = p.account_id
        AND upload.kind = 'profile-avatar'
        AND upload.upload_status = 'stored'
       WHERE p.account_id = $1`,
      [accountId],
    ),
    database.query(
      `SELECT credential.*, upload.object_key AS evidence_object_key
       FROM profile_credentials credential
       LEFT JOIN uploads upload
         ON upload.id = credential.evidence_upload_id
        AND upload.account_id = credential.account_id
        AND upload.kind = 'profile-credential-evidence'
        AND upload.upload_status = 'stored'
       WHERE credential.account_id = $1
       ORDER BY (credential.status = 'active') DESC, credential.updated_at DESC, credential.id`,
      [accountId],
    ),
    database.query(
      `SELECT * FROM profile_availability_windows
       WHERE account_id = $1
       ORDER BY (status = 'active') DESC, starts_on, ends_on, id`,
      [accountId],
    ),
    database.query(
      `SELECT item.*, trade.name AS trade_name, upload.object_key
       FROM profile_portfolio_items item
       LEFT JOIN trades trade ON trade.code = item.trade_code
       INNER JOIN uploads upload
         ON upload.id = item.upload_id
        AND upload.account_id = item.account_id
        AND upload.kind = 'profile-portfolio'
       WHERE item.account_id = $1
       ORDER BY (item.status = 'active') DESC, item.sort_order, item.updated_at DESC, item.id`,
      [accountId],
    ),
    database.query(
      `SELECT * FROM professional_profile_events
       WHERE account_id = $1
       ORDER BY created_at DESC, id DESC
       LIMIT 250`,
      [accountId],
    ),
  ]);

  const profileRow = profileResult.rows[0] ?? {};
  const avatarUrl = await signedUrlForRow(signedObjectUrl, { object_key: profileRow.avatar_object_key });
  return {
    avatarUploadId: profileRow.avatar_upload_id ?? null,
    avatarUrl,
    credentials: await Promise.all(credentialResult.rows.map(async (row) => (
      mapCredential(row, await signedUrlForRow(signedObjectUrl, { object_key: row.evidence_object_key }))
    ))),
    availabilityWindows: availabilityResult.rows.map(mapAvailabilityWindow),
    portfolioItems: await Promise.all(portfolioResult.rows.map(async (row) => (
      mapPortfolioItem(row, await signedUrlForRow(signedObjectUrl, row))
    ))),
    events: eventResult.rows.map(mapEvent),
  };
}

async function loadNetworkProfile(database, viewerAccountId, subjectAccountId, signedObjectUrl) {
  const profileResult = await database.query(
    `SELECT p.account_id, a.primary_role, p.display_name, p.headline, p.bio,
            p.location_text, p.service_area_city, p.service_area_region,
            p.service_radius_miles, p.availability_status, p.avatar_upload_id,
            avatar.object_key AS avatar_object_key,
            COALESCE(
              jsonb_agg(
                DISTINCT jsonb_build_object(
                  'code', trade.code,
                  'name', trade.name,
                  'primary', profile_trade.is_primary
                )
              ) FILTER (WHERE trade.code IS NOT NULL),
              '[]'::jsonb
            ) AS trades
     FROM profiles p
     INNER JOIN accounts a ON a.id = p.account_id
     LEFT JOIN profile_trades profile_trade ON profile_trade.account_id = p.account_id
     LEFT JOIN trades trade ON trade.code = profile_trade.trade_code AND trade.active = true
     LEFT JOIN uploads avatar
       ON avatar.id = p.avatar_upload_id
      AND avatar.account_id = p.account_id
      AND avatar.kind = 'profile-avatar'
      AND avatar.upload_status = 'stored'
     WHERE p.account_id = $2
       AND p.visibility = 'network'
       AND p.onboarding_status = 'complete'
       AND a.status = 'active'
       AND a.primary_role IN ('contractor', 'tradesperson')
       AND NOT EXISTS (
         SELECT 1 FROM account_blocks block
         WHERE (block.blocker_account_id = $1 AND block.blocked_account_id = $2)
            OR (block.blocked_account_id = $1 AND block.blocker_account_id = $2)
       )
     GROUP BY p.account_id, a.primary_role, p.display_name, p.headline, p.bio,
              p.location_text, p.service_area_city, p.service_area_region,
              p.service_radius_miles, p.availability_status, p.avatar_upload_id,
              avatar.object_key`,
    [viewerAccountId, subjectAccountId],
  );
  if (!profileResult.rowCount) throw new ApiError(404, "PROFILE_NOT_FOUND", "Published profile not found.");
  const row = profileResult.rows[0];

  const [rates, credentials, windows, portfolio] = await Promise.all([
    database.query(
      `SELECT rate.trade_code, trade.name AS trade_name, rate.hourly_rate_cents,
              rate.day_rate_cents, rate.minimum_charge_cents, rate.notes
       FROM profile_rate_cards rate
       INNER JOIN trades trade ON trade.code = rate.trade_code AND trade.active = true
       WHERE rate.account_id = $1 AND rate.visibility = 'network'
       ORDER BY trade.sort_order, rate.trade_code`,
      [subjectAccountId],
    ),
    database.query(
      `SELECT * FROM profile_credentials
       WHERE account_id = $1 AND status = 'active' AND visibility = 'network'
       ORDER BY updated_at DESC, id`,
      [subjectAccountId],
    ),
    database.query(
      `SELECT * FROM profile_availability_windows
       WHERE account_id = $1 AND status = 'active' AND visibility = 'network'
         AND ends_on >= CURRENT_DATE
       ORDER BY starts_on, ends_on, id
       LIMIT 24`,
      [subjectAccountId],
    ),
    database.query(
      `SELECT item.*, trade.name AS trade_name, upload.object_key
       FROM profile_portfolio_items item
       LEFT JOIN trades trade ON trade.code = item.trade_code
       INNER JOIN uploads upload
         ON upload.id = item.upload_id
        AND upload.account_id = item.account_id
        AND upload.kind = 'profile-portfolio'
        AND upload.upload_status = 'stored'
       WHERE item.account_id = $1 AND item.status = 'active' AND item.visibility = 'network'
       ORDER BY item.sort_order, item.updated_at DESC, item.id
       LIMIT 24`,
      [subjectAccountId],
    ),
  ]);

  return {
    accountId: row.account_id,
    displayName: row.display_name,
    headline: row.headline,
    bio: row.bio,
    primaryRole: row.primary_role,
    locationText: row.location_text,
    serviceArea: {
      city: row.service_area_city,
      region: row.service_area_region,
      radiusMiles: row.service_radius_miles,
    },
    availabilityStatus: row.availability_status,
    avatarUrl: await signedUrlForRow(signedObjectUrl, { object_key: row.avatar_object_key }),
    trades: Array.isArray(row.trades)
      ? row.trades.sort((a, b) => Number(Boolean(b.primary)) - Number(Boolean(a.primary)) || String(a.name).localeCompare(String(b.name)))
      : [],
    rateCards: rates.rows.map((rate) => ({
      tradeCode: rate.trade_code,
      tradeName: rate.trade_name,
      hourlyRateCents: rate.hourly_rate_cents,
      dayRateCents: rate.day_rate_cents,
      minimumChargeCents: rate.minimum_charge_cents,
      notes: rate.notes,
    })),
    credentials: credentials.rows.map((credential) => ({
      ...mapCredential(credential),
      evidenceUploadId: null,
      evidenceUrl: null,
    })),
    availabilityWindows: windows.rows.map(mapAvailabilityWindow),
    portfolioItems: await Promise.all(portfolio.rows.map(async (item) => (
      mapPortfolioItem(item, await signedUrlForRow(signedObjectUrl, item))
    ))),
  };
}

async function currentRecord(client, table, accountId, recordId, { activeOnly = false } = {}) {
  const result = await client.query(
    `SELECT * FROM ${table} WHERE id = $1 AND account_id = $2${activeOnly ? " AND status = 'active'" : ""} FOR UPDATE`,
    [recordId, accountId],
  );
  if (!result.rowCount) throw new ApiError(404, "PROFILE_RECORD_NOT_FOUND", "Professional profile record not found.");
  return result.rows[0];
}

function assertVersion(row, expectedVersion) {
  if (row.version !== expectedVersion) {
    throw new ApiError(409, "PROFILE_RECORD_CONFLICT", "This profile record changed on another device. Reload and try again.", {
      currentVersion: row.version,
    });
  }
}

async function archiveOrRestore({
  request,
  response,
  table,
  subjectType,
  action,
  targetStatus,
  database,
  withTransaction,
}) {
  const recordId = validate(recordIdSchema, request.params.id);
  const input = validate(versionSchema, request.body);
  const accountId = request.actor.account.id;
  const row = await withTransaction(async (client) => {
    const current = await currentRecord(client, table, accountId, recordId);
    assertVersion(current, input.expectedVersion);
    if (current.status === targetStatus) return current;
    const next = await client.query(
      `UPDATE ${table}
       SET status = $3,
           archived_at = CASE WHEN $3 = 'archived' THEN now() ELSE NULL END,
           version = version + 1,
           updated_at = now()
       WHERE id = $1 AND account_id = $2
       RETURNING *`,
      [recordId, accountId, targetStatus],
    );
    await insertEvent(client, {
      accountId,
      actorAccountId: accountId,
      subjectType,
      subjectId: recordId,
      action,
      fromVersion: current.version,
      toVersion: next.rows[0].version,
    });
    return next.rows[0];
  });
  response.json({ data: { record: row }, meta: { requestId: request.requestId } });
}

export function registerProfessionalProfileRoutes({
  app,
  database,
  requireV1AuthenticatedUser,
  requireV1Actor,
  writeRateLimit,
  uploadRateLimit,
  upload,
  applicationObjectMutationBarrier,
  sha256Buffer,
  detectUploadContent,
  signedObjectUrl,
  safeObjectName,
  s3Client,
  s3Bucket,
  withTransaction,
  runIdempotentMutation,
  sendIdempotentResult,
}) {
  app.get("/api/v1/profile/professional", requireV1AuthenticatedUser, requireV1Actor, asyncRoute(async (request, response) => {
    const professionalProfile = await loadOwnProfessionalProfile(database, request.actor.account.id, signedObjectUrl);
    response.json({ data: { professionalProfile }, meta: { requestId: request.requestId } });
  }));

  app.get("/api/v1/profiles/:accountId", requireV1AuthenticatedUser, requireV1Actor, asyncRoute(async (request, response) => {
    const subjectAccountId = validate(accountIdSchema, request.params.accountId);
    const profile = await loadNetworkProfile(
      database,
      request.actor.account.id,
      subjectAccountId,
      signedObjectUrl,
    );
    response.json({ data: { profile }, meta: { requestId: request.requestId } });
  }));

  app.post("/api/v1/profile/credentials", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
    const input = validate(credentialCreateSchema, request.body);
    const accountId = request.actor.account.id;
    const result = await runIdempotentMutation(request, accountId, "profile.credentials.create", async (client) => {
      const id = randomUUID();
      const inserted = await client.query(
        `INSERT INTO profile_credentials (
           id, account_id, kind, name, issuer, credential_number, issue_date,
           expiry_date, notes, visibility
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [id, accountId, input.kind, input.name, input.issuer, input.credentialNumber,
          input.issueDate, input.expiryDate, input.notes, input.visibility],
      );
      await insertEvent(client, {
        accountId,
        actorAccountId: accountId,
        subjectType: "credential",
        subjectId: id,
        action: "created",
        toVersion: 1,
        metadata: { kind: input.kind, visibility: input.visibility },
      });
      return {
        status: 201,
        body: { data: { credential: mapCredential(inserted.rows[0]) }, meta: { requestId: request.requestId } },
      };
    });
    sendIdempotentResult(response, result);
  }));

  app.patch("/api/v1/profile/credentials/:id", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
    const credentialId = validate(recordIdSchema, request.params.id);
    const input = validate(credentialUpdateSchema, request.body);
    const accountId = request.actor.account.id;
    const credential = await withTransaction(async (client) => {
      const current = await currentRecord(client, "profile_credentials", accountId, credentialId, { activeOnly: true });
      assertVersion(current, input.expectedVersion);
      const updated = await client.query(
        `UPDATE profile_credentials
         SET kind = $3, name = $4, issuer = $5, credential_number = $6,
             issue_date = $7, expiry_date = $8, notes = $9, visibility = $10,
             version = version + 1, updated_at = now()
         WHERE id = $1 AND account_id = $2
         RETURNING *`,
        [credentialId, accountId, input.kind, input.name, input.issuer, input.credentialNumber,
          input.issueDate, input.expiryDate, input.notes, input.visibility],
      );
      await insertEvent(client, {
        accountId,
        actorAccountId: accountId,
        subjectType: "credential",
        subjectId: credentialId,
        action: "updated",
        fromVersion: current.version,
        toVersion: updated.rows[0].version,
        metadata: { visibility: input.visibility },
      });
      return updated.rows[0];
    });
    response.json({ data: { credential: mapCredential(credential) }, meta: { requestId: request.requestId } });
  }));

  app.post(
    "/api/v1/profile/credentials/:id/evidence",
    requireV1AuthenticatedUser,
    requireV1Actor,
    uploadRateLimit,
    upload.single("file"),
    asyncRoute(applicationObjectMutationBarrier(async (request, response) => {
      const credentialId = validate(recordIdSchema, request.params.id);
      const expectedVersion = validate(z.coerce.number().int().positive(), request.body?.expectedVersion);
      if (!request.file) throw new ApiError(400, "CREDENTIAL_EVIDENCE_REQUIRED", "Choose an image or PDF to upload.");
      if (!["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(request.file.mimetype)) {
        throw new ApiError(415, "CREDENTIAL_EVIDENCE_TYPE_UNSUPPORTED", "Use a PDF, PNG, JPG, or WebP file.");
      }
      if (request.file.size > 8_000_000) throw new ApiError(413, "CREDENTIAL_EVIDENCE_TOO_LARGE", "Use a file smaller than 8 MB.");
      const detection = detectUploadContent(request.file);
      if (!detection.ok) throw new ApiError(422, detection.code, detection.message);
      rejectEmbeddedGps(request.file);
      if (!s3Client || !s3Bucket) throw new ApiError(503, "OBJECT_STORAGE_UNAVAILABLE", "Managed profile storage is unavailable.");

      const accountId = request.actor.account.id;
      const current = await currentRecord(database, "profile_credentials", accountId, credentialId, { activeOnly: true });
      assertVersion(current, expectedVersion);
      const uploadId = randomUUID();
      const objectKey = `professional/${safeObjectName(accountId)}/credentials/${credentialId}/${uploadId}-${safeObjectName(request.file.originalname)}`;
      const contentHash = sha256Buffer(request.file.buffer);
      await s3Client.send(new PutObjectCommand({
        Bucket: s3Bucket,
        Key: objectKey,
        Body: request.file.buffer,
        ContentType: request.file.mimetype,
        Metadata: { source: "rivt-professional-credential", contentSha256: contentHash },
      }));
      try {
        const credential = await withTransaction(async (client) => {
          const locked = await currentRecord(client, "profile_credentials", accountId, credentialId, { activeOnly: true });
          assertVersion(locked, expectedVersion);
          await client.query(
            `INSERT INTO uploads (
               id, session_id, account_id, kind, name, object_key, original_name,
               mime_type, size_bytes, upload_status, storage_scope, content_sha256, verified_at
             ) VALUES ($1, $2::text, $2::uuid, 'profile-credential-evidence', $3, $4, $5, $6, $7,
                       'stored', 'professional-profile', $8, now())`,
            [uploadId, accountId, request.file.originalname.slice(0, 240), objectKey,
              request.file.originalname, request.file.mimetype, request.file.size, contentHash],
          );
          const updated = await client.query(
            `UPDATE profile_credentials
             SET evidence_upload_id = $3, evidence_state = 'evidence_on_file',
                 version = version + 1, updated_at = now()
             WHERE id = $1 AND account_id = $2
             RETURNING *`,
            [credentialId, accountId, uploadId],
          );
          await insertEvent(client, {
            accountId,
            actorAccountId: accountId,
            subjectType: "credential",
            subjectId: credentialId,
            action: "evidence_uploaded",
            fromVersion: locked.version,
            toVersion: updated.rows[0].version,
            metadata: { mimeType: request.file.mimetype, sizeBytes: request.file.size },
          });
          return updated.rows[0];
        });
        if (current.evidence_upload_id) {
          const previous = await database.query(
            "SELECT object_key FROM uploads WHERE id = $1 AND account_id = $2",
            [current.evidence_upload_id, accountId],
          );
          await database.query(
            "UPDATE uploads SET upload_status = 'removed' WHERE id = $1 AND account_id = $2",
            [current.evidence_upload_id, accountId],
          );
          if (previous.rows[0]?.object_key) {
            await s3Client.send(new DeleteObjectCommand({ Bucket: s3Bucket, Key: previous.rows[0].object_key })).catch(() => undefined);
          }
        }
        response.status(201).json({
          data: { credential: mapCredential(credential, await signedObjectUrl(objectKey)) },
          meta: { requestId: request.requestId },
        });
      } catch (error) {
        await s3Client.send(new DeleteObjectCommand({ Bucket: s3Bucket, Key: objectKey })).catch(() => undefined);
        throw error;
      }
    })),
  );

  app.delete("/api/v1/profile/credentials/:id/evidence", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(applicationObjectMutationBarrier(async (request, response) => {
    const credentialId = validate(recordIdSchema, request.params.id);
    const input = validate(versionSchema, request.body);
    const accountId = request.actor.account.id;
    const result = await withTransaction(async (client) => {
      const current = await currentRecord(client, "profile_credentials", accountId, credentialId, { activeOnly: true });
      assertVersion(current, input.expectedVersion);
      if (!current.evidence_upload_id) return { credential: current, objectKey: null };
      const upload = await client.query(
        "SELECT object_key FROM uploads WHERE id = $1 AND account_id = $2 FOR UPDATE",
        [current.evidence_upload_id, accountId],
      );
      const updated = await client.query(
        `UPDATE profile_credentials
         SET evidence_upload_id = NULL, evidence_state = 'self_reported',
             version = version + 1, updated_at = now()
         WHERE id = $1 AND account_id = $2
         RETURNING *`,
        [credentialId, accountId],
      );
      await client.query(
        "UPDATE uploads SET upload_status = 'removed' WHERE id = $1 AND account_id = $2",
        [current.evidence_upload_id, accountId],
      );
      await insertEvent(client, {
        accountId,
        actorAccountId: accountId,
        subjectType: "credential",
        subjectId: credentialId,
        action: "evidence_removed",
        fromVersion: current.version,
        toVersion: updated.rows[0].version,
      });
      return { credential: updated.rows[0], objectKey: upload.rows[0]?.object_key ?? null };
    });
    if (result.objectKey && s3Client && s3Bucket) {
      await s3Client.send(new DeleteObjectCommand({ Bucket: s3Bucket, Key: result.objectKey })).catch(() => undefined);
    }
    response.json({ data: { credential: mapCredential(result.credential) }, meta: { requestId: request.requestId } });
  })));

  app.delete("/api/v1/profile/credentials/:id", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
    await archiveOrRestore({
      request, response, table: "profile_credentials", subjectType: "credential",
      action: "archived", targetStatus: "archived", database, withTransaction,
    });
  }));
  app.post("/api/v1/profile/credentials/:id/restore", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
    await archiveOrRestore({
      request, response, table: "profile_credentials", subjectType: "credential",
      action: "restored", targetStatus: "active", database, withTransaction,
    });
  }));

  app.post("/api/v1/profile/availability-windows", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
    const input = validate(availabilityWindowCreateSchema, request.body);
    const accountId = request.actor.account.id;
    const result = await runIdempotentMutation(request, accountId, "profile.availability.create", async (client) => {
      const id = randomUUID();
      const inserted = await client.query(
        `INSERT INTO profile_availability_windows (
           id, account_id, availability, starts_on, ends_on, notes, visibility
         ) VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [id, accountId, input.availability, input.startsOn, input.endsOn, input.notes, input.visibility],
      );
      await insertEvent(client, {
        accountId, actorAccountId: accountId, subjectType: "availability_window",
        subjectId: id, action: "created", toVersion: 1,
        metadata: { availability: input.availability, visibility: input.visibility },
      });
      return {
        status: 201,
        body: { data: { availabilityWindow: mapAvailabilityWindow(inserted.rows[0]) }, meta: { requestId: request.requestId } },
      };
    });
    sendIdempotentResult(response, result);
  }));

  app.patch("/api/v1/profile/availability-windows/:id", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
    const windowId = validate(recordIdSchema, request.params.id);
    const input = validate(availabilityWindowUpdateSchema, request.body);
    const accountId = request.actor.account.id;
    const availabilityWindow = await withTransaction(async (client) => {
      const current = await currentRecord(client, "profile_availability_windows", accountId, windowId, { activeOnly: true });
      assertVersion(current, input.expectedVersion);
      const updated = await client.query(
        `UPDATE profile_availability_windows
         SET availability = $3, starts_on = $4, ends_on = $5, notes = $6,
             visibility = $7, version = version + 1, updated_at = now()
         WHERE id = $1 AND account_id = $2
         RETURNING *`,
        [windowId, accountId, input.availability, input.startsOn, input.endsOn, input.notes, input.visibility],
      );
      await insertEvent(client, {
        accountId, actorAccountId: accountId, subjectType: "availability_window",
        subjectId: windowId, action: "updated", fromVersion: current.version,
        toVersion: updated.rows[0].version,
        metadata: { availability: input.availability, visibility: input.visibility },
      });
      return updated.rows[0];
    });
    response.json({ data: { availabilityWindow: mapAvailabilityWindow(availabilityWindow) }, meta: { requestId: request.requestId } });
  }));

  app.delete("/api/v1/profile/availability-windows/:id", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
    await archiveOrRestore({
      request, response, table: "profile_availability_windows", subjectType: "availability_window",
      action: "archived", targetStatus: "archived", database, withTransaction,
    });
  }));
  app.post("/api/v1/profile/availability-windows/:id/restore", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
    await archiveOrRestore({
      request, response, table: "profile_availability_windows", subjectType: "availability_window",
      action: "restored", targetStatus: "active", database, withTransaction,
    });
  }));

  app.post(
    "/api/v1/profile/portfolio",
    requireV1AuthenticatedUser,
    requireV1Actor,
    uploadRateLimit,
    upload.single("file"),
    asyncRoute(applicationObjectMutationBarrier(async (request, response) => {
      if (!request.file) throw new ApiError(400, "PORTFOLIO_IMAGE_REQUIRED", "Choose a work photo to upload.");
      if (!["image/jpeg", "image/png", "image/webp"].includes(request.file.mimetype)) {
        throw new ApiError(415, "PORTFOLIO_IMAGE_TYPE_UNSUPPORTED", "Use a PNG, JPG, or WebP work photo.");
      }
      if (request.file.size > 8_000_000) throw new ApiError(413, "PORTFOLIO_IMAGE_TOO_LARGE", "Use a photo smaller than 8 MB.");
      const detection = detectUploadContent(request.file);
      if (!detection.ok) throw new ApiError(422, detection.code, detection.message);
      rejectEmbeddedGps(request.file);
      if (!s3Client || !s3Bucket) throw new ApiError(503, "OBJECT_STORAGE_UNAVAILABLE", "Managed profile storage is unavailable.");

      const input = validate(portfolioUpdateSchema.omit({ expectedVersion: true }).extend({
        sortOrder: z.coerce.number().int().min(0).max(10000).default(0),
      }), {
        title: request.body?.title,
        description: request.body?.description ?? "",
        tradeCode: request.body?.tradeCode || null,
        projectLabel: request.body?.projectLabel ?? "",
        serviceAreaCity: request.body?.serviceAreaCity ?? "",
        serviceAreaRegion: request.body?.serviceAreaRegion ?? "",
        completedOn: request.body?.completedOn || null,
        visibility: request.body?.visibility ?? "private",
        sortOrder: request.body?.sortOrder ?? 0,
      });
      const accountId = request.actor.account.id;
      const contentHash = sha256Buffer(request.file.buffer);
      request.body = { ...input, contentSha256: contentHash };
      const result = await runIdempotentMutation(request, accountId, "profile.portfolio.create", async (client) => {
        await assertTradeCode(client, input.tradeCode);
        const uploadId = randomUUID();
        const itemId = randomUUID();
        const objectKey = `professional/${safeObjectName(accountId)}/portfolio/${itemId}/${uploadId}-${safeObjectName(request.file.originalname)}`;
        await s3Client.send(new PutObjectCommand({
          Bucket: s3Bucket,
          Key: objectKey,
          Body: request.file.buffer,
          ContentType: request.file.mimetype,
          Metadata: { source: "rivt-professional-portfolio", contentSha256: contentHash },
        }));
        try {
          await client.query(
            `INSERT INTO uploads (
               id, session_id, account_id, kind, name, object_key, original_name,
               mime_type, size_bytes, upload_status, storage_scope, content_sha256, verified_at
             ) VALUES ($1, $2::text, $2::uuid, 'profile-portfolio', $3, $4, $5, $6, $7,
                       'stored', 'professional-profile', $8, now())`,
            [uploadId, accountId, input.title, objectKey, request.file.originalname,
              request.file.mimetype, request.file.size, contentHash],
          );
          const inserted = await client.query(
            `INSERT INTO profile_portfolio_items (
               id, account_id, upload_id, title, description, trade_code, project_label,
               service_area_city, service_area_region, completed_on, visibility, sort_order
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
             RETURNING *`,
            [itemId, accountId, uploadId, input.title, input.description, input.tradeCode,
              input.projectLabel, input.serviceAreaCity, input.serviceAreaRegion,
              input.completedOn, input.visibility, input.sortOrder],
          );
          await insertEvent(client, {
            accountId, actorAccountId: accountId, subjectType: "portfolio_item",
            subjectId: itemId, action: "created", toVersion: 1,
            metadata: { visibility: input.visibility, mimeType: request.file.mimetype, sizeBytes: request.file.size },
          });
          return {
            status: 201,
            body: {
              data: { portfolioItem: mapPortfolioItem(inserted.rows[0], await signedObjectUrl(objectKey)) },
              meta: { requestId: request.requestId },
            },
          };
        } catch (error) {
          await s3Client.send(new DeleteObjectCommand({ Bucket: s3Bucket, Key: objectKey })).catch(() => undefined);
          throw error;
        }
      });
      sendIdempotentResult(response, result);
    })),
  );

  app.patch("/api/v1/profile/portfolio/:id", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
    const itemId = validate(recordIdSchema, request.params.id);
    const input = validate(portfolioUpdateSchema, request.body);
    const accountId = request.actor.account.id;
    const item = await withTransaction(async (client) => {
      const current = await currentRecord(client, "profile_portfolio_items", accountId, itemId, { activeOnly: true });
      assertVersion(current, input.expectedVersion);
      await assertTradeCode(client, input.tradeCode);
      const updated = await client.query(
        `UPDATE profile_portfolio_items
         SET title = $3, description = $4, trade_code = $5, project_label = $6,
             service_area_city = $7, service_area_region = $8, completed_on = $9,
             visibility = $10, sort_order = $11, version = version + 1, updated_at = now()
         WHERE id = $1 AND account_id = $2
         RETURNING *`,
        [itemId, accountId, input.title, input.description, input.tradeCode, input.projectLabel,
          input.serviceAreaCity, input.serviceAreaRegion, input.completedOn,
          input.visibility, input.sortOrder],
      );
      await insertEvent(client, {
        accountId, actorAccountId: accountId, subjectType: "portfolio_item",
        subjectId: itemId, action: "updated", fromVersion: current.version,
        toVersion: updated.rows[0].version, metadata: { visibility: input.visibility },
      });
      return updated.rows[0];
    });
    const upload = await database.query(
      `SELECT upload.object_key, trade.name AS trade_name
       FROM profile_portfolio_items item
       INNER JOIN uploads upload ON upload.id = item.upload_id
       LEFT JOIN trades trade ON trade.code = item.trade_code
       WHERE item.id = $1 AND item.account_id = $2`,
      [itemId, accountId],
    );
    response.json({
      data: { portfolioItem: mapPortfolioItem({ ...item, trade_name: upload.rows[0]?.trade_name }, await signedUrlForRow(signedObjectUrl, upload.rows[0])) },
      meta: { requestId: request.requestId },
    });
  }));

  app.delete("/api/v1/profile/portfolio/:id", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
    await archiveOrRestore({
      request, response, table: "profile_portfolio_items", subjectType: "portfolio_item",
      action: "archived", targetStatus: "archived", database, withTransaction,
    });
  }));
  app.post("/api/v1/profile/portfolio/:id/restore", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
    await archiveOrRestore({
      request, response, table: "profile_portfolio_items", subjectType: "portfolio_item",
      action: "restored", targetStatus: "active", database, withTransaction,
    });
  }));

  app.post(
    "/api/v1/profile/avatar",
    requireV1AuthenticatedUser,
    requireV1Actor,
    uploadRateLimit,
    upload.single("file"),
    asyncRoute(applicationObjectMutationBarrier(async (request, response) => {
      if (!request.file) throw new ApiError(400, "PROFILE_AVATAR_REQUIRED", "Choose a profile photo to upload.");
      if (!["image/jpeg", "image/png", "image/webp"].includes(request.file.mimetype)) {
        throw new ApiError(415, "PROFILE_AVATAR_TYPE_UNSUPPORTED", "Use a PNG, JPG, or WebP profile photo.");
      }
      if (request.file.size > 5_000_000) throw new ApiError(413, "PROFILE_AVATAR_TOO_LARGE", "Use a profile photo smaller than 5 MB.");
      const detection = detectUploadContent(request.file);
      if (!detection.ok) throw new ApiError(422, detection.code, detection.message);
      rejectEmbeddedGps(request.file);
      if (!s3Client || !s3Bucket) throw new ApiError(503, "OBJECT_STORAGE_UNAVAILABLE", "Managed profile storage is unavailable.");

      const accountId = request.actor.account.id;
      const previous = await database.query(
        `SELECT p.avatar_upload_id, upload.object_key
         FROM profiles p
         LEFT JOIN uploads upload ON upload.id = p.avatar_upload_id AND upload.account_id = p.account_id
         WHERE p.account_id = $1`,
        [accountId],
      );
      const uploadId = randomUUID();
      const objectKey = `professional/${safeObjectName(accountId)}/avatar/${uploadId}-${safeObjectName(request.file.originalname)}`;
      const contentHash = sha256Buffer(request.file.buffer);
      await s3Client.send(new PutObjectCommand({
        Bucket: s3Bucket,
        Key: objectKey,
        Body: request.file.buffer,
        ContentType: request.file.mimetype,
        Metadata: { source: "rivt-professional-avatar", contentSha256: contentHash },
      }));
      try {
        await withTransaction(async (client) => {
          await client.query(
            `INSERT INTO uploads (
               id, session_id, account_id, kind, name, object_key, original_name,
               mime_type, size_bytes, upload_status, storage_scope, content_sha256, verified_at
             ) VALUES ($1, $2::text, $2::uuid, 'profile-avatar', $3, $4, $5, $6, $7,
                       'stored', 'professional-profile', $8, now())`,
            [uploadId, accountId, request.file.originalname.slice(0, 240), objectKey,
              request.file.originalname, request.file.mimetype, request.file.size, contentHash],
          );
          await client.query(
            "UPDATE profiles SET avatar_upload_id = $2, updated_at = now() WHERE account_id = $1",
            [accountId, uploadId],
          );
          await insertEvent(client, {
            accountId, actorAccountId: accountId, subjectType: "avatar",
            subjectId: accountId, action: "uploaded", metadata: { mimeType: request.file.mimetype, sizeBytes: request.file.size },
          });
        });
      } catch (error) {
        await s3Client.send(new DeleteObjectCommand({ Bucket: s3Bucket, Key: objectKey })).catch(() => undefined);
        throw error;
      }
      const oldUploadId = previous.rows[0]?.avatar_upload_id;
      const oldObjectKey = previous.rows[0]?.object_key;
      if (oldUploadId && oldUploadId !== uploadId) {
        await database.query("UPDATE uploads SET upload_status = 'removed' WHERE id = $1 AND account_id = $2", [oldUploadId, accountId]);
        if (oldObjectKey) await s3Client.send(new DeleteObjectCommand({ Bucket: s3Bucket, Key: oldObjectKey })).catch(() => undefined);
      }
      response.status(201).json({
        data: { avatarUploadId: uploadId, avatarUrl: await signedObjectUrl(objectKey) },
        meta: { requestId: request.requestId },
      });
    })),
  );

  app.delete("/api/v1/profile/avatar", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(applicationObjectMutationBarrier(async (request, response) => {
    const accountId = request.actor.account.id;
    const previous = await database.query(
      `SELECT p.avatar_upload_id, upload.object_key
       FROM profiles p
       LEFT JOIN uploads upload ON upload.id = p.avatar_upload_id AND upload.account_id = p.account_id
       WHERE p.account_id = $1`,
      [accountId],
    );
    await withTransaction(async (client) => {
      await client.query("UPDATE profiles SET avatar_upload_id = NULL, updated_at = now() WHERE account_id = $1", [accountId]);
      if (previous.rows[0]?.avatar_upload_id) {
        await client.query(
          "UPDATE uploads SET upload_status = 'removed' WHERE id = $1 AND account_id = $2",
          [previous.rows[0].avatar_upload_id, accountId],
        );
      }
      await insertEvent(client, {
        accountId, actorAccountId: accountId, subjectType: "avatar",
        subjectId: accountId, action: "removed",
      });
    });
    if (previous.rows[0]?.object_key && s3Client && s3Bucket) {
      await s3Client.send(new DeleteObjectCommand({ Bucket: s3Bucket, Key: previous.rows[0].object_key })).catch(() => undefined);
    }
    response.json({ data: { avatarUploadId: null, avatarUrl: null }, meta: { requestId: request.requestId } });
  })));
}

export const professionalProfileInternals = {
  imageHasEmbeddedGps,
  credentialCreateSchema,
  credentialUpdateSchema,
  availabilityWindowCreateSchema,
  availabilityWindowUpdateSchema,
  portfolioUpdateSchema,
  mapCredential,
  mapAvailabilityWindow,
  mapPortfolioItem,
};
