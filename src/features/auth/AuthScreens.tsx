import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Bell,
  BriefcaseBusiness,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  Mail,
  MapPin,
  MessageCircle,
  Monitor,
  Moon,
  Search,
  ShieldCheck,
  Users,
  Wrench,
  Sun,
  X,
} from "lucide-react";
import { brandConfig, type ThemeMode, type TrialPlan } from "../../brandConfig";
import type { ThemeSource } from "../../app-shell/useAppTheme";
import { tradeOptions } from "../../data";
import { apiPath } from "../../lib/api";
import { tradeCodeByName } from "../work/work-mappings";
import type { Role, Trade } from "../../types";

export type AuthMethod = "Google" | "Facebook" | "Apple" | "Email";

export interface OnboardingResult {
  role: Role;
  goal: OnboardingGoal;
  topicInterests: OnboardingTopic[];
  preferredStartView: OnboardingStartView;
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
export const GUEST_PREVIEW_PREFS_KEY = "rivt.guestPreview.v1";
export interface GuestPreviewPreferences {
  trade: Trade;
  location: string;
  role: Role;
}
export type OnboardingStartView = "home" | "work" | "crew" | "shop-talk" | "tools" | "profile";
export type OnboardingGoal =
  | "contractor_find_help"
  | "contractor_build_crew"
  | "contractor_network"
  | "contractor_tools"
  | "tradesperson_find_work"
  | "tradesperson_build_profile"
  | "tradesperson_trade_talk"
  | "tradesperson_connect";
export type OnboardingTopic =
  | "Local jobs"
  | "Code questions"
  | "Tools"
  | "Business/pricing"
  | "Safety"
  | "Project photos";

const specialtyOptions = tradeOptions.filter(
  (option): option is Trade => option !== "All trades",
);

const ONBOARDING_DRAFT_KEY = "rivt.onboardingDraft.v1";

interface OnboardingDraft {
  email: string;
  role: Role;
  goal: OnboardingGoal;
  displayName: string;
  organization: string;
  serviceAreaCity: string;
  serviceAreaRegion: string;
  serviceRadiusMiles: number;
  specialties: Trade[];
  topicInterests: OnboardingTopic[];
  legalConsent: boolean;
  stepIndex: number;
}

function readOnboardingDraft(email: string): OnboardingDraft | null {
  if (!email) return null;
  try {
    const parsed = JSON.parse(localStorage.getItem(ONBOARDING_DRAFT_KEY) ?? "null") as Partial<OnboardingDraft> | null;
    if (!parsed || parsed.email !== email) return null;
    return {
      email,
      role: parsed.role === "tradesperson" ? "tradesperson" : "contractor",
      goal: parsed.goal ?? defaultGoalForRole(parsed.role === "tradesperson" ? "tradesperson" : "contractor"),
      displayName: parsed.displayName ?? "",
      organization: parsed.organization ?? "",
      serviceAreaCity: parsed.serviceAreaCity ?? "Jacksonville",
      serviceAreaRegion: parsed.serviceAreaRegion ?? "FL",
      serviceRadiusMiles: Number(parsed.serviceRadiusMiles ?? 25),
      specialties: Array.isArray(parsed.specialties) ? parsed.specialties.filter((item): item is Trade => specialtyOptions.includes(item as Trade)) : [],
      topicInterests: Array.isArray(parsed.topicInterests) ? parsed.topicInterests.filter((item): item is OnboardingTopic => onboardingTopics.includes(item as OnboardingTopic)) : [],
      legalConsent: Boolean(parsed.legalConsent),
      stepIndex: Number.isFinite(parsed.stepIndex) ? Number(parsed.stepIndex) : 0,
    };
  } catch {
    return null;
  }
}

function writeOnboardingDraft(draft: OnboardingDraft) {
  try {
    localStorage.setItem(ONBOARDING_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Browser storage may be unavailable; server-backed completion still owns the final state.
  }
}

const entryCapabilities = [
  {
    key: "talk",
    title: "Ask the trades",
    body: "Get answers from people who have actually done the work.",
    icon: MessageCircle,
  },
  {
    key: "work",
    title: "Find work or help",
    body: "Post jobs, apply for openings, and keep the address private until accepted.",
    icon: BriefcaseBusiness,
  },
  {
    key: "crew",
    title: "Build your crew",
    body: "Follow contractors, subs, and specialty crews you would call again.",
    icon: Users,
  },
  {
    key: "tools",
    title: "Run the job",
    body: "Use calculator, invoices, daily logs, records, and job photos from one place.",
    icon: Wrench,
  },
] as const;

const onboardingTopics: OnboardingTopic[] = [
  "Local jobs",
  "Code questions",
  "Tools",
  "Business/pricing",
  "Safety",
  "Project photos",
];

const entrySlides = [
  {
    kicker: "Trades only",
    title: "Contractors and subs in one place.",
    body: "A trades-only network for real work: jobs, crews, local communities, messages, records, and tools connected to the job.",
    search: "Jacksonville carpenter available this week",
    action: "Search",
    posts: [
      { community: "Jacksonville Trades", title: "Cabinet installer needed this week", meta: "$28-$35/hr - tools required" },
      { community: "Crew Leads", title: "Finish carpenter available Friday", meta: "Portfolio ready - message first" },
      { community: "Carpentry Talk", title: "How are you pricing punch-out work?", meta: "Local answers - saved fixes" },
    ],
  },
  {
    kicker: "Active work",
    title: "One workspace for every job.",
    body: "Once an offer is accepted, messages, photos, daily logs, invoices, schedule changes, and closeout proof stay attached to the job.",
    search: "Cabinet installation - active",
    action: "Open",
    cards: [
      { community: "Messages", title: "Confirm start time and site access", meta: "Job thread - exact record" },
      { community: "Photos", title: "Upload progress and closeout proof", meta: "Cloud saved - job scoped" },
      { community: "Daily log", title: "Track labor, blockers, and notes", meta: "Private record - exportable" },
    ],
    posts: [
      { community: "Jacksonville Trades", title: "Finish carpenter needed for built-ins", meta: "$28-$35/hr · tools required" },
      { community: "Side Work", title: "Cabinet helper for two-day install", meta: "Jacksonville Beach · insured preferred" },
      { community: "Crew Leads", title: "Tile setter available this week", meta: "Portfolio ready · message first" },
    ],
  },
  {
    kicker: "Shop Talk",
    title: "Communities that know the work.",
    body: "Create or join trade and local communities. Ask with photos, answer from experience, and mark the fix that actually solved it.",
    search: "Best way to scribe cabinets to stone?",
    action: "Ask",
    cards: [
      { community: "Carpentry Talk", title: "Best way to scribe cabinets to stone?", meta: "4 answers - verified fix" },
      { community: "Electrical Talk", title: "Panel swap pricing when the meter can stay?", meta: "Local pricing - saved" },
      { community: "Jacksonville Trades", title: "Who is free for punch-out work Friday?", meta: "Public community - local" },
    ],
    posts: [
      { community: "Calculator", title: "Fraction math that fits the field", meta: "Sixteenths · feet/inches · quick copy" },
      { community: "Invoice", title: "Draft a clean invoice before you leave", meta: "Email-ready · job-backed records" },
      { community: "Daily log", title: "Photos, notes, and closeout proof", meta: "Private records · exportable" },
    ],
  },
] as const;

const previewTradeOptions: Trade[] = [
  "Carpentry",
  "Electrical",
  "Plumbing",
  "HVAC",
  "Tile",
  "Cabinetry",
  "Framing",
  "Roofing",
  "Painting/Finishing",
  "General Labor",
];

function saveGuestPreviewPreferences(preferences: GuestPreviewPreferences) {
  try {
    localStorage.setItem(GUEST_PREVIEW_PREFS_KEY, JSON.stringify(preferences));
  } catch {
    // Storage can be unavailable in private browsing. The preview still opens with defaults.
  }
}

const contractorGoals = [
  {
    id: "contractor_find_help",
    label: "Find help for a job",
    body: "Post work, review applicants, and move the right person into an active job thread.",
    startView: "work",
    icon: BriefcaseBusiness,
  },
  {
    id: "contractor_build_crew",
    label: "Build a bench of subs",
    body: "Find tradespeople you can trust before the next rush hits.",
    startView: "crew",
    icon: Users,
  },
  {
    id: "contractor_network",
    label: "Stay connected locally",
    body: "Follow local Shop Talk, see who is active, and keep your name visible.",
    startView: "shop-talk",
    icon: MessageCircle,
  },
  {
    id: "contractor_tools",
    label: "Use tools and records",
    body: "Start with calculator, invoice drafts, daily logs, and job photos.",
    startView: "tools",
    icon: ClipboardList,
  },
] satisfies Array<{
  id: OnboardingGoal;
  label: string;
  body: string;
  startView: OnboardingStartView;
  icon: typeof BriefcaseBusiness;
}>;

const tradespersonGoals = [
  {
    id: "tradesperson_find_work",
    label: "Find side work",
    body: "See matching jobs near your trade and save the ones worth chasing.",
    startView: "work",
    icon: BriefcaseBusiness,
  },
  {
    id: "tradesperson_build_profile",
    label: "Build my profile",
    body: "Show specialties, photos, safety badges, availability, and proof.",
    startView: "profile",
    icon: BadgeCheck,
  },
  {
    id: "tradesperson_trade_talk",
    label: "Answer and learn",
    body: "Join Shop Talk, ask questions, answer fixes, and build reputation.",
    startView: "shop-talk",
    icon: MessageCircle,
  },
  {
    id: "tradesperson_connect",
    label: "Connect with contractors",
    body: "Find crews, message people, and stay visible even between jobs.",
    startView: "crew",
    icon: Users,
  },
] satisfies Array<{
  id: OnboardingGoal;
  label: string;
  body: string;
  startView: OnboardingStartView;
  icon: typeof BriefcaseBusiness;
}>;

function goalsForRole(role: Role) {
  return role === "contractor" ? contractorGoals : tradespersonGoals;
}

function defaultGoalForRole(role: Role): OnboardingGoal {
  return role === "contractor" ? "contractor_find_help" : "tradesperson_find_work";
}

function startViewForGoal(goal: OnboardingGoal): OnboardingStartView {
  const match = [...contractorGoals, ...tradespersonGoals].find((item) => item.id === goal);
  return match?.startView ?? "home";
}

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

  function resetFailureMessage(code?: string, fallback = "Password reset failed.") {
    if (code === "RESET_TOKEN_INVALID") {
      return "This reset link is invalid, expired, or already used. Go back to sign in and request a fresh password reset email.";
    }
    if (code === "PASSWORD_POLICY_FAILED") {
      return "Use at least 8 characters with uppercase, lowercase, a number, and a symbol.";
    }
    if (code === "VALIDATION_FAILED") {
      return "This reset link is incomplete. Request a fresh password reset email from sign in.";
    }
    return fallback;
  }

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
      const body = await response.json().catch(() => ({})) as { error?: { code?: string; message?: string } };
      if (!response.ok) throw new Error(resetFailureMessage(body.error?.code, body.error?.message || "Password reset failed."));
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
  const [activeCapability, setActiveCapability] = useState<(typeof entryCapabilities)[number]["key"]>("talk");
  const feedPosts = [
    { community: "Carpentry Talk", author: "Trim lead", title: "Best way to scribe cabinets to stone?", meta: "Example community post" },
    { community: "Electrical Talk", author: "Service tech", title: "Panel swap pricing when the meter can stay?", meta: "Example community post" },
    { community: "Jacksonville Trades", author: "Remodeler", title: "Who is free for punch-out work this Friday?", meta: "Example local post" },
  ];

  const interests = ["Carpentry", "Electrical", "Plumbing", "HVAC", "Tile", "Cabinetry", "Framing", "Side Work"];

  return (
    <section className="auth-story" aria-label="Product preview">
      <div className="auth-story-header">
        <span className="auth-story-eyebrow">Shop Talk</span>
        <h1>Shop Talk, built for the trades.</h1>
        <p>
          Ask questions, find work, show your craft, and connect with real tradespeople.
        </p>
      </div>

      <div className="auth-capability-grid" aria-label="What you can do in RIVT">
        {entryCapabilities.map(({ key, title, body, icon: Icon }) => (
          <button
            key={key}
            type="button"
            className={activeCapability === key ? "auth-capability-card is-active" : "auth-capability-card"}
            aria-pressed={activeCapability === key}
            onClick={() => setActiveCapability(key)}
          >
            <Icon size={18} />
            <span>{title}</span>
            <small>{body}</small>
          </button>
        ))}
      </div>

      <div className="auth-trade-phone" aria-label="Shop Talk preview">
        <div className="auth-phone-topbar">
          <strong>RIVT</strong>
          <span>9:29</span>
        </div>
        <label className="auth-phone-search">
          <Search size={16} />
          <span>Best way to scribe cabinets to stone?</span>
          <b>Ask</b>
        </label>
        <div className="auth-phone-feed">
          {feedPosts.map((post) => (
            <article key={post.title} className="auth-phone-post">
              <div>
                <span>{post.community}</span>
                <small>{post.author}</small>
              </div>
              <strong>{post.title}</strong>
              <p>{post.meta}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="auth-activation-strip" aria-label="First actions">
        <span>First wins</span>
        <strong>
          {activeCapability === "talk"
            ? "Ask, answer, save, and build a visible reputation."
            : activeCapability === "work"
              ? "Post work, apply, message, and keep job details private."
              : activeCapability === "crew"
                ? "Find people by trade, location, proof, and availability."
                : "Open a calculator, draft an invoice, log work, and store photos."}
        </strong>
      </div>

      <div className="auth-story-pills" aria-label="Trade interests">
        {interests.map((interest) => (
          <span key={interest}>{interest}</span>
        ))}
      </div>

      <div className="auth-story-preview">
        <article>
          <span>Find your crew</span>
          <strong>Trade groups, local jobs, and real profiles</strong>
          <p>Carpenters, electricians, plumbers, remodelers, tile setters, framers, and cabinet installers in one trade network.</p>
        </article>
        <article>
          <span>Build reputation</span>
          <strong>Vote, comment, answer, and connect</strong>
          <p>Useful answers, portfolio proof, certifications, and reviews make a profile worth hiring.</p>
        </article>
      </div>
    </section>
  );
}

function SwipeEntryShowcase({
  onPreview,
  onLogin,
  onCreateAccount,
}: {
  onPreview: () => void;
  onLogin: () => void;
  onCreateAccount: () => void;
}) {
  const [activeSlide, setActiveSlide] = useState(0);
  const touchStartX = useRef<number | null>(null);

  function moveSlide(direction: -1 | 1) {
    setActiveSlide((current) => Math.max(0, Math.min(entrySlides.length - 1, current + direction)));
  }

  return (
    <section
      className="auth-intro"
      aria-label="RIVT intro"
      onTouchStart={(event) => {
        touchStartX.current = event.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(event) => {
        if (touchStartX.current === null) return;
        const delta = (event.changedTouches[0]?.clientX ?? touchStartX.current) - touchStartX.current;
        touchStartX.current = null;
        if (Math.abs(delta) < 42) return;
        if (delta < 0) moveSlide(1);
        else moveSlide(-1);
      }}
    >
      <button type="button" className="auth-intro-skip" onClick={onPreview}>
        Skip
      </button>

      <div className="auth-intro-brand">
        <strong>{brandConfig.appName}</strong>
      </div>

      <div className="auth-intro-window">
        <div className="auth-intro-track" style={{ transform: `translateX(-${activeSlide * 100}%)` }}>
          {entrySlides.map((slide, index) => (
            <article key={slide.title} className="auth-intro-slide" aria-hidden={index !== activeSlide}>
              <div className="auth-story-header">
                <span className="auth-story-eyebrow">{slide.kicker}</span>
                <h1>{slide.title}</h1>
                <p>{slide.body}</p>
              </div>
              <div className="auth-trade-phone" aria-label={`${slide.kicker} preview`}>
                <div className="auth-phone-topbar">
                  <strong>RIVT</strong>
                  <span>9:29</span>
                </div>
                <label className="auth-phone-search">
                  <Search size={16} />
                  <span>{slide.search}</span>
                  <b>{slide.action}</b>
                </label>
                <div className="auth-phone-feed">
                  {("cards" in slide ? slide.cards : slide.posts).map((post) => (
                    <article key={post.title} className="auth-phone-post">
                      <div>
                        <span>{post.community}</span>
                        <small>{post.meta.split(" - ")[0]?.split("·")[0]?.trim()}</small>
                      </div>
                      <strong>{post.title}</strong>
                      <p>{post.meta}</p>
                    </article>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="auth-intro-dots" aria-label="Intro progress">
        {entrySlides.map((slide, index) => (
          <button
            key={slide.title}
            type="button"
            className={index === activeSlide ? "is-active" : ""}
            aria-label={`Go to intro slide ${index + 1}`}
            aria-pressed={index === activeSlide}
            onClick={() => setActiveSlide(index)}
          />
        ))}
      </div>

      <div className="auth-intro-actions">
        <button
          type="button"
          className="primary-action"
          onClick={activeSlide === entrySlides.length - 1 ? onPreview : () => moveSlide(1)}
        >
          {activeSlide === entrySlides.length - 1 ? "Preview RIVT" : "Next"}
          <ArrowRight size={17} />
        </button>
        {activeSlide > 0 ? (
          <button type="button" className="secondary-action" onClick={() => moveSlide(-1)}>
            <ArrowLeft size={17} />
            Back
          </button>
        ) : null}
      </div>

      <div className="auth-intro-secondary" aria-label="Account options">
        <button type="button" className="auth-intro-account-action" onClick={onCreateAccount}>
          <span>New to RIVT</span>
          <strong>Create account</strong>
        </button>
        <button type="button" className="auth-intro-account-action is-login" onClick={onLogin}>
          <span>Already have an account</span>
          <strong>Log in</strong>
        </button>
      </div>
    </section>
  );
}

function GuestPreviewEntry({
  onBrowseAsGuest,
  onCreateAccount,
  onLogin,
}: {
  onBrowseAsGuest: () => void;
  onCreateAccount: () => void;
  onLogin: () => void;
}) {
  const [trade, setTrade] = useState<Trade>("Carpentry");
  const [location, setLocation] = useState("Jacksonville, FL");

  function openPreview() {
    saveGuestPreviewPreferences({ trade, location: location.trim() || "Jacksonville, FL", role: "contractor" });
    onBrowseAsGuest();
  }

  return (
    <section className="auth-preview-entry" aria-label="Personalize your RIVT preview">
      <div className="auth-preview-copy">
        <span>Preview first</span>
        <h1>Shape RIVT around your trade.</h1>
        <p>Pick a trade and area. The preview opens around useful conversations, local work signals, and tools without pretending anything is live work.</p>
      </div>

      <div className="auth-preview-board">
        <div className="auth-preview-field">
          <strong>Trade</strong>
          <div className="auth-preview-trades">
            {previewTradeOptions.map((option) => (
              <button
                key={option}
                type="button"
                className={trade === option ? "is-selected" : ""}
                aria-pressed={trade === option}
                onClick={() => setTrade(option)}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
        <label className="auth-preview-field">
          <strong>Area</strong>
          <input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Jacksonville, FL" />
          <button type="button" onClick={() => setLocation("Jacksonville, FL")}>
            <MapPin size={15} />
            Use Jacksonville pilot area
          </button>
        </label>
      </div>

      <div className="auth-preview-phone" aria-label="Personalized preview example">
        <div className="auth-phone-topbar">
          <strong>{trade} Talk</strong>
          <span>{location || "Your area"}</span>
        </div>
        <article className="auth-phone-post">
          <div>
            <span>{trade} Talk</span>
            <small>Preview</small>
          </div>
          <strong>{trade === "Electrical" ? "What are you charging for punch-out work?" : trade === "Plumbing" ? "Do I need separate insurance for weekend side jobs?" : "Best way to scribe cabinets to stone?"}</strong>
          <p>Guest mode lets you look around. Apply, post, message, save, and publish require a real account.</p>
        </article>
        <article className="auth-phone-post">
          <div>
            <span>Work</span>
            <small>{location || "Local"} filter</small>
          </div>
          <strong>Local work and crew matches use your selected trade first.</strong>
          <p>If there is nothing real in the pilot area yet, RIVT shows an honest empty state.</p>
        </article>
      </div>

      <div className="auth-preview-actions">
        <button type="button" className="primary-action" onClick={openPreview}>
          Browse RIVT preview
        </button>
        <button type="button" className="secondary-action" onClick={onCreateAccount}>
          Create account
        </button>
        <button type="button" className="auth-browse-action" onClick={onLogin}>
          Log in instead
        </button>
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
  onBrowseAsGuest,
}: {
  mode: "login" | "signup";
  error: string | null;
  notice: string | null;
  providers: ProviderStatus;
  inviteRequired: boolean;
  onModeChange: (mode: "login" | "signup") => void;
  onSubmit: (form: { email: string; password: string; displayName?: string; role?: Role; inviteCode?: string }) => void;
  onForgotPassword: (email: string) => void;
  onBrowseAsGuest: () => void;
}) {
  const [entryStage, setEntryStage] = useState<"intro" | "preview" | "auth">(() => (error ? "auth" : "intro"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<Role>("contractor");
  const [inviteCode, setInviteCode] = useState("");
  const emailInputRef = useRef<HTMLInputElement>(null);

  function openAuth(nextMode: "login" | "signup") {
    onModeChange(nextMode);
    setEntryStage("auth");
    window.requestAnimationFrame(() => {
      if (nextMode === "login") emailInputRef.current?.focus();
    });
  }

  if (entryStage === "intro") {
    return (
      <main className="auth-shell auth-shell--intro">
        <SwipeEntryShowcase
          onPreview={() => setEntryStage("preview")}
          onCreateAccount={() => openAuth("signup")}
          onLogin={() => openAuth("login")}
        />
      </main>
    );
  }

  if (entryStage === "preview") {
    return (
      <main className="auth-shell auth-shell--preview">
        <GuestPreviewEntry
          onBrowseAsGuest={onBrowseAsGuest}
          onCreateAccount={() => openAuth("signup")}
          onLogin={() => openAuth("login")}
        />
      </main>
    );
  }

  return (
    <main className="auth-shell auth-shell--split auth-shell--form">
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
        <button type="button" className="auth-browse-action" onClick={onBrowseAsGuest}>
          Browse first
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
      <span>Guest preview.</span>
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
  const [initialDraft] = useState<OnboardingDraft | null>(() => readOnboardingDraft(initialEmail));
  const startingRole = initialRole === "pending" ? (initialDraft?.role ?? "contractor") : initialRole;
  const startingGoal = initialDraft?.role === startingRole ? initialDraft.goal : defaultGoalForRole(startingRole);
  const [role, setRole] = useState<Role>(startingRole);
  const roleLocked = initialRole !== "pending";
  const [goal, setGoal] = useState<OnboardingGoal>(startingGoal);
  const [displayName, setDisplayName] = useState(initialDraft?.displayName || initialDisplayName);
  const [organization, setOrganization] = useState(initialDraft?.organization || initialOrganization);
  const [initialCity = "Jacksonville", initialRegion = "FL"] = initialLocation.split(",").map((part) => part.trim());
  const [serviceAreaCity, setServiceAreaCity] = useState(initialDraft?.serviceAreaCity || initialCity || "Jacksonville");
  const [serviceAreaRegion, setServiceAreaRegion] = useState(initialDraft?.serviceAreaRegion || initialRegion || "FL");
  const [serviceRadiusMiles, setServiceRadiusMiles] = useState(initialDraft?.serviceRadiusMiles ?? 25);
  const [specialties, setSpecialties] = useState<Trade[]>(
    initialDraft?.specialties.length ? initialDraft.specialties : initialSpecialties.length ? initialSpecialties : ["Electrical", "Carpentry"],
  );
  const [topicInterests, setTopicInterests] = useState<OnboardingTopic[]>(initialDraft?.topicInterests.length ? initialDraft.topicInterests : ["Local jobs", "Tools", "Business/pricing"]);
  const [showAllSpecialties, setShowAllSpecialties] = useState(false);
  const [legalConsent, setLegalConsent] = useState(initialDraft?.legalConsent ?? false);
  const [stepIndex, setStepIndex] = useState(initialDraft?.stepIndex ?? 0);
  const setupTouchStartX = useRef<number | null>(null);
  const plan: TrialPlan = brandConfig.pricing.betaPlan.label;
  const goalOptions = goalsForRole(role);
  const selectedGoal = goalOptions.find((option) => option.id === goal) ?? goalOptions[0];

  const accountReady = Boolean(displayName.trim()) && Boolean(serviceAreaCity.trim()) && Boolean(serviceAreaRegion.trim());
  const profileReady = specialties.length > 0;
  const legalReady = legalConsent;
  const canEnter = emailVerified && accountReady && profileReady && legalReady;
  const setupSteps = roleLocked
    ? (["goal", "profile", "feed", "trust"] as const)
    : (["role", "goal", "profile", "feed", "trust"] as const);
  const safeStepIndex = Math.min(stepIndex, setupSteps.length - 1);
  const currentStepId = setupSteps[safeStepIndex];
  const setupProgress = Math.round(((safeStepIndex + 1) / setupSteps.length) * 100);
  const currentStepTitle = currentStepId === "role"
    ? "Choose your account type"
    : currentStepId === "goal"
      ? "What are you here to do first?"
      : currentStepId === "profile"
        ? `${role === "contractor" ? "Contractor" : "Tradesperson"} profile`
        : currentStepId === "feed"
          ? "Shape your feed"
          : "Consent agreement";
  const canMoveForward = currentStepId === "profile"
    ? accountReady
    : currentStepId === "feed"
      ? profileReady
      : currentStepId === "trust"
        ? canEnter
        : true;
  const specialtyHeading =
    role === "contractor" ? "Trades you hire for" : "Your trade specialties";
  const specialtyHelp =
    role === "contractor"
      ? "These defaults speed up job posting and crew invites."
      : "Your first specialty becomes the default job feed filter.";
  const specialtyOptionsToShow = showAllSpecialties ? specialtyOptions : specialtyOptions.slice(0, 12);

  useEffect(() => {
    if (!initialEmail) return;
    writeOnboardingDraft({
      email: initialEmail,
      role,
      goal,
      displayName,
      organization,
      serviceAreaCity,
      serviceAreaRegion,
      serviceRadiusMiles,
      specialties,
      topicInterests,
      legalConsent,
      stepIndex: safeStepIndex,
    });
  }, [
    displayName,
    goal,
    initialEmail,
    legalConsent,
    organization,
    role,
    safeStepIndex,
    serviceAreaCity,
    serviceAreaRegion,
    serviceRadiusMiles,
    specialties,
    topicInterests,
  ]);

  function toggleSpecialty(option: Trade) {
    setSpecialties((current) => {
      if (current.includes(option)) {
        return current.filter((item) => item !== option);
      }

      return [...current, option];
    });
  }

  function toggleTopic(option: OnboardingTopic) {
    setTopicInterests((current) => {
      if (current.includes(option)) {
        return current.filter((item) => item !== option);
      }

      return [...current, option];
    });
  }

  function chooseRole(nextRole: Role) {
    setRole(nextRole);
    const nextGoal = defaultGoalForRole(nextRole);
    setGoal(nextGoal);
    setTopicInterests(nextRole === "contractor" ? ["Local jobs", "Business/pricing"] : ["Local jobs", "Project photos"]);
  }

  function goBack() {
    setStepIndex((current) => Math.max(0, current - 1));
  }

  async function saveProfileDraft() {
    const trimmedName = displayName.trim();
    const trimmedCity = serviceAreaCity.trim();
    const trimmedRegion = serviceAreaRegion.trim();
    const tradeCodes = specialties.map((specialty) => tradeCodeByName[specialty]).filter(Boolean);
    if (trimmedName.length < 2 || trimmedCity.length < 2 || trimmedRegion.length < 2 || !tradeCodes.length) return;
    try {
      await fetch(apiPath("/api/v1/profile"), {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: trimmedName,
          serviceAreaCity: trimmedCity,
          serviceAreaRegion: trimmedRegion,
          serviceRadiusMiles,
          tradeCodes,
        }),
      });
    } catch {
      // Draft persistence is best-effort; final onboarding completion still validates server-side.
    }
  }

  function goNext() {
    if (currentStepId === "trust") {
      submit();
      return;
    }
    if (!canMoveForward) return;
    void saveProfileDraft();
    setStepIndex((current) => Math.min(setupSteps.length - 1, current + 1));
  }

  function handleSetupSwipe(delta: number) {
    if (Math.abs(delta) < 42) return;
    if (delta < 0) goNext();
    else goBack();
  }

  function submit() {
    if (!canEnter) {
      return;
    }

    onComplete({
      role,
      goal,
      topicInterests,
      preferredStartView: startViewForGoal(goal),
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

          <div className="onboarding-hero-copy onboarding-hero-copy--trade">
            <span>Shop Talk</span>
            <h1>{role === "contractor" ? "Build your trade network" : "Turn your trade into opportunity"}</h1>
            <p>{selectedGoal.body}</p>
          </div>

          <div className="onboarding-trade-stack" aria-label="Shop Talk onboarding preview">
            <article>
              <span>{selectedGoal.startView === "shop-talk" ? "Shop Talk first" : "Always useful"}</span>
              <strong>{role === "contractor" ? "Who can help this week?" : "Where can I earn next?"}</strong>
              <p>{role === "contractor" ? "Post work, ask your network, or find tradespeople by specialty." : "Find work, ask questions, and let contractors see your proof."}</p>
            </article>
            <article>
              <span>{selectedGoal.label}</span>
              <strong>{selectedGoal.startView === "tools" ? "Tools are ready when the job starts" : "Your first screen will match your goal"}</strong>
              <p>{selectedGoal.startView === "tools" ? "Calculator, invoices, daily logs, records, and photos live together." : "You can change direction anytime from the five main tabs."}</p>
            </article>
            <div className="onboarding-interest-strip">
              {[...specialties.slice(0, 4), ...topicInterests.slice(0, 2)].map((interest) => (
                <span key={interest}>{interest}</span>
              ))}
            </div>
          </div>

          <div className="onboarding-proof-grid" aria-label="Platform guardrails">
            <div>
              <ShieldCheck size={17} />
              <strong>{brandConfig.legal.trustCardTitle}</strong>
              <span>Verified email, signed consent, and factual trust states.</span>
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

        <section
          className="onboarding-panel onboarding-panel--swipe"
          onTouchStart={(event) => {
            setupTouchStartX.current = event.touches[0]?.clientX ?? null;
          }}
          onTouchEnd={(event) => {
            if (setupTouchStartX.current === null) return;
            const delta = (event.changedTouches[0]?.clientX ?? setupTouchStartX.current) - setupTouchStartX.current;
            setupTouchStartX.current = null;
            handleSetupSwipe(delta);
          }}
        >
          <div className="onboarding-panel-header">
            <div>
              <span>Step {safeStepIndex + 1} of {setupSteps.length}</span>
              <h2>{currentStepTitle}</h2>
            </div>
            <div>
              <span>{plan}</span>
              <ProgressBar value={setupProgress} />
            </div>
          </div>

          <section className={currentStepId === "role" ? "onboarding-section is-current" : "onboarding-section"} aria-label="Account role">
            {roleLocked ? (
              <div className="role-locked-note">
                <strong>{role === "contractor" ? "Contractor" : "Tradesperson"}</strong>
                <span>This role was selected at signup and cannot be changed.</span>
              </div>
            ) : (
              <div className="auth-toggle role-toggle" aria-label="Choose account type">
                <button type="button" className={role === "contractor" ? "selected" : ""} aria-pressed={role === "contractor"} onClick={() => chooseRole("contractor")}>Contractor</button>
                <button type="button" className={role === "tradesperson" ? "selected" : ""} aria-pressed={role === "tradesperson"} onClick={() => chooseRole("tradesperson")}>Tradesperson</button>
              </div>
            )}
          </section>

          <section className={currentStepId === "goal" ? "onboarding-section is-current" : "onboarding-section"} aria-label="First goal">
            <div className="onboarding-section-heading">
              <p>We will shape your first screen around this. You can still use everything else.</p>
            </div>
            <div className="onboarding-goal-grid">
              {goalOptions.map(({ id, label, body, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  className={goal === id ? "onboarding-goal-card selected" : "onboarding-goal-card"}
                  aria-pressed={goal === id}
                  onClick={() => setGoal(id)}
                >
                  <Icon size={18} />
                  <span>{label}</span>
                  <small>{body}</small>
                </button>
              ))}
            </div>
            <div className="onboarding-goal-preview" role="status">
              <strong>Your first stop: {selectedGoal.label}</strong>
              <span>
                {selectedGoal.startView === "work"
                  ? "We will open the Work feed first."
                  : selectedGoal.startView === "crew"
                    ? "We will open Crew first."
                    : selectedGoal.startView === "shop-talk"
                      ? "We will open Shop Talk first."
                      : selectedGoal.startView === "tools"
                        ? "We will open Tools first."
                        : "We will open your profile first."}
              </span>
            </div>
          </section>

          <section className={currentStepId === "profile" ? "onboarding-section is-current" : "onboarding-section"} aria-label="Profile basics">
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

          <section className={currentStepId === "feed" ? "onboarding-section is-current" : "onboarding-section"} aria-label="Trade specialties">
            <div className="onboarding-section-heading">
              <p>{specialtyHelp}</p>
            </div>
            <div className="onboarding-picker-label">
              <strong>{specialtyHeading}</strong>
              <span>{specialties.length ? `${specialties.length} selected` : "Choose at least one trade"}</span>
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
            <div className="onboarding-picker-label onboarding-topic-label">
              <strong>Topics you want in your feed</strong>
              <span>{topicInterests.length ? `${topicInterests.length} selected` : "Choose at least one topic"}</span>
            </div>
            <div className="onboarding-topic-picker">
              {onboardingTopics.map((topic) => (
                <button
                  key={topic}
                  type="button"
                  className={topicInterests.includes(topic) ? "selected" : ""}
                  aria-pressed={topicInterests.includes(topic)}
                  onClick={() => toggleTopic(topic)}
                >
                  {topic}
                </button>
              ))}
            </div>
            <div className="onboarding-feed-preview" role="status">
              <strong>
                {role === "contractor"
                  ? `You will see ${specialties.slice(0, 2).join(" and ") || "trade"} people, local jobs, and crew leads first.`
                  : `Your Work feed will start with ${specialties[0] || "your trade"} and local opportunities near ${serviceAreaCity || "your city"}.`}
              </strong>
              <span>{topicInterests.join(", ")}</span>
            </div>
          </section>

          <section className={currentStepId === "trust" ? "onboarding-section onboarding-trust-section is-current" : "onboarding-section onboarding-trust-section"} aria-label="Trust setup">
            <div className="onboarding-section-heading">
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
              <strong>{currentStepId === "trust" ? (canEnter ? `Ready to open ${brandConfig.appName}` : "Finish the basics") : "Keep moving"}</strong>
              <span>
                {currentStepId === "trust"
                  ? canEnter
                    ? "Your verified account, role, profile, and consent are ready."
                    : "Verify your email, finish your service area, select a trade, and accept the agreement."
                  : currentStepId === "feed"
                    ? "Topics are optional. Choose the trades that should drive your feed."
                    : "One question per screen. Swipe or use the buttons."}
              </span>
              {notice ? <span className="auth-notice" role="status">{notice}</span> : null}
              {error ? <span className="auth-error" role="alert">{error}</span> : null}
            </div>
            <button
              type="button"
              className="secondary-action onboarding-back-action"
              onClick={goBack}
              disabled={safeStepIndex === 0}
            >
              <ArrowLeft size={17} />
              Back
            </button>
            <button
              type="button"
              className="primary-action"
              onClick={goNext}
              disabled={!canMoveForward}
            >
              {currentStepId === "trust" ? <BadgeCheck size={18} /> : <ArrowRight size={17} />}
              {currentStepId === "trust" ? "Open RIVT" : "Next"}
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
