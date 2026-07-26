import {
  Archive,
  AlertTriangle,
  ArrowRight,
  Briefcase,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  FileText,
  Mail,
  MapPin,
  MessageSquareText,
  Phone,
  Plus,
  Save,
  Search,
  ShieldCheck,
  Star,
  Users,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ProfileSearchResult } from "../../app-shell/types";
import { Avatar, EmptyState, PageHeader, Panel } from "../../components/ui";
import {
  customerDisplayName,
  emptyClientRecord,
  fetchAllClientRecords,
  fetchCustomerActivity,
  readClientRecordsLocal,
  saveClientRecord,
  saveClientRecordsLocal,
  syncClientRecords,
  type CustomerActivity,
  type ClientRecord,
} from "../clients/client-records";
import {
  deleteNetworkRecordByLocalId,
  fetchNetworkRecords,
  upsertNetworkRecord,
  type NetworkRecordInput,
  type ServerNetworkRecord,
} from "./network-records-api";
import {
  approveWorkReview,
  disputeWorkReview,
  fetchWorkReview,
  fetchWorkReviews,
  reviewErrorMessage,
  type WorkReview,
} from "./reviews-api";
import "./network-hub.css";

interface ShoutOut {
  id: number;
  from: string;
  to: string;
  trade: string;
  message: string;
  createdAt: string;
}

interface NetworkWorkOption {
  id: string;
  title: string;
  status: string;
}

interface NetworkHubProps {
  view: "People" | "Reviews";
  shoutOuts: ShoutOut[];
  displayName: string;
  accountId?: string | null;
  workOptions: NetworkWorkOption[];
  workOptionsLoading?: boolean;
  workOptionsError?: string | null;
  profileFocus?: ProfileSearchResult | null;
  focusedReviewId?: string | null;
  onClearProfileFocus?: () => void;
  onOpenPeople: () => void;
  onOpenWork: () => void;
  onOpenReviews: () => void;
  onAddShoutOut: (to: string, trade: string, message: string) => void;
  isDemo?: boolean;
}

// ── Clients ───────────────────────────────────────────────────────────────────

type Client = ClientRecord;

const emptyClientForm = {
  name: "",
  company: "",
  phone: "",
  email: "",
  billingAddress: "",
  serviceAddress: "",
  notes: "",
  preferredContactMethod: "none" as Client["preferredContactMethod"],
  defaultTerms: "",
  favorite: false,
};

function customerForm(client?: Client | null) {
  if (!client) return { ...emptyClientForm };
  return {
    name: client.name,
    company: client.company,
    phone: client.phone,
    email: client.email,
    billingAddress: client.billingAddress,
    serviceAddress: client.serviceAddress,
    notes: client.notes,
    preferredContactMethod: client.preferredContactMethod,
    defaultTerms: client.defaultTerms,
    favorite: client.favorite,
  };
}

function customerActivityLabel(activity: CustomerActivity) {
  if (activity.kind === "project") return "Project";
  if (activity.recordType === "estimate") return "Estimate";
  if (activity.recordType === "invoice") return "Invoice";
  return "Document";
}

function customerActivityAmount(activity: CustomerActivity) {
  if (activity.amountCents === null) return null;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(activity.amountCents / 100);
}

function normalizedCustomerPhone(value: string) {
  return value.replace(/\D/g, "");
}

function ClientBookView() {
  const [clients, setClients] = useState<Client[]>(readClientRecordsLocal);
  const [showForm, setShowForm] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [form, setForm] = useState(emptyClientForm);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState("Saved on this device.");
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmArchiveId, setConfirmArchiveId] = useState<string | null>(null);
  const [activityByCustomer, setActivityByCustomer] = useState<Record<string, CustomerActivity[] | null | undefined>>({});

  useEffect(() => {
    let cancelled = false;
    void syncClientRecords().then(async (result) => {
      const allCustomers = await fetchAllClientRecords();
      if (cancelled) return;
      const canonicalIds = new Set((allCustomers ?? []).flatMap((customer) =>
        [customer.id, customer.legacyLocalId].filter(Boolean) as string[]));
      const unsynced = result.clients.filter((customer) =>
        !canonicalIds.has(customer.id)
        && !(customer.legacyLocalId && canonicalIds.has(customer.legacyLocalId)));
      const merged = allCustomers ? [...allCustomers, ...unsynced] : result.clients;
      saveClientRecordsLocal(merged);
      setClients(merged);
      setSyncMessage(result.message);
    });
    return () => { cancelled = true; };
  }, []);

  function cache(list: Client[]) {
    saveClientRecordsLocal(list);
    setClients(list);
  }

  function openAdd() {
    setEditingClient(null);
    setForm(customerForm());
    setShowForm(true);
  }

  function openEdit(client: Client) {
    setEditingClient(client);
    setForm(customerForm(client));
    setShowForm(true);
  }

  function cancel() {
    setShowForm(false);
    setEditingClient(null);
    setForm(customerForm());
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    const draft = editingClient
      ? { ...editingClient, ...form, updatedAt: new Date().toISOString() }
      : { ...emptyClientRecord(), ...form };
    const optimistic = editingClient
      ? clients.map((client) => client.id === editingClient.id ? draft : client)
      : [draft, ...clients];
    cache(optimistic);
    const saved = await saveClientRecord(draft);
    setSaving(false);
    if (!saved) {
      setSyncMessage("Could not sync this customer. The changes remain saved on this device.");
    } else {
      cache(optimistic.map((client) => client.id === draft.id ? saved : client));
      setSyncMessage("Customer synced to your RIVT account.");
    }
    cancel();
  }

  async function setCustomerStatus(client: Client, status: Client["status"]) {
    const updated = { ...client, status, updatedAt: new Date().toISOString() };
    cache(clients.map((candidate) => candidate.id === client.id ? updated : candidate));
    setConfirmArchiveId(null);
    const saved = await saveClientRecord(updated);
    if (!saved) {
      setSyncMessage(`Could not sync this change. The customer is ${status} on this device only.`);
      return;
    }
    cache(clients.map((candidate) => candidate.id === client.id ? saved : candidate));
    setSyncMessage(status === "archived" ? "Customer archived." : "Customer restored.");
    if (status === "archived" && expandedId === client.id) setExpandedId(null);
  }

  async function toggleFavorite(client: Client) {
    const updated = { ...client, favorite: !client.favorite, updatedAt: new Date().toISOString() };
    cache(clients.map((candidate) => candidate.id === client.id ? updated : candidate));
    const saved = await saveClientRecord(updated);
    if (saved) cache(clients.map((candidate) => candidate.id === client.id ? saved : candidate));
    else setSyncMessage("Favorite changed on this device, but could not sync.");
  }

  function toggleExpanded(client: Client) {
    const nextId = expandedId === client.id ? null : client.id;
    setExpandedId(nextId);
    setConfirmArchiveId(null);
    if (!nextId || activityByCustomer[client.id] !== undefined) return;
    void fetchCustomerActivity(client.id).then((activity) => {
      setActivityByCustomer((current) => ({ ...current, [client.id]: activity }));
    });
  }

  const normalizedQuery = query.trim().toLowerCase();
  const visibleClients = clients
    .filter((client) => client.status === (showArchived ? "archived" : "active"))
    .filter((client) => !normalizedQuery || `${client.name} ${client.company} ${client.email} ${client.phone} ${client.serviceAddress}`
      .toLowerCase()
      .includes(normalizedQuery))
    .sort((left, right) => {
      if (left.favorite !== right.favorite) return left.favorite ? -1 : 1;
      return new Date(right.lastUsedAt ?? right.updatedAt).getTime()
        - new Date(left.lastUsedAt ?? left.updatedAt).getTime();
    });
  const activeCount = clients.filter((client) => client.status === "active").length;
  const archivedCount = clients.filter((client) => client.status === "archived").length;
  const formEmail = form.email.trim().toLowerCase();
  const formPhone = normalizedCustomerPhone(form.phone);
  const duplicateCustomer = clients.find((client) =>
    client.id !== editingClient?.id
    && (Boolean(formEmail && client.email.trim().toLowerCase() === formEmail)
      || Boolean(formPhone.length >= 7 && normalizedCustomerPhone(client.phone) === formPhone))
  ) ?? null;

  return (
    <div className="v2-client-book">
      <div className="v2-client-header">
        <span className="v2-client-title">Customers ({activeCount})</span>
        <button type="button" className="v2-client-add-btn" onClick={openAdd}>
          <Plus size={16} /> New customer
        </button>
      </div>
      <p className="v2-client-sync-note" role="status">{syncMessage}</p>

      {showForm && (
        <div className="v2-client-form">
          <header>
            <div><strong>{editingClient ? "Edit customer" : "New customer"}</strong><small>Only the contact name is required.</small></div>
            <button type="button" aria-pressed={form.favorite} onClick={() => setForm((current) => ({ ...current, favorite: !current.favorite }))}>
              <Star size={17} fill={form.favorite ? "currentColor" : "none"} /> Favorite
            </button>
          </header>
          <div className="v2-client-form-grid">
            <label>Contact name *<input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} autoFocus /></label>
            <label>Company<input value={form.company} onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))} /></label>
            <label>Phone<input type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} /></label>
            <label>Email<input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></label>
            <label>Preferred contact
              <select value={form.preferredContactMethod} onChange={(e) => setForm((f) => ({ ...f, preferredContactMethod: e.target.value as Client["preferredContactMethod"] }))}>
                <option value="none">No preference</option>
                <option value="email">Email</option>
                <option value="phone">Phone call</option>
                <option value="sms">Text message</option>
              </select>
            </label>
            <label>Default payment terms<input value={form.defaultTerms} onChange={(e) => setForm((f) => ({ ...f, defaultTerms: e.target.value }))} placeholder="Due on completion" /></label>
            <label className="is-wide">Billing address<textarea value={form.billingAddress} onChange={(e) => setForm((f) => ({ ...f, billingAddress: e.target.value }))} rows={2} /></label>
            <label className="is-wide">Service address<textarea value={form.serviceAddress} onChange={(e) => setForm((f) => ({ ...f, serviceAddress: e.target.value }))} rows={2} /></label>
            <label className="is-wide">Private notes<textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} /></label>
          </div>
          {duplicateCustomer ? (
            <p className="v2-client-duplicate" role="status">
              That email or phone is already saved for {customerDisplayName(duplicateCustomer)}. Edit the existing customer instead of creating a duplicate.
            </p>
          ) : null}
          <div className="v2-client-form-btns">
            <button type="button" className="v2-client-save-btn" disabled={saving || !form.name.trim() || Boolean(duplicateCustomer)} onClick={() => void handleSave()}>
              {saving ? "Saving…" : "Save customer"}
            </button>
            <button type="button" className="v2-client-cancel-btn" onClick={cancel}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {!showForm && (
        <>
          <div className="v2-client-toolbar">
            <label>
              <Search size={17} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search customers" />
            </label>
            <button type="button" className={showArchived ? "is-active" : ""} onClick={() => setShowArchived((current) => !current)}>
              <Archive size={16} /> Archived ({archivedCount})
            </button>
          </div>
          <div className="v2-client-list">
          {visibleClients.length === 0 ? (
            <div className="v2-client-empty">
              <strong>{query.trim() ? "No customers match that search." : showArchived ? "No archived customers." : "No customers yet."}</strong>
              {!query.trim() && !showArchived ? <button type="button" onClick={openAdd}>Add your first customer</button> : null}
            </div>
          ) : (
            visibleClients.map((client) => {
              const isExpanded = expandedId === client.id;
              const activity = activityByCustomer[client.id];
              return (
                <div key={client.id} className="v2-client-card">
                  <button
                    type="button"
                    className="v2-client-card-top"
                    onClick={() => toggleExpanded(client)}
                    aria-expanded={isExpanded}
                  >
                    <div>
                      <div className="v2-client-name">{customerDisplayName(client)}</div>
                      <div className="v2-client-company">
                        {client.company ? client.name : [client.email, client.phone].filter(Boolean).join(" · ") || "No contact details saved"}
                      </div>
                    </div>
                    <div className="v2-client-card-controls">
                      {client.favorite ? <Star size={16} fill="currentColor" aria-label="Favorite customer" /> : null}
                      {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="v2-client-detail">
                      {client.phone && (
                        <div className="v2-client-detail-row">
                          <Phone size={13} />
                          <a href={`tel:${client.phone}`}>{client.phone}</a>
                        </div>
                      )}
                      {client.email && (
                        <div className="v2-client-detail-row">
                          <Mail size={13} />
                          <a href={`mailto:${client.email}`}>{client.email}</a>
                        </div>
                      )}
                      {client.serviceAddress && (
                        <div className="v2-client-detail-row">
                          <MapPin size={13} />
                          <span>{client.serviceAddress}</span>
                        </div>
                      )}
                      {client.defaultTerms && (
                        <div className="v2-client-detail-row">
                          <FileText size={13} />
                          <span>{client.defaultTerms}</span>
                        </div>
                      )}
                      {client.notes && (
                        <div className="v2-client-detail-row is-note">
                          <MessageSquareText size={13} />
                          <span>{client.notes}</span>
                        </div>
                      )}
                      <section className="v2-customer-activity" aria-label={`${client.name} activity`}>
                        <header><strong>Recent activity</strong><small>Linked projects and documents</small></header>
                        {activity === undefined ? (
                          <p>Loading activity…</p>
                        ) : activity === null ? (
                          <p>Activity could not be loaded.</p>
                        ) : activity.length ? (
                          <ol>
                            {activity.slice(0, 8).map((item) => (
                              <li key={`${item.kind}:${item.id}`}>
                                <span><strong>{item.title}</strong><small>{customerActivityLabel(item)} · {item.status}</small></span>
                                {customerActivityAmount(item) ? <strong>{customerActivityAmount(item)}</strong> : null}
                              </li>
                            ))}
                          </ol>
                        ) : <p>No linked estimates, invoices, or projects yet.</p>}
                      </section>
                      <div className="v2-client-actions">
                        <button type="button" className="v2-client-edit-btn" onClick={() => openEdit(client)}>
                          Edit
                        </button>
                        <button type="button" className="v2-client-edit-btn" aria-pressed={client.favorite} onClick={() => void toggleFavorite(client)}>
                          {client.favorite ? "Unfavorite" : "Favorite"}
                        </button>
                        {client.status === "archived" ? (
                          <button type="button" className="v2-client-archive-btn" onClick={() => void setCustomerStatus(client, "active")}>Restore</button>
                        ) : confirmArchiveId === client.id ? (
                          <span className="v2-client-archive-confirm">
                            <button type="button" onClick={() => void setCustomerStatus(client, "archived")}>Confirm archive</button>
                            <button type="button" onClick={() => setConfirmArchiveId(null)}>Cancel</button>
                          </span>
                        ) : (
                          <button type="button" className="v2-client-archive-btn" onClick={() => setConfirmArchiveId(client.id)}>Archive</button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Reviews localStorage ──────────────────────────────────────────────────────

const reviewsKey = "rivt.reviews.v1";

interface StoredReview {
  id: string;
  reviewer: string;
  trade?: string;
  reviewText: string;
  rating: number;
  date: string;
}

function readStoredReviews(): StoredReview[] {
  try {
    const stored = localStorage.getItem(reviewsKey);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as StoredReview[];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function persistStoredReviews(reviews: StoredReview[]) {
  try { localStorage.setItem(reviewsKey, JSON.stringify(reviews)); } catch { /* noop */ }
}

// ── Crew Member (rivt.crew.v1) ────────────────────────────────────────────────

type CrewAvailability = "available" | "busy" | "unavailable";
type CrewType = "crew" | "sub";

interface CrewMember {
  id: string;
  type: CrewType;
  name: string;
  trade: string;
  license?: string;
  licenseExpiry?: string;
  phone?: string;
  email?: string;
  hourlyRate?: number;
  availability: CrewAvailability;
  currentJobId?: string;
  notes?: string;
  addedAt: string;
}

const demoCrewMembers: CrewMember[] = [
  { id: "demo-crew-1", type: "crew", name: "Elena Torres", trade: "Finish carpentry", availability: "available", notes: "Repeat collaborator · 8 completed jobs", addedAt: "2025-08-12T12:00:00.000Z" },
  { id: "demo-crew-2", type: "crew", name: "Jordan Price", trade: "Electrical", availability: "busy", currentJobId: "demo-job-1", notes: "Licensed · 5 completed jobs", addedAt: "2025-10-02T12:00:00.000Z" },
  { id: "demo-sub-1", type: "sub", name: "Avery Cole", trade: "Tile", availability: "available", notes: "Preferred sub · 4.9 rating", addedAt: "2025-11-18T12:00:00.000Z" },
  { id: "demo-sub-2", type: "sub", name: "Luis Hernandez", trade: "Plumbing", availability: "available", notes: "Insured · 6 completed jobs", addedAt: "2026-01-08T12:00:00.000Z" },
];

function loadCrew(): CrewMember[] {
  try {
    const stored = localStorage.getItem("rivt.crew.v1");
    if (!stored) return [];
    const parsed = JSON.parse(stored) as CrewMember[];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function saveCrew(list: CrewMember[]) {
  try { localStorage.setItem("rivt.crew.v1", JSON.stringify(list)); } catch { /* noop */ }
}

// ── License expiry helper ─────────────────────────────────────────────────────

function licenseExpiryStatus(expiry?: string): "ok" | "warning" | "expired" | null {
  if (!expiry) return null;
  const expiryDate = new Date(expiry);
  const now = new Date();
  const diffMs = expiryDate.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffDays < 0) return "expired";
  if (diffDays <= 30) return "warning";
  return "ok";
}

// ── Crew Member Form ──────────────────────────────────────────────────────────

const emptyCrewForm: Omit<CrewMember, "id" | "addedAt"> = {
  type: "crew",
  name: "",
  trade: "",
  license: "",
  licenseExpiry: "",
  phone: "",
  email: "",
  hourlyRate: undefined,
  availability: "available",
  currentJobId: undefined,
  notes: "",
};

interface CrewMemberFormProps {
  initial?: Partial<Omit<CrewMember, "id" | "addedAt">>;
  onSave: (data: Omit<CrewMember, "id" | "addedAt">) => void;
  onCancel: () => void;
}

function CrewMemberForm({ initial, onSave, onCancel }: CrewMemberFormProps) {
  const [form, setForm] = useState<Omit<CrewMember, "id" | "addedAt">>({
    ...emptyCrewForm,
    ...initial,
  });

  function field<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  return (
    <div className="v2-crew-form">
      <div className="v2-crew-form-grid">
        <label>
          <span>Name *</span>
          <input value={form.name} onChange={(e) => field("name", e.target.value)} placeholder="Full name" />
        </label>
        <label>
          <span>Trade</span>
          <input value={form.trade} onChange={(e) => field("trade", e.target.value)} placeholder="Electrical, Plumbing…" />
        </label>
        <label>
          <span>Type</span>
          <select value={form.type} onChange={(e) => field("type", e.target.value as CrewType)}>
            <option value="crew">Crew</option>
            <option value="sub">Sub</option>
          </select>
        </label>
        <label>
          <span>Availability</span>
          <select value={form.availability} onChange={(e) => field("availability", e.target.value as CrewAvailability)}>
            <option value="available">Available</option>
            <option value="busy">Busy</option>
            <option value="unavailable">Unavailable</option>
          </select>
        </label>
        <label>
          <span>Phone</span>
          <input value={form.phone ?? ""} onChange={(e) => field("phone", e.target.value)} placeholder="+1 555 000 0000" />
        </label>
        <label>
          <span>Email</span>
          <input value={form.email ?? ""} onChange={(e) => field("email", e.target.value)} placeholder="email@example.com" />
        </label>
        <label>
          <span>Hourly rate ($)</span>
          <input
            type="number"
            value={form.hourlyRate ?? ""}
            onChange={(e) => field("hourlyRate", e.target.value ? Number(e.target.value) : undefined)}
            placeholder="75"
          />
        </label>
        <label>
          <span>License #</span>
          <input value={form.license ?? ""} onChange={(e) => field("license", e.target.value)} placeholder="Optional" />
        </label>
        <label>
          <span>License expiry</span>
          <input type="date" value={form.licenseExpiry ?? ""} onChange={(e) => field("licenseExpiry", e.target.value)} />
        </label>
        <label className="v2-crew-form-wide">
          <span>Notes</span>
          <textarea value={form.notes ?? ""} onChange={(e) => field("notes", e.target.value)} rows={2} placeholder="Any notes…" />
        </label>
      </div>
      <div className="v2-crew-form-btns">
        <button type="button" className="v2-client-save-btn" disabled={!form.name.trim()} onClick={() => onSave(form)}>
          Save
        </button>
        <button type="button" className="v2-client-cancel-btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Job Assignment Modal ──────────────────────────────────────────────────────

function JobAssignModal({
  member,
  workOptions,
  workOptionsLoading,
  workOptionsError,
  onAssign,
  onUnassign,
  onClose,
}: {
  member: CrewMember;
  workOptions: NetworkWorkOption[];
  workOptionsLoading: boolean;
  workOptionsError: string | null;
  onAssign: (jobId: string) => void;
  onUnassign: () => void;
  onClose: () => void;
}) {
  const currentWork = member.currentJobId
    ? workOptions.find((job) => job.id === member.currentJobId)
    : null;
  return (
    <div className="v2-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        className="v2-crew-assign-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Assign ${member.name} to work`}
      >
        <header>
          <strong>Assign {member.name} to job</strong>
          <button type="button" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </header>
        {member.currentJobId && (
          <div className="v2-crew-assign-current">
            <span>{currentWork ? `Currently assigned to ${currentWork.title}` : "Currently assigned to work not loaded here"}</span>
            <button type="button" className="v2-crew-unassign-btn" onClick={onUnassign}>
              Unassign
            </button>
          </div>
        )}
        {workOptionsLoading ? (
          <p className="v2-crew-assign-empty">Loading available work…</p>
        ) : workOptionsError ? (
          <p className="v2-crew-assign-empty">{workOptionsError}</p>
        ) : workOptions.length === 0 ? (
          <p className="v2-crew-assign-empty">No draft, active, open, hiring, or scheduled work is available to assign yet.</p>
        ) : (
          <div className="v2-crew-assign-list">
            {workOptions.map((job) => (
              <button
                key={job.id}
                type="button"
                className={`v2-crew-assign-job-btn${member.currentJobId === job.id ? " is-current" : ""}`}
                onClick={() => onAssign(job.id)}
              >
                <Briefcase size={14} />
                <span>{job.title}</span>
                <span className="v2-crew-assign-status">{job.status}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Availability dot ──────────────────────────────────────────────────────────

function AvailDot({ status }: { status: CrewAvailability }) {
  const color = status === "available" ? "var(--v2-success)" : status === "busy" ? "var(--v2-warning)" : "var(--v2-text-muted)";
  const label = status === "available" ? "Available" : status === "busy" ? "Busy" : "Unavailable";
  return (
    <span
      className="v2-crew-avail-status-dot"
      style={{ background: color }}
      title={label}
      aria-label={label}
    />
  );
}

// ── Crew Card ─────────────────────────────────────────────────────────────────

function CrewCard({
  member,
  workOptions,
  onEdit,
  onDelete,
  onAssign,
}: {
  member: CrewMember;
  workOptions: NetworkWorkOption[];
  onEdit: () => void;
  onDelete: () => void;
  onAssign: () => void;
}) {
  const assignedJob = member.currentJobId
    ? workOptions.find((job) => job.id === member.currentJobId)
    : null;
  const licenseStatus = licenseExpiryStatus(member.licenseExpiry);

  return (
    <article className="v2-crew-card">
      <div className="v2-crew-card-header">
        <Avatar name={member.name} size="md" className="v2-network-avatar" />
        <div className="v2-crew-card-info">
          <div className="v2-crew-card-name-row">
            <strong>{member.name}</strong>
            <AvailDot status={member.availability} />
          </div>
          {member.trade && <span className="v2-crew-trade-badge">{member.trade}</span>}
          {member.hourlyRate && <span className="v2-crew-rate">${member.hourlyRate}/hr</span>}
        </div>
      </div>

      {/* Contact icons */}
      <div className="v2-crew-card-contacts">
        {member.phone && (
          <a href={`tel:${member.phone}`} className="v2-crew-contact-link" title={member.phone} aria-label={`Call ${member.name}`}>
            <Phone size={14} />
          </a>
        )}
        {member.email && (
          <a href={`mailto:${member.email}`} className="v2-crew-contact-link" title={member.email} aria-label={`Email ${member.name}`}>
            <Mail size={14} />
          </a>
        )}
      </div>

      {/* License info */}
      {member.license && (
        <div className={`v2-crew-license${licenseStatus === "expired" ? " is-expired" : licenseStatus === "warning" ? " is-warning" : ""}`}>
          <ShieldCheck size={12} />
          <span>{member.license}</span>
          {member.licenseExpiry && licenseStatus !== "ok" && (
            <span className="v2-crew-license-warn">
              <AlertTriangle size={11} />
              {licenseStatus === "expired" ? "Expired" : "Expires soon"}
            </span>
          )}
        </div>
      )}

      {/* Assigned job */}
      {assignedJob && (
        <div className="v2-crew-assigned-job">
          <Briefcase size={12} />
          <span>{assignedJob.title}</span>
        </div>
      )}

      {member.notes && <p className="v2-crew-card-notes">{member.notes}</p>}

      <div className="v2-crew-card-actions">
        <button type="button" className="v2-crew-assign-btn" onClick={onAssign}>
          <Briefcase size={12} />
          {member.currentJobId ? "Reassign" : "Assign to Job"}
        </button>
        <button type="button" className="v2-client-edit-btn" onClick={onEdit}>Edit</button>
        <button type="button" className="v2-client-delete-btn" onClick={onDelete}>Del</button>
      </div>
    </article>
  );
}

// ── Crew Manager (the enhanced Crew tab) ──────────────────────────────────────

function CrewManager({
  crewType,
  labelOverride,
  isDemo = false,
  workOptions,
  workOptionsLoading,
  workOptionsError,
}: {
  crewType: CrewType;
  labelOverride?: string;
  isDemo?: boolean;
  workOptions: NetworkWorkOption[];
  workOptionsLoading: boolean;
  workOptionsError: string | null;
}) {
  const [crew, setCrew] = useState<CrewMember[]>(() => isDemo ? demoCrewMembers : loadCrew());
  const [showForm, setShowForm] = useState(false);
  const [editingMember, setEditingMember] = useState<CrewMember | null>(null);
  const [assigningMember, setAssigningMember] = useState<CrewMember | null>(null);
  const [tradeFilter, setTradeFilter] = useState<string>("All");
  const [syncMessage, setSyncMessage] = useState(isDemo ? "Sample one-year crew history." : "Saved on this device.");
  const [inviteCopyMessage, setInviteCopyMessage] = useState("");

  useEffect(() => {
    if (isDemo) {
      return;
    }
    let cancelled = false;
    void syncCrewRecords().then((result) => {
      if (cancelled) return;
      setCrew(result.records);
      setSyncMessage(result.message);
    });
    return () => { cancelled = true; };
  }, [isDemo]);

  const members = crew.filter((m) => m.type === crewType);

  const trades = ["All", ...Array.from(new Set(members.map((m) => m.trade).filter(Boolean)))];

  const filtered = tradeFilter === "All" ? members : members.filter((m) => m.trade === tradeFilter);

  function persist(list: CrewMember[], changedMember?: CrewMember) {
    setCrew(list);
    if (isDemo) return;
    saveCrew(list);
    if (changedMember) {
      void upsertNetworkRecord(crewMemberToNetworkRecord(changedMember)).then((record) => {
        setSyncMessage(record ? "Synced to your RIVT account." : "Couldn't sync - saved on this device only.");
      });
    }
  }

  function handleSave(data: Omit<CrewMember, "id" | "addedAt">) {
    if (editingMember) {
      const updated = { ...editingMember, ...data };
      persist(crew.map((m) => m.id === editingMember.id ? updated : m), updated);
    } else {
      const next: CrewMember = { id: crypto.randomUUID(), ...data, type: crewType, addedAt: new Date().toISOString() };
      persist([next, ...crew], next);
    }
    setShowForm(false);
    setEditingMember(null);
  }

  function handleDelete(id: string) {
    if (!window.confirm("Remove this person from your crew?")) return;
    persist(crew.filter((m) => m.id !== id));
    void deleteNetworkRecordByLocalId("crew_member", id).then((ok) => {
      setSyncMessage(ok ? "Removed from your RIVT account." : "Removed on this device only. Could not sync removal.");
    });
  }

  function handleAssign(memberId: string, jobId: string) {
    const updated = crew.map((m) => m.id === memberId ? { ...m, currentJobId: jobId, availability: "busy" as const } : m);
    persist(updated, updated.find((m) => m.id === memberId));
    setAssigningMember(null);
  }

  function handleUnassign(memberId: string) {
    const updated = crew.map((m) => m.id === memberId ? { ...m, currentJobId: undefined, availability: "available" as const } : m);
    persist(updated, updated.find((m) => m.id === memberId));
    setAssigningMember(null);
  }

  async function copyInviteTemplate(member: CrewMember) {
    try {
      const response = await fetch("/api/v1/referrals/link", {
        method: "POST",
        credentials: "include",
      });
      const body = await response.json().catch(() => ({})) as {
        data?: { url?: string; pilotInviteStillRequired?: boolean };
        error?: { message?: string };
      };
      if (!response.ok || !body.data?.url) {
        throw new Error(body.error?.message || "RIVT could not create an invite link.");
      }
      const pilotNote = body.data.pilotInviteStillRequired ? "\nYou’ll still need your Jacksonville pilot code." : "";
      const text = `Hey ${member.name}, join me on RIVT for skilled-trade work and crew coordination:\n${body.data.url}${pilotNote}`;
      await navigator.clipboard.writeText(text);
      setInviteCopyMessage(`Tracked RIVT invite for ${member.name} copied. The link expires in 30 days.`);
    } catch {
      setInviteCopyMessage("Couldn't create or copy the RIVT invite.");
    }
  }

  const label = labelOverride ?? (crewType === "crew" ? "Crew" : "Subs");

  return (
    <div className="v2-crew-manager">
      <div className="v2-crew-manager-header">
        <span className="v2-crew-manager-title">{label} ({members.length})</span>
        <button
          type="button"
          className="v2-client-add-btn"
          onClick={() => { setEditingMember(null); setShowForm(true); }}
        >
          <Plus size={14} /> Add {crewType === "sub" ? "sub" : "person"}
        </button>
      </div>
      <p className="v2-client-sync-note" role="status">{syncMessage}</p>
      {inviteCopyMessage ? <p className="v2-network-copy-notice" role="status">{inviteCopyMessage}</p> : null}

      {/* Trade filter pills (subs tab) */}
      {crewType === "sub" && trades.length > 1 && (
        <div className="v2-crew-trade-filters">
          {trades.map((t) => (
            <button
              key={t}
              type="button"
              className={`v2-crew-trade-pill${tradeFilter === t ? " active" : ""}`}
              onClick={() => setTradeFilter(t)}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {showForm && (
        <CrewMemberForm
          initial={editingMember ? {
            type: editingMember.type,
            name: editingMember.name,
            trade: editingMember.trade,
            license: editingMember.license,
            licenseExpiry: editingMember.licenseExpiry,
            phone: editingMember.phone,
            email: editingMember.email,
            hourlyRate: editingMember.hourlyRate,
            availability: editingMember.availability,
            currentJobId: editingMember.currentJobId,
            notes: editingMember.notes,
          } : { type: crewType }}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditingMember(null); }}
        />
      )}

      {filtered.length === 0 && !showForm ? (
        <EmptyState
          className="v2-network-empty"
          icon={<Users size={20} />}
          title={`No ${label.toLowerCase()} yet`}
          description={crewType === "crew" ? "Track availability and assignments." : "Save subs you rely on."}
          compact
        />
      ) : (
        <div className="v2-crew-card-list">
          {filtered.map((member) => (
            <div key={member.id} className="v2-crew-card-wrapper">
              <CrewCard
                member={member}
                workOptions={workOptions}
                onEdit={() => { setEditingMember(member); setShowForm(true); }}
                onDelete={() => handleDelete(member.id)}
                onAssign={() => setAssigningMember(member)}
              />
              {crewType === "sub" && (
                <button
                  type="button"
                  className="v2-crew-invite-copy-btn"
                  onClick={() => void copyInviteTemplate(member)}
                  title="Copy tracked RIVT invite"
                >
                  <Copy size={13} />
                  Copy RIVT invite
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {assigningMember && (
        <JobAssignModal
          member={assigningMember}
          workOptions={workOptions}
          workOptionsLoading={workOptionsLoading}
          workOptionsError={workOptionsError}
          onAssign={(jobId) => handleAssign(assigningMember.id, jobId)}
          onUnassign={() => handleUnassign(assigningMember.id)}
          onClose={() => setAssigningMember(null)}
        />
      )}
    </div>
  );
}


// ── Crew Invite Planner ───────────────────────────────────────────────────────

const crewInviteKey = "rivt.crewInvites.v1";

type InviteStatus = "pending" | "accepted" | "declined";

interface CrewInvite {
  id: string;
  jobRef: string;
  name: string;
  trade: string;
  note: string;
  status: InviteStatus;
  createdAt: string;
}

const demoCrewInvites: CrewInvite[] = [
  { id: "demo-invite-1", jobRef: "Kitchen closeout", name: "Maya Brooks", trade: "Painting", note: "Available next Tuesday", status: "pending", createdAt: "2026-07-07T12:00:00.000Z" },
  { id: "demo-invite-2", jobRef: "Built-in install", name: "Caleb Wright", trade: "Carpentry", note: "Confirmed for two days", status: "accepted", createdAt: "2026-07-03T12:00:00.000Z" },
];

function readCrewInvites(): CrewInvite[] {
  try {
    const stored = localStorage.getItem(crewInviteKey);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as CrewInvite[];
    return Array.isArray(parsed) ? parsed.slice(0, 50) : [];
  } catch { return []; }
}

function persistCrewInvites(invites: CrewInvite[]) {
  try { localStorage.setItem(crewInviteKey, JSON.stringify(invites.slice(0, 50))); } catch { /* noop */ }
}

function recordObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function recordString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function recordNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function recordAvailability(value: unknown): CrewAvailability {
  return value === "busy" || value === "unavailable" ? value : "available";
}

function recordCrewType(value: unknown): CrewType {
  return value === "sub" ? "sub" : "crew";
}

function recordInviteStatus(value: unknown): InviteStatus {
  return value === "accepted" || value === "declined" ? value : "pending";
}

function networkRecordDate(iso: string): string | null {
  return iso ? iso.slice(0, 10) : null;
}

function mergeNetworkRows<T extends { id: string }>(localRows: T[], remoteRows: T[]): T[] {
  const remoteIds = new Set(remoteRows.map((row) => row.id));
  return [...remoteRows, ...localRows.filter((row) => !remoteIds.has(row.id))];
}

function crewMemberFromNetworkRecord(record: ServerNetworkRecord): CrewMember | null {
  const payload = recordObject(record.payload);
  const name = recordString(payload.name, record.title).trim();
  if (!name) return null;
  return {
    id: record.localId,
    type: recordCrewType(payload.type),
    name,
    trade: recordString(payload.trade),
    license: recordString(payload.license) || undefined,
    licenseExpiry: recordString(payload.licenseExpiry) || undefined,
    phone: recordString(payload.phone) || undefined,
    email: recordString(payload.email) || undefined,
    hourlyRate: recordNumber(payload.hourlyRate),
    availability: recordAvailability(payload.availability ?? record.status),
    currentJobId: recordString(payload.currentJobId) || undefined,
    notes: recordString(payload.notes) || undefined,
    addedAt: recordString(payload.addedAt, record.createdAt ?? new Date().toISOString()),
  };
}

function crewMemberToNetworkRecord(member: CrewMember): NetworkRecordInput {
  return {
    recordType: "crew_member",
    localId: member.id,
    title: member.name || "Crew member",
    status: member.availability,
    recordDate: networkRecordDate(member.addedAt),
    payload: { ...member },
  };
}

async function syncCrewRecords(): Promise<{ records: CrewMember[]; message: string }> {
  const localRows = loadCrew();
  const serverRows = await fetchNetworkRecords("crew_member");
  if (!serverRows) {
    return { records: localRows, message: "Couldn't sync - saved on this device only." };
  }
  const remoteRows = serverRows.map(crewMemberFromNetworkRecord).filter((row): row is CrewMember => Boolean(row));
  const remoteIds = new Set(remoteRows.map((row) => row.id));
  const localOnlyRows = localRows.filter((row) => !remoteIds.has(row.id));
  const merged = mergeNetworkRows(localRows, remoteRows);
  saveCrew(merged);
  await Promise.all(localOnlyRows.map((member) => upsertNetworkRecord(crewMemberToNetworkRecord(member))));
  return { records: merged, message: "Synced to your RIVT account." };
}

function crewInviteFromNetworkRecord(record: ServerNetworkRecord): CrewInvite | null {
  const payload = recordObject(record.payload);
  const name = recordString(payload.name, record.title).trim();
  if (!name) return null;
  return {
    id: record.localId,
    jobRef: recordString(payload.jobRef),
    name,
    trade: recordString(payload.trade),
    note: recordString(payload.note),
    status: recordInviteStatus(payload.status ?? record.status),
    createdAt: recordString(payload.createdAt, record.createdAt ?? new Date().toISOString()),
  };
}

function crewInviteToNetworkRecord(invite: CrewInvite): NetworkRecordInput {
  return {
    recordType: "crew_invite",
    localId: invite.id,
    title: invite.name || "Crew invite",
    status: invite.status,
    recordDate: networkRecordDate(invite.createdAt),
    payload: { ...invite },
  };
}

async function syncCrewInviteRecords(): Promise<{ records: CrewInvite[]; message: string }> {
  const localRows = readCrewInvites();
  const serverRows = await fetchNetworkRecords("crew_invite");
  if (!serverRows) {
    return { records: localRows, message: "Couldn't sync - saved on this device only." };
  }
  const remoteRows = serverRows.map(crewInviteFromNetworkRecord).filter((row): row is CrewInvite => Boolean(row));
  const remoteIds = new Set(remoteRows.map((row) => row.id));
  const localOnlyRows = localRows.filter((row) => !remoteIds.has(row.id));
  const merged = mergeNetworkRows(localRows, remoteRows).slice(0, 50);
  persistCrewInvites(merged);
  await Promise.all(localOnlyRows.map((invite) => upsertNetworkRecord(crewInviteToNetworkRecord(invite))));
  return { records: merged, message: "Synced to your RIVT account." };
}

function storedReviewFromNetworkRecord(record: ServerNetworkRecord): StoredReview | null {
  const payload = recordObject(record.payload);
  const reviewer = recordString(payload.reviewer, record.title).trim();
  const reviewText = recordString(payload.reviewText).trim();
  if (!reviewer || !reviewText) return null;
  const rating = Math.min(5, Math.max(1, Math.round(recordNumber(payload.rating) ?? 5)));
  return {
    id: record.localId,
    reviewer,
    trade: recordString(payload.trade) || undefined,
    reviewText,
    rating,
    date: recordString(payload.date, record.createdAt ?? new Date().toISOString()),
  };
}

function storedReviewToNetworkRecord(review: StoredReview): NetworkRecordInput {
  return {
    recordType: "network_review",
    localId: review.id,
    title: review.reviewer || "Network review",
    status: "written",
    recordDate: networkRecordDate(review.date),
    payload: { ...review },
  };
}

async function syncStoredReviewRecords(): Promise<{ records: StoredReview[]; message: string }> {
  const localRows = readStoredReviews();
  const serverRows = await fetchNetworkRecords("network_review");
  if (!serverRows) {
    return { records: localRows, message: "Couldn't sync - saved on this device only." };
  }
  const remoteRows = serverRows.map(storedReviewFromNetworkRecord).filter((row): row is StoredReview => Boolean(row));
  const remoteIds = new Set(remoteRows.map((row) => row.id));
  const localOnlyRows = localRows.filter((row) => !remoteIds.has(row.id));
  const merged = mergeNetworkRows(localRows, remoteRows);
  persistStoredReviews(merged);
  await Promise.all(localOnlyRows.map((review) => upsertNetworkRecord(storedReviewToNetworkRecord(review))));
  return { records: merged, message: "Synced to your RIVT account." };
}

function CrewInvitePlanner({ isDemo = false }: { isDemo?: boolean }) {
  const [invites, setInvites] = useState<CrewInvite[]>(() => isDemo ? demoCrewInvites : readCrewInvites());
  const [composerOpen, setComposerOpen] = useState(false);
  const [jobRef, setJobRef] = useState("");
  const [name, setName] = useState("");
  const [trade, setTrade] = useState("");
  const [note, setNote] = useState("");
  const [notice, setNotice] = useState("");
  const [syncMessage, setSyncMessage] = useState(isDemo ? "Sample invite history." : "Saved on this device.");

  useEffect(() => {
    if (isDemo) {
      return;
    }
    let cancelled = false;
    void syncCrewInviteRecords().then((result) => {
      if (cancelled) return;
      setInvites(result.records);
      setSyncMessage(result.message);
    });
    return () => { cancelled = true; };
  }, [isDemo]);

  function persist(inviteRows: CrewInvite[], changedInvite?: CrewInvite) {
    setInvites(inviteRows);
    if (isDemo) return;
    persistCrewInvites(inviteRows);
    if (changedInvite) {
      void upsertNetworkRecord(crewInviteToNetworkRecord(changedInvite)).then((record) => {
        setSyncMessage(record ? "Synced to your RIVT account." : "Couldn't sync - saved on this device only.");
      });
    }
  }

  function addInvite() {
    if (!name.trim()) return;
    const invite: CrewInvite = {
      id: crypto.randomUUID(),
      jobRef: jobRef.trim(),
      name: name.trim(),
      trade: trade.trim(),
      note: note.trim(),
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    const next = [invite, ...invites];
    persist(next, invite);
    setJobRef("");
    setName("");
    setTrade("");
    setNote("");
    setComposerOpen(false);
    setNotice("Invite planned.");
    setTimeout(() => setNotice(""), 2500);
  }

  function updateStatus(id: string, status: InviteStatus) {
    const next = invites.map((i) => i.id === id ? { ...i, status } : i);
    persist(next, next.find((i) => i.id === id));
  }

  function removeInvite(id: string) {
    const next = invites.filter((i) => i.id !== id);
    persist(next);
    void deleteNetworkRecordByLocalId("crew_invite", id).then((ok) => {
      setSyncMessage(ok ? "Removed from your RIVT account." : "Removed on this device only. Could not sync removal.");
    });
  }

  const pending = invites.filter((i) => i.status === "pending").length;
  const accepted = invites.filter((i) => i.status === "accepted").length;

  return (
    <Panel
      className="v2-network-panel v2-network-panel-wide"
      eyebrow={`${pending} pending · ${accepted} accepted`}
      title="Crew invite planner"
      action={
        <button
          type="button"
          className="v2-secondary-button"
          aria-expanded={composerOpen}
          onClick={() => setComposerOpen((open) => !open)}
        >
          <Plus size={14} />
          {composerOpen ? "Close" : "Plan invite"}
        </button>
      }
    >
      <div className="v2-crew-invite-planner">
        <p className="v2-client-sync-note" role="status">{syncMessage}</p>
        {composerOpen ? <div className="v2-crew-invite-form" aria-label="Plan a crew invite">
          <div className="v2-crew-invite-inputs">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name or company" />
            <input value={trade} onChange={(e) => setTrade(e.target.value)} placeholder="Trade (electrical, framing…)" />
            <input value={jobRef} onChange={(e) => setJobRef(e.target.value)} placeholder="Job or project name" />
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (rate, scope, start date…)" />
          </div>
          {notice ? <p className="v2-sub-roster-notice" role="status">{notice}</p> : null}
          <button type="button" className="v2-primary-button" disabled={!name.trim()} onClick={addInvite}><Plus size={14} />Plan invite</button>
        </div> : null}
        {invites.length ? (
          <div className="v2-crew-invite-list">
            {invites.map((inv) => (
              <article key={inv.id} className={`v2-crew-invite-item ci-status-${inv.status}`}>
                <div className="v2-crew-invite-item-head">
                  <Avatar name={inv.name} size="sm" className="v2-network-avatar" />
                  <div className="v2-crew-invite-copy">
                    <strong>{inv.name}</strong>
                    {inv.trade ? <span>{inv.trade}</span> : null}
                    {inv.jobRef ? <small>Job: {inv.jobRef}</small> : null}
                    {inv.note ? <small>{inv.note}</small> : null}
                  </div>
                  <span className={`v2-ci-pill ci-status-${inv.status}`}>{inv.status}</span>
                  <button type="button" className="v2-sub-roster-remove" aria-label={`Remove ${inv.name}`} onClick={() => removeInvite(inv.id)}><X size={14} /></button>
                </div>
                {inv.status === "pending" ? (
                  <div className="v2-crew-invite-actions">
                    <button type="button" className="v2-primary-button" onClick={() => updateStatus(inv.id, "accepted")}><CheckCircle2 size={13} />Accepted</button>
                    <button type="button" onClick={() => updateStatus(inv.id, "declined")}>Declined</button>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            className="v2-network-empty"
            icon={<Users size={20} />}
            title="No planned invites yet"
            description="Plan who to bring on next."
            compact
          />
        )}
      </div>
    </Panel>
  );
}

export function AnswerPrompt({ post, onOpenShopTalk }: { post: { title: string; trade: string; status: string }; onOpenShopTalk: () => void }) {
  return (
    <button type="button" className="v2-network-prompt" onClick={onOpenShopTalk}>
      <span className="v2-network-prompt-icon"><MessageSquareText size={16} /></span>
      <span>
        <strong>{post.title}</strong>
        <small>{post.trade} · {post.status}</small>
      </span>
      <ArrowRight size={15} />
    </button>
  );
}

function ProfileSearchSpotlight({
  profile,
  onDismiss,
}: {
  profile: ProfileSearchResult;
  onDismiss: () => void;
}) {
  const tradeLine = profile.trades.map((trade) => trade.name).filter(Boolean).join(", ");
  const roleLabel = profile.primaryRole === "contractor" ? "Contractor" : "Tradesperson";
  const availability =
    profile.availabilityStatus === "available"
      ? "Available"
      : profile.availabilityStatus === "limited"
        ? "Limited availability"
        : "Unavailable";
  const visibleRates = profile.rateCards ?? [];
  const formatMoney = (cents: number | null) => cents ? `$${(cents / 100).toLocaleString()}` : null;

  return (
    <Panel className="v2-network-spotlight">
      <div className="v2-network-spotlight-main">
        <Avatar name={profile.displayName} size="lg" className="v2-network-avatar" />
        <div>
          <span>Search result</span>
          <h2>{profile.displayName}</h2>
          <p>{profile.headline || roleLabel}</p>
          <small>{[tradeLine, profile.locationText].filter(Boolean).join(" · ") || roleLabel}</small>
          {visibleRates.length ? (
            <div className="v2-network-spotlight-rates" aria-label="Published reference rates">
              {visibleRates.map((rate) => (
                <div key={rate.tradeCode}>
                  <strong>{rate.tradeName}</strong>
                  <span>{[
                    rate.hourlyRateCents ? `${formatMoney(rate.hourlyRateCents)}/hr` : null,
                    rate.dayRateCents ? `${formatMoney(rate.dayRateCents)}/day` : null,
                    rate.minimumChargeCents ? `${formatMoney(rate.minimumChargeCents)} minimum` : null,
                  ].filter(Boolean).join(" · ")}</span>
                  {rate.notes ? <small>{rate.notes}</small> : null}
                </div>
              ))}
              <p>Reference rates only. Final pay is agreed in the offer before work starts.</p>
            </div>
          ) : null}
        </div>
      </div>
      <div className="v2-network-spotlight-actions">
        <span>{availability}</span>
        <button type="button" onClick={onDismiss} aria-label="Dismiss selected profile">
          <X size={15} />
          Dismiss
        </button>
      </div>
    </Panel>
  );
}

function ReviewsView({
  shoutOuts,
  displayName,
  accountId,
  focusedReviewId,
  onAddShoutOut,
}: {
  shoutOuts: ShoutOut[];
  displayName: string;
  accountId?: string | null;
  focusedReviewId?: string | null;
  onAddShoutOut: (to: string, trade: string, message: string) => void;
}) {
  const [to, setTo] = useState("");
  const [trade, setTrade] = useState("");
  const [message, setMessage] = useState("");
  const [rating, setRating] = useState(5);
  const [submitted, setSubmitted] = useState(false);
  const [storedReviews, setStoredReviews] = useState<StoredReview[]>(readStoredReviews);
  const [syncMessage, setSyncMessage] = useState("Saved on this device.");
  const [workReviews, setWorkReviews] = useState<WorkReview[]>([]);
  const [workReviewsLoading, setWorkReviewsLoading] = useState(true);
  const [workReviewError, setWorkReviewError] = useState("");
  const [reviewAction, setReviewAction] = useState("");
  const [disputeReason, setDisputeReason] = useState("");
  const focusedReviewRef = useRef<HTMLElement | null>(null);

  const given = shoutOuts.filter((s) => s.from === displayName);
  const storedGivenKeys = new Set(storedReviews.map((review) => `${review.reviewer}|${review.trade ?? ""}|${review.reviewText}`));
  const transientGiven = given.filter((item) => !storedGivenKeys.has(`${item.to}|${item.trade ?? ""}|${item.message}`));
  const normalizedFocusedReviewId = focusedReviewId ? String(focusedReviewId) : null;
  const focusedWorkReview = normalizedFocusedReviewId
    ? workReviews.find((review) => review.id === normalizedFocusedReviewId) ?? null
    : null;

  useEffect(() => {
    let cancelled = false;
    fetchWorkReviews()
      .then(async (reviews) => {
        const exactReview = normalizedFocusedReviewId && !reviews.some((review) => review.id === normalizedFocusedReviewId)
          ? await fetchWorkReview(normalizedFocusedReviewId)
          : null;
        if (!cancelled) {
          setWorkReviews(exactReview ? [exactReview, ...reviews] : reviews);
          setWorkReviewError("");
        }
      })
      .catch((error) => {
        if (!cancelled) setWorkReviewError(reviewErrorMessage(error));
      })
      .finally(() => {
        if (!cancelled) setWorkReviewsLoading(false);
      });
    return () => { cancelled = true; };
  }, [normalizedFocusedReviewId]);

  useEffect(() => {
    let cancelled = false;
    void syncStoredReviewRecords().then((result) => {
      if (cancelled) return;
      setStoredReviews(result.records);
      setSyncMessage(result.message);
    });
    return () => { cancelled = true; };
  }, []);

  async function updateWorkReview(kind: "approve" | "dispute") {
    if (!focusedWorkReview) return;
    if (kind === "dispute" && !disputeReason.trim()) {
      setWorkReviewError("Describe what is inaccurate before disputing the review.");
      return;
    }
    setReviewAction(kind);
    setWorkReviewError("");
    try {
      const updated = kind === "approve"
        ? await approveWorkReview(focusedWorkReview.id)
        : await disputeWorkReview(focusedWorkReview.id, disputeReason.trim());
      setWorkReviews((current) => current.map((review) => review.id === updated.id ? updated : review));
      setDisputeReason("");
    } catch (error) {
      setWorkReviewError(reviewErrorMessage(error));
    } finally {
      setReviewAction("");
    }
  }

  useEffect(() => {
    if (!normalizedFocusedReviewId) return;
    focusedReviewRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [normalizedFocusedReviewId, storedReviews.length, transientGiven.length]);

  function submit() {
    if (!to.trim() || !message.trim()) return;
    onAddShoutOut(to.trim(), trade.trim(), message.trim());
    const newReview: StoredReview = {
      id: crypto.randomUUID(),
      reviewer: to.trim(),
      trade: trade.trim(),
      reviewText: message.trim(),
      rating,
      date: new Date().toISOString(),
    };
    const next = [newReview, ...storedReviews];
    setStoredReviews(next);
    persistStoredReviews(next);
    void upsertNetworkRecord(storedReviewToNetworkRecord(newReview)).then((record) => {
      setSyncMessage(record ? "Synced to your RIVT account." : "Couldn't sync - saved on this device only.");
    });
    setTo("");
    setTrade("");
    setMessage("");
    setRating(5);
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
  }

  return (
    <div className="v2-reviews-page">
      {normalizedFocusedReviewId ? (
        <Panel className="v2-canonical-review-panel" eyebrow="Work review" title={focusedWorkReview?.status === "pending_approval" ? "Review pending your approval" : "Review details"}>
          {workReviewsLoading ? <p>Loading the submitted review...</p> : focusedWorkReview ? (
            <article className="v2-canonical-review">
              <header>
                <Avatar name={focusedWorkReview.reviewer?.displayName || "RIVT member"} size="sm" />
                <div><strong>{focusedWorkReview.reviewer?.displayName || "RIVT member"}</strong><span>{focusedWorkReview.job?.title || "Completed work"}</span></div>
                <span className="v2-review-status">{focusedWorkReview.status.replaceAll("_", " ")}</span>
              </header>
              <div className="v2-review-stars-display" aria-label={`${focusedWorkReview.rating} out of 5 stars`}>{focusedWorkReview.rating}/5</div>
              <blockquote>{focusedWorkReview.body}</blockquote>
              <small>{focusedWorkReview.job ? `${focusedWorkReview.job.publicLocation.city}, ${focusedWorkReview.job.publicLocation.region}` : "Submitted through completed RIVT work"}</small>
              {focusedWorkReview.revieweeAccountId === accountId && focusedWorkReview.status === "pending_approval" ? (
                <div className="v2-review-approval-actions">
                  <p>Approve to publish this review on your profile. Dispute only if the review is inaccurate or violates policy.</p>
                  <textarea value={disputeReason} onChange={(event) => setDisputeReason(event.target.value)} rows={3} placeholder="Why is this review inaccurate?" />
                  <div>
                    <button type="button" className="v2-secondary-button" disabled={Boolean(reviewAction) || !disputeReason.trim()} onClick={() => void updateWorkReview("dispute")}>Dispute review</button>
                    <button type="button" className="v2-primary-button" disabled={Boolean(reviewAction)} onClick={() => void updateWorkReview("approve")}><CheckCircle2 size={16} />Approve review</button>
                  </div>
                </div>
              ) : null}
            </article>
          ) : <p>This review could not be found. It may have been withdrawn or already resolved.</p>}
          {workReviewError ? <p className="v2-review-api-error" role="alert">{workReviewError}</p> : null}
        </Panel>
      ) : null}
      {!normalizedFocusedReviewId ? <div className="v2-reviews-grid">
        <Panel
          className="v2-reviews-panel v2-reviews-panel-wide"
          eyebrow="Private review note"
          title="Save a note about someone you worked with"
        >
          <p className="v2-client-sync-note" role="status">{syncMessage}</p>
          <div className="v2-review-form">
            <label>
              <span>Who is this note about?</span>
              <input
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="Name or company"
              />
            </label>
            <label>
              <span>Trade / context</span>
              <input
                value={trade}
                onChange={(e) => setTrade(e.target.value)}
                placeholder="Electrical, roofing, general…"
              />
            </label>
            <label className="is-wide">
              <span>Your review</span>
              <div className="v2-star-selector">
                {[1,2,3,4,5].map(n => (
                  <button key={n} type="button"
                    className={`v2-star-btn${n <= rating ? " filled" : ""}`}
                    onClick={() => setRating(n)}
                    aria-label={`${n} star${n > 1 ? "s" : ""}`}
                  >★</button>
                ))}
              </div>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                placeholder="What made them worth working with? This stays in your RIVT notes."
              />
            </label>
            <div className="v2-review-form-actions">
              {submitted && <span className="v2-review-sent">Saved to your notes.</span>}
              <button
                type="button"
                className="v2-primary-button"
                disabled={!to.trim() || !message.trim()}
                onClick={submit}
              >
                <Save size={15} />
                Save review to your notes
              </button>
            </div>
          </div>
        </Panel>

        <Panel
          className="v2-reviews-panel"
          eyebrow={`${storedReviews.length + transientGiven.length} saved`}
          title="Review notes you've saved"
        >
          {(storedReviews.length > 0 || transientGiven.length > 0) ? (
            <div className="v2-reviews-list">
              {storedReviews.map((review) => {
                const isFocused = String(review.id) === normalizedFocusedReviewId;
                return (
                <article key={review.id} ref={isFocused ? focusedReviewRef : undefined} className={`v2-review-item${isFocused ? " is-focused" : ""}`}>
                  <div className="v2-review-item-header">
                    <Avatar name={review.reviewer} size="sm" />
                    <div>
                      <strong>{review.reviewer}</strong>
                      {review.trade && <span>{review.trade}</span>}
                    </div>
                  </div>
                  <div className="v2-review-stars-display" aria-label={`${review.rating} out of 5 stars`}>
                    {review.rating}/5
                  </div>
                  <p>{review.reviewText}</p>
                </article>
                );
              })}
              {transientGiven.map((item) => {
                const isFocused = String(item.id) === normalizedFocusedReviewId;
                return (
                <article key={item.id} ref={isFocused ? focusedReviewRef : undefined} className={`v2-review-item${isFocused ? " is-focused" : ""}`}>
                  <div className="v2-review-item-header">
                    <Avatar name={item.to} size="sm" />
                    <div>
                      <strong>{item.to}</strong>
                      {item.trade && <span>{item.trade}</span>}
                    </div>
                  </div>
                  <p>{item.message}</p>
                </article>
                );
              })}
            </div>
          ) : (
            <EmptyState
              className="v2-network-empty"
              icon={<Star size={20} />}
              title="No reviews written yet"
              description="Use the form above to write your first shout-out."
              compact
            />
          )}
        </Panel>
      </div> : null}
    </div>
  );
}

type NetworkTab = "People" | "Subs" | "Reviews" | "Customers";

export function NetworkHub({
  view,
  shoutOuts,
  displayName,
  accountId = null,
  workOptions,
  workOptionsLoading = false,
  workOptionsError = null,
  profileFocus = null,
  focusedReviewId = null,
  onClearProfileFocus = () => undefined,
  onOpenPeople,
  onOpenWork,
  onOpenReviews,
  onAddShoutOut,
  isDemo = false,
}: NetworkHubProps) {
  // Internal tab state — derive initial tab from the incoming view prop
  const [activeTab, setActiveTab] = useState<NetworkTab>(() =>
    view === "Reviews" ? "Reviews" : "People"
  );

  const visibleTab: NetworkTab = view === "Reviews"
    ? "Reviews"
    : activeTab === "Reviews" ? "People" : activeTab;


  // Tab bar shared across all views
  const tabBar = (
    <div className="v2-network-tab-bar">
      {(["People", "Subs", "Reviews", "Customers"] as NetworkTab[]).map((tab) => (
        <button
          key={tab}
          type="button"
          className={`v2-network-tab-btn${visibleTab === tab ? " active" : ""}`}
          onClick={() => {
            setActiveTab(tab);
            if (tab === "Reviews") onOpenReviews();
            else if (tab === "People") onOpenPeople();
          }}
        >
          {tab}
        </button>
      ))}
    </div>
  );

  const pageHeader = (
    <>
      <PageHeader className="v2-network-header" title="People" />
      <nav className="v2-people-work-switcher" aria-label="Work views">
        <button type="button" onClick={onOpenWork}>Jobs</button>
        <button type="button" className="is-active" aria-current="page">People</button>
      </nav>
    </>
  );

  if (visibleTab === "Customers") {
    return (
      <section className="v2-network-page" aria-label="Customers">
        {pageHeader}
        {tabBar}
        <ClientBookView />
      </section>
    );
  }

  if (visibleTab === "Reviews") {
    return (
      <section className="v2-network-page" aria-label="Reviews">
        {pageHeader}
        {tabBar}
        <ReviewsView
          shoutOuts={shoutOuts}
          displayName={displayName}
          accountId={accountId}
          focusedReviewId={focusedReviewId}
          onAddShoutOut={onAddShoutOut}
        />
      </section>
    );
  }

  if (visibleTab === "Subs") {
    return (
      <section className="v2-network-page" aria-label="Subs">
        {pageHeader}
        {tabBar}
        <CrewManager
          crewType="sub"
          isDemo={isDemo}
          workOptions={workOptions}
          workOptionsLoading={workOptionsLoading}
          workOptionsError={workOptionsError}
        />
      </section>
    );
  }

  // People tab
  return (
    <section className="v2-network-page" aria-label="People">
      {pageHeader}
      {tabBar}
      {profileFocus ? <ProfileSearchSpotlight profile={profileFocus} onDismiss={onClearProfileFocus} /> : null}

      <div className="v2-crew-workbench">
        <CrewManager
          crewType="crew"
          labelOverride="People"
          isDemo={isDemo}
          workOptions={workOptions}
          workOptionsLoading={workOptionsLoading}
          workOptionsError={workOptionsError}
        />
        <details className="v2-crew-invite-fold">
          <summary>Plan an invite</summary>
          <CrewInvitePlanner isDemo={isDemo} />
        </details>
      </div>

    </section>
  );
}

