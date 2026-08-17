import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";
import { ApiError, asyncRoute, validate, z } from "./api.js";
import { professionalProfileInternals } from "./professional-profile.js";

const emojiSchema = z.enum(["👍", "👎", "🔥", "✅", "❓", "😂"]);
const templateCreateSchema = z.object({
  body: z.string().trim().min(1).max(1000),
  sortOrder: z.number().int().min(0).max(10000).default(0),
});
const templateUpdateSchema = templateCreateSchema.extend({
  expectedVersion: z.number().int().positive(),
});
const versionSchema = z.object({ expectedVersion: z.coerce.number().int().positive() });
const preferenceSchema = z.object({
  pinned: z.boolean(),
  archived: z.boolean(),
  expectedVersion: z.number().int().nonnegative(),
});
const reactionSchema = z.object({ emoji: emojiSchema.nullable() });
const noteCreateSchema = z.object({
  body: z.string().trim().min(1).max(4000),
  occurredAt: z.iso.datetime({ offset: true }).nullable().default(null),
});
const noteUpdateSchema = noteCreateSchema.extend({ expectedVersion: z.number().int().positive() });

function iso(value) {
  return value ? new Date(value).toISOString() : null;
}

function mapPreference(row) {
  return {
    conversationId: row.conversation_id,
    pinned: Boolean(row.pinned),
    archived: Boolean(row.archived),
    version: Number(row.version),
    updatedAt: iso(row.updated_at),
  };
}

function mapTemplate(row) {
  return {
    id: row.id,
    body: row.body,
    sortOrder: Number(row.sort_order),
    version: Number(row.version),
    archivedAt: iso(row.archived_at),
    occurredAt: iso(row.occurred_at ?? row.created_at),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

async function mapNote(row, attachments, signedObjectUrl) {
  return {
    id: row.id,
    contactId: row.contact_id,
    body: row.body,
    version: Number(row.version),
    archivedAt: iso(row.archived_at),
    occurredAt: iso(row.occurred_at),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    attachments: await Promise.all(
      attachments.map(async (attachment) => ({
        id: attachment.id,
        originalName: attachment.original_name,
        mimeType: attachment.mime_type,
        sizeBytes: Number(attachment.size_bytes),
        version: Number(attachment.version),
        createdAt: iso(attachment.created_at),
        url: attachment.object_key ? await signedObjectUrl(attachment.object_key).catch(() => null) : null,
      })),
    ),
  };
}

async function insertEvent(client, {
  accountId,
  subjectType,
  subjectId,
  action,
  fromVersion = null,
  toVersion = null,
  metadata = {},
}) {
  await client.query(
    `INSERT INTO messaging_continuity_events (
       account_id, actor_account_id, subject_type, subject_id, action,
       from_version, to_version, metadata
     ) VALUES ($1, $1, $2, $3, $4, $5, $6, $7::jsonb)`,
    [accountId, subjectType, String(subjectId), action, fromVersion, toVersion, JSON.stringify(metadata)],
  );
}

async function assertContactOwner(client, accountId, contactId) {
  const result = await client.query(
    "SELECT id FROM contacts WHERE id = $1 AND account_id = $2",
    [contactId, accountId],
  );
  if (!result.rowCount) throw new ApiError(404, "CONTACT_NOT_FOUND", "Contact not found.");
}

async function loadNote(client, accountId, contactId, noteId, { includeArchived = true } = {}) {
  const result = await client.query(
    `SELECT * FROM contact_notes
     WHERE id = $1 AND contact_id = $2 AND account_id = $3
       ${includeArchived ? "" : "AND archived_at IS NULL"}`,
    [noteId, contactId, accountId],
  );
  if (!result.rowCount) throw new ApiError(404, "CONTACT_NOTE_NOT_FOUND", "Contact note not found.");
  return result.rows[0];
}

async function noteAttachments(client, noteIds) {
  if (!noteIds.length) return new Map();
  const rows = await client.query(
    `SELECT attachment.*, upload.object_key
     FROM contact_note_attachments attachment
     INNER JOIN uploads upload ON upload.id = attachment.upload_id
     WHERE attachment.note_id = ANY($1::uuid[]) AND attachment.removed_at IS NULL
       AND upload.upload_status = 'stored'
     ORDER BY attachment.created_at, attachment.id`,
    [noteIds],
  );
  const mapped = new Map();
  for (const row of rows.rows) {
    const current = mapped.get(row.note_id) ?? [];
    current.push(row);
    mapped.set(row.note_id, current);
  }
  return mapped;
}

function rejectLocationMetadata(file) {
  if (file?.mimetype?.startsWith("image/") && professionalProfileInternals.imageHasEmbeddedGps(file.buffer)) {
    throw new ApiError(
      422,
      "SHARED_IMAGE_LOCATION_METADATA",
      "Remove embedded location data from this image before uploading it.",
    );
  }
}

function validatePrivateFile(file, detectUploadContent) {
  if (!file) throw new ApiError(400, "ATTACHMENT_REQUIRED", "Choose a file to upload.");
  const allowed = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf", "text/plain"]);
  if (!allowed.has(file.mimetype)) {
    throw new ApiError(415, "ATTACHMENT_TYPE_UNSUPPORTED", "Use a PDF, text, PNG, JPG, or WebP file.");
  }
  if (file.size > 10_485_760) throw new ApiError(413, "ATTACHMENT_TOO_LARGE", "Use a file smaller than 10 MB.");
  const detection = detectUploadContent(file);
  if (!detection.ok) throw new ApiError(422, detection.code, detection.message);
  rejectLocationMetadata(file);
}

async function reactionSummary(client, messageId, actorAccountId) {
  const rows = await client.query(
    `SELECT emoji, count(*)::int AS count,
            bool_or(account_id = $2) AS reacted_by_me
     FROM message_reactions
     WHERE message_id = $1
     GROUP BY emoji
     ORDER BY emoji`,
    [messageId, actorAccountId],
  );
  return rows.rows.map((row) => ({
    emoji: row.emoji,
    count: Number(row.count),
    reactedByMe: Boolean(row.reacted_by_me),
  }));
}

export function registerMessagingContinuityRoutes({
  app,
  database,
  requireV1AuthenticatedUser,
  requireV1Actor,
  writeRateLimit,
  uploadRateLimit,
  upload,
  applicationObjectMutationBarrier,
  loadConversationById,
  loadConversationParticipantRows,
  assertConversationParticipantsCanInteract,
  detectUploadContent,
  sha256Buffer,
  safeObjectName,
  signedObjectUrl,
  s3Client,
  s3Bucket,
  withTransaction,
  runIdempotentMutation,
  sendIdempotentResult,
}) {
  async function expirePendingMessageAttachments() {
    const expired = await withTransaction(async (client) => {
      const rows = await client.query(
        `SELECT attachment.id, attachment.upload_id, attachment.version,
                attachment.created_by_account_id, upload.object_key
         FROM message_attachments attachment
         INNER JOIN uploads upload ON upload.id = attachment.upload_id
         WHERE attachment.status = 'pending_authorization'
           AND attachment.message_id IS NULL
           AND attachment.removed_at IS NULL
           AND attachment.expires_at <= now()
         ORDER BY attachment.expires_at, attachment.id
         FOR UPDATE OF attachment SKIP LOCKED
         LIMIT 25`,
      );
      for (const row of rows.rows) {
        await client.query(
          `UPDATE message_attachments
           SET status = 'rejected', removed_at = now(), version = version + 1
           WHERE id = $1`,
          [row.id],
        );
        await client.query("UPDATE uploads SET upload_status = 'removed' WHERE id = $1", [row.upload_id]);
        await insertEvent(client, {
          accountId: row.created_by_account_id,
          subjectType: "message_attachment",
          subjectId: row.id,
          action: "draft_expired",
          fromVersion: row.version,
          toVersion: Number(row.version) + 1,
          metadata: { automated: true },
        });
      }
      return rows.rows;
    });
    if (s3Client && s3Bucket) {
      await Promise.all(expired.map((row) => row.object_key
        ? s3Client.send(new DeleteObjectCommand({ Bucket: s3Bucket, Key: row.object_key })).catch(() => undefined)
        : undefined));
    }
  }

  app.get("/api/v1/messaging/settings", requireV1AuthenticatedUser, requireV1Actor, asyncRoute(applicationObjectMutationBarrier(async (request, response) => {
    const accountId = request.actor.account.id;
    await expirePendingMessageAttachments();
    const [preferences, templates] = await Promise.all([
      database.query(
        "SELECT * FROM conversation_preferences WHERE account_id = $1 ORDER BY updated_at DESC",
        [accountId],
      ),
      database.query(
        "SELECT * FROM message_templates WHERE account_id = $1 ORDER BY archived_at NULLS FIRST, sort_order, created_at, id",
        [accountId],
      ),
    ]);
    response.json({
      data: {
        conversationPreferences: preferences.rows.map(mapPreference),
        templates: templates.rows.map(mapTemplate),
      },
      meta: { requestId: request.requestId },
    });
  })));

  app.put("/api/v1/conversations/:id/preference", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
    const conversationId = validate(z.uuid(), request.params.id);
    const input = validate(preferenceSchema, request.body);
    const accountId = request.actor.account.id;
    await loadConversationById(database, conversationId, request.actor);
    const preference = await withTransaction(async (client) => {
      const current = await client.query(
        "SELECT * FROM conversation_preferences WHERE account_id = $1 AND conversation_id = $2 FOR UPDATE",
        [accountId, conversationId],
      );
      if (!current.rowCount && input.expectedVersion !== 0) {
        throw new ApiError(409, "CONVERSATION_PREFERENCE_CONFLICT", "Conversation settings changed on another device.");
      }
      if (current.rowCount && Number(current.rows[0].version) !== input.expectedVersion) {
        throw new ApiError(409, "CONVERSATION_PREFERENCE_CONFLICT", "Conversation settings changed on another device.");
      }
      const updated = await client.query(
        `INSERT INTO conversation_preferences (account_id, conversation_id, pinned, archived)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (account_id, conversation_id)
         DO UPDATE SET pinned = EXCLUDED.pinned, archived = EXCLUDED.archived,
                       version = conversation_preferences.version + 1, updated_at = now()
         RETURNING *`,
        [accountId, conversationId, input.pinned, input.archived],
      );
      await insertEvent(client, {
        accountId,
        subjectType: "conversation_preference",
        subjectId: conversationId,
        action: "updated",
        fromVersion: current.rows[0]?.version ?? null,
        toVersion: updated.rows[0].version,
        metadata: { pinned: input.pinned, archived: input.archived },
      });
      return updated.rows[0];
    });
    response.json({ data: { preference: mapPreference(preference) }, meta: { requestId: request.requestId } });
  }));

  app.post("/api/v1/message-templates", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
    const input = validate(templateCreateSchema, request.body);
    const accountId = request.actor.account.id;
    const result = await runIdempotentMutation(request, accountId, "message-template.create", async (client) => {
      const inserted = await client.query(
        `INSERT INTO message_templates (account_id, body, sort_order)
         VALUES ($1, $2, $3) RETURNING *`,
        [accountId, input.body, input.sortOrder],
      );
      await insertEvent(client, {
        accountId,
        subjectType: "message_template",
        subjectId: inserted.rows[0].id,
        action: "created",
        toVersion: 1,
      });
      return {
        status: 201,
        body: { data: { template: mapTemplate(inserted.rows[0]) }, meta: { requestId: request.requestId } },
      };
    });
    sendIdempotentResult(response, result);
  }));

  app.patch("/api/v1/message-templates/:id", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
    const templateId = validate(z.uuid(), request.params.id);
    const input = validate(templateUpdateSchema, request.body);
    const accountId = request.actor.account.id;
    const updated = await database.query(
      `UPDATE message_templates
       SET body = $3, sort_order = $4, version = version + 1, updated_at = now()
       WHERE id = $1 AND account_id = $2 AND version = $5 AND archived_at IS NULL
       RETURNING *`,
      [templateId, accountId, input.body, input.sortOrder, input.expectedVersion],
    );
    if (!updated.rowCount) throw new ApiError(409, "MESSAGE_TEMPLATE_CONFLICT", "This template changed on another device.");
    await insertEvent(database, {
      accountId,
      subjectType: "message_template",
      subjectId: templateId,
      action: "updated",
      fromVersion: input.expectedVersion,
      toVersion: updated.rows[0].version,
    });
    response.json({ data: { template: mapTemplate(updated.rows[0]) }, meta: { requestId: request.requestId } });
  }));

  async function setTemplateArchive(request, response, archived) {
    const templateId = validate(z.uuid(), request.params.id);
    const input = validate(versionSchema, request.body);
    const accountId = request.actor.account.id;
    const updated = await database.query(
      `UPDATE message_templates
       SET archived_at = ${archived ? "now()" : "NULL"}, version = version + 1, updated_at = now()
       WHERE id = $1 AND account_id = $2 AND version = $3
         AND archived_at IS ${archived ? "NULL" : "NOT NULL"}
       RETURNING *`,
      [templateId, accountId, input.expectedVersion],
    );
    if (!updated.rowCount) throw new ApiError(409, "MESSAGE_TEMPLATE_CONFLICT", "This template changed on another device.");
    await insertEvent(database, {
      accountId,
      subjectType: "message_template",
      subjectId: templateId,
      action: archived ? "archived" : "restored",
      fromVersion: input.expectedVersion,
      toVersion: updated.rows[0].version,
    });
    response.json({ data: { template: mapTemplate(updated.rows[0]) }, meta: { requestId: request.requestId } });
  }

  app.post("/api/v1/message-templates/:id/archive", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(
    async (request, response) => setTemplateArchive(request, response, true),
  ));
  app.post("/api/v1/message-templates/:id/restore", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(
    async (request, response) => setTemplateArchive(request, response, false),
  ));

  app.put("/api/v1/conversations/:conversationId/messages/:messageId/reaction", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
    const conversationId = validate(z.uuid(), request.params.conversationId);
    const messageId = validate(z.uuid(), request.params.messageId);
    const input = validate(reactionSchema, request.body);
    const accountId = request.actor.account.id;
    await loadConversationById(database, conversationId, request.actor);
    const message = await database.query(
      "SELECT id FROM conversation_messages WHERE id = $1 AND conversation_id = $2 AND deleted_at IS NULL",
      [messageId, conversationId],
    );
    if (!message.rowCount) throw new ApiError(404, "MESSAGE_NOT_FOUND", "Message not found.");
    await withTransaction(async (client) => {
      if (input.emoji) {
        await client.query(
          `INSERT INTO message_reactions (message_id, account_id, emoji)
           VALUES ($1, $2, $3)
           ON CONFLICT (message_id, account_id)
           DO UPDATE SET emoji = EXCLUDED.emoji, updated_at = now()`,
          [messageId, accountId, input.emoji],
        );
      } else {
        await client.query(
          "DELETE FROM message_reactions WHERE message_id = $1 AND account_id = $2",
          [messageId, accountId],
        );
      }
      await insertEvent(client, {
        accountId,
        subjectType: "message_reaction",
        subjectId: messageId,
        action: input.emoji ? "set" : "removed",
        metadata: input.emoji ? { emoji: input.emoji } : {},
      });
    });
    response.json({
      data: { reactions: await reactionSummary(database, messageId, accountId) },
      meta: { requestId: request.requestId },
    });
  }));

  app.post(
    "/api/v1/conversations/:id/attachments",
    requireV1AuthenticatedUser,
    requireV1Actor,
    uploadRateLimit,
    upload.single("file"),
    asyncRoute(applicationObjectMutationBarrier(async (request, response) => {
      await expirePendingMessageAttachments();
      const conversationId = validate(z.uuid(), request.params.id);
      const conversation = await loadConversationById(database, conversationId, request.actor);
      if (conversation.status !== "open") throw new ApiError(409, "CONVERSATION_CLOSED", "This conversation is closed.");
      const participants = await loadConversationParticipantRows(database, conversationId);
      await assertConversationParticipantsCanInteract(database, participants);
      validatePrivateFile(request.file, detectUploadContent);
      if (!s3Client || !s3Bucket) throw new ApiError(503, "OBJECT_STORAGE_UNAVAILABLE", "Managed message storage is unavailable.");
      const accountId = request.actor.account.id;
      const uploadId = randomUUID();
      const attachmentId = randomUUID();
      const objectKey = `messages/${safeObjectName(conversationId)}/${safeObjectName(accountId)}/${uploadId}-${safeObjectName(request.file.originalname)}`;
      const contentHash = sha256Buffer(request.file.buffer);
      await s3Client.send(new PutObjectCommand({
        Bucket: s3Bucket,
        Key: objectKey,
        Body: request.file.buffer,
        ContentType: request.file.mimetype,
        Metadata: { source: "rivt-message-attachment", contentSha256: contentHash },
      }));
      try {
        await withTransaction(async (client) => {
          await client.query(
            `INSERT INTO uploads (
               id, session_id, account_id, kind, name, object_key, original_name,
               mime_type, size_bytes, upload_status, storage_scope, content_sha256, verified_at
             ) VALUES ($1, $2::text, $2::uuid, 'message-attachment', $3, $4, $5, $6, $7,
                       'stored', 'message', $8, now())`,
            [uploadId, accountId, request.file.originalname.slice(0, 240), objectKey,
              request.file.originalname, request.file.mimetype, request.file.size, contentHash],
          );
          await client.query(
            `INSERT INTO message_attachments (
               id, conversation_id, upload_id, original_name, mime_type, size_bytes, status, created_by_account_id
             ) VALUES ($1, $2, $3, $4, $5, $6, 'pending_authorization', $7)`,
            [attachmentId, conversationId, uploadId, request.file.originalname.slice(0, 240),
              request.file.mimetype, request.file.size, accountId],
          );
          await insertEvent(client, {
            accountId,
            subjectType: "message_attachment",
            subjectId: attachmentId,
            action: "uploaded_draft",
            toVersion: 1,
            metadata: { conversationId, mimeType: request.file.mimetype, sizeBytes: request.file.size },
          });
        });
      } catch (error) {
        await s3Client.send(new DeleteObjectCommand({ Bucket: s3Bucket, Key: objectKey })).catch(() => undefined);
        throw error;
      }
      response.status(201).json({
        data: {
          attachment: {
            id: attachmentId,
            uploadId,
            originalName: request.file.originalname.slice(0, 240),
            mimeType: request.file.mimetype,
            sizeBytes: request.file.size,
            status: "pending_authorization",
            url: await signedObjectUrl(objectKey),
          },
        },
        meta: { requestId: request.requestId },
      });
    })),
  );

  app.delete("/api/v1/conversations/:conversationId/attachments/:attachmentId", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(applicationObjectMutationBarrier(async (request, response) => {
    const conversationId = validate(z.uuid(), request.params.conversationId);
    const attachmentId = validate(z.uuid(), request.params.attachmentId);
    const accountId = request.actor.account.id;
    await loadConversationById(database, conversationId, request.actor);
    const result = await database.query(
      `SELECT attachment.*, upload.object_key
       FROM message_attachments attachment
       INNER JOIN uploads upload ON upload.id = attachment.upload_id
       LEFT JOIN conversation_messages message ON message.id = attachment.message_id
       WHERE attachment.id = $1 AND attachment.created_by_account_id = $2
         AND attachment.removed_at IS NULL
         AND attachment.conversation_id = $3
         AND (attachment.message_id IS NULL OR message.conversation_id = $3)`,
      [attachmentId, accountId, conversationId],
    );
    if (!result.rowCount) throw new ApiError(404, "MESSAGE_ATTACHMENT_NOT_FOUND", "Attachment not found.");
    await withTransaction(async (client) => {
      await client.query(
        `UPDATE message_attachments
         SET status = 'rejected', removed_at = now(), version = version + 1
         WHERE id = $1`,
        [attachmentId],
      );
      if (result.rows[0].message_id) {
        await client.query(
          `UPDATE conversation_messages message
           SET body = '[Attachment removed]'
           WHERE message.id = $1
             AND btrim(message.body) = ''
             AND NOT EXISTS (
               SELECT 1 FROM message_attachments remaining
               WHERE remaining.message_id = message.id
                 AND remaining.id <> $2
                 AND remaining.removed_at IS NULL
                 AND remaining.status = 'attached'
             )`,
          [result.rows[0].message_id, attachmentId],
        );
      }
      await client.query("UPDATE uploads SET upload_status = 'removed' WHERE id = $1", [result.rows[0].upload_id]);
      await insertEvent(client, {
        accountId,
        subjectType: "message_attachment",
        subjectId: attachmentId,
        action: "removed",
        fromVersion: result.rows[0].version,
        toVersion: Number(result.rows[0].version) + 1,
      });
    });
    if (result.rows[0].object_key && s3Client && s3Bucket) {
      await s3Client.send(new DeleteObjectCommand({ Bucket: s3Bucket, Key: result.rows[0].object_key })).catch(() => undefined);
    }
    response.json({ data: { removed: true, attachmentId }, meta: { requestId: request.requestId } });
  })));

  app.get("/api/v1/contacts/:contactId/notes", requireV1AuthenticatedUser, requireV1Actor, asyncRoute(async (request, response) => {
    const contactId = validate(z.uuid(), request.params.contactId);
    const accountId = request.actor.account.id;
    const includeArchived = request.query.includeArchived === "true";
    await assertContactOwner(database, accountId, contactId);
    const rows = await database.query(
      `SELECT * FROM contact_notes
       WHERE account_id = $1 AND contact_id = $2
         AND ($3::boolean OR archived_at IS NULL)
       ORDER BY archived_at NULLS FIRST, occurred_at DESC, id DESC`,
      [accountId, contactId, includeArchived],
    );
    const attachments = await noteAttachments(database, rows.rows.map((row) => row.id));
    response.json({
      data: {
        notes: await Promise.all(rows.rows.map((row) => mapNote(row, attachments.get(row.id) ?? [], signedObjectUrl))),
      },
      meta: { requestId: request.requestId },
    });
  }));

  app.get("/api/v1/contacts/:contactId/notes/:noteId/history", requireV1AuthenticatedUser, requireV1Actor, asyncRoute(async (request, response) => {
    const contactId = validate(z.uuid(), request.params.contactId);
    const noteId = validate(z.uuid(), request.params.noteId);
    const accountId = request.actor.account.id;
    await loadNote(database, accountId, contactId, noteId);
    const events = await database.query(
      `SELECT id, action, from_version, to_version, metadata, created_at
       FROM messaging_continuity_events
       WHERE account_id = $1
         AND (
           (subject_type = 'contact_note' AND subject_id = $2)
           OR (
             subject_type = 'contact_note_attachment'
             AND metadata ->> 'noteId' = $2
           )
         )
       ORDER BY created_at DESC, id DESC
       LIMIT 100`,
      [accountId, noteId],
    );
    response.json({
      data: {
        history: events.rows.map((event) => ({
          id: event.id,
          action: event.action,
          fromVersion: event.from_version === null ? null : Number(event.from_version),
          toVersion: event.to_version === null ? null : Number(event.to_version),
          body: typeof event.metadata?.body === "string" ? event.metadata.body : null,
          createdAt: iso(event.created_at),
        })),
      },
      meta: { requestId: request.requestId },
    });
  }));

  app.post("/api/v1/contacts/:contactId/notes", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
    const contactId = validate(z.uuid(), request.params.contactId);
    const input = validate(noteCreateSchema, request.body);
    const accountId = request.actor.account.id;
    const result = await runIdempotentMutation(request, accountId, `contact-note.create:${contactId}`, async (client) => {
      await assertContactOwner(client, accountId, contactId);
      const inserted = await client.query(
        `INSERT INTO contact_notes (account_id, contact_id, body, occurred_at)
         VALUES ($1, $2, $3, COALESCE($4::timestamptz, now())) RETURNING *`,
        [accountId, contactId, input.body, input.occurredAt],
      );
      await insertEvent(client, {
        accountId,
        subjectType: "contact_note",
        subjectId: inserted.rows[0].id,
        action: "created",
        toVersion: 1,
        metadata: { body: inserted.rows[0].body },
      });
      return {
        status: 201,
        body: {
          data: { note: await mapNote(inserted.rows[0], [], signedObjectUrl) },
          meta: { requestId: request.requestId },
        },
      };
    });
    sendIdempotentResult(response, result);
  }));

  app.patch("/api/v1/contacts/:contactId/notes/:noteId", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
    const contactId = validate(z.uuid(), request.params.contactId);
    const noteId = validate(z.uuid(), request.params.noteId);
    const input = validate(noteUpdateSchema, request.body);
    const accountId = request.actor.account.id;
    const updated = await database.query(
      `UPDATE contact_notes SET body = $4, version = version + 1, updated_at = now()
       WHERE id = $1 AND contact_id = $2 AND account_id = $3
         AND version = $5 AND archived_at IS NULL RETURNING *`,
      [noteId, contactId, accountId, input.body, input.expectedVersion],
    );
    if (!updated.rowCount) throw new ApiError(409, "CONTACT_NOTE_CONFLICT", "This note changed on another device.");
    const attachments = await noteAttachments(database, [noteId]);
    await insertEvent(database, {
      accountId,
      subjectType: "contact_note",
      subjectId: noteId,
      action: "updated",
      fromVersion: input.expectedVersion,
      toVersion: updated.rows[0].version,
      metadata: { body: updated.rows[0].body },
    });
    response.json({
      data: { note: await mapNote(updated.rows[0], attachments.get(noteId) ?? [], signedObjectUrl) },
      meta: { requestId: request.requestId },
    });
  }));

  async function setNoteArchive(request, response, archived) {
    const contactId = validate(z.uuid(), request.params.contactId);
    const noteId = validate(z.uuid(), request.params.noteId);
    const input = validate(versionSchema, request.body);
    const accountId = request.actor.account.id;
    const updated = await database.query(
      `UPDATE contact_notes
       SET archived_at = ${archived ? "now()" : "NULL"}, version = version + 1, updated_at = now()
       WHERE id = $1 AND contact_id = $2 AND account_id = $3 AND version = $4
         AND archived_at IS ${archived ? "NULL" : "NOT NULL"} RETURNING *`,
      [noteId, contactId, accountId, input.expectedVersion],
    );
    if (!updated.rowCount) throw new ApiError(409, "CONTACT_NOTE_CONFLICT", "This note changed on another device.");
    const attachments = await noteAttachments(database, [noteId]);
    await insertEvent(database, {
      accountId,
      subjectType: "contact_note",
      subjectId: noteId,
      action: archived ? "archived" : "restored",
      fromVersion: input.expectedVersion,
      toVersion: updated.rows[0].version,
      metadata: { body: updated.rows[0].body },
    });
    response.json({
      data: { note: await mapNote(updated.rows[0], attachments.get(noteId) ?? [], signedObjectUrl) },
      meta: { requestId: request.requestId },
    });
  }

  app.post("/api/v1/contacts/:contactId/notes/:noteId/archive", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(
    async (request, response) => setNoteArchive(request, response, true),
  ));
  app.post("/api/v1/contacts/:contactId/notes/:noteId/restore", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(
    async (request, response) => setNoteArchive(request, response, false),
  ));

  app.post(
    "/api/v1/contacts/:contactId/notes/:noteId/attachments",
    requireV1AuthenticatedUser,
    requireV1Actor,
    uploadRateLimit,
    upload.single("file"),
    asyncRoute(applicationObjectMutationBarrier(async (request, response) => {
      const contactId = validate(z.uuid(), request.params.contactId);
      const noteId = validate(z.uuid(), request.params.noteId);
      const expectedVersion = validate(z.coerce.number().int().positive(), request.body?.expectedVersion);
      const accountId = request.actor.account.id;
      validatePrivateFile(request.file, detectUploadContent);
      if (!s3Client || !s3Bucket) throw new ApiError(503, "OBJECT_STORAGE_UNAVAILABLE", "Managed note storage is unavailable.");
      const note = await loadNote(database, accountId, contactId, noteId, { includeArchived: false });
      if (Number(note.version) !== expectedVersion) throw new ApiError(409, "CONTACT_NOTE_CONFLICT", "This note changed on another device.");
      const uploadId = randomUUID();
      const attachmentId = randomUUID();
      const objectKey = `contact-notes/${safeObjectName(accountId)}/${safeObjectName(contactId)}/${noteId}/${uploadId}-${safeObjectName(request.file.originalname)}`;
      const contentHash = sha256Buffer(request.file.buffer);
      await s3Client.send(new PutObjectCommand({
        Bucket: s3Bucket,
        Key: objectKey,
        Body: request.file.buffer,
        ContentType: request.file.mimetype,
        Metadata: { source: "rivt-contact-note", contentSha256: contentHash },
      }));
      try {
        const updated = await withTransaction(async (client) => {
          const locked = await loadNote(client, accountId, contactId, noteId, { includeArchived: false });
          if (Number(locked.version) !== expectedVersion) throw new ApiError(409, "CONTACT_NOTE_CONFLICT", "This note changed on another device.");
          await client.query(
            `INSERT INTO uploads (
               id, session_id, account_id, kind, name, object_key, original_name,
               mime_type, size_bytes, upload_status, storage_scope, content_sha256, verified_at
             ) VALUES ($1, $2::text, $2::uuid, 'contact-note-attachment', $3, $4, $5, $6, $7,
                       'stored', 'contact-note', $8, now())`,
            [uploadId, accountId, request.file.originalname.slice(0, 240), objectKey,
              request.file.originalname, request.file.mimetype, request.file.size, contentHash],
          );
          await client.query(
            `INSERT INTO contact_note_attachments (
               id, note_id, upload_id, original_name, mime_type, size_bytes
             ) VALUES ($1, $2, $3, $4, $5, $6)`,
            [attachmentId, noteId, uploadId, request.file.originalname.slice(0, 240),
              request.file.mimetype, request.file.size],
          );
          const next = await client.query(
            "UPDATE contact_notes SET version = version + 1, updated_at = now() WHERE id = $1 RETURNING *",
            [noteId],
          );
          await insertEvent(client, {
            accountId,
            subjectType: "contact_note_attachment",
            subjectId: attachmentId,
            action: "uploaded",
            toVersion: 1,
            metadata: { noteId, mimeType: request.file.mimetype, sizeBytes: request.file.size },
          });
          return next.rows[0];
        });
        const attachments = await noteAttachments(database, [noteId]);
        response.status(201).json({
          data: { note: await mapNote(updated, attachments.get(noteId) ?? [], signedObjectUrl) },
          meta: { requestId: request.requestId },
        });
      } catch (error) {
        await s3Client.send(new DeleteObjectCommand({ Bucket: s3Bucket, Key: objectKey })).catch(() => undefined);
        throw error;
      }
    })),
  );

  app.delete("/api/v1/contacts/:contactId/notes/:noteId/attachments/:attachmentId", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(applicationObjectMutationBarrier(async (request, response) => {
    const contactId = validate(z.uuid(), request.params.contactId);
    const noteId = validate(z.uuid(), request.params.noteId);
    const attachmentId = validate(z.uuid(), request.params.attachmentId);
    const input = validate(versionSchema, request.body);
    const accountId = request.actor.account.id;
    const note = await loadNote(database, accountId, contactId, noteId);
    if (Number(note.version) !== input.expectedVersion) throw new ApiError(409, "CONTACT_NOTE_CONFLICT", "This note changed on another device.");
    const attachment = await database.query(
      `SELECT attachment.*, upload.object_key
       FROM contact_note_attachments attachment
       INNER JOIN uploads upload ON upload.id = attachment.upload_id
       WHERE attachment.id = $1 AND attachment.note_id = $2 AND attachment.removed_at IS NULL`,
      [attachmentId, noteId],
    );
    if (!attachment.rowCount) throw new ApiError(404, "CONTACT_NOTE_ATTACHMENT_NOT_FOUND", "Attachment not found.");
    const updated = await withTransaction(async (client) => {
      await client.query(
        "UPDATE contact_note_attachments SET removed_at = now(), version = version + 1 WHERE id = $1",
        [attachmentId],
      );
      await client.query("UPDATE uploads SET upload_status = 'removed' WHERE id = $1", [attachment.rows[0].upload_id]);
      const next = await client.query(
        "UPDATE contact_notes SET version = version + 1, updated_at = now() WHERE id = $1 RETURNING *",
        [noteId],
      );
      await insertEvent(client, {
        accountId,
        subjectType: "contact_note_attachment",
        subjectId: attachmentId,
        action: "removed",
        fromVersion: attachment.rows[0].version,
        toVersion: Number(attachment.rows[0].version) + 1,
        metadata: { noteId },
      });
      return next.rows[0];
    });
    if (attachment.rows[0].object_key && s3Client && s3Bucket) {
      await s3Client.send(new DeleteObjectCommand({ Bucket: s3Bucket, Key: attachment.rows[0].object_key })).catch(() => undefined);
    }
    const attachments = await noteAttachments(database, [noteId]);
    response.json({
      data: { note: await mapNote(updated, attachments.get(noteId) ?? [], signedObjectUrl) },
      meta: { requestId: request.requestId },
    });
  })));
}

export const messagingContinuityInternals = {
  mapPreference,
  mapTemplate,
  reactionSummary,
  rejectLocationMetadata,
  templateCreateSchema,
  preferenceSchema,
  reactionSchema,
  noteCreateSchema,
};
