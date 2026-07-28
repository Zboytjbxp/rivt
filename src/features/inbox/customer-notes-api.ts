import { makeRequest, requestKey, RivtApiError, type ApiErrorBody } from "../../lib/api";

export interface ContactNoteAttachment {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  version: number;
  createdAt: string;
  url: string | null;
}

export interface ContactNote {
  id: string;
  contactId: string;
  body: string;
  version: number;
  archivedAt: string | null;
  occurredAt: string;
  createdAt: string;
  updatedAt: string;
  attachments: ContactNoteAttachment[];
}

export interface ContactNoteHistoryItem {
  id: string;
  action: "created" | "updated" | "archived" | "restored" | "uploaded" | "removed";
  fromVersion: number | null;
  toVersion: number | null;
  body: string | null;
  createdAt: string;
}

class CustomerNotesApiError extends RivtApiError {
  constructor(status: number, body: ApiErrorBody) {
    super(status, body, "RIVT could not complete the customer-note request.");
  }
}

const request = makeRequest((status, body) => new CustomerNotesApiError(status, body));

export async function listContactNotes(contactId: string, includeArchived = false) {
  const query = includeArchived ? "?includeArchived=true" : "";
  const body = await request<{ data: { notes: ContactNote[] } }>(
    `/api/v1/contacts/${contactId}/notes${query}`,
  );
  return body.data.notes;
}

export async function listContactNoteHistory(contactId: string, noteId: string) {
  const body = await request<{ data: { history: ContactNoteHistoryItem[] } }>(
    `/api/v1/contacts/${contactId}/notes/${noteId}/history`,
  );
  return body.data.history;
}

export async function createContactNote(
  contactId: string,
  noteBody: string,
  idempotencyKey: string = requestKey(),
  occurredAt: string | null = null,
) {
  const body = await request<{ data: { note: ContactNote } }>(
    `/api/v1/contacts/${contactId}/notes`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({ body: noteBody, occurredAt }),
    },
  );
  return body.data.note;
}

export async function updateContactNote(contactId: string, note: ContactNote, noteBody: string) {
  const body = await request<{ data: { note: ContactNote } }>(
    `/api/v1/contacts/${contactId}/notes/${note.id}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: noteBody, expectedVersion: note.version }),
    },
  );
  return body.data.note;
}

async function changeArchive(contactId: string, note: ContactNote, action: "archive" | "restore") {
  const body = await request<{ data: { note: ContactNote } }>(
    `/api/v1/contacts/${contactId}/notes/${note.id}/${action}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expectedVersion: note.version }),
    },
  );
  return body.data.note;
}

export const archiveContactNote = (contactId: string, note: ContactNote) =>
  changeArchive(contactId, note, "archive");
export const restoreContactNote = (contactId: string, note: ContactNote) =>
  changeArchive(contactId, note, "restore");

export async function uploadContactNoteAttachment(contactId: string, note: ContactNote, file: File) {
  const form = new FormData();
  form.append("file", file);
  form.append("expectedVersion", String(note.version));
  const body = await request<{ data: { note: ContactNote } }>(
    `/api/v1/contacts/${contactId}/notes/${note.id}/attachments`,
    { method: "POST", headers: { "Idempotency-Key": requestKey() }, body: form },
  );
  return body.data.note;
}

export async function removeContactNoteAttachment(
  contactId: string,
  note: ContactNote,
  attachmentId: string,
) {
  const body = await request<{ data: { note: ContactNote } }>(
    `/api/v1/contacts/${contactId}/notes/${note.id}/attachments/${attachmentId}`,
    {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expectedVersion: note.version }),
    },
  );
  return body.data.note;
}
