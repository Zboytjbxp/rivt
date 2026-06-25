import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Bell,
  BriefcaseBusiness,
  CheckCircle2,
  CreditCard,
  Mail,
  MapPin,
  MessageCircle,
  Monitor,
  Moon,
  ReceiptText,
  ShieldCheck,
  Sun,
  Users,
  X,
} from "lucide-react";
import { brandConfig, type ThemeMode, type TrialPlan } from "../../brandConfig";
import type { ThemeSource } from "../../app-shell/useAppTheme";
import { tradeOptions } from "../../data";
import { apiPath } from "../../lib/api";
import type { Role, Trade } from "../../types";

export type AuthMethod = "Google" | "Facebook" | "Apple" | "Email";

export interface OnboardingResult {
  role: Role;
  serviceAreaCity: string;
  serviceAreaRegion: string;
  serviceRadiusMiles: number;
  email: string;
  displayName: string;
  organization: string;
  location: string;
  specialties: Trade[];
  plan: TrialPlan;
  authMethod: AuthMethod;
}

type ProviderStatus = Record<string, { ok: boolean; mode: string; missing: string[]; purpose: string }>;

const specialtyOptions = tradeOptions.filter(
  (option): option is Trade => option !== "All trades",
);

export function LaunchLoader() {
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <LogoLockup />
        <p>Preparing your workspace...</p>
      </section>
    </main>
  );
}

export function AuthLinkFlow({ mode }: { mode: "verify" | "reset" }) {
  const token = new URLSearchParams(window.location.search).get("token") ?? "";
  const started = useRef(false);
  const [status, setStatus] = useState<"idle" | "working" | "success" | "error">(mode === "verify" ? (token ? "working" : "error") : "idle");
  const [message, setMessage] = useState(mode === "verify"
    ? token ? "Verifying your email..." : "This verification link is incomplete. Request a new link from sign in."
    : "Choose a new password for your RIVT account.");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (mode !== "verify" || started.current) return;
    started.current = true;
    if (!token) return;
    void fetch(apiPath("/api/v1/auth/email/verify"), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    }).then(async (response) => {
      const body = await response.json().catch(() => ({})) as { error?: { message?: string } };
      if (!response.ok) throw new Error(body.error?.message || "Email verification failed.");
      setStatus("success");
      setMessage("Your email is verified. You can finish setting up your RIVT profile.");
    }).catch((error) => {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Email verification failed.");
    });
  }, [mode, token]);

  async function resetPassword() {
    if (!token) {
      setStatus("error");
      setMessage("This reset link is incomplete. Request a new one from sign in.");
      return;
    }
    setStatus("working");
    try {
      const response = await fetch(apiPath("/api/v1/auth/password/reset"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const body = await response.json().catch(() => ({})) as { error?: { message?: string } };
      if (!response.ok) throw new Error(body.error?.message || "Password reset failed.");
      setStatus("success");
      setMessage("Your password has been changed. Sign in again on your devices.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Password reset failed.");
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card auth-link-card">
        <LogoLockup />
        <div className="auth-link-status" data-status={status}>
          {status === "success" ? <CheckCircle2 size={24} /> : status === "error" ? <AlertTriangle size={24} /> : <Mail size={24} />}
          <div>
            <span>{mode === "verify" ? "Email verification" : "Account recovery"}</span>
            <h2>{status === "success" ? "All set" : mode === "verify" ? "Checking your link" : "Reset password"}</h2>
            <p>{message}</p>
          </div>
        </div>
        {mode === "reset" && status !== "success" ? (
          <label className="auth-link-password">
            <span>New password</span>
            <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="new-password" />
            <small>8+ characters with uppercase, lowercase, a number, and a symbol.</small>
          </label>
        ) : null}
        {mode === "reset" && status !== "success" ? (
          <button type="button" className="primary-action" onClick={resetPassword} disabled={status === "working" || !password}>
            {status === "working" ? "Updating..." : "Update password"}
          </button>
        ) : (
          <button type="button" className="primary-action" onClick={() => window.location.assign("/")} disabled={status === "working"}>
            Continue to RIVT
          </button>
        )}
      </section>
    </main>
  );
}

function EntryShowcase() {
  const pillars = [
    { icon: BriefcaseBusiness, title: "Find work", copy: "See the jobs, scope, and timing before you commit." },
    { icon: Users, title: "Build crews", copy: "Keep trusted people and applicants in one place." },
    { icon: ReceiptText, title: "Run records", copy: "Invoices, completion photos, and payment notes stay together." },
    { icon: MessageCircle, title: "Stay in touch", copy: "Message crews and ask field questions without the clutter." },
  ];

  return (
    <section className="auth-story" aria-label="Product preview">
      <div className="auth-story-header">
        <span className="auth-story-eyebrow">Jacksonville launch</span>
        <h1>The professional network for skilled trades.</h1>
        <p>
          RIVT keeps jobs, crews, tools, invoices, and records in one place so contractors and tradespeople can move faster.
        </p>
      </div>

      <div className="auth-story-pills" aria-label="Core benefits">
        <span>Post work</span>
        <span>Build crews</span>
        <span>Track records</span>
        <span>Message on the job</span>
      </div>

      <div className="auth-story-grid">
        {pillars.map(({ icon: Icon, title, copy }) => (
          <article key={title} className="auth-story-card">
            <span className="auth-story-icon">
              <Icon size={17} />
            </span>
            <div>
              <strong>{title}</strong>
              <p>{copy}</p>
            </div>
          </article>
        ))}
      </div>

      <div className="auth-story-preview">
        <article>
          <span>Work feed</span>
          <strong>Jobs, match score, and active status</strong>
          <p>Open work stays visible while applicants, invites, and closeouts stay tied to the same record.</p>
        </article>
        <article>
          <span>Tools</span>
          <strong>Invoice, estimate, and record tools</strong>
          <p>Utilities stay ready without forcing the user into a separate admin surface.</p>
        </article>
      </div>
    </section>
  );
}

export function AuthGate({
  mode,
  error,
  notice,
  providers,
  inviteRequired,
  onModeChange,
  onSubmit,
  onForgotPassword,
}: {
  mode: "login" | "signup";
  error: string | null;
  notice: string | null;
  providers: ProviderStatus;
  inviteRequired: boolean;
  onModeChange: (mode: "login" | "signup") => void;
  onSubmit: (form: { email: string; password: string; displayName?: string; role?: Role; inviteCode?: string }) => void;
  onForgotPassword: (email: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<Role>("contractor");
  const [inviteCode, setInviteCode] = useState("");
  const emailInputRef = useRef<HTMLInputElement>(null);

  return (
    <main className="auth-shell auth-shell--split">
      <EntryShowcase />

      <form
        className="auth-card auth-card--entry"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit({ email, password, displayName, role, inviteCode: inviteCode.trim() || undefined });
        }}
      >
        <LogoLockup />
        <div className="auth-card-heading">
          <span className="auth-card-kicker">{mode === "signup" ? "Start free" : "Welcome back"}</span>
          <h2>{mode === "signup" ? "Create your account" : "Sign in to continue"}</h2>
          <p>Use the same workspace to manage jobs, crews, tools, and records.</p>
        </div>

        <div className="auth-provider-grid">
          {([["google", GoogleIcon, "Continue with Google"], ["email", EmailIcon, "Use email"]] as const).map(([key, label, providerLabel]) => {
            const provider = providers[key];
            const ok = provider?.ok ?? (key === "email");
            const Icon = label;

            return (
              <button
                type="button"
                key={key}
                className={ok ? "auth-provider-tile" : "auth-provider-tile disabled"}
                title={ok ? provider?.purpose ?? key : "Temporarily unavailable"}
                onClick={() => {
                  if (!ok) return;
                  if (key === "google") {
                    window.location.assign(apiPath("/api/auth/google/start"));
                    return;
                  }
                  if (key === "email") {
                    onModeChange(mode);
                    window.requestAnimationFrame(() => emailInputRef.current?.focus());
                  }
                }}
              >
                <Icon />
                <span>{providerLabel}</span>
              </button>
            );
          })}
        </div>

        <div className="auth-toggle" aria-label="Auth mode">
          <button type="button" className={mode === "login" ? "selected" : ""} onClick={() => onModeChange("login")}>Log in</button>
          <button type="button" className={mode === "signup" ? "selected" : ""} onClick={() => onModeChange("signup")}>Sign up</button>
        </div>

        <div className="auth-form-grid">
          {mode === "signup" ? (
            <fieldset className="auth-role-choice">
              <legend>Account type</legend>
              <div className="auth-toggle role-toggle" aria-label="Choose account type">
                <button type="button" className={role === "contractor" ? "selected" : ""} aria-pressed={role === "contractor"} onClick={() => setRole("contractor")}>Contractor</button>
                <button type="button" className={role === "tradesperson" ? "selected" : ""} aria-pressed={role === "tradesperson"} onClick={() => setRole("tradesperson")}>Tradesperson</button>
              </div>
              <small>This choice is permanent after signup.</small>
            </fieldset>
          ) : null}
          <label>
            <span>Email</span>
            <input ref={emailInputRef} value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" required />
          </label>
          <label>
            <span>Password</span>
            <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} required />
            {mode === "signup" ? <small>8+ characters with uppercase, lowercase, a number, and a symbol.</small> : null}
          </label>
          {mode === "signup" && (
            <>
              <label>
                <span>Name</span>
                <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="name" required />
              </label>
              {inviteRequired ? (
                <label>
                  <span>Pilot invitation code <em className="required-label">Required</em></span>
                  <input value={inviteCode} onChange={(event) => setInviteCode(event.target.value)} autoComplete="one-time-code" spellCheck={false} required />
                  <small>RIVT is invite-only during the pilot so early users stay supported.</small>
                </label>
              ) : null}
              <div className="role-locked-note">
                <strong>{role === "contractor" ? "Contractor role" : "Tradesperson role"}</strong>
                <span>Chosen at signup and kept consistent across the app.</span>
              </div>
            </>
          )}
        </div>

        {notice ? <p className="auth-notice" role="status">{notice}</p> : null}
        {error ? <p className="auth-error">{error}</p> : null}

        {mode === "login" ? (
          <button type="button" className="auth-link-action" onClick={() => onForgotPassword(email)} disabled={!email.trim()}>
            Forgot password?
          </button>
        ) : null}

        <button
          type="submit"
          className="primary-action"
        >
          {mode === "signup" ? "Create account" : "Log in"}
        </button>
      </form>
    </main>
  );
}

export function GuestBanner({
  onSignUp,
  onExit,
}: {
  onSignUp: () => void;
  onExit: () => void;
}) {
  return (
    <div className="guest-banner" role="status">
      <span>Guest mode. Sign up to apply, post jobs, and message crews.</span>
      <div className="guest-banner-actions">
        <button type="button" className="primary-action" onClick={onSignUp}>
          Sign up
        </button>
        <button type="button" className="ghost-action guest-exit" onClick={onExit}>
          Exit
        </button>
      </div>
    </div>
  );
}

export function GuestSignUpPrompt({
  onClose,
  onSignUp,
}: {
  onClose: () => void;
  onSignUp: () => void;
}) {
  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="guest-prompt">
        <button type="button" className="icon-button guest-prompt-close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>
        <h2>Sign up to take action</h2>
        <p>Create a free account to apply for jobs, post work, send messages, and build your RIVT profile.</p>
        <button type="button" className="primary-action" onClick={onSignUp}>
          Create free account
        </button>
        <button type="button" className="secondary-action" onClick={onClose}>
          Keep browsing
        </button>
      </div>
    </div>
  );
}

function LogoLockup() {
  return (
    <div className="rivt-lockup" aria-label="RIVT">
      <picture className="rivt-wordmark" aria-hidden="true">
        <source srcSet="/brand/rivt-lockup-light-transparent.png" media="(prefers-color-scheme: light)" />
        <img src="/brand/rivt-lockup-dark-transparent.png" alt="" />
      </picture>
      <div className="rivt-copy">
        <span>{brandConfig.tagline}</span>
      </div>
    </div>
  );
}

function RivtMark() {
  return (
    <img src="/brand/rivt-mark-mobile.png" alt="" aria-hidden="true" />
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M12 3a9 9 0 1 0 0 18c2.6 0 4.8-0.9 6.4-2.4l-2.9-2.3A5.4 5.4 0 0 1 12 17.4a5.4 5.4 0 0 1 0-10.8c1.4 0 2.6.5 3.5 1.3l2.6-2.6C16.6 3.9 14.5 3 12 3Z" />
      <path fill="#34A853" d="M21 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.1c-.2 1-.8 1.9-1.6 2.5l2.8 2.2C19.9 16.9 21 14.8 21 12.2Z" />
      <path fill="#FBBC05" d="M5.5 14.1A5.4 5.4 0 0 1 5.2 12c0-.7.1-1.4.3-2.1L2.6 7.7A9 9 0 0 0 3 16.6l2.5-2.5Z" />
      <path fill="#EA4335" d="M12 21a9 9 0 0 0 6.4-2.4l-2.8-2.2c-.8.5-1.8.8-3.1.8-2.6 0-4.8-1.7-5.6-4.1L4.4 15.6A9 9 0 0 0 12 21Z" />
    </svg>
  );
}

function EmailIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="6" width="16" height="12" rx="2.5" fill="currentColor" opacity="0.18" />
      <path fill="currentColor" d="M5.5 7.5h13l-6.5 5.4-6.5-5.4Zm-1.5 1.3v7.7h16V8.8l-7.9 6.5a1 1 0 0 1-1.3 0L4 8.8Z" />
    </svg>
  );
}

export function OnboardingFlow({
  themeMode,
  onToggleTheme,
  onComplete,
  onResendVerification,
  initialRole,
  initialEmail,
  initialDisplayName,
  initialOrganization,
  initialLocation,
  initialSpecialties,
  initialAuthMethod,
  emailVerified,
  notice,
  error,
}: {
  themeMode: ThemeMode;
  onToggleTheme: () => void;
  onComplete: (result: OnboardingResult) => void;
  onResendVerification: () => void;
  initialRole: Role | "pending";
  initialEmail: string;
  initialDisplayName: string;
  initialOrganization: string;
  initialLocation: string;
  initialSpecialties: Trade[];
  initialAuthMethod: AuthMethod;
  emailVerified: boolean;
  notice?: string | null;
  error?: string | null;
}) {
  const [role, setRole] = useState<Role>(initialRole === "pending" ? "contractor" : initialRole);
  const roleLocked = initialRole !== "pending";
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [organization, setOrganization] = useState(initialOrganization);
  const [initialCity = "Jacksonville", initialRegion = "FL"] = initialLocation.split(",").map((part) => part.trim());
  const [serviceAreaCity, setServiceAreaCity] = useState(initialCity || "Jacksonville");
  const [serviceAreaRegion, setServiceAreaRegion] = useState(initialRegion || "FL");
  const [serviceRadiusMiles, setServiceRadiusMiles] = useState(25);
  const [specialties, setSpecialties] = useState<Trade[]>(
    initialSpecialties.length ? initialSpecialties : ["Electrical", "Carpentry"],
  );
  const [showAllSpecialties, setShowAllSpecialties] = useState(false);
  const [legalConsent, setLegalConsent] = useState(false);
  const plan: TrialPlan = brandConfig.pricing.betaPlan.label;

  const accountReady = Boolean(displayName.trim()) && Boolean(serviceAreaCity.trim()) && Boolean(serviceAreaRegion.trim());
  const profileReady = specialties.length > 0;
  const legalReady = legalConsent;
  const completionChecks = [
    Boolean(role),
    emailVerified,
    accountReady,
    profileReady,
    legalReady,
  ];
  const completion = Math.round(
    (completionChecks.filter(Boolean).length / completionChecks.length) * 100,
  );
  const canEnter = emailVerified && accountReady && profileReady && legalReady;
  const roleNoun = role === "contractor" ? "Contractor" : "Tradesperson";
  const specialtyHeading =
    role === "contractor" ? "Trades you hire for" : "Your trade specialties";
  const specialtyHelp =
    role === "contractor"
      ? "These defaults speed up job posting and crew invites."
      : "Your first specialty becomes the default job feed filter.";
  const specialtyOptionsToShow = showAllSpecialties ? specialtyOptions : specialtyOptions.slice(0, 12);

  function toggleSpecialty(option: Trade) {
    setSpecialties((current) => {
      if (current.includes(option)) {
        return current.filter((item) => item !== option);
      }

      return [...current, option];
    });
  }

  function submit() {
    if (!canEnter) {
      return;
    }

    onComplete({
      role,
      authMethod: initialAuthMethod,
      email: initialEmail,
      displayName: displayName.trim(),
      organization:
        role === "contractor"
          ? organization.trim() || `${displayName.trim()} crew`
          : `${displayName.trim()} portfolio`,
      location: `${serviceAreaCity.trim()}, ${serviceAreaRegion.trim()}`,
      serviceAreaCity: serviceAreaCity.trim(),
      serviceAreaRegion: serviceAreaRegion.trim(),
      serviceRadiusMiles,
      specialties,
      plan,
    });
  }

  return (
    <main className="onboarding-shell">
      <section className="onboarding-layout" aria-label={`${brandConfig.appName} onboarding`}>
        <aside className="onboarding-rail">
          <div className="onboarding-brand-row">
            <div className="brand-lockup onboarding-brand">
              <div className="brand-mark">
                <RivtMark />
              </div>
              <div>
                <strong>{brandConfig.appName}</strong>
                <span>{brandConfig.tagline}</span>
              </div>
            </div>
            <ThemeToggle themeMode={themeMode} onToggleTheme={onToggleTheme} />
          </div>

          <div className="onboarding-hero-copy">
            <span>{brandConfig.betaLabel}</span>
            <h1>{brandConfig.heroHeadline}</h1>
            <p>{brandConfig.heroBody}</p>
          </div>

          <div className="onboarding-proof-grid" aria-label="Platform guardrails">
            <div>
              <ShieldCheck size={17} />
              <strong>{brandConfig.legal.trustCardTitle}</strong>
              <span>Consent now. ID before posting or accepting real work.</span>
            </div>
            <div>
              <CreditCard size={17} />
              <strong>{brandConfig.pricing.betaPlan.label}</strong>
              <span>No lead fees, no payment cut, no card while we build density</span>
            </div>
            <div>
              <MapPin size={17} />
              <strong>Private address</strong>
              <span>City/state only until both confirm</span>
            </div>
          </div>
        </aside>

        <section className="onboarding-panel">
          <div className="onboarding-panel-header">
            <div>
              <span>Account setup</span>
              <h2>{completion}% ready</h2>
            </div>
            <div>
              <span>{plan}</span>
              <ProgressBar value={completion} />
            </div>
          </div>

          <section className="onboarding-section" aria-label="Account role">
            <div className="onboarding-section-heading">
              <span>Step 1</span>
              <h3>Choose your account type</h3>
            </div>
            {roleLocked ? (
              <div className="role-locked-note">
                <strong>{role === "contractor" ? "Contractor" : "Tradesperson"}</strong>
                <span>This role was selected at signup and cannot be changed.</span>
              </div>
            ) : (
              <div className="auth-toggle role-toggle" aria-label="Choose account type">
                <button type="button" className={role === "contractor" ? "selected" : ""} aria-pressed={role === "contractor"} onClick={() => setRole("contractor")}>Contractor</button>
                <button type="button" className={role === "tradesperson" ? "selected" : ""} aria-pressed={role === "tradesperson"} onClick={() => setRole("tradesperson")}>Tradesperson</button>
              </div>
            )}
          </section>

          <section className="onboarding-section" aria-label="Profile basics">
            <div className="onboarding-section-heading">
              <span>Step 2</span>
              <h3>{roleNoun} profile</h3>
            </div>
            <div className="onboarding-form-grid">
              <label>
                <span>{role === "contractor" ? "Owner name" : "Full name"}</span>
                <input
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="Name shown to matches"
                />
              </label>
              <label>
                <span>Email</span>
                <input
                  value={initialEmail}
                  type="email"
                  readOnly
                />
                <small>{emailVerified ? "Verified email" : "Verification required before you can finish."}</small>
              </label>
              <label>
                <span>{role === "contractor" ? "Business or crew name" : "Portfolio name"}</span>
                <input
                  value={organization}
                  onChange={(event) => setOrganization(event.target.value)}
                  placeholder={
                    role === "contractor"
                      ? "Optional company or crew name"
                      : "Optional profile label"
                  }
                />
              </label>
              <label>
                <span>Service area city</span>
                <input
                  value={serviceAreaCity}
                  onChange={(event) => setServiceAreaCity(event.target.value)}
                  placeholder="Jacksonville"
                />
              </label>
              <label>
                <span>State or region</span>
                <input value={serviceAreaRegion} onChange={(event) => setServiceAreaRegion(event.target.value)} placeholder="FL" />
              </label>
              <label>
                <span>Service radius</span>
                <select value={serviceRadiusMiles} onChange={(event) => setServiceRadiusMiles(Number(event.target.value))}>
                  {[10, 25, 50, 75, 100].map((miles) => <option key={miles} value={miles}>{miles} miles</option>)}
                </select>
              </label>
            </div>
            {!emailVerified ? (
              <div className="onboarding-verification" role="status">
                <Mail size={18} />
                <div><strong>Verify your email</strong><span>Open the secure link we sent to {initialEmail}.</span></div>
                <button type="button" className="secondary-action" onClick={onResendVerification}>Resend</button>
              </div>
            ) : null}
          </section>

          <section className="onboarding-section" aria-label="Trade specialties">
            <div className="onboarding-section-heading">
              <span>Step 3</span>
              <h3>{specialtyHeading}</h3>
              <p>{specialtyHelp}</p>
            </div>
            <div className="specialty-picker">
              {specialtyOptionsToShow.map((option) => (
                <button
                  type="button"
                  key={option}
                  className={specialties.includes(option) ? "selected" : ""}
                  onClick={() => toggleSpecialty(option)}
                >
                  {option}
                </button>
              ))}
              {specialtyOptions.length > specialtyOptionsToShow.length && (
                <button
                  type="button"
                  className="specialty-expander"
                  onClick={() => setShowAllSpecialties(true)}
                >
                  Show all {specialtyOptions.length} trades
                </button>
              )}
              {showAllSpecialties && specialtyOptions.length > 12 && (
                <button
                  type="button"
                  className="specialty-expander secondary"
                  onClick={() => setShowAllSpecialties(false)}
                >
                  Show fewer trades
                </button>
              )}
            </div>
          </section>

          <section className="onboarding-section onboarding-trust-section" aria-label="Trust setup">
            <div className="onboarding-section-heading">
              <span>Step 4</span>
              <h3>Consent agreement</h3>
              <p>{brandConfig.legal.trustCardBody}</p>
            </div>
            <div className="trust-check-grid trust-readiness-grid">
              <label>
                <input
                  type="checkbox"
                  checked={legalConsent}
                  onChange={(event) => setLegalConsent(event.target.checked)}
                />
                <span>{brandConfig.legal.consentLabel}</span>
              </label>
              <div className="readiness-note">
                <ShieldCheck size={16} />
                <span>{brandConfig.legal.idGateLabel}</span>
              </div>
              <div className="readiness-note">
                <Bell size={16} />
                <span>{emailVerified ? "Email verified" : "Email verification pending"}</span>
              </div>
            </div>
          </section>

          <div className="onboarding-actions">
            <div>
              <strong>{canEnter ? `Ready to enter ${brandConfig.appName}` : "Finish the basics"}</strong>
              <span>
                {canEnter
                  ? "Your verified account, role, profile, and consent are ready."
                  : "Verify your email, finish your service area, select a trade, and accept the agreement."}
              </span>
              {notice ? <span className="auth-notice" role="status">{notice}</span> : null}
              {error ? <span className="auth-error" role="alert">{error}</span> : null}
            </div>
            <button
              type="button"
              className="primary-action"
              onClick={submit}
              disabled={!canEnter}
            >
              <BadgeCheck size={18} />
              Enter network
            </button>
          </div>
        </section>
      </section>
    </main>
  );
}

const THEME_SOURCE_ICONS: Record<ThemeSource, typeof Monitor> = {
  system: Monitor,
  light: Sun,
  dark: Moon,
};

export function ThemeToggle({
  themeMode,
  themeSource,
  onToggleTheme,
  onSetThemeSource,
  variant = "nav",
  compact = false,
}: {
  themeMode: ThemeMode;
  themeSource?: ThemeSource;
  onToggleTheme: () => void;
  onSetThemeSource?: (source: ThemeSource) => void;
  variant?: "nav" | "surface";
  compact?: boolean;
}) {
  if (onSetThemeSource && variant === "surface") {
    return (
      <div className="theme-source-group" role="group" aria-label="Theme mode">
        {(["system", "light", "dark"] as ThemeSource[]).map((src) => {
          const Icon = THEME_SOURCE_ICONS[src];
          return (
            <button
              key={src}
              type="button"
              className={themeSource === src ? "theme-source-btn is-active" : "theme-source-btn"}
              aria-pressed={themeSource === src}
              onClick={() => onSetThemeSource(src)}
            >
              <Icon size={14} />
              {!compact && <span>{src.charAt(0).toUpperCase() + src.slice(1)}</span>}
            </button>
          );
        })}
      </div>
    );
  }

  const isDark = themeMode === "dark";
  const Icon = isDark ? Sun : Moon;
  const label = isDark ? "Light mode" : "Dark mode";

  return (
    <button
      type="button"
      className={[
        variant === "surface" ? "theme-toggle surface-toggle" : "theme-toggle",
        compact ? "compact" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={`Switch to ${label.toLowerCase()}`}
      aria-pressed={isDark}
      title={`Switch to ${label}`}
      onClick={onToggleTheme}
    >
      <Icon size={16} />
      {!compact && <span>{label}</span>}
    </button>
  );
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <div
      className="progress-bar"
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${value}% complete`}
    >
      <span style={{ width: `${Math.min(value, 100)}%` }} />
    </div>
  );
}
