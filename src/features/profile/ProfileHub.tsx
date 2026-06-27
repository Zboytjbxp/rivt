import {
  AlertTriangle,
  BadgeCheck,
  Bell,
  BellOff,
  Calendar,
  Camera,
  CheckCircle,
  CreditCard,
  Download,
  Eye,
  FileText,
  GraduationCap,
  LogOut,
  Mail,
  Monitor,
  MonitorSmartphone,
  Moon,
  Plus,
  ShieldCheck,
  Sparkles,
  Star,
  Sun,
  Tag,
  Trash2,
  UserCheck,
  XCircle,
  Zap,
} from "lucide-react";
import { createPortal } from "react-dom";
import { useState } from "react";
import { usePro } from "../pro/usePro";
import { usePushNotifications } from "../notifications/usePushNotifications";
import { UpgradeModal } from "../pro/UpgradeModal";
import { usePersona, useTradeModeToggle } from "../persona/usePersona";
import "../pro/pro.css";
import { brandConfig, type ThemeMode, type ThemePalette } from "../../brandConfig";
import type { ThemeSource } from "../../app-shell/useAppTheme";
import { tradeOptions } from "../../data";
import type { Role, Trade } from "../../types";
import { Avatar, MetricTile, PageHeader } from "../../components/ui";
import { safetyQuizData, type SafetyQuiz, type SafetyQuizResult } from "./training-data";
import "./profile-hub.css";

interface AccountProfile {
  email: string;
  displayName: string;
  organization: string;
  location: string;
  specialties: Trade[];
  plan: string;
  authMethod: string;
}

export interface AccountSessionSummary {
  id: string;
  deviceLabel: string;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  current: boolean;
}

export interface ProfileUpdateInput {
  displayName: string;
  headline: string;
  bio: string;
  serviceAreaCity: string;
  serviceAreaRegion: string;
  serviceRadiusMiles: number;
  availabilityStatus: "available" | "limited" | "unavailable";
  contactEmailVisibility: "private" | "connections";
  phoneE164: string | null;
  phoneVisibility: "private" | "connections";
  specialties: Trade[];
}

interface CanonicalProfileDetails extends Omit<ProfileUpdateInput, "displayName" | "specialties"> {
  visibility: "private" | "network";
  emailVerified: boolean;
}

interface ProfileHubProps {
  view: "Trust & Legal" | "Safety & Training" | "Reviews" | "Feedback" | "Settings";
  role: Role;
  profile: AccountProfile;
  canonicalProfile: CanonicalProfileDetails | null;
  sessions: AccountSessionSummary[];
  trustReady: boolean;
  recordCount: number;
  trainingProgress: number;
  safetyCertCount: number;
  safetyQuizResults: Record<string, SafetyQuizResult>;
  communityBadges: string[];
  shoutOutCount: number;
  feedbackCount: number;
  themeMode: ThemeMode;
  themeSource: ThemeSource;
  themePalette: ThemePalette;
  onToggleTheme: () => void;
  onSetThemeSource: (source: ThemeSource) => void;
  onSelectThemePalette: (palette: ThemePalette) => void;
  onReviewConsent: () => void;
  onLogout: () => void;
  onSaveProfile: (input: ProfileUpdateInput) => Promise<void>;
  onSetProfileVisibility: (visibility: "private" | "network") => Promise<void>;
  onRevokeSession: (sessionId: string) => Promise<void>;
  onRevokeOtherSessions: () => Promise<void>;
  onQuizComplete: (result: SafetyQuizResult) => void;
}

function QuizModal({
  quiz,
  previousAttempts,
  onComplete,
  onClose,
}: {
  quiz: SafetyQuiz;
  previousAttempts: number;
  onComplete: (result: SafetyQuizResult) => void;
  onClose: () => void;
}) {
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [answers, setAnswers] = useState<number[]>([]);
  const [result, setResult] = useState<SafetyQuizResult | null>(null);

  const question = quiz.questions[questionIndex];
  const isLast = questionIndex === quiz.questions.length - 1;

  function confirm() {
    if (selectedOption === null) return;
    setConfirmed(true);
  }

  function advance() {
    if (selectedOption === null || !confirmed) return;
    const newAnswers = [...answers, selectedOption];
    if (isLast) {
      const correct = newAnswers.filter((sel, i) => sel === quiz.questions[i].correctIndex).length;
      const score = Math.round((correct / quiz.questions.length) * 100);
      const passed = score >= 80;
      const quizResult: SafetyQuizResult = {
        quizId: quiz.id,
        score,
        passed,
        completedAt: new Date().toISOString(),
        attempts: previousAttempts + 1,
      };
      setAnswers(newAnswers);
      setResult(quizResult);
      onComplete(quizResult);
    } else {
      setAnswers(newAnswers);
      setQuestionIndex((i) => i + 1);
      setSelectedOption(null);
      setConfirmed(false);
    }
  }

  function retake() {
    setQuestionIndex(0);
    setSelectedOption(null);
    setConfirmed(false);
    setAnswers([]);
    setResult(null);
  }

  const correctCount = result
    ? answers.filter((sel, i) => sel === quiz.questions[i].correctIndex).length
    : 0;

  return createPortal(
    <div className="v2-quiz-overlay" role="dialog" aria-modal="true">
      <div className="v2-quiz-modal">
        {result ? (
          <div className="v2-quiz-result">
            <div className={`v2-quiz-result-icon ${result.passed ? "is-pass" : "is-fail"}`}>
              {result.passed ? <CheckCircle size={52} /> : <XCircle size={52} />}
            </div>
            <h3>{result.passed ? "Certificate earned" : "Not quite yet"}</h3>
            <p className="v2-quiz-score-line">{result.score}% · {correctCount}/{quiz.questions.length} correct</p>
            <p className="v2-quiz-result-desc">
              {result.passed
                ? `You passed ${quiz.title}. This certificate is now on your safety record.`
                : `Passing score is 80% (${Math.ceil(quiz.questions.length * 0.8)} of ${quiz.questions.length} correct). Review the explanations and try again.`}
            </p>
            <div className="v2-quiz-result-actions">
              {!result.passed && (
                <button type="button" className="v2-secondary-button" onClick={retake}>
                  Try again
                </button>
              )}
              <button type="button" className="v2-primary-button" onClick={onClose}>
                Done
              </button>
            </div>
          </div>
        ) : (
          <>
            <header className="v2-quiz-header">
              <div className="v2-quiz-header-info">
                <span>{quiz.title}</span>
                <strong>Question {questionIndex + 1} of {quiz.questions.length}</strong>
              </div>
              <button type="button" className="v2-quiz-close-btn" onClick={onClose} aria-label="Close quiz">✕</button>
            </header>
            <div className="v2-quiz-progress-track">
              <div
                className="v2-quiz-progress-fill"
                style={{ width: `${(questionIndex / quiz.questions.length) * 100}%` }}
              />
            </div>
            <div className="v2-quiz-body">
              <p className="v2-quiz-question-text">{question.text}</p>
              <div className="v2-quiz-options">
                {question.options.map((option, i) => (
                  <button
                    key={i}
                    type="button"
                    className={[
                      "v2-quiz-option",
                      selectedOption === i && !confirmed ? "is-selected" : "",
                      confirmed && i === question.correctIndex ? "is-correct" : "",
                      confirmed && selectedOption === i && i !== question.correctIndex ? "is-wrong" : "",
                    ].filter(Boolean).join(" ")}
                    disabled={confirmed}
                    onClick={() => !confirmed && setSelectedOption(i)}
                  >
                    <span className="v2-quiz-option-marker">{String.fromCharCode(65 + i)}</span>
                    <span>{option}</span>
                  </button>
                ))}
              </div>
              {confirmed && (
                <div className={`v2-quiz-explanation ${selectedOption === question.correctIndex ? "is-correct" : "is-wrong"}`}>
                  <strong>{selectedOption === question.correctIndex ? "Correct!" : "Not quite."}</strong>
                  <p>{question.explanation}</p>
                </div>
              )}
            </div>
            <footer className="v2-quiz-footer">
              {!confirmed ? (
                <button
                  type="button"
                  className="v2-primary-button"
                  disabled={selectedOption === null}
                  onClick={confirm}
                >
                  Check answer
                </button>
              ) : (
                <button type="button" className="v2-primary-button" onClick={advance}>
                  {isLast ? "Finish" : "Next question"}
                </button>
              )}
            </footer>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

function SafetyTrainingSection({
  safetyQuizResults,
  safetyCertCount,
  onQuizComplete,
}: {
  safetyQuizResults: Record<string, SafetyQuizResult>;
  safetyCertCount: number;
  onQuizComplete: (result: SafetyQuizResult) => void;
}) {
  const [activeQuizId, setActiveQuizId] = useState<string | null>(null);
  const activeQuiz = safetyQuizData.find((q) => q.id === activeQuizId) ?? null;
  const total = safetyQuizData.length;
  const pct = total ? Math.round((safetyCertCount / total) * 100) : 0;

  return (
    <div className="v2-safety-section">
      <div className="v2-safety-progress-summary">
        <div className="v2-safety-progress-bar-track">
          <div className="v2-safety-progress-bar-fill" style={{ width: `${pct}%` }} />
        </div>
        <span>{safetyCertCount} of {total} certified · {pct}%</span>
      </div>
      <div className="v2-quiz-grid">
        {safetyQuizData.map((quiz) => {
          const res = safetyQuizResults[quiz.id];
          return (
            <article key={quiz.id} className="v2-quiz-card">
              <div className="v2-quiz-card-meta">
                <span className="v2-quiz-osha-badge">{quiz.oshaRef}</span>
                {res?.passed && (
                  <span className="v2-quiz-status-badge is-pass">
                    <BadgeCheck size={12} /> Certified
                  </span>
                )}
                {res && !res.passed && (
                  <span className="v2-quiz-status-badge is-fail">{res.score}%</span>
                )}
              </div>
              <strong className="v2-quiz-card-title">{quiz.title}</strong>
              <p className="v2-quiz-card-desc">{quiz.description}</p>
              <button
                type="button"
                className={res?.passed ? "v2-secondary-button" : "v2-primary-button"}
                onClick={() => setActiveQuizId(quiz.id)}
              >
                {res?.passed ? "Retake" : res ? "Try again" : "Start quiz"}
              </button>
            </article>
          );
        })}
      </div>
      {activeQuiz && (
        <QuizModal
          quiz={activeQuiz}
          previousAttempts={safetyQuizResults[activeQuiz.id]?.attempts ?? 0}
          onComplete={onQuizComplete}
          onClose={() => setActiveQuizId(null)}
        />
      )}
    </div>
  );
}

// ── Rate Card ─────────────────────────────────────────────────────────────────

const rateCardKey = "rivt.rateCard.v1";

interface RateCardEntry {
  id: string;
  trade: string;
  hourlyRate: number;
  dayRate: number;
  minimumCharge: number;
  notes: string;
}

function readRateCard(): RateCardEntry[] {
  try {
    const stored = localStorage.getItem(rateCardKey);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as RateCardEntry[];
    return Array.isArray(parsed) ? parsed.slice(0, 12) : [];
  } catch { return []; }
}

function persistRateCard(entries: RateCardEntry[]) {
  try { localStorage.setItem(rateCardKey, JSON.stringify(entries.slice(0, 12))); } catch { /* noop */ }
}

// ── Cert & License Tracker ────────────────────────────────────────────────────

const certKey = "rivt.certs.v1";

interface CertEntry {
  id: string;
  name: string;
  number: string;
  issuer: string;
  issueDate: string;
  expiryDate: string;
  notes: string;
}

function readCerts(): CertEntry[] {
  try {
    const stored = localStorage.getItem(certKey);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as CertEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function persistCerts(certs: CertEntry[]) {
  try { localStorage.setItem(certKey, JSON.stringify(certs.slice(0, 50))); } catch { /* noop */ }
}

function certStatus(expiryDate: string): "ok" | "soon" | "expired" {
  if (!expiryDate) return "ok";
  const expiry = new Date(expiryDate).getTime();
  const now = Date.now();
  if (expiry < now) return "expired";
  if (expiry - now < 60 * 24 * 60 * 60 * 1000) return "soon";
  return "ok";
}

function CertTrackerSection() {
  const [certs, setCerts] = useState<CertEntry[]>(readCerts);
  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [issuer, setIssuer] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [notes, setNotes] = useState("");
  const [notice, setNotice] = useState("");

  function addCert() {
    if (!name.trim()) return;
    const cert: CertEntry = {
      id: crypto.randomUUID(),
      name: name.trim(),
      number: number.trim(),
      issuer: issuer.trim(),
      issueDate,
      expiryDate,
      notes: notes.trim(),
    };
    const next = [cert, ...certs];
    setCerts(next);
    persistCerts(next);
    setName(""); setNumber(""); setIssuer(""); setIssueDate(""); setExpiryDate(""); setNotes("");
    setNotice("Certificate saved.");
    setTimeout(() => setNotice(""), 3000);
  }

  function removeCert(id: string) {
    const next = certs.filter((c) => c.id !== id);
    setCerts(next);
    persistCerts(next);
  }

  const expiredCount = certs.filter((c) => certStatus(c.expiryDate) === "expired").length;
  const soonCount = certs.filter((c) => certStatus(c.expiryDate) === "soon").length;

  return (
    <section className="v2-profile-panel v2-profile-panel-wide v2-cert-tracker-section">
      <header>
        <span>Licenses &amp; certs {expiredCount > 0 ? <span className="v2-cert-alert-badge is-expired">{expiredCount} expired</span> : soonCount > 0 ? <span className="v2-cert-alert-badge is-soon">{soonCount} expiring soon</span> : null}</span>
        <strong>License &amp; Certificate Tracker</strong>
      </header>
      <div className="v2-cert-form">
        <div className="v2-cert-inputs">
          <label>Cert / license name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Electrician license, OSHA 10, CPR…" /></label>
          <label>License #<input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="Optional" /></label>
          <label>Issuer<input value={issuer} onChange={(e) => setIssuer(e.target.value)} placeholder="State board, OSHA, Red Cross…" /></label>
          <label>Issue date<input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} /></label>
          <label>Expiry date<input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} /></label>
          <label>Notes<input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Coverage area, endorsements…" /></label>
        </div>
        {notice ? <p className="v2-profile-action-message is-success" role="status">{notice}</p> : null}
        <button type="button" className="v2-primary-button" disabled={!name.trim()} onClick={addCert}><Plus size={14} />Add certificate</button>
      </div>
      {certs.length ? (
        <div className="v2-cert-list">
          {certs.map((cert) => {
            const status = certStatus(cert.expiryDate);
            return (
              <article key={cert.id} className={`v2-cert-item cert-status-${status}`}>
                <div className="v2-cert-item-head">
                  {status === "expired" ? <AlertTriangle size={16} className="v2-cert-status-icon" /> : status === "soon" ? <AlertTriangle size={16} className="v2-cert-status-icon is-soon" /> : <BadgeCheck size={16} className="v2-cert-status-icon is-ok" />}
                  <strong>{cert.name}</strong>
                  {cert.number ? <span className="v2-cert-number">#{cert.number}</span> : null}
                  <button type="button" aria-label={`Remove ${cert.name}`} onClick={() => removeCert(cert.id)}><Trash2 size={13} /></button>
                </div>
                <div className="v2-cert-item-meta">
                  {cert.issuer ? <small>{cert.issuer}</small> : null}
                  {cert.issueDate ? <small><Calendar size={11} /> Issued {cert.issueDate}</small> : null}
                  {cert.expiryDate ? <small className={status !== "ok" ? `is-${status}` : ""}><Calendar size={11} /> {status === "expired" ? "Expired" : "Expires"} {cert.expiryDate}</small> : null}
                  {cert.notes ? <small>{cert.notes}</small> : null}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="v2-profile-note">No certs saved yet. Track your licenses, trade certs, OSHA cards, and insurance here.</p>
      )}
    </section>
  );
}

function RateCardSection() {
  const [rates, setRates] = useState<RateCardEntry[]>(readRateCard);
  const [trade, setTrade] = useState("");
  const [hourly, setHourly] = useState("");
  const [day, setDay] = useState("");
  const [minimum, setMinimum] = useState("");
  const [notes, setNotes] = useState("");
  const [notice, setNotice] = useState("");

  function addRate() {
    if (!trade.trim()) return;
    const entry: RateCardEntry = {
      id: crypto.randomUUID(),
      trade: trade.trim(),
      hourlyRate: parseFloat(hourly) || 0,
      dayRate: parseFloat(day) || 0,
      minimumCharge: parseFloat(minimum) || 0,
      notes: notes.trim(),
    };
    const next = [entry, ...rates.filter((r) => r.trade.toLowerCase() !== trade.trim().toLowerCase())];
    setRates(next);
    persistRateCard(next);
    setTrade("");
    setHourly("");
    setDay("");
    setMinimum("");
    setNotes("");
    setNotice("Rate saved.");
    setTimeout(() => setNotice(""), 3000);
  }

  function deleteRate(id: string) {
    const next = rates.filter((r) => r.id !== id);
    setRates(next);
    persistRateCard(next);
  }

  function fmt(n: number) {
    return n > 0 ? `$${n.toLocaleString()}` : "—";
  }

  return (
    <section className="v2-profile-panel v2-profile-panel-wide v2-rate-card-section">
      <header>
        <span>Rate card</span>
        <strong>Your standard rates by trade</strong>
      </header>
      <div className="v2-rate-card-form">
        <div className="v2-rate-card-inputs">
          <label>Trade<input value={trade} onChange={(e) => setTrade(e.target.value)} placeholder="Electrical, framing…" /></label>
          <label>Hourly ($)<input type="number" min="0" value={hourly} onChange={(e) => setHourly(e.target.value)} placeholder="75" /></label>
          <label>Day rate ($)<input type="number" min="0" value={day} onChange={(e) => setDay(e.target.value)} placeholder="600" /></label>
          <label>Minimum ($)<input type="number" min="0" value={minimum} onChange={(e) => setMinimum(e.target.value)} placeholder="250" /></label>
          <label className="is-wide">Notes<input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Includes basic materials, travel within 30 mi…" /></label>
        </div>
        {notice ? <p className="v2-rate-card-notice" role="status">{notice}</p> : null}
        <button type="button" className="v2-primary-button" disabled={!trade.trim()} onClick={addRate}><Plus size={14} />Save rate</button>
      </div>
      {rates.length ? (
        <div className="v2-rate-card-list">
          {rates.map((r) => (
            <article key={r.id} className="v2-rate-card-item">
              <div className="v2-rate-card-item-head">
                <Tag size={15} />
                <strong>{r.trade}</strong>
                <button type="button" aria-label={`Delete ${r.trade} rate`} onClick={() => deleteRate(r.id)}><Trash2 size={13} /></button>
              </div>
              <div className="v2-rate-card-item-rates">
                <div><span>Hourly</span><strong>{fmt(r.hourlyRate)}</strong></div>
                <div><span>Day rate</span><strong>{fmt(r.dayRate)}</strong></div>
                <div><span>Minimum</span><strong>{fmt(r.minimumCharge)}</strong></div>
              </div>
              {r.notes ? <p className="v2-rate-card-item-notes">{r.notes}</p> : null}
            </article>
          ))}
        </div>
      ) : (
        <p className="v2-profile-note">No rates saved yet. Add your standard rates so contractors know what to expect when they view your profile.</p>
      )}
    </section>
  );
}

// ── Profile Completion Card ───────────────────────────────────────────────────

function ProfileCompletionCard({ profile }: { profile: AccountProfile }) {
  const checks = [
    { label: "Display name", done: Boolean(profile.displayName?.trim()) },
    { label: "Location", done: Boolean(profile.location?.trim()) },
    { label: "Bio", done: (() => { try { const c = JSON.parse(localStorage.getItem("rivt.canonicalProfile.v1") ?? "null"); return Boolean(c?.bio?.trim()); } catch { return false; } })() },
    { label: "Trade specialty", done: Boolean(profile.specialties?.length > 0) },
    { label: "Rate card", done: (() => { try { const r = JSON.parse(localStorage.getItem("rivt.rateCard.v1") ?? "null"); return Array.isArray(r) && r.length > 0; } catch { return false; } })() },
    { label: "Safety cert", done: (() => { try { const c = JSON.parse(localStorage.getItem("rivt.certs.v1") ?? "[]"); return Array.isArray(c) && c.length > 0; } catch { return false; } })() },
  ];
  const score = Math.round((checks.filter((c) => c.done).length / checks.length) * 100);
  const missing = checks.filter((c) => !c.done).slice(0, 3);
  return (
    <div className="v2-profile-completion">
      <header>
        <span>Profile {score}% complete</span>
        {score === 100 && <span className="v2-profile-complete-badge">Complete ✓</span>}
      </header>
      <div className="v2-profile-completion-bar">
        <div className="v2-profile-completion-fill" style={{ width: `${score}%` }} />
      </div>
      {missing.length > 0 && (
        <ul className="v2-profile-missing">
          {missing.map((m) => <li key={m.label}>Add {m.label}</li>)}
        </ul>
      )}
    </div>
  );
}

// ── Portfolio Section ─────────────────────────────────────────────────────────

function PortfolioSection({ onNavigate }: { onNavigate?: (dest: string) => void }) {
  return (
    <div className="v2-portfolio-section">
      <header>
        <Camera size={16} />
        <span>Portfolio &amp; Work Samples</span>
      </header>
      <p>Your job photos from RIVT albums are your portfolio. They're private by default — only you see them.</p>
      <button type="button" className="v2-primary-button" onClick={() => onNavigate?.("tools")}>
        View job photos
      </button>
    </div>
  );
}

// ── Service Area Selector ─────────────────────────────────────────────────────

function ServiceAreaSelector() {
  const options = ["10", "25", "50", "100", "Any"];
  const [radius, setRadius] = useState(() => {
    try { return localStorage.getItem("rivt.serviceRadius.v1") ?? "25"; } catch { return "25"; }
  });
  function pick(r: string) {
    setRadius(r);
    try { localStorage.setItem("rivt.serviceRadius.v1", r); } catch { /* noop */ }
  }
  return (
    <div className="v2-service-area">
      <span className="v2-service-area-label">Service radius</span>
      <div className="v2-service-area-chips">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            className={`v2-service-chip${radius === opt ? " active" : ""}`}
            onClick={() => pick(opt)}
          >
            {opt === "Any" ? "Any distance" : `${opt} mi`}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Data Export Button ────────────────────────────────────────────────────────

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function DataExportButton() {
  const [toast, setToast] = useState("");

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  function handleExportJSON() {
    const data: Record<string, unknown> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith("rivt.")) {
        try { data[key] = JSON.parse(localStorage.getItem(key) ?? "null"); } catch { data[key] = localStorage.getItem(key); }
      }
    }
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    downloadBlob(blob, `rivt-export-${new Date().toISOString().slice(0, 10)}.json`);
    showToast("Data exported successfully");
  }

  function handleExportJobsCSV() {
    type JobRecord = Record<string, unknown>;
    let jobs: JobRecord[] = [];
    try { jobs = (JSON.parse(localStorage.getItem("rivt.jobs.v1") ?? "[]") as JobRecord[]); } catch { /* noop */ }
    if (!Array.isArray(jobs) || jobs.length === 0) {
      showToast("No jobs found to export");
      return;
    }
    const headers = Array.from(new Set(jobs.flatMap(j => Object.keys(j))));
    const rows = jobs.map(j => headers.map(h => {
      const v = j[h];
      const s = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
      return `"${s.replace(/"/g, '""')}"`;
    }).join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    downloadBlob(blob, `rivt-jobs-${new Date().toISOString().slice(0, 10)}.csv`);
    showToast("Data exported successfully");
  }

  return (
    <div className="v2-data-export-section">
      {toast && (
        <div className="v2-export-toast" role="status">{toast}</div>
      )}
      <div className="v2-data-export">
        <button type="button" className="v2-btn-secondary" onClick={handleExportJSON}>
          <Download size={15} /> Export data (JSON)
        </button>
        <small>Downloads jobs, sessions, expenses, clients, crew &amp; all RIVT data.</small>
      </div>
      <div className="v2-data-export">
        <button type="button" className="v2-btn-secondary" onClick={handleExportJobsCSV}>
          <Download size={15} /> Export jobs (CSV)
        </button>
        <small>Downloads your job records as a spreadsheet.</small>
      </div>
    </div>
  );
}

// ── Onboarding Flow ────────────────────────────────────────────────────────────

const ONBOARDING_TRADES = [
  "Electrician", "Plumber", "HVAC", "Carpenter", "General Contractor",
  "Roofer", "Painter", "Welder", "Landscaper", "Mason", "Tile Setter", "Other",
] as const;
type OnboardingTrade = typeof ONBOARDING_TRADES[number];

interface OnboardingData {
  trade: OnboardingTrade;
  hourlyRate: string;
  city: string;
  completedAt: string;
}

function readOnboarding(): OnboardingData | null {
  try {
    const stored = localStorage.getItem("rivt.onboarding.v1");
    if (!stored) return null;
    return JSON.parse(stored) as OnboardingData;
  } catch { return null; }
}

function OnboardingOverlay({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const [selectedTrade, setSelectedTrade] = useState<OnboardingTrade | null>(null);
  const [hourlyRate, setHourlyRate] = useState("");
  const [city, setCity] = useState("");

  function finishOnboarding() {
    if (!selectedTrade) return;
    const data: OnboardingData = {
      trade: selectedTrade,
      hourlyRate,
      city,
      completedAt: new Date().toISOString(),
    };
    try { localStorage.setItem("rivt.onboarding.v1", JSON.stringify(data)); } catch { /* noop */ }
    // Also save to rateCard
    if (selectedTrade && hourlyRate) {
      const entry = {
        id: crypto.randomUUID(),
        trade: selectedTrade,
        hourlyRate: parseFloat(hourlyRate) || 0,
        dayRate: 0,
        minimumCharge: 0,
        notes: city ? `Based in ${city}` : "",
      };
      try {
        const existing = JSON.parse(localStorage.getItem("rivt.rateCard.v1") ?? "[]") as unknown[];
        localStorage.setItem("rivt.rateCard.v1", JSON.stringify([entry, ...existing].slice(0, 12)));
      } catch { /* noop */ }
    }
    onComplete();
  }

  return createPortal(
    <div className="v2-onboarding-overlay" role="dialog" aria-modal="true" aria-label="Welcome to RIVT">
      <div className="v2-onboarding-modal">
        <div className="v2-onboarding-stepper">
          {[0, 1, 2].map((i) => (
            <div key={i} className={`v2-onboarding-step${step === i ? " is-active" : step > i ? " is-done" : ""}`} />
          ))}
        </div>

        {step === 0 && (
          <div className="v2-onboarding-body">
            <h2>What's your trade?</h2>
            <p>Pick the one that fits best — you can add more later in Settings.</p>
            <div className="v2-onboarding-trade-grid">
              {ONBOARDING_TRADES.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`v2-onboarding-trade-chip${selectedTrade === t ? " is-active" : ""}`}
                  onClick={() => setSelectedTrade(t)}
                >
                  {t}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="v2-primary-button v2-onboarding-next"
              disabled={!selectedTrade}
              onClick={() => setStep(1)}
            >
              Next
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="v2-onboarding-body">
            <h2>Set your rate</h2>
            <p>This helps contractors match your range. You can update it anytime.</p>
            <div className="v2-onboarding-fields">
              <label>
                <span>Hourly rate ($)</span>
                <input
                  type="number"
                  min="0"
                  placeholder="e.g. 75"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)}
                />
              </label>
              <label>
                <span>What city do you work in?</span>
                <input
                  type="text"
                  placeholder="e.g. Jacksonville, FL"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
              </label>
            </div>
            <div className="v2-onboarding-actions">
              <button type="button" className="v2-secondary-button" onClick={() => setStep(0)}>Back</button>
              <button type="button" className="v2-primary-button" onClick={() => setStep(2)}>Next</button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="v2-onboarding-body v2-onboarding-summary">
            <div className="v2-onboarding-check">✓</div>
            <h2>You're all set!</h2>
            <div className="v2-onboarding-summary-card">
              <div><span>Trade</span><strong>{selectedTrade}</strong></div>
              {hourlyRate && <div><span>Hourly rate</span><strong>${hourlyRate}/hr</strong></div>}
              {city && <div><span>City</span><strong>{city}</strong></div>}
            </div>
            <p>Your profile is ready. You can update this anytime in Settings.</p>
            <button type="button" className="v2-primary-button v2-onboarding-next" onClick={finishOnboarding}>
              Get Started
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

// ── Business Settings Section ──────────────────────────────────────────────────

interface BusinessInfo {
  companyName: string;
  licenseNumber: string;
  insuranceProvider: string;
  insuranceExpiry: string;
  businessAddress: string;
  website: string;
  businessPhone: string;
}

function readBusinessInfo(): BusinessInfo {
  try {
    const stored = localStorage.getItem("rivt.business.v1");
    if (!stored) return { companyName: "", licenseNumber: "", insuranceProvider: "", insuranceExpiry: "", businessAddress: "", website: "", businessPhone: "" };
    return JSON.parse(stored) as BusinessInfo;
  } catch {
    return { companyName: "", licenseNumber: "", insuranceProvider: "", insuranceExpiry: "", businessAddress: "", website: "", businessPhone: "" };
  }
}

function insuranceStatus(expiryDate: string): "ok" | "soon" | "expired" {
  if (!expiryDate) return "ok";
  const expiry = new Date(expiryDate).getTime();
  const now = Date.now();
  if (expiry < now) return "expired";
  if (expiry - now < 60 * 24 * 60 * 60 * 1000) return "soon";
  return "ok";
}

function BusinessSettingsSection() {
  const [info, setInfo] = useState<BusinessInfo>(readBusinessInfo);
  const [saved, setSaved] = useState(false);

  function save() {
    try { localStorage.setItem("rivt.business.v1", JSON.stringify(info)); } catch { /* noop */ }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const insStatus = insuranceStatus(info.insuranceExpiry);

  return (
    <section className="v2-profile-panel v2-profile-panel-wide v2-business-section">
      <header>
        <span>Business</span>
        <strong>Company &amp; insurance details</strong>
      </header>
      <div className="v2-business-form">
        <div className="v2-business-grid">
          <label>
            <span>Company name</span>
            <input value={info.companyName} onChange={(e) => setInfo({ ...info, companyName: e.target.value })} placeholder="Acme Electric LLC" />
          </label>
          <label>
            <span>License number</span>
            <input value={info.licenseNumber} onChange={(e) => setInfo({ ...info, licenseNumber: e.target.value })} placeholder="EC-1234567" />
          </label>
          <label>
            <span>Insurance provider</span>
            <input value={info.insuranceProvider} onChange={(e) => setInfo({ ...info, insuranceProvider: e.target.value })} placeholder="Acuity, Travelers…" />
          </label>
          <label>
            <span>Insurance expiry</span>
            <input
              type="date"
              value={info.insuranceExpiry}
              onChange={(e) => setInfo({ ...info, insuranceExpiry: e.target.value })}
              className={insStatus !== "ok" ? `v2-business-input-warn is-${insStatus}` : ""}
            />
            {insStatus === "soon" && <small className="v2-business-warn">Expires within 60 days</small>}
            {insStatus === "expired" && <small className="v2-business-warn is-expired">Insurance expired</small>}
          </label>
          <label className="v2-business-wide">
            <span>Business address</span>
            <input value={info.businessAddress} onChange={(e) => setInfo({ ...info, businessAddress: e.target.value })} placeholder="123 Main St, Jacksonville, FL 32202" />
          </label>
          <label>
            <span>Website / portfolio URL</span>
            <input type="url" value={info.website} onChange={(e) => setInfo({ ...info, website: e.target.value })} placeholder="https://acmeelectric.com" />
          </label>
          <label>
            <span>Business phone</span>
            <input type="tel" value={info.businessPhone} onChange={(e) => setInfo({ ...info, businessPhone: e.target.value })} placeholder="(904) 555-0100" />
          </label>
        </div>
        {saved && <p className="v2-profile-action-message is-success" role="status">Business info saved.</p>}
        <button type="button" className="v2-primary-button" onClick={save}>Save business info</button>
      </div>

      {/* Business Card Preview */}
      {info.companyName && (
        <div className="v2-business-card-preview">
          <div className="v2-biz-card">
            <div className="v2-biz-card-logo">RIVT</div>
            <div className="v2-biz-card-body">
              <strong>{info.companyName}</strong>
              {info.licenseNumber && <span>Lic #{info.licenseNumber}</span>}
              {info.businessAddress && <span>{info.businessAddress}</span>}
              {info.businessPhone && <span>{info.businessPhone}</span>}
              {info.website && <a href={info.website} target="_blank" rel="noreferrer">{info.website.replace(/^https?:\/\//, "")}</a>}
              {info.insuranceProvider && <span>Insured by {info.insuranceProvider}</span>}
            </div>
          </div>
          <small>This is how your info appears to clients</small>
        </div>
      )}
    </section>
  );
}

const themePaletteOrder = Object.keys(brandConfig.theme.palettes) as ThemePalette[];

function PushNotificationsCard() {
  const { permission, subscribed, busy, error, requestAndSubscribe, sendTestNotification, unsubscribe } = usePushNotifications();

  return (
    <div className="v2-push-card">
      <div className="v2-push-header">
        <div>
          <strong>Push notifications</strong>
          <p>Get alerted for new job matches, messages, and Shop Talk replies.</p>
        </div>
        {subscribed
          ? <span className="v2-push-status is-on">On</span>
          : <span className="v2-push-status">Off</span>}
      </div>

      {permission === "denied" && (
        <p className="v2-push-denied">Blocked in browser settings. Open site settings to allow notifications.</p>
      )}

      {error && <p className="v2-push-error">{error}</p>}

      <div className="v2-push-actions">
        {!subscribed && permission !== "denied" && (
          <button
            type="button"
            className="v2-primary-button"
            onClick={requestAndSubscribe}
            disabled={busy}
          >
            <Bell size={14} />
            {busy ? "Enabling…" : "Enable notifications"}
          </button>
        )}
        {subscribed && (
          <>
            <button type="button" className="v2-primary-button" onClick={sendTestNotification}>
              <Bell size={14} />Test notification
            </button>
            <button type="button" onClick={unsubscribe}>
              <BellOff size={14} />Turn off
            </button>
          </>
        )}
      </div>

      {!import.meta.env.VITE_VAPID_PUBLIC_KEY && subscribed && (
        <p className="v2-push-note">Local notifications active. Set VITE_VAPID_PUBLIC_KEY to enable background push alerts.</p>
      )}
    </div>
  );
}

function PlanCard() {
  const { isPro, activatedAt } = usePro();
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  return (
    <div className="v2-plan-card">
      <div className="v2-plan-header">
        <span className="v2-plan-name">{isPro ? "RIVT Pro" : "Free plan"}</span>
        {isPro ? (
          <span className="v2-pro-badge"><Zap size={10} />Pro</span>
        ) : (
          <span style={{fontSize:12,color:'var(--v2-text-muted)'}}>Free</span>
        )}
      </div>
      {!isPro && (
        <>
          <div className="v2-plan-limits">
            <div className="v2-plan-limit-row"><span>Photo albums</span><span>Up to 50 photos</span></div>
            <div className="v2-plan-limit-row"><span>History</span><span>90 days</span></div>
            <div className="v2-plan-limit-row"><span>Punch lists</span><span>1 active list</span></div>
            <div className="v2-plan-limit-row"><span>CSV export</span><span>Pro only</span></div>
          </div>
          <button type="button" className="v2-plan-upgrade-btn" onClick={() => setUpgradeOpen(true)}>
            Upgrade to Pro — $99/year
          </button>
        </>
      )}
      {isPro && activatedAt && (
        <p style={{fontSize:13,color:'var(--v2-text-muted)',margin:0}}>
          Pro since {new Date(activatedAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </p>
      )}
      {upgradeOpen && <UpgradeModal onClose={() => setUpgradeOpen(false)} />}
    </div>
  );
}

export function ProfileHub({
  view,
  role,
  profile,
  canonicalProfile,
  sessions,
  trustReady,
  recordCount,
  trainingProgress,
  safetyCertCount,
  safetyQuizResults,
  communityBadges,
  shoutOutCount,
  feedbackCount,
  themeMode: _themeMode,
  themeSource,
  themePalette,
  onToggleTheme: _onToggleTheme,
  onSetThemeSource,
  onSelectThemePalette,
  onReviewConsent,
  onLogout,
  onSaveProfile,
  onSetProfileVisibility,
  onRevokeSession,
  onRevokeOtherSessions,
  onQuizComplete,
}: ProfileHubProps) {
  const persona = usePersona();
  const [tradeModeOn, toggleTradeMode] = useTradeModeToggle();
  const [notificationPrefs, setNotificationPrefs] = useState({
    jobMatches: true,
    messages: true,
    shoutOuts: true,
    safetyUpdates: false,
  });
  const [showPreview, setShowPreview] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => readOnboarding() === null);
  const [onboardingKey, setOnboardingKey] = useState(0);

  const [feedbackCategory, setFeedbackCategory] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackSent, setFeedbackSent] = useState(false);

  const [draft, setDraft] = useState<ProfileUpdateInput>({
    displayName: profile.displayName,
    headline: canonicalProfile?.headline ?? "",
    bio: canonicalProfile?.bio ?? "",
    serviceAreaCity: canonicalProfile?.serviceAreaCity ?? "",
    serviceAreaRegion: canonicalProfile?.serviceAreaRegion ?? "",
    serviceRadiusMiles: canonicalProfile?.serviceRadiusMiles ?? 25,
    availabilityStatus: canonicalProfile?.availabilityStatus ?? "available",
    contactEmailVisibility: canonicalProfile?.contactEmailVisibility ?? "private",
    phoneE164: canonicalProfile?.phoneE164 ?? null,
    phoneVisibility: canonicalProfile?.phoneVisibility ?? "private",
    specialties: profile.specialties,
  });
  const [actionState, setActionState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [actionMessage, setActionMessage] = useState("");

  async function saveProfile() {
    setActionState("saving");
    setActionMessage("");
    try {
      await onSaveProfile(draft);
      setActionState("saved");
      setActionMessage("Profile saved.");
    } catch (error) {
      setActionState("error");
      setActionMessage(error instanceof Error ? error.message : "Profile could not be saved.");
    }
  }

  async function runAccountAction(action: () => Promise<void>) {
    setActionState("saving");
    setActionMessage("");
    try {
      await action();
      setActionState("saved");
      setActionMessage("Account security updated.");
    } catch (error) {
      setActionState("error");
      setActionMessage(error instanceof Error ? error.message : "Account security could not be updated.");
    }
  }

  function toggleSpecialty(specialty: Trade) {
    setDraft((current) => ({
      ...current,
      specialties: current.specialties.includes(specialty)
        ? current.specialties.filter((item) => item !== specialty)
        : [...current.specialties, specialty],
    }));
  }

  const profileViewDescriptions: Record<string, string> = {
    "Safety & Training": "OSHA-aligned modules. Pass each quiz to earn a certificate.",
    "Trust & Legal": "Consent, legal agreements, and your trust status.",
    "Reviews": "Shout-outs and reputation from people you've worked with.",
    "Settings": "Manage your account, profile, and preferences.",
    "Feedback": "Share feedback to help improve RIVT.",
  };

  if (view === "Safety & Training") {
    return (
      <>
        {showOnboarding && (
          <OnboardingOverlay key={onboardingKey} onComplete={() => setShowOnboarding(false)} />
        )}
        <section className="v2-profile-page" aria-label="Safety & Training">
          <PageHeader
            className="v2-profile-header"
            title="Safety & Training"
            description={profileViewDescriptions["Safety & Training"]}
          />
          <SafetyTrainingSection
            safetyQuizResults={safetyQuizResults}
            safetyCertCount={safetyCertCount}
            onQuizComplete={onQuizComplete}
          />
        </section>
      </>
    );
  }

  function submitFeedback() {
    if (!feedbackMessage.trim() || !feedbackCategory) return;
    setFeedbackSent(true);
    setFeedbackMessage("");
    setFeedbackCategory(null);
    setTimeout(() => setFeedbackSent(false), 4000);
  }

  if (view === "Feedback") {
    return (
      <>
        {showOnboarding && (
          <OnboardingOverlay key={onboardingKey} onComplete={() => setShowOnboarding(false)} />
        )}
      <section className="v2-profile-page" aria-label="Feedback">
        <PageHeader
          className="v2-profile-header"
          title="Feedback"
          description="Share what's working, what's confusing, and what you need next."
        />
        <div className="v2-feedback-layout">
          <section className="v2-profile-panel v2-feedback-form-panel">
            <header>
              <span>Submit feedback</span>
              <strong>What's on your mind?</strong>
            </header>
            <div className="v2-feedback-body">
              <div className="v2-feedback-categories" role="group" aria-label="Feedback type">
                {(["Bug", "Confusing", "Feature", "Pricing", "Other"] as const).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    className={feedbackCategory === cat ? "v2-feedback-cat is-selected" : "v2-feedback-cat"}
                    onClick={() => setFeedbackCategory(cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <textarea
                className="v2-feedback-textarea"
                value={feedbackMessage}
                onChange={(e) => setFeedbackMessage(e.target.value.slice(0, 2000))}
                rows={5}
                placeholder="Describe the issue, feature request, or confusion in as much detail as you can. Real specifics help most."
              />
              <div className="v2-feedback-footer">
                <span className={feedbackMessage.length > 1800 ? "v2-feedback-count is-near" : "v2-feedback-count"}>
                  {2000 - feedbackMessage.length}
                </span>
                <button
                  type="button"
                  className="v2-primary-button"
                  disabled={!feedbackMessage.trim() || !feedbackCategory}
                  onClick={submitFeedback}
                >
                  {feedbackSent ? <><Sparkles size={15} /> Sent!</> : "Send feedback"}
                </button>
              </div>
            </div>
          </section>

          <section className="v2-profile-panel v2-feedback-history-panel">
            <header>
              <span>Submission history</span>
              <strong>{feedbackCount > 0 ? `${feedbackCount} note${feedbackCount === 1 ? "" : "s"} on file` : "Nothing submitted yet"}</strong>
            </header>
            <div className="v2-profile-list">
              <article><Sparkles size={16} /><span>Beta feedback shapes future releases</span></article>
              <article><ShieldCheck size={16} /><span>Notes are reviewed by the RIVT team</span></article>
              <article><Mail size={16} /><span>Replies go to {profile.email || "your account email"}</span></article>
            </div>
          </section>
        </div>
      </section>
      </>
    );
  }

  if (view === "Trust & Legal") {
    return (
      <>
        {showOnboarding && (
          <OnboardingOverlay key={onboardingKey} onComplete={() => setShowOnboarding(false)} />
        )}
      <section className="v2-profile-page" aria-label="Trust & Legal">
        <PageHeader
          className="v2-profile-header"
          title="Trust & Legal"
          description="Consent status, your agreements, and data rights."
        />
        <div className="v2-trust-grid">
          <section className="v2-profile-panel v2-trust-status-card">
            <header>
              <span>Consent status</span>
              <strong className={trustReady ? "is-ready" : "is-pending"}>{trustReady ? "Current" : "Action needed"}</strong>
            </header>
            <div className="v2-profile-list">
              <article>
                <ShieldCheck size={16} className={trustReady ? "icon-success" : "icon-warn"} />
                <span>Platform consent {trustReady ? "signed and current" : "not yet reviewed"}</span>
              </article>
              <article>
                <BadgeCheck size={16} />
                <span>Identity readiness: {trustReady ? "ready" : "incomplete"}</span>
              </article>
              <article>
                <CreditCard size={16} />
                <span>Payment method: {trustReady ? "on file" : "not added"}</span>
              </article>
            </div>
            {!trustReady && (
              <div className="v2-trust-action">
                <button type="button" className="v2-primary-button" onClick={onReviewConsent}>
                  <ShieldCheck size={15} />
                  Review consent
                </button>
              </div>
            )}
          </section>

          <section className="v2-profile-panel">
            <header>
              <span>Legal documents</span>
              <strong>Your agreements</strong>
            </header>
            <div className="v2-profile-list">
              <article className="v2-trust-doc-link">
                <FileText size={16} />
                <span>Terms of Service</span>
              </article>
              <article className="v2-trust-doc-link">
                <FileText size={16} />
                <span>Privacy Policy</span>
              </article>
              <article className="v2-trust-doc-link">
                <FileText size={16} />
                <span>Subcontractor Agreement</span>
              </article>
            </div>
          </section>

          <section className="v2-profile-panel v2-profile-panel-wide">
            <header>
              <span>Your data</span>
              <strong>What we store and what you control</strong>
            </header>
            <div className="v2-trust-data-grid">
              <div className="v2-trust-data-item">
                <Mail size={15} />
                <div>
                  <strong>Contact info</strong>
                  <span>Email, phone (if provided), location</span>
                </div>
              </div>
              <div className="v2-trust-data-item">
                <CreditCard size={15} />
                <div>
                  <strong>Work history</strong>
                  <span>Accepted jobs, records, and closeout data</span>
                </div>
              </div>
              <div className="v2-trust-data-item">
                <BadgeCheck size={15} />
                <div>
                  <strong>Safety certifications</strong>
                  <span>Quiz results and earned certificates</span>
                </div>
              </div>
              <div className="v2-trust-data-item">
                <Star size={15} />
                <div>
                  <strong>Reputation signals</strong>
                  <span>Shout-outs, badges, and reviews</span>
                </div>
              </div>
            </div>
            <div className="v2-trust-data-actions">
              <button type="button" className="v2-secondary-button">
                <Download size={15} />
                Request data export
              </button>
              <button type="button" className="v2-secondary-button v2-trust-signout-btn" onClick={onLogout}>
                <LogOut size={15} />
                Sign out
              </button>
            </div>
          </section>
        </div>
      </section>
      </>
    );
  }

  return (
    <>
      {showOnboarding && (
        <OnboardingOverlay key={onboardingKey} onComplete={() => setShowOnboarding(false)} />
      )}
    <section className="v2-profile-page" aria-label={view}>
      <PageHeader
        className="v2-profile-header"
        title={view}
        description={profileViewDescriptions[view] ?? brandConfig.tagline}
      />

      <div className="v2-profile-grid">
        {/* Profile completion + portfolio — Settings only, at the very top */}
        {view === "Settings" ? (
          <div className="v2-profile-panel v2-profile-panel-wide v2-profile-top-cards">
            <ProfileCompletionCard profile={profile} />
            <PortfolioSection />
          </div>
        ) : null}

        <section className="v2-profile-panel v2-profile-summary">
          <Avatar name={profile.displayName || profile.organization || "RIVT member"} size="lg" className="v2-profile-avatar" />
          <div>
            <span>{role === "contractor" ? "Contractor profile" : "Tradesperson profile"}</span>
            <h2>{profile.organization || profile.displayName}</h2>
            <p>{profile.location}</p>
            {persona && (
              <span className="v2-trade-badge">{persona.emoji} {persona.trade}</span>
            )}
            <div className="v2-profile-specialties">
              {profile.specialties.length
                ? profile.specialties.map((specialty) => <span key={specialty}>{specialty}</span>)
                : <span>No specialties added yet</span>}
            </div>
          </div>
        </section>

        <section className="v2-profile-panel">
          <header>
            <span>Account</span>
            <strong>Basics and access</strong>
          </header>
          <div className="v2-profile-facts">
            <MetricTile icon={<Mail size={16} />} value={profile.email || "—"} label="Email" />
            <MetricTile icon={<CreditCard size={16} />} value={profile.plan} label="Plan" />
            <MetricTile icon={<UserCheck size={16} />} value={profile.authMethod} label="Signup method" />
            <MetricTile icon={<BadgeCheck size={16} />} value={trustReady ? "Ready" : "Needs review"} label="Trust" />
          </div>
        </section>

        {/* Profile editor — near top in Settings so it's immediately reachable */}
        {view === "Settings" && canonicalProfile ? (
          <section className="v2-profile-panel v2-profile-panel-wide v2-profile-editor">
            <header>
              <span>Profile details</span>
              <strong>How the network sees you</strong>
            </header>
            <div className="v2-profile-form-grid">
              <label><span>Display name</span><input value={draft.displayName} onChange={(event) => setDraft({ ...draft, displayName: event.target.value })} /></label>
              <label><span>Headline</span><input value={draft.headline} onChange={(event) => setDraft({ ...draft, headline: event.target.value })} placeholder="Commercial electrician available for service work" /></label>
              <label className="is-wide"><span>About</span><textarea value={draft.bio} onChange={(event) => setDraft({ ...draft, bio: event.target.value })} rows={4} placeholder="Experience, specialties, and the kind of work you take." /></label>
              <label><span>Service area city</span><input value={draft.serviceAreaCity} onChange={(event) => setDraft({ ...draft, serviceAreaCity: event.target.value })} /></label>
              <label><span>State or region</span><input value={draft.serviceAreaRegion} onChange={(event) => setDraft({ ...draft, serviceAreaRegion: event.target.value })} /></label>
              <label><span>Service radius</span><select value={draft.serviceRadiusMiles} onChange={(event) => setDraft({ ...draft, serviceRadiusMiles: Number(event.target.value) })}>{[10, 25, 50, 75, 100].map((miles) => <option key={miles} value={miles}>{miles} miles</option>)}</select></label>
              <label><span>Availability</span><select value={draft.availabilityStatus} onChange={(event) => setDraft({ ...draft, availabilityStatus: event.target.value as ProfileUpdateInput["availabilityStatus"] })}><option value="available">Available</option><option value="limited">Limited</option><option value="unavailable">Unavailable</option></select></label>
              <label><span>Phone (optional)</span><input value={draft.phoneE164 ?? ""} onChange={(event) => setDraft({ ...draft, phoneE164: event.target.value || null })} placeholder="+19045551234" /></label>
              <label><span>Contact visibility</span><select value={draft.contactEmailVisibility} onChange={(event) => setDraft({ ...draft, contactEmailVisibility: event.target.value as ProfileUpdateInput["contactEmailVisibility"] })}><option value="private">Private</option><option value="connections">Connections only</option></select></label>
              <label><span>Phone visibility</span><select value={draft.phoneVisibility} onChange={(event) => setDraft({ ...draft, phoneVisibility: event.target.value as ProfileUpdateInput["phoneVisibility"] })}><option value="private">Private</option><option value="connections">Connections only</option></select></label>
            </div>
            <ServiceAreaSelector />
            <div className="v2-profile-trade-picker" aria-label="Trade specialties">
              {tradeOptions.filter((trade) => trade !== "All trades").map((trade) => (
                <button key={trade} type="button" className={draft.specialties.includes(trade as Trade) ? "is-selected" : ""} onClick={() => toggleSpecialty(trade as Trade)}>{trade}</button>
              ))}
            </div>
            <div className="v2-profile-editor-actions">
              <div>
                <strong>{canonicalProfile.emailVerified ? "Email verified" : "Email verification pending"}</strong>
                <span>{canonicalProfile.visibility === "network" ? "Visible to the RIVT network" : "Private until you publish"}</span>
              </div>
              <button type="button" className="v2-secondary-button" onClick={() => setShowPreview(true)}>
                <Eye size={15} /> Preview
              </button>
              <button type="button" className="v2-secondary-button" onClick={() => void runAccountAction(() => onSetProfileVisibility(canonicalProfile.visibility === "network" ? "private" : "network"))}>
                {canonicalProfile.visibility === "network" ? "Make private" : "Publish profile"}
              </button>
              <button type="button" className="v2-primary-button" onClick={() => void saveProfile()} disabled={actionState === "saving" || !draft.displayName.trim() || !draft.specialties.length}>
                {actionState === "saving" ? "Saving..." : "Save profile"}
              </button>
            </div>
            {actionMessage ? <p className={`v2-profile-action-message is-${actionState}`} role="status">{actionMessage}</p> : null}
          </section>
        ) : null}

        <section className="v2-profile-panel">
          <header>
            <span>Themes</span>
            <strong>Tool-inspired appearance</strong>
          </header>
          <div className="v2-profile-theme-row">
            <div className="v2-theme-source-group" role="group" aria-label="Theme mode">
              {(["system", "light", "dark"] as ThemeSource[]).map((src) => {
                const Icon = src === "system" ? Monitor : src === "light" ? Sun : Moon;
                return (
                  <button
                    key={src}
                    type="button"
                    className={themeSource === src ? "v2-theme-source-btn is-active" : "v2-theme-source-btn"}
                    aria-pressed={themeSource === src}
                    onClick={() => onSetThemeSource(src)}
                  >
                    <Icon size={14} />
                    {src.charAt(0).toUpperCase() + src.slice(1)}
                  </button>
                );
              })}
            </div>
            <div className="v2-theme-palettes">
              {themePaletteOrder.map((palette) => (
                <button
                  key={palette}
                  type="button"
                  className={palette === themePalette ? "is-selected" : ""}
                  onClick={() => onSelectThemePalette(palette)}
                  aria-label={`Use ${brandConfig.theme.palettes[palette].label} theme`}
                >
                  <span aria-hidden="true" style={{ background: `linear-gradient(135deg, ${brandConfig.theme.palettes[palette].swatches[0]}, ${brandConfig.theme.palettes[palette].swatches[1]})` }} />
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Trust / Training / Community / Reputation — shown on their own views, not cluttering Settings */}
        {view !== "Settings" ? (
          <>
            <section className="v2-profile-panel">
              <header>
                <span>Trust</span>
                <strong>Readiness and records</strong>
              </header>
              <div className="v2-profile-list">
                <article><ShieldCheck size={16} /><span>Consent {trustReady ? "ready" : "pending"}</span></article>
                <article><CreditCard size={16} /><span>{recordCount} records saved</span></article>
                <article><Sparkles size={16} /><span>{communityBadges.length} community badge{communityBadges.length === 1 ? "" : "s"}</span></article>
              </div>
            </section>

            <section className="v2-profile-panel">
              <header>
                <span>Training</span>
                <strong>Safety and proof</strong>
              </header>
              <div className="v2-profile-list">
                <article><GraduationCap size={16} /><span>{trainingProgress}% complete</span></article>
                <article><BadgeCheck size={16} /><span>{safetyCertCount} safety module{safetyCertCount === 1 ? "" : "s"}</span></article>
                <article><Star size={16} /><span>{shoutOutCount} shout-out{shoutOutCount === 1 ? "" : "s"}</span></article>
              </div>
            </section>

            <section className="v2-profile-panel v2-profile-panel-wide">
              <header>
                <span>Community</span>
                <strong>Profile signals</strong>
              </header>
              <div className="v2-profile-badge-row">
                {communityBadges.length ? communityBadges.map((badge) => <span key={badge}>{badge}</span>) : <span>New contributor</span>}
              </div>
              {feedbackCount > 0 ? (
                <p className="v2-profile-note">{feedbackCount} beta feedback note{feedbackCount === 1 ? "" : "s"}.</p>
              ) : null}
            </section>

            <section className="v2-profile-panel v2-profile-panel-wide v2-profile-reputation">
              <header>
                <span>Reputation momentum</span>
                <strong>Proof that follows the work</strong>
              </header>
              <div className="v2-profile-reputation-grid">
                <article>
                  <Star size={18} />
                  <strong>{shoutOutCount} shout-out{shoutOutCount === 1 ? "" : "s"}</strong>
                  <span>Peer proof</span>
                </article>
                <article>
                  <Sparkles size={18} />
                  <strong>{communityBadges.length || "No"} badge{communityBadges.length === 1 ? "" : "s"}</strong>
                  <span>Community</span>
                </article>
                <article>
                  <CreditCard size={18} />
                  <strong>{recordCount} saved record{recordCount === 1 ? "" : "s"}</strong>
                  <span>Work history</span>
                </article>
              </div>
            </section>
          </>
        ) : null}

        {/* Subscription plan — Settings only */}
        {view === "Settings" ? (
          <section className="v2-profile-panel v2-profile-panel-wide">
            <header>
              <span>Subscription</span>
              <strong>Your current plan</strong>
            </header>
            <PlanCard />
          </section>
        ) : null}

        {/* Notification preferences — Settings only */}
        {view === "Settings" ? (
          <section className="v2-profile-panel v2-profile-panel-wide v2-notification-prefs">
            <header>
              <span>Notifications</span>
              <strong>What alerts you</strong>
            </header>
            <PushNotificationsCard />
            <div className="v2-trade-mode-toggle">
              <div>
                <strong>Trade personalization</strong>
                <p>Tailor the app — job feed, Shop Talk, and tools — to your trade.</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={tradeModeOn}
                className={`v2-toggle-switch${tradeModeOn ? " is-on" : ""}`}
                onClick={toggleTradeMode}
              />
            </div>
            <div className="v2-notif-pref-list">
              {([
                { key: "jobMatches" as const, label: "Job matches", detail: "New jobs that match your trades and service area" },
                { key: "messages" as const, label: "Messages", detail: "New messages on active job threads" },
                { key: "shoutOuts" as const, label: "Shout-outs", detail: "When someone leaves you a review" },
                { key: "safetyUpdates" as const, label: "Safety updates", detail: "OSHA code changes relevant to your trades" },
              ]).map(({ key, label, detail }) => (
                <label key={key} className="v2-notif-pref-row">
                  <div>
                    <strong>{label}</strong>
                    <span>{detail}</span>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={notificationPrefs[key]}
                    className={notificationPrefs[key] ? "v2-notif-toggle is-on" : "v2-notif-toggle"}
                    onClick={() => setNotificationPrefs((prev) => ({ ...prev, [key]: !prev[key] }))}
                  >
                    <span aria-hidden="true" />
                  </button>
                </label>
              ))}
            </div>
          </section>
        ) : null}

        {/* Business Settings — Settings only */}
        {view === "Settings" ? <BusinessSettingsSection /> : null}

        {/* Cert tracker — Settings only */}
        {view === "Settings" ? <CertTrackerSection /> : null}

        {/* Rate card — Settings only, tradesperson-facing */}
        {view === "Settings" ? <RateCardSection /> : null}

        {/* Sessions — Settings only */}
        {view === "Settings" ? (
          <section className="v2-profile-panel v2-profile-panel-wide v2-profile-sessions">
            <header>
              <span>Security</span>
              <strong>Signed-in devices</strong>
            </header>
            <div className="v2-session-list">
              {sessions.length ? sessions.map((session) => (
                <article key={session.id}>
                  <MonitorSmartphone size={18} />
                  <div><strong>{session.deviceLabel}{session.current ? " · This device" : ""}</strong><span>Last active {new Date(session.lastSeenAt).toLocaleString()}</span></div>
                  {!session.current ? <button type="button" className="v2-secondary-button" onClick={() => void runAccountAction(() => onRevokeSession(session.id))}>Sign out</button> : null}
                </article>
              )) : <p className="v2-profile-note">Only this device is signed in.</p>}
            </div>
            {sessions.some((session) => !session.current) ? (
              <button type="button" className="v2-secondary-button v2-revoke-others" onClick={() => void runAccountAction(onRevokeOtherSessions)}>Sign out other devices</button>
            ) : null}
            {actionMessage && !canonicalProfile ? <p className={`v2-profile-action-message is-${actionState}`} role="status">{actionMessage}</p> : null}
          </section>
        ) : null}

        {/* Sign out — at the bottom of Settings so it's available but not the first thing you see */}
        {view === "Settings" ? (
          <section className="v2-profile-panel v2-profile-panel-wide v2-settings-signout-section">
            <div>
              <strong>Sign out</strong>
              <span>You'll be signed out of this session on this device.</span>
            </div>
            <button type="button" className="v2-secondary-button" onClick={onLogout}>
              <LogOut size={16} />
              Sign out
            </button>
          </section>
        ) : null}

        {/* Redo setup — Settings only */}
        {view === "Settings" ? (
          <section className="v2-profile-panel v2-profile-panel-wide v2-settings-signout-section">
            <div>
              <strong>Redo setup</strong>
              <span>Update your trade, rate, and city from the onboarding flow.</span>
            </div>
            <button
              type="button"
              className="v2-secondary-button"
              onClick={() => { setOnboardingKey(k => k + 1); setShowOnboarding(true); }}
            >
              Redo setup
            </button>
          </section>
        ) : null}

        {/* Data export — very last item in Settings */}
        {view === "Settings" ? (
          <section className="v2-profile-panel v2-profile-panel-wide">
            <DataExportButton />
          </section>
        ) : null}
      </div>

      {showPreview && createPortal(
        <div className="v2-profile-preview-backdrop" onClick={() => setShowPreview(false)} role="dialog" aria-modal="true" aria-label="Public profile preview">
          <div className="v2-profile-preview-card" onClick={(e) => e.stopPropagation()}>
            <header className="v2-profile-preview-header">
              <span>Public profile preview</span>
              <button type="button" className="v2-profile-preview-close" onClick={() => setShowPreview(false)} aria-label="Close preview">✕</button>
            </header>
            <div className="v2-profile-preview-hero">
              <Avatar name={profile.displayName || profile.organization || "RIVT member"} size="lg" className="v2-profile-preview-avatar" />
              <div>
                <h2>{profile.displayName || profile.organization}</h2>
                {canonicalProfile?.headline && <p className="v2-profile-preview-headline">{canonicalProfile.headline}</p>}
                <span className="v2-profile-preview-location">{profile.location || canonicalProfile?.serviceAreaCity}</span>
              </div>
            </div>
            {canonicalProfile?.bio && <p className="v2-profile-preview-bio">{canonicalProfile.bio}</p>}
            <div className="v2-profile-preview-stats">
              <div><strong>{shoutOutCount}</strong><span>Shout-outs</span></div>
              <div><strong>{safetyCertCount}</strong><span>Certs</span></div>
              <div><strong>{recordCount}</strong><span>Records</span></div>
            </div>
            {profile.specialties.length ? (
              <div className="v2-profile-preview-trades">
                {profile.specialties.map((t) => <span key={t}>{t}</span>)}
              </div>
            ) : null}
            {communityBadges.length ? (
              <div className="v2-profile-preview-badges">
                {communityBadges.map((b) => <span key={b}>{b}</span>)}
              </div>
            ) : null}
            <p className="v2-profile-preview-note">This is how contractors see your profile when it's published to the RIVT network.</p>
          </div>
        </div>,
        document.body,
      )}
    </section>
    </>
  );
}
