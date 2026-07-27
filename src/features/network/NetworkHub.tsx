import {
  Archive,
  AlertTriangle,
  ArrowRight,
  Briefcase,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  FileText,
  FolderKanban,
  Globe2,
  Mail,
  MapPin,
  MessageSquareText,
  Phone,
  PackageOpen,
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
  createContact,
  contactsCsv,
  deleteJobContactLink,
  deleteProjectContactLink,
  fetchContactActivity,
  fetchContactWorkLinks,
  fetchContacts,
  parseContactsCsv,
  saveJobContactLink,
  saveProjectContactLink,
  updateContact,
  type ContactActivity,
  type ContactInput,
  type ContactWorkLink,
  type ContactRecord,
  type ContactRole,
  type ContactRoleRecord,
} from "./contacts-api";
import {
  listStandaloneProjects,
  type StandaloneProject,
} from "../tools/standalone-project-api";
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

const _ClientBookView = function ClientBookView() {
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

const _CrewManager = function CrewManager({
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

const _CrewInvitePlanner = function CrewInvitePlanner({ isDemo = false }: { isDemo?: boolean }) {
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
};

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

const contactRoleLabels: Record<ContactRole, string> = {
  crew: "Crew",
  subcontractor: "Sub",
  customer: "Customer",
  supplier: "Supplier",
  other: "Other",
};

interface ContactFormState {
  entityType: "person" | "company";
  name: string;
  company: string;
  email: string;
  phone: string;
  website: string;
  billingAddress: string;
  serviceAddress: string;
  mailingAddress: string;
  notes: string;
  tags: string;
  roles: ContactRole[];
  trade: string;
  license: string;
  licenseExpiry: string;
  hourlyRate: string;
  availability: "available" | "busy" | "unavailable";
  preferredContactMethod: "none" | "email" | "phone" | "sms";
  defaultTerms: string;
  supplierAccountNumber: string;
  supplierRepresentative: string;
  supplierTerms: string;
  otherLabel: string;
}

function contactRoleDetails(contact: ContactRecord | null, role: ContactRole) {
  return contact?.roles.find((candidate) => candidate.role === role)?.details ?? {};
}

function contactMethodValue(contact: ContactRecord | null, kind: "email" | "phone" | "website") {
  const matches = contact?.methods.filter((method) => method.kind === kind) ?? [];
  return (matches.find((method) => method.isPrimary) ?? matches[0])?.value ?? "";
}

function contactAddressValue(contact: ContactRecord | null, kind: "billing" | "service" | "mailing") {
  const matches = contact?.addresses.filter((address) => address.kind === kind) ?? [];
  return (matches.find((address) => address.isPrimary) ?? matches[0])?.address ?? "";
}

function stringDetail(details: Record<string, unknown>, key: string) {
  return typeof details[key] === "string" ? details[key] : "";
}

function contactFormState(contact: ContactRecord | null, initialRole?: ContactRole): ContactFormState {
  const fieldRole = contact?.roles.find(({ role }) => role === "subcontractor")
    ? "subcontractor"
    : "crew";
  const fieldDetails = contactRoleDetails(contact, fieldRole);
  const customerDetails = contactRoleDetails(contact, "customer");
  const supplierDetails = contactRoleDetails(contact, "supplier");
  const otherDetails = contactRoleDetails(contact, "other");
  const hourlyRate = typeof fieldDetails.hourlyRate === "number"
    ? String(fieldDetails.hourlyRate)
    : "";
  return {
    entityType: contact?.entityType ?? (initialRole === "supplier" ? "company" : "person"),
    name: contact?.name ?? "",
    company: contact?.company ?? "",
    email: contactMethodValue(contact, "email"),
    phone: contactMethodValue(contact, "phone"),
    website: contactMethodValue(contact, "website"),
    billingAddress: contactAddressValue(contact, "billing"),
    serviceAddress: contactAddressValue(contact, "service"),
    mailingAddress: contactAddressValue(contact, "mailing"),
    notes: contact?.notes ?? "",
    tags: contact?.tags.join(", ") ?? "",
    roles: contact
      ? contact.roles.filter(({ status }) => status === "active").map(({ role }) => role)
      : initialRole ? [initialRole] : [],
    trade: stringDetail(fieldDetails, "trade"),
    license: stringDetail(fieldDetails, "license"),
    licenseExpiry: stringDetail(fieldDetails, "licenseExpiry"),
    hourlyRate,
    availability: fieldDetails.availability === "busy" || fieldDetails.availability === "unavailable"
      ? fieldDetails.availability
      : "available",
    preferredContactMethod: ["email", "phone", "sms"].includes(String(customerDetails.preferredContactMethod))
      ? customerDetails.preferredContactMethod as ContactFormState["preferredContactMethod"]
      : "none",
    defaultTerms: stringDetail(customerDetails, "defaultTerms"),
    supplierAccountNumber: stringDetail(supplierDetails, "accountNumber"),
    supplierRepresentative: stringDetail(supplierDetails, "representative"),
    supplierTerms: stringDetail(supplierDetails, "paymentTerms"),
    otherLabel: stringDetail(otherDetails, "label"),
  };
}

function contactInputFromForm(form: ContactFormState, existing: ContactRecord | null): ContactInput {
  const previousRoleDetails = new Map(
    (existing?.roles ?? []).map(({ role, details }) => [role, details]),
  );
  const roleRecord = (role: ContactRole, details: Record<string, unknown>): ContactRoleRecord => ({
    role,
    status: "active",
    details: {
      ...(previousRoleDetails.get(role) ?? {}),
      ...details,
    },
  });
  const roles = form.roles.map((role) => {
    if (role === "crew" || role === "subcontractor") {
      return roleRecord(role, {
        trade: form.trade.trim(),
        license: form.license.trim(),
        licenseExpiry: form.licenseExpiry,
        hourlyRate: form.hourlyRate ? Number(form.hourlyRate) : undefined,
        availability: form.availability,
      });
    }
    if (role === "customer") {
      return roleRecord(role, {
        preferredContactMethod: form.preferredContactMethod,
        defaultTerms: form.defaultTerms.trim(),
      });
    }
    if (role === "supplier") {
      return roleRecord(role, {
        accountNumber: form.supplierAccountNumber.trim(),
        representative: form.supplierRepresentative.trim(),
        paymentTerms: form.supplierTerms.trim(),
      });
    }
    return roleRecord(role, { label: form.otherLabel.trim() });
  });
  return {
    entityType: form.entityType,
    name: form.name.trim(),
    company: form.company.trim(),
    notes: form.notes.trim(),
    favorite: existing?.favorite ?? false,
    status: existing?.status ?? "active",
    roles,
    methods: [
      form.email.trim() ? {
        kind: "email" as const,
        label: "work",
        value: form.email.trim(),
        isPrimary: true,
      } : null,
      form.phone.trim() ? {
        kind: "phone" as const,
        label: "mobile",
        value: form.phone.trim(),
        isPrimary: true,
      } : null,
      form.website.trim() ? {
        kind: "website" as const,
        label: "website",
        value: form.website.trim(),
        isPrimary: true,
      } : null,
      ...(existing?.methods.filter((method) => !method.isPrimary) ?? []),
    ].filter((method): method is NonNullable<typeof method> => Boolean(method)),
    addresses: [
      form.billingAddress.trim() ? {
        kind: "billing" as const,
        label: "Billing",
        address: form.billingAddress.trim(),
        isPrimary: true,
      } : null,
      form.serviceAddress.trim() ? {
        kind: "service" as const,
        label: "Service",
        address: form.serviceAddress.trim(),
        isPrimary: true,
      } : null,
      form.mailingAddress.trim() ? {
        kind: "mailing" as const,
        label: "Mailing",
        address: form.mailingAddress.trim(),
        isPrimary: true,
      } : null,
      ...(existing?.addresses.filter((address) => !address.isPrimary) ?? []),
    ].filter((address): address is NonNullable<typeof address> => Boolean(address)),
    tags: form.tags.split(",").map((tag) => tag.trim().toLowerCase()).filter(Boolean),
  };
}

function ContactEditor({
  contact,
  initialRole,
  onSaved,
  onCancel,
}: {
  contact: ContactRecord | null;
  initialRole?: ContactRole;
  onSaved: (contact: ContactRecord) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(() => contactFormState(contact, initialRole));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  function field<K extends keyof ContactFormState>(key: K, value: ContactFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function toggleRole(role: ContactRole) {
    field(
      "roles",
      form.roles.includes(role)
        ? form.roles.filter((candidate) => candidate !== role)
        : [...form.roles, role],
    );
  }

  async function save() {
    if (!form.name.trim() || !form.roles.length) return;
    setSaving(true);
    setMessage("");
    const input = contactInputFromForm(form, contact);
    const result = contact
      ? await updateContact(contact.id, input)
      : await createContact(input);
    setSaving(false);
    if (result.contact) {
      onSaved(result.contact);
      return;
    }
    if (result.duplicateCandidates.length) {
      const candidate = result.duplicateCandidates[0];
      setMessage(
        `${candidate.company || candidate.name} already uses that email or phone. Edit the existing contact instead.`,
      );
      return;
    }
    setMessage(result.error ?? "RIVT could not save this contact.");
  }

  const hasFieldRole = form.roles.includes("crew") || form.roles.includes("subcontractor");
  return (
    <section className="v2-contact-editor" aria-label={contact ? "Edit contact" : "Add contact"}>
      <header>
        <div>
          <strong>{contact ? "Edit contact" : "Add contact"}</strong>
          <small>One contact can have more than one role.</small>
        </div>
        <button type="button" onClick={onCancel} aria-label="Close contact editor"><X size={18} /></button>
      </header>

      <div className="v2-contact-role-picker" aria-label="Contact roles">
        {(Object.keys(contactRoleLabels) as ContactRole[]).map((role) => (
          <button
            key={role}
            type="button"
            className={form.roles.includes(role) ? "is-active" : ""}
            aria-pressed={form.roles.includes(role)}
            onClick={() => toggleRole(role)}
          >
            {contactRoleLabels[role]}
          </button>
        ))}
      </div>
      {!form.roles.length ? <p className="v2-contact-form-message">Choose at least one role.</p> : null}

      <div className="v2-contact-form-grid">
        <label>
          <span>Record type</span>
          <select value={form.entityType} onChange={(event) => field("entityType", event.target.value as ContactFormState["entityType"])}>
            <option value="person">Person</option>
            <option value="company">Company</option>
          </select>
        </label>
        <label>
          <span>{form.entityType === "company" ? "Primary contact *" : "Name *"}</span>
          <input value={form.name} onChange={(event) => field("name", event.target.value)} />
        </label>
        <label>
          <span>Company</span>
          <input value={form.company} onChange={(event) => field("company", event.target.value)} />
        </label>
        <label>
          <span>Email</span>
          <input type="email" value={form.email} onChange={(event) => field("email", event.target.value)} />
        </label>
        <label>
          <span>Phone</span>
          <input type="tel" value={form.phone} onChange={(event) => field("phone", event.target.value)} />
        </label>
        <label>
          <span>Website</span>
          <input type="url" value={form.website} onChange={(event) => field("website", event.target.value)} placeholder="https://" />
        </label>

        {hasFieldRole ? (
          <>
            <label>
              <span>Trade</span>
              <input value={form.trade} onChange={(event) => field("trade", event.target.value)} />
            </label>
            <label>
              <span>Availability</span>
              <select value={form.availability} onChange={(event) => field("availability", event.target.value as ContactFormState["availability"])}>
                <option value="available">Available</option>
                <option value="busy">Busy</option>
                <option value="unavailable">Unavailable</option>
              </select>
            </label>
            <label>
              <span>License</span>
              <input value={form.license} onChange={(event) => field("license", event.target.value)} />
            </label>
            <label>
              <span>License expiry</span>
              <input type="date" value={form.licenseExpiry} onChange={(event) => field("licenseExpiry", event.target.value)} />
            </label>
            <label>
              <span>Hourly rate</span>
              <input type="number" min="0" step="0.01" value={form.hourlyRate} onChange={(event) => field("hourlyRate", event.target.value)} />
            </label>
          </>
        ) : null}

        {form.roles.includes("customer") ? (
          <>
            <label>
              <span>Preferred contact</span>
              <select value={form.preferredContactMethod} onChange={(event) => field("preferredContactMethod", event.target.value as ContactFormState["preferredContactMethod"])}>
                <option value="none">Not set</option>
                <option value="email">Email</option>
                <option value="phone">Phone</option>
                <option value="sms">Text</option>
              </select>
            </label>
            <label>
              <span>Default terms</span>
              <input value={form.defaultTerms} onChange={(event) => field("defaultTerms", event.target.value)} />
            </label>
            <label className="is-wide">
              <span>Billing address</span>
              <input value={form.billingAddress} onChange={(event) => field("billingAddress", event.target.value)} />
            </label>
            <label className="is-wide">
              <span>Service address</span>
              <input value={form.serviceAddress} onChange={(event) => field("serviceAddress", event.target.value)} />
            </label>
          </>
        ) : null}

        {form.roles.includes("supplier") ? (
          <>
            <label>
              <span>Supplier account number</span>
              <input value={form.supplierAccountNumber} onChange={(event) => field("supplierAccountNumber", event.target.value)} />
            </label>
            <label>
              <span>Sales representative</span>
              <input value={form.supplierRepresentative} onChange={(event) => field("supplierRepresentative", event.target.value)} />
            </label>
            <label>
              <span>Payment terms</span>
              <input value={form.supplierTerms} onChange={(event) => field("supplierTerms", event.target.value)} placeholder="Net 30, COD…" />
            </label>
            <label className="is-wide">
              <span>Mailing or branch address</span>
              <input value={form.mailingAddress} onChange={(event) => field("mailingAddress", event.target.value)} />
            </label>
          </>
        ) : null}

        {form.roles.includes("other") ? (
          <label>
            <span>Relationship label</span>
            <input value={form.otherLabel} onChange={(event) => field("otherLabel", event.target.value)} placeholder="Inspector, architect…" />
          </label>
        ) : null}
        <label className="is-wide">
          <span>Tags</span>
          <input value={form.tags} onChange={(event) => field("tags", event.target.value)} placeholder="preferred, jacksonville, emergency" />
        </label>
        <label className="is-wide">
          <span>Private notes</span>
          <textarea rows={3} value={form.notes} onChange={(event) => field("notes", event.target.value)} />
        </label>
      </div>

      {message ? <p className="v2-contact-form-message" role="status">{message}</p> : null}
      <footer>
        <button type="button" onClick={onCancel}>Cancel</button>
        <button
          type="button"
          className="v2-primary-button"
          disabled={saving || !form.name.trim() || !form.roles.length}
          onClick={() => void save()}
        >
          {saving ? "Saving…" : "Save contact"}
        </button>
      </footer>
    </section>
  );
}

function contactRoleSummary(contact: ContactRecord) {
  return contact.roles
    .filter(({ status }) => status === "active")
    .map(({ role, details }) => {
      if ((role === "crew" || role === "subcontractor") && typeof details.trade === "string" && details.trade) {
        return `${contactRoleLabels[role]} · ${details.trade}`;
      }
      if (role === "other" && typeof details.label === "string" && details.label) return details.label;
      return contactRoleLabels[role];
    });
}

const demoContactRecords: ContactRecord[] = demoCrewMembers.map((member) => ({
  id: member.id,
  entityType: "person",
  name: member.name,
  company: "",
  notes: member.notes ?? "",
  favorite: false,
  status: "active",
  linkedAccountId: null,
  lastUsedAt: null,
  roles: [{
    role: member.type === "sub" ? "subcontractor" : "crew",
    status: "active",
    details: {
      trade: member.trade,
      license: member.license,
      licenseExpiry: member.licenseExpiry,
      hourlyRate: member.hourlyRate,
      availability: member.availability,
      currentJobId: member.currentJobId,
    },
  }],
  methods: [
    member.email ? {
      id: `${member.id}-email`,
      kind: "email" as const,
      label: "work",
      value: member.email,
      isPrimary: true,
    } : null,
    member.phone ? {
      id: `${member.id}-phone`,
      kind: "phone" as const,
      label: "mobile",
      value: member.phone,
      isPrimary: true,
    } : null,
  ].filter((method): method is NonNullable<typeof method> => Boolean(method)),
  addresses: [],
  tags: ["sample"],
  createdAt: member.addedAt,
  updatedAt: member.addedAt,
}));

function ContactDirectoryView({
  role,
  isDemo = false,
  workOptions = [],
  workOptionsLoading = false,
  workOptionsError = null,
}: {
  role?: ContactRole;
  isDemo?: boolean;
  workOptions?: NetworkWorkOption[];
  workOptionsLoading?: boolean;
  workOptionsError?: string | null;
}) {
  const [contacts, setContacts] = useState<ContactRecord[]>(
    () => isDemo ? demoContactRecords : [],
  );
  const [loading, setLoading] = useState(!isDemo);
  const [message, setMessage] = useState(isDemo ? "Sample relationship directory." : "");
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<ContactRecord | null | "new">(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activityByContact, setActivityByContact] = useState<Record<string, ContactActivity[] | null | undefined>>({});
  const [linksByContact, setLinksByContact] = useState<Record<string, ContactWorkLink[] | null | undefined>>({});
  const [standaloneProjects, setStandaloneProjects] = useState<StandaloneProject[]>([]);
  const [linkTarget, setLinkTarget] = useState("");
  const [linkRelationship, setLinkRelationship] = useState("");
  const [linkNotes, setLinkNotes] = useState("");
  const [linkBusy, setLinkBusy] = useState(false);
  const [inviteBusyId, setInviteBusyId] = useState<string | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isDemo) return;
    let cancelled = false;
    void fetchContacts({ role, status: showArchived ? "all" : "active" }).then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (!result) {
        setMessage("RIVT could not sync the relationship directory.");
        return;
      }
      setContacts(result);
      setMessage("Synced to your RIVT account.");
    });
    return () => { cancelled = true; };
  }, [isDemo, role, showArchived]);

  useEffect(() => {
    if (isDemo) return;
    let cancelled = false;
    void listStandaloneProjects()
      .then((projects) => {
        if (!cancelled) setStandaloneProjects(projects.filter(({ status }) => status === "active"));
      })
      .catch(() => {
        if (!cancelled) setStandaloneProjects([]);
      });
    return () => { cancelled = true; };
  }, [isDemo]);

  const visible = contacts.filter((contact) => {
    if (!showArchived && contact.status === "archived") return false;
    const needle = query.trim().toLowerCase();
    if (!needle) return true;
    return [
      contact.name,
      contact.company,
      ...contact.tags,
      ...contact.methods.map(({ value }) => value),
      ...contactRoleSummary(contact),
    ].some((value) => value.toLowerCase().includes(needle));
  });

  function replace(saved: ContactRecord) {
    setContacts((current) => {
      const exists = current.some(({ id }) => id === saved.id);
      return exists
        ? current.map((contact) => contact.id === saved.id ? saved : contact)
        : [saved, ...current];
    });
    setEditing(null);
    setMessage("Contact synced to your RIVT account.");
  }

  async function toggleArchive(contact: ContactRecord) {
    const nextStatus = contact.status === "archived" ? "active" : "archived";
    const result = await updateContact(contact.id, { status: nextStatus });
    if (result.contact) {
      replace(result.contact);
      return;
    }
    setMessage(result.error ?? "RIVT could not update this contact.");
  }

  async function toggleFavorite(contact: ContactRecord) {
    const result = await updateContact(contact.id, { favorite: !contact.favorite });
    if (result.contact) {
      replace(result.contact);
      return;
    }
    setMessage(result.error ?? "RIVT could not update this contact.");
  }

  function toggleExpanded(contact: ContactRecord) {
    const nextId = expandedId === contact.id ? null : contact.id;
    setExpandedId(nextId);
    setLinkTarget("");
    setLinkRelationship("");
    setLinkNotes("");
    if (!nextId) return;
    if (isDemo) {
      setActivityByContact((current) => ({ ...current, [contact.id]: [] }));
      setLinksByContact((current) => ({ ...current, [contact.id]: [] }));
      return;
    }
    if (activityByContact[contact.id] === undefined) {
      setActivityByContact((current) => ({ ...current, [contact.id]: undefined }));
      void fetchContactActivity(contact.id).then((activity) => {
        setActivityByContact((current) => ({ ...current, [contact.id]: activity }));
      });
    }
    if (linksByContact[contact.id] === undefined) {
      void fetchContactWorkLinks(contact.id).then((links) => {
        setLinksByContact((current) => ({ ...current, [contact.id]: links }));
      });
    }
  }

  async function saveWorkLink(contact: ContactRecord) {
    const [targetKind, targetId] = linkTarget.split(":");
    if (!targetId || !linkRelationship.trim()) return;
    setLinkBusy(true);
    const result = targetKind === "project"
      ? await saveProjectContactLink(targetId, {
        contactId: contact.id,
        relationshipRole: linkRelationship,
        notes: linkNotes,
        isPrimary: false,
      })
      : await saveJobContactLink(targetId, {
        contactId: contact.id,
        relationshipRole: linkRelationship,
        notes: linkNotes,
        isPrimary: false,
      });
    setLinkBusy(false);
    if (result.error) {
      setMessage(result.error);
      return;
    }
    const [links, activity] = await Promise.all([
      fetchContactWorkLinks(contact.id),
      fetchContactActivity(contact.id),
    ]);
    setLinksByContact((current) => ({ ...current, [contact.id]: links }));
    setActivityByContact((current) => ({ ...current, [contact.id]: activity }));
    setLinkTarget("");
    setLinkRelationship("");
    setLinkNotes("");
    setMessage("Work relationship saved to this contact.");
  }

  async function removeWorkLink(contact: ContactRecord, link: ContactWorkLink) {
    const removed = link.targetKind === "project"
      ? await deleteProjectContactLink(link.targetId, link.id)
      : await deleteJobContactLink(link.targetId, link.id);
    if (!removed) {
      setMessage("RIVT could not remove that work relationship.");
      return;
    }
    setLinksByContact((current) => ({
      ...current,
      [contact.id]: (current[contact.id] ?? []).filter(({ id }) => id !== link.id),
    }));
    setMessage("Work relationship removed. The contact was not deleted.");
  }

  async function copyRivtInvite(contact: ContactRecord) {
    setInviteBusyId(contact.id);
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
      const name = contact.name || contact.company || "there";
      const pilotNote = body.data.pilotInviteStillRequired
        ? "\nYou’ll still need your Jacksonville pilot code."
        : "";
      await navigator.clipboard.writeText(
        `Hey ${name}, join me on RIVT for skilled-trade work and crew coordination:\n${body.data.url}${pilotNote}`,
      );
      setMessage(`Tracked RIVT invite for ${name} copied. The link expires in 30 days.`);
    } catch {
      setMessage("RIVT could not create or copy that invite.");
    } finally {
      setInviteBusyId(null);
    }
  }

  function exportDirectory() {
    const blob = new Blob([contactsCsv(contacts)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `rivt-contacts-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    setMessage("Contact export downloaded.");
  }

  async function importDirectory(file: File) {
    setImportBusy(true);
    setMessage("Checking contact file…");
    const parsed = parseContactsCsv(await file.text());
    let created = 0;
    let duplicates = 0;
    let failed = parsed.skipped;
    for (const contact of parsed.contacts) {
      const result = await createContact(contact);
      if (result.contact) created += 1;
      else if (result.duplicateCandidates.length) duplicates += 1;
      else failed += 1;
    }
    const refreshed = await fetchContacts({ role, status: showArchived ? "all" : "active" });
    if (refreshed) setContacts(refreshed);
    setImportBusy(false);
    if (importInputRef.current) importInputRef.current.value = "";
    setMessage(
      `Imported ${created} contact${created === 1 ? "" : "s"}.`
      + (duplicates ? ` Skipped ${duplicates} existing match${duplicates === 1 ? "" : "es"}.` : "")
      + (failed ? ` ${failed} row${failed === 1 ? "" : "s"} need correction.` : ""),
    );
  }

  const directoryTitle = role ? `${contactRoleLabels[role]} contacts` : "All contacts";
  const directoryDescription = role === "crew"
    ? "Employees and regular crew you coordinate."
    : role === "subcontractor"
      ? "Independent trades and companies you hire."
      : role === "customer"
        ? "People and companies you estimate, invoice, and work for."
        : role === "supplier"
          ? "Suppliers, branches, and representatives you buy from."
          : "People and companies, organized by relationship.";

  return (
    <section className="v2-contact-directory" aria-label={directoryTitle}>
      <header className="v2-contact-directory-header">
        <div>
          <strong>{directoryTitle} ({visible.length})</strong>
          <small>{directoryDescription}</small>
        </div>
        <div className="v2-contact-header-actions">
          {!isDemo ? (
            <label className="v2-contact-import-action">
              <input
                ref={importInputRef}
                type="file"
                accept=".csv,text/csv"
                disabled={importBusy}
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  if (file) void importDirectory(file);
                }}
              />
              <Plus size={16} /> {importBusy ? "Importing…" : "Import CSV"}
            </label>
          ) : null}
          {!isDemo && contacts.length ? (
            <button type="button" onClick={exportDirectory}>
              <Download size={16} /> Export
            </button>
          ) : null}
          {!isDemo ? (
            <button type="button" onClick={() => setEditing("new")}>
              <Plus size={16} /> Add contact
            </button>
          ) : null}
        </div>
      </header>
      <p className="v2-client-sync-note" role="status">{message}</p>

      {editing === "new" ? (
        <ContactEditor
          contact={null}
          initialRole={role}
          onSaved={replace}
          onCancel={() => setEditing(null)}
        />
      ) : null}

      <div className="v2-contact-directory-toolbar">
        <label>
          <Search size={17} aria-hidden="true" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search names, companies, trades, or tags" />
        </label>
        <button
          type="button"
          className={showArchived ? "is-active" : ""}
          aria-pressed={showArchived}
          onClick={() => setShowArchived((current) => !current)}
        >
          <Archive size={16} /> Archived
        </button>
      </div>

      {loading ? (
        <div className="v2-contact-skeletons" aria-label="Loading contacts">
          <span /><span /><span />
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={role === "supplier" ? <PackageOpen size={22} /> : <Users size={22} />}
          title={query.trim() ? "No contacts match that search" : role === "supplier" ? "No suppliers yet" : "No contacts yet"}
          description={query.trim() ? "Try another name, company, trade, or tag." : role === "supplier" ? "Save suppliers, branches, and sales representatives here." : "Add a crew member, sub, customer, supplier, or another trade relationship."}
          action={!isDemo && !query.trim()
            ? <button type="button" onClick={() => setEditing("new")}>Add contact</button>
            : undefined}
          compact
        />
      ) : (
        <div className="v2-contact-list">
          {visible.map((contact) => {
            const email = contactMethodValue(contact, "email");
            const phone = contactMethodValue(contact, "phone");
            const website = contactMethodValue(contact, "website");
            const roleLabels = contactRoleSummary(contact);
            const supplierDetails = contactRoleDetails(contact, "supplier");
            const canInvite = contact.roles.some(({ role: candidate }) => candidate === "crew" || candidate === "subcontractor");
            const isExpanded = expandedId === contact.id;
            const activity = activityByContact[contact.id];
            const workLinks = linksByContact[contact.id];
            return (
              <article key={contact.id} className="v2-contact-card">
                <div className="v2-contact-card-main">
                  <Avatar name={contact.company || contact.name} size="md" className="v2-network-avatar" />
                  <div>
                    <strong>{contact.company || contact.name}</strong>
                    {contact.company && contact.name ? <small>{contact.name}</small> : null}
                    <div className="v2-contact-role-row">
                      {roleLabels.map((label) => <span key={label}>{label}</span>)}
                    </div>
                  </div>
                  {contact.favorite ? <Star size={17} fill="currentColor" aria-label="Favorite contact" /> : null}
                </div>
                <div className="v2-contact-card-links">
                  {phone ? <a href={`tel:${phone}`}><Phone size={15} /> {phone}</a> : null}
                  {email ? <a href={`mailto:${email}`}><Mail size={15} /> {email}</a> : null}
                  {website ? <a href={website} target="_blank" rel="noreferrer"><Globe2 size={15} /> Website</a> : null}
                </div>
                {contact.roles.some(({ role: candidate }) => candidate === "supplier") ? (
                  <div className="v2-contact-supplier-meta">
                    {stringDetail(supplierDetails, "representative") ? <span>Rep: {stringDetail(supplierDetails, "representative")}</span> : null}
                    {stringDetail(supplierDetails, "accountNumber") ? <span>Account: {stringDetail(supplierDetails, "accountNumber")}</span> : null}
                    {stringDetail(supplierDetails, "paymentTerms") ? <span>{stringDetail(supplierDetails, "paymentTerms")}</span> : null}
                  </div>
                ) : null}
                {contact.tags.length ? <p className="v2-contact-tags">{contact.tags.join(" · ")}</p> : null}
                {contact.notes ? <p className="v2-contact-notes">{contact.notes}</p> : null}
                {isExpanded ? (
                  <section className="v2-contact-detail" aria-label={`${contact.name} details`}>
                    <div className="v2-contact-detail-grid">
                      <section aria-label="Recent activity">
                        <header><strong>Recent activity</strong><small>Documents and linked work</small></header>
                        {activity === undefined ? (
                          <p>Loading activity…</p>
                        ) : activity === null ? (
                          <p>Activity could not be loaded.</p>
                        ) : activity.length ? (
                          <ol className="v2-contact-activity-list">
                            {activity.slice(0, 10).map((item) => (
                              <li key={`${item.kind}:${item.id}`}>
                                <span>
                                  <strong>{item.title}</strong>
                                  <small>{item.kind === "document" ? item.recordType ?? "Document" : item.kind} · {item.status}</small>
                                </span>
                                {item.amountCents !== null ? (
                                  <strong>{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(item.amountCents / 100)}</strong>
                                ) : null}
                              </li>
                            ))}
                          </ol>
                        ) : <p>No linked documents or work yet.</p>}
                      </section>

                      {!isDemo ? (
                        <section aria-label="Linked work">
                          <header><strong>Linked work</strong><small>Private relationship context</small></header>
                          {workLinks === undefined ? (
                            <p>Loading work relationships…</p>
                          ) : workLinks === null ? (
                            <p>Work relationships could not be loaded.</p>
                          ) : workLinks.length ? (
                            <ul className="v2-contact-work-links">
                              {workLinks.map((link) => (
                                <li key={link.id}>
                                  <span>
                                    <strong>{link.targetTitle}</strong>
                                    <small>{link.relationshipRole}{link.notes ? ` · ${link.notes}` : ""}</small>
                                  </span>
                                  <button type="button" onClick={() => void removeWorkLink(contact, link)}>Remove</button>
                                </li>
                              ))}
                            </ul>
                          ) : <p>Not linked to a job or private project yet.</p>}

                          <div className="v2-contact-link-form">
                            <label>
                              <span>Job or private project</span>
                              <select value={linkTarget} onChange={(event) => setLinkTarget(event.target.value)}>
                                <option value="">Choose work</option>
                                {workOptions.length ? (
                                  <optgroup label="Jobs">
                                    {workOptions.map((job) => (
                                      <option key={job.id} value={`job:${job.id}`}>{job.title}</option>
                                    ))}
                                  </optgroup>
                                ) : null}
                                {standaloneProjects.length ? (
                                  <optgroup label="Private projects">
                                    {standaloneProjects.map((project) => (
                                      <option key={project.id} value={`project:${project.id}`}>{project.title}</option>
                                    ))}
                                  </optgroup>
                                ) : null}
                              </select>
                            </label>
                            <label>
                              <span>Relationship</span>
                              <input
                                value={linkRelationship}
                                onChange={(event) => setLinkRelationship(event.target.value)}
                                placeholder="Customer, supplier, foreman…"
                              />
                            </label>
                            <label className="is-wide">
                              <span>Private work note</span>
                              <input
                                value={linkNotes}
                                onChange={(event) => setLinkNotes(event.target.value)}
                                placeholder="What matters for this job"
                              />
                            </label>
                            <button
                              type="button"
                              disabled={linkBusy || !linkTarget || !linkRelationship.trim()}
                              onClick={() => void saveWorkLink(contact)}
                            >
                              {linkBusy ? "Linking…" : "Link to work"}
                            </button>
                          </div>
                          {workOptionsLoading ? <p>Loading jobs…</p> : null}
                          {workOptionsError ? <p>{workOptionsError}</p> : null}
                        </section>
                      ) : null}
                    </div>
                  </section>
                ) : null}
                {editing === contact ? (
                  <ContactEditor contact={contact} onSaved={replace} onCancel={() => setEditing(null)} />
                ) : (
                  <footer>
                    <button type="button" onClick={() => toggleExpanded(contact)} aria-expanded={isExpanded}>
                      <FolderKanban size={15} />
                      {isExpanded ? "Close details" : "Details & work"}
                    </button>
                    {!isDemo && canInvite ? (
                      <button
                        type="button"
                        disabled={inviteBusyId === contact.id}
                        onClick={() => void copyRivtInvite(contact)}
                      >
                        <Copy size={15} />
                        {inviteBusyId === contact.id ? "Creating invite…" : "Copy RIVT invite"}
                      </button>
                    ) : null}
                    <button type="button" onClick={() => void toggleFavorite(contact)}>
                      <Star size={15} fill={contact.favorite ? "currentColor" : "none"} />
                      {contact.favorite ? "Unfavorite" : "Favorite"}
                    </button>
                    <button type="button" onClick={() => setEditing(contact)}>Edit</button>
                    <button type="button" onClick={() => void toggleArchive(contact)}>
                      {contact.status === "archived" ? "Restore" : "Archive"}
                    </button>
                  </footer>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

type NetworkTab = "All" | "Crew" | "Subs" | "Reviews" | "Customers" | "Suppliers";

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
    view === "Reviews" ? "Reviews" : "All"
  );

  const visibleTab: NetworkTab = view === "Reviews"
    ? "Reviews"
    : activeTab === "Reviews" ? "All" : activeTab;


  // Tab bar shared across all views
  const tabBar = (
    <div className="v2-network-tab-bar" aria-label="Relationship views">
      {(["All", "Crew", "Subs", "Customers", "Suppliers"] as NetworkTab[]).map((tab) => (
        <button
          key={tab}
          type="button"
          className={`v2-network-tab-btn${visibleTab === tab ? " active" : ""}`}
          onClick={() => {
            setActiveTab(tab);
            onOpenPeople();
          }}
        >
          {tab}
        </button>
      ))}
      <span className="v2-network-tab-separator" aria-hidden="true" />
      <button
        type="button"
        className={`v2-network-tab-btn is-reputation${visibleTab === "Reviews" ? " active" : ""}`}
        onClick={() => {
          setActiveTab("Reviews");
          onOpenReviews();
        }}
      >
        Reviews
      </button>
    </div>
  );

  const pageHeader = (
    <>
      <PageHeader className="v2-network-header" title="Contacts" />
      <nav className="v2-people-work-switcher" aria-label="Work views">
        <button type="button" onClick={onOpenWork}>Jobs</button>
        <button type="button" className="is-active" aria-current="page">Contacts</button>
      </nav>
    </>
  );

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

  const roleByTab: Partial<Record<NetworkTab, ContactRole>> = {
    Crew: "crew",
    Subs: "subcontractor",
    Customers: "customer",
    Suppliers: "supplier",
  };
  const selectedRole = roleByTab[visibleTab];

  return (
    <section className="v2-network-page" aria-label={visibleTab === "All" ? "All contacts" : `${visibleTab} contacts`}>
      {pageHeader}
      {tabBar}
      {profileFocus ? <ProfileSearchSpotlight profile={profileFocus} onDismiss={onClearProfileFocus} /> : null}
      <div className="v2-contact-workbench">
        <ContactDirectoryView
          role={selectedRole}
          isDemo={isDemo}
          workOptions={workOptions}
          workOptionsLoading={workOptionsLoading}
          workOptionsError={workOptionsError}
        />
      </div>
    </section>
  );
}

