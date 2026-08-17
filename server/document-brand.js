import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";
import { ApiError, asyncRoute, validate, z } from "./api.js";

const documentStyleSchema = z.enum(["classic", "compact", "field"]);
const optionalEmailSchema = z.string().trim().max(320).refine(
  (value) => !value || z.email().safeParse(value).success,
  "Enter a valid business email.",
);
const optionalWebsiteSchema = z.string().trim().max(500).refine(
  (value) => !value || z.url().safeParse(value).success,
  "Enter a complete website address.",
);

export const documentBrandInputSchema = z.object({
  businessName: z.string().trim().min(1).max(160),
  businessEmail: optionalEmailSchema.default(""),
  businessPhone: z.string().trim().max(40).default(""),
  businessAddress: z.string().trim().max(500).default(""),
  website: optionalWebsiteSchema.default(""),
  licenseNumber: z.string().trim().max(120).default(""),
  estimateStyle: documentStyleSchema.default("classic"),
  invoiceStyle: documentStyleSchema.default("classic"),
  showContact: z.boolean().default(true),
  showAddress: z.boolean().default(true),
  showLicense: z.boolean().default(true),
});

function defaultBusinessName(actor) {
  return actor.memberships.find((membership) => ["owner", "admin"].includes(membership.role))?.organizationName
    || actor.profile.displayName
    || "RIVT member";
}

function defaultDocumentBrand(actor) {
  return {
    businessName: defaultBusinessName(actor),
    businessEmail: actor.account.email ?? "",
    businessPhone: actor.profile.phoneE164 ?? "",
    businessAddress: "",
    website: "",
    licenseNumber: "",
    estimateStyle: "classic",
    invoiceStyle: "classic",
    showContact: true,
    showAddress: true,
    showLicense: true,
    logoUploadId: null,
    logoUrl: null,
    updatedAt: null,
  };
}

function mapDocumentBrand(row, actor, logoUrl = null) {
  if (!row) return defaultDocumentBrand(actor);
  return {
    businessName: row.business_name || defaultBusinessName(actor),
    businessEmail: row.business_email || "",
    businessPhone: row.business_phone || "",
    businessAddress: row.business_address || "",
    website: row.website || "",
    licenseNumber: row.license_number || "",
    estimateStyle: row.estimate_style || "classic",
    invoiceStyle: row.invoice_style || "classic",
    showContact: Boolean(row.show_contact),
    showAddress: Boolean(row.show_address),
    showLicense: Boolean(row.show_license),
    logoUploadId: row.logo_upload_id ?? null,
    logoUrl,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
}

async function documentBrandRow(database, accountId) {
  const result = await database.query(
    `SELECT brand.*, upload.object_key AS logo_object_key,
            upload.original_name AS logo_original_name,
            upload.mime_type AS logo_mime_type,
            upload.size_bytes AS logo_size_bytes
     FROM document_brand_profiles brand
     LEFT JOIN uploads upload
       ON upload.id = brand.logo_upload_id
      AND upload.account_id = brand.account_id
      AND upload.kind = 'document-logo'
      AND upload.upload_status = 'stored'
     WHERE brand.account_id = $1
     LIMIT 1`,
    [accountId],
  );
  return result.rows[0] ?? null;
}

export async function loadDocumentBrand(database, actor, signedObjectUrl = null) {
  const row = await documentBrandRow(database, actor.account.id);
  const logoUrl = row?.logo_object_key && signedObjectUrl
    ? await signedObjectUrl(row.logo_object_key).catch(() => null)
    : null;
  return mapDocumentBrand(row, actor, logoUrl);
}

export async function loadDocumentBrandForDelivery(database, actor, { s3Client, s3Bucket } = {}) {
  const row = await documentBrandRow(database, actor.account.id);
  const brand = mapDocumentBrand(row, actor, null);
  if (!row?.logo_object_key || !s3Client || !s3Bucket) {
    return { brand, attachments: [] };
  }
  try {
    const object = await s3Client.send(new GetObjectCommand({
      Bucket: s3Bucket,
      Key: row.logo_object_key,
    }));
    const bytes = await object.Body?.transformToByteArray();
    if (!bytes?.length || bytes.length > 2_000_000) return { brand, attachments: [] };
    return {
      brand,
      attachments: [{
        content: Buffer.from(bytes).toString("base64"),
        filename: String(row.logo_original_name || "business-logo").slice(0, 160),
        content_id: "rivt-document-logo",
      }],
    };
  } catch {
    return { brand, attachments: [] };
  }
}

export function registerDocumentBrandRoutes({
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
}) {
  app.get("/api/v1/document-brand", requireV1AuthenticatedUser, requireV1Actor, asyncRoute(async (request, response) => {
    const brand = await loadDocumentBrand(database, request.actor, signedObjectUrl);
    response.json({ data: { brand }, meta: { requestId: request.requestId } });
  }));

  app.put("/api/v1/document-brand", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
    const input = validate(documentBrandInputSchema, request.body);
    const result = await database.query(
      `INSERT INTO document_brand_profiles (
         account_id, business_name, business_email, business_phone, business_address,
         website, license_number, estimate_style, invoice_style,
         show_contact, show_address, show_license
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (account_id)
       DO UPDATE SET
         business_name = EXCLUDED.business_name,
         business_email = EXCLUDED.business_email,
         business_phone = EXCLUDED.business_phone,
         business_address = EXCLUDED.business_address,
         website = EXCLUDED.website,
         license_number = EXCLUDED.license_number,
         estimate_style = EXCLUDED.estimate_style,
         invoice_style = EXCLUDED.invoice_style,
         show_contact = EXCLUDED.show_contact,
         show_address = EXCLUDED.show_address,
         show_license = EXCLUDED.show_license,
         updated_at = now()
       RETURNING *`,
      [
        request.actor.account.id,
        input.businessName,
        input.businessEmail,
        input.businessPhone,
        input.businessAddress,
        input.website,
        input.licenseNumber,
        input.estimateStyle,
        input.invoiceStyle,
        input.showContact,
        input.showAddress,
        input.showLicense,
      ],
    );
    await database.query(
      `INSERT INTO audit_events (request_id, actor_account_id, action, subject_type, subject_id)
       VALUES ($1, $2::uuid, 'document_brand.updated', 'account', ($2::uuid)::text)`,
      [request.requestId, request.actor.account.id],
    );
    const current = await documentBrandRow(database, request.actor.account.id);
    const logoUrl = current?.logo_object_key
      ? await signedObjectUrl(current.logo_object_key).catch(() => null)
      : null;
    response.json({
      data: { brand: mapDocumentBrand({ ...current, ...result.rows[0] }, request.actor, logoUrl) },
      meta: { requestId: request.requestId },
    });
  }));

  app.post(
    "/api/v1/document-brand/logo",
    requireV1AuthenticatedUser,
    requireV1Actor,
    uploadRateLimit,
    upload.single("file"),
    asyncRoute(applicationObjectMutationBarrier(async (request, response) => {
      if (!request.file) throw new ApiError(400, "DOCUMENT_LOGO_REQUIRED", "Choose a logo image to upload.");
      if (!["image/jpeg", "image/png", "image/webp"].includes(request.file.mimetype)) {
        throw new ApiError(415, "DOCUMENT_LOGO_TYPE_UNSUPPORTED", "Use a PNG, JPG, or WebP logo.");
      }
      if (request.file.size > 2_000_000) {
        throw new ApiError(413, "DOCUMENT_LOGO_TOO_LARGE", "Use a logo smaller than 2 MB.");
      }
      const detection = detectUploadContent(request.file);
      if (!detection.ok) {
        throw new ApiError(422, detection.code || "DOCUMENT_LOGO_CONTENT_INVALID", "The selected file is not a valid logo image.");
      }
      if (!s3Client || !s3Bucket) {
        throw new ApiError(503, "OBJECT_STORAGE_UNAVAILABLE", "Managed logo storage is unavailable.");
      }

      const previous = await documentBrandRow(database, request.actor.account.id);
      const uploadId = randomUUID();
      const objectKey = `document-brand/${safeObjectName(request.actor.account.id)}/${uploadId}-${safeObjectName(request.file.originalname)}`;
      const contentHash = sha256Buffer(request.file.buffer);
      await s3Client.send(new PutObjectCommand({
        Bucket: s3Bucket,
        Key: objectKey,
        Body: request.file.buffer,
        ContentType: request.file.mimetype,
        Metadata: {
          originalName: request.file.originalname.slice(0, 256),
          source: "rivt-document-brand",
          contentSha256: contentHash,
        },
      }));
      await database.query(
        `INSERT INTO uploads (
           id, session_id, account_id, kind, name, notes, object_key, original_name,
           mime_type, size_bytes, upload_status, storage_scope, content_sha256, verified_at
         ) VALUES ($1, $2::text, $2::uuid, 'document-logo', $3, '', $4, $5, $6, $7, 'stored', 'document-brand', $8, now())`,
        [
          uploadId,
          request.actor.account.id,
          request.file.originalname.slice(0, 240),
          objectKey,
          request.file.originalname,
          request.file.mimetype,
          request.file.size,
          contentHash,
        ],
      );
      await database.query(
        `INSERT INTO document_brand_profiles (account_id, business_name, business_email, logo_upload_id)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (account_id)
         DO UPDATE SET logo_upload_id = EXCLUDED.logo_upload_id, updated_at = now()`,
        [request.actor.account.id, defaultBusinessName(request.actor), request.actor.account.email ?? "", uploadId],
      );
      if (previous?.logo_upload_id && previous.logo_upload_id !== uploadId) {
        await database.query(
          "UPDATE uploads SET upload_status = 'removed' WHERE id = $1 AND account_id = $2",
          [previous.logo_upload_id, request.actor.account.id],
        );
        if (previous.logo_object_key) {
          await s3Client.send(new DeleteObjectCommand({ Bucket: s3Bucket, Key: previous.logo_object_key })).catch(() => undefined);
        }
      }
      await database.query(
        `INSERT INTO audit_events (request_id, actor_account_id, action, subject_type, subject_id, metadata)
         VALUES ($1, $2::uuid, 'document_brand.logo_uploaded', 'upload', $3, $4::jsonb)`,
        [request.requestId, request.actor.account.id, uploadId, JSON.stringify({ mimeType: request.file.mimetype, sizeBytes: request.file.size })],
      );
      const brand = await loadDocumentBrand(database, request.actor, signedObjectUrl);
      response.status(201).json({ data: { brand }, meta: { requestId: request.requestId } });
    })),
  );

  app.delete("/api/v1/document-brand/logo", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(applicationObjectMutationBarrier(async (request, response) => {
    const previous = await documentBrandRow(database, request.actor.account.id);
    await database.query(
      `UPDATE document_brand_profiles
       SET logo_upload_id = NULL, updated_at = now()
       WHERE account_id = $1`,
      [request.actor.account.id],
    );
    if (previous?.logo_upload_id) {
      await database.query(
        "UPDATE uploads SET upload_status = 'removed' WHERE id = $1 AND account_id = $2",
        [previous.logo_upload_id, request.actor.account.id],
      );
    }
    if (previous?.logo_object_key && s3Client && s3Bucket) {
      await s3Client.send(new DeleteObjectCommand({ Bucket: s3Bucket, Key: previous.logo_object_key })).catch(() => undefined);
    }
    await database.query(
      `INSERT INTO audit_events (request_id, actor_account_id, action, subject_type, subject_id)
       VALUES ($1, $2::uuid, 'document_brand.logo_removed', 'account', ($2::uuid)::text)`,
      [request.requestId, request.actor.account.id],
    );
    const brand = await loadDocumentBrand(database, request.actor, signedObjectUrl);
    response.json({ data: { brand }, meta: { requestId: request.requestId } });
  })));
}
