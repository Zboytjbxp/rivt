import { useEffect, useRef, useState } from "react";
import { Archive, Camera, FileText, History, Pencil, Plus, RefreshCw, RotateCcw, Trash2, Users, X } from "lucide-react";
import { Avatar, EmptyState } from "../../components/ui";
import {
  createContact,
  fetchContacts,
  type ContactRecord,
} from "../network/contacts-api";
import {
  archiveContactNote,
  createContactNote,
  listContactNoteHistory,
  listContactNotes,
  removeContactNoteAttachment,
  restoreContactNote,
  updateContactNote,
  uploadContactNoteAttachment,
  type ContactNote,
  type ContactNoteHistoryItem,
} from "./customer-notes-api";

export interface LegacyCustomerNote {
  id: string;
  text: string;
  sentAt: string;
  attachmentUrl?: string;
}

export interface LegacyCustomer {
  id: string;
  name: string;
  notes: LegacyCustomerNote[];
}

interface Props {
  legacyCustomers: LegacyCustomer[];
  onLegacyMigrationComplete: () => void;
}

function relativeTime(value: string) {
  const elapsed = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function displayError(error: unknown) {
  return error instanceof Error ? error.message : "RIVT could not complete that request.";
}

async function dataUrlFile(dataUrl: string, fallbackName: string) {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const extension = blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg";
  return new File([blob], `${fallbackName}.${extension}`, { type: blob.type || "image/jpeg" });
}

export function AccountCustomerNotesTab({ legacyCustomers, onLegacyMigrationComplete }: Props) {
  const [contacts, setContacts] = useState<ContactRecord[]>([]);
  const [selectedContact, setSelectedContact] = useState<ContactRecord | null>(null);
  const [notes, setNotes] = useState<ContactNote[]>([]);
  const [draft, setDraft] = useState("");
  const [newCustomerName, setNewCustomerName] = useState("");
  const [addingCustomer, setAddingCustomer] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [historyNoteId, setHistoryNoteId] = useState<string | null>(null);
  const [noteHistory, setNoteHistory] = useState<Record<string, ContactNoteHistoryItem[]>>({});
  const [editDraft, setEditDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchContacts({ role: "customer", status: "active" }).then((result) => {
      if (cancelled) return;
      if (!result) setError("RIVT could not load customer contacts.");
      else setContacts(result);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  async function loadNotes(contact: ContactRecord, archived = showArchived) {
    setSelectedContact(contact);
    setLoading(true);
    setError(null);
    try {
      setNotes(await listContactNotes(contact.id, archived));
    } catch (nextError) {
      setError(displayError(nextError));
    } finally {
      setLoading(false);
    }
  }

  async function addCustomer() {
    const name = newCustomerName.trim();
    if (!name) return;
    setSaving(true);
    setError(null);
    const result = await createContact({
      entityType: "person",
      name,
      company: "",
      notes: "",
      favorite: false,
      status: "active",
      roles: [{ role: "customer", status: "active", details: {} }],
      methods: [],
      addresses: [],
      tags: [],
    });
    setSaving(false);
    if (!result.contact) {
      setError(result.error ?? "RIVT could not create the customer.");
      return;
    }
    setContacts((current) => [result.contact!, ...current]);
    setAddingCustomer(false);
    setNewCustomerName("");
    await loadNotes(result.contact);
  }

  async function addNote() {
    if (!selectedContact || !draft.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const note = await createContactNote(selectedContact.id, draft);
      setNotes((current) => [note, ...current]);
      setDraft("");
      setStatus("Private note saved to your RIVT account.");
    } catch (nextError) {
      setError(displayError(nextError));
    } finally {
      setSaving(false);
    }
  }

  async function changeArchive(note: ContactNote) {
    if (!selectedContact) return;
    setSaving(true);
    setError(null);
    try {
      const updated = note.archivedAt
        ? await restoreContactNote(selectedContact.id, note)
        : await archiveContactNote(selectedContact.id, note);
      if (showArchived) {
        setNotes((current) => current.map((item) => item.id === updated.id ? updated : item));
      } else {
        setNotes((current) => current.filter((item) => item.id !== updated.id));
      }
      setStatus(note.archivedAt ? "Note restored." : "Note archived.");
    } catch (nextError) {
      setError(displayError(nextError));
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit(note: ContactNote) {
    if (!selectedContact || !editDraft.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await updateContactNote(selectedContact.id, note, editDraft);
      setNotes((current) => current.map((item) => item.id === updated.id ? updated : item));
      setEditingNoteId(null);
      setEditDraft("");
      setStatus("Private note updated.");
    } catch (nextError) {
      setError(displayError(nextError));
    } finally {
      setSaving(false);
    }
  }

  async function toggleHistory(note: ContactNote) {
    if (!selectedContact) return;
    if (historyNoteId === note.id) {
      setHistoryNoteId(null);
      return;
    }
    setHistoryNoteId(note.id);
    if (noteHistory[note.id]) return;
    setSaving(true);
    setError(null);
    try {
      const history = await listContactNoteHistory(selectedContact.id, note.id);
      setNoteHistory((current) => ({ ...current, [note.id]: history }));
    } catch (nextError) {
      setHistoryNoteId(null);
      setError(displayError(nextError));
    } finally {
      setSaving(false);
    }
  }

  async function uploadAttachment(file: File) {
    if (!selectedContact) return;
    setSaving(true);
    setError(null);
    try {
      const note = await createContactNote(selectedContact.id, draft.trim() || `Attachment: ${file.name}`);
      setDraft("");
      const updated = await uploadContactNoteAttachment(selectedContact.id, note, file);
      setNotes((current) => [updated, ...current.filter((item) => item.id !== updated.id)]);
      setStatus("Attachment saved to this private customer note.");
    } catch (nextError) {
      setError(displayError(nextError));
    } finally {
      setSaving(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function removeAttachment(note: ContactNote, attachmentId: string) {
    if (!selectedContact) return;
    setSaving(true);
    try {
      const updated = await removeContactNoteAttachment(selectedContact.id, note, attachmentId);
      setNotes((current) => current.map((item) => item.id === updated.id ? updated : item));
      setStatus("Attachment removed.");
    } catch (nextError) {
      setError(displayError(nextError));
    } finally {
      setSaving(false);
    }
  }

  async function migrateLegacyNotes() {
    setSaving(true);
    setError(null);
    let migrated = 0;
    try {
      let currentContacts = [...contacts];
      for (const legacyCustomer of legacyCustomers) {
        let contact = currentContacts.find(
          (item) => item.name.trim().toLowerCase() === legacyCustomer.name.trim().toLowerCase(),
        );
        if (!contact) {
          const created = await createContact({
            entityType: "person",
            name: legacyCustomer.name,
            company: "",
            notes: "",
            favorite: false,
            status: "active",
            roles: [{ role: "customer", status: "active", details: {} }],
            methods: [],
            addresses: [],
            tags: ["imported-from-device"],
          });
          if (!created.contact) throw new Error(created.error ?? `Could not create ${legacyCustomer.name}.`);
          contact = created.contact;
          currentContacts = [contact, ...currentContacts];
        }
        for (const legacyNote of legacyCustomer.notes) {
          const body = legacyNote.text.trim() || "Imported reference photo";
          let note = await createContactNote(contact.id, body, `legacy-note-${legacyNote.id}`, legacyNote.sentAt);
          if (legacyNote.attachmentUrl?.startsWith("data:")) {
            const file = await dataUrlFile(legacyNote.attachmentUrl, `customer-note-${legacyNote.id}`);
            note = await uploadContactNoteAttachment(contact.id, note, file);
          }
          migrated += 1;
        }
      }
      setContacts(currentContacts);
      onLegacyMigrationComplete();
      setStatus(`${migrated} device ${migrated === 1 ? "note" : "notes"} moved to your RIVT account.`);
    } catch (nextError) {
      setError(`${displayError(nextError)} Device notes were kept so you can retry.`);
    } finally {
      setSaving(false);
    }
  }

  if (!selectedContact) {
    return (
      <div className="v2-clients-tab">
        <div className="v2-clients-tab-header">
          <span className="v2-client-title">Customer notes ({contacts.length})</span>
          <button type="button" className="v2-client-add-btn" onClick={() => setAddingCustomer(true)}>
            <Plus size={14} /> New customer
          </button>
        </div>
        <p className="v2-client-thread-purpose">Private notes connected to the same customers used in Work, Estimates, and Invoices. Nothing here is sent.</p>
        {legacyCustomers.length ? (
          <div className="v2-client-migration">
            <div>
              <strong>Device notes found</strong>
              <span>Move them to your account so they follow you across devices.</span>
            </div>
            <button type="button" onClick={() => void migrateLegacyNotes()} disabled={saving}>
              {saving ? "Moving…" : "Move device notes"}
            </button>
          </div>
        ) : null}
        {addingCustomer ? (
          <div className="v2-ct-add-form">
            <input
              autoFocus
              value={newCustomerName}
              onChange={(event) => setNewCustomerName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void addCustomer();
                if (event.key === "Escape") setAddingCustomer(false);
              }}
              placeholder="Customer name"
            />
            <button type="button" onClick={() => void addCustomer()} disabled={saving || !newCustomerName.trim()}>Add</button>
            <button type="button" onClick={() => setAddingCustomer(false)} aria-label="Cancel"><X size={14} /></button>
          </div>
        ) : null}
        {status ? <p className="v2-client-sync-note" role="status">{status}</p> : null}
        {error ? <p className="v2-client-sync-note is-error" role="alert">{error}</p> : null}
        {loading ? (
          <p className="v2-client-sync-note">Loading customers…</p>
        ) : contacts.length ? (
          <div className="v2-clients-list">
            {contacts.map((contact) => (
              <button key={contact.id} type="button" className="v2-client-conv-row" onClick={() => void loadNotes(contact)}>
                <Avatar name={contact.name} size="sm" />
                <div className="v2-client-conv-info">
                  <strong>{contact.name}</strong>
                  <span className="v2-client-conv-preview">{contact.company || "Private customer history"}</span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <EmptyState
            className="v2-inbox-empty"
            icon={<Users size={20} />}
            title="No customers yet"
            description="Create a customer here or in Work, Estimates, or Invoices. The same contact appears everywhere."
            compact
          />
        )}
      </div>
    );
  }

  return (
    <div className="v2-client-thread">
      <div className="v2-client-thread-header">
        <button type="button" className="v2-client-thread-back" onClick={() => setSelectedContact(null)}>← Back</button>
        <Avatar name={selectedContact.name} size="sm" />
        <strong>{selectedContact.name}</strong>
      </div>
      <p className="v2-client-thread-purpose">Private customer history. Notes and files are not messages and are never sent.</p>
      <div className="v2-client-note-toolbar">
        <button
          type="button"
          className={showArchived ? "is-active" : ""}
          onClick={() => {
            const next = !showArchived;
            setShowArchived(next);
            void loadNotes(selectedContact, next);
          }}
        >
          <Archive size={14} /> {showArchived ? "Showing history" : "Archived"}
        </button>
        <button type="button" onClick={() => void loadNotes(selectedContact)}><RefreshCw size={14} /> Refresh</button>
      </div>
      {status ? <p className="v2-client-sync-note" role="status">{status}</p> : null}
      {error ? <p className="v2-client-sync-note is-error" role="alert">{error}</p> : null}

      <div className="v2-client-thread-messages">
        {loading ? <p className="v2-client-sync-note">Loading notes…</p> : notes.length ? notes.map((note) => (
          <article key={note.id} className={`v2-contact-note${note.archivedAt ? " is-archived" : ""}`}>
            {editingNoteId === note.id ? (
              <div className="v2-contact-note-edit">
                <textarea value={editDraft} onChange={(event) => setEditDraft(event.target.value)} />
                <div>
                  <button type="button" onClick={() => void saveEdit(note)} disabled={saving || !editDraft.trim()}>Save change</button>
                  <button type="button" onClick={() => { setEditingNoteId(null); setEditDraft(""); }}>Cancel</button>
                </div>
              </div>
            ) : <p>{note.body}</p>}
            {note.attachments.length ? (
              <div className="v2-contact-note-files">
                {note.attachments.map((attachment) => (
                  <div key={attachment.id} className="v2-contact-note-file">
                    {attachment.mimeType.startsWith("image/") && attachment.url ? (
                      <a href={attachment.url} target="_blank" rel="noreferrer">
                        <img src={attachment.url} alt={attachment.originalName} width="160" height="120" />
                      </a>
                    ) : (
                      <a href={attachment.url ?? undefined} target="_blank" rel="noreferrer">
                        <FileText size={16} /> {attachment.originalName}
                      </a>
                    )}
                    <button type="button" onClick={() => void removeAttachment(note, attachment.id)} aria-label={`Remove ${attachment.originalName}`}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
            <footer>
              <time>{relativeTime(note.occurredAt)}</time>
              <div>
                <button type="button" onClick={() => void toggleHistory(note)} aria-expanded={historyNoteId === note.id}>
                  <History size={13} /> History
                </button>
                {!note.archivedAt ? (
                  <button type="button" onClick={() => { setEditingNoteId(note.id); setEditDraft(note.body); }}>
                    <Pencil size={13} /> Edit
                  </button>
                ) : null}
                <button type="button" onClick={() => void changeArchive(note)}>
                  {note.archivedAt ? <><RotateCcw size={13} /> Restore</> : <><Archive size={13} /> Archive</>}
                </button>
              </div>
            </footer>
            {historyNoteId === note.id ? (
              <div className="v2-contact-note-history">
                {(noteHistory[note.id] ?? []).length ? (noteHistory[note.id] ?? []).map((entry) => (
                  <div key={entry.id}>
                    <span>{entry.action.replace("_", " ")}</span>
                    <time>{relativeTime(entry.createdAt)}</time>
                    {entry.body ? <p>{entry.body}</p> : null}
                  </div>
                )) : <span>{saving ? "Loading history…" : "No history recorded."}</span>}
              </div>
            ) : null}
          </article>
        )) : (
          <div className="v2-client-thread-empty">No private notes yet. Add job details, preferences, or a follow-up.</div>
        )}
      </div>

      <div className="v2-client-thread-input-bar">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf,text/plain"
          className="v2-ct-file-input"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void uploadAttachment(file);
          }}
        />
        <button type="button" className="v2-ct-photo-btn" onClick={() => fileInputRef.current?.click()} aria-label="Attach a private file">
          <Camera size={18} />
        </button>
        <input
          className="v2-ct-text-input"
          placeholder="Add a private note…"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void addNote();
            }
          }}
        />
        <button type="button" className="v2-ct-send-btn" onClick={() => void addNote()} disabled={saving || !draft.trim()} aria-label="Save private note">
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
}
