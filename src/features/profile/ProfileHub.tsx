import {
  BadgeCheck,
  CheckCircle,
  CreditCard,
  Download,
  FileText,
  GraduationCap,
  LogOut,
  Mail,
  MonitorSmartphone,
  Moon,
  ShieldCheck,
  Sparkles,
  Star,
  Sun,
  UserCheck,
  XCircle,
} from "lucide-react";
import { createPortal } from "react-dom";
import { useState } from "react";
import { brandConfig, type ThemeMode, type ThemePalette } from "../../brandConfig";
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
  themePalette: ThemePalette;
  onToggleTheme: () => void;
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

const themePaletteOrder = Object.keys(brandConfig.theme.palettes) as ThemePalette[];

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
  themeMode,
  themePalette,
  onToggleTheme,
  onSelectThemePalette,
  onReviewConsent,
  onLogout,
  onSaveProfile,
  onSetProfileVisibility,
  onRevokeSession,
  onRevokeOtherSessions,
  onQuizComplete,
}: ProfileHubProps) {
  const [notificationPrefs, setNotificationPrefs] = useState({
    jobMatches: true,
    messages: true,
    shoutOuts: true,
    safetyUpdates: false,
  });

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
    );
  }

  if (view === "Trust & Legal") {
    return (
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
    );
  }

  return (
    <section className="v2-profile-page" aria-label={view}>
      <PageHeader
        className="v2-profile-header"
        title={view}
        description={profileViewDescriptions[view] ?? brandConfig.tagline}
      />

      <div className="v2-profile-grid">
        <section className="v2-profile-panel v2-profile-summary">
          <Avatar name={profile.displayName || profile.organization || "RIVT member"} size="lg" className="v2-profile-avatar" />
          <div>
            <span>{role === "contractor" ? "Contractor profile" : "Tradesperson profile"}</span>
            <h2>{profile.organization || profile.displayName}</h2>
            <p>{profile.location}</p>
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
            <button type="button" className="v2-theme-toggle" onClick={onToggleTheme}>
              {themeMode === "dark" ? <Moon size={16} /> : <Sun size={16} />}
              {themeMode === "dark" ? "Dark mode" : "Light mode"}
            </button>
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

        {/* Notification preferences — Settings only */}
        {view === "Settings" ? (
          <section className="v2-profile-panel v2-profile-panel-wide v2-notification-prefs">
            <header>
              <span>Notifications</span>
              <strong>What alerts you</strong>
            </header>
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
              )) : <p className="v2-profile-note">No active device sessions were returned.</p>}
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
      </div>
    </section>
  );
}
