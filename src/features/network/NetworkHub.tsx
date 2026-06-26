import {
  AlertTriangle,
  ArrowRight,
  Briefcase,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  Mail,
  MessageSquareText,
  Phone,
  Plus,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  ThumbsUp,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";
import type { Job, Talent } from "../../types";
import { Avatar, EmptyState, MetricTile, PageHeader, Panel } from "../../components/ui";
import "./network-hub.css";

interface CommunityPost {
  id: number;
  title: string;
  trade: string;
  status: string;
  flair?: string;
}

interface ShoutOut {
  id: number;
  from: string;
  to: string;
  trade: string;
  message: string;
  createdAt: string;
}

interface NetworkHubProps {
  view: "My Crew" | "Reviews";
  jobs: Job[];
  talent: Talent[];
  communityPosts: CommunityPost[];
  shoutOuts: ShoutOut[];
  displayName: string;
  onOpenCrew: () => void;
  onOpenShopTalk: () => void;
  onOpenReviews: () => void;
  onAddShoutOut: (to: string, trade: string, message: string) => void;
}

// ── Clients ───────────────────────────────────────────────────────────────────

interface Client {
  id: string;
  name: string;
  company: string;
  phone: string;
  email: string;
  notes: string;
  createdAt: string;
}

interface StoredJobEntry {
  id: string | number;
  title?: string;
  notes?: string;
  status?: string;
  [key: string]: unknown;
}

const emptyClientForm = { name: "", company: "", phone: "", email: "", notes: "" };

function ClientBookView() {
  const load = (): Client[] => {
    try { return JSON.parse(localStorage.getItem("rivt.clients.v1") || "[]") as Client[]; } catch { return []; }
  };

  const [clients, setClients] = useState<Client[]>(load);
  const [showForm, setShowForm] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [form, setForm] = useState(emptyClientForm);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function save(list: Client[]) {
    try { localStorage.setItem("rivt.clients.v1", JSON.stringify(list)); } catch { /* noop */ }
    setClients(list);
  }

  function openAdd() {
    setEditingClient(null);
    setForm(emptyClientForm);
    setShowForm(true);
  }

  function openEdit(client: Client) {
    setEditingClient(client);
    setForm({ name: client.name, company: client.company, phone: client.phone, email: client.email, notes: client.notes });
    setShowForm(true);
  }

  function cancel() {
    setShowForm(false);
    setEditingClient(null);
    setForm(emptyClientForm);
  }

  function handleSave() {
    if (!form.name.trim()) return;
    if (editingClient) {
      save(clients.map((c) => c.id === editingClient.id ? { ...c, ...form } : c));
    } else {
      const next: Client = { id: crypto.randomUUID(), ...form, createdAt: new Date().toISOString() };
      save([next, ...clients]);
    }
    cancel();
  }

  function handleDelete(id: string) {
    if (!window.confirm("Delete this client?")) return;
    save(clients.filter((c) => c.id !== id));
    if (expandedId === id) setExpandedId(null);
  }

  function jobsForClient(clientName: string): number {
    try {
      const jobs: StoredJobEntry[] = JSON.parse(localStorage.getItem("rivt.jobs.v1") || "[]");
      const lower = clientName.toLowerCase();
      return jobs.filter((j) =>
        (typeof j.title === "string" && j.title.toLowerCase().includes(lower)) ||
        (typeof j.notes === "string" && j.notes.toLowerCase().includes(lower))
      ).length;
    } catch { return 0; }
  }

  return (
    <div className="v2-client-book">
      <div className="v2-client-header">
        <span className="v2-client-title">Clients ({clients.length})</span>
        <button type="button" className="v2-client-add-btn" onClick={openAdd}>
          <Plus size={14} /> Add
        </button>
      </div>

      {showForm && (
        <div className="v2-client-form">
          <input
            placeholder="Name *"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <input
            placeholder="Company"
            value={form.company}
            onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
          />
          <input
            placeholder="Phone"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          />
          <input
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
          <textarea
            placeholder="Notes"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
          <div className="v2-client-form-btns">
            <button type="button" className="v2-client-save-btn" disabled={!form.name.trim()} onClick={handleSave}>
              Save
            </button>
            <button type="button" className="v2-client-cancel-btn" onClick={cancel}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {!showForm && (
        <div className="v2-client-list">
          {clients.length === 0 ? (
            <div className="v2-client-empty">No clients yet — tap + to add your first</div>
          ) : (
            clients.map((client) => {
              const isExpanded = expandedId === client.id;
              const jobCount = jobsForClient(client.name);
              return (
                <div key={client.id} className="v2-client-card">
                  <div
                    className="v2-client-card-top"
                    onClick={() => setExpandedId(isExpanded ? null : client.id)}
                  >
                    <div>
                      <div className="v2-client-name">{client.name}</div>
                      {client.company && <div className="v2-client-company">{client.company}</div>}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      {client.phone && (
                        <a
                          href={`tel:${client.phone}`}
                          className="v2-client-phone-link"
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`Call ${client.name}`}
                        >
                          <Phone size={14} />
                        </a>
                      )}
                      {jobCount > 0 && (
                        <span className="v2-client-jobs-badge">{jobCount} job{jobCount !== 1 ? "s" : ""}</span>
                      )}
                      {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </div>
                  </div>

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
                      {client.notes && (
                        <div className="v2-client-detail-row" style={{ alignItems: "flex-start" }}>
                          <MessageSquareText size={13} style={{ flexShrink: 0, marginTop: 2 }} />
                          <span style={{ color: "var(--v2-text)", whiteSpace: "pre-wrap" }}>{client.notes}</span>
                        </div>
                      )}
                      <div className="v2-client-actions">
                        <button type="button" className="v2-client-edit-btn" onClick={() => openEdit(client)}>
                          Edit
                        </button>
                        <button type="button" className="v2-client-delete-btn" onClick={() => handleDelete(client.id)}>
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ── Reviews localStorage ──────────────────────────────────────────────────────

const reviewsKey = "rivt.reviews.v1";

interface StoredReview {
  id: string;
  reviewer: string;
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

function loadStoredJobs(): StoredJobEntry[] {
  try {
    const stored = localStorage.getItem("rivt.jobs.v1");
    if (!stored) return [];
    const parsed = JSON.parse(stored) as StoredJobEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
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
  onAssign,
  onUnassign,
  onClose,
}: {
  member: CrewMember;
  onAssign: (jobId: string) => void;
  onUnassign: () => void;
  onClose: () => void;
}) {
  const jobs = loadStoredJobs().filter(
    (j) => j.status === "Active" || j.status === "Quoted" || j.status === "Open" || j.status === "Scheduled"
  );

  return (
    <div className="v2-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="v2-crew-assign-modal">
        <header>
          <strong>Assign {member.name} to job</strong>
          <button type="button" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </header>
        {member.currentJobId && (
          <div className="v2-crew-assign-current">
            <span>Currently assigned to job #{member.currentJobId}</span>
            <button type="button" className="v2-crew-unassign-btn" onClick={onUnassign}>
              Unassign
            </button>
          </div>
        )}
        {jobs.length === 0 ? (
          <p className="v2-crew-assign-empty">No active or quoted jobs found in rivt.jobs.v1.</p>
        ) : (
          <div className="v2-crew-assign-list">
            {jobs.map((j) => (
              <button
                key={String(j.id)}
                type="button"
                className={`v2-crew-assign-job-btn${member.currentJobId === String(j.id) ? " is-current" : ""}`}
                onClick={() => onAssign(String(j.id))}
              >
                <Briefcase size={14} />
                <span>{typeof j.title === "string" ? j.title : `Job #${j.id}`}</span>
                <span className="v2-crew-assign-status">{String(j.status ?? "")}</span>
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
  const color = status === "available" ? "var(--v2-success)" : status === "busy" ? "var(--v2-warning, #f59e0b)" : "#94a3b8";
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
  onEdit,
  onDelete,
  onAssign,
}: {
  member: CrewMember;
  onEdit: () => void;
  onDelete: () => void;
  onAssign: () => void;
}) {
  const jobs = loadStoredJobs();
  const assignedJob = member.currentJobId
    ? jobs.find((j) => String(j.id) === member.currentJobId)
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
          <span>{typeof assignedJob.title === "string" ? assignedJob.title : `Job #${assignedJob.id}`}</span>
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

function CrewManager({ crewType }: { crewType: CrewType }) {
  const [crew, setCrew] = useState<CrewMember[]>(loadCrew);
  const [showForm, setShowForm] = useState(false);
  const [editingMember, setEditingMember] = useState<CrewMember | null>(null);
  const [assigningMember, setAssigningMember] = useState<CrewMember | null>(null);
  const [tradeFilter, setTradeFilter] = useState<string>("All");

  const members = crew.filter((m) => m.type === crewType);

  const trades = ["All", ...Array.from(new Set(members.map((m) => m.trade).filter(Boolean)))];

  const filtered = tradeFilter === "All" ? members : members.filter((m) => m.trade === tradeFilter);

  function persist(list: CrewMember[]) {
    setCrew(list);
    saveCrew(list);
  }

  function handleSave(data: Omit<CrewMember, "id" | "addedAt">) {
    if (editingMember) {
      persist(crew.map((m) => m.id === editingMember.id ? { ...m, ...data } : m));
    } else {
      const next: CrewMember = { id: crypto.randomUUID(), ...data, type: crewType, addedAt: new Date().toISOString() };
      persist([next, ...crew]);
    }
    setShowForm(false);
    setEditingMember(null);
  }

  function handleDelete(id: string) {
    if (!window.confirm("Remove this person from your crew?")) return;
    persist(crew.filter((m) => m.id !== id));
  }

  function handleAssign(memberId: string, jobId: string) {
    persist(crew.map((m) => m.id === memberId ? { ...m, currentJobId: jobId, availability: "busy" } : m));
    setAssigningMember(null);
  }

  function handleUnassign(memberId: string) {
    persist(crew.map((m) => m.id === memberId ? { ...m, currentJobId: undefined, availability: "available" } : m));
    setAssigningMember(null);
  }

  function copyInviteTemplate(member: CrewMember) {
    const text = `Hey ${member.name}, I have a ${member.trade || "trade"} job coming up. Interested?`;
    navigator.clipboard.writeText(text).catch(() => { /* noop */ });
  }

  const label = crewType === "crew" ? "Crew" : "Subs";

  return (
    <div className="v2-crew-manager">
      <div className="v2-crew-manager-header">
        <span className="v2-crew-manager-title">{label} ({members.length})</span>
        <button
          type="button"
          className="v2-client-add-btn"
          onClick={() => { setEditingMember(null); setShowForm(true); }}
        >
          <Plus size={14} /> Add {label === "Crew" ? "member" : "sub"}
        </button>
      </div>

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
          description={crewType === "crew" ? "Add your crew members to track their availability and assignments." : "Add subcontractors you rely on and invite them to jobs."}
          compact
        />
      ) : (
        <div className="v2-crew-card-list">
          {filtered.map((member) => (
            <div key={member.id} className="v2-crew-card-wrapper">
              <CrewCard
                member={member}
                onEdit={() => { setEditingMember(member); setShowForm(true); }}
                onDelete={() => handleDelete(member.id)}
                onAssign={() => setAssigningMember(member)}
              />
              {crewType === "sub" && (
                <button
                  type="button"
                  className="v2-crew-invite-copy-btn"
                  onClick={() => copyInviteTemplate(member)}
                  title="Copy invite text"
                >
                  <Copy size={13} />
                  Invite to Job
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {assigningMember && (
        <JobAssignModal
          member={assigningMember}
          onAssign={(jobId) => handleAssign(assigningMember.id, jobId)}
          onUnassign={() => handleUnassign(assigningMember.id)}
          onClose={() => setAssigningMember(null)}
        />
      )}
    </div>
  );
}

// ── Sub Roster (legacy simple version kept as separate section) ────────────────

const subRosterKey = "rivt.subRoster.v1";

interface SubRosterEntry {
  id: string;
  name: string;
  trade: string;
  rateNote: string;
  addedAt: string;
}

function readSubRoster(): SubRosterEntry[] {
  try {
    const stored = localStorage.getItem(subRosterKey);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as SubRosterEntry[];
    return Array.isArray(parsed) ? parsed.slice(0, 50) : [];
  } catch { return []; }
}

function persistSubRoster(entries: SubRosterEntry[]) {
  try { localStorage.setItem(subRosterKey, JSON.stringify(entries.slice(0, 50))); } catch { /* noop */ }
}

function SubRosterPanel() {
  const [roster, setRoster] = useState<SubRosterEntry[]>(readSubRoster);
  const [name, setName] = useState("");
  const [trade, setTrade] = useState("");
  const [rateNote, setRateNote] = useState("");
  const [notice, setNotice] = useState("");

  function addToRoster() {
    if (!name.trim()) return;
    const entry: SubRosterEntry = {
      id: crypto.randomUUID(),
      name: name.trim(),
      trade: trade.trim(),
      rateNote: rateNote.trim(),
      addedAt: new Date().toISOString(),
    };
    const next = [entry, ...roster];
    setRoster(next);
    persistSubRoster(next);
    setName("");
    setTrade("");
    setRateNote("");
    setNotice("Added to roster.");
    setTimeout(() => setNotice(""), 3000);
  }

  function removeFromRoster(id: string) {
    const next = roster.filter((e) => e.id !== id);
    setRoster(next);
    persistSubRoster(next);
  }

  return (
    <Panel
      className="v2-network-panel v2-network-panel-wide"
      eyebrow={`${roster.length} saved`}
      title="Sub roster"
    >
      <div className="v2-sub-roster">
        <div className="v2-sub-roster-form">
          <div className="v2-sub-roster-inputs">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name or company" />
            <input value={trade} onChange={(e) => setTrade(e.target.value)} placeholder="Trade (electrical, framing…)" />
            <input value={rateNote} onChange={(e) => setRateNote(e.target.value)} placeholder="Rate note ($65/hr, $800/day…)" />
          </div>
          {notice ? <p className="v2-sub-roster-notice" role="status">{notice}</p> : null}
          <button type="button" className="v2-primary-button" disabled={!name.trim()} onClick={addToRoster}><Plus size={14} />Add to roster</button>
        </div>
        {roster.length ? (
          <div className="v2-sub-roster-list">
            {roster.map((entry) => (
              <article key={entry.id} className="v2-sub-roster-item">
                <Avatar name={entry.name} size="sm" className="v2-network-avatar" />
                <div className="v2-sub-roster-item-copy">
                  <strong>{entry.name}</strong>
                  {entry.trade ? <span>{entry.trade}</span> : null}
                  {entry.rateNote ? <small>{entry.rateNote}</small> : null}
                </div>
                <button type="button" className="v2-sub-roster-remove" aria-label={`Remove ${entry.name}`} onClick={() => removeFromRoster(entry.id)}><X size={14} /></button>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            className="v2-network-empty"
            icon={<Users size={20} />}
            title="No roster entries yet"
            description="Save contractors and tradespeople you rely on for quick access when new work comes in."
            compact
          />
        )}
      </div>
    </Panel>
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

function CrewInvitePlanner() {
  const [invites, setInvites] = useState<CrewInvite[]>(readCrewInvites);
  const [jobRef, setJobRef] = useState("");
  const [name, setName] = useState("");
  const [trade, setTrade] = useState("");
  const [note, setNote] = useState("");
  const [notice, setNotice] = useState("");

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
    setInvites(next);
    persistCrewInvites(next);
    setJobRef("");
    setName("");
    setTrade("");
    setNote("");
    setNotice("Invite planned.");
    setTimeout(() => setNotice(""), 2500);
  }

  function updateStatus(id: string, status: InviteStatus) {
    const next = invites.map((i) => i.id === id ? { ...i, status } : i);
    setInvites(next);
    persistCrewInvites(next);
  }

  function removeInvite(id: string) {
    const next = invites.filter((i) => i.id !== id);
    setInvites(next);
    persistCrewInvites(next);
  }

  const pending = invites.filter((i) => i.status === "pending").length;
  const accepted = invites.filter((i) => i.status === "accepted").length;

  return (
    <Panel
      className="v2-network-panel v2-network-panel-wide"
      eyebrow={`${pending} pending · ${accepted} accepted`}
      title="Crew invite planner"
    >
      <div className="v2-crew-invite-planner">
        <div className="v2-crew-invite-form">
          <div className="v2-crew-invite-inputs">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name or company" />
            <input value={trade} onChange={(e) => setTrade(e.target.value)} placeholder="Trade (electrical, framing…)" />
            <input value={jobRef} onChange={(e) => setJobRef(e.target.value)} placeholder="Job or project name" />
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (rate, scope, start date…)" />
          </div>
          {notice ? <p className="v2-sub-roster-notice" role="status">{notice}</p> : null}
          <button type="button" className="v2-primary-button" disabled={!name.trim()} onClick={addInvite}><Plus size={14} />Plan invite</button>
        </div>
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
            description="Track who you plan to bring on to upcoming jobs. Mark accepted or declined as responses come in."
            compact
          />
        )}
      </div>
    </Panel>
  );
}

// ── Availability dots helper ──────────────────────────────────────────────────

function crewAvailDots(memberId: string | number): Array<"available" | "limited" | "unavailable"> {
  const seed = String(memberId).split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const statuses = ["available", "limited", "unavailable"] as const;
  return Array.from({ length: 7 }, (_, i) => statuses[(seed + i * 3) % 3]);
}

// ── Group Message Modal ───────────────────────────────────────────────────────

function CrewGroupMessageModal({
  members,
  selected,
  draft,
  onToggle,
  onDraftChange,
  onSend,
  onClose,
}: {
  members: Array<{ id: string; name: string }>;
  selected: Set<string>;
  draft: string;
  onToggle: (id: string) => void;
  onDraftChange: (v: string) => void;
  onSend: () => void;
  onClose: () => void;
}) {
  return (
    <div className="v2-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="v2-group-msg-modal">
        <header>
          <strong>Group message</strong>
          <button type="button" onClick={onClose}>✕</button>
        </header>
        <div className="v2-group-msg-list">
          {members.map((m) => (
            <label key={m.id} className="v2-group-msg-member">
              <input type="checkbox" checked={selected.has(m.id)} onChange={() => onToggle(m.id)} />
              {m.name}
            </label>
          ))}
        </div>
        <textarea
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          placeholder="Type your message..."
          rows={3}
          className="v2-group-msg-textarea"
        />
        <button
          type="button"
          className="v2-primary-button"
          disabled={selected.size === 0 || !draft.trim()}
          onClick={onSend}
        >
          <Send size={14} />
          Send to {selected.size} member{selected.size !== 1 ? "s" : ""}
        </button>
      </div>
    </div>
  );
}

function TopTalentCard({ person }: { person: Talent }) {
  return (
    <article className="v2-network-person-card">
      <div className="v2-network-person-header">
        <Avatar name={person.name} size="md" className="v2-network-avatar" />
        <div>
          <strong>{person.name}</strong>
          <span>{person.trade} · {person.location}</span>
        </div>
        <strong>{person.match}%</strong>
      </div>

      <p>{person.availability} · {person.responseTime}</p>

      <div className="v2-crew-avail-dots" aria-label="Estimated availability this week">
        {crewAvailDots(person.id).map((status, i) => (
          <span key={i} className={`v2-avail-dot avail-${status}`} title={["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"][i]} />
        ))}
      </div>

      <footer>
        <span>{person.rating.toFixed(1)} rating</span>
        <span>{person.reviews} reviews</span>
      </footer>
    </article>
  );
}

function AnswerPrompt({ post }: { post: CommunityPost }) {
  return (
    <button type="button" className="v2-network-prompt">
      <span className="v2-network-prompt-icon"><MessageSquareText size={16} /></span>
      <span>
        <strong>{post.title}</strong>
        <small>{post.trade} · {post.status}</small>
      </span>
      <ArrowRight size={15} />
    </button>
  );
}

function ReviewsView({
  shoutOuts,
  displayName,
  onAddShoutOut,
  onOpenCrew,
}: {
  shoutOuts: ShoutOut[];
  displayName: string;
  onAddShoutOut: (to: string, trade: string, message: string) => void;
  onOpenCrew: () => void;
}) {
  const [to, setTo] = useState("");
  const [trade, setTrade] = useState("");
  const [message, setMessage] = useState("");
  const [rating, setRating] = useState(5);
  const [submitted, setSubmitted] = useState(false);
  const [storedReviews, setStoredReviews] = useState<StoredReview[]>(readStoredReviews);

  const received = shoutOuts.filter((s) => s.to === displayName);
  const given = shoutOuts.filter((s) => s.from === displayName);

  function submit() {
    if (!to.trim() || !message.trim()) return;
    onAddShoutOut(to.trim(), trade.trim(), message.trim());
    const newReview: StoredReview = {
      id: crypto.randomUUID(),
      reviewer: to.trim(),
      reviewText: message.trim(),
      rating,
      date: new Date().toISOString(),
    };
    const next = [newReview, ...storedReviews];
    setStoredReviews(next);
    persistStoredReviews(next);
    setTo("");
    setTrade("");
    setMessage("");
    setRating(5);
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
  }

  return (
    <div className="v2-reviews-page">
      <div className="v2-reviews-grid">
        <Panel
          className="v2-reviews-panel v2-reviews-panel-wide"
          eyebrow="Write a review"
          title="Shout out someone you worked with"
        >
          <div className="v2-review-form">
            <label>
              <span>Who are you reviewing?</span>
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
                placeholder="What made them worth working with?"
              />
            </label>
            <div className="v2-review-form-actions">
              {submitted && <span className="v2-review-sent">Review posted!</span>}
              <button
                type="button"
                className="v2-primary-button"
                disabled={!to.trim() || !message.trim()}
                onClick={submit}
              >
                <Send size={15} />
                Post review
              </button>
            </div>
          </div>
        </Panel>

        <Panel
          className="v2-reviews-panel"
          eyebrow={`${storedReviews.length + received.length} received`}
          title="Reviews you've received"
        >
          {(storedReviews.length > 0 || received.length > 0) ? (
            <div className="v2-reviews-list">
              {storedReviews.map((review) => (
                <article key={review.id} className="v2-review-item">
                  <div className="v2-review-item-header">
                    <Avatar name={review.reviewer} size="sm" />
                    <div>
                      <strong>{review.reviewer}</strong>
                    </div>
                  </div>
                  <div className="v2-review-stars-display">
                    {"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}
                  </div>
                  <p>{review.reviewText}</p>
                </article>
              ))}
              {received.map((item) => (
                <article key={item.id} className="v2-review-item">
                  <div className="v2-review-item-header">
                    <Avatar name={item.from} size="sm" />
                    <div>
                      <strong>{item.from}</strong>
                      {item.trade && <span>{item.trade}</span>}
                    </div>
                  </div>
                  <p>{item.message}</p>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              className="v2-network-empty"
              icon={<Star size={20} />}
              title="No reviews yet"
              description="Complete jobs and build connections. Reviews from contractors you've worked with will appear here."
              action={<button type="button" onClick={onOpenCrew}>Find crew</button>}
              compact
            />
          )}
        </Panel>

        <Panel
          className="v2-reviews-panel"
          eyebrow={`${given.length} given`}
          title="Reviews you've written"
        >
          {given.length ? (
            <div className="v2-reviews-list">
              {given.map((item) => (
                <article key={item.id} className="v2-review-item">
                  <div className="v2-review-item-header">
                    <Avatar name={item.to} size="sm" />
                    <div>
                      <strong>{item.to}</strong>
                      {item.trade && <span>{item.trade}</span>}
                    </div>
                  </div>
                  <p>{item.message}</p>
                </article>
              ))}
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
      </div>
    </div>
  );
}

type NetworkTab = "Crew" | "Subs" | "Reviews" | "Clients";

export function NetworkHub({ view, jobs, talent, communityPosts, shoutOuts, displayName, onOpenCrew, onOpenShopTalk, onOpenReviews, onAddShoutOut }: NetworkHubProps) {
  const activeCrew = talent.slice(0, 3);
  const questionPosts = communityPosts.filter((post) => post.flair === "Question" || post.status !== "Open").slice(0, 4);
  const highlightedShoutOuts = shoutOuts.slice(0, 4);
  const openJobs = jobs.filter((job) => job.status === "Open").length;

  // Internal tab state — derive initial tab from the incoming view prop
  const [activeTab, setActiveTab] = useState<NetworkTab>(() =>
    view === "Reviews" ? "Reviews" : "Crew"
  );

  // Feature 1: Skill matrix view toggle
  const [crewView, setCrewView] = useState<"list" | "skills">("list");

  // Feature 3: Group message modal
  const [showGroupMsg, setShowGroupMsg] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [groupMsgDraft, setGroupMsgDraft] = useState("");

  function toggleMember(id: string) {
    setSelectedMembers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleGroupSend() {
    setGroupMsgDraft("");
    setSelectedMembers(new Set());
    setShowGroupMsg(false);
  }

  // Skills matrix: group crew by trade
  const crewByTrade = activeCrew.reduce<Record<string, Talent[]>>((acc, member) => {
    const key = member.trade || "Other";
    if (!acc[key]) acc[key] = [];
    acc[key].push(member);
    return acc;
  }, {});

  // Modal member list (all talent, id as string)
  const modalMembers = talent.map((t) => ({ id: String(t.id), name: t.name }));

  // Tab bar shared across all views
  const tabBar = (
    <div className="v2-network-tab-bar">
      {(["Crew", "Subs", "Reviews", "Clients"] as NetworkTab[]).map((tab) => (
        <button
          key={tab}
          type="button"
          className={`v2-network-tab-btn${activeTab === tab ? " active" : ""}`}
          onClick={() => {
            setActiveTab(tab);
            if (tab === "Reviews") onOpenReviews();
            else if (tab === "Crew") onOpenCrew();
          }}
        >
          {tab}
        </button>
      ))}
    </div>
  );

  if (activeTab === "Clients") {
    return (
      <section className="v2-network-page" aria-label="Clients">
        <PageHeader
          className="v2-network-header"
          title="Network"
          description="Crew, reviews, and your client book."
          actions={
            <div className="v2-network-header-metrics">
              <MetricTile icon={<Users size={18} />} value={activeCrew.length} label="crew members" />
              <MetricTile icon={<ThumbsUp size={18} />} value={shoutOuts.length} label="shout-outs" />
            </div>
          }
        />
        {tabBar}
        <ClientBookView />
      </section>
    );
  }

  if (activeTab === "Reviews") {
    return (
      <section className="v2-network-page" aria-label="Reviews">
        <PageHeader
          className="v2-network-header"
          title="Network"
          description="Crew, reviews, and your client book."
          actions={
            <div className="v2-network-header-metrics">
              <MetricTile icon={<Star size={18} />} value={shoutOuts.filter((s) => s.to === displayName).length} label="received" />
              <MetricTile icon={<ThumbsUp size={18} />} value={shoutOuts.filter((s) => s.from === displayName).length} label="given" />
            </div>
          }
        />
        {tabBar}
        <ReviewsView
          shoutOuts={shoutOuts}
          displayName={displayName}
          onAddShoutOut={onAddShoutOut}
          onOpenCrew={onOpenCrew}
        />
      </section>
    );
  }

  if (activeTab === "Subs") {
    return (
      <section className="v2-network-page" aria-label="Subs">
        <PageHeader
          className="v2-network-header"
          title="Network"
          description="Crew, reviews, and your client book."
          actions={
            <div className="v2-network-header-metrics">
              <MetricTile icon={<Users size={18} />} value={activeCrew.length} label="crew members" />
              <MetricTile icon={<Briefcase size={18} />} value={openJobs} label="open jobs" />
            </div>
          }
        />
        {tabBar}
        <CrewManager crewType="sub" />
      </section>
    );
  }

  // Crew tab
  return (
    <section className="v2-network-page" aria-label="Crew">
      <PageHeader
        className="v2-network-header"
        title="Network"
        description="Crew, reviews, and your client book."
        actions={
        <div className="v2-network-header-metrics">
          <MetricTile icon={<Users size={18} />} value={activeCrew.length} label="crew members" />
          <MetricTile icon={<Briefcase size={18} />} value={openJobs} label="open jobs" />
          <MetricTile icon={<ThumbsUp size={18} />} value={shoutOuts.length} label="shout-outs" />
        </div>
        }
      />
      {tabBar}

      {showGroupMsg && (
        <CrewGroupMessageModal
          members={modalMembers}
          selected={selectedMembers}
          draft={groupMsgDraft}
          onToggle={toggleMember}
          onDraftChange={setGroupMsgDraft}
          onSend={handleGroupSend}
          onClose={() => setShowGroupMsg(false)}
        />
      )}

      {/* Enhanced Crew Manager */}
      <CrewManager crewType="crew" />

      <div className="v2-network-grid">
        <Panel
          className="v2-network-panel"
          eyebrow="Top matches"
          title="People to reach out to"
          action={
            <div className="v2-network-panel-actions">
              <button type="button" className="v2-primary-button v2-group-msg-btn" onClick={() => setShowGroupMsg(true)}>
                <Users size={13} />
                Group message
              </button>
              <button type="button" onClick={onOpenCrew}>Open crew</button>
            </div>
          }
        >
          <div className="v2-crew-view-toggle">
            <button type="button" className={crewView === "list" ? "active" : ""} onClick={() => setCrewView("list")}>List</button>
            <button type="button" className={crewView === "skills" ? "active" : ""} onClick={() => setCrewView("skills")}>Skills</button>
          </div>

          {crewView === "list" ? (
            <div className="v2-network-person-list">
              {activeCrew.length ? activeCrew.map((person) => <TopTalentCard key={person.id} person={person} />) : (
                <EmptyState
                  className="v2-network-empty"
                  icon={<Users size={20} />}
                  title="Your crew starts here"
                  description="Add contractors and tradespeople you have worked with. Your crew is your reputation network."
                  action={<button type="button" onClick={onOpenCrew}>Find people</button>}
                  compact
                />
              )}
            </div>
          ) : (
            <div className="v2-skill-matrix">
              {Object.keys(crewByTrade).length ? Object.entries(crewByTrade).map(([trade, members]) => (
                <div key={trade} className="v2-skill-group">
                  <strong>{trade}</strong>
                  <div className="v2-skill-group-chips">
                    {members.map((m) => (
                      <span key={m.id} className="v2-skill-member-chip">
                        {m.name}
                        {m.reviews > 0 && <span className="v2-skill-chip-badge">{m.reviews}</span>}
                      </span>
                    ))}
                  </div>
                </div>
              )) : (
                <EmptyState
                  className="v2-network-empty"
                  icon={<Users size={20} />}
                  title="No crew members yet"
                  description="Add people to see them grouped by trade."
                  compact
                />
              )}
            </div>
          )}
        </Panel>

        <SubRosterPanel />

        <CrewInvitePlanner />

        <Panel
          className="v2-network-panel"
          eyebrow="Shout-outs"
          title="Recent reputation signals"
          action={<div className="v2-network-panel-actions"><button type="button" className="v2-primary-button" onClick={onOpenReviews}>Write shout-out</button><button type="button" onClick={onOpenReviews}>See all</button></div>}
        >
          <div className="v2-network-shoutouts">
            {highlightedShoutOuts.length ? highlightedShoutOuts.map((item) => (
              <article key={item.id}>
                <div>
                  <strong>{item.to}</strong>
                  <span>{item.trade}</span>
                </div>
                <p>{item.message}</p>
              </article>
            )) : (
              <EmptyState
                className="v2-network-empty"
                icon={<Star size={20} />}
                title="No shout-outs yet"
                description="Shout-outs from jobs and Shop Talk will appear here."
                compact
              />
            )}
          </div>
        </Panel>

        <Panel
          className="v2-network-panel v2-network-panel-wide"
          eyebrow="Questions worth answering"
          title="Shop Talk with field weight"
          action={<button type="button" onClick={onOpenShopTalk}>View all</button>}
        >
          <div className="v2-network-prompts">
            {questionPosts.length ? questionPosts.map((post) => <AnswerPrompt key={post.id} post={post} />) : (
              <EmptyState
                className="v2-network-empty"
                icon={<Sparkles size={20} />}
                title="Nothing posted in your trade yet"
                description="Be the first to ask a question or share a field-tested fix."
                action={<button type="button" onClick={onOpenShopTalk}>Post in Shop Talk</button>}
                compact
              />
            )}
          </div>
        </Panel>

        <Panel
          className="v2-network-panel"
          eyebrow="Trust signals"
          title="Who looks ready"
          action={<button type="button" onClick={onOpenReviews}>Open reviews</button>}
        >
          <div className="v2-network-trust-stack">
            <article>
              <ShieldCheck size={18} />
              <strong>Evidence states</strong>
              <span>Self-reported, uploaded, and verified markers stay distinct.</span>
            </article>
            <article>
              <Star size={18} />
              <strong>High reputation</strong>
              <span>Shout-outs and field answers build trust before the first deal.</span>
            </article>
            <article>
              <Users size={18} />
              <strong>Active crew</strong>
              <span>Jobs, invites, and referrals in one network view.</span>
            </article>
          </div>
        </Panel>
      </div>
    </section>
  );
}

