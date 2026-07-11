import { type ApiErrorBody, RivtApiError, UPLOAD_REQUEST_TIMEOUT_MS, apiPath, fetchWithTimeout, requestKey, makeRequest, notifySessionExpired } from "../../lib/api";

export class AlbumApiError extends RivtApiError {
  constructor(status: number, body: ApiErrorBody) {
    super(status, body, "RIVT could not complete the album request.");
    this.name = "AlbumApiError";
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
  standaloneProjectId: string | null;
  photoCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AlbumDetail extends PhotoAlbum {
  photos: AlbumPhoto[];
}

const request = makeRequest((s, b) => new AlbumApiError(s, b));

export async function listAlbums() {
  const body = await request<{ data: { albums: PhotoAlbum[] } }>("/api/v1/albums");
  return body.data.albums;
}

export async function createAlbum(name: string, standaloneProjectId: string | null = null) {
  const body = await request<{ data: { album: PhotoAlbum } }>("/api/v1/albums", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": requestKey() },
    body: JSON.stringify({ name, standaloneProjectId }),
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
  const response = await fetchWithTimeout(apiPath(`/api/v1/albums/${albumId}/photos`), {
    method: "POST",
    credentials: "include",
    headers: { "Idempotency-Key": requestKey() },
    body: form,
  }, UPLOAD_REQUEST_TIMEOUT_MS);
  const body = await response.json().catch(() => ({})) as ApiErrorBody & { data?: { photo: AlbumPhoto } };
  if (response.status === 401) notifySessionExpired();
  if (!response.ok) throw new AlbumApiError(response.status, body);
  return body.data!.photo;
}
