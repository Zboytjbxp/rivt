import { PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";
import { ApiError, asyncRoute, validate, z } from "./api.js";

const albumCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  standaloneProjectId: z.uuid().nullable().optional().default(null),
});

async function mapAlbumRow(database, signedObjectUrl, row, { withPhotos = false } = {}) {
  const base = {
    id: row.id,
    accountId: row.account_id,
    name: row.name,
    standaloneProjectId: row.standalone_project_id ?? null,
    isDefault: Boolean(row.is_default),
    photoCount: Number(row.photo_count ?? 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  const coverPhoto = row.cover_photo_id
    ? {
        id: row.cover_photo_id,
        albumId: row.cover_photo_album_id,
        uploadId: row.cover_photo_upload_id,
        caption: row.cover_photo_caption ?? "",
        originalName: row.cover_photo_original_name,
        mimeType: row.cover_photo_mime_type,
        sizeBytes: Number(row.cover_photo_size_bytes ?? 0),
        createdAt: row.cover_photo_created_at,
        signedUrl: await signedObjectUrl(row.cover_photo_object_key),
      }
    : null;
  if (!withPhotos) return { ...base, coverPhoto };
  const photoRows = await database.query(
    `SELECT ap.id, ap.album_id, ap.upload_id, ap.caption, ap.created_at,
            u.original_name, u.mime_type, u.size_bytes, u.object_key
     FROM album_photos ap
     JOIN uploads u ON u.id = ap.upload_id
     WHERE ap.album_id = $1 AND u.upload_status = 'stored'
     ORDER BY ap.created_at ASC, ap.id ASC`,
    [row.id],
  );
  const photos = await Promise.all(
    photoRows.rows.map(async (p) => ({
      id: p.id,
      albumId: p.album_id,
      uploadId: p.upload_id,
      caption: p.caption,
      originalName: p.original_name,
      mimeType: p.mime_type,
      sizeBytes: Number(p.size_bytes ?? 0),
      createdAt: p.created_at,
      signedUrl: await signedObjectUrl(p.object_key),
    })),
  );
  return { ...base, coverPhoto, photos };
}

export function registerAlbumRoutes({
  app,
  database,
  requireV1AuthenticatedUser,
  requireV1Actor,
  writeRateLimit,
  uploadRateLimit,
  upload,
  sha256Buffer,
  detectUploadContent,
  signedObjectUrl,
  s3Client,
  s3Bucket,
}) {
  app.get("/api/v1/albums", requireV1AuthenticatedUser, requireV1Actor, asyncRoute(async (request, response) => {
    const rows = await database.query(
      `SELECT pa.*,
              (SELECT COUNT(*)::int FROM album_photos ap WHERE ap.album_id = pa.id) AS photo_count,
              latest.id AS cover_photo_id,
              latest.album_id AS cover_photo_album_id,
              latest.upload_id AS cover_photo_upload_id,
              latest.caption AS cover_photo_caption,
              latest.created_at AS cover_photo_created_at,
              latest.original_name AS cover_photo_original_name,
              latest.mime_type AS cover_photo_mime_type,
              latest.size_bytes AS cover_photo_size_bytes,
              latest.object_key AS cover_photo_object_key
       FROM photo_albums pa
       LEFT JOIN LATERAL (
         SELECT ap.id, ap.album_id, ap.upload_id, ap.caption, ap.created_at,
                u.original_name, u.mime_type, u.size_bytes, u.object_key
         FROM album_photos ap
         JOIN uploads u ON u.id = ap.upload_id
         WHERE ap.album_id = pa.id AND u.upload_status = 'stored'
         ORDER BY ap.created_at DESC, ap.id DESC
         LIMIT 1
       ) latest ON true
       WHERE pa.account_id = $1
       ORDER BY pa.updated_at DESC, pa.id DESC
       LIMIT 100`,
      [request.actor.account.id],
    );
    response.json({
      data: { albums: await Promise.all(rows.rows.map((row) => mapAlbumRow(database, signedObjectUrl, row))) },
      meta: { requestId: request.requestId },
    });
  }));

  app.get("/api/v1/albums/recent", requireV1AuthenticatedUser, requireV1Actor, asyncRoute(async (request, response) => {
    const rows = await database.query(
      `SELECT ap.id, ap.album_id, ap.upload_id, ap.caption, ap.created_at,
              pa.name AS album_name, pa.is_default,
              u.original_name, u.mime_type, u.size_bytes, u.object_key
       FROM album_photos ap
       JOIN photo_albums pa ON pa.id = ap.album_id
       JOIN uploads u ON u.id = ap.upload_id
       WHERE pa.account_id = $1
         AND pa.standalone_project_id IS NULL
         AND u.upload_status = 'stored'
       ORDER BY ap.created_at DESC, ap.id DESC
       LIMIT 6`,
      [request.actor.account.id],
    );
    const captures = await Promise.all(rows.rows.map(async (row) => ({
      album: { id: row.album_id, name: row.album_name, isDefault: Boolean(row.is_default) },
      photo: {
        id: row.id,
        albumId: row.album_id,
        uploadId: row.upload_id,
        caption: row.caption ?? "",
        originalName: row.original_name,
        mimeType: row.mime_type,
        sizeBytes: Number(row.size_bytes ?? 0),
        createdAt: row.created_at,
        signedUrl: await signedObjectUrl(row.object_key),
      },
    })));
    response.json({ data: { captures }, meta: { requestId: request.requestId } });
  }));

  app.post("/api/v1/albums/default", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
    const row = await database.query(
      `INSERT INTO photo_albums (id, account_id, name, is_default)
       VALUES ($1, $2, 'Private photos', true)
       ON CONFLICT (account_id) WHERE is_default
       DO UPDATE SET name = photo_albums.name
       RETURNING *`,
      [randomUUID(), request.actor.account.id],
    );
    const photoCount = await database.query(
      "SELECT COUNT(*)::int AS photo_count FROM album_photos WHERE album_id = $1",
      [row.rows[0].id],
    );
    response.json({
      data: { album: await mapAlbumRow(database, signedObjectUrl, { ...row.rows[0], photo_count: photoCount.rows[0].photo_count }) },
      meta: { requestId: request.requestId },
    });
  }));

  app.post("/api/v1/albums", requireV1AuthenticatedUser, requireV1Actor, writeRateLimit, asyncRoute(async (request, response) => {
    const input = validate(albumCreateSchema, request.body);
    const id = randomUUID();
    const row = await database.query(
      `INSERT INTO photo_albums (id, account_id, name, standalone_project_id)
       SELECT $1, $2, $3, sp.id
       FROM (SELECT $4::uuid AS requested_id) requested
       LEFT JOIN standalone_projects sp ON sp.id = requested.requested_id AND sp.account_id = $2 AND sp.status = 'active'
       WHERE requested.requested_id IS NULL OR sp.id IS NOT NULL
       RETURNING *`,
      [id, request.actor.account.id, input.name, input.standaloneProjectId],
    );
    if (!row.rowCount) throw new ApiError(403, "STANDALONE_PROJECT_ACCESS_DENIED", "You cannot create an album for that standalone project.");
    response.status(201).json({
      data: { album: await mapAlbumRow(database, signedObjectUrl, { ...row.rows[0], photo_count: 0 }) },
      meta: { requestId: request.requestId },
    });
  }));

  app.get("/api/v1/albums/:id", requireV1AuthenticatedUser, requireV1Actor, asyncRoute(async (request, response) => {
    const albumId = validate(z.uuid(), request.params.id);
    const row = await database.query(
      `SELECT pa.*, COUNT(ap.id)::int AS photo_count
       FROM photo_albums pa
       LEFT JOIN album_photos ap ON ap.album_id = pa.id
       WHERE pa.id = $1 AND pa.account_id = $2
       GROUP BY pa.id`,
      [albumId, request.actor.account.id],
    );
    if (!row.rowCount) throw new ApiError(404, "ALBUM_NOT_FOUND", "Album not found.");
    response.json({
      data: { album: await mapAlbumRow(database, signedObjectUrl, row.rows[0], { withPhotos: true }) },
      meta: { requestId: request.requestId },
    });
  }));

  app.post(
    "/api/v1/albums/:id/photos",
    requireV1AuthenticatedUser,
    requireV1Actor,
    uploadRateLimit,
    upload.single("file"),
    asyncRoute(async (request, response) => {
      const albumId = validate(z.uuid(), request.params.id);
      if (!request.file) throw new ApiError(400, "UPLOAD_REQUIRED", "A file field named `file` is required.");

      const albumRow = await database.query(
        "SELECT id FROM photo_albums WHERE id = $1 AND account_id = $2",
        [albumId, request.actor.account.id],
      );
      if (!albumRow.rowCount) throw new ApiError(404, "ALBUM_NOT_FOUND", "Album not found.");

      const contentHash = sha256Buffer(request.file.buffer);
      const detection = detectUploadContent(request.file);
      const name = String(request.body?.name ?? request.file.originalname ?? "Photo").trim().slice(0, 240);
      const caption = String(request.body?.caption ?? "").trim().slice(0, 500);

      if (!detection.ok) {
        throw new ApiError(422, detection.code, detection.message);
      }

      const uploadId = randomUUID();
      const photoId = randomUUID();
      const objectKey = `albums/${request.actor.account.id}/${albumId}/${uploadId}/${request.file.originalname}`;

      await s3Client.send(
        new PutObjectCommand({
          Bucket: s3Bucket,
          Key: objectKey,
          Body: request.file.buffer,
          ContentType: request.file.mimetype,
          Metadata: { contentSha256: contentHash },
        }),
      );

      await database.query(
        `INSERT INTO uploads (id, session_id, account_id, kind, name, original_name, mime_type,
          size_bytes, object_key, upload_status, storage_scope, content_sha256)
         VALUES ($1, $2::text, $2::uuid, 'album-photo', $3, $4, $5, $6, $7, 'stored', 'album', $8)`,
        [
          uploadId,
          request.actor.account.id,
          name,
          request.file.originalname,
          request.file.mimetype,
          request.file.size,
          objectKey,
          contentHash,
        ],
      );

      await database.query(
        `INSERT INTO album_photos (id, album_id, upload_id, caption) VALUES ($1, $2, $3, $4)`,
        [photoId, albumId, uploadId, caption],
      );

      await database.query(
        "UPDATE photo_albums SET updated_at = now() WHERE id = $1",
        [albumId],
      );

      const signedUrl = await signedObjectUrl(objectKey);
      response.status(201).json({
        data: {
          photo: {
            id: photoId,
            albumId,
            uploadId,
            caption,
            originalName: request.file.originalname,
            mimeType: request.file.mimetype,
            sizeBytes: request.file.size,
            createdAt: new Date().toISOString(),
            signedUrl,
          },
        },
        meta: { requestId: request.requestId },
      });
    }),
  );
}
