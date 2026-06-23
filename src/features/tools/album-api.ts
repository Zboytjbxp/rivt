interface ApiErrorBody {
  error?: { code?: string; message?: string };
}

export class AlbumApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, body: ApiErrorBody) {
    super(body.error?.message || "RIVT could not complete the album request.");
    this.name = "AlbumApiError";
    this.status = status;
    this.code = body.error?.code || "REQUEST_FAILED";
  }
}

export interface AlbumPhoto {
  id: string;
  albumId: string;
  uploadId: string;
  caption: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  signedUrl: string | null;
}

export interface PhotoAlbum {
  id: string;
  name: string;
  photoCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AlbumDetail extends PhotoAlbum {
  photos: AlbumPhoto[];
}

function apiPath(path: string) {
  const base = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? "http://127.0.0.1:8787" : "");
  return `${base}${path}`;
}

function requestKey() {
  return globalThis.crypto?.randomUUID?.() ?? `rivt-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function request<T>(path: string, options: RequestInit = {}) {
  const response = await fetch(apiPath(path), { credentials: "include", ...options });
  const body = await response.json().catch(() => ({})) as ApiErrorBody & T;
  if (!response.ok) throw new AlbumApiError(response.status, body);
  return body;
}

export async function listAlbums() {
  const body = await request<{ data: { albums: PhotoAlbum[] } }>("/api/v1/albums");
  return body.data.albums;
}

export async function createAlbum(name: string) {
  const body = await request<{ data: { album: PhotoAlbum } }>("/api/v1/albums", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": requestKey() },
    body: JSON.stringify({ name }),
  });
  return body.data.album;
}

export async function getAlbum(albumId: string) {
  const body = await request<{ data: { album: AlbumDetail } }>(`/api/v1/albums/${albumId}`);
  return body.data.album;
}

export async function uploadAlbumPhoto(albumId: string, file: File, caption = "") {
  const form = new FormData();
  form.append("file", file);
  form.append("name", file.name);
  form.append("caption", caption);
  const response = await fetch(apiPath(`/api/v1/albums/${albumId}/photos`), {
    method: "POST",
    credentials: "include",
    headers: { "Idempotency-Key": requestKey() },
    body: form,
  });
  const body = await response.json().catch(() => ({})) as ApiErrorBody & { data?: { photo: AlbumPhoto } };
  if (!response.ok) throw new AlbumApiError(response.status, body);
  return body.data!.photo;
}
