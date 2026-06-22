import { useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, MapPin, Save, Send, ShieldCheck, X } from "lucide-react";
import { tradeOptions } from "../../data";
import type { Job } from "../../types";
import {
  createJob,
  type JobEditorInput,
  toJobViewModel,
  transitionJob,
  updateJob,
} from "./job-api";
import "./job-editor-modal.css";

interface JobEditorModalProps {
  organizationId: string;
  job?: Job | null;
  defaultLocation: string;
  onClose: () => void;
  onSaved: (job: Job, published: boolean) => void;
}

const tradeCodes: Record<string, string> = {
  Electrical: "electrical",
  Plumbing: "plumbing",
  HVAC: "hvac",
  Carpentry: "carpentry",
  Cabinetry: "cabinetry",
  "Painting/Finishing": "painting_finishing",
  Welding: "welding",
  Roofing: "roofing",
  Flooring: "flooring",
  Drywall: "drywall",
  "Concrete/Masonry": "concrete_masonry",
  Landscaping: "landscaping",
  Tile: "tile",
  Insulation: "insulation",
  Framing: "framing",
  "General Labor": "general_labor",
  Demolition: "demolition",
  Excavation: "excavation",
  Fencing: "fencing",
  Gutters: "gutters",
  "Windows/Doors": "windows_doors",
  Siding: "siding",
  "Driveways/Pavers": "driveways_pavers",
  "Pool/Spa": "pool_spa",
  "Fire Suppression": "fire_protection",
  "Low Voltage": "low_voltage",
  Solar: "solar",
  "Security Systems": "security_systems",
};

const difficultyValues = ["easy", "moderate", "challenging", "advanced", "expert"] as const;
const workTypeValues = ["side_work", "emergency", "multi_day", "inspection_prep"] as const;
const stepLabels = ["Basics", "Scope", "Location"];

function splitList(value: string) {
  return value.split(/[,\n]/).map((item) => item.trim()).filter(Boolean);
}

function joinList(value: string[] | undefined) {
  return (value ?? []).join(", ");
}

function locationParts(location: string) {
  const [city = "", region = ""] = location.split(",").map((part) => part.trim());
  return { city, region };
}

export function JobEditorModal({ organizationId, job, defaultLocation, onClose, onSaved }: JobEditorModalProps) {
  const startingLocation = job?.canonical?.publicLocation ?? { ...locationParts(defaultLocation), countryCode: "US", postalPrefix: null };
  const privateLocation = job?.canonical?.privateLocation;
  const [step, setStep] = useState(0);
  const [savedJob, setSavedJob] = useState<Job | null>(job ?? null);
  const [title, setTitle] = useState(job?.title ?? "");
  const [tradeName, setTradeName] = useState(job?.trade ?? "Electrical");
  const [summary, setSummary] = useState(job?.summary === "Draft scope in progress." ? "" : job?.summary ?? "");
  const [scopeDescription, setScopeDescription] = useState(job?.canonical?.scopeDescription ?? "");
  const [difficulty, setDifficulty] = useState<(typeof difficultyValues)[number]>(job?.difficulty.toLowerCase() as (typeof difficultyValues)[number] ?? "moderate");
  const [workType, setWorkType] = useState<(typeof workTypeValues)[number]>(job?.workType.toLowerCase().replaceAll("-", "_").replaceAll(" ", "_") as (typeof workTypeValues)[number] ?? "side_work");
  const [budget, setBudget] = useState(job?.pay ? String(job.pay) : "");
  const [duration, setDuration] = useState(job?.durationHours ? String(job.durationHours) : "");
  const [insuranceRequired, setInsuranceRequired] = useState(job?.insuranceRequired ?? false);
  const [tools, setTools] = useState(joinList(job?.tools));
  const [materials, setMaterials] = useState(joinList(job?.canonical?.materials));
  const [deliverables, setDeliverables] = useState(joinList(job?.deliverables));
  const [city, setCity] = useState(startingLocation.city);
  const [region, setRegion] = useState(startingLocation.region);
  const [postalPrefix, setPostalPrefix] = useState(startingLocation.postalPrefix ?? "");
  const [addressLine1, setAddressLine1] = useState(privateLocation?.addressLine1 ?? "");
  const [addressLine2, setAddressLine2] = useState(privateLocation?.addressLine2 ?? "");
  const [postalCode, setPostalCode] = useState(privateLocation?.postalCode ?? "");
  const [accessNotes, setAccessNotes] = useState(privateLocation?.accessNotes ?? "");
  const [preferredStartDate, setPreferredStartDate] = useState(job?.canonical?.preferredStartDate ?? "");
  const [applicationDeadline, setApplicationDeadline] = useState(job?.canonical?.applicationDeadline?.slice(0, 16) ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const modalRef = useRef<HTMLDivElement>(null);

  const canSaveBasics = title.trim().length >= 4 && city.trim().length >= 2 && region.trim().length >= 2;
  const canPublish = canSaveBasics
    && summary.trim().length >= 20
    && scopeDescription.trim().length >= 20
    && Number(budget) >= 50
    && Number(duration) > 0
    && addressLine1.trim().length > 0
    && postalCode.trim().length > 0;

  const input = useMemo<JobEditorInput>(() => ({
    organizationId,
    title: title.trim(),
    tradeCode: tradeCodes[tradeName] ?? "other",
    summary: summary.trim(),
    scopeDescription: scopeDescription.trim(),
    difficulty,
    workType,
    budgetCents: budget ? Math.round(Number(budget) * 100) : null,
    budgetUnit: "fixed",
    durationHours: duration ? Number(duration) : null,
    preferredStartDate: preferredStartDate || null,
    applicationDeadline: applicationDeadline ? new Date(applicationDeadline).toISOString() : null,
    insuranceRequired,
    tools: splitList(tools),
    materials: splitList(materials),
    deliverables: splitList(deliverables),
    certificationCodes: [],
    publicLocation: { city: city.trim(), region: region.trim(), countryCode: "US", postalPrefix: postalPrefix.trim() || null },
    privateLocation: addressLine1.trim() || postalCode.trim() ? {
      addressLine1: addressLine1.trim(),
      addressLine2: addressLine2.trim(),
      city: city.trim(),
      region: region.trim(),
      postalCode: postalCode.trim(),
      countryCode: "US",
      accessNotes: accessNotes.trim(),
    } : null,
  }), [accessNotes, addressLine1, addressLine2, applicationDeadline, budget, city, deliverables, difficulty, duration, insuranceRequired, materials, organizationId, postalCode, postalPrefix, preferredStartDate, region, scopeDescription, summary, title, tools, tradeName, workType]);

  async function persistDraft() {
    if (!canSaveBasics) throw new Error("Add a job title and public city/state before saving.");
    const canonical = savedJob?.canonical
      ? await updateJob(savedJob.canonical.id, savedJob.canonical.version, input)
      : await createJob(input);
    const viewModel = toJobViewModel(canonical);
    setSavedJob(viewModel);
    return viewModel;
  }

  async function continueStep() {
    setError("");
    setSaving(true);
    try {
      const draft = await persistDraft();
      onSaved(draft, false);
      setStep((current) => Math.min(current + 1, stepLabels.length - 1));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Draft could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function finish(publish: boolean) {
    setError("");
    if (publish && !canPublish) {
      setError("Finish the scope, budget, duration, and exact address before publishing.");
      return;
    }
    setSaving(true);
    try {
      let current = await persistDraft();
      if (publish && current.status === "Draft" && current.canonical) {
        current = toJobViewModel(await transitionJob(current.canonical.id, "publish", current.canonical.version));
      }
      onSaved(current, publish);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Job could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
      <div className="job-editor" role="dialog" aria-modal="true" aria-labelledby="job-editor-title" ref={modalRef}>
        <header className="job-editor-header">
          <div>
            <span className="section-label">{savedJob ? "Saved job" : "New job"}</span>
            <h2 id="job-editor-title">{savedJob ? "Edit job" : "Create a job"}</h2>
          </div>
          <button type="button" className="icon-button v2-modal-close v2-icon-button" onClick={onClose} disabled={saving} aria-label="Close"><X size={19} /></button>
        </header>

        <ol className="job-editor-steps" aria-label="Job form progress">
          {stepLabels.map((label, index) => (
            <li key={label} className={index === step ? "is-current" : index < step ? "is-complete" : ""}>
              <span>{index < step ? <Check size={14} /> : index + 1}</span>{label}
            </li>
          ))}
        </ol>

        <div className="job-editor-body">
          {step === 0 ? (
            <section className="job-editor-section">
              <div className="job-editor-intro"><h3>What needs to get done?</h3><p>Use a specific title and the public service area tradespeople should see.</p></div>
              <label>Job title<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Commercial panel rough-in" autoFocus /></label>
              <div className="form-grid">
                <label>Trade<select value={tradeName} onChange={(event) => setTradeName(event.target.value as typeof tradeName)}>{tradeOptions.slice(1).map((option) => <option key={option}>{option}</option>)}</select></label>
                <label>Difficulty<select value={difficulty} onChange={(event) => setDifficulty(event.target.value as typeof difficulty)}>{difficultyValues.map((value) => <option key={value} value={value}>{value.charAt(0).toUpperCase() + value.slice(1)}</option>)}</select></label>
              </div>
              <div className="form-grid">
                <label>City<input value={city} onChange={(event) => setCity(event.target.value)} placeholder="Jacksonville" /></label>
                <label>State / region<input value={region} onChange={(event) => setRegion(event.target.value.toUpperCase())} placeholder="FL" maxLength={100} /></label>
              </div>
            </section>
          ) : null}

          {step === 1 ? (
            <section className="job-editor-section">
              <div className="job-editor-intro"><h3>Define the scope</h3><p>Clear expectations produce better-fit responses and fewer jobsite surprises.</p></div>
              <label>Short summary<textarea value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="One or two sentences tradespeople can scan quickly." rows={2} /></label>
              <label>Detailed scope<textarea value={scopeDescription} onChange={(event) => setScopeDescription(event.target.value)} placeholder="Describe the work, existing conditions, and what completion looks like." rows={5} /></label>
              <div className="form-grid three-columns">
                <label>Work type<select value={workType} onChange={(event) => setWorkType(event.target.value as typeof workType)}>{workTypeValues.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></label>
                <label>Budget ($)<input type="number" min="50" step="1" value={budget} onChange={(event) => setBudget(event.target.value)} /></label>
                <label>Hours<input type="number" min="0.5" step="0.5" value={duration} onChange={(event) => setDuration(event.target.value)} /></label>
              </div>
              <label>Tools needed<input value={tools} onChange={(event) => setTools(event.target.value)} placeholder="Multimeter, conduit bender" /></label>
              <label>Materials / site provisions<input value={materials} onChange={(event) => setMaterials(event.target.value)} placeholder="Materials provided, lift onsite" /></label>
              <label>Completion deliverables<input value={deliverables} onChange={(event) => setDeliverables(event.target.value)} placeholder="Inspection-ready work, completion photos" /></label>
              <label className="toggle-control"><input type="checkbox" checked={insuranceRequired} onChange={(event) => setInsuranceRequired(event.target.checked)} /><span><ShieldCheck size={16} /> Insurance required</span></label>
            </section>
          ) : null}

          {step === 2 ? (
            <section className="job-editor-section">
              <div className="job-editor-intro"><h3>Schedule and private location</h3><p>The public listing shows only city and state. The exact address remains restricted.</p></div>
              <div className="privacy-callout"><MapPin size={18} /><div><strong>Exact address is private</strong><span>Only the job owner can access it during this packet.</span></div></div>
              <label>Address line 1<input value={addressLine1} onChange={(event) => setAddressLine1(event.target.value)} autoComplete="street-address" /></label>
              <label>Address line 2 <span className="optional-label">Optional</span><input value={addressLine2} onChange={(event) => setAddressLine2(event.target.value)} /></label>
              <div className="form-grid">
                <label>Postal code<input value={postalCode} onChange={(event) => setPostalCode(event.target.value)} autoComplete="postal-code" /></label>
                <label>Public postal prefix <span className="optional-label">Optional</span><input value={postalPrefix} onChange={(event) => setPostalPrefix(event.target.value)} maxLength={12} /></label>
              </div>
              <label>Access notes <span className="optional-label">Private</span><textarea value={accessNotes} onChange={(event) => setAccessNotes(event.target.value)} rows={3} placeholder="Gate, parking, lockbox, or arrival instructions" /></label>
              <div className="form-grid">
                <label>Preferred start<input type="date" value={preferredStartDate} onChange={(event) => setPreferredStartDate(event.target.value)} /></label>
                <label>Apply by <span className="optional-label">Optional</span><input type="datetime-local" value={applicationDeadline} onChange={(event) => setApplicationDeadline(event.target.value)} /></label>
              </div>
            </section>
          ) : null}
        </div>

        {error ? <div className="job-editor-error" role="alert">{error}</div> : null}

        <footer className="job-editor-footer">
          <div>
            {step > 0 ? <button type="button" className="secondary-action" onClick={() => setStep((current) => current - 1)} disabled={saving}><ArrowLeft size={16} /> Back</button> : null}
          </div>
          <div>
            <button type="button" className="secondary-action" onClick={() => void finish(false)} disabled={saving || !canSaveBasics}><Save size={16} /> Save draft</button>
            {step < stepLabels.length - 1 ? (
              <button type="button" className="primary-action" onClick={() => void continueStep()} disabled={saving || !canSaveBasics}>Continue <ArrowRight size={16} /></button>
            ) : (
              <button type="button" className="primary-action" onClick={() => void finish(true)} disabled={saving || !canPublish}><Send size={16} /> Publish job</button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
