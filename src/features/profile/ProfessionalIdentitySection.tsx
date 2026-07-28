import {
  Archive,
  BadgeCheck,
  CalendarDays,
  Camera,
  Eye,
  EyeOff,
  FileCheck2,
  History,
  ImagePlus,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
  UserRound,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Avatar } from "../../components/ui";
import type { Trade } from "../../types";
import { tradeCodeByName } from "../work/work-mappings";
import {
  archiveAvailabilityWindow,
  archiveCredential,
  archivePortfolioItem,
  createAvailabilityWindow,
  createCredential,
  createPortfolioItem,
  fetchOwnProfessionalProfile,
  removeCredentialEvidence,
  removeProfileAvatar,
  restoreAvailabilityWindow,
  restoreCredential,
  restorePortfolioItem,
  updateAvailabilityWindow,
  updateCredential,
  updatePortfolioItem,
  uploadCredentialEvidence,
  uploadProfileAvatar,
  type AvailabilityValue,
  type AvailabilityWindowInput,
  type CredentialInput,
  type CredentialKind,
  type OwnProfessionalProfile,
  type PortfolioInput,
  type ProfileAvailabilityWindow,
  type ProfileCredential,
  type ProfilePortfolioItem,
  type ProfileVisibility,
} from "./professional-profile-api";
import "./professional-identity.css";

const localCredentialKey = "rivt.certs.v1";

interface LocalCredential {
  id?: string;
  name?: string;
  number?: string;
  issuer?: string;
  issueDate?: string;
  expiryDate?: string;
  notes?: string;
}

const emptyCredential: CredentialInput = {
  kind: "certification",
  name: "",
  issuer: "",
  credentialNumber: "",
  issueDate: null,
  expiryDate: null,
  notes: "",
  visibility: "private",
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

const emptyAvailability: AvailabilityWindowInput = {
  availability: "available",
  startsOn: today(),
  endsOn: today(),
  notes: "",
  visibility: "network",
};

const emptyPortfolio: PortfolioInput = {
  title: "",
  description: "",
  tradeCode: null,
  projectLabel: "",
  serviceAreaCity: "",
  serviceAreaRegion: "",
  completedOn: null,
  visibility: "private",
  sortOrder: 0,
};

function readLocalCredentials(): LocalCredential[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(localCredentialKey) ?? "[]") as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is LocalCredential => Boolean(item && typeof item === "object")) : [];
  } catch {
    return [];
  }
}

function visibilityLabel(value: ProfileVisibility) {
  return value === "network" ? "Shown on your RIVT profile" : "Private to you";
}

function availabilityLabel(value: AvailabilityValue) {
  if (value === "available") return "Available";
  if (value === "limited") return "Limited";
  return "Unavailable";
}

function credentialInput(record: ProfileCredential): CredentialInput {
  return {
    kind: record.kind,
    name: record.name,
    issuer: record.issuer,
    credentialNumber: record.credentialNumber,
    issueDate: record.issueDate,
    expiryDate: record.expiryDate,
    notes: record.notes,
    visibility: record.visibility,
  };
}

function availabilityInput(record: ProfileAvailabilityWindow): AvailabilityWindowInput {
  return {
    availability: record.availability,
    startsOn: record.startsOn,
    endsOn: record.endsOn,
    notes: record.notes,
    visibility: record.visibility,
  };
}

function portfolioInput(record: ProfilePortfolioItem): PortfolioInput {
  return {
    title: record.title,
    description: record.description,
    tradeCode: record.tradeCode,
    projectLabel: record.projectLabel,
    serviceAreaCity: record.serviceAreaCity,
    serviceAreaRegion: record.serviceAreaRegion,
    completedOn: record.completedOn,
    visibility: record.visibility,
    sortOrder: record.sortOrder,
  };
}

function ProfileVisibilityControl({
  value,
  onChange,
  disabled,
}: {
  value: ProfileVisibility;
  onChange: (value: ProfileVisibility) => void;
  disabled?: boolean;
}) {
  return (
    <label>
      Who can see this?
      <select value={value} disabled={disabled} onChange={(event) => onChange(event.target.value as ProfileVisibility)}>
        <option value="private">Only me</option>
        <option value="network">RIVT members</option>
      </select>
    </label>
  );
}

export function ProfessionalIdentitySection({
  displayName,
  specialties,
}: {
  displayName: string;
  specialties: Trade[];
}) {
  const [profile, setProfile] = useState<OwnProfessionalProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [credential, setCredential] = useState<CredentialInput>(emptyCredential);
  const [credentialEditing, setCredentialEditing] = useState<ProfileCredential | null>(null);
  const [credentialFormOpen, setCredentialFormOpen] = useState(false);
  const [availability, setAvailability] = useState<AvailabilityWindowInput>(emptyAvailability);
  const [availabilityEditing, setAvailabilityEditing] = useState<ProfileAvailabilityWindow | null>(null);
  const [availabilityFormOpen, setAvailabilityFormOpen] = useState(false);
  const [portfolio, setPortfolio] = useState<PortfolioInput>(emptyPortfolio);
  const [portfolioEditing, setPortfolioEditing] = useState<ProfilePortfolioItem | null>(null);
  const [portfolioFormOpen, setPortfolioFormOpen] = useState(false);
  const [portfolioFile, setPortfolioFile] = useState<File | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [localCredentials, setLocalCredentials] = useState<LocalCredential[]>(readLocalCredentials);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setProfile(await fetchOwnProfessionalProfile());
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Professional identity could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Loading is completed asynchronously; the initial state already represents the pending request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const activeCredentials = useMemo(
    () => profile?.credentials.filter((item) => item.status === "active") ?? [],
    [profile],
  );
  const activeWindows = useMemo(
    () => profile?.availabilityWindows.filter((item) => item.status === "active") ?? [],
    [profile],
  );
  const activePortfolio = useMemo(
    () => profile?.portfolioItems.filter((item) => item.status === "active") ?? [],
    [profile],
  );

  async function perform(key: string, action: () => Promise<void>, success: string) {
    if (busy) return;
    setBusy(key);
    setNotice("");
    setError("");
    try {
      await action();
      await load();
      setNotice(success);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "That change could not be saved.");
    } finally {
      setBusy("");
    }
  }

  async function saveCredential() {
    if (!credential.name.trim()) return;
    await perform(
      "credential-save",
      () => credentialEditing ? updateCredential(credentialEditing, credential) : createCredential(credential),
      credentialEditing ? "Credential updated." : "Credential saved privately.",
    );
    setCredential(emptyCredential);
    setCredentialEditing(null);
    setCredentialFormOpen(false);
  }

  async function migrateLocalCredentials() {
    if (!localCredentials.length || busy) return;
    setBusy("credential-migrate");
    setNotice("");
    setError("");
    const remaining = [...localCredentials];
    let migrated = 0;
    try {
      for (const local of localCredentials) {
        if (!local.name?.trim()) {
          remaining.splice(remaining.indexOf(local), 1);
          continue;
        }
        await createCredential({
          kind: "certification",
          name: local.name.trim(),
          issuer: local.issuer?.trim() ?? "",
          credentialNumber: local.number?.trim() ?? "",
          issueDate: local.issueDate || null,
          expiryDate: local.expiryDate || null,
          notes: local.notes?.trim() ?? "",
          visibility: "private",
        });
        remaining.splice(remaining.indexOf(local), 1);
        localStorage.setItem(localCredentialKey, JSON.stringify(remaining));
        migrated += 1;
      }
      setLocalCredentials(remaining);
      await load();
      setNotice(`${migrated} device credential${migrated === 1 ? "" : "s"} moved to your RIVT account. They remain private.`);
    } catch (nextError) {
      setLocalCredentials(remaining);
      setError(nextError instanceof Error ? nextError.message : "Some device credentials could not be moved.");
    } finally {
      setBusy("");
    }
  }

  async function saveAvailability() {
    await perform(
      "availability-save",
      () => availabilityEditing
        ? updateAvailabilityWindow(availabilityEditing, availability)
        : createAvailabilityWindow(availability),
      availabilityEditing ? "Availability window updated." : "Availability window saved.",
    );
    setAvailability(emptyAvailability);
    setAvailabilityEditing(null);
    setAvailabilityFormOpen(false);
  }

  async function savePortfolio() {
    if (!portfolio.title.trim()) return;
    if (!portfolioEditing && !portfolioFile) {
      setError("Choose a work photo before saving this portfolio item.");
      return;
    }
    await perform(
      "portfolio-save",
      () => portfolioEditing
        ? updatePortfolioItem(portfolioEditing, portfolio)
        : createPortfolioItem(portfolio, portfolioFile as File),
      portfolioEditing ? "Portfolio item updated." : "Work sample uploaded privately.",
    );
    setPortfolio(emptyPortfolio);
    setPortfolioEditing(null);
    setPortfolioFile(null);
    setPortfolioFormOpen(false);
  }

  if (loading && !profile) {
    return (
      <section className="v2-professional-identity" aria-busy="true">
        <div className="v2-professional-loading"><span /><span /><span /></div>
      </section>
    );
  }

  if (!profile) {
    return (
      <section className="v2-professional-identity">
        <p className="v2-professional-error" role="alert">{error || "Professional identity could not be loaded."}</p>
        <button type="button" className="v2-secondary-button" onClick={() => void load()}>Try again</button>
      </section>
    );
  }

  return (
    <section className="v2-professional-identity" aria-label="Professional identity">
      <header className="v2-professional-heading">
        <div>
          <span>Professional identity</span>
          <h2>Your reusable RIVT profile</h2>
          <p>Manage one source of truth for your photo, credentials, availability, and work samples.</p>
        </div>
        <span className="v2-professional-privacy"><EyeOff size={15} /> New proof starts private</span>
      </header>

      {notice ? <p className="v2-professional-notice" role="status">{notice}</p> : null}
      {error ? <p className="v2-professional-error" role="alert">{error}</p> : null}

      <div className="v2-professional-avatar-row">
        <Avatar name={displayName || "RIVT member"} src={profile.avatarUrl} size="lg" />
        <div>
          <strong>Profile photo</strong>
          <small>Used wherever your RIVT professional profile appears.</small>
        </div>
        <label className="v2-secondary-button v2-professional-file-action">
          <Upload size={15} />
          {profile.avatarUrl ? "Replace" : "Upload"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={Boolean(busy)}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void perform("avatar", () => uploadProfileAvatar(file), "Profile photo updated.");
              event.target.value = "";
            }}
          />
        </label>
        {profile.avatarUrl ? (
          <button type="button" className="v2-icon-button" aria-label="Remove profile photo" disabled={Boolean(busy)} onClick={() => void perform("avatar-remove", removeProfileAvatar, "Profile photo removed.")}>
            <Trash2 size={16} />
          </button>
        ) : null}
      </div>

      {localCredentials.length ? (
        <div className="v2-professional-migration">
          <div><RotateCcw size={18} /><span><strong>Move your saved device credentials</strong><small>{localCredentials.length} older credential{localCredentials.length === 1 ? "" : "s"} can be moved to your RIVT account.</small></span></div>
          <button type="button" className="v2-primary-button" disabled={Boolean(busy)} onClick={() => void migrateLocalCredentials()}>
            {busy === "credential-migrate" ? "Moving…" : "Move credentials"}
          </button>
        </div>
      ) : null}

      <div className="v2-professional-section">
        <div className="v2-professional-section-title">
          <div><BadgeCheck size={19} /><span><h3>Credentials</h3><p>Licenses, certifications, training, and insurance.</p></span></div>
          <div className="v2-professional-section-actions">
            <strong>{activeCredentials.length}</strong>
            <button type="button" className="v2-secondary-button" onClick={() => { setCredential(emptyCredential); setCredentialEditing(null); setCredentialFormOpen((open) => !open); }}><Plus size={14} />{credentialFormOpen && !credentialEditing ? "Close" : "Add"}</button>
          </div>
        </div>
        {credentialFormOpen ? <>
          <div className="v2-professional-form-grid">
          <label>Type<select value={credential.kind} onChange={(event) => setCredential((value) => ({ ...value, kind: event.target.value as CredentialKind }))}><option value="license">License</option><option value="certification">Certification</option><option value="training">Training</option><option value="insurance">Insurance</option><option value="other">Other</option></select></label>
          <label className="is-wide">Name<input value={credential.name} maxLength={160} onChange={(event) => setCredential((value) => ({ ...value, name: event.target.value }))} placeholder="Florida electrical contractor license" /></label>
          <label>Issuer<input value={credential.issuer} onChange={(event) => setCredential((value) => ({ ...value, issuer: event.target.value }))} /></label>
          <label>Credential number<input value={credential.credentialNumber} onChange={(event) => setCredential((value) => ({ ...value, credentialNumber: event.target.value }))} /></label>
          <label>Issued<input type="date" value={credential.issueDate ?? ""} onChange={(event) => setCredential((value) => ({ ...value, issueDate: event.target.value || null }))} /></label>
          <label>Expires<input type="date" value={credential.expiryDate ?? ""} onChange={(event) => setCredential((value) => ({ ...value, expiryDate: event.target.value || null }))} /></label>
          <label className="is-wide">Notes<textarea rows={2} value={credential.notes} onChange={(event) => setCredential((value) => ({ ...value, notes: event.target.value }))} /></label>
          <ProfileVisibilityControl value={credential.visibility} onChange={(visibility) => setCredential((value) => ({ ...value, visibility }))} />
          </div>
          <div className="v2-professional-form-actions">
          {credentialEditing ? <button type="button" className="v2-secondary-button" onClick={() => { setCredential(emptyCredential); setCredentialEditing(null); setCredentialFormOpen(false); }}>Cancel edit</button> : null}
          <button type="button" className="v2-primary-button" disabled={Boolean(busy) || !credential.name.trim()} onClick={() => void saveCredential()}><Plus size={15} />{credentialEditing ? "Save changes" : "Add credential"}</button>
          </div>
        </> : null}
        <div className="v2-professional-record-list">
          {profile.credentials.filter((item) => showArchived || item.status === "active").map((item) => (
            <article key={item.id} className={item.status === "archived" ? "is-archived" : ""}>
              <div className="v2-professional-record-main">
                <div><strong>{item.name}</strong><small>{[item.issuer, item.credentialNumber].filter(Boolean).join(" · ") || "Self-reported credential"}</small></div>
                <span className={`v2-professional-visibility is-${item.visibility}`}>{item.visibility === "network" ? <Eye size={13} /> : <EyeOff size={13} />}{visibilityLabel(item.visibility)}</span>
              </div>
              <div className="v2-professional-record-meta">
                {item.expiryDate ? <span><CalendarDays size={13} /> Expires {item.expiryDate}</span> : null}
                <span><FileCheck2 size={13} />{item.evidenceState === "evidence_on_file" ? "Evidence on file — not verified by RIVT" : "Self reported"}</span>
              </div>
              {item.notes ? <p>{item.notes}</p> : null}
              <div className="v2-professional-record-actions">
                {item.status === "active" ? (
                  <>
                    <button type="button" className="v2-secondary-button" onClick={() => { setCredentialEditing(item); setCredential(credentialInput(item)); setCredentialFormOpen(true); }}><Pencil size={14} />Edit</button>
                    <label className="v2-secondary-button v2-professional-file-action"><Upload size={14} />{item.evidenceUploadId ? "Replace evidence" : "Add evidence"}<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" disabled={Boolean(busy)} onChange={(event) => { const file = event.target.files?.[0]; if (file) void perform(`evidence-${item.id}`, () => uploadCredentialEvidence(item, file), "Credential evidence stored. RIVT has not verified it."); event.target.value = ""; }} /></label>
                    {item.evidenceUploadId ? <button type="button" className="v2-secondary-button" onClick={() => void perform(`evidence-remove-${item.id}`, () => removeCredentialEvidence(item), "Credential evidence removed.")}><Trash2 size={14} />Remove evidence</button> : null}
                    <button type="button" className="v2-icon-button" aria-label={`Archive ${item.name}`} onClick={() => void perform(`credential-archive-${item.id}`, () => archiveCredential(item), "Credential archived.")}><Archive size={15} /></button>
                  </>
                ) : (
                  <button type="button" className="v2-secondary-button" onClick={() => void perform(`credential-restore-${item.id}`, () => restoreCredential(item), "Credential restored.")}><RotateCcw size={14} />Restore</button>
                )}
              </div>
            </article>
          ))}
          {!activeCredentials.length ? <p className="v2-professional-empty">No account-backed credentials yet.</p> : null}
        </div>
      </div>

      <div className="v2-professional-section">
        <div className="v2-professional-section-title">
          <div><CalendarDays size={19} /><span><h3>Availability</h3><p>Share useful date windows instead of a vague status.</p></span></div>
          <div className="v2-professional-section-actions">
            <strong>{activeWindows.length}</strong>
            <button type="button" className="v2-secondary-button" onClick={() => { setAvailability(emptyAvailability); setAvailabilityEditing(null); setAvailabilityFormOpen((open) => !open); }}><Plus size={14} />{availabilityFormOpen && !availabilityEditing ? "Close" : "Add"}</button>
          </div>
        </div>
        {availabilityFormOpen ? <>
          <div className="v2-professional-form-grid">
          <label>Status<select value={availability.availability} onChange={(event) => setAvailability((value) => ({ ...value, availability: event.target.value as AvailabilityValue }))}><option value="available">Available</option><option value="limited">Limited</option><option value="unavailable">Unavailable</option></select></label>
          <label>Starts<input type="date" value={availability.startsOn} onChange={(event) => setAvailability((value) => ({ ...value, startsOn: event.target.value }))} /></label>
          <label>Ends<input type="date" value={availability.endsOn} onChange={(event) => setAvailability((value) => ({ ...value, endsOn: event.target.value }))} /></label>
          <ProfileVisibilityControl value={availability.visibility} onChange={(visibility) => setAvailability((value) => ({ ...value, visibility }))} />
          <label className="is-wide">Note<input value={availability.notes} onChange={(event) => setAvailability((value) => ({ ...value, notes: event.target.value }))} placeholder="Service calls after 3 PM; full days Friday" /></label>
          </div>
          <div className="v2-professional-form-actions">
          {availabilityEditing ? <button type="button" className="v2-secondary-button" onClick={() => { setAvailability(emptyAvailability); setAvailabilityEditing(null); setAvailabilityFormOpen(false); }}>Cancel edit</button> : null}
          <button type="button" className="v2-primary-button" disabled={Boolean(busy) || !availability.startsOn || !availability.endsOn} onClick={() => void saveAvailability()}><Plus size={15} />{availabilityEditing ? "Save changes" : "Add window"}</button>
          </div>
        </> : null}
        <div className="v2-professional-record-list is-compact">
          {profile.availabilityWindows.filter((item) => showArchived || item.status === "active").map((item) => (
            <article key={item.id} className={item.status === "archived" ? "is-archived" : ""}>
              <div className="v2-professional-record-main"><div><strong>{availabilityLabel(item.availability)}</strong><small>{item.startsOn} through {item.endsOn}</small></div><span className={`v2-professional-visibility is-${item.visibility}`}>{visibilityLabel(item.visibility)}</span></div>
              {item.notes ? <p>{item.notes}</p> : null}
              <div className="v2-professional-record-actions">
                {item.status === "active" ? <><button type="button" className="v2-secondary-button" onClick={() => { setAvailabilityEditing(item); setAvailability(availabilityInput(item)); setAvailabilityFormOpen(true); }}><Pencil size={14} />Edit</button><button type="button" className="v2-icon-button" aria-label="Archive availability window" onClick={() => void perform(`window-archive-${item.id}`, () => archiveAvailabilityWindow(item), "Availability window archived.")}><Archive size={15} /></button></> : <button type="button" className="v2-secondary-button" onClick={() => void perform(`window-restore-${item.id}`, () => restoreAvailabilityWindow(item), "Availability window restored.")}><RotateCcw size={14} />Restore</button>}
              </div>
            </article>
          ))}
          {!activeWindows.length ? <p className="v2-professional-empty">No dated availability shared yet.</p> : null}
        </div>
      </div>

      <div className="v2-professional-section">
        <div className="v2-professional-section-title">
          <div><Camera size={19} /><span><h3>Portfolio</h3><p>Publish selected work samples one at a time.</p></span></div>
          <div className="v2-professional-section-actions">
            <strong>{activePortfolio.length}</strong>
            <button type="button" className="v2-secondary-button" onClick={() => { setPortfolio(emptyPortfolio); setPortfolioEditing(null); setPortfolioFile(null); setPortfolioFormOpen((open) => !open); }}><Plus size={14} />{portfolioFormOpen && !portfolioEditing ? "Close" : "Add"}</button>
          </div>
        </div>
        {portfolioFormOpen ? <>
          <div className="v2-professional-form-grid">
          {!portfolioEditing ? <label className="is-wide">Work photo<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setPortfolioFile(event.target.files?.[0] ?? null)} /></label> : null}
          <label className="is-wide">Title<input value={portfolio.title} onChange={(event) => setPortfolio((value) => ({ ...value, title: event.target.value }))} placeholder="200A service upgrade" /></label>
          <label>Trade<select value={portfolio.tradeCode ?? ""} onChange={(event) => setPortfolio((value) => ({ ...value, tradeCode: event.target.value || null }))}><option value="">Not specified</option>{specialties.map((trade) => <option key={trade} value={tradeCodeByName[trade]}>{trade}</option>)}</select></label>
          <label>Project or customer label<input value={portfolio.projectLabel} onChange={(event) => setPortfolio((value) => ({ ...value, projectLabel: event.target.value }))} /></label>
          <label>City<input value={portfolio.serviceAreaCity} onChange={(event) => setPortfolio((value) => ({ ...value, serviceAreaCity: event.target.value }))} /></label>
          <label>State / region<input value={portfolio.serviceAreaRegion} onChange={(event) => setPortfolio((value) => ({ ...value, serviceAreaRegion: event.target.value }))} /></label>
          <label>Completed<input type="date" value={portfolio.completedOn ?? ""} onChange={(event) => setPortfolio((value) => ({ ...value, completedOn: event.target.value || null }))} /></label>
          <ProfileVisibilityControl value={portfolio.visibility} onChange={(visibility) => setPortfolio((value) => ({ ...value, visibility }))} />
          <label className="is-wide">Description<textarea rows={3} value={portfolio.description} onChange={(event) => setPortfolio((value) => ({ ...value, description: event.target.value }))} /></label>
          </div>
          <p className="v2-professional-helper"><EyeOff size={14} /> New work samples are private until you choose “RIVT members.” Confirm you have permission to share the image.</p>
          <div className="v2-professional-form-actions">
          {portfolioEditing ? <button type="button" className="v2-secondary-button" onClick={() => { setPortfolio(emptyPortfolio); setPortfolioEditing(null); setPortfolioFormOpen(false); }}>Cancel edit</button> : null}
          <button type="button" className="v2-primary-button" disabled={Boolean(busy) || !portfolio.title.trim() || (!portfolioEditing && !portfolioFile)} onClick={() => void savePortfolio()}><ImagePlus size={15} />{portfolioEditing ? "Save changes" : "Add work sample"}</button>
          </div>
        </> : null}
        <div className="v2-professional-portfolio-grid">
          {profile.portfolioItems.filter((item) => showArchived || item.status === "active").map((item) => (
            <article key={item.id} className={item.status === "archived" ? "is-archived" : ""}>
              {item.imageUrl ? <img src={item.imageUrl} alt={item.imageAlt} width="640" height="480" loading="lazy" /> : <span className="v2-professional-image-fallback"><ImagePlus size={24} /></span>}
              <div><strong>{item.title}</strong><small>{[item.tradeName, item.projectLabel, item.completedOn].filter(Boolean).join(" · ")}</small><span className={`v2-professional-visibility is-${item.visibility}`}>{visibilityLabel(item.visibility)}</span>{item.description ? <p>{item.description}</p> : null}</div>
              <div className="v2-professional-record-actions">
                {item.status === "active" ? <><button type="button" className="v2-secondary-button" onClick={() => { setPortfolioEditing(item); setPortfolio(portfolioInput(item)); setPortfolioFormOpen(true); }}><Pencil size={14} />Edit</button><button type="button" className="v2-icon-button" aria-label={`Archive ${item.title}`} onClick={() => void perform(`portfolio-archive-${item.id}`, () => archivePortfolioItem(item), "Portfolio item archived.")}><Archive size={15} /></button></> : <button type="button" className="v2-secondary-button" onClick={() => void perform(`portfolio-restore-${item.id}`, () => restorePortfolioItem(item), "Portfolio item restored.")}><RotateCcw size={14} />Restore</button>}
              </div>
            </article>
          ))}
          {!activePortfolio.length ? <p className="v2-professional-empty">No work samples added yet.</p> : null}
        </div>
      </div>

      <div className="v2-professional-footer">
        <button type="button" className="v2-secondary-button" onClick={() => setShowArchived((value) => !value)}>{showArchived ? <EyeOff size={15} /> : <Archive size={15} />}{showArchived ? "Hide archived" : "Show archived"}</button>
        <details>
          <summary><History size={15} />Account history</summary>
          <div className="v2-professional-history">
            {profile.events.slice(0, 20).map((event) => <p key={event.id}><strong>{event.action.replaceAll("_", " ")}</strong><span>{new Date(event.createdAt).toLocaleString()}</span></p>)}
            {!profile.events.length ? <p>No professional-profile changes recorded yet.</p> : null}
          </div>
        </details>
        <span><UserRound size={14} />Your public identity only includes items you explicitly share.</span>
      </div>
    </section>
  );
}
