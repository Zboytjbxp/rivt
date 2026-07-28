import { apiPath, fetchWithTimeout, notifySessionExpired } from "./api";

export const OFFLINE_QUEUE_CHANGED_EVENT = "rivt:offline-queue-changed";
export const OFFLINE_QUEUE_MAX_PHOTOS = 25;
export const OFFLINE_QUEUE_MAX_PHOTO_BYTES = 10 * 1024 * 1024;
export const OFFLINE_QUEUE_MAX_TOTAL_PHOTO_BYTES = 100 * 1024 * 1024;
export const OFFLINE_QUEUE_STALE_DAYS = 30;

const DB_NAME = "rivt-offline-recovery";
const DB_VERSION = 1;
const STORE_NAME = "operations";
const runningFlushes = new Map<string, Promise<OfflineFlushResult>>();

export type OfflineOperationKind =
  | "workspace_record_create"
  | "daily_log_upsert"
  | "project_media_upload"
  | "album_photo_upload";

export type OfflineOperationStatus = "queued" | "syncing" | "failed" | "conflicted";

export interface OfflineFilePayload {
  blob: Blob;
  name: string;
  type: string;
  lastModified: number;
  size: number;
}

export interface OfflineWorkspaceRecordPayload {
  projectId: string;
  recordType: "checklist" | "note";
  input: {
    recordType: "checklist" | "note";
    visibility: "shared" | "private";
    title: string;
    details: string;
    requestedBy: string;
    amountCents: number;
    dueNote: string;
    state: "open" | "active";
  };
}

export interface OfflineDailyLogPayload {
  input: {
    recordType: "daily_report";
    localId: string;
    title: string;
    status: string;
    recordDate: string | null;
    amountCents: number | null;
    standaloneProjectId?: string | null;
    activeWorkId?: string | null;
    customerId?: string | null;
    payload: Record<string, unknown>;
  };
}

export interface OfflineProjectMediaPayload {
  projectId: string;
  notes: string;
  file: OfflineFilePayload;
}

export interface OfflineAlbumPhotoPayload {
  albumId: string;
  caption: string;
  file: OfflineFilePayload;
}

export type OfflineOperationPayload =
  | OfflineWorkspaceRecordPayload
  | OfflineDailyLogPayload
  | OfflineProjectMediaPayload
  | OfflineAlbumPhotoPayload;

export interface OfflineOperation {
  id: string;
  accountId: string;
  kind: OfflineOperationKind;
  status: OfflineOperationStatus;
  payload: OfflineOperationPayload;
  idempotencyKey: string;
  dedupeKey: string | null;
  label: string;
  destinationLabel: string;
  createdAt: string;
  updatedAt: string;
  attempts: number;
  nextAttemptAt: string | null;
  lastError: string | null;
}

export interface OfflineEnqueueInput {
  accountId: string;
  kind: OfflineOperationKind;
  payload: OfflineOperationPayload;
  idempotencyKey: string;
  dedupeKey?: string | null;
  label: string;
  destinationLabel: string;
}

export interface OfflineFlushResult {
  synced: number;
  queued: number;
  failed: number;
  conflicted: number;
}

export class OfflineQueueError extends Error {
  code: "OFFLINE_STORAGE_UNAVAILABLE" | "OFFLINE_PHOTO_TOO_LARGE" | "OFFLINE_PHOTO_LIMIT";

  constructor(code: OfflineQueueError["code"], message: string) {
    super(message);
    this.name = "OfflineQueueError";
    this.code = code;
  }
}

function emitChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(OFFLINE_QUEUE_CHANGED_EVENT));
}

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Offline storage request failed."));
  });
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error("Offline storage transaction was cancelled."));
    transaction.onerror = () => reject(transaction.error ?? new Error("Offline storage transaction failed."));
  });
}

async function openDatabase() {
  if (typeof indexedDB === "undefined") {
    throw new OfflineQueueError("OFFLINE_STORAGE_UNAVAILABLE", "This browser cannot keep an offline sync queue.");
  }
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (database.objectStoreNames.contains(STORE_NAME)) return;
      const store = database.createObjectStore(STORE_NAME, { keyPath: "id" });
      store.createIndex("accountId", "accountId", { unique: false });
      store.createIndex("accountDedupe", ["accountId", "kind", "dedupeKey"], { unique: false });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Offline storage could not be opened."));
    request.onblocked = () => reject(new Error("Offline storage upgrade is blocked by another RIVT tab."));
  });
}

async function allOperations() {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, "readonly");
    return await requestResult(transaction.objectStore(STORE_NAME).getAll()) as OfflineOperation[];
  } finally {
    database.close();
  }
}

async function putOperation(operation: OfflineOperation) {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(operation);
    await transactionDone(transaction);
  } finally {
    database.close();
  }
}

export async function removeOfflineOperation(id: string) {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(id);
    await transactionDone(transaction);
  } finally {
    database.close();
  }
  emitChanged();
}

export function isOfflinePhotoKind(kind: OfflineOperationKind) {
  return kind === "project_media_upload" || kind === "album_photo_upload";
}

export function offlineRetryDelayMs(attempts: number) {
  return Math.min(5 * 60_000, 2_000 * (2 ** Math.max(0, Math.min(attempts, 8))));
}

export function offlineFailureStatus(status: number) {
  if (status === 409) return "conflicted" as const;
  if (status === 0 || status === 408 || status === 425 || status === 429 || status >= 500) return "queued" as const;
  return "failed" as const;
}

export function isOfflineOperationStale(operation: Pick<OfflineOperation, "createdAt">, now = Date.now()) {
  const createdAt = Date.parse(operation.createdAt);
  return Number.isFinite(createdAt) && now - createdAt > OFFLINE_QUEUE_STALE_DAYS * 24 * 60 * 60 * 1000;
}

export async function listOfflineOperations(accountId: string) {
  const operations = (await allOperations())
    .filter((operation) => operation.accountId === accountId)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  let changed = false;
  const now = new Date().toISOString();
  for (const operation of operations) {
    if (!isOfflinePhotoKind(operation.kind) || operation.status === "failed" || !isOfflineOperationStale(operation)) continue;
    operation.status = "failed";
    operation.updatedAt = now;
    operation.nextAttemptAt = null;
    operation.lastError = "This photo has waited more than 30 days. Retry it or discard the device copy.";
    await putOperation(operation);
    changed = true;
  }
  if (changed) emitChanged();
  return operations;
}

function photoSize(input: OfflineEnqueueInput) {
  if (input.kind === "project_media_upload") return (input.payload as OfflineProjectMediaPayload).file.size;
  if (input.kind === "album_photo_upload") return (input.payload as OfflineAlbumPhotoPayload).file.size;
  return 0;
}

function operationPhotoSize(operation: OfflineOperation) {
  if (operation.kind === "project_media_upload") return (operation.payload as OfflineProjectMediaPayload).file.size;
  if (operation.kind === "album_photo_upload") return (operation.payload as OfflineAlbumPhotoPayload).file.size;
  return 0;
}

export function offlinePhotoQueueUsage(operations: OfflineOperation[], accountId: string) {
  const photos = operations.filter((operation) => operation.accountId === accountId && isOfflinePhotoKind(operation.kind));
  return {
    count: photos.length,
    bytes: photos.reduce((sum, operation) => sum + operationPhotoSize(operation), 0),
  };
}

export function findReplaceableOfflineOperation(operations: OfflineOperation[], input: OfflineEnqueueInput) {
  if (!input.dedupeKey) return null;
  return operations.find((operation) => (
    operation.accountId === input.accountId
    && operation.kind === input.kind
    && operation.dedupeKey === input.dedupeKey
    && operation.status !== "syncing"
  )) ?? null;
}

export async function enqueueOfflineOperation(input: OfflineEnqueueInput) {
  const current = await allOperations();
  const size = photoSize(input);
  if (size > OFFLINE_QUEUE_MAX_PHOTO_BYTES) {
    throw new OfflineQueueError(
      "OFFLINE_PHOTO_TOO_LARGE",
      "This photo is larger than the 10 MB offline limit. Keep the original on your device and upload it when connected.",
    );
  }
  if (isOfflinePhotoKind(input.kind)) {
    const usage = offlinePhotoQueueUsage(current, input.accountId);
    if (usage.count >= OFFLINE_QUEUE_MAX_PHOTOS || usage.bytes + size > OFFLINE_QUEUE_MAX_TOTAL_PHOTO_BYTES) {
      throw new OfflineQueueError(
        "OFFLINE_PHOTO_LIMIT",
        "Offline photo storage is full. Retry or discard a queued photo before adding another.",
      );
    }
  }

  const now = new Date().toISOString();
  const replaceable = findReplaceableOfflineOperation(current, input);
  const operation: OfflineOperation = {
    id: replaceable?.id ?? globalThis.crypto?.randomUUID?.() ?? `offline-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    accountId: input.accountId,
    kind: input.kind,
    status: "queued",
    payload: input.payload,
    idempotencyKey: replaceable?.idempotencyKey ?? input.idempotencyKey,
    dedupeKey: input.dedupeKey ?? null,
    label: input.label,
    destinationLabel: input.destinationLabel,
    createdAt: replaceable?.createdAt ?? now,
    updatedAt: now,
    attempts: replaceable?.attempts ?? 0,
    nextAttemptAt: null,
    lastError: null,
  };
  try {
    await putOperation(operation);
  } catch (cause) {
    throw new OfflineQueueError(
      "OFFLINE_STORAGE_UNAVAILABLE",
      cause instanceof DOMException && cause.name === "QuotaExceededError"
        ? "This device is out of offline storage. Free device space or discard saved RIVT work, then try again."
        : "This device could not save that work for offline recovery. Keep the original and try again when connected.",
    );
  }
  emitChanged();
  return operation;
}

function fileFromPayload(file: OfflineFilePayload) {
  return new File([file.blob], file.name, {
    type: file.type || file.blob.type || "application/octet-stream",
    lastModified: file.lastModified,
  });
}

async function sendOperation(operation: OfflineOperation) {
  let path: string;
  let options: RequestInit;
  if (operation.kind === "workspace_record_create") {
    const payload = operation.payload as OfflineWorkspaceRecordPayload;
    path = `/api/v1/projects/${encodeURIComponent(payload.projectId)}/workspace-records`;
    options = {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", "Idempotency-Key": operation.idempotencyKey },
      body: JSON.stringify(payload.input),
    };
  } else if (operation.kind === "daily_log_upsert") {
    const payload = operation.payload as OfflineDailyLogPayload;
    path = "/api/v1/tool-records";
    options = {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", "Idempotency-Key": operation.idempotencyKey },
      body: JSON.stringify(payload.input),
    };
  } else if (operation.kind === "project_media_upload") {
    const payload = operation.payload as OfflineProjectMediaPayload;
    const file = fileFromPayload(payload.file);
    const form = new FormData();
    form.append("name", file.name);
    form.append("notes", payload.notes);
    form.append("file", file);
    path = `/api/v1/projects/${encodeURIComponent(payload.projectId)}/media`;
    options = {
      method: "POST",
      credentials: "include",
      headers: { "Idempotency-Key": operation.idempotencyKey },
      body: form,
    };
  } else if (operation.kind === "album_photo_upload") {
    const payload = operation.payload as OfflineAlbumPhotoPayload;
    const file = fileFromPayload(payload.file);
    const form = new FormData();
    form.append("file", file);
    form.append("name", file.name);
    form.append("caption", payload.caption);
    path = `/api/v1/albums/${encodeURIComponent(payload.albumId)}/photos`;
    options = {
      method: "POST",
      credentials: "include",
      headers: { "Idempotency-Key": operation.idempotencyKey },
      body: form,
    };
  } else {
    return { status: 422, message: "This RIVT version cannot sync this saved item." };
  }

  try {
    const response = await fetchWithTimeout(apiPath(path), options, isOfflinePhotoKind(operation.kind) ? 60_000 : undefined);
    const body = await response.json().catch(() => ({})) as { error?: { message?: string } };
    if (response.status === 401) notifySessionExpired();
    return {
      status: response.status,
      message: response.ok ? "" : body.error?.message ?? "RIVT could not sync this saved item.",
    };
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 0;
    return {
      status: Number.isFinite(status) ? status : 0,
      message: error instanceof Error ? error.message : "Connection problem - this item is still saved on this device.",
    };
  }
}

async function flushAccount(accountId: string, force: boolean): Promise<OfflineFlushResult> {
  const result: OfflineFlushResult = { synced: 0, queued: 0, failed: 0, conflicted: 0 };
  const operations = await listOfflineOperations(accountId);
  for (const operation of operations) {
    if (operation.status === "conflicted" || (operation.status === "failed" && !force)) {
      result[operation.status === "conflicted" ? "conflicted" : "failed"] += 1;
      continue;
    }
    if (!force && operation.nextAttemptAt && Date.parse(operation.nextAttemptAt) > Date.now()) {
      result.queued += 1;
      continue;
    }

    operation.status = "syncing";
    operation.updatedAt = new Date().toISOString();
    operation.lastError = null;
    await putOperation(operation);
    emitChanged();

    const response = await sendOperation(operation);
    if (response.status >= 200 && response.status < 300) {
      await removeOfflineOperation(operation.id);
      result.synced += 1;
      continue;
    }

    const status = offlineFailureStatus(response.status);
    operation.status = status;
    operation.attempts += 1;
    operation.updatedAt = new Date().toISOString();
    operation.lastError = response.message;
    operation.nextAttemptAt = status === "queued"
      ? new Date(Date.now() + offlineRetryDelayMs(operation.attempts)).toISOString()
      : null;
    await putOperation(operation);
    emitChanged();
    result[status === "queued" ? "queued" : status === "failed" ? "failed" : "conflicted"] += 1;
    if (status === "queued" && response.status === 0) break;
  }
  return result;
}

export function flushOfflineQueue(accountId: string, options: { force?: boolean } = {}) {
  const existing = runningFlushes.get(accountId);
  if (existing) return existing;
  const task = flushAccount(accountId, Boolean(options.force)).finally(() => {
    runningFlushes.delete(accountId);
    emitChanged();
  });
  runningFlushes.set(accountId, task);
  return task;
}

export async function retryOfflineOperation(id: string, accountId: string) {
  const operation = (await allOperations()).find((item) => item.id === id && item.accountId === accountId);
  if (!operation) return;
  operation.status = "queued";
  operation.nextAttemptAt = null;
  operation.lastError = null;
  operation.updatedAt = new Date().toISOString();
  await putOperation(operation);
  emitChanged();
  await flushOfflineQueue(accountId, { force: true });
}

export function offlineFilePayload(file: File): OfflineFilePayload {
  return {
    blob: file,
    name: file.name,
    type: file.type,
    lastModified: file.lastModified,
    size: file.size,
  };
}
