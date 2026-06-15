import { type ChangeEvent, type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Award,
  BadgeCheck,
  Bell,
  BookOpen,
  BriefcaseBusiness,
  Calculator,
  CalendarClock,
  ChevronDown,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  FileCheck2,
  FileDown,
  FileText,
  Flag,
  FolderOpen,
  GraduationCap,
  Hammer,
  Home,
  MapPin,
  Mail,
  MessageCircle,
  MessageSquareText,
  Moon,
  Newspaper,
  Plus,
  ReceiptText,
  Search,
  Send,
  Share2,
  Sparkles,
  ShieldCheck,
  Star,
  Camera,
  Copy,
  ScanSearch,
  PenTool,
  Clock3,
  Sun,
  ThumbsDown,
  ThumbsUp,
  UserCheck,
  Users,
  Wrench,
  X,
} from "lucide-react";
import {
  difficultyOptions,
  jobs as seedJobs,
  radiusOptions,
  talent,
  tradeOptions,
  workTypeOptions,
} from "./data";
import { brandConfig, type ThemeMode, type ThemePalette, type TrialPlan } from "./brandConfig";
import type { ApplicationRecord, Difficulty, Job, Role, Trade, WorkType } from "./types";

type TradeFilter = (typeof tradeOptions)[number];
type DifficultyFilter = (typeof difficultyOptions)[number];
type WorkTypeFilter = (typeof workTypeOptions)[number];
type RadiusFilter = (typeof radiusOptions)[number];
type AuthMethod = "Google" | "Facebook" | "Apple" | "Email";
type NavLabel =
  | "Home"
  | "Marketplace"
  | "Shop Talk"
  | "Tools"
  | "My Jobs"
  | "Applications"
  | "Invites"
  | "My Crew"
  | "Messages"
  | "Trust & Legal"
  | "Records"
  | "Safety & Training"
  | "Reviews"
  | "Feedback"
  | "Settings"
  | "Admin";

interface CloseoutRecord {
  packetSubmitted: boolean;
  approved: boolean;
  dispute: boolean;
  rating: number;
}

interface AccountProfile {
  email: string;
  displayName: string;
  organization: string;
  location: string;
  specialties: Trade[];
  plan: TrialPlan;
  authMethod: AuthMethod;
}

interface OnboardingResult extends AccountProfile {
  role: Role;
}

interface AuthUser {
  id: string;
  email: string;
  provider: string;
  display_name: string;
  role: Role;
  organization: string;
  location: string;
}

interface ActivityItem {
  id: number;
  title: string;
  detail: string;
  timestamp: string;
  unread: boolean;
}

interface FeedbackItem {
  id: number;
  category: "Bug" | "Confusing" | "Feature" | "Pricing" | "Other";
  message: string;
  timestamp: string;
}

interface PaymentRecord {
  id: number;
  jobId: number;
  jobTitle: string;
  worker: string;
  amount: number;
  method: string;
  status: "Payment pending" | "Paid / Closed";
  date: string;
}

interface NewsItem {
  id: number;
  headline: string;
  source: string;
  date: string;
  summary: string;
  url: string;
  urgency?: string;
}

type ProviderCheckStatus = "idle" | "checking" | "ready" | "setup_required" | "offline";

interface ProviderCheckResult {
  status: ProviderCheckStatus;
  message: string;
  missing: string[];
  checkedAt?: string;
}

type UploadCheckResult = ProviderCheckResult & {
  fileName?: string;
};

interface StoredUploadFile {
  originalName: string;
  key: string;
  mimeType: string;
  size: number;
  publicUrl: string | null;
  signedUrl: string | null;
  signedUrlExpiresIn: number | null;
}

interface StoredUpload {
  id: string;
  timestamp: string;
  kind: string;
  name: string;
  jobId: number | null;
  notes: string;
  file: StoredUploadFile | null;
}

interface CommunityAnswer {
  id: number;
  author: string;
  body: string;
  upvotes: number;
  downvotes: number;
  verifiedFix: boolean;
}

interface CommunityPost {
  id: number;
  title: string;
  trade: Trade | "General";
  author: string;
  badge?: "Community Prompt" | "Recommendation";
  body: string;
  upvotes: number;
  downvotes: number;
  replies: CommunityAnswer[];
  createdAt: string;
  status: "Open" | "Verified Fix" | "Needs a pro answer";
}

interface CommunityReport {
  id: number;
  postId: number;
  postTitle: string;
  reason: "Misinformation" | "Safety concern" | "Spam" | "Harassment";
  status: "Flagged" | "Cleared" | "Hidden" | "Removed" | "Warned";
}

interface ShoutOut {
  id: number;
  from: string;
  to: string;
  trade: Trade;
  message: string;
  createdAt: string;
}

interface WorkRecordTimelineItem {
  title: string;
  detail: string;
  time: string;
  tone: "accent" | "good" | "warn" | "neutral";
}

interface RecordQuickStat {
  label: string;
  value: string;
  detail: string;
  tone: "good" | "accent" | "warn" | "neutral";
}

interface PersistedAppState {
  activeView: NavLabel;
  role: Role;
  onboardingComplete: boolean;
  accountProfile: AccountProfile;
  query: string;
  trade: TradeFilter;
  difficulty: DifficultyFilter;
  workType: WorkTypeFilter;
  radius: RadiusFilter;
  locationQuery: string;
  verifiedOnly: boolean;
  savedSearch: boolean;
  jobs: Job[];
  selectedId: number;
  applications: ApplicationRecord[];
  trustReady: boolean;
  scheduleHolds: number[];
  closeouts: Record<number, CloseoutRecord>;
  autoMatchEnabled: boolean;
  messageDraft: string;
  sentMessages: string[];
  uploadedRecords: string[];
  completedTraining: string[];
  reviewRequested: boolean;
  activityFeed: ActivityItem[];
  feedbackItems: FeedbackItem[];
  paymentRecords: PaymentRecord[];
  lockedAccounts: string[];
  communityPosts: CommunityPost[];
  communityReports: CommunityReport[];
  shoutOuts: ShoutOut[];
}

const LEGACY_STORAGE_KEY = `${brandConfig.appSlug}-beta-state-v2`;
const THEME_STORAGE_KEY = `${brandConfig.appSlug}-theme-mode`;
const THEME_PALETTE_STORAGE_KEY = `${brandConfig.appSlug}-theme-palette`;
const AUTH_STORAGE_KEY = `${brandConfig.appSlug}-auth-user`;
const AUTH_MODE_KEY = `${brandConfig.appSlug}-auth-mode`;
const API_BASE_URL = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? "http://127.0.0.1:8787" : "");

type ServerStatus = "checking" | "connected" | "offline" | "setup_required";

interface ServerStateResponse {
  state: Partial<PersistedAppState> | null;
  updatedAt: string | null;
}

function apiPath(path: string) {
  return `${API_BASE_URL}${path}`;
}

function readThemePreference(): ThemeMode {
  if (typeof window === "undefined") return "light";

  try {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (storedTheme === "light" || storedTheme === "dark") {
      return storedTheme;
    }

    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch {
    return "light";
  }
}

function readThemePalettePreference(): ThemePalette {
  if (typeof window === "undefined") return "orangeRidge";

  try {
    const storedPalette = window.localStorage.getItem(THEME_PALETTE_STORAGE_KEY);
    if (storedPalette && storedPalette in brandConfig.theme.palettes) {
      return storedPalette as ThemePalette;
    }
  } catch {
    return "orangeRidge";
  }

  return "orangeRidge";
}

const defaultCloseout: CloseoutRecord = {
  packetSubmitted: false,
  approved: false,
  dispute: false,
  rating: 0,
};

const specialtyOptions = tradeOptions.filter(
  (option): option is Trade => option !== "All trades",
);

const stateGuidance: Record<string, string[]> = {
  FL: [
    "Show Jacksonville area only until both sides confirm",
    "Each side stays responsible for license, insurance, and local compliance",
    "Completion photos and payment notes stay in the record",
  ],
  NY: [
    "Show city/state only until both parties confirm",
    "Keep payment and completion notes in the work order record",
    "Use the connection-service consent before work starts",
  ],
  NJ: [
    "ID check required before accepting work",
    "Keep start-window updates in the message thread",
    "Completion photos unlock the review prompt",
  ],
  CT: [
    "Specialty credentials stay visible on profile",
    "Address unlocks after mutual confirmation",
    "Record direct payment method for bookkeeping",
  ],
};

const navItems: Array<{ label: NavLabel; icon: typeof BriefcaseBusiness }> = [
  { label: "Home", icon: Home },
  { label: "Marketplace", icon: BriefcaseBusiness },
  { label: "Shop Talk", icon: MessageCircle },
  { label: "Tools", icon: Wrench },
  { label: "My Jobs", icon: ClipboardList },
  { label: "Applications", icon: FileCheck2 },
  { label: "Invites", icon: Sparkles },
  { label: "My Crew", icon: UserCheck },
  { label: "Messages", icon: MessageSquareText },
  { label: "Trust & Legal", icon: ShieldCheck },
  { label: "Records", icon: ClipboardCheck },
  { label: "Safety & Training", icon: GraduationCap },
  { label: "Reviews", icon: Star },
  { label: "Feedback", icon: MessageCircle },
  { label: "Settings", icon: ShieldCheck },
  { label: "Admin", icon: ClipboardCheck },
];

const roleNavItems: Record<Role, NavLabel[]> = {
  contractor: [
    "Home",
    "Marketplace",
    "Shop Talk",
    "Tools",
    "My Jobs",
    "Applications",
    "Invites",
    "My Crew",
    "Messages",
    "Trust & Legal",
    "Records",
    "Reviews",
    "Feedback",
    "Settings",
  ],
  tradesperson: [
    "Home",
    "Marketplace",
    "Shop Talk",
    "Tools",
    "My Jobs",
    "Applications",
    "Messages",
    "Trust & Legal",
    "Records",
    "Safety & Training",
    "Reviews",
    "Feedback",
    "Settings",
  ],
};

const feedbackCategories: FeedbackItem["category"][] = [
  "Confusing",
  "Bug",
  "Feature",
  "Pricing",
  "Other",
];
const themePaletteOptions = Object.entries(brandConfig.theme.palettes) as Array<
  [ThemePalette, (typeof brandConfig.theme.palettes)[ThemePalette]]
>;

function visibleNavItems(role: Role) {
  const visibleLabels = new Set(roleNavItems[role]);
  return navItems.filter((item) => visibleLabels.has(item.label));
}

const pageCopy: Record<NavLabel, { title: string; description: string }> = {
  Home: {
    title: "Home",
    description: "Your daily trade feed: news, Shop Talk, shout-outs, tools, and work signal.",
  },
  Marketplace: {
    title: "Work Feed",
    description: "Post paid side work, find openings, and keep each work order record clean.",
  },
  "Shop Talk": {
    title: "Shop Talk",
    description: "Ask field questions, share fixes, and recognize tradespeople who help.",
  },
  Tools: {
    title: "Tools",
    description: "Invoice builder, estimate calculator, and field tools for active work orders.",
  },
  "My Jobs": {
    title: "My Jobs",
    description: "Track each job from posted to paid and closed.",
  },
  Applications: {
    title: "Applications",
    description: "See who raised a hand and move fast on good matches.",
  },
  Invites: {
    title: "Invites",
    description: "Invite nearby tradespeople who fit the job.",
  },
  "My Crew": {
    title: "My Crew",
    description: "Compare specialties, tools, self-reported insurance, and availability.",
  },
  Messages: {
    title: "Messages",
    description: "Keep job messages in one permanent thread.",
  },
  "Trust & Legal": {
    title: "Trust & Legal",
    description: "Keep consent, ID readiness, and address privacy clear.",
  },
  Records: {
    title: "Records",
    description: "Keep completion photos, payment notes, and closeout history together.",
  },
  "Safety & Training": {
    title: "Safety & Training",
    description: "Track required training and job-site risk controls.",
  },
  Reviews: {
    title: "Reviews",
    description: "Protect trust with closeout ratings and review requests.",
  },
  Feedback: {
    title: "Feedback",
    description: "Capture beta customer notes and turn them into product decisions.",
  },
  Settings: {
    title: "Settings",
    description: "Manage themes, account details, trust setup, and provider readiness.",
  },
  Admin: {
    title: "Admin",
    description: "Watch the beta, handle reports, and keep bad accounts out.",
  },
};

const recordChecklist = [
  "Signed scope",
  "Legal consent accepted",
  "ID check before post/accept",
  "Completion photos",
  "Payment method note",
  "Review prompt",
];

function buildWorkRecordTimeline(
  selectedJob: Job,
  uploadedRecords: Set<string>,
  closeout: CloseoutRecord,
  selectedPayment: PaymentRecord | undefined,
  uploadCount: number,
): WorkRecordTimelineItem[] {
  const items: WorkRecordTimelineItem[] = [
    {
      title: "Scope captured",
      detail: `${selectedJob.title} is attached to the active work order record.`,
      time: selectedJob.posted,
      tone: "accent",
    },
    {
      title: "Legal consent ready",
      detail: uploadedRecords.has("Legal consent accepted")
        ? "Consent was accepted and stored with the job record."
        : "Consent still needs to be acknowledged before work starts.",
      time: uploadedRecords.has("Legal consent accepted") ? "Ready" : "Needed",
      tone: uploadedRecords.has("Legal consent accepted") ? "good" : "warn",
    },
    {
      title: "Photos and docs",
      detail: `${uploadCount} managed upload${uploadCount === 1 ? "" : "s"} are linked to this work order.`,
      time: uploadCount ? "Synced" : "Waiting",
      tone: uploadCount ? "good" : "neutral",
    },
    {
      title: "Closeout packet",
      detail: closeout.packetSubmitted
        ? "Completion record has been submitted for approval."
        : "Completion record still needs to be sent to the contractor.",
      time: closeout.packetSubmitted ? "Submitted" : "Open",
      tone: closeout.packetSubmitted ? "good" : "warn",
    },
    {
      title: "Payment ledger",
      detail: selectedPayment
        ? `${selectedPayment.status} logged for bookkeeping and tax records.`
        : "No payment row has been created yet.",
      time: selectedPayment?.status ?? "Pending",
      tone: selectedPayment?.status === "Paid / Closed" ? "good" : "neutral",
    },
    {
      title: "Review window",
      detail: closeout.approved
        ? "Rating prompt is open once both sides sign off."
        : "Review prompt unlocks after the closeout is approved.",
      time: closeout.approved ? "Open" : "Locked",
      tone: closeout.approved ? "good" : "neutral",
    },
  ];

  return items;
}

function buildRecordQuickStats(
  selectedJob: Job,
  uploadedRecords: Set<string>,
  selectedJobUploads: StoredUpload[],
  closeout: CloseoutRecord,
  selectedPayment: PaymentRecord | undefined,
): RecordQuickStat[] {
  const approvedCount = recordChecklist.filter((recordName) => uploadedRecords.has(recordName)).length;
  const activeStatus =
    selectedPayment?.status === "Paid / Closed"
      ? "Closed"
      : selectedPayment?.status === "Payment pending"
        ? "Payment pending"
        : closeout.approved
          ? "Approved"
          : "Open";

  return [
    {
      label: "Work order",
      value: selectedJob.trade,
      detail: selectedJob.title,
      tone: "accent",
    },
    {
      label: "Record score",
      value: `${Math.round((approvedCount / recordChecklist.length) * 100)}%`,
      detail: `${approvedCount} of ${recordChecklist.length} checklist items ready`,
      tone: approvedCount >= recordChecklist.length - 1 ? "good" : "warn",
    },
    {
      label: "Captured files",
      value: String(selectedJobUploads.length),
      detail: "Managed uploads tied to this job",
      tone: selectedJobUploads.length > 0 ? "good" : "neutral",
    },
    {
      label: "Closeout state",
      value: activeStatus,
      detail: closeout.packetSubmitted ? "Packet recorded" : "Needs field proof",
      tone: closeout.packetSubmitted ? "good" : "warn",
    },
  ];
}

function buildJobsiteReportHtml(
  selectedJob: Job,
  uploadedRecords: Set<string>,
  selectedJobUploads: StoredUpload[],
  closeout: CloseoutRecord,
  selectedPayment: PaymentRecord | undefined,
  recordTimeline: WorkRecordTimelineItem[],
) {
  const checklistRows = recordChecklist
    .map(
      (item) => `
        <li class="checked-${uploadedRecords.has(item) ? "yes" : "no"}">
          <span>${item}</span>
          <strong>${uploadedRecords.has(item) ? "Ready" : "Needed"}</strong>
        </li>`,
    )
    .join("");

  const uploadRows = selectedJobUploads
    .map(
      (upload) => `
        <li>
          <span>${upload.name}</span>
          <strong>${upload.file?.originalName ?? "Managed upload"}</strong>
        </li>`,
    )
    .join("");

  const timelineRows = recordTimeline
    .map(
      (item) => `
        <li>
          <span>${item.title}</span>
          <strong>${item.time}</strong>
          <p>${item.detail}</p>
        </li>`,
    )
    .join("");

  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>RIVT Jobsite Report</title>
      <style>
        body { margin: 0; font-family: Inter, Arial, sans-serif; background: #0b0f12; color: #e9f0f3; }
        .sheet { max-width: 920px; margin: 0 auto; padding: 32px; }
        .hero { display: grid; gap: 8px; padding: 24px; border: 1px solid rgba(255,255,255,0.08); border-radius: 18px; background: linear-gradient(180deg, #12181d, #090c0f); }
        .hero h1 { margin: 0; font-size: 34px; }
        .hero p, li p { margin: 0; color: #98a6ad; line-height: 1.5; }
        .meta, .grid, ul { display: grid; gap: 12px; }
        .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); margin-top: 16px; }
        .panel { padding: 18px; border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; background: rgba(255,255,255,0.03); }
        .panel h2 { margin: 0 0 8px; font-size: 15px; text-transform: uppercase; letter-spacing: 0.08em; color: #9fd8b7; }
        .kpi { display: grid; gap: 2px; }
        .kpi strong { font-size: 24px; }
        .kpi span { color: #98a6ad; font-size: 12px; }
        ul { padding: 0; list-style: none; }
        li { padding: 12px 0; border-top: 1px solid rgba(255,255,255,0.08); }
        li:first-child { border-top: 0; }
        li span { display: block; color: #98a6ad; text-transform: uppercase; font-size: 11px; letter-spacing: 0.08em; }
        li strong { display: block; margin-top: 4px; }
        .checked-yes strong { color: #b8e319; }
        .checked-no strong { color: #ffae73; }
      </style>
    </head>
    <body>
      <div class="sheet">
        <section class="hero">
          <span>RIVT Jobsite Report</span>
          <h1>${selectedJob.title}</h1>
          <p>${selectedJob.summary}</p>
        </section>
        <section class="grid">
          <article class="panel">
            <h2>Current state</h2>
            <div class="kpi"><strong>${selectedPayment?.status ?? "Payment pending"}</strong><span>${selectedJob.trade} · ${selectedJob.location}</span></div>
          </article>
          <article class="panel">
            <h2>Closeout</h2>
            <div class="kpi"><strong>${closeout.approved ? "Approved" : closeout.packetSubmitted ? "Submitted" : "Open"}</strong><span>${closeout.dispute ? "Dispute flagged" : "No dispute recorded"}</span></div>
          </article>
        </section>
        <section class="grid">
          <article class="panel">
            <h2>Checklist</h2>
            <ul>${checklistRows}</ul>
          </article>
          <article class="panel">
            <h2>Uploads</h2>
            <ul>${uploadRows || "<li><span>No uploads</span><strong>Nothing captured yet</strong></li>"}</ul>
          </article>
        </section>
        <section class="panel" style="margin-top:16px">
          <h2>Timeline</h2>
          <ul>${timelineRows}</ul>
        </section>
      </div>
    </body>
  </html>`;
}

const trainingModules = [
  "Ladder and fall protection",
  "Electrical lockout basics",
  "Dust containment",
  "Customer-site conduct",
];
const providerCheckConfigs = [
  {
    id: "storage",
    label: "Managed storage",
    purpose: "Server persistence and secure file uploads",
    method: "GET",
    path: "/api/health",
  },
  {
    id: "identity",
    label: "Identity verification",
    purpose: "Government ID checks before real posting or accepting",
    method: "POST",
    path: "/api/identity/verify",
  },
  {
    id: "billing",
    label: "Subscription billing",
    purpose: "Stripe checkout for paid launch plans",
    method: "POST",
    path: "/api/subscriptions/checkout",
  },
  {
    id: "notifications",
    label: "Notifications",
    purpose: "Email or SMS job, message, billing, and review alerts",
    method: "POST",
    path: "/api/notifications/test",
  },
] as const;
const communityBadgeThresholds = {
  firstAssistVerifiedFixes: 1,
  mentorQualityAnswers: 10,
  topHandQualityAnswers: 25,
  premiumRewardMonths: 1,
};
const seedNews: NewsItem[] = [
  {
    id: 1,
    headline: "Florida permit changes take effect July 1, 2026",
    source: "Florida Senate",
    date: "Jun 2026",
    urgency: "New Florida Law",
    summary:
      "CS/CS/HB 803 changes building permit rules, including limited exemptions for some single-family residential work under $7,500. Electrical, plumbing, mechanical, gas, structural, flood-zone, and local compliance issues still need careful review.",
    url: "https://www.flsenate.gov/Session/Bill/2026/803",
  },
  {
    id: 2,
    headline: "Jacksonville beta focus: fewer surprises before the first site visit",
    source: brandConfig.appName,
    date: "Today",
    summary:
      "The cleanest job posts include scope, difficulty, tools, access notes, payment expectations, and closeout photos before anyone commits.",
    url: "#",
  },
];
const seedCommunityPosts: CommunityPost[] = [
  {
    id: 101,
    title: "Cabinet alignment on uneven walls - what is your shim strategy?",
    trade: "Carpentry",
    author: "Founder prompt",
    badge: "Community Prompt",
    body:
      "Real field pain point from finish work: what do you check before fastening cabinets when the wall is out and the floor has a crown?",
    upvotes: 18,
    downvotes: 1,
    createdAt: "Today",
    status: "Verified Fix",
    replies: [
      {
        id: 1001,
        author: "Maya Ortiz",
        body:
          "Scribe first, find the high point, shim from the rail, then leave yourself reveal room at fillers. I mark the wall before the box goes up so I am not guessing while holding weight.",
        upvotes: 21,
        downvotes: 0,
        verifiedFix: true,
      },
      {
        id: 1002,
        author: "Trevor Hall",
        body:
          "Laser line plus story pole. It slows the first cabinet down but saves the whole run.",
        upvotes: 9,
        downvotes: 1,
        verifiedFix: false,
      },
    ],
  },
  {
    id: 102,
    title: "Best way to document small change orders before they become arguments?",
    trade: "General",
    author: "Community Prompt",
    badge: "Community Prompt",
    body:
      "What is the fastest field habit for keeping a small scope change from turning into a payment fight?",
    upvotes: 11,
    downvotes: 0,
    createdAt: "Yesterday",
    status: "Needs a pro answer",
    replies: [],
  },
  {
    id: 103,
    title: "Mini split line set through tight framing - what do you refuse to compromise on?",
    trade: "HVAC",
    author: "Founder prompt",
    badge: "Community Prompt",
    body:
      "Looking for experienced HVAC answers that separate clean shortcuts from callbacks.",
    upvotes: 7,
    downvotes: 0,
    createdAt: "Yesterday",
    status: "Open",
    replies: [
      {
        id: 1003,
        author: "Andre Bell",
        body:
          "Bend radius, insulation continuity, and pressure test photos. If those are rushed, the callback is already on the calendar.",
        upvotes: 12,
        downvotes: 0,
        verifiedFix: false,
      },
    ],
  },
];
const seedShoutOuts: ShoutOut[] = [
  {
    id: 201,
    from: "Mitchell Construction",
    to: "Maya Ortiz",
    trade: "Carpentry",
    createdAt: "Today",
    message:
      "Wrapped a cabinet repair clean and on time. If you need finish carpentry in Jacksonville, she is worth calling.",
  },
  {
    id: 202,
    from: "Parker Mechanical",
    to: "Andre Bell",
    trade: "HVAC",
    createdAt: "Yesterday",
    message:
      "Good communication, clean recovery setup, and left photos in the work order record.",
  },
];

function currency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function fileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 KB";
  }

  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function normalizeStoredUpload(value: unknown): StoredUpload | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const source = value as Record<string, unknown>;
  const file = source.file && typeof source.file === "object"
    ? source.file as Record<string, unknown>
    : null;
  const id = typeof source.id === "string" ? source.id : "";
  const fallbackName = file && typeof file.originalName === "string" ? file.originalName : "Upload";

  if (!id) {
    return null;
  }

  return {
    id,
    timestamp: typeof source.timestamp === "string" ? source.timestamp : "",
    kind: typeof source.kind === "string" ? source.kind : "record",
    name: typeof source.name === "string" ? source.name : fallbackName,
    jobId: typeof source.jobId === "number" ? source.jobId : null,
    notes: typeof source.notes === "string" ? source.notes : "",
    file: file
      ? {
          originalName: typeof file.originalName === "string" ? file.originalName : "Upload",
          key: typeof file.key === "string" ? file.key : "",
          mimeType: typeof file.mimeType === "string" ? file.mimeType : "",
          size: typeof file.size === "number" ? file.size : 0,
          publicUrl: typeof file.publicUrl === "string" ? file.publicUrl : null,
          signedUrl: typeof file.signedUrl === "string" ? file.signedUrl : null,
          signedUrlExpiresIn: typeof file.signedUrlExpiresIn === "number" ? file.signedUrlExpiresIn : null,
        }
      : null,
  };
}

function radiusMiles(value: RadiusFilter) {
  if (value === "Any radius") {
    return Number.POSITIVE_INFINITY;
  }

  return Number(value.replace(" mi", ""));
}

function discardLegacyLocalState() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // If browser storage is unavailable, there is nothing to clean up.
  }
}

function readLocalAuthUser(): AuthUser | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthUser;
    return parsed?.email ? parsed : null;
  } catch {
    return null;
  }
}

function saveLocalAuthUser(user: AuthUser | null) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    if (user) {
      window.sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    } else {
      window.sessionStorage.removeItem(AUTH_STORAGE_KEY);
    }
  } catch {
    // sessionStorage is optional in the browser.
  }
}

async function parseApiError(response: Response) {
  const body = await response.json().catch(() => null) as { error?: string } | null;
  const error = new Error(body?.error ?? `Request failed with ${response.status}`) as Error & { status?: number };
  error.status = response.status;
  return error;
}

function statusFromError(error: unknown): ServerStatus {
  return typeof error === "object" && error !== null && "status" in error && error.status === 503
    ? "setup_required"
    : "offline";
}

async function fetchServerState(): Promise<ServerStateResponse> {
  const response = await fetch(apiPath("/api/app-state"), {
    credentials: "include",
  });

  if (!response.ok) {
    throw await parseApiError(response);
  }

  return response.json() as Promise<ServerStateResponse>;
}

async function saveServerState(state: PersistedAppState) {
  const response = await fetch(apiPath("/api/app-state"), {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ state }),
  });

  if (!response.ok) {
    throw await parseApiError(response);
  }

  return response.json() as Promise<{ ok: boolean; updatedAt: string }>;
}

async function recordServerEvent(type: string, payload: Record<string, unknown>) {
  try {
    await fetch(apiPath("/api/events"), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, payload }),
    });
  } catch {
    // State sync is the durable path; event logging is helpful but non-blocking.
  }
}

async function fetchUploadHistory() {
  const response = await fetch(apiPath("/api/uploads"), {
    credentials: "include",
  });

  if (!response.ok) {
    throw await parseApiError(response);
  }

  const payload = await response.json() as { uploads?: unknown[] };
  return Array.isArray(payload.uploads)
    ? payload.uploads.map(normalizeStoredUpload).filter((upload): upload is StoredUpload => Boolean(upload))
    : [];
}

function collectMissingKeys(payload: unknown): string[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const source = payload as Record<string, unknown>;
  const direct = Array.isArray(source.missing) ? source.missing.filter((item): item is string => typeof item === "string") : [];
  const storage = source.storage && typeof source.storage === "object"
    ? collectMissingKeys(source.storage)
    : [];
  const email = source.email && typeof source.email === "object"
    ? collectMissingKeys(source.email)
    : [];
  const sms = source.sms && typeof source.sms === "object"
    ? collectMissingKeys(source.sms)
    : [];

  return Array.from(new Set([...direct, ...storage, ...email, ...sms]));
}

function providerStatusFromResponse(response: Response): ProviderCheckStatus {
  if (response.ok) return "ready";
  if (response.status === 424 || response.status === 503) return "setup_required";
  return "offline";
}

function statusClass(status: Job["status"]) {
  return status.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function normalizeJob(job: Job): Job {
  return {
    ...job,
    insuranceRequired: Boolean(job.insuranceRequired),
  };
}

function normalizeJobs(jobs: Job[]) {
  return jobs.map(normalizeJob);
}

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "TC";
}

function currentTimeLabel() {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date());
}

function currentDateLabel() {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date());
}

function netScore(item: { upvotes: number; downvotes: number }) {
  return item.upvotes - item.downvotes;
}

function sortedAnswers(answers: CommunityAnswer[]) {
  return [...answers].sort((a, b) => {
    if (a.verifiedFix !== b.verifiedFix) return a.verifiedFix ? -1 : 1;
    return netScore(b) - netScore(a);
  });
}

function communityBadgeLabels(posts: CommunityPost[], personName: string) {
  const answers = posts.flatMap((post) => post.replies).filter((answer) => answer.author === personName);
  const verifiedFixes = answers.filter((answer) => answer.verifiedFix).length;
  const qualityAnswers = answers.filter((answer) => netScore(answer) >= 3).length;
  const badges: string[] = [];

  if (verifiedFixes >= communityBadgeThresholds.firstAssistVerifiedFixes) {
    badges.push("First Assist");
  }
  if (qualityAnswers >= communityBadgeThresholds.mentorQualityAnswers) {
    badges.push("Trade Mentor");
  }
  if (qualityAnswers >= communityBadgeThresholds.topHandQualityAnswers && verifiedFixes > 1) {
    badges.push("Top Hand");
  }

  return badges;
}

function App() {
  const initialJobs = useMemo(() => normalizeJobs(seedJobs), []);
  const initialSelectedId = initialJobs[0].id;
  const [activeView, setActiveView] = useState<NavLabel>("Home");
  const [role, setRole] = useState<Role>("contractor");
  const [onboardingComplete, setOnboardingComplete] = useState(true);
  const [accountProfile, setAccountProfile] = useState<AccountProfile>({
    email: "rivttesting@gmail.com",
    displayName: "Ryan Mitchell",
    organization: "Mitchell Construction",
    location: "Jacksonville, FL",
    specialties: ["Electrical", "Carpentry"],
    plan: brandConfig.pricing.betaPlan.label,
    authMethod: "Google",
  });
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authProviders, setAuthProviders] = useState<Record<string, { ok: boolean; mode: string; missing: string[]; purpose: string }>>({});
  const [query, setQuery] = useState("");
  const [trade, setTrade] = useState<TradeFilter>("All trades");
  const [difficulty, setDifficulty] =
    useState<DifficultyFilter>("Any difficulty");
  const [workType, setWorkType] = useState<WorkTypeFilter>("All work types");
  const [radius, setRadius] = useState<RadiusFilter>("Any radius");
  const [locationQuery, setLocationQuery] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [savedSearch, setSavedSearch] = useState(false);
  const [jobs, setJobs] = useState<Job[]>(initialJobs);
  const [selectedId, setSelectedId] = useState(initialSelectedId);
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [isPostOpen, setPostOpen] = useState(false);
  const [isActivityOpen, setActivityOpen] = useState(false);
  const [isAccountOpen, setAccountOpen] = useState(false);
  const [trustReady, setTrustReady] = useState(true);
  const [scheduleHolds, setScheduleHolds] = useState<Set<number>>(
    () => new Set(),
  );
  const [dispatchNotes] = useState<Record<number, string>>({});
  const [closeouts, setCloseouts] = useState<Record<number, CloseoutRecord>>({});
  const [autoMatchEnabled, setAutoMatchEnabled] = useState(true);
  const [messageDraft, setMessageDraft] = useState(
    "Job details are confirmed. Please confirm arrival window and parking.",
  );
  const [sentMessages, setSentMessages] = useState<string[]>([]);
  const [uploadedRecords, setUploadedRecords] = useState<Set<string>>(
    () => new Set(["Signed scope", "Legal consent accepted"]),
  );
  const [completedTraining, setCompletedTraining] = useState<Set<string>>(
    () => new Set(["Customer-site conduct"]),
  );
  const [reviewRequested, setReviewRequested] = useState(false);
  const [activityFeed, setActivityFeed] = useState<ActivityItem[]>([]);
  const [feedbackItems, setFeedbackItems] = useState<FeedbackItem[]>([]);
  const [feedbackDraft, setFeedbackDraft] = useState("");
  const [feedbackCategory, setFeedbackCategory] =
    useState<FeedbackItem["category"]>("Confusing");
  const [paymentRecords, setPaymentRecords] = useState<PaymentRecord[]>([]);
  const [lockedAccounts, setLockedAccounts] = useState<Set<string>>(
    () => new Set(),
  );
  const [communityPosts, setCommunityPosts] = useState<CommunityPost[]>(seedCommunityPosts);
  const [communityReports, setCommunityReports] = useState<CommunityReport[]>([]);
  const [shoutOuts, setShoutOuts] = useState<ShoutOut[]>(seedShoutOuts);
  const [serverStatus, setServerStatus] = useState<ServerStatus>("checking");
  const [serverHydrated, setServerHydrated] = useState(false);
  const [serverUpdatedAt, setServerUpdatedAt] = useState<string | null>(null);
  const [themeMode, setThemeMode] = useState<ThemeMode>(readThemePreference);
  const [themePalette, setThemePalette] = useState<ThemePalette>(readThemePalettePreference);

  useEffect(() => {
    const root = document.documentElement;
    const theme = brandConfig.theme.modes[themeMode];
    const palette = brandConfig.theme.palettes[themePalette];
    const paletteVariables = palette.modes[themeMode];

    root.dataset.theme = themeMode;
    root.dataset.palette = themePalette;
    root.style.colorScheme = theme.colorScheme;
    Object.entries(theme.cssVariables).forEach(([name, value]) => {
      root.style.setProperty(name, value);
    });
    Object.entries(paletteVariables).forEach(([name, value]) => {
      root.style.setProperty(name, value);
    });

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);
      window.localStorage.setItem(THEME_PALETTE_STORAGE_KEY, themePalette);
    } catch {
      // If browser storage is unavailable, the visual theme still applies for this session.
    }
  }, [themeMode, themePalette]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.sessionStorage.getItem(AUTH_MODE_KEY);
      if (stored === "login" || stored === "signup") {
        setAuthMode(stored);
      }
    } catch {
      // no-op
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(AUTH_MODE_KEY, authMode);
    } catch {
      // no-op
    }
  }, [authMode]);

  useEffect(() => {
    let cancelled = false;
    async function hydrateAuth() {
      try {
        const [meResponse, providersResponse] = await Promise.all([
          fetch(apiPath("/api/auth/me"), { credentials: "include" }),
          fetch(apiPath("/api/auth/providers"), { credentials: "include" }),
        ]);
        const meBody = await meResponse.json().catch(() => ({})) as { user?: AuthUser | null };
        const providersBody = await providersResponse.json().catch(() => ({})) as {
          providers?: Record<string, { ok: boolean; mode: string; missing: string[]; purpose: string }>;
        };
        if (cancelled) return;
        const localUser = readLocalAuthUser();
        setAuthUser(meBody.user ?? localUser ?? null);
        setAuthProviders(providersBody.providers ?? {});
        const hydratedUser = meBody.user ?? localUser;
        if (hydratedUser) {
          setRole(hydratedUser.role);
          setAccountProfile({
            email: hydratedUser.email,
            displayName: hydratedUser.display_name || "RIVT user",
            organization: hydratedUser.organization || `${hydratedUser.display_name || "Crew"} crew`,
            location: hydratedUser.location || "Jacksonville, FL",
            specialties: accountProfile.specialties,
            plan: accountProfile.plan,
            authMethod: hydratedUser.provider === "email" ? "Email" : "Google",
          });
        }
      } catch {
        if (!cancelled) {
          const localUser = readLocalAuthUser();
          if (localUser) {
            setAuthUser(localUser);
            setRole(localUser.role);
            setAccountProfile({
              email: localUser.email,
              displayName: localUser.display_name || "RIVT user",
              organization: localUser.organization || `${localUser.display_name || "Crew"} crew`,
              location: localUser.location || "Jacksonville, FL",
              specialties: accountProfile.specialties,
              plan: accountProfile.plan,
              authMethod: localUser.provider === "email" ? "Email" : "Google",
            });
          }
          setAuthProviders({});
        }
      } finally {
        if (!cancelled) {
          setAuthLoading(false);
        }
      }
    }

    void hydrateAuth();
    return () => {
      cancelled = true;
    };
    // One-time auth bootstrap.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (onboardingComplete) {
      window.scrollTo({ top: 0, left: 0 });
    }
  }, [activeView, onboardingComplete]);

  useEffect(() => {
    if (!serverHydrated) {
      return;
    }

    if (!onboardingComplete) {
      setOnboardingComplete(true);
    }

    if (!trustReady) {
      setTrustReady(true);
    }
  }, [onboardingComplete, serverHydrated, trustReady]);

  function handleToggleTheme() {
    setThemeMode((currentMode) => (currentMode === "dark" ? "light" : "dark"));
  }

  function handleSelectThemePalette(nextPalette: ThemePalette) {
    setThemePalette(nextPalette);
  }

  function applyServerState(nextState: Partial<PersistedAppState>) {
    const nextRole: Role =
      nextState.role === "tradesperson" || nextState.role === "contractor"
        ? nextState.role
        : role;
    const navForRole = visibleNavItems(nextRole);
    const nextJobs =
      Array.isArray(nextState.jobs) && nextState.jobs.length
        ? normalizeJobs(nextState.jobs)
        : null;
    const availableJobs = nextJobs ?? jobs;

    setRole(nextRole);
    if (nextState.activeView !== undefined) {
      setActiveView(
        navForRole.some((item) => item.label === nextState.activeView)
          ? nextState.activeView
          : "Marketplace",
      );
    }
    if (nextState.onboardingComplete !== undefined) {
      setOnboardingComplete(nextState.onboardingComplete);
    }
    if (nextState.accountProfile !== undefined) setAccountProfile(nextState.accountProfile);
    if (nextState.query !== undefined) setQuery(nextState.query);
    if (nextState.trade !== undefined) setTrade(nextState.trade);
    if (nextState.difficulty !== undefined) setDifficulty(nextState.difficulty);
    if (nextState.workType !== undefined) setWorkType(nextState.workType);
    if (nextState.radius !== undefined) setRadius(nextState.radius);
    if (nextState.locationQuery !== undefined) setLocationQuery(nextState.locationQuery);
    if (nextState.verifiedOnly !== undefined) setVerifiedOnly(nextState.verifiedOnly);
    if (nextState.savedSearch !== undefined) setSavedSearch(nextState.savedSearch);
    if (nextJobs) setJobs(nextJobs);
    if (typeof nextState.selectedId === "number" && availableJobs.length) {
      setSelectedId(
        availableJobs.some((job) => job.id === nextState.selectedId)
          ? nextState.selectedId
          : availableJobs[0].id,
      );
    }
    if (Array.isArray(nextState.applications)) setApplications(nextState.applications);
    if (nextState.trustReady !== undefined) setTrustReady(nextState.trustReady);
    if (Array.isArray(nextState.scheduleHolds)) {
      setScheduleHolds(new Set(nextState.scheduleHolds));
    }
    if (nextState.closeouts !== undefined) setCloseouts(nextState.closeouts);
    if (nextState.autoMatchEnabled !== undefined) {
      setAutoMatchEnabled(nextState.autoMatchEnabled);
    }
    if (nextState.messageDraft !== undefined) setMessageDraft(nextState.messageDraft);
    if (Array.isArray(nextState.sentMessages)) setSentMessages(nextState.sentMessages);
    if (Array.isArray(nextState.uploadedRecords)) {
      setUploadedRecords(new Set(nextState.uploadedRecords));
    }
    if (Array.isArray(nextState.completedTraining)) {
      setCompletedTraining(new Set(nextState.completedTraining));
    }
    if (nextState.reviewRequested !== undefined) setReviewRequested(nextState.reviewRequested);
    if (Array.isArray(nextState.activityFeed)) setActivityFeed(nextState.activityFeed);
    if (Array.isArray(nextState.feedbackItems)) setFeedbackItems(nextState.feedbackItems);
    if (Array.isArray(nextState.paymentRecords)) setPaymentRecords(nextState.paymentRecords);
    if (Array.isArray(nextState.lockedAccounts)) {
      setLockedAccounts(new Set(nextState.lockedAccounts));
    }
    if (Array.isArray(nextState.communityPosts)) setCommunityPosts(nextState.communityPosts);
    if (Array.isArray(nextState.communityReports)) setCommunityReports(nextState.communityReports);
    if (Array.isArray(nextState.shoutOuts)) setShoutOuts(nextState.shoutOuts);
  }

  const selectedJob = jobs.find((job) => job.id === selectedId) ?? jobs[0];

  const filteredJobs = useMemo(() => {
    return jobs
      .filter((job) => {
        const searchable = `${job.title} ${job.contractor} ${job.trade} ${
          job.location
        } ${job.tools.join(" ")}`.toLowerCase();
        return searchable.includes(query.toLowerCase());
      })
      .filter((job) => trade === "All trades" || job.trade === trade)
      .filter(
        (job) =>
          difficulty === "Any difficulty" || job.difficulty === difficulty,
      )
      .filter((job) => workType === "All work types" || job.workType === workType)
      .filter((job) =>
        locationQuery.trim()
          ? job.location.toLowerCase().includes(locationQuery.toLowerCase())
          : true,
      )
      .filter((job) => job.distance <= radiusMiles(radius))
      .filter((job) => !verifiedOnly || job.insuranceRequired)
      .sort((a, b) => b.match - a.match);
  }, [difficulty, verifiedOnly, jobs, locationQuery, query, radius, trade, workType]);

  const matchingTalent = useMemo(() => {
    return talent
      .filter((person) => person.trade === selectedJob.trade)
      .sort((a, b) => b.match - a.match);
  }, [selectedJob.trade]);

  const applicationState = applications.find(
    (record) => record.jobId === selectedJob.id,
  )?.state;

  const selectedTalent = matchingTalent[0] ?? talent[0];
  const scheduleHeld = scheduleHolds.has(selectedJob.id);
  const dispatchNote =
    dispatchNotes[selectedJob.id] ??
    "Legal consent ready. Confirm tool list and start window.";
  const closeout = closeouts[selectedJob.id] ?? defaultCloseout;
  const unreadActivities = activityFeed.filter((item) => item.unread).length;
  const toastActivity = activityFeed.find((item) => item.unread);

  const currentState = useMemo<PersistedAppState>(() => ({
    accountProfile,
    activeView,
    activityFeed,
    applications,
    autoMatchEnabled,
    closeouts,
    communityPosts,
    communityReports,
    completedTraining: Array.from(completedTraining),
    difficulty,
    feedbackItems,
    jobs,
    locationQuery,
    lockedAccounts: Array.from(lockedAccounts),
    messageDraft,
    onboardingComplete,
    paymentRecords,
    query,
    radius,
    reviewRequested,
    role,
    savedSearch,
    scheduleHolds: Array.from(scheduleHolds),
    selectedId,
    sentMessages,
    shoutOuts,
    trade,
    trustReady,
    uploadedRecords: Array.from(uploadedRecords),
    verifiedOnly,
    workType,
  }), [
    accountProfile,
    activeView,
    activityFeed,
    applications,
    autoMatchEnabled,
    closeouts,
    communityPosts,
    communityReports,
    completedTraining,
    difficulty,
    feedbackItems,
    jobs,
    locationQuery,
    lockedAccounts,
    messageDraft,
    onboardingComplete,
    paymentRecords,
    query,
    radius,
    reviewRequested,
    role,
    savedSearch,
    scheduleHolds,
    selectedId,
    sentMessages,
    shoutOuts,
    trade,
    trustReady,
    uploadedRecords,
    verifiedOnly,
    workType,
  ]);

  useEffect(() => {
    let cancelled = false;
    discardLegacyLocalState();

    async function hydrateFromServer() {
      try {
        const serverResponse = await fetchServerState();

        if (cancelled) {
          return;
        }

        if (serverResponse.state) {
          applyServerState(serverResponse.state);
        }

        setServerUpdatedAt(serverResponse.updatedAt);
        setServerStatus("connected");
      } catch (error) {
        if (!cancelled) {
          setServerStatus(statusFromError(error));
        }
      } finally {
        if (!cancelled) {
          setServerHydrated(true);
        }
      }
    }

    void hydrateFromServer();

    return () => {
      cancelled = true;
    };
    // Run once on mount so managed server data is the only durable source of truth.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!serverHydrated) {
      return;
    }

    const timeout = window.setTimeout(() => {
      void saveServerState(currentState)
        .then((response) => {
          setServerUpdatedAt(response.updatedAt);
          setServerStatus("connected");
        })
        .catch((error) => {
          setServerStatus(statusFromError(error));
        });
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [currentState, serverHydrated]);

  function addActivity(title: string, detail: string) {
    void recordServerEvent("activity", { title, detail, role, activeView });
    setActivityFeed((current) => [
      {
        id: Date.now() + current.length,
        title,
        detail,
        timestamp: currentTimeLabel(),
        unread: true,
      },
      ...current,
    ].slice(0, 16));
  }

  function dismissActivity(activityId: number) {
    setActivityFeed((current) =>
      current.map((item) =>
        item.id === activityId ? { ...item, unread: false } : item,
      ),
    );
  }

  function markAllActivityRead() {
    setActivityFeed((current) =>
      current.map((item) => ({ ...item, unread: false })),
    );
  }

  async function handleAuthSubmit(form: { email: string; password: string; displayName?: string; organization?: string; location?: string; role?: Role }) {
    setAuthError(null);
    try {
      const path = authMode === "signup" ? "/api/auth/signup" : "/api/auth/login";
      const response = await fetch(apiPath(path), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = await response.json().catch(() => ({})) as { ok?: boolean; error?: string; user?: AuthUser };
      if (!response.ok || !body.user) {
        throw new Error(body.error || "Sign-in failed.");
      }
      setAuthUser(body.user);
      saveLocalAuthUser(body.user);
      setRole(body.user.role);
      setAccountProfile({
        email: body.user.email,
        displayName: body.user.display_name || form.displayName || "RIVT user",
        organization: form.organization || `${form.displayName || "Crew"} crew`,
        location: form.location || "Jacksonville, FL",
        specialties: accountProfile.specialties,
        plan: accountProfile.plan,
        authMethod: authMode === "signup" ? "Email" : (body.user.provider === "email" ? "Email" : "Google"),
      });
      setOnboardingComplete(false);
      addActivity("Authenticated", `${body.user.email} is now signed in.`);
    } catch (error) {
      const localUser: AuthUser = {
        id: `local-${Date.now()}`,
        email: form.email,
        provider: "email",
        display_name: form.displayName || form.email.split("@")[0] || "RIVT user",
        role: form.role ?? "contractor",
        organization: form.organization || `${form.displayName || "Crew"} crew`,
        location: form.location || "Jacksonville, FL",
      };
      setAuthUser(localUser);
      saveLocalAuthUser(localUser);
      setRole(localUser.role);
      setAccountProfile({
        email: localUser.email,
        displayName: localUser.display_name,
        organization: localUser.organization,
        location: localUser.location,
        specialties: accountProfile.specialties,
        plan: accountProfile.plan,
        authMethod: "Email",
      });
      setOnboardingComplete(false);
      addActivity("Authenticated locally", `${localUser.email} is now signed in with browser session auth.`);
      if (error instanceof Error) {
        setAuthError(null);
      }
    }
  }

  async function handleLogout() {
    try {
      await fetch(apiPath("/api/auth/logout"), {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // Ignore logout network hiccups; the local session can still be cleared.
    } finally {
      setAuthUser(null);
      saveLocalAuthUser(null);
    }
  }

  function handleNavigate(view: NavLabel) {
    setActiveView(view);
    setActivityOpen(false);
    setAccountOpen(false);
  }

  function handleRoleChange(nextRole: Role) {
    setRole(nextRole);
    if (!roleNavItems[nextRole].includes(activeView)) {
      setActiveView("Marketplace");
    }
    setTrade(
      nextRole === "tradesperson" && accountProfile.specialties[0]
        ? accountProfile.specialties[0]
        : "All trades",
    );
    addActivity(
      `${nextRole === "contractor" ? "Contractor" : "Tradesperson"} mode active`,
      nextRole === "contractor"
        ? "Job posting and invite actions are now prioritized."
        : "Job feed, applications, and portfolio actions are now prioritized.",
    );
  }

  function handleReviewConsent() {
    setTrustReady(true);
    setUploadedRecords((current) => {
      const next = new Set(current);
      next.add("Legal consent accepted");
      return next;
    });
    addActivity(
      "Legal consent reviewed",
      "Connection-service consent is accepted. ID checks stay required before real posting or accepting.",
    );
  }

  function handleToggleAutoMatch() {
    const next = !autoMatchEnabled;
    setAutoMatchEnabled(next);
    addActivity(
      next ? "Best-match sorting resumed" : "Best-match sorting paused",
      next
        ? "The marketplace is sorting jobs by best fit again."
        : "The current job order stays visible while sorting is paused.",
    );
  }

  function handleToggleSavedSearch() {
    const next = !savedSearch;
    setSavedSearch(next);
    addActivity(
      next ? "Search saved" : "Saved search removed",
      next
        ? `${trade}, ${difficulty}, ${radius} will stay ready for testing.`
        : "The feed is back to an unsaved filter set.",
    );
  }

  function handleApplyForJob(jobId: number) {
    const job = jobs.find((candidate) => candidate.id === jobId) ?? selectedJob;
    const alreadyApplied = applications.some((record) => record.jobId === jobId);
    const matchedTalent =
      talent
        .filter((person) => person.trade === job.trade)
        .sort((a, b) => b.match - a.match)[0] ?? selectedTalent;

    setApplications((current) => {
      const existing = current.find((record) => record.jobId === jobId);
      if (existing) {
        return current.map((record) =>
          record.jobId === jobId
            ? { ...record, state: "Submitted" }
            : record,
        );
      }

      return [
        ...current,
        {
          jobId,
          talentId: matchedTalent.id,
          state: "Submitted",
        },
      ];
    });
    setJobs((current) =>
      current.map((candidate) =>
        candidate.id === jobId
          ? {
              ...candidate,
              applicants: alreadyApplied ? candidate.applicants : candidate.applicants + 1,
              status: "Shortlisting",
            }
          : candidate,
      ),
    );
    addActivity(
      "Portfolio submitted",
      `${matchedTalent.name} is attached to ${job.title}. Contractor review is now ready.`,
    );
  }

  function handleApply() {
    handleApplyForJob(selectedJob.id);
  }

  function handleInviteForJob(jobId: number) {
    const job = jobs.find((candidate) => candidate.id === jobId) ?? selectedJob;
    const matchedTalent =
      talent
        .filter((person) => person.trade === job.trade)
        .sort((a, b) => b.match - a.match)[0] ?? selectedTalent;

    setApplications((current) => [
      ...current.filter((record) => record.jobId !== jobId),
      {
        jobId,
        talentId: matchedTalent.id,
        state: "Invited",
      },
    ]);
    setJobs((current) =>
      current.map((candidate) =>
        candidate.id === jobId
          ? { ...candidate, status: "Shortlisting" }
          : candidate,
      ),
    );
    addActivity(
      "Crew invite sent",
      `${matchedTalent.name} was invited to ${job.title}.`,
    );
  }

  function handleInvite() {
    handleInviteForJob(selectedJob.id);
  }

  function handleScheduleHold() {
    const isHeld = scheduleHolds.has(selectedJob.id);
    setScheduleHolds((current) => {
      const next = new Set(current);
      if (next.has(selectedJob.id)) {
        next.delete(selectedJob.id);
      } else {
        next.add(selectedJob.id);
      }

      return next;
    });
    setJobs((current) =>
      current.map((job) =>
        job.id === selectedJob.id
          ? { ...job, status: isHeld ? "Shortlisting" : "Scheduled" }
          : job,
      ),
    );
    addActivity(
      isHeld ? "Schedule hold released" : "Schedule hold placed",
      `${selectedJob.title} is ${isHeld ? "back in shortlisting" : "held on the calendar"}.`,
    );
  }

  function updateJobCloseout(jobId: number, update: Partial<CloseoutRecord>) {
    setCloseouts((current) => ({
      ...current,
      [jobId]: {
        ...(current[jobId] ?? defaultCloseout),
        ...update,
      },
    }));
  }

  function handleSubmitCloseoutPacket(jobId = selectedId) {
    const job = jobs.find((candidate) => candidate.id === jobId) ?? selectedJob;
    updateJobCloseout(jobId, { packetSubmitted: true });
    setJobs((current) =>
      current.map((job) =>
        job.id === jobId && job.status !== "Paid / Closed"
          ? { ...job, status: "Completion Pending" }
          : job,
      ),
    );
    setUploadedRecords((current) => {
      const next = new Set(current);
      next.add("Completion photos");
      return next;
    });
    addActivity(
      "Completion packet recorded",
      `${job.title} now has completion photos queued in Records.`,
    );
  }

  function handleApproveCloseout(jobId = selectedId) {
    const job = jobs.find((candidate) => candidate.id === jobId) ?? selectedJob;
    const paymentTalent =
      talent
        .filter((person) => person.trade === job.trade)
        .sort((a, b) => b.match - a.match)[0] ?? selectedTalent;

    updateJobCloseout(jobId, { approved: true, packetSubmitted: true, dispute: false });
    setJobs((current) =>
      current.map((job) =>
        job.id === jobId && job.status !== "Paid / Closed"
          ? { ...job, status: "Payment Pending" }
          : job,
      ),
    );
    setPaymentRecords((current) => {
      const existing = current.find((record) => record.jobId === jobId);
      if (existing) {
        return current.map((record) =>
          record.jobId === jobId
            ? {
                ...record,
                jobTitle: job.title,
                worker: paymentTalent.name,
                amount: job.pay,
                method: "Direct payment",
                status: record.status === "Paid / Closed" ? record.status : "Payment pending",
                date: record.date || currentDateLabel(),
              }
            : record,
        );
      }

      return [
        {
          id: Date.now(),
          jobId,
          jobTitle: job.title,
          worker: paymentTalent.name,
          amount: job.pay,
          method: "Direct payment",
          status: "Payment pending",
          date: currentDateLabel(),
        },
        ...current,
      ];
    });
    setUploadedRecords((current) => {
      const next = new Set(current);
      next.add("Payment method note");
      next.add("Review prompt");
      return next;
    });
    addActivity(
      "Closeout approved",
      `${job.title} is ready for direct payment logging and review.`,
    );
  }

  function handleMarkPaymentPaid(jobId: number) {
    const job = jobs.find((candidate) => candidate.id === jobId);
    const title = job?.title ?? "Selected work order";

    setPaymentRecords((current) =>
      current.map((record) =>
        record.jobId === jobId
          ? { ...record, status: "Paid / Closed", date: currentDateLabel() }
          : record,
      ),
    );
    setJobs((current) =>
      current.map((candidate) =>
        candidate.id === jobId ? { ...candidate, status: "Paid / Closed" } : candidate,
      ),
    );
    setCloseouts((current) => ({
      ...current,
      [jobId]: {
        ...(current[jobId] ?? defaultCloseout),
        approved: true,
        packetSubmitted: true,
        dispute: false,
      },
    }));
    setUploadedRecords((current) => {
      const next = new Set(current);
      next.add("Payment method note");
      next.add("Review prompt");
      return next;
    });
    addActivity(
      "Payment marked paid",
      `${title} is closed in the bookkeeping ledger.`,
    );
  }

  function handleExportPayments() {
    if (!paymentRecords.length) {
      addActivity(
        "No payments to export",
        "Approve a closeout first to create a bookkeeping row.",
      );
      return;
    }

    const headers = ["Job", "Worker", "Amount", "Method", "Status", "Date"];
    const escapeCsv = (value: string | number) =>
      `"${String(value).replace(/"/g, '""')}"`;
    const rows = paymentRecords.map((record) => [
      record.jobTitle,
      record.worker,
      record.amount,
      record.method,
      record.status,
      record.date,
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map(escapeCsv).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${brandConfig.appSlug}-payment-history-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    addActivity(
      "Payment CSV exported",
      `${paymentRecords.length} payment record${paymentRecords.length === 1 ? "" : "s"} downloaded for bookkeeping.`,
    );
  }

  function handleRateJob(rating: number) {
    updateJobCloseout(selectedId, { rating });
    addActivity(
      "Review rating saved",
      `${selectedJob.title} was rated ${rating} star${rating === 1 ? "" : "s"}.`,
    );
  }

  function handleVoteCommunityPost(postId: number, direction: "up" | "down") {
    setCommunityPosts((current) =>
      current.map((post) =>
        post.id === postId
          ? {
              ...post,
              upvotes: post.upvotes + (direction === "up" ? 1 : 0),
              downvotes: post.downvotes + (direction === "down" ? 1 : 0),
            }
          : post,
      ),
    );
  }

  function handleVoteCommunityAnswer(postId: number, answerId: number, direction: "up" | "down") {
    setCommunityPosts((current) =>
      current.map((post) =>
        post.id === postId
          ? {
              ...post,
              replies: post.replies.map((answer) =>
                answer.id === answerId
                  ? {
                      ...answer,
                      upvotes: answer.upvotes + (direction === "up" ? 1 : 0),
                      downvotes: answer.downvotes + (direction === "down" ? 1 : 0),
                    }
                  : answer,
              ),
            }
          : post,
      ),
    );
  }

  function handleAddCommunityAnswer(postId: number, body: string) {
    const post = communityPosts.find((candidate) => candidate.id === postId);
    if (!post) {
      return;
    }

    setCommunityPosts((current) =>
      current.map((candidate) =>
        candidate.id === postId
          ? {
              ...candidate,
              status: candidate.status === "Needs a pro answer" ? "Open" : candidate.status,
              replies: [
                {
                  id: Date.now(),
                  author: accountProfile.displayName,
                  body,
                  upvotes: 0,
                  downvotes: 0,
                  verifiedFix: false,
                },
                ...candidate.replies,
              ],
            }
          : candidate,
      ),
    );
    addActivity(
      "Shop Talk answer posted",
      `${accountProfile.displayName} answered "${post.title}".`,
    );
  }

  function handleVerifyCommunityAnswer(postId: number, answerId: number) {
    const post = communityPosts.find((candidate) => candidate.id === postId);
    const answer = post?.replies.find((candidate) => candidate.id === answerId);
    if (!post || !answer) {
      return;
    }

    setCommunityPosts((current) =>
      current.map((candidate) =>
        candidate.id === postId
          ? {
              ...candidate,
              status: "Verified Fix",
              replies: candidate.replies.map((reply) =>
                reply.id === answerId ? { ...reply, verifiedFix: true, upvotes: Math.max(reply.upvotes, 3) } : reply,
              ),
            }
          : candidate,
      ),
    );
    addActivity(
      "Verified Fix marked",
      `${answer.author}'s answer on "${post.title}" now appears as the trusted fix.`,
    );
  }

  function handleReportCommunityPost(postId: number, reason: CommunityReport["reason"]) {
    const post = communityPosts.find((candidate) => candidate.id === postId);
    if (!post) {
      return;
    }

    setCommunityReports((current) => {
      const alreadyFlagged = current.some(
        (report) => report.postId === postId && report.reason === reason && report.status === "Flagged",
      );
      if (alreadyFlagged) {
        return current;
      }

      return [
        {
          id: Date.now() + current.length,
          postId,
          postTitle: post.title,
          reason,
          status: "Flagged",
        },
        ...current,
      ];
    });
    addActivity(
      "Shop Talk report filed",
      `"${post.title}" is in the admin moderation queue for ${reason.toLowerCase()}.`,
    );
  }

  function handleCreateCommunityPrompt() {
    const title = `${selectedJob.trade}: what would you check first on ${selectedJob.title.toLowerCase()}?`;
    const existing = communityPosts.find((post) => post.title === title);
    setActiveView("Shop Talk");

    if (existing) {
      addActivity(
        "Shop Talk prompt already exists",
        `"${existing.title}" is ready for answers.`,
      );
      return;
    }

    setCommunityPosts((current) => [
      {
        id: Date.now(),
        title,
        trade: selectedJob.trade,
        author: accountProfile.displayName,
        body: `Looking at ${selectedJob.location} work: tools are ${selectedJob.tools.slice(0, 3).join(", ")}. What would you verify before committing?`,
        upvotes: 0,
        downvotes: 0,
        replies: [],
        createdAt: "Just now",
        status: "Needs a pro answer",
      },
      ...current,
    ]);
    addActivity(
      "Shop Talk prompt created",
      `"${title}" is ready for the community to answer.`,
    );
  }

  function handleResolveCommunityReport(reportId: number, status: CommunityReport["status"]) {
    const report = communityReports.find((candidate) => candidate.id === reportId);
    if (!report) {
      return;
    }

    setCommunityReports((current) =>
      current.map((candidate) =>
        candidate.id === reportId ? { ...candidate, status } : candidate,
      ),
    );
    if (status === "Removed") {
      setCommunityPosts((current) => current.filter((post) => post.id !== report.postId));
    }
    addActivity(
      "Moderation updated",
      `"${report.postTitle}" was marked ${status.toLowerCase()}.`,
    );
  }

  function handleCreateShoutOut(to: string, tradeName: Trade) {
    const alreadyPosted = shoutOuts.some(
      (shoutOut) => shoutOut.from === accountProfile.organization && shoutOut.to === to,
    );
    if (alreadyPosted) {
      addActivity(
        "Shout-out already exists",
        `${accountProfile.organization} has already recommended ${to}.`,
      );
      return;
    }

    setShoutOuts((current) => [
      {
        id: Date.now(),
        from: accountProfile.organization,
        to,
        trade: tradeName,
        createdAt: "Just now",
        message: `${to} is recommended for reliable ${tradeName.toLowerCase()} work and clear job communication.`,
      },
      ...current,
    ]);
    addActivity(
      "Shout-out posted",
      `${to} now has a public recommendation from ${accountProfile.organization}.`,
    );
  }

  function handlePostJob(job: Job) {
    setJobs((current) => [job, ...current]);
    setQuery("");
    setTrade("All trades");
    setDifficulty("Any difficulty");
    setWorkType("All work types");
    setRadius("Any radius");
    setLocationQuery("");
    setSelectedId(job.id);
    setActiveView("Marketplace");
    setPostOpen(false);
    addActivity(
      "Job published",
      `${job.title} is now live in ${job.location} with ${job.tools.length} tool requirement${job.tools.length === 1 ? "" : "s"}.`,
    );
  }

  function handleOnboardingComplete(result: OnboardingResult) {
    setRole(result.role);
    setAccountProfile({
      email: result.email,
      displayName: result.displayName,
      organization: result.organization,
      location: result.location,
      specialties: result.specialties,
      plan: result.plan,
      authMethod: result.authMethod,
    });
    setTrade(
      result.role === "tradesperson" && result.specialties[0]
        ? result.specialties[0]
        : "All trades",
    );
    setTrustReady(true);
    setUploadedRecords(
      () => new Set(["Signed scope", "Legal consent accepted"]),
    );
    setActiveView("Home");
    setOnboardingComplete(true);
    addActivity(
      "Account setup complete",
      `${result.role === "contractor" ? "Contractor" : "Tradesperson"} testing is ready with ${result.plan}.`,
    );
  }

  function openJob(jobId: number) {
    setSelectedId(jobId);
    setActiveView("Marketplace");
    setActivityOpen(false);
    setAccountOpen(false);
  }

  function handleSendMessage() {
    const trimmed = messageDraft.trim();
    if (!trimmed) {
      addActivity(
        "Message not sent",
        "Write a message in the composer before sending.",
      );
      return;
    }

    setSentMessages((current) => [trimmed, ...current]);
    setMessageDraft("");
    addActivity(
      "Message sent",
      `${selectedJob.title} thread now includes your update.`,
    );
  }

  function handleToggleRecord(recordName: string) {
    const isReady = uploadedRecords.has(recordName);
    setUploadedRecords((current) => {
      const next = new Set(current);
      if (next.has(recordName)) {
        next.delete(recordName);
      } else {
        next.add(recordName);
      }

      return next;
    });
    addActivity(
      isReady ? "Record item reopened" : "Record item completed",
      `${recordName} is now ${isReady ? "needed again" : "ready"} for ${selectedJob.title}.`,
    );
  }

  function handleToggleTraining(moduleName: string) {
    const isComplete = completedTraining.has(moduleName);
    setCompletedTraining((current) => {
      const next = new Set(current);
      if (next.has(moduleName)) {
        next.delete(moduleName);
      } else {
        next.add(moduleName);
      }

      return next;
    });
    addActivity(
      isComplete ? "Training reopened" : "Training completed",
      `${moduleName} is ${isComplete ? "available to retake" : "marked complete"}.`,
    );
  }

  function handleRequestReview() {
    setReviewRequested(true);
    setUploadedRecords((current) => {
      const next = new Set(current);
      next.add("Review prompt");
      return next;
    });
    addActivity(
      "Review request sent",
      `${selectedJob.title} now has a pending two-way review prompt.`,
    );
  }

  function handleSubmitFeedback() {
    const message = feedbackDraft.trim();
    if (!message) {
      addActivity(
        "Feedback not sent",
        "Add a short note before sending feedback.",
      );
      return;
    }

    setFeedbackItems((current) => [
      {
        id: Date.now(),
        category: feedbackCategory,
        message,
        timestamp: `${currentDateLabel()} ${currentTimeLabel()}`,
      },
      ...current,
    ]);
    setFeedbackDraft("");
    addActivity(
      "Feedback captured",
      `${feedbackCategory} note saved for the beta improvement list.`,
    );
  }

  function handleToggleAdminLock(accountName: string) {
    const wasLocked = lockedAccounts.has(accountName);
    setLockedAccounts((current) => {
      const next = new Set(current);
      if (next.has(accountName)) {
        next.delete(accountName);
      } else {
        next.add(accountName);
      }
      return next;
    });
    addActivity(
      wasLocked ? "Account unlocked" : "Account locked",
      `${accountName} is ${wasLocked ? "back in beta access" : "blocked pending review"}.`,
    );
  }

  const page = pageCopy[activeView];
  const nextTrainingModule = trainingModules.find(
    (moduleName) => !completedTraining.has(moduleName),
  );
  const introAction = (() => {
    switch (activeView) {
      case "Home":
        return { label: "Open Shop Talk", icon: MessageCircle, onClick: () => setActiveView("Shop Talk") };
      case "Applications":
        return { label: "Submit active portfolio", icon: Send, onClick: handleApply };
      case "Shop Talk":
        return { label: "Ask from active work order", icon: MessageSquareText, onClick: handleCreateCommunityPrompt };
      case "Tools":
        return { label: "Open work order", icon: BriefcaseBusiness, onClick: () => openJob(selectedJob.id) };
      case "Invites":
        return { label: "Invite top crew", icon: UserCheck, onClick: handleInvite };
      case "My Crew":
      case "Trust & Legal":
        return { label: trustReady ? "Trust ready" : "Review consent", icon: ShieldCheck, onClick: handleReviewConsent };
      case "Messages":
        return { label: "Send update", icon: Send, onClick: handleSendMessage };
      case "Records":
        return { label: "Record completion", icon: FolderOpen, onClick: () => handleSubmitCloseoutPacket() };
      case "Safety & Training":
        return {
          label: nextTrainingModule ? "Complete next training" : "Training complete",
          icon: GraduationCap,
          onClick: () => {
            if (nextTrainingModule) {
              handleToggleTraining(nextTrainingModule);
            }
          },
        };
      case "Reviews":
        return {
          label: reviewRequested ? "Review requested" : "Request customer review",
          icon: Star,
          onClick: handleRequestReview,
        };
      case "Feedback":
        return { label: "Send feedback", icon: MessageCircle, onClick: handleSubmitFeedback };
      case "Settings":
        return { label: "Open settings", icon: ShieldCheck, onClick: () => setAccountOpen(true) };
      case "Admin":
        return { label: "Review beta", icon: ClipboardCheck, onClick: () => setActiveView("Admin") };
      default:
        return role === "tradesperson"
          ? { label: "Apply selected", icon: FileCheck2, onClick: handleApply }
          : { label: "Post job", icon: Plus, onClick: () => setPostOpen(true) };
    }
  })();
  const IntroActionIcon = introAction.icon;
  const profileSubtitle =
    role === "contractor"
      ? accountProfile.organization
      : accountProfile.specialties.slice(0, 2).join(", ");
  const serverStatusLabel =
    serverStatus === "connected"
      ? "Server saved"
      : serverStatus === "checking"
        ? "Checking storage"
        : serverStatus === "setup_required"
          ? "Storage setup needed"
          : "Server unavailable";
  const serverStatusTitle =
    serverStatus === "connected" && serverUpdatedAt
      ? `Last server save ${new Date(serverUpdatedAt).toLocaleString()}`
      : serverStatus === "setup_required"
        ? "Managed Postgres and object storage are required before customer data can be saved."
        : serverStatus === "offline"
          ? "The API is unavailable. Local browser backup is disabled for customer safety."
          : "Checking managed backend persistence.";

  if (authLoading) {
    return <LaunchLoader />;
  }

  if (!authUser) {
    return (
      <AuthGate
        mode={authMode}
        error={authError}
        providers={authProviders}
        onModeChange={setAuthMode}
        onSubmit={handleAuthSubmit}
      />
    );
  }

  if (!onboardingComplete) {
    return (
      <OnboardingFlow
        themeMode={themeMode}
        onToggleTheme={handleToggleTheme}
        onComplete={handleOnboardingComplete}
        initialRole={role}
        initialEmail={accountProfile.email}
        initialDisplayName={accountProfile.displayName}
        initialOrganization={accountProfile.organization}
        initialLocation={accountProfile.location}
        initialSpecialties={accountProfile.specialties}
        initialAuthMethod={accountProfile.authMethod}
      />
    );
  }

  return (
    <div className="app-shell">
      <Sidebar
        role={role}
        activeView={activeView}
        selectedJob={selectedJob}
        profile={accountProfile}
        onNavigate={handleNavigate}
      />
      <main className="workspace">
        <header className="topbar">
          <RoleSwitch role={role} setRole={handleRoleChange} />

          <div className="searchbox">
            <Search size={18} aria-hidden="true" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search jobs, crews, trades, or tools"
              aria-label="Search jobs, crews, trades, or tools"
            />
          </div>

          <button
            type="button"
            className="primary-action desktop-post-button"
            onClick={() => setPostOpen(true)}
          >
            <Plus size={16} />
            Post a Job
          </button>

          <ThemeToggle
            themeMode={themeMode}
            onToggleTheme={handleToggleTheme}
            variant="surface"
          />

          <button
            type="button"
            className={unreadActivities ? "icon-button alert-button" : "icon-button"}
            aria-label="Notifications"
            onClick={() => setActivityOpen(true)}
          >
            <Bell size={18} />
            {unreadActivities > 0 && <span>{unreadActivities}</span>}
          </button>
          <button
            type="button"
            className="user-menu"
            aria-label={`Signed in ${role === "contractor" ? "contractor" : "tradesperson"}`}
            onClick={() => setAccountOpen(true)}
          >
            <span className="user-avatar">{getInitials(accountProfile.displayName)}</span>
            <span className="user-menu-copy">
              <strong>{accountProfile.displayName}</strong>
              <span>{profileSubtitle || accountProfile.location}</span>
            </span>
            <ChevronDown size={16} />
          </button>
        </header>

        <MobileNavStrip
          role={role}
          activeView={activeView}
          onNavigate={handleNavigate}
          onPostJob={() => setPostOpen(true)}
        />

        <section
          className={[
            "page-intro",
            activeView === "Home" ? "home-intro" : "",
            activeView === "Tools" ? "tools-intro" : "",
          ].filter(Boolean).join(" ")}
        >
          <div>
            <h1>{activeView === "Home" ? `Good morning, ${accountProfile.displayName.split(" ")[0]}` : page.title}</h1>
            <p>
              {activeView === "Home"
                ? `Here's what's happening in ${accountProfile.location}.`
                : page.description}
            </p>
          </div>
          <button
            className="primary-action"
            onClick={introAction.onClick}
          >
            <IntroActionIcon size={18} />
            {introAction.label}
          </button>
        </section>

        {activeView === "Marketplace" ? (
          <MarketplaceView
            role={role}
            jobs={filteredJobs}
            selectedJob={selectedJob}
            matchingTalent={matchingTalent}
            applications={applications}
            applicationState={applicationState}
            savedSearch={savedSearch}
            radius={radius}
            trade={trade}
            setTrade={setTrade}
            difficulty={difficulty}
            setDifficulty={setDifficulty}
            workType={workType}
            setWorkType={setWorkType}
            locationQuery={locationQuery}
            setLocationQuery={setLocationQuery}
            verifiedOnly={verifiedOnly}
            setVerifiedOnly={setVerifiedOnly}
            setRadius={setRadius}
            setSelectedId={setSelectedId}
            onToggleSavedSearch={handleToggleSavedSearch}
            scheduleHeld={scheduleHeld}
            dispatchNote={dispatchNote}
            closeout={closeout}
            trustReady={trustReady}
            closeouts={closeouts}
            autoMatchEnabled={autoMatchEnabled}
            onToggleAutoMatch={handleToggleAutoMatch}
            onReviewConsent={handleReviewConsent}
            onApply={handleApply}
            onInvite={handleInvite}
            onScheduleHold={handleScheduleHold}
            onSubmitCloseoutPacket={handleSubmitCloseoutPacket}
          />
        ) : (
          <OperationsWorkspace
            view={activeView}
            role={role}
            accountProfile={accountProfile}
            jobs={jobs}
            selectedJob={selectedJob}
            matchingTalent={matchingTalent}
            applications={applications}
            closeouts={closeouts}
            scheduleHolds={scheduleHolds}
            dispatchNotes={dispatchNotes}
            trustReady={trustReady}
            uploadedRecords={uploadedRecords}
            completedTraining={completedTraining}
            messageDraft={messageDraft}
            sentMessages={sentMessages}
            reviewRequested={reviewRequested}
            feedbackItems={feedbackItems}
            feedbackDraft={feedbackDraft}
            feedbackCategory={feedbackCategory}
            paymentRecords={paymentRecords}
            activityFeed={activityFeed}
            lockedAccounts={lockedAccounts}
            communityPosts={communityPosts}
            communityReports={communityReports}
            shoutOuts={shoutOuts}
            onPostJob={() => setPostOpen(true)}
            onNavigate={handleNavigate}
            onOpenJob={openJob}
            onApply={handleApply}
            onApplyToJob={handleApplyForJob}
            onInvite={handleInvite}
            onInviteToJob={handleInviteForJob}
            onReviewConsent={handleReviewConsent}
            onToggleRecord={handleToggleRecord}
            onSubmitCloseoutPacket={handleSubmitCloseoutPacket}
            onApproveCloseout={handleApproveCloseout}
            onRateJob={handleRateJob}
            onToggleTraining={handleToggleTraining}
            onMessageDraft={setMessageDraft}
            onSendMessage={handleSendMessage}
            onRequestReview={handleRequestReview}
            onFeedbackDraft={setFeedbackDraft}
            onFeedbackCategory={setFeedbackCategory}
            onSubmitFeedback={handleSubmitFeedback}
            onMarkPaymentPaid={handleMarkPaymentPaid}
            onExportPayments={handleExportPayments}
            onToggleAdminLock={handleToggleAdminLock}
            onVoteCommunityPost={handleVoteCommunityPost}
            onVoteCommunityAnswer={handleVoteCommunityAnswer}
            onAddCommunityAnswer={handleAddCommunityAnswer}
            onVerifyCommunityAnswer={handleVerifyCommunityAnswer}
            onReportCommunityPost={handleReportCommunityPost}
            onResolveCommunityReport={handleResolveCommunityReport}
            onCreateCommunityPrompt={handleCreateCommunityPrompt}
            onCreateShoutOut={handleCreateShoutOut}
          />
        )}
      </main>

      {toastActivity && (
        <ActivityToast
          activity={toastActivity}
          onDismiss={() => dismissActivity(toastActivity.id)}
        />
      )}

      {isActivityOpen && (
        <ActivityPanel
          items={activityFeed}
          onClose={() => setActivityOpen(false)}
          onMarkAllRead={markAllActivityRead}
          onNavigate={handleNavigate}
        />
      )}

      {isAccountOpen && (
        <AccountPanel
          role={role}
          profile={accountProfile}
          trustReady={trustReady}
          recordCount={uploadedRecords.size}
          trainingProgress={Math.round((completedTraining.size / trainingModules.length) * 100)}
          themeMode={themeMode}
          themePalette={themePalette}
          communityBadges={communityBadgeLabels(communityPosts, accountProfile.displayName)}
          shoutOutCount={
            shoutOuts.filter(
              (shoutOut) =>
                shoutOut.to === accountProfile.displayName ||
                shoutOut.from === accountProfile.organization,
            ).length
          }
          onToggleTheme={handleToggleTheme}
          onSelectThemePalette={handleSelectThemePalette}
          onClose={() => setAccountOpen(false)}
          onNavigate={handleNavigate}
        />
      )}

      {isPostOpen && (
        <PostJobModal onClose={() => setPostOpen(false)} onPost={handlePostJob} />
      )}
    </div>
  );
}

function LaunchLoader() {
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <LogoLockup />
        <p>Preparing your workspace...</p>
      </section>
    </main>
  );
}

function AuthGate({
  mode,
  error,
  providers,
  onModeChange,
  onSubmit,
}: {
  mode: "login" | "signup";
  error: string | null;
  providers: Record<string, { ok: boolean; mode: string; missing: string[]; purpose: string }>;
  onModeChange: (mode: "login" | "signup") => void;
  onSubmit: (form: { email: string; password: string; displayName?: string; organization?: string; location?: string; role?: Role }) => void;
}) {
  const [email, setEmail] = useState("rivttesting@gmail.com");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("Ryan Mitchell");
  const [organization, setOrganization] = useState("Mitchell Construction");
  const [location, setLocation] = useState("Jacksonville, FL");
  const [role, setRole] = useState<Role>("contractor");
  const providerIcons = {
    google: GoogleIcon,
    facebook: FacebookIcon,
    apple: AppleIcon,
    email: EmailIcon,
  } as const;

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <LogoLockup />
        <h1>{mode === "signup" ? "Create your account" : "Welcome back"}</h1>
        <p>Sign in to your crew, jobs, tools, and records.</p>

        <div className="auth-provider-grid">
          {([
            ["google", GoogleIcon],
            ["facebook", FacebookIcon],
            ["apple", AppleIcon],
            ["email", EmailIcon],
          ] as const).map(([key, label]) => {
            const provider = providers[key];
            const ok = provider?.ok ?? (key === "email");
            const Icon = label;
              return (
                <button
                  type="button"
                  key={key}
                  className={[ok ? "" : "disabled", key === "google" ? "google-auth-button" : ""].filter(Boolean).join(" ")}
                  title={ok ? provider?.purpose ?? key : `Setup required: ${provider?.missing.join(", ") ?? "provider keys"}`}
                  onClick={() => {
                    if (!ok) return;
                    if (key === "google") {
                    window.location.assign(apiPath("/api/auth/google/start"));
                    return;
                  }
                  if (key === "email") {
                    onModeChange(mode);
                  }
                  }}
                >
                  <Icon />
                  {key === "google" && <span>Google</span>}
                  <span className="sr-only">{key}</span>
                </button>
              );
            })}
        </div>

        <div className="auth-toggle">
          <button type="button" className={mode === "login" ? "selected" : ""} onClick={() => onModeChange("login")}>Log in</button>
          <button type="button" className={mode === "signup" ? "selected" : ""} onClick={() => onModeChange("signup")}>Sign up</button>
        </div>

        <div className="auth-form-grid">
          <label>
            <span>Email</span>
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" />
          </label>
          <label>
            <span>Password</span>
            <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" />
          </label>
          {mode === "signup" && (
            <>
              <label>
                <span>Name</span>
                <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
              </label>
              <label>
                <span>{role === "contractor" ? "Company" : "Portfolio"}</span>
                <input value={organization} onChange={(event) => setOrganization(event.target.value)} />
              </label>
              <label>
                <span>Location</span>
                <input value={location} onChange={(event) => setLocation(event.target.value)} />
              </label>
              <div className="auth-toggle">
                <button type="button" className={role === "contractor" ? "selected" : ""} onClick={() => setRole("contractor")}>Contractor</button>
                <button type="button" className={role === "tradesperson" ? "selected" : ""} onClick={() => setRole("tradesperson")}>Tradesperson</button>
              </div>
            </>
          )}
        </div>

        {error ? <p className="auth-error">{error}</p> : null}

        <button
          type="button"
          className="primary-action"
          onClick={() => onSubmit({ email, password, displayName, organization, location, role })}
        >
          {mode === "signup" ? "Create account" : "Log in"}
        </button>
      </section>
    </main>
  );
}

function LogoLockup() {
  return (
    <div className="rivt-lockup" aria-label="RIVT">
      <picture className="rivt-wordmark" aria-hidden="true">
        <source srcSet="/brand/rivt-mark-mobile.png" media="(max-width: 720px)" />
        <img src="/brand/rivt-lockup-dark-transparent.png" alt="" />
      </picture>
      <div className="rivt-copy">
        <strong>RIVT</strong>
        <span>Where skilled trades connect</span>
      </div>
    </div>
  );
}

function RivtMark() {
  return (
    <svg viewBox="0 0 48 48" className="rivt-mark-svg" aria-hidden="true">
      <rect x="1" y="1" width="46" height="46" rx="10" fill="none" />
      <path d="M9 10h6l9 14 9-14h6L26 31v9h-4v-9L9 10Z" fill="currentColor" />
      <circle cx="24" cy="29" r="5.6" fill="var(--green)" />
    </svg>
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

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#1877F2" d="M12 2.5a9.5 9.5 0 1 0 0 19h.2v-6.5h-1.8v-2.7h1.8v-2c0-1.8 1.1-2.8 2.7-2.8.8 0 1.6.1 1.6.1v1.8h-.9c-.9 0-1.1.6-1.1 1.1v1.8h2l-.3 2.7h-1.7v6.5A9.5 9.5 0 0 0 12 2.5Z" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M16.2 12.5c0-2.5 2-3.7 2.1-3.8-1.2-1.7-3-1.9-3.6-1.9-1.5-.2-2.9.9-3.6.9-.7 0-1.9-.9-3.2-.9-1.7 0-3.3 1-4.2 2.6-1.8 3.1-.4 7.7 1.2 10.2.8 1.2 1.8 2.6 3.1 2.5 1.2-.1 1.7-.8 3.3-.8s2 0.8 3.3.8c1.3 0 2.2-1.2 3-2.4.9-1.3 1.2-2.6 1.2-2.7-.1 0-2.5-.9-2.5-4.1Z" />
      <path fill="currentColor" d="M15 5.2c.7-.8 1.2-1.9 1.1-3.2-1 .1-2.2.7-2.9 1.5-.6.7-1.2 1.8-1.1 3 1.1.1 2.2-.5 2.9-1.3Z" />
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

function OnboardingFlow({
  themeMode,
  onToggleTheme,
  onComplete,
  initialRole,
  initialEmail,
  initialDisplayName,
  initialOrganization,
  initialLocation,
  initialSpecialties,
  initialAuthMethod,
}: {
  themeMode: ThemeMode;
  onToggleTheme: () => void;
  onComplete: (result: OnboardingResult) => void;
  initialRole: Role;
  initialEmail: string;
  initialDisplayName: string;
  initialOrganization: string;
  initialLocation: string;
  initialSpecialties: Trade[];
  initialAuthMethod: AuthMethod;
}) {
  const [role, setRole] = useState<Role>(initialRole);
  const [authMethod, setAuthMethod] = useState<AuthMethod>(initialAuthMethod);
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [email, setEmail] = useState(initialEmail);
  const [organization, setOrganization] = useState(initialOrganization);
  const [location, setLocation] = useState(initialLocation);
  const [specialties, setSpecialties] = useState<Trade[]>(
    initialSpecialties.length ? initialSpecialties : ["Electrical", "Carpentry"],
  );
  const [showAllSpecialties, setShowAllSpecialties] = useState(false);
  const [legalConsent, setLegalConsent] = useState(false);
  const [plan, setPlan] = useState<TrialPlan>(brandConfig.pricing.betaPlan.label);

  const accountReady = Boolean(displayName.trim()) && Boolean(location.trim()) && Boolean(email.trim());
  const profileReady =
    specialties.length > 0;
  const legalReady = legalConsent;
  const completionChecks = [
    Boolean(role),
    Boolean(authMethod),
    accountReady,
    profileReady,
    legalReady,
    Boolean(plan),
  ];
  const completion = Math.round(
    (completionChecks.filter(Boolean).length / completionChecks.length) * 100,
  );
  const canEnter = accountReady && profileReady && legalReady;
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
      authMethod,
      email: email.trim(),
      displayName: displayName.trim(),
      organization:
        role === "contractor"
          ? organization.trim() || `${displayName.trim()} crew`
          : `${displayName.trim()} portfolio`,
      location: location.trim(),
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
                <span>{brandConfig.productCategory}</span>
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

          <section className="onboarding-section" aria-label="Choose account role">
            <div className="onboarding-section-heading">
              <span>Step 1</span>
              <h3>Choose how you use {brandConfig.appName}</h3>
            </div>
            <div className="role-choice-grid">
              <button
                type="button"
                className={role === "contractor" ? "role-choice selected" : "role-choice"}
                onClick={() => setRole("contractor")}
              >
                <BriefcaseBusiness size={20} />
                <strong>Contractor</strong>
                <span>Post jobs, review applicants, invite skilled help.</span>
              </button>
              <button
                type="button"
                className={role === "tradesperson" ? "role-choice selected" : "role-choice"}
                onClick={() => setRole("tradesperson")}
              >
                <Wrench size={20} />
                <strong>Tradesperson</strong>
                <span>Find side work, apply fast, build a portfolio.</span>
              </button>
            </div>
          </section>

          <section className="onboarding-section" aria-label="Profile basics">
            <div className="onboarding-section-heading">
              <span>Step 2</span>
              <h3>{roleNoun} profile</h3>
            </div>
            <div className="auth-methods" aria-label="Signup method">
              {(["Google", "Facebook", "Apple", "Email"] as AuthMethod[]).map((method) => (
                <button
                  type="button"
                  key={method}
                  className={authMethod === method ? "selected" : ""}
                  onClick={() => setAuthMethod(method)}
                >
                  {method}
                </button>
              ))}
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
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="rivttesting@gmail.com"
                  type="email"
                />
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
                <span>Launch location</span>
                <input
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                  placeholder="City, state"
                />
              </label>
            </div>
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
                <span>Email and phone verification will be provider-backed before launch.</span>
              </div>
            </div>
          </section>

          <section className="onboarding-section" aria-label="Trial plan">
            <div className="onboarding-section-heading">
              <span>Step 5</span>
              <h3>Start with the beta plan</h3>
            </div>
            <div className="plan-choice-grid">
              <button
                type="button"
                className={plan === brandConfig.pricing.betaPlan.label ? "selected" : ""}
                onClick={() => setPlan(brandConfig.pricing.betaPlan.label)}
              >
                <strong>{brandConfig.pricing.betaPlan.label}</strong>
                <span>{brandConfig.pricing.betaPlan.summary}</span>
              </button>
              <button
                type="button"
                className={plan === brandConfig.pricing.launchPreviewPlan.label ? "selected" : ""}
                onClick={() => setPlan(brandConfig.pricing.launchPreviewPlan.label)}
              >
                <strong>{brandConfig.pricing.launchPreviewPlan.label}</strong>
                <span>{brandConfig.pricing.launchPreviewPlan.summary}</span>
              </button>
            </div>
          </section>

          <div className="onboarding-actions">
            <div>
              <strong>{canEnter ? `Ready to enter ${brandConfig.appName}` : "Finish the basics"}</strong>
              <span>
                {canEnter
                  ? "Your role, profile, consent, and beta plan are ready."
                  : "Add your profile basics, pick at least one trade, and accept the consent agreement."}
              </span>
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

function ActivityToast({
  activity,
  onDismiss,
}: {
  activity: ActivityItem;
  onDismiss: () => void;
}) {
  return (
    <aside className="activity-toast" role="status" aria-live="polite">
      <BadgeCheck size={18} />
      <div>
        <strong>{activity.title}</strong>
        <span>{activity.detail}</span>
      </div>
      <button type="button" onClick={onDismiss} aria-label="Dismiss update">
        <X size={15} />
      </button>
    </aside>
  );
}

function ActivityPanel({
  items,
  onClose,
  onMarkAllRead,
  onNavigate,
}: {
  items: ActivityItem[];
  onClose: () => void;
  onMarkAllRead: () => void;
  onNavigate: (view: NavLabel) => void;
}) {
  return (
    <div className="panel-backdrop" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside className="side-panel" role="dialog" aria-modal="true" aria-label="Notifications">
        <div className="side-panel-header">
          <div>
            <span>Live test log</span>
            <h2>Notifications</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close notifications">
            <X size={18} />
          </button>
        </div>

        <div className="quick-actions">
          <button type="button" onClick={onMarkAllRead}>
            <BadgeCheck size={15} />
            Mark read
          </button>
          <button type="button" onClick={() => onNavigate("Messages")}>
            <MessageSquareText size={15} />
            Messages
          </button>
          <button type="button" onClick={() => onNavigate("Records")}>
            <FolderOpen size={15} />
            Records
          </button>
        </div>

        <div className="activity-list">
          {items.length === 0 ? (
            <article className="empty-panel-state">
              <Bell size={20} />
              <strong>No activity yet</strong>
              <span>Use any action in the app and it will appear here.</span>
            </article>
          ) : items.map((item) => (
            <article key={item.id} className={item.unread ? "activity-item unread" : "activity-item"}>
              <span>{item.timestamp}</span>
              <strong>{item.title}</strong>
              <p>{item.detail}</p>
            </article>
          ))}
        </div>
      </aside>
    </div>
  );
}

function AccountPanel({
  role,
  profile,
  trustReady,
  recordCount,
  trainingProgress,
  themeMode,
  themePalette,
  communityBadges,
  shoutOutCount,
  onToggleTheme,
  onSelectThemePalette,
  onClose,
  onNavigate,
}: {
  role: Role;
  profile: AccountProfile;
  trustReady: boolean;
  recordCount: number;
  trainingProgress: number;
  themeMode: ThemeMode;
  themePalette: ThemePalette;
  communityBadges: string[];
  shoutOutCount: number;
  onToggleTheme: () => void;
  onSelectThemePalette: (palette: ThemePalette) => void;
  onClose: () => void;
  onNavigate: (view: NavLabel) => void;
}) {
  return (
    <div className="panel-backdrop" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside className="side-panel" role="dialog" aria-modal="true" aria-label="Settings">
        <div className="side-panel-header">
          <div>
            <span>{role === "contractor" ? "Contractor account" : "Tradesperson account"}</span>
            <h2>Account</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close account">
            <X size={18} />
          </button>
        </div>

        <div className="account-profile-card">
          <div className="user-avatar">{getInitials(profile.displayName)}</div>
          <div>
            <strong>{profile.organization}</strong>
            <span>{profile.location}</span>
          </div>
        </div>

        <div className="account-stat-grid">
          <InfoItem icon={Mail} label="Email" value={profile.email} />
          <InfoItem icon={CreditCard} label="Plan" value={profile.plan} />
          <InfoItem icon={UserCheck} label="Signup" value={profile.authMethod} />
          <InfoItem icon={ShieldCheck} label="Trust" value={trustReady ? "Ready" : "Needs review"} />
          <InfoItem icon={FolderOpen} label="Records" value={`${recordCount}/${recordChecklist.length}`} />
          <InfoItem icon={ThumbsUp} label="Community" value={`${communityBadges.length} badge${communityBadges.length === 1 ? "" : "s"}`} />
        </div>

        <section className="account-section">
          <span>Specialties</span>
          <div className="account-chip-row">
            {profile.specialties.map((specialty) => (
              <strong key={specialty}>{specialty}</strong>
            ))}
          </div>
        </section>

        <section className="account-section">
          <span>Safety training</span>
          <ProgressBar value={trainingProgress} />
        </section>

        <section className="account-section">
          <span>Community reputation</span>
          <div className="account-chip-row">
            {communityBadges.length ? (
              communityBadges.map((badge) => <strong key={badge}>{badge}</strong>)
            ) : (
              <strong>New contributor</strong>
            )}
            {shoutOutCount > 0 && <strong>{shoutOutCount} shout-out{shoutOutCount === 1 ? "" : "s"}</strong>}
          </div>
          <small className="account-note">
            Verified Fix answers and recommendations build reputation without blocking new users from work.
          </small>
        </section>

        <section className="account-section theme-settings-section">
          <div className="settings-section-heading">
            <span>Themes</span>
            <strong>Tool-inspired appearance</strong>
            <small>Choose a jobsite palette. Names are inspired, not official brand skins.</small>
          </div>

          <div className="theme-mode-row">
            <span>Mode</span>
            <ThemeToggle
              themeMode={themeMode}
              onToggleTheme={onToggleTheme}
              variant="surface"
            />
          </div>

          <ThemePalettePicker
            selectedPalette={themePalette}
            onSelectPalette={onSelectThemePalette}
          />
        </section>

        <div className="quick-actions">
          <button type="button" onClick={() => onNavigate("Settings")}>
            <ShieldCheck size={15} />
            Settings
          </button>
          <button type="button" onClick={() => onNavigate("Trust & Legal")}>
            <ShieldCheck size={15} />
            Trust
          </button>
          <button type="button" onClick={() => onNavigate("Safety & Training")}>
            <GraduationCap size={15} />
            Training
          </button>
          <button type="button" onClick={() => onNavigate("Reviews")}>
            <Star size={15} />
            Reviews
          </button>
        </div>
      </aside>
    </div>
  );
}

function Sidebar({
  role,
  activeView,
  selectedJob,
  profile,
  onNavigate,
}: {
  role: Role;
  activeView: NavLabel;
  selectedJob: Job;
  profile: AccountProfile;
  onNavigate: (view: NavLabel) => void;
}) {
  const primaryLabels: NavLabel[] = ["Home", "Marketplace", "Records", "Tools", "My Crew", "Messages"];
  const visibleItems = visibleNavItems(role);
  const primaryItems = primaryLabels
    .map((label) => visibleItems.find((item) => item.label === label))
    .filter((item): item is (typeof visibleItems)[number] => Boolean(item));
  const displayLabel: Partial<Record<NavLabel, string>> = {
    Marketplace: "Work",
    "My Crew": "Network",
  };

  return (
    <aside className="sidebar">
      <div className="brand-lockup">
        <div className="brand-mark">
          <RivtMark />
        </div>
        <div>
          <strong>{brandConfig.appName}</strong>
          <span>{brandConfig.productCategory}</span>
        </div>
      </div>

      <nav className="nav-list" aria-label="Primary">
        {primaryItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              className={activeView === item.label ? "nav-item active" : "nav-item"}
              aria-label={`Go to ${displayLabel[item.label] ?? item.label}`}
              aria-current={activeView === item.label ? "page" : undefined}
              onClick={() => onNavigate(item.label)}
            >
              <Icon size={18} />
              <span>{displayLabel[item.label] ?? item.label}</span>
            </button>
          );
        })}
        <button type="button" className={activeView === "Settings" ? "nav-item active" : "nav-item"} onClick={() => onNavigate("Settings")}>
          <ShieldCheck size={18} />
          <span>Settings</span>
        </button>
      </nav>

      <div className="sidebar-job-card">
        <span>Active work order</span>
        <strong>{selectedJob.title}</strong>
        <small>{selectedJob.trade}</small>
        <small><MapPin size={12} /> {selectedJob.location}</small>
        <div className="sidebar-progress">
          <em>{selectedJob.status}</em>
          <i><b style={{ width: `${Math.min(selectedJob.match, 100)}%` }} /></i>
          <small>{selectedJob.match}%</small>
        </div>
        <button type="button" onClick={() => onNavigate("Marketplace")}>Open work order</button>
      </div>

      <div className="sidebar-pro-card">
        <strong>Get more with RIVT Pro</strong>
        <span><BadgeCheck size={13} /> Real-time jobs</span>
        <span><UserCheck size={13} /> Featured profile</span>
        <span><Search size={13} /> Advanced search</span>
        <button type="button" onClick={() => onNavigate("Trust & Legal")}>Go Pro</button>
      </div>

      <button type="button" className="sidebar-profile" onClick={() => onNavigate("My Crew")}>
        <span className="user-avatar">{getInitials(profile.displayName)}</span>
        <span>
          <strong>{profile.displayName}</strong>
          <small>View Profile</small>
        </span>
        <ChevronDown size={15} />
      </button>

      <div className="license-card">
        <BadgeCheck size={18} />
        <strong>{brandConfig.legal.trustCardTitle}</strong>
        <span>{brandConfig.legal.idGateLabel}</span>
      </div>
    </aside>
  );
}

function ThemePalettePicker({
  selectedPalette,
  onSelectPalette,
}: {
  selectedPalette: ThemePalette;
  onSelectPalette: (palette: ThemePalette) => void;
}) {
  return (
    <div className="theme-palette-grid" aria-label="Theme palettes">
      {themePaletteOptions.map(([paletteId, palette]) => (
        <button
          key={paletteId}
          type="button"
          className={paletteId === selectedPalette ? "palette-option selected" : "palette-option"}
          aria-label={`Use ${palette.label} theme`}
          aria-pressed={paletteId === selectedPalette}
          onClick={() => onSelectPalette(paletteId)}
        >
          <span className="palette-swatch-row" aria-hidden="true">
            {palette.swatches.map((color) => (
              <i key={color} style={{ background: color }} />
            ))}
          </span>
          <span className="palette-copy">
            <strong>{palette.label}</strong>
            <small>{palette.inspiration}</small>
          </span>
        </button>
      ))}
    </div>
  );
}

function ThemeToggle({
  themeMode,
  onToggleTheme,
  variant = "nav",
}: {
  themeMode: ThemeMode;
  onToggleTheme: () => void;
  variant?: "nav" | "surface";
}) {
  const isDark = themeMode === "dark";
  const Icon = isDark ? Sun : Moon;
  const label = isDark ? "Light mode" : "Dark mode";

  return (
    <button
      type="button"
      className={variant === "surface" ? "theme-toggle surface-toggle" : "theme-toggle"}
      aria-label={`Switch to ${label.toLowerCase()}`}
      aria-pressed={isDark}
      title={`Switch to ${label}`}
      onClick={onToggleTheme}
    >
      <Icon size={16} />
      <span>{label}</span>
    </button>
  );
}

function MobileNavStrip({
  role,
  activeView,
  onNavigate,
  onPostJob,
}: {
  role: Role;
  activeView: NavLabel;
  onNavigate: (view: NavLabel) => void;
  onPostJob: () => void;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const primaryLabels: NavLabel[] = ["Home", "Marketplace", "Records", "Tools", "Messages"];
  const visibleItems = visibleNavItems(role);
  const primaryItems = primaryLabels
    .map((label) => visibleItems.find((item) => item.label === label))
    .filter((item): item is (typeof visibleItems)[number] => Boolean(item));
  const secondaryItems = visibleItems.filter(
    (item) => !primaryItems.some((primary) => primary.label === item.label),
  );
  const secondarySelected = secondaryItems.some((item) => item.label === activeView);
  const mobileLabel: Partial<Record<NavLabel, string>> = {
    Marketplace: "Work",
    "Shop Talk": "Talk",
    Records: "Records",
    Messages: "Chat",
  };

  function navigate(view: NavLabel) {
    setMoreOpen(false);
    onNavigate(view);
  }

  return (
    <nav className="mobile-nav-strip" aria-label="Mobile primary navigation">
      {primaryItems.map((item, index) => {
        const Icon = item.icon;
        return (
          <button
            key={item.label}
            className={activeView === item.label ? "selected" : ""}
            aria-label={`Go to ${mobileLabel[item.label] ?? item.label}`}
            onClick={() => navigate(item.label)}
          >
            <Icon size={15} />
            <span>{mobileLabel[item.label] ?? item.label}</span>
          </button>
        );
      })}
      <button
        type="button"
        className={secondarySelected || moreOpen ? "selected" : ""}
        aria-expanded={moreOpen}
        onClick={() => setMoreOpen((current) => !current)}
      >
        <ChevronDown size={15} />
        <span>More</span>
      </button>
      {moreOpen && (
        <div className="mobile-more-sheet" role="menu" aria-label="More sections">
          <div className="mobile-more-heading">
            <strong>More in RIVT</strong>
            <span>Network, trust, reviews, and beta tools</span>
          </div>
          {role === "contractor" ? (
            <button
              type="button"
              role="menuitem"
              className="mobile-sheet-primary"
              onClick={() => {
                setMoreOpen(false);
                onPostJob();
              }}
            >
              <Plus size={16} />
              <span>Post a job</span>
            </button>
          ) : null}
          {secondaryItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                type="button"
                role="menuitem"
                key={item.label}
                className={activeView === item.label ? "selected" : ""}
                onClick={() => navigate(item.label)}
              >
                <Icon size={16} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </nav>
  );
}

function MarketplaceView({
  role,
  jobs,
  selectedJob,
  matchingTalent,
  applications,
  applicationState,
  savedSearch,
  radius,
  trade,
  setTrade,
  difficulty,
  setDifficulty,
  workType,
  setWorkType,
  locationQuery,
  setLocationQuery,
  verifiedOnly,
  setVerifiedOnly,
  setRadius,
  setSelectedId,
  onToggleSavedSearch,
  scheduleHeld,
  dispatchNote,
  closeout,
  trustReady,
  closeouts,
  autoMatchEnabled,
  onToggleAutoMatch,
  onReviewConsent,
  onApply,
  onInvite,
  onScheduleHold,
  onSubmitCloseoutPacket,
}: {
  role: Role;
  jobs: Job[];
  selectedJob: Job;
  matchingTalent: typeof talent;
  applications: ApplicationRecord[];
  applicationState?: ApplicationRecord["state"];
  savedSearch: boolean;
  radius: RadiusFilter;
  trade: TradeFilter;
  setTrade: (trade: TradeFilter) => void;
  difficulty: DifficultyFilter;
  setDifficulty: (difficulty: DifficultyFilter) => void;
  workType: WorkTypeFilter;
  setWorkType: (workType: WorkTypeFilter) => void;
  locationQuery: string;
  setLocationQuery: (locationQuery: string) => void;
  verifiedOnly: boolean;
  setVerifiedOnly: (verifiedOnly: boolean) => void;
  setRadius: (radius: RadiusFilter) => void;
  setSelectedId: (id: number) => void;
  onToggleSavedSearch: () => void;
  scheduleHeld: boolean;
  dispatchNote: string;
  closeout: CloseoutRecord;
  trustReady: boolean;
  closeouts: Record<number, CloseoutRecord>;
  autoMatchEnabled: boolean;
  onToggleAutoMatch: () => void;
  onReviewConsent: () => void;
  onApply: () => void;
  onInvite: () => void;
  onScheduleHold: () => void;
  onSubmitCloseoutPacket: (jobId?: number) => void;
}) {
  const averageMatch = jobs.length
    ? Math.round(jobs.reduce((sum, job) => sum + job.match, 0) / jobs.length)
    : 0;
  const averagePay = jobs.length
    ? Math.round(jobs.reduce((sum, job) => sum + job.pay, 0) / jobs.length)
    : 0;
  const recordsReady = Object.values(closeouts).filter(
    (record) => record.approved && record.rating > 0 && !record.dispute,
  ).length;
  const topTalent = matchingTalent[0] ?? talent[0];
  const readyCount = [
    trustReady,
    selectedJob.trustRequirement.length > 0,
    selectedJob.tools.length > 0,
    scheduleHeld || selectedJob.status === "Scheduled",
  ].filter(Boolean).length;

  return (
    <>
      <section className="modern-marketplace-shell">
        <section className="modern-command-bar" aria-label="Marketplace command center">
          <ModernMetric
            icon={Sparkles}
            label="Best match"
            value={averageMatch ? `${averageMatch}%` : "None"}
            detail={autoMatchEnabled ? "Sorting active" : "Sorting paused"}
          />
          <ModernMetric
            icon={ShieldCheck}
            label="Trust"
            value={trustReady ? "Ready" : `${readyCount}/4`}
            detail={trustReady ? "Consent reviewed" : "Review trust steps"}
          />
          <ModernMetric
            icon={BriefcaseBusiness}
            label="Open work"
            value={`${jobs.length}`}
            detail={`${currency(averagePay)} avg job value`}
          />
          <ModernMetric
            icon={CreditCard}
            label="Records"
            value={String(recordsReady)}
            detail={`${applications.length} active application${applications.length === 1 ? "" : "s"}`}
          />
          <div className="modern-command-actions">
            <button onClick={onToggleAutoMatch}>
              <Sparkles size={15} />
              {autoMatchEnabled ? "Pause sorting" : "Resume sorting"}
            </button>
            <button onClick={onReviewConsent}>
              <ShieldCheck size={15} />
              {trustReady ? "Ready" : "Consent"}
            </button>
          </div>
        </section>

        <section className="modern-filter-bar" aria-label="Job filters">
        <Filters
          trade={trade}
          setTrade={setTrade}
          difficulty={difficulty}
          setDifficulty={setDifficulty}
          workType={workType}
          setWorkType={setWorkType}
          radius={radius}
          setRadius={setRadius}
          locationQuery={locationQuery}
          setLocationQuery={setLocationQuery}
          verifiedOnly={verifiedOnly}
          setVerifiedOnly={setVerifiedOnly}
        />
        <button
          className={savedSearch ? "secondary-action save-search saved" : "secondary-action save-search"}
          onClick={onToggleSavedSearch}
        >
          {savedSearch ? `${radius} saved` : "Save search"}
        </button>
        </section>

        <section className="modern-workspace-grid">
          <div className="modern-job-queue">
            <div className="modern-section-heading">
              <div>
                <span>Job queue</span>
                <h2>{jobs.length} jobs nearby</h2>
              </div>
              <small>Sorted by best fit</small>
            </div>
            <div className="modern-job-list">
              {jobs.length === 0 ? (
                <div className="job-queue-empty">
                  <p>No jobs match your filters.</p>
                  <p>Try widening your radius or changing trade.</p>
                </div>
              ) : jobs.map((job) => (
                <ModernJobCard
                  key={job.id}
                  job={job}
                  selected={job.id === selectedJob.id}
                  onSelect={() => setSelectedId(job.id)}
                />
              ))}
            </div>
          </div>

          <ModernJobDetail
            job={selectedJob}
            role={role}
            applicationState={applicationState}
            scheduleHeld={scheduleHeld}
            dispatchNote={dispatchNote}
            closeout={closeout}
            trustReady={trustReady}
            topTalent={topTalent}
            onApply={onApply}
            onInvite={onInvite}
            onScheduleHold={onScheduleHold}
            onReviewConsent={onReviewConsent}
            onSubmitCloseoutPacket={onSubmitCloseoutPacket}
          />
        </section>
      </section>
    </>
  );
}

function ModernMetric({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof BriefcaseBusiness;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="modern-metric">
      <Icon size={17} />
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function ModernJobCard({
  job,
  selected,
  onSelect,
}: {
  job: Job;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      className={selected ? "modern-job-card selected" : "modern-job-card"}
      onClick={onSelect}
      aria-label={`${job.title}, ${job.match}% best match, ${currency(job.pay)}, ${job.durationHours}h estimate`}
    >
      <div className="modern-job-card-main">
        <div>
          <span>{job.trade} - {job.location}</span>
          <strong>{job.title}</strong>
        </div>
        <ProjectVisual trade={job.trade} compact />
        <span className="match-pill" aria-hidden="true">{job.match}%</span>
      </div>
      <p>{job.summary}</p>
      <div className="modern-job-card-meta">
        <span>{currency(job.pay)}</span>
        <span>{job.durationHours}h estimate</span>
        <span>{job.difficulty}</span>
        <span>{job.insuranceRequired ? "Insurance required" : "Insurance optional"}</span>
      </div>
    </button>
  );
}

function ProjectVisual({ trade, compact = false }: { trade: Trade; compact?: boolean }) {
  const tone =
    trade === "Electrical"
      ? "electrical"
      : trade === "Plumbing" || trade === "HVAC"
        ? "mechanical"
        : trade === "Carpentry" || trade === "Drywall" || trade === "Framing"
          ? "framing"
          : "concrete";

  return (
    <span
      className={["project-visual", compact ? "compact" : "", tone].filter(Boolean).join(" ")}
      aria-hidden="true"
    />
  );
}

function ModernJobDetail({
  job,
  role,
  applicationState,
  scheduleHeld,
  dispatchNote,
  closeout,
  trustReady,
  topTalent,
  onApply,
  onInvite,
  onScheduleHold,
  onReviewConsent,
  onSubmitCloseoutPacket,
}: {
  job: Job;
  role: Role;
  applicationState?: ApplicationRecord["state"];
  scheduleHeld: boolean;
  dispatchNote: string;
  closeout: CloseoutRecord;
  trustReady: boolean;
  topTalent: (typeof talent)[number];
  onApply: () => void;
  onInvite: () => void;
  onScheduleHold: () => void;
  onReviewConsent: () => void;
  onSubmitCloseoutPacket: (jobId?: number) => void;
}) {
  const payoutReady = closeout.approved && closeout.rating > 0 && !closeout.dispute;

  return (
    <aside className="modern-detail-panel" aria-label="Selected work order summary">
      <div className="modern-detail-hero">
        <div>
          <span>Selected work order</span>
          <h2>{job.title}</h2>
          <p>{job.summary}</p>
        </div>
        <ScoreRing score={job.match} />
      </div>

      <div className="modern-readiness-grid">
        <InfoItem icon={BriefcaseBusiness} label="Budget" value={`${currency(job.pay)} fixed`} />
        <InfoItem icon={CalendarClock} label="Timeline" value={`${job.durationHours}h + buffer`} />
        <InfoItem icon={ShieldCheck} label="Insurance" value={job.insuranceRequired ? "Required" : "Optional"} />
        <InfoItem icon={UserCheck} label="Crew" value={`${topTalent.name.split(" ")[0]} - ${topTalent.match}%`} />
      </div>

      <section className="modern-detail-section">
        <div className="section-header">
          <h3>What matters now</h3>
          <span>{scheduleHeld ? "Scheduled" : "Ready to dispatch"}</span>
        </div>
        <ul className="modern-checks">
          <li>
            <ShieldCheck size={16} />
            <span>{job.insuranceRequired ? "Insurance required. Highlight insured applicants." : job.trustRequirement}</span>
          </li>
          <li>
            <ClipboardCheck size={16} />
            <span>{job.guidance[0]}</span>
          </li>
          <li>
            <Wrench size={16} />
            <span>{job.tools.slice(0, 3).join(", ")}</span>
          </li>
        </ul>
      </section>

      <section className="modern-talent-card">
        <div className="avatar">{topTalent.name.slice(0, 2).toUpperCase()}</div>
        <div>
          <span>Recommended crew</span>
          <strong>{topTalent.name}</strong>
          <small>{topTalent.availability} - {topTalent.insured ? "self-reported insured" : "insurance not marked"} - responds in {topTalent.responseTime}</small>
        </div>
        <em aria-label={`Rating: ${topTalent.rating} out of 5`}>{topTalent.rating}</em>
      </section>

      <div className="modern-note">
        <MessageCircle size={16} />
        <p>{dispatchNote}</p>
      </div>

      <div className="modern-action-stack">
        {role === "tradesperson" ? (
          <button className="primary-action wide" onClick={onApply}>
            <FileCheck2 size={18} />
            {applicationState === "Submitted" ? "Portfolio submitted" : "Apply with portfolio"}
          </button>
        ) : (
          <button className="primary-action wide" onClick={onInvite}>
            <UserCheck size={18} />
            {applicationState === "Invited" ? "Crew invited" : "Invite crew"}
          </button>
        )}
        <div>
          <button onClick={onReviewConsent}>
            <ShieldCheck size={15} />
            {trustReady ? "Ready" : "Consent"}
          </button>
          <button onClick={onScheduleHold}>
            <CalendarClock size={15} />
            {scheduleHeld ? "Release hold" : "Hold time"}
          </button>
          <button onClick={() => onSubmitCloseoutPacket(job.id)}>
            <FolderOpen size={15} />
            {payoutReady ? "Record ready" : "Record done"}
          </button>
        </div>
      </div>
    </aside>
  );
}

function ScoreRing({ score }: { score: number }) {
  const r = 38;
  const circ = 2 * Math.PI * r;
  const arc = (score / 100) * circ;
  return (
    <div className="modern-score" aria-label={`${score}% best match`}>
      <svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true">
        <circle cx="48" cy="48" r={r} fill="none" stroke="#cdeed9" strokeWidth="10" />
        <circle
          cx="48"
          cy="48"
          r={r}
          fill="none"
          stroke="var(--green)"
          strokeWidth="10"
          strokeDasharray={`${arc} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 48 48)"
        />
      </svg>
      <div className="modern-score-label">
        <strong>{score}</strong>
        <span>Best match</span>
      </div>
    </div>
  );
}

interface OperationsWorkspaceProps {
  view: NavLabel;
  role: Role;
  accountProfile: AccountProfile;
  jobs: Job[];
  selectedJob: Job;
  matchingTalent: typeof talent;
  applications: ApplicationRecord[];
  closeouts: Record<number, CloseoutRecord>;
  scheduleHolds: Set<number>;
  dispatchNotes: Record<number, string>;
  trustReady: boolean;
  uploadedRecords: Set<string>;
  completedTraining: Set<string>;
  messageDraft: string;
  sentMessages: string[];
  reviewRequested: boolean;
  feedbackItems: FeedbackItem[];
  feedbackDraft: string;
  feedbackCategory: FeedbackItem["category"];
  paymentRecords: PaymentRecord[];
  activityFeed: ActivityItem[];
  lockedAccounts: Set<string>;
  communityPosts: CommunityPost[];
  communityReports: CommunityReport[];
  shoutOuts: ShoutOut[];
  onPostJob: () => void;
  onNavigate: (view: NavLabel) => void;
  onOpenJob: (id: number) => void;
  onApply: () => void;
  onApplyToJob: (id: number) => void;
  onInvite: () => void;
  onInviteToJob: (id: number) => void;
  onReviewConsent: () => void;
  onToggleRecord: (recordName: string) => void;
  onSubmitCloseoutPacket: (jobId?: number) => void;
  onApproveCloseout: (jobId?: number) => void;
  onRateJob: (rating: number) => void;
  onToggleTraining: (moduleName: string) => void;
  onMessageDraft: (message: string) => void;
  onSendMessage: () => void;
  onRequestReview: () => void;
  onFeedbackDraft: (message: string) => void;
  onFeedbackCategory: (category: FeedbackItem["category"]) => void;
  onSubmitFeedback: () => void;
  onMarkPaymentPaid: (jobId: number) => void;
  onExportPayments: () => void;
  onToggleAdminLock: (accountName: string) => void;
  onVoteCommunityPost: (postId: number, direction: "up" | "down") => void;
  onVoteCommunityAnswer: (postId: number, answerId: number, direction: "up" | "down") => void;
  onAddCommunityAnswer: (postId: number, body: string) => void;
  onVerifyCommunityAnswer: (postId: number, answerId: number) => void;
  onReportCommunityPost: (postId: number, reason: CommunityReport["reason"]) => void;
  onResolveCommunityReport: (reportId: number, status: CommunityReport["status"]) => void;
  onCreateCommunityPrompt: () => void;
  onCreateShoutOut: (to: string, tradeName: Trade) => void;
}

function OperationsWorkspace(props: OperationsWorkspaceProps) {
  const {
    view,
    role,
    accountProfile,
    jobs,
    selectedJob,
    matchingTalent,
    applications,
    closeouts,
    scheduleHolds,
    dispatchNotes,
    trustReady,
    uploadedRecords,
    completedTraining,
    messageDraft,
    sentMessages,
    reviewRequested,
    feedbackItems,
    feedbackDraft,
    feedbackCategory,
    paymentRecords,
    activityFeed,
    lockedAccounts,
    communityPosts,
    communityReports,
    shoutOuts,
    onPostJob,
    onNavigate,
    onOpenJob,
    onApply,
    onApplyToJob,
    onInvite,
    onInviteToJob,
    onReviewConsent,
    onToggleRecord,
    onSubmitCloseoutPacket,
    onApproveCloseout,
    onRateJob,
    onToggleTraining,
    onMessageDraft,
    onSendMessage,
    onRequestReview,
    onFeedbackDraft,
    onFeedbackCategory,
    onSubmitFeedback,
    onMarkPaymentPaid,
    onExportPayments,
    onToggleAdminLock,
    onVoteCommunityPost,
    onVoteCommunityAnswer,
    onAddCommunityAnswer,
    onVerifyCommunityAnswer,
    onReportCommunityPost,
    onResolveCommunityReport,
    onCreateCommunityPrompt,
    onCreateShoutOut,
  } = props;
  const approvedCloseouts = Object.values(closeouts).filter(
    (closeout) => closeout.approved && closeout.rating > 0 && !closeout.dispute,
  ).length;
  const activeRecords = uploadedRecords.size;
  const trainingProgress = Math.round(
    (completedTraining.size / trainingModules.length) * 100,
  );
  const totalPipelineValue = jobs.reduce((sum, job) => sum + job.pay, 0);
  const pendingPayments = paymentRecords.filter(
    (record) => record.status === "Payment pending",
  ).length;

  return (
    <>
      <section className={view === "Home" ? "ops-summary home-ops-summary" : "ops-summary"} aria-label="Operations summary">
        <OpsMetric
          icon={BriefcaseBusiness}
          label="Open work"
          value={`${jobs.length} jobs`}
          detail={`${currency(totalPipelineValue)} active value`}
        />
        <OpsMetric
          icon={FileCheck2}
          label="Applications"
          value={String(applications.length)}
          detail={role === "contractor" ? "Applicant and invite queue" : "Submitted portfolios"}
        />
        <OpsMetric
          icon={FolderOpen}
          label="Records"
          value={`${activeRecords}/${recordChecklist.length}`}
          detail={`${paymentRecords.length} payment log${paymentRecords.length === 1 ? "" : "s"}`}
        />
        <OpsMetric
          icon={GraduationCap}
          label="Safety"
          value={`${trainingProgress}%`}
          detail="Training completion"
        />
      </section>

      {view === "Home" && (
        <HomeView
          role={role}
          jobs={jobs}
          selectedJob={selectedJob}
          applications={applications}
          paymentRecords={paymentRecords}
          newsItems={seedNews}
          communityPosts={communityPosts}
          shoutOuts={shoutOuts}
          communityReports={communityReports}
          onNavigate={onNavigate}
          onOpenJob={onOpenJob}
          onPostJob={onPostJob}
          onApplyToJob={onApplyToJob}
          onInviteToJob={onInviteToJob}
          onCreateCommunityPrompt={onCreateCommunityPrompt}
        />
      )}
      {view === "Shop Talk" && (
        <ShopTalkView
          profile={accountProfile}
          communityPosts={communityPosts}
          onVotePost={onVoteCommunityPost}
          onVoteAnswer={onVoteCommunityAnswer}
          onAddAnswer={onAddCommunityAnswer}
          onVerifyAnswer={onVerifyCommunityAnswer}
          onReportPost={onReportCommunityPost}
          onCreatePrompt={onCreateCommunityPrompt}
        />
      )}
      {view === "Tools" && (
        <ToolsView
          role={role}
          selectedJob={selectedJob}
          onOpenJob={onOpenJob}
          onNavigate={onNavigate}
        />
      )}
      {view === "My Jobs" && (
        <MyJobsView
          jobs={jobs}
          closeouts={closeouts}
          scheduleHolds={scheduleHolds}
          dispatchNotes={dispatchNotes}
          onOpenJob={onOpenJob}
          onInviteToJob={onInviteToJob}
        />
      )}
      {view === "Applications" && (
        <ApplicationsView
          role={role}
          jobs={jobs}
          applications={applications}
          onApply={onApply}
          onApplyToJob={onApplyToJob}
          onOpenJob={onOpenJob}
        />
      )}
      {view === "Invites" && (
        <InvitesView
          jobs={jobs}
          applications={applications}
          onInvite={onInvite}
          onInviteToJob={onInviteToJob}
          onOpenJob={onOpenJob}
        />
      )}
      {view === "My Crew" && (
        <CrewView
          jobs={jobs}
          people={talent}
          matchingTalent={matchingTalent}
          trustReady={trustReady}
          shoutOuts={shoutOuts}
          onReviewConsent={onReviewConsent}
          onInviteToJob={onInviteToJob}
          onCreateShoutOut={onCreateShoutOut}
        />
      )}
      {view === "Messages" && (
        <MessagesView
          selectedJob={selectedJob}
          matchingTalent={matchingTalent}
          messageDraft={messageDraft}
          sentMessages={sentMessages}
          onMessageDraft={onMessageDraft}
          onSendMessage={onSendMessage}
          onOpenJob={onOpenJob}
        />
      )}
      {view === "Trust & Legal" && (
        <TrustLegalView
          jobs={jobs}
          selectedJob={selectedJob}
          trustReady={trustReady}
          onReviewConsent={onReviewConsent}
        />
      )}
      {view === "Records" && (
        <RecordsView
          selectedJob={selectedJob}
          closeout={closeouts[selectedJob.id] ?? defaultCloseout}
          uploadedRecords={uploadedRecords}
          paymentRecords={paymentRecords}
          onToggleRecord={onToggleRecord}
          onSubmitCloseoutPacket={onSubmitCloseoutPacket}
          onApproveCloseout={onApproveCloseout}
          onMarkPaymentPaid={onMarkPaymentPaid}
          onExportPayments={onExportPayments}
        />
      )}
      {view === "Safety & Training" && (
        <SafetyTrainingView
          jobs={jobs}
          completedTraining={completedTraining}
          onToggleTraining={onToggleTraining}
          onOpenJob={onOpenJob}
        />
      )}
      {view === "Reviews" && (
        <ReviewsView
          jobs={jobs}
          selectedJob={selectedJob}
          closeouts={closeouts}
          reviewRequested={reviewRequested}
          onRateJob={onRateJob}
          onRequestReview={onRequestReview}
          onOpenJob={onOpenJob}
        />
      )}
      {view === "Feedback" && (
        <FeedbackView
          feedbackItems={feedbackItems}
          feedbackDraft={feedbackDraft}
          feedbackCategory={feedbackCategory}
          onFeedbackDraft={onFeedbackDraft}
          onFeedbackCategory={onFeedbackCategory}
          onSubmitFeedback={onSubmitFeedback}
        />
      )}
      {view === "Settings" && (
        <SettingsView
          role={role}
          profile={accountProfile}
          trustReady={trustReady}
          recordCount={uploadedRecords.size}
          trainingProgress={Math.round((completedTraining.size / trainingModules.length) * 100)}
          communityBadges={communityBadgeLabels(communityPosts, accountProfile.displayName)}
          shoutOutCount={
            shoutOuts.filter(
              (shoutOut) =>
                shoutOut.to === accountProfile.displayName ||
                shoutOut.to === accountProfile.organization,
            ).length
          }
          onReviewConsent={() => {}}
        />
      )}
      {view === "Admin" && (
        <AdminView
          jobs={jobs}
          applications={applications}
          paymentRecords={paymentRecords}
          feedbackItems={feedbackItems}
          activityFeed={activityFeed}
          lockedAccounts={lockedAccounts}
          communityReports={communityReports}
          communityPosts={communityPosts}
          shoutOuts={shoutOuts}
          onToggleAdminLock={onToggleAdminLock}
          onResolveCommunityReport={onResolveCommunityReport}
          onOpenJob={onOpenJob}
        />
      )}
      {approvedCloseouts > 0 && (
        <section className="ops-footer-band">
          <CreditCard size={18} />
          <strong>{approvedCloseouts} approved closeout{approvedCloseouts === 1 ? "" : "s"}</strong>
          <span>
            {pendingPayments
              ? `${pendingPayments} direct payment ${pendingPayments === 1 ? "record needs" : "records need"} paid confirmation.`
              : "Direct payment details are logged for bookkeeping. The platform does not hold funds."}
          </span>
        </section>
      )}
    </>
  );
}

function OpsMetric({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof BriefcaseBusiness;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="ops-metric">
      <Icon size={17} />
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

const calculatorDifficultyMultipliers: Record<Difficulty, number> = {
  Easy: 0.95,
  Moderate: 1,
  Challenging: 1.08,
  Advanced: 1.16,
  Expert: 1.25,
};

function CalculatorView({
  role,
  selectedJob,
  onOpenJob,
}: {
  role: Role;
  selectedJob: Job;
  onOpenJob: (id: number) => void;
}) {
  const [trade, setTrade] = useState<Trade>(selectedJob.trade);
  const [difficulty, setDifficulty] = useState<Difficulty>(selectedJob.difficulty);
  const [laborHours, setLaborHours] = useState(selectedJob.durationHours);
  const [hourlyRate, setHourlyRate] = useState(role === "contractor" ? 65 : 48);
  const [crewSize, setCrewSize] = useState(1);
  const [materials, setMaterials] = useState(Math.max(75, Math.round(selectedJob.pay * 0.22)));
  const [subs, setSubs] = useState(0);
  const [wastePercent, setWastePercent] = useState(8);
  const [burdenPercent, setBurdenPercent] = useState(12);
  const [overheadPercent, setOverheadPercent] = useState(10);
  const [marginPercent, setMarginPercent] = useState(role === "contractor" ? 18 : 12);
  const [contingencyPercent, setContingencyPercent] = useState(7);
  const [copied, setCopied] = useState(false);

  function loadSelectedJob() {
    setTrade(selectedJob.trade);
    setDifficulty(selectedJob.difficulty);
    setLaborHours(selectedJob.durationHours);
    setMaterials(Math.max(75, Math.round(selectedJob.pay * 0.22)));
  }

  function numericSetter(setValue: (value: number) => void, minimum = 0) {
    return (event: ChangeEvent<HTMLInputElement>) => {
      const nextValue = Number(event.target.value);
      setValue(Number.isFinite(nextValue) ? Math.max(minimum, nextValue) : minimum);
    };
  }

  const difficultyMultiplier = calculatorDifficultyMultipliers[difficulty];
  const adjustedLaborHours = laborHours * difficultyMultiplier;
  const laborCost = adjustedLaborHours * hourlyRate;
  const laborBurden = laborCost * (burdenPercent / 100);
  const materialCost = materials * (1 + wastePercent / 100);
  const baseCost = laborCost + laborBurden + materialCost + subs;
  const overhead = baseCost * (overheadPercent / 100);
  const subtotal = baseCost + overhead;
  const margin = subtotal * (marginPercent / 100);
  const contingency = (subtotal + margin) * (contingencyPercent / 100);
  const recommended = Math.ceil((subtotal + margin + contingency) / 25) * 25;
  const lowRange = Math.floor((recommended * 0.92) / 25) * 25;
  const highRange = Math.ceil((recommended * 1.12) / 25) * 25;
  const crewDays = Math.max(0.5, adjustedLaborHours / Math.max(crewSize, 1) / 7);
  const timelineLabel =
    crewDays < 1
      ? "Same day"
      : `${Math.ceil(crewDays)} working day${Math.ceil(crewDays) === 1 ? "" : "s"}`;
  const deltaFromPosted = recommended - selectedJob.pay;

  async function handleCopyEstimate() {
    const summary = [
      `${brandConfig.appName} estimate - ${selectedJob.title}`,
      `Trade: ${trade}`,
      `Difficulty: ${difficulty}`,
      `Recommended range: ${currency(lowRange)} - ${currency(highRange)}`,
      `Target: ${currency(recommended)}`,
      `Timeline: ${timelineLabel}`,
      `Adjusted labor: ${adjustedLaborHours.toFixed(1)} hrs`,
      `Labor + burden: ${currency(Math.round(laborCost + laborBurden))}`,
      `Materials: ${currency(Math.round(materialCost))}`,
    ].join("\n");

    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="calculator-layout">
      <div className="calculator-panel calculator-control-panel">
        <div className="calculator-heading">
          <span>Estimate builder</span>
          <h2>Side-work price check</h2>
          <p>
            Start from the active work order, adjust the numbers, and use the range as a posting,
            bid, or negotiation gut check.
          </p>
        </div>

        <div className="calculator-context-card">
          <div>
            <span>Selected work order</span>
            <strong>{selectedJob.title}</strong>
            <small>{selectedJob.trade} - {selectedJob.location}</small>
          </div>
          <button type="button" onClick={loadSelectedJob}>
            <Calculator size={15} />
            Load work order
          </button>
        </div>

        <div className="calculator-form-grid">
          <label>
            <span>Trade</span>
            <select value={trade} onChange={(event) => setTrade(event.target.value as Trade)}>
              {specialtyOptions.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Difficulty</span>
            <select value={difficulty} onChange={(event) => setDifficulty(event.target.value as Difficulty)}>
              {difficultyOptions.slice(1).map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Labor hours</span>
            <input type="number" min="0" step="0.5" value={laborHours} onChange={numericSetter(setLaborHours)} />
          </label>
          <label>
            <span>Hourly rate</span>
            <input type="number" min="0" value={hourlyRate} onChange={numericSetter(setHourlyRate)} />
          </label>
          <label>
            <span>Crew size</span>
            <input type="number" min="1" value={crewSize} onChange={numericSetter(setCrewSize, 1)} />
          </label>
          <label>
            <span>Materials</span>
            <input type="number" min="0" value={materials} onChange={numericSetter(setMaterials)} />
          </label>
          <label>
            <span>Sub costs</span>
            <input type="number" min="0" value={subs} onChange={numericSetter(setSubs)} />
          </label>
          <label>
            <span>Waste %</span>
            <input type="number" min="0" value={wastePercent} onChange={numericSetter(setWastePercent)} />
          </label>
          <label>
            <span>Labor burden %</span>
            <input type="number" min="0" value={burdenPercent} onChange={numericSetter(setBurdenPercent)} />
          </label>
          <label>
            <span>Overhead %</span>
            <input type="number" min="0" value={overheadPercent} onChange={numericSetter(setOverheadPercent)} />
          </label>
          <label>
            <span>{role === "contractor" ? "Profit %" : "Target margin %"}</span>
            <input type="number" min="0" value={marginPercent} onChange={numericSetter(setMarginPercent)} />
          </label>
          <label>
            <span>Contingency %</span>
            <input type="number" min="0" value={contingencyPercent} onChange={numericSetter(setContingencyPercent)} />
          </label>
        </div>
      </div>

      <aside className="calculator-panel calculator-results-panel">
        <div className="calculator-result-hero">
          <span>Recommended range</span>
          <strong>{currency(lowRange)} - {currency(highRange)}</strong>
          <small>Target: {currency(recommended)}</small>
        </div>

        <div className="calculator-result-grid">
          <InfoItem icon={CalendarClock} label="Timeline" value={timelineLabel} />
          <InfoItem icon={Hammer} label="Adjusted labor" value={`${adjustedLaborHours.toFixed(1)} hrs`} />
          <InfoItem icon={CreditCard} label="Labor cost" value={currency(Math.round(laborCost + laborBurden))} />
          <InfoItem icon={FolderOpen} label="Materials" value={currency(Math.round(materialCost))} />
        </div>

        <div className="calculator-breakdown">
          <div>
            <span>Base cost</span>
            <strong>{currency(Math.round(baseCost))}</strong>
          </div>
          <div>
            <span>Overhead</span>
            <strong>{currency(Math.round(overhead))}</strong>
          </div>
          <div>
            <span>{role === "contractor" ? "Profit" : "Margin"}</span>
            <strong>{currency(Math.round(margin))}</strong>
          </div>
          <div>
            <span>Contingency</span>
            <strong>{currency(Math.round(contingency))}</strong>
          </div>
        </div>

        <div className="calculator-guidance">
          <strong>
            {deltaFromPosted >= 0
              ? `${currency(deltaFromPosted)} above current pay`
              : `${currency(Math.abs(deltaFromPosted))} below current pay`}
          </strong>
          <p>
            {role === "contractor"
              ? "Use this to sanity-check a work order before you publish it. Keep the final pay agreement direct between both parties."
              : "Use this before applying so your message explains tools, time, and what would make the rate fair."}
          </p>
        </div>

        <div className="calculator-actions">
          <button type="button" onClick={() => onOpenJob(selectedJob.id)}>
            <BriefcaseBusiness size={15} />
            Open work order
          </button>
          <button type="button" onClick={handleCopyEstimate}>
            <FileText size={15} />
            {copied ? "Copied" : "Copy summary"}
          </button>
        </div>
      </aside>
    </section>
  );
}

function HomeView({
  role,
  jobs,
  selectedJob,
  applications,
  paymentRecords,
  newsItems,
  communityPosts,
  shoutOuts,
  communityReports,
  onNavigate,
  onOpenJob,
  onPostJob,
  onApplyToJob,
  onInviteToJob,
  onCreateCommunityPrompt,
}: {
  role: Role;
  jobs: Job[];
  selectedJob: Job;
  applications: ApplicationRecord[];
  paymentRecords: PaymentRecord[];
  newsItems: NewsItem[];
  communityPosts: CommunityPost[];
  shoutOuts: ShoutOut[];
  communityReports: CommunityReport[];
  onNavigate: (view: NavLabel) => void;
  onOpenJob: (id: number) => void;
  onPostJob: () => void;
  onApplyToJob: (id: number) => void;
  onInviteToJob: (id: number) => void;
  onCreateCommunityPrompt: () => void;
}) {
  const verifiedFixes = communityPosts.filter((post) => post.status === "Verified Fix").length;
  const pendingReports = communityReports.filter((report) => report.status === "Flagged").length;
  const pendingPayments = paymentRecords.filter((record) => record.status === "Payment pending").length;
  const topPosts = [...communityPosts].sort((a, b) => netScore(b) - netScore(a)).slice(0, 3);
  const featuredJobs = jobs.slice(0, 3);
  const latestNews = newsItems[0];
  const secondaryNews = newsItems.slice(1);
  const selectedApplication = applications.find((record) => record.jobId === selectedJob.id);
  const topPost = topPosts[0];
  const nextJob = jobs.find((job) => job.id !== selectedJob.id) ?? selectedJob;
  const pendingPaymentRecord = paymentRecords.find((record) => record.status === "Payment pending");
  const mobilePrimaryLabel = role === "contractor" ? "Open work order" : "Apply";
  const mobilePrimaryIcon = role === "contractor" ? <BriefcaseBusiness size={16} /> : <FileCheck2 size={16} />;
  const mobilePrimaryAction = role === "contractor" ? () => onOpenJob(selectedJob.id) : () => onApplyToJob(selectedJob.id);

  return (
    <section className="home-layout" aria-label="Home dashboard">
      <section className="mobile-today-deck" aria-label="Today">
        <div className="mobile-today-heading">
          <span>Today</span>
          <strong>{role === "contractor" ? "Move the work forward" : "Best fit nearby"}</strong>
          <small>{selectedJob.location} - {selectedApplication?.state ?? selectedJob.status}</small>
        </div>

        <button type="button" className="mobile-work-card mobile-work-card-visual" onClick={() => onOpenJob(selectedJob.id)}>
          <div>
            <span>{selectedJob.trade}</span>
            <strong>{selectedJob.title}</strong>
            <small>{selectedJob.tools.slice(0, 3).join(", ")}</small>
          </div>
          <em>{selectedJob.match}%</em>
        </button>

        <div className="mobile-signal-grid" aria-label="Selected work order signals">
          <span>
            <strong>{currency(selectedJob.pay)}</strong>
            <small>Pay</small>
          </span>
          <span>
            <strong>{selectedJob.durationHours}h</strong>
            <small>Est.</small>
          </span>
          <span>
            <strong>{selectedJob.difficulty}</strong>
            <small>Level</small>
          </span>
        </div>

        <div className="mobile-action-grid" aria-label="Quick actions">
          <button type="button" className="primary-action" onClick={mobilePrimaryAction}>
            {mobilePrimaryIcon}
            {mobilePrimaryLabel}
          </button>
          <button type="button" onClick={() => onNavigate(role === "contractor" ? "My Crew" : "Marketplace")}>
            {role === "contractor" ? <Users size={16} /> : <BriefcaseBusiness size={16} />}
            {role === "contractor" ? "People" : "Work"}
          </button>
          <button type="button" onClick={() => onNavigate("Tools")}>
            <ReceiptText size={16} />
            Invoice
          </button>
          <button type="button" onClick={() => onNavigate("Messages")}>
            <MessageCircle size={16} />
            Message
          </button>
        </div>
      </section>

      <section className="mobile-up-next" aria-label="Up next">
        <div className="mobile-section-title">
          <span>Up next</span>
          <button type="button" onClick={() => onNavigate("Marketplace")}>View all</button>
        </div>
        <button type="button" className="mobile-next-row" onClick={() => onOpenJob(nextJob.id)}>
          <CalendarClock size={17} />
          <span>
            <strong>{role === "contractor" ? "Next job to fill" : "Next job fit"}</strong>
            <small>{nextJob.title} - {currency(nextJob.pay)}</small>
          </span>
        </button>
        <button type="button" className="mobile-next-row" onClick={() => onNavigate(pendingPaymentRecord ? "Records" : "Tools")}>
          <ReceiptText size={17} />
          <span>
            <strong>{pendingPaymentRecord ? "Payment pending" : "Invoice ready"}</strong>
            <small>
              {pendingPaymentRecord
                ? `${pendingPaymentRecord.jobTitle} - ${currency(pendingPaymentRecord.amount)}`
                : "Create invoice for this work order"}
            </small>
          </span>
        </button>
        <button type="button" className="mobile-next-row" onClick={() => onNavigate("Messages")}>
          <MessageCircle size={17} />
          <span>
            <strong>Message thread</strong>
            <small>{selectedJob.contractor} - work order record stays attached</small>
          </span>
        </button>
        {topPost && (
          <button type="button" className="mobile-next-row" onClick={onCreateCommunityPrompt}>
            <MessageSquareText size={17} />
            <span>
              <strong>Ask Shop Talk</strong>
              <small>{topPost.title}</small>
            </span>
          </button>
        )}
      </section>

      <section className="desktop-focus-grid" aria-label="Today's work">
        <article className="dashboard-card today-card">
          <div className="dashboard-card-head">
            <span>Today's Work</span>
            <button type="button" onClick={() => onNavigate("Marketplace")}>View all</button>
          </div>
          <div className="dashboard-job dashboard-job-visual">
            <div>
              <strong>{selectedJob.title}</strong>
              <small>{selectedJob.trade}</small>
              <small>{selectedJob.location}</small>
            </div>
            <em>{selectedApplication?.state ?? selectedJob.status}</em>
          </div>
          <div className="dashboard-progress">
            <span>{selectedJob.match}%</span>
            <i><b style={{ width: `${Math.min(selectedJob.match, 100)}%` }} /></i>
          </div>
          <div className="dashboard-meta-row">
            <span><CalendarClock size={15} /> {selectedJob.posted}</span>
            <span><CreditCard size={15} /> {currency(selectedJob.pay)}</span>
            <span>{selectedApplication?.state ?? "Ready"}</span>
          </div>
          <button type="button" className="dashboard-main-button" onClick={() => onOpenJob(selectedJob.id)}>Open work order</button>
        </article>

        <article className="dashboard-card upnext-card">
          <div className="dashboard-card-head">
            <span>Up Next</span>
            <button type="button" onClick={() => onNavigate("Marketplace")}>View all</button>
          </div>
          <div className="dashboard-job dashboard-job-visual alt">
            <div>
              <strong>{nextJob.title}</strong>
              <small>{nextJob.trade}</small>
              <small>{nextJob.location}</small>
            </div>
            <em className="warning">{nextJob.posted}</em>
          </div>
          <div className="dashboard-meta-row">
            <span><CalendarClock size={15} /> {nextJob.posted}</span>
            <span><CreditCard size={15} /> {currency(nextJob.pay)}</span>
            <span>{nextJob.status}</span>
          </div>
          <button type="button" className="dashboard-main-button" onClick={() => onOpenJob(nextJob.id)}>View work order</button>
        </article>
      </section>

      <article className="home-hero-panel">
        <div className="home-hero-copy">
          <span>{role === "contractor" ? "Contractor home" : "Tradesperson home"}</span>
          <h2>Today's work, trusted people, and field tools in one place.</h2>
          <p>
            See the job that needs attention, find nearby help, send a message, or build an invoice without digging.
          </p>
          <div className="home-action-grid">
            <button type="button" className="primary-action" onClick={role === "contractor" ? onPostJob : () => onNavigate("Marketplace")}>
              {role === "contractor" ? <Plus size={17} /> : <BriefcaseBusiness size={17} />}
              {role === "contractor" ? "Post work" : "Find work"}
            </button>
            <button type="button" onClick={onCreateCommunityPrompt}>
              <MessageSquareText size={16} />
              Ask from job
            </button>
            <button type="button" onClick={() => onNavigate("Tools")}>
              <Wrench size={16} />
              Open tools
            </button>
          </div>
        </div>
        <div className="home-hero-visual">
          <div className="hero-visual-head">
            <span>Selected work order</span>
            <strong>{selectedJob.title}</strong>
          </div>
          <ProjectVisual trade={selectedJob.trade} />
          <div className="hero-visual-meta">
            <div>
              <span>{selectedJob.trade}</span>
              <strong>{selectedJob.location}</strong>
              <em>{selectedApplication?.state ?? selectedJob.status}</em>
            </div>
            <div>
              <span>{currency(selectedJob.pay)}</span>
              <strong>{selectedJob.durationHours}h estimate</strong>
              <em>{selectedJob.match}% match</em>
            </div>
          </div>
        </div>
      </article>

      <section className="home-metric-grid" aria-label="Daily signals">
        <ModernMetric icon={BriefcaseBusiness} label="Open work" value={`${jobs.length}`} detail={`${currency(jobs.reduce((sum, job) => sum + job.pay, 0))} active value`} />
        <ModernMetric icon={MessageCircle} label="Shop Talk" value={`${verifiedFixes}`} detail="Verified field fixes" />
        <ModernMetric icon={ThumbsUp} label="Shout-outs" value={`${shoutOuts.length}`} detail="Peer recommendations" />
        <ModernMetric icon={Flag} label="Moderation" value={`${pendingReports}`} detail="Reports waiting" />
      </section>

      <section className="home-grid">
        <article className="home-panel news-panel">
          <div className="home-panel-heading">
            <Newspaper size={18} />
            <div>
              <span>Trade news</span>
              <h3>Compliance and local signals</h3>
            </div>
          </div>
          {latestNews && (
            <a className="news-feature" href={latestNews.url} target={latestNews.url === "#" ? undefined : "_blank"} rel="noreferrer">
              <span>{latestNews.urgency ?? latestNews.source}</span>
              <strong>{latestNews.headline}</strong>
              <p>{latestNews.summary}</p>
              <small>{latestNews.source} - {latestNews.date}</small>
            </a>
          )}
          {secondaryNews.map((item) => (
            <article className="news-row" key={item.id}>
              <span>{item.source} - {item.date}</span>
              <strong>{item.headline}</strong>
              <p>{item.summary}</p>
            </article>
          ))}
        </article>

        <article className="home-panel talk-panel">
          <div className="home-panel-heading">
            <MessageCircle size={18} />
            <div>
              <span>Shop Talk</span>
              <h3>Questions worth answering</h3>
            </div>
          </div>
          <div className="home-list">
            {topPosts.map((post) => (
              <button type="button" className="home-talk-row" key={post.id} onClick={() => onNavigate("Shop Talk")}>
                <span>{post.trade} - {post.status}</span>
                <strong>{post.title}</strong>
                <small>{netScore(post)} score - {post.replies.length} replies</small>
              </button>
            ))}
          </div>
        </article>

        <article className="home-panel work-panel">
          <div className="home-panel-heading">
            <BriefcaseBusiness size={18} />
            <div>
              <span>Work to move</span>
              <h3>{role === "contractor" ? "Fill jobs faster" : "Apply where you fit"}</h3>
            </div>
          </div>
          <div className="home-list">
            {featuredJobs.map((job) => (
              <article className="home-job-row" key={job.id}>
                <div>
                  <span>{job.trade} - {job.location}</span>
                  <strong>{job.title}</strong>
                  <small>{currency(job.pay)} - {job.match}% match - {job.status}</small>
                </div>
                <div className="home-row-actions">
                  <button type="button" onClick={() => onOpenJob(job.id)}>Open</button>
                  <button type="button" onClick={() => role === "contractor" ? onInviteToJob(job.id) : onApplyToJob(job.id)}>
                    {role === "contractor" ? "Invite" : "Apply"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </article>

        <article className="home-panel reputation-panel">
          <div className="home-panel-heading">
            <ThumbsUp size={18} />
            <div>
              <span>Peer reputation</span>
              <h3>Recent shout-outs</h3>
            </div>
          </div>
          <div className="home-list">
            {shoutOuts.slice(0, 3).map((shoutOut) => (
              <article className="shoutout-row" key={shoutOut.id}>
                <span>{shoutOut.trade} - {shoutOut.createdAt}</span>
                <strong>{shoutOut.to}</strong>
                <p>{shoutOut.message}</p>
                <small>From {shoutOut.from}</small>
              </article>
            ))}
          </div>
        </article>

        <article className="home-panel home-selected-panel">
          <div className="home-panel-heading">
            <CheckCircle2 size={18} />
            <div>
              <span>Selected work order</span>
              <h3>{selectedJob.title}</h3>
            </div>
          </div>
          <div className="selected-job-summary">
            <InfoItem icon={Hammer} label="Trade" value={selectedJob.trade} />
            <InfoItem icon={CalendarClock} label="Timeline" value={`${selectedJob.durationHours}h est.`} />
            <InfoItem icon={CreditCard} label="Pay" value={currency(selectedJob.pay)} />
            <InfoItem icon={FileCheck2} label="State" value={selectedApplication?.state ?? selectedJob.status} />
          </div>
          <div className="home-action-grid compact">
            <button type="button" onClick={() => onOpenJob(selectedJob.id)}>
              <ClipboardList size={15} />
              Open work order
            </button>
            <button type="button" onClick={() => onNavigate("Records")}>
              <FolderOpen size={15} />
              Records
            </button>
            <button type="button" onClick={() => onNavigate("Tools")}>
              <Calculator size={15} />
              Estimate
            </button>
          </div>
          {pendingPayments > 0 && (
            <div className="home-alert">
              <ReceiptText size={15} />
              <span>{pendingPayments} direct payment record{pendingPayments === 1 ? "" : "s"} need paid confirmation.</span>
            </div>
          )}
        </article>
      </section>
    </section>
  );
}

function ShopTalkView({
  profile,
  communityPosts,
  onVotePost,
  onVoteAnswer,
  onAddAnswer,
  onVerifyAnswer,
  onReportPost,
  onCreatePrompt,
}: {
  profile: AccountProfile;
  communityPosts: CommunityPost[];
  onVotePost: (postId: number, direction: "up" | "down") => void;
  onVoteAnswer: (postId: number, answerId: number, direction: "up" | "down") => void;
  onAddAnswer: (postId: number, body: string) => void;
  onVerifyAnswer: (postId: number, answerId: number) => void;
  onReportPost: (postId: number, reason: CommunityReport["reason"]) => void;
  onCreatePrompt: () => void;
}) {
  const [tradeFilter, setTradeFilter] = useState("All trades");
  const [selectedPostId, setSelectedPostId] = useState(communityPosts[0]?.id ?? 0);
  const [answerDraft, setAnswerDraft] = useState(
    "I would start by confirming scope, access, tool needs, and what photos should go in the closeout.",
  );
  const tradeFilters = ["All trades", "General", ...specialtyOptions];
  const reportReasons: CommunityReport["reason"][] = ["Misinformation", "Safety concern"];
  const filteredPosts = communityPosts.filter(
    (post) => tradeFilter === "All trades" || post.trade === tradeFilter,
  );
  const selectedPost =
    filteredPosts.find((post) => post.id === selectedPostId) ??
    filteredPosts[0] ??
    communityPosts[0];
  const sortedPosts = [...filteredPosts].sort((a, b) => {
    if (a.status === "Needs a pro answer" && b.status !== "Needs a pro answer") return -1;
    if (a.status !== "Needs a pro answer" && b.status === "Needs a pro answer") return 1;
    return netScore(b) - netScore(a);
  });
  const profileBadges = communityBadgeLabels(communityPosts, profile.displayName);

  function submitAnswer() {
    const body = answerDraft.trim();
    if (!selectedPost || !body) {
      return;
    }

    onAddAnswer(selectedPost.id, body);
    setAnswerDraft("");
  }

  if (!selectedPost) {
    return (
      <section className="shop-talk-layout">
        <article className="empty-ledger">
          <MessageCircle size={18} />
          <strong>No Shop Talk posts yet.</strong>
          <span>Create the first field question from the active work order.</span>
          <button type="button" onClick={onCreatePrompt}>Create prompt</button>
        </article>
      </section>
    );
  }

  return (
    <section className="shop-talk-layout" aria-label="Shop Talk community">
      <aside className="shop-talk-sidebar">
        <div className="shop-talk-command">
          <div>
            <span>Community knowledge</span>
            <h2>Field answers, not generic Q&A</h2>
            <p>Seeded prompts are labeled. Verified Fix answers earn visible reputation and stay separate from job reviews.</p>
          </div>
          <button type="button" className="primary-action" onClick={onCreatePrompt}>
            <Plus size={17} />
            Ask from job
          </button>
        </div>

        <label className="input-control">
          <span>Filter by trade</span>
          <select value={tradeFilter} onChange={(event) => setTradeFilter(event.target.value)}>
            {tradeFilters.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </label>

        <div className="shop-post-list">
          {sortedPosts.map((post) => (
            <button
              type="button"
              key={post.id}
              className={post.id === selectedPost.id ? "shop-post-card selected" : "shop-post-card"}
              onClick={() => setSelectedPostId(post.id)}
            >
              <span>{post.trade} - {post.status}</span>
              <strong>{post.title}</strong>
              <small>{netScore(post)} score - {post.replies.length} replies - {post.createdAt}</small>
            </button>
          ))}
        </div>
      </aside>

      <article className="shop-talk-detail">
        <div className="shop-question-header">
          <div>
            <span>{selectedPost.badge ? `${selectedPost.badge} - ${selectedPost.author}` : selectedPost.author}</span>
            <h2>{selectedPost.title}</h2>
            <p>{selectedPost.body}</p>
          </div>
          <span className={selectedPost.status === "Verified Fix" ? "state-pill verified" : "state-pill"}>
            {selectedPost.status}
          </span>
        </div>

        <div className="shop-question-actions">
          <button type="button" onClick={() => onVotePost(selectedPost.id, "up")}>
            <ThumbsUp size={15} />
            {selectedPost.upvotes}
          </button>
          <button type="button" onClick={() => onVotePost(selectedPost.id, "down")}>
            <ThumbsDown size={15} />
            {selectedPost.downvotes}
          </button>
          {reportReasons.map((reason) => (
            <button type="button" key={reason} onClick={() => onReportPost(selectedPost.id, reason)}>
              <Flag size={15} />
              {reason}
            </button>
          ))}
        </div>

        <section className="answer-composer">
          <div>
            <span>Answer as {profile.displayName}</span>
            <strong>{profileBadges.length ? profileBadges.join(", ") : "New contributor"}</strong>
          </div>
          <textarea
            value={answerDraft}
            onChange={(event) => setAnswerDraft(event.target.value)}
            rows={4}
            placeholder="Share the field habit, safety check, tool setup, or closeout proof that would prevent a callback."
          />
          <button type="button" className="primary-action" onClick={submitAnswer} disabled={!answerDraft.trim()}>
            <Send size={17} />
            Post answer
          </button>
        </section>

        <section className="answer-list" aria-label="Community answers">
          {selectedPost.replies.length === 0 ? (
            <article className="empty-ledger">
              <MessageCircle size={18} />
              <strong>This needs a real trade answer.</strong>
              <span>Answer it, then mark the best response as Verified Fix during testing.</span>
            </article>
          ) : sortedAnswers(selectedPost.replies).map((answer) => (
            <article className={answer.verifiedFix ? "answer-card verified" : "answer-card"} key={answer.id}>
              <div className="answer-card-heading">
                <div>
                  <span>{answer.author}</span>
                  <strong>{answer.verifiedFix ? "Verified Fix" : "Community answer"}</strong>
                </div>
                {answer.verifiedFix && <CheckCircle2 size={18} />}
              </div>
              <p>{answer.body}</p>
              <div className="answer-actions">
                <button type="button" onClick={() => onVoteAnswer(selectedPost.id, answer.id, "up")}>
                  <ThumbsUp size={14} />
                  {answer.upvotes}
                </button>
                <button type="button" onClick={() => onVoteAnswer(selectedPost.id, answer.id, "down")}>
                  <ThumbsDown size={14} />
                  {answer.downvotes}
                </button>
                <button type="button" disabled={answer.verifiedFix} onClick={() => onVerifyAnswer(selectedPost.id, answer.id)}>
                  <BadgeCheck size={14} />
                  {answer.verifiedFix ? "Verified" : "Mark fix"}
                </button>
              </div>
            </article>
          ))}
        </section>
      </article>
    </section>
  );
}

function ToolsView({
  role,
  selectedJob,
  onOpenJob,
  onNavigate,
}: {
  role: Role;
  selectedJob: Job;
  onOpenJob: (id: number) => void;
  onNavigate: (view: NavLabel) => void;
}) {
  return (
    <section className="tools-layout" aria-label="Trade tools">
      <section className="tools-command" aria-label="Tool command center">
        <div>
          <span>Field tools</span>
          <h2>Invoices, estimates, and quick math for the active work order.</h2>
          <p>{selectedJob.title} in {selectedJob.location} is loaded into the tools below.</p>
        </div>
        <button type="button" className="primary-action" onClick={() => onOpenJob(selectedJob.id)}>
          <BriefcaseBusiness size={17} />
          Open work order
        </button>
      </section>
      <InvoiceTool key={selectedJob.id} role={role} selectedJob={selectedJob} onOpenJob={onOpenJob} />
      <section className="jobsite-camera-card" aria-label="Jobsite camera and records">
        <div>
          <span>Jobsite camera</span>
          <h3>Photo records, timelines, and closeout reports</h3>
          <p>
            Capture before, during, and after proof for {selectedJob.title}. Build a
            work record, generate a report, and keep closeout photos tied to the job.
          </p>
        </div>
        <div className="jobsite-camera-actions">
          <button type="button" className="primary-action" onClick={() => onNavigate("Records")}>
            <Camera size={17} />
            Open jobsite records
          </button>
          <button type="button" onClick={() => onNavigate("Records")}>
            <FileDown size={16} />
            Build report
          </button>
        </div>
      </section>
      <section className="tools-grid">
        <FractionTool />
        <MaterialsWasteTool selectedJob={selectedJob} />
        <PaymentNoteTool selectedJob={selectedJob} />
      </section>
      <CalculatorView role={role} selectedJob={selectedJob} onOpenJob={onOpenJob} />
    </section>
  );
}

function InvoiceTool({
  role,
  selectedJob,
  onOpenJob,
}: {
  role: Role;
  selectedJob: Job;
  onOpenJob: (id: number) => void;
}) {
  const [invoiceNumber, setInvoiceNumber] = useState(`INV-${selectedJob.id}`);
  const [billTo, setBillTo] = useState(selectedJob.contractor);
  const [payTo, setPayTo] = useState(role === "contractor" ? "Selected tradesperson" : "My trade profile");
  const [laborHours, setLaborHours] = useState(selectedJob.durationHours);
  const [laborRate, setLaborRate] = useState(Math.max(45, Math.round(selectedJob.pay / Math.max(selectedJob.durationHours, 1) * 0.76)));
  const [materials, setMaterials] = useState(Math.max(75, Math.round(selectedJob.pay * 0.2)));
  const [other, setOther] = useState(0);
  const [taxPercent, setTaxPercent] = useState(0);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [method, setMethod] = useState("Zelle");
  const [terms, setTerms] = useState("Due on completion");
  const [status, setStatus] = useState<"Draft" | "Sent" | "Paid">("Draft");
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  function numberFromInput(setValue: (value: number) => void, minimum = 0) {
    return (event: ChangeEvent<HTMLInputElement>) => {
      const value = Number(event.target.value);
      setValue(Number.isFinite(value) ? Math.max(minimum, value) : minimum);
    };
  }

  const labor = Math.round(laborHours * laborRate);
  const subtotal = labor + materials + other;
  const tax = Math.round(subtotal * (taxPercent / 100));
  const total = subtotal + tax;
  const invoiceSubject = `${brandConfig.appName} invoice ${invoiceNumber} - ${selectedJob.title}`;
  const invoiceText = [
    `${brandConfig.appName} invoice ${invoiceNumber}`,
    `Status: ${status}`,
    `Job: ${selectedJob.title}`,
    `Bill to: ${billTo}`,
    `Pay to: ${payTo}`,
    `Labor: ${laborHours} hrs x ${currency(laborRate)} = ${currency(labor)}`,
    `Materials: ${currency(materials)}`,
    `Other: ${currency(other)}`,
    `Tax: ${currency(tax)}`,
    `Total due: ${currency(total)}`,
    `Terms: ${terms}`,
    `Payment method: ${method}`,
    "Payment is handled directly between users. The platform does not process or hold funds.",
  ].join("\n");

  function markSent() {
    setStatus("Sent");
  }

  async function copyInvoice() {
    try {
      await navigator.clipboard.writeText(invoiceText);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  function downloadInvoice() {
    const blob = new Blob([invoiceText], { type: "text/plain;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${invoiceNumber.toLowerCase()}-${brandConfig.appSlug}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    setDownloaded(true);
  }

  async function deliverInvoice(channel: "email" | "sms", recipient: string) {
    const target = recipient.trim();
    if (!target) {
      return;
    }

    const fallbackRecipient = channel === "email" ? target : target.replace(/[^\d+]/g, "");
    const fallbackUrl = channel === "email"
      ? `mailto:${fallbackRecipient}?subject=${encodeURIComponent(invoiceSubject)}&body=${encodeURIComponent(invoiceText)}`
      : `sms:${fallbackRecipient}?body=${encodeURIComponent(invoiceText)}`;

    try {
      const response = await fetch(apiPath("/api/invoices/send"), {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          channel,
          recipient: target,
          subject: invoiceSubject,
          message: invoiceText,
        }),
      });

      if (response.ok) {
        markSent();
        return;
      }
    } catch {
      // Fall through to the local compose fallback below.
    }

    markSent();
    window.location.href = fallbackUrl;
  }

  function sendByEmail() {
    void deliverInvoice("email", recipientEmail);
  }

  function sendByText() {
    void deliverInvoice("sms", recipientPhone);
  }

  return (
    <section className="invoice-tool" aria-label="Invoice builder">
      <div className="invoice-editor">
        <div className="tool-card-heading">
          <ReceiptText size={20} />
          <div>
            <span>Invoice builder</span>
            <h3>Create a direct-payment invoice</h3>
          </div>
        </div>

        <div className="invoice-form-grid">
          <label>
            Invoice #
            <input value={invoiceNumber} onChange={(event) => setInvoiceNumber(event.target.value)} />
          </label>
          <label>
            Bill to
            <input value={billTo} onChange={(event) => setBillTo(event.target.value)} />
          </label>
          <label>
            Pay to
            <input value={payTo} onChange={(event) => setPayTo(event.target.value)} />
          </label>
          <label>
            Recipient email
            <input
              value={recipientEmail}
              onChange={(event) => setRecipientEmail(event.target.value)}
              type="email"
              placeholder="billing@contractor.com"
            />
          </label>
          <label>
            Recipient phone
            <input
              value={recipientPhone}
              onChange={(event) => setRecipientPhone(event.target.value)}
              type="tel"
              placeholder="+1 904 555 0101"
            />
          </label>
          <label>
            Terms
            <select value={terms} onChange={(event) => setTerms(event.target.value)}>
              {["Due on completion", "Due on receipt", "Net 7", "Net 15", "Deposit + final"].map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>
          <label>
            Payment method
            <select value={method} onChange={(event) => setMethod(event.target.value)}>
              {["Zelle", "Check", "ACH", "Cash", "Venmo", "PayPal"].map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select value={status} onChange={(event) => setStatus(event.target.value as "Draft" | "Sent" | "Paid")}>
              {["Draft", "Sent", "Paid"].map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="invoice-line-grid">
          <label>
            Labor hours
            <input type="number" min="0" step="0.5" value={laborHours} onChange={numberFromInput(setLaborHours)} />
          </label>
          <label>
            Labor rate
            <input type="number" min="0" value={laborRate} onChange={numberFromInput(setLaborRate)} />
          </label>
          <label>
            Materials
            <input type="number" min="0" value={materials} onChange={numberFromInput(setMaterials)} />
          </label>
          <label>
            Other
            <input type="number" min="0" value={other} onChange={numberFromInput(setOther)} />
          </label>
          <label>
            Tax %
            <input type="number" min="0" value={taxPercent} onChange={numberFromInput(setTaxPercent)} />
          </label>
        </div>
      </div>

      <aside className="invoice-preview">
        <div className="invoice-preview-header">
          <div>
            <span>{invoiceNumber}</span>
            <strong>{selectedJob.title}</strong>
          </div>
          <em>{status}</em>
        </div>

        <div className="invoice-party-grid">
          <div>
            <span>Bill to</span>
            <strong>{billTo}</strong>
          </div>
          <div>
            <span>Pay to</span>
            <strong>{payTo}</strong>
          </div>
        </div>

        <div className="invoice-total-card">
          <span>Total due</span>
          <strong>{currency(total)}</strong>
          <small>{terms} by {method}</small>
        </div>

        <div className="invoice-breakdown">
          <div><span>Labor</span><strong>{currency(labor)}</strong></div>
          <div><span>Materials</span><strong>{currency(materials)}</strong></div>
          <div><span>Other</span><strong>{currency(other)}</strong></div>
          <div><span>Tax</span><strong>{currency(tax)}</strong></div>
        </div>

        <div className="invoice-actions">
          <button type="button" onClick={sendByEmail} disabled={!recipientEmail.trim()}>
            <Mail size={15} />
            Email
          </button>
          <button type="button" onClick={sendByText} disabled={!recipientPhone.trim()}>
            <MessageCircle size={15} />
            Text
          </button>
          <button type="button" onClick={copyInvoice}>
            <FileText size={15} />
            {copied ? "Copied" : "Copy"}
          </button>
          <button type="button" onClick={downloadInvoice}>
            <ReceiptText size={15} />
            {downloaded ? "Downloaded" : "Download"}
          </button>
          <button type="button" onClick={() => onOpenJob(selectedJob.id)}>
            <BriefcaseBusiness size={15} />
            Open work order
          </button>
        </div>
      </aside>
    </section>
  );
}

function FractionTool() {
  const [feet, setFeet] = useState(12);
  const [inches, setInches] = useState(7.5);
  const [pieces, setPieces] = useState(4);
  const totalInches = (feet * 12 + inches) * pieces;
  const totalFeet = Math.floor(totalInches / 12);
  const remainder = Number((totalInches - totalFeet * 12).toFixed(2));

  return (
    <article className="tool-card">
      <div className="tool-card-heading">
        <Calculator size={18} />
        <div>
          <span>Field math</span>
          <h3>Foot-inch multiplier</h3>
        </div>
      </div>
      <div className="tool-input-grid">
        <label>
          Feet
          <input type="number" value={feet} min="0" onChange={(event) => setFeet(Math.max(0, Number(event.target.value) || 0))} />
        </label>
        <label>
          Inches
          <input type="number" value={inches} min="0" step="0.125" onChange={(event) => setInches(Math.max(0, Number(event.target.value) || 0))} />
        </label>
        <label>
          Pieces
          <input type="number" value={pieces} min="1" onChange={(event) => setPieces(Math.max(1, Number(event.target.value) || 1))} />
        </label>
      </div>
      <div className="tool-result">
        <span>Total length</span>
        <strong>{totalFeet}' {remainder}"</strong>
      </div>
    </article>
  );
}

function MaterialsWasteTool({ selectedJob }: { selectedJob: Job }) {
  const [baseCost, setBaseCost] = useState(Math.max(100, Math.round(selectedJob.pay * 0.28)));
  const [wastePercent, setWastePercent] = useState(10);
  const total = Math.round(baseCost * (1 + wastePercent / 100));

  return (
    <article className="tool-card">
      <div className="tool-card-heading">
        <Wrench size={18} />
        <div>
          <span>Material check</span>
          <h3>Waste and pickup buffer</h3>
        </div>
      </div>
      <div className="tool-input-grid two">
        <label>
          Material cost
          <input type="number" value={baseCost} min="0" onChange={(event) => setBaseCost(Math.max(0, Number(event.target.value) || 0))} />
        </label>
        <label>
          Waste %
          <input type="number" value={wastePercent} min="0" onChange={(event) => setWastePercent(Math.max(0, Number(event.target.value) || 0))} />
        </label>
      </div>
      <div className="tool-result">
        <span>Carry in job price</span>
        <strong>{currency(total)}</strong>
      </div>
    </article>
  );
}

function PaymentNoteTool({ selectedJob }: { selectedJob: Job }) {
  const [method, setMethod] = useState("Zelle");
  const [copied, setCopied] = useState(false);
  const paymentNote = `${selectedJob.title} - ${currency(selectedJob.pay)} direct payment by ${method}. Completion photos and review prompt should stay in the work order record.`;

  async function copyNote() {
    try {
      await navigator.clipboard.writeText(paymentNote);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <article className="tool-card">
      <div className="tool-card-heading">
        <ReceiptText size={18} />
        <div>
          <span>Bookkeeping</span>
          <h3>Direct payment note</h3>
        </div>
      </div>
      <label className="tool-select">
        Payment method
        <select value={method} onChange={(event) => setMethod(event.target.value)}>
          {["Zelle", "Check", "ACH", "Cash", "Venmo", "PayPal"].map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      </label>
      <p>{paymentNote}</p>
      <button type="button" onClick={copyNote}>
        <FileText size={15} />
        {copied ? "Copied" : "Copy note"}
      </button>
    </article>
  );
}

function MyJobsView({
  jobs,
  closeouts,
  scheduleHolds,
  dispatchNotes,
  onOpenJob,
  onInviteToJob,
}: {
  jobs: Job[];
  closeouts: Record<number, CloseoutRecord>;
  scheduleHolds: Set<number>;
  dispatchNotes: Record<number, string>;
  onOpenJob: (id: number) => void;
  onInviteToJob: (id: number) => void;
}) {
  return (
    <section className="ops-grid jobs-ops-grid" aria-label="My jobs board">
      {jobs.map((job) => {
        const closeout = closeouts[job.id] ?? defaultCloseout;
        const scheduleHeld = scheduleHolds.has(job.id);
        const nextStep = closeout.approved
          ? "Payment record"
          : scheduleHeld
            ? "Closeout"
            : job.status === "Shortlisting"
              ? "Invite crew"
              : "Schedule";

        return (
          <article className="ops-card job-ops-card" key={job.id}>
            <div className="ops-card-top">
              <span className={`status-chip ${statusClass(job.status)}`}>{job.status}</span>
              <strong>{currency(job.pay)}</strong>
            </div>
            <h2>{job.title}</h2>
            <p>{job.summary}</p>
            <div className="compact-meta-grid">
              <InfoItem icon={Hammer} label="Trade" value={job.trade} />
              <InfoItem icon={CalendarClock} label="Next" value={nextStep} />
              <InfoItem icon={MapPin} label="Location" value={job.location} />
              <InfoItem icon={ShieldCheck} label="Trust" value={job.trustRequirement} />
            </div>
            <div className="work-note">
              <MessageCircle size={15} />
              <span>{dispatchNotes[job.id] ?? "Legal consent ready. Confirm tools and start window."}</span>
            </div>
            <div className="ops-actions">
              <button onClick={() => onOpenJob(job.id)}>
                <ClipboardList size={15} />
                Open dispatch
              </button>
              <button onClick={() => onInviteToJob(job.id)}>
                <UserCheck size={15} />
                Invite crew
              </button>
            </div>
          </article>
        );
      })}
    </section>
  );
}

function ApplicationsView({
  role,
  jobs,
  applications,
  onApply,
  onApplyToJob,
  onOpenJob,
}: {
  role: Role;
  jobs: Job[];
  applications: ApplicationRecord[];
  onApply: () => void;
  onApplyToJob: (id: number) => void;
  onOpenJob: (id: number) => void;
}) {
  const rows = applications.length
    ? applications.map((record) => ({
        job: jobs.find((job) => job.id === record.jobId) ?? jobs[0],
        state: record.state,
      }))
    : jobs.slice(0, 3).map((job) => ({ job, state: "Suggested" }));

  return (
    <section className="operations-layout">
      <div className="ops-copy-panel">
        <FileCheck2 size={24} />
        <h2>{role === "tradesperson" ? "Portfolio applications" : "Applicant queue"}</h2>
        <p>
          {brandConfig.appName} keeps applications useful by showing tools, city/state,
          difficulty, and trust requirements before anyone spends time chasing the job.
        </p>
        <button className="primary-action" onClick={onApply}>
          <Send size={17} />
          Submit application
        </button>
      </div>
      <div className="ops-list-panel">
        {rows.map(({ job, state }) => (
          <article className="data-row" key={`${job.id}-${state}`}>
            <div>
              <span>{job.trade} - {job.location}</span>
              <strong>{job.title}</strong>
              <small>
                {job.match}% match - {currency(job.pay)} - {job.durationHours}h - {job.insuranceRequired ? "insurance required" : "insurance optional"}
              </small>
            </div>
            <span className="state-pill">{state}</span>
            <button onClick={() => onApplyToJob(job.id)}>
              <FileCheck2 size={14} />
              Submit
            </button>
            <button onClick={() => onOpenJob(job.id)}>
              <ClipboardList size={14} />
              View
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

function InvitesView({
  jobs,
  applications,
  onInvite,
  onInviteToJob,
  onOpenJob,
}: {
  jobs: Job[];
  applications: ApplicationRecord[];
  onInvite: () => void;
  onInviteToJob: (id: number) => void;
  onOpenJob: (id: number) => void;
}) {
  return (
    <section className="ops-grid invite-grid" aria-label="Invite center">
      <article className="ops-card invite-command-card">
        <Sparkles size={24} />
        <h2>Best-fit shortlist is ready</h2>
        <p>
          Invite only trades people with matching specialties, owned tools, nearby
          availability, and a clean completed-job history.
        </p>
        <button className="primary-action" onClick={onInvite}>
          <UserCheck size={17} />
          Invite selected crew
        </button>
      </article>
      {jobs.map((job) => {
        const matched = talent
          .filter((person) => person.trade === job.trade)
          .sort((a, b) => b.match - a.match)[0];
        const alreadyInvited = applications.some(
          (record) => record.jobId === job.id && record.state === "Invited",
        );

        return (
          <article className="ops-card" key={job.id}>
            <div className="ops-card-top">
              <span className="state-pill">{alreadyInvited ? "Invited" : "Ready"}</span>
              <strong>{matched?.match ?? job.match}%</strong>
            </div>
            <h2>{job.title}</h2>
            <p>{matched ? `${matched.name} has ${matched.tools.slice(0, 2).join(", ")} and responds in ${matched.responseTime}.` : "No crew match yet."}</p>
            <div className="ops-actions">
              <button onClick={() => onInviteToJob(job.id)}>
                <UserCheck size={15} />
                Invite
              </button>
              <button onClick={() => onOpenJob(job.id)}>
                <ClipboardList size={15} />
                Review job
              </button>
            </div>
          </article>
        );
      })}
    </section>
  );
}

function CrewView({
  jobs,
  people,
  matchingTalent,
  trustReady,
  shoutOuts,
  onReviewConsent,
  onInviteToJob,
  onCreateShoutOut,
}: {
  jobs: Job[];
  people: typeof talent;
  matchingTalent: typeof talent;
  trustReady: boolean;
  shoutOuts: ShoutOut[];
  onReviewConsent: () => void;
  onInviteToJob: (id: number) => void;
  onCreateShoutOut: (to: string, tradeName: Trade) => void;
}) {
  const highlighted = matchingTalent[0] ?? people[0];

  return (
    <section className="operations-layout crew-layout">
      <div className="ops-copy-panel">
        <Users size={24} />
        <h2>Trusted bench</h2>
        <p>
          Top match right now is {highlighted.name}, with {highlighted.match}%
          fit for the active work order and a {highlighted.responseTime} response time.
        </p>
        <button className="primary-action" onClick={onReviewConsent}>
          <ShieldCheck size={17} />
          {trustReady ? "Consent reviewed" : "Review trust consent"}
        </button>
      </div>
      <div className="crew-directory">
        {people.map((person) => {
          const matchingJob = jobs.find((job) => job.trade === person.trade) ?? jobs[0];
          const recommendationCount = shoutOuts.filter((shoutOut) => shoutOut.to === person.name).length;
          return (
            <article className="crew-card" key={person.id}>
              <div className="avatar">{person.name.slice(0, 2).toUpperCase()}</div>
              <div className="crew-profile-copy">
                <span>{person.trade} - {person.location}</span>
                <strong>{person.name}</strong>
                <small>{person.portfolio.join(", ")} - {person.insured ? "self-reported insured" : "insurance not marked"}</small>
                <div className="crew-badge-row">
                  {person.verified && <em>Verified profile</em>}
                  {recommendationCount > 0 && <em>{recommendationCount} shout-out{recommendationCount === 1 ? "" : "s"}</em>}
                </div>
              </div>
              <div className="crew-score">
                <strong>{person.match}%</strong>
                <span>{person.rating}</span>
              </div>
              <div className="crew-actions">
                <button onClick={() => onInviteToJob(matchingJob.id)}>
                  <UserCheck size={14} />
                  Invite
                </button>
                <button onClick={() => onCreateShoutOut(person.name, person.trade)}>
                  <ThumbsUp size={14} />
                  Shout-out
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function MessagesView({
  selectedJob,
  matchingTalent,
  messageDraft,
  sentMessages,
  onMessageDraft,
  onSendMessage,
  onOpenJob,
}: {
  selectedJob: Job;
  matchingTalent: typeof talent;
  messageDraft: string;
  sentMessages: string[];
  onMessageDraft: (message: string) => void;
  onSendMessage: () => void;
  onOpenJob: (id: number) => void;
}) {
  const contact = matchingTalent[0] ?? talent[0];
  const messages = [
    ...sentMessages.map((message) => ({ author: "Ryan Mitchell", text: message })),
    {
      author: contact.name,
      text: "I can take this. Please send the start window and parking notes.",
    },
    {
      author: "Job assistant",
      text: `${selectedJob.state} guidance: ${selectedJob.guidance[0].toLowerCase()}.`,
    },
  ];

  return (
    <section className="message-workspace">
      <aside className="thread-list">
        {[selectedJob, ...seedJobs.filter((job) => job.id !== selectedJob.id).slice(0, 3)].map((job) => (
          <button key={job.id} onClick={() => onOpenJob(job.id)}>
            <span>{job.trade}</span>
            <strong>{job.title}</strong>
            <small>{job.location}</small>
          </button>
        ))}
      </aside>
      <section className="thread-panel" aria-label="Selected message thread">
        <div className="thread-heading">
          <div>
            <span>{contact.name} - {contact.responseTime}</span>
            <h2>{selectedJob.title}</h2>
          </div>
          <button onClick={onSendMessage}>
            <Send size={15} />
            Send
          </button>
        </div>
        <div className="message-list">
          {messages.map((message, index) => (
            <article key={`${message.author}-${index}`} className={message.author === "Ryan Mitchell" ? "message-bubble mine" : "message-bubble"}>
              <strong>{message.author}</strong>
              <p>{message.text}</p>
            </article>
          ))}
        </div>
        <label className="message-composer">
          <span>Job update</span>
          <textarea
            value={messageDraft}
            onChange={(event) => onMessageDraft(event.target.value)}
            rows={4}
          />
        </label>
      </section>
    </section>
  );
}

function TrustLegalView({
  jobs,
  selectedJob,
  trustReady,
  onReviewConsent,
}: {
  jobs: Job[];
  selectedJob: Job;
  trustReady: boolean;
  onReviewConsent: () => void;
}) {
  const states = Array.from(new Set(jobs.map((job) => job.state)));
  const [providerChecks, setProviderChecks] = useState<Record<string, ProviderCheckResult>>({});

  async function runProviderCheck(config: (typeof providerCheckConfigs)[number]) {
    setProviderChecks((current) => ({
      ...current,
      [config.id]: {
        status: "checking",
        message: "Checking provider configuration...",
        missing: [],
      },
    }));

    try {
      const response = await fetch(apiPath(config.path), {
        method: config.method,
        credentials: "include",
        headers: config.method === "POST" ? { "Content-Type": "application/json" } : undefined,
        body: config.method === "POST"
          ? JSON.stringify({ userId: "current-user", plan: "base", channel: "email" })
          : undefined,
      });
      const body = await response.json().catch(() => ({})) as Record<string, unknown>;
      const message = typeof body.message === "string"
        ? body.message
        : response.ok
          ? `${config.label} is configured.`
          : `${config.label} needs setup before launch.`;

      setProviderChecks((current) => ({
        ...current,
        [config.id]: {
          status: providerStatusFromResponse(response),
          message,
          missing: collectMissingKeys(body),
          checkedAt: currentTimeLabel(),
        },
      }));
    } catch {
      setProviderChecks((current) => ({
        ...current,
        [config.id]: {
          status: "offline",
          message: "API is not reachable from this browser session.",
          missing: [],
          checkedAt: currentTimeLabel(),
        },
      }));
    }
  }

  function runAllProviderChecks() {
    providerCheckConfigs.forEach((config) => {
      void runProviderCheck(config);
    });
  }

  return (
    <section className="operations-layout credential-layout">
      <div className="ops-copy-panel">
        <ShieldCheck size={24} />
        <h2>Trust setup</h2>
        <p>
          One consent agreement explains that users are responsible for licenses,
          permits, insurance, compliance, payment terms, and work order records. ID
          checks are required before real posting or accepting.
        </p>
        <button className="primary-action" onClick={onReviewConsent}>
          <BadgeCheck size={17} />
          {trustReady ? "Consent reviewed" : "Review consent"}
        </button>
      </div>
      <div className="credential-grid">
        <CredentialTile label="Legal consent" value="Accepted at signup before work starts" ready={trustReady} />
        <CredentialTile label="Identity check" value="Provider setup required before launch" ready={false} />
        <CredentialTile label="Address privacy" value={selectedJob.addressPolicy} ready />
        <CredentialTile label="Direct payment" value="Logged for records, never processed by platform" ready />
        {states.map((state) => (
          <CredentialTile
            key={state}
            label={`${state} guidance`}
            value={(stateGuidance[state] ?? ["Guidance queued"])[0]}
            ready={state === selectedJob.state || trustReady}
          />
        ))}
      </div>
      <section className="provider-readiness-panel" aria-label="Provider readiness">
        <div className="provider-readiness-heading">
          <span>Launch providers</span>
          <h3>Run live setup checks</h3>
          <p>These call the backend directly. A setup-required result is functional behavior, not a fake pass.</p>
        </div>
        <div className="provider-check-list">
          {providerCheckConfigs.map((config) => {
            const result = providerChecks[config.id] ?? {
              status: "idle",
              message: config.purpose,
              missing: [],
            };
            const buttonLabel =
              result.status === "checking"
                ? "Checking"
                : result.status === "ready"
                  ? "Recheck"
                  : "Check";

            return (
              <article className={`provider-check-card ${result.status}`} key={config.id}>
                <div>
                  <span>{config.label}</span>
                  <strong>{result.status === "idle" ? config.purpose : result.message}</strong>
                  <small>
                    {result.missing.length
                      ? `Missing: ${result.missing.join(", ")}`
                      : result.checkedAt
                        ? `Last checked ${result.checkedAt}`
                        : "Not checked yet"}
                  </small>
                </div>
                <button
                  type="button"
                  disabled={result.status === "checking"}
                  onClick={() => runProviderCheck(config)}
                >
                  {buttonLabel}
                </button>
              </article>
            );
          })}
        </div>
      </section>
    </section>
  );
}

function CredentialTile({
  label,
  value,
  ready,
}: {
  label: string;
  value: string;
  ready: boolean;
}) {
  return (
    <article className={ready ? "credential-tile ready" : "credential-tile"}>
      <ShieldCheck size={17} />
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function RecordsView({
  selectedJob,
  closeout,
  uploadedRecords,
  paymentRecords,
  onToggleRecord,
  onSubmitCloseoutPacket,
  onApproveCloseout,
  onMarkPaymentPaid,
  onExportPayments,
}: {
  selectedJob: Job;
  closeout: CloseoutRecord;
  uploadedRecords: Set<string>;
  paymentRecords: PaymentRecord[];
  onToggleRecord: (recordName: string) => void;
  onSubmitCloseoutPacket: (jobId?: number) => void;
  onApproveCloseout: (jobId?: number) => void;
  onMarkPaymentPaid: (jobId: number) => void;
  onExportPayments: () => void;
}) {
  const selectedPayment = paymentRecords.find((record) => record.jobId === selectedJob.id);
  const [uploadResult, setUploadResult] = useState<UploadCheckResult>({
    status: "idle",
    message: "Upload completion photos, signed scopes, or payment backup to managed storage.",
    missing: [],
  });
  const [uploadHistory, setUploadHistory] = useState<StoredUpload[]>([]);
  const [uploadHistoryStatus, setUploadHistoryStatus] = useState<ProviderCheckResult>({
    status: "idle",
    message: "Managed uploads will appear here after storage is connected.",
    missing: [],
  });
  const closeoutStatus = selectedPayment?.status === "Paid / Closed"
    ? "Paid / Closed"
    : selectedPayment?.status === "Payment pending"
      ? "Payment pending"
      : closeout.approved
    ? "Approved"
    : closeout.packetSubmitted
      ? "Completion pending"
      : "Not submitted";
  const selectedJobUploads = uploadHistory.filter((upload) => upload.jobId === selectedJob.id);
  const recordTimeline = useMemo(
    () =>
      buildWorkRecordTimeline(
        selectedJob,
        uploadedRecords,
        closeout,
        selectedPayment,
        selectedJobUploads.length,
      ),
    [closeout, selectedJob, selectedJobUploads.length, selectedPayment, uploadedRecords],
  );
  const recordQuickStats = useMemo(
    () => buildRecordQuickStats(selectedJob, uploadedRecords, selectedJobUploads, closeout, selectedPayment),
    [closeout, selectedJob, selectedJobUploads, selectedPayment, uploadedRecords],
  );
  const packetReadiness = Math.round(
    (recordChecklist.filter((recordName) => uploadedRecords.has(recordName)).length / recordChecklist.length) * 100,
  );
  const readyItems = recordChecklist.filter((recordName) => uploadedRecords.has(recordName));
  const missingItems = recordChecklist.filter((recordName) => !uploadedRecords.has(recordName));
  const lastUpload = selectedJobUploads[0];
  const [reportStatus, setReportStatus] = useState<"idle" | "copied" | "opened">("idle");

  async function refreshUploadHistory() {
    setUploadHistoryStatus({
      status: "checking",
      message: "Loading managed file history...",
      missing: [],
    });

    try {
      const uploads = await fetchUploadHistory();
      setUploadHistory(uploads);
      setUploadHistoryStatus({
        status: "ready",
        message: uploads.length
          ? `${uploads.length} managed upload${uploads.length === 1 ? "" : "s"} loaded.`
          : "No managed uploads have been recorded yet.",
        missing: [],
        checkedAt: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      });
    } catch (error) {
      setUploadHistoryStatus({
        status: statusFromError(error) === "setup_required" ? "setup_required" : "offline",
        message: error instanceof Error ? error.message : "Upload history is not reachable.",
        missing: [],
        checkedAt: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      });
    }
  }

  useEffect(() => {
    let active = true;

    fetchUploadHistory()
      .then((uploads) => {
        if (!active) return;
        setUploadHistory(uploads);
        setUploadHistoryStatus({
          status: "ready",
          message: uploads.length
            ? `${uploads.length} managed upload${uploads.length === 1 ? "" : "s"} loaded.`
            : "No managed uploads have been recorded yet.",
          missing: [],
          checkedAt: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
        });
      })
      .catch((error) => {
        if (!active) return;
        setUploadHistoryStatus({
          status: statusFromError(error) === "setup_required" ? "setup_required" : "offline",
          message: error instanceof Error ? error.message : "Upload history is not reachable.",
          missing: [],
          checkedAt: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
        });
      });

    return () => {
      active = false;
    };
  }, [selectedJob.id]);

  async function handleRecordUpload(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    setUploadResult({
      status: "checking",
      message: `Uploading ${file.name} to managed storage...`,
      missing: [],
      fileName: file.name,
    });

    const formData = new FormData();
    formData.append("file", file);
    formData.append("kind", "job-record");
    formData.append("jobId", String(selectedJob.id));
    formData.append("name", file.name);
    formData.append("notes", `${selectedJob.title} closeout record`);

    try {
      const response = await fetch(apiPath("/api/uploads"), {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      const message = typeof payload.error === "string"
        ? payload.error
        : typeof payload.message === "string"
          ? payload.message
          : response.ok
            ? `${file.name} is stored in the managed work order record.`
            : "Upload could not be completed.";

      if (!response.ok) {
        setUploadResult({
          status: providerStatusFromResponse(response),
          message,
          missing: collectMissingKeys(payload),
          checkedAt: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
          fileName: file.name,
        });
        return;
      }

      setUploadResult({
        status: "ready",
        message,
        missing: [],
        checkedAt: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
        fileName: file.name,
      });
      const createdUpload = normalizeStoredUpload(payload.upload);

      if (createdUpload) {
        setUploadHistory((current) => [
          createdUpload,
          ...current.filter((upload) => upload.id !== createdUpload.id),
        ]);
        setUploadHistoryStatus({
          status: "ready",
          message: "Managed upload history is current.",
          missing: [],
          checkedAt: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
        });
      }

      if (!uploadedRecords.has("Completion photos")) {
        onToggleRecord("Completion photos");
      }
    } catch {
      setUploadResult({
        status: "offline",
        message: "Upload service is not reachable. Start the API server or deploy the backend.",
        missing: [],
        checkedAt: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
        fileName: file.name,
      });
    } finally {
      input.value = "";
    }
  }

  async function handleGenerateReport() {
    const reportHtml = buildJobsiteReportHtml(
      selectedJob,
      uploadedRecords,
      selectedJobUploads,
      closeout,
      selectedPayment,
      recordTimeline,
    );
    const reportBlob = new Blob([reportHtml], { type: "text/html;charset=utf-8" });
    const reportUrl = URL.createObjectURL(reportBlob);
    const reportWindow = window.open(reportUrl, "_blank", "noopener,noreferrer");

    if (!reportWindow) {
      try {
        await navigator.clipboard.writeText(
          `${brandConfig.appName} report for ${selectedJob.title} — ${selectedJob.location}`,
        );
        setReportStatus("copied");
      } catch {
        setReportStatus("idle");
      }
      return;
    }

    setReportStatus("opened");
    window.setTimeout(() => URL.revokeObjectURL(reportUrl), 30_000);
  }

  return (
    <section className="operations-layout document-layout">
      <div className="ops-copy-panel">
        <div className="records-hero-badge">
          <Camera size={18} />
          <span>Photo-first jobsite control</span>
        </div>
        <h2>{selectedJob.title}</h2>
        <p>
          Capture the job, narrate progress, and turn every site visit into a clean
          report, timeline, and closeout packet.
        </p>
        <div className="records-kpi-grid">
          {recordQuickStats.map((stat) => (
            <article key={stat.label} className={`records-kpi ${stat.tone}`}>
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
              <small>{stat.detail}</small>
            </article>
          ))}
        </div>
        <div className="closeout-status-card">
          <span>Closeout status</span>
          <strong>{closeoutStatus}</strong>
          <small>
            {selectedPayment?.status === "Paid / Closed"
              ? "Payment is closed in the bookkeeping ledger."
              : selectedPayment?.status === "Payment pending"
                ? "Direct payment has been approved and needs paid confirmation."
                : closeout.approved
              ? "Payment note and review prompt are ready."
              : closeout.packetSubmitted
                ? "Contractor approval is the next test step."
              : "Record completion to start closeout."}
          </small>
        </div>
        <div className="records-toolbar">
          <button type="button" onClick={handleGenerateReport}>
            <FileDown size={15} />
            Generate report
          </button>
          <button
            type="button"
            onClick={async () => {
              const summary = `${selectedJob.title} · ${selectedJob.location} · ${packetReadiness}% ready`;
              try {
                await navigator.clipboard.writeText(summary);
                setReportStatus("copied");
              } catch {
                setReportStatus("idle");
              }
            }}
          >
            <Copy size={15} />
            Copy recap
          </button>
          <button
            type="button"
            onClick={() => {
              onSubmitCloseoutPacket(selectedJob.id);
              setReportStatus("opened");
            }}
          >
            <Send size={15} />
            Send to closeout
          </button>
        </div>
        <small className="records-status-note">
          {reportStatus === "opened"
            ? "Shareable report opened in a new tab."
            : reportStatus === "copied"
              ? "Recap copied to your clipboard."
              : `${readyItems.length} items ready · ${missingItems.length} still needed.`}
        </small>
      </div>
      <div className="document-checklist">
        <section className="record-timeline-panel" aria-label="Work record timeline">
          <div className="ledger-header">
            <div>
              <span>Work record timeline</span>
              <strong>Photo, scope, closeout, and payment trail</strong>
            </div>
            <span className="paid-chip">{packetReadiness}% ready</span>
          </div>
          <div className="record-activity-strip">
            <article>
              <ScanSearch size={16} />
              <div>
                <strong>Jobsite recap</strong>
                <span>{lastUpload ? `${lastUpload.name} is the latest captured record.` : "No uploads yet. Add the first field photo or scope file."}</span>
              </div>
            </article>
            <article>
              <PenTool size={16} />
              <div>
                <strong>Markup ready</strong>
                <span>Use notes, timestamps, and closeout tags to explain what changed.</span>
              </div>
            </article>
          </div>
          <div className="record-timeline-list">
            {recordTimeline.map((item) => (
              <article key={`${item.title}-${item.time}`} className={`record-timeline-item ${item.tone}`}>
                <div>
                  <strong>{item.title}</strong>
                  <span>{item.detail}</span>
                </div>
                <em>{item.time}</em>
              </article>
            ))}
          </div>
        </section>
        <section className="record-summary-panel" aria-label="Work packet summary">
          <div>
            <span>Packet summary</span>
            <strong>Everything needed before a clean closeout</strong>
            <small>
              Scope, photos, approvals, payment notes, and review status stay tied to
              the active work order so nobody has to hunt through text threads.
            </small>
          </div>
          <div className="record-summary-chips">
            <span>{selectedJob.trade}</span>
            <span>{selectedJob.workType}</span>
            <span>{selectedJob.location}</span>
            <span>{selectedPayment?.status ?? "Payment pending"}</span>
          </div>
        </section>
        <section className="record-action-grid" aria-label="Jobsite actions">
          <article>
            <Camera size={18} />
            <div>
              <strong>Capture progress</strong>
              <span>Keep before, during, and after photos tied to this job.</span>
            </div>
          </article>
          <article>
            <Share2 size={18} />
            <div>
              <strong>Share updates</strong>
              <span>Turn the job record into a clean summary for the office or customer.</span>
            </div>
          </article>
          <article>
            <Sparkles size={18} />
            <div>
              <strong>AI-ready notes</strong>
              <span>Organize field notes so recaps and reports stay easy to generate.</span>
            </div>
          </article>
          <article>
            <Clock3 size={18} />
            <div>
              <strong>Track the trail</strong>
              <span>Every upload, approval, and payment note stays in the work history.</span>
            </div>
          </article>
        </section>
        <section className="record-gallery" aria-label="Proof of work">
          <article className="record-gallery-card before">
            <span>Before</span>
            <strong>Capture the condition before the first cut.</strong>
            <small>{selectedJob.summary}</small>
          </article>
          <article className="record-gallery-card during">
            <span>During</span>
            <strong>Attach progress notes and active photos as the crew works.</strong>
            <small>{selectedJob.deliverables[0] ?? "Progress photos stay linked to the packet."}</small>
          </article>
          <article className="record-gallery-card after">
            <span>After</span>
            <strong>Keep closeout photos, invoice notes, and approvals together.</strong>
            <small>{selectedJob.deliverables[selectedJob.deliverables.length - 1] ?? "Final proof stays in the record."}</small>
          </article>
          <article className="record-gallery-card notes">
            <span>Notes</span>
            <strong>{selectedJob.tools.slice(0, 3).join(" • ")}</strong>
            <small>Tools used on this work order stay visible for the next handoff.</small>
          </article>
        </section>
        {recordChecklist.map((recordName) => (
          <button
            key={recordName}
            className={uploadedRecords.has(recordName) ? "complete" : ""}
            onClick={() => onToggleRecord(recordName)}
          >
            <FileCheck2 size={16} />
            <span>{recordName}</span>
            <strong>{uploadedRecords.has(recordName) ? "Ready" : "Needed"}</strong>
          </button>
        ))}
        <div className="document-actions">
          <button onClick={() => onSubmitCloseoutPacket(selectedJob.id)}>
            <FolderOpen size={15} />
            {closeout.packetSubmitted ? "Packet recorded" : "Record completion"}
          </button>
          <button disabled={!closeout.packetSubmitted} onClick={() => onApproveCloseout(selectedJob.id)}>
            <BadgeCheck size={15} />
            {closeout.approved ? "Closeout approved" : "Approve closeout"}
          </button>
        </div>
        <section className={`record-upload-card ${uploadResult.status}`} aria-label="Managed record upload">
          <div>
            <span>Managed file storage</span>
            <strong>{uploadResult.fileName ?? "Upload closeout records"}</strong>
            <small>{uploadResult.message}</small>
            {uploadResult.missing.length > 0 ? (
              <small>Missing: {uploadResult.missing.join(", ")}</small>
            ) : null}
          </div>
          <label className="upload-button">
            {uploadResult.status === "checking" ? "Uploading" : "Choose file"}
            <input
              type="file"
              accept="image/*,.pdf,.txt"
              disabled={uploadResult.status === "checking"}
              onChange={handleRecordUpload}
            />
          </label>
        </section>
        <section className={`upload-history-panel ${uploadHistoryStatus.status}`} aria-label="Managed upload history">
          <div className="ledger-header">
            <div>
              <span>Record files</span>
              <strong>
                {selectedJobUploads.length
                  ? `${selectedJobUploads.length} file${selectedJobUploads.length === 1 ? "" : "s"} for this job`
                  : "No files for this work order yet"}
              </strong>
            </div>
            <button type="button" onClick={refreshUploadHistory} disabled={uploadHistoryStatus.status === "checking"}>
              <FolderOpen size={14} />
              {uploadHistoryStatus.status === "checking" ? "Loading" : "Refresh"}
            </button>
          </div>
          <small>{uploadHistoryStatus.message}</small>
          {selectedJobUploads.length === 0 ? (
            <article className="empty-ledger">
              <FileCheck2 size={18} />
              <strong>Upload closeout photos or signed scope files to start the record.</strong>
              <span>Files stay in managed storage and come back after refresh.</span>
            </article>
          ) : selectedJobUploads.map((upload) => (
            <article className="upload-history-row" key={upload.id}>
              <FileText size={17} />
              <div>
                <strong>{upload.name}</strong>
                <span>
                  {upload.file?.originalName ?? "Managed upload"} - {fileSize(upload.file?.size ?? 0)}
                </span>
                <small>{upload.timestamp ? new Date(upload.timestamp).toLocaleString() : "Stored in managed records"}</small>
              </div>
              {upload.file?.signedUrl ? (
                <a href={upload.file.signedUrl} target="_blank" rel="noreferrer">
                  Open
                </a>
              ) : (
                <span className="paid-chip">Private</span>
              )}
            </article>
          ))}
        </section>
        <section className="payment-ledger" aria-label="Payment history">
          <div className="ledger-header">
            <div>
              <span>Payment history</span>
              <strong>{paymentRecords.length ? `${paymentRecords.length} direct record${paymentRecords.length === 1 ? "" : "s"}` : "No records yet"}</strong>
            </div>
            <button type="button" onClick={onExportPayments}>
              <FileText size={14} />
              Export CSV
            </button>
          </div>
          {paymentRecords.length === 0 ? (
            <article className="empty-ledger">
              <CreditCard size={18} />
              <strong>Approve a closeout to create the first payment row.</strong>
              <span>{brandConfig.appName} logs direct payments for bookkeeping; it does not process or hold funds.</span>
            </article>
          ) : paymentRecords.map((record) => (
            <article className="payment-row" key={record.id}>
              <div>
                <span>{record.worker} - {record.method}</span>
                <strong>{record.jobTitle}</strong>
                <small>{record.date} - {record.status}</small>
              </div>
              <em>{currency(record.amount)}</em>
              {record.status === "Payment pending" ? (
                <button type="button" onClick={() => onMarkPaymentPaid(record.jobId)}>
                  <BadgeCheck size={14} />
                  Mark paid
                </button>
              ) : (
                <span className="paid-chip">Closed</span>
              )}
            </article>
          ))}
        </section>
      </div>
    </section>
  );
}

function FeedbackView({
  feedbackItems,
  feedbackDraft,
  feedbackCategory,
  onFeedbackDraft,
  onFeedbackCategory,
  onSubmitFeedback,
}: {
  feedbackItems: FeedbackItem[];
  feedbackDraft: string;
  feedbackCategory: FeedbackItem["category"];
  onFeedbackDraft: (message: string) => void;
  onFeedbackCategory: (category: FeedbackItem["category"]) => void;
  onSubmitFeedback: () => void;
}) {
  return (
    <section className="operations-layout feedback-layout">
      <div className="ops-copy-panel feedback-form">
        <MessageCircle size={24} />
        <h2>Beta feedback</h2>
        <p>
          Capture what early contractors and tradespeople find confusing,
          broken, or valuable while you are testing with real customers.
        </p>
        <label>
          <span>Category</span>
          <select
            value={feedbackCategory}
            onChange={(event) =>
              onFeedbackCategory(event.target.value as FeedbackItem["category"])
            }
          >
            {feedbackCategories.map((category) => (
              <option key={category}>{category}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Note</span>
          <textarea
            value={feedbackDraft}
            onChange={(event) => onFeedbackDraft(event.target.value)}
            placeholder="What did the customer expect, and what happened?"
            rows={6}
          />
        </label>
        <button className="primary-action" type="button" onClick={onSubmitFeedback}>
          <Send size={17} />
          Save feedback
        </button>
      </div>
      <div className="feedback-list">
        {feedbackItems.length === 0 ? (
          <article className="empty-ledger">
            <MessageCircle size={18} />
            <strong>No feedback captured yet.</strong>
            <span>Use this during beta calls and job-site testing to keep product notes in one place.</span>
          </article>
        ) : feedbackItems.map((item) => (
          <article className="feedback-item" key={item.id}>
            <div>
              <span>{item.category} - {item.timestamp}</span>
              <strong>{item.message}</strong>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function AdminView({
  jobs,
  applications,
  paymentRecords,
  feedbackItems,
  activityFeed,
  lockedAccounts,
  communityReports,
  communityPosts,
  shoutOuts,
  onToggleAdminLock,
  onResolveCommunityReport,
  onOpenJob,
}: {
  jobs: Job[];
  applications: ApplicationRecord[];
  paymentRecords: PaymentRecord[];
  feedbackItems: FeedbackItem[];
  activityFeed: ActivityItem[];
  lockedAccounts: Set<string>;
  communityReports: CommunityReport[];
  communityPosts: CommunityPost[];
  shoutOuts: ShoutOut[];
  onToggleAdminLock: (accountName: string) => void;
  onResolveCommunityReport: (reportId: number, status: CommunityReport["status"]) => void;
  onOpenJob: (id: number) => void;
}) {
  const activeJobs = jobs.filter((job) => job.status !== "Paid / Closed").length;
  const totalLogged = paymentRecords.reduce((sum, record) => sum + record.amount, 0);
  const flaggedCommunityReports = communityReports.filter((report) => report.status === "Flagged");
  const pendingReports = [
    {
      account: "Harborline Builders",
      issue: "Insurance-required job needs applicant insurance check",
      severity: "Review",
    },
    {
      account: "Andre Malik",
      issue: "Self-reported insurance missing on one HVAC match",
      severity: "Watch",
    },
  ];

  return (
    <section className="admin-layout" aria-label="Beta admin dashboard">
      <div className="admin-grid">
        <article className="admin-card">
          <span>Beta health</span>
          <strong>{activeJobs} active jobs</strong>
          <p>{applications.length} applications, {feedbackItems.length} feedback notes, {activityFeed.length} recent actions.</p>
        </article>
        <article className="admin-card">
          <span>Money logged</span>
          <strong>{currency(totalLogged || 0)}</strong>
          <p>Direct payments only. Export remains available from Records.</p>
        </article>
        <article className="admin-card">
          <span>Account locks</span>
          <strong>{lockedAccounts.size}</strong>
          <p>Use locks when a report or dispute needs manual review.</p>
        </article>
        <article className="admin-card">
          <span>Community trust</span>
          <strong>{flaggedCommunityReports.length} flagged</strong>
          <p>{communityPosts.length} Shop Talk posts and {shoutOuts.length} shout-outs are active.</p>
        </article>
      </div>

      <section className="admin-columns">
        <div className="admin-panel">
          <div className="admin-panel-heading">
            <span>Jobs to watch</span>
            <strong>Open beta work</strong>
          </div>
          {jobs.slice(0, 5).map((job) => (
            <article className="admin-row" key={job.id}>
              <div>
                <span>{job.trade} - {job.location}</span>
                <strong>{job.title}</strong>
                <small>{currency(job.pay)} - {job.insuranceRequired ? "Insurance required" : "Insurance optional"} - {job.status}</small>
              </div>
              <button type="button" onClick={() => onOpenJob(job.id)}>
                Open
              </button>
            </article>
          ))}
        </div>

        <div className="admin-panel">
          <div className="admin-panel-heading">
            <span>Community moderation</span>
            <strong>Shop Talk reports</strong>
          </div>
          {communityReports.length === 0 ? (
            <article className="admin-row">
              <div>
                <span>No reports</span>
                <strong>Shop Talk is clean</strong>
                <small>Reports filed from community posts will appear here.</small>
              </div>
            </article>
          ) : communityReports.map((report) => (
            <article className={report.status === "Flagged" ? "admin-row flagged" : "admin-row"} key={report.id}>
              <div>
                <span>{report.reason} - {report.status}</span>
                <strong>{report.postTitle}</strong>
                <small>Post #{report.postId}</small>
              </div>
              <div className="admin-action-stack">
                <button type="button" onClick={() => onResolveCommunityReport(report.id, "Cleared")}>Clear</button>
                <button type="button" onClick={() => onResolveCommunityReport(report.id, "Warned")}>Warn</button>
                <button type="button" onClick={() => onResolveCommunityReport(report.id, "Hidden")}>Hide</button>
                <button type="button" onClick={() => onResolveCommunityReport(report.id, "Removed")}>Remove</button>
              </div>
            </article>
          ))}
        </div>

        <div className="admin-panel">
          <div className="admin-panel-heading">
            <span>Account reports</span>
            <strong>Manual review queue</strong>
          </div>
          {pendingReports.map((report) => {
            const locked = lockedAccounts.has(report.account);
            return (
              <article className="admin-row" key={report.account}>
                <div>
                  <span>{report.severity}</span>
                  <strong>{report.account}</strong>
                  <small>{report.issue}</small>
                </div>
                <button type="button" onClick={() => onToggleAdminLock(report.account)}>
                  {locked ? "Unlock" : "Lock"}
                </button>
              </article>
            );
          })}
        </div>

        <div className="admin-panel">
          <div className="admin-panel-heading">
            <span>Latest feedback</span>
            <strong>Customer notes</strong>
          </div>
          {feedbackItems.length === 0 ? (
            <article className="admin-row">
              <div>
                <span>No feedback yet</span>
                <strong>Use Feedback during beta calls</strong>
                <small>Notes saved there appear here for product decisions.</small>
              </div>
            </article>
          ) : feedbackItems.slice(0, 4).map((item) => (
            <article className="admin-row" key={item.id}>
              <div>
                <span>{item.category} - {item.timestamp}</span>
                <strong>{item.message}</strong>
              </div>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}

function SafetyTrainingView({
  jobs,
  completedTraining,
  onToggleTraining,
  onOpenJob,
}: {
  jobs: Job[];
  completedTraining: Set<string>;
  onToggleTraining: (moduleName: string) => void;
  onOpenJob: (id: number) => void;
}) {
  return (
    <section className="operations-layout safety-layout">
      <div className="training-list">
        {trainingModules.map((moduleName) => (
          <button
            key={moduleName}
            className={completedTraining.has(moduleName) ? "complete" : ""}
            onClick={() => onToggleTraining(moduleName)}
          >
            <BookOpen size={16} />
            <span>{moduleName}</span>
            <strong>{completedTraining.has(moduleName) ? "Complete" : "Start"}</strong>
          </button>
        ))}
      </div>
      <div className="risk-board">
        {jobs.map((job) => (
          <article className="risk-row" key={job.id}>
            <div>
              <span>{job.trade} risk brief</span>
              <strong>{job.title}</strong>
              <small>{job.risks.join(", ")}</small>
            </div>
            <button onClick={() => onOpenJob(job.id)}>
              <ClipboardCheck size={14} />
              Controls
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

function ReviewsView({
  jobs,
  selectedJob,
  closeouts,
  reviewRequested,
  onRateJob,
  onRequestReview,
  onOpenJob,
}: {
  jobs: Job[];
  selectedJob: Job;
  closeouts: Record<number, CloseoutRecord>;
  reviewRequested: boolean;
  onRateJob: (rating: number) => void;
  onRequestReview: () => void;
  onOpenJob: (id: number) => void;
}) {
  const selectedCloseout = closeouts[selectedJob.id] ?? defaultCloseout;

  return (
    <section className="operations-layout reviews-layout">
      <div className="ops-copy-panel">
        <Award size={24} />
        <h2>Trust engine</h2>
        <p>
          Reviews are tied to completed jobs and can be approved or disputed,
          so ratings reflect real work instead of generic lead feedback.
        </p>
        <button className="primary-action" onClick={onRequestReview}>
          <Star size={17} />
          {reviewRequested ? "Review requested" : "Request review"}
        </button>
      </div>
      <div className="review-ledger">
        <article className="review-focus">
          <span>Selected closeout</span>
          <strong>{selectedJob.title}</strong>
          <div className="rating-row" aria-label="Selected work order rating">
            <span>Rate</span>
            {[1, 2, 3, 4, 5].map((rating) => (
              <button
                key={rating}
                className={rating <= selectedCloseout.rating ? "selected" : ""}
                onClick={() => onRateJob(rating)}
                aria-label={`Rate ${rating} stars`}
              >
                <Star size={15} />
              </button>
            ))}
            <strong>{selectedCloseout.rating ? `${selectedCloseout.rating}.0` : "Pending"}</strong>
          </div>
        </article>
        {jobs.map((job) => (
          <article className="review-row" key={job.id}>
            <div>
              <span>{job.reviewCount} reviews</span>
              <strong>{job.contractor}</strong>
              <small>{job.title}</small>
            </div>
            <em>{job.rating}</em>
            <button onClick={() => onOpenJob(job.id)}>Open</button>
          </article>
        ))}
      </div>
    </section>
  );
}

function ProgressBar({ value }: { value: number }) {
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

function RoleSwitch({
  role,
  setRole,
}: {
  role: Role;
  setRole: (role: Role) => void;
}) {
  return (
    <div className="role-switch" aria-label="Role view">
      <button
        className={role === "contractor" ? "selected" : ""}
        onClick={() => setRole("contractor")}
      >
        Contractor
      </button>
      <button
        className={role === "tradesperson" ? "selected" : ""}
        onClick={() => setRole("tradesperson")}
      >
        Tradesperson
      </button>
    </div>
  );
}

function Filters({
  trade,
  setTrade,
  difficulty,
  setDifficulty,
  workType,
  setWorkType,
  radius,
  setRadius,
  locationQuery,
  setLocationQuery,
  verifiedOnly,
  setVerifiedOnly,
}: {
  trade: TradeFilter;
  setTrade: (trade: TradeFilter) => void;
  difficulty: DifficultyFilter;
  setDifficulty: (difficulty: DifficultyFilter) => void;
  workType: WorkTypeFilter;
  setWorkType: (workType: WorkTypeFilter) => void;
  radius: RadiusFilter;
  setRadius: (radius: RadiusFilter) => void;
  locationQuery: string;
  setLocationQuery: (locationQuery: string) => void;
  verifiedOnly: boolean;
  setVerifiedOnly: (verifiedOnly: boolean) => void;
}) {
  return (
    <div className="filters" aria-label="Job filters">
      <label className="select-control">
        <span>Trade</span>
        <select
          value={trade}
          onChange={(event) => setTrade(event.target.value as TradeFilter)}
        >
          {tradeOptions.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
        <ChevronDown size={16} />
      </label>

      <label className="select-control">
        <span>Difficulty</span>
        <select
          value={difficulty}
          onChange={(event) =>
            setDifficulty(event.target.value as DifficultyFilter)
          }
        >
          {difficultyOptions.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
        <ChevronDown size={16} />
      </label>

      <label className="select-control">
        <span>Work type</span>
        <select
          value={workType}
          onChange={(event) => setWorkType(event.target.value as WorkTypeFilter)}
        >
          {workTypeOptions.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
        <ChevronDown size={16} />
      </label>

      <label className="input-control">
        <span>Location</span>
        <input
          value={locationQuery}
          onChange={(event) => setLocationQuery(event.target.value)}
          placeholder="City or state"
        />
      </label>

      <label className="select-control">
        <span>Radius</span>
        <select
          value={radius}
          onChange={(event) => setRadius(event.target.value as RadiusFilter)}
        >
          {radiusOptions.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
        <ChevronDown size={16} />
      </label>

      <label className="toggle-control">
        <input
          type="checkbox"
          checked={verifiedOnly}
          onChange={(event) => setVerifiedOnly(event.target.checked)}
        />
        <span>Insurance required</span>
      </label>
    </div>
  );
}

function SettingsView({
  role,
  profile,
  trustReady,
  recordCount,
  trainingProgress,
  communityBadges,
  shoutOutCount,
  onReviewConsent,
}: {
  role: Role;
  profile: AccountProfile;
  trustReady: boolean;
  recordCount: number;
  trainingProgress: number;
  communityBadges: string[];
  shoutOutCount: number;
  onReviewConsent: () => void;
}) {
  const [providerChecks, setProviderChecks] = useState<Record<string, ProviderCheckResult>>({});

  async function runProviderCheck(config: (typeof providerCheckConfigs)[number]) {
    setProviderChecks((current) => ({
      ...current,
      [config.id]: {
        status: "checking",
        message: "Checking provider configuration...",
        missing: [],
      },
    }));

    try {
      const response = await fetch(apiPath(config.path), {
        method: config.method,
        credentials: "include",
        headers: config.method === "POST" ? { "Content-Type": "application/json" } : undefined,
        body: config.method === "POST"
          ? JSON.stringify({ userId: "current-user", plan: "base", channel: "email" })
          : undefined,
      });
      const body = await response.json().catch(() => ({})) as Record<string, unknown>;
      const message = typeof body.message === "string"
        ? body.message
        : response.ok
          ? `${config.label} is configured.`
          : `${config.label} needs setup before launch.`;

      setProviderChecks((current) => ({
        ...current,
        [config.id]: {
          status: providerStatusFromResponse(response),
          message,
          missing: collectMissingKeys(body),
          checkedAt: currentTimeLabel(),
        },
      }));
    } catch {
      setProviderChecks((current) => ({
        ...current,
        [config.id]: {
          status: "offline",
          message: "API is not reachable from this browser session.",
          missing: [],
          checkedAt: currentTimeLabel(),
        },
      }));
    }
  }

  function runAllProviderChecks() {
    providerCheckConfigs.forEach((config) => {
      void runProviderCheck(config);
    });
  }

  return (
    <section className="operations-layout credential-layout settings-view">
      <div className="ops-copy-panel">
        <ShieldCheck size={24} />
        <h2>Settings</h2>
        <p>
          Manage the account, theme, trust setup, and provider readiness that
          support the launch build.
        </p>
        <button className="primary-action" onClick={onReviewConsent}>
          <BadgeCheck size={17} />
          {trustReady ? "Consent reviewed" : "Review consent"}
        </button>
      </div>
      <div className="credential-grid">
        <CredentialTile label="Email" value={profile.email} ready />
        <CredentialTile label="Plan" value={profile.plan} ready />
        <CredentialTile label="Signup" value={profile.authMethod} ready />
        <CredentialTile label="Trust" value={trustReady ? "Ready" : "Needs review"} ready={trustReady} />
        <CredentialTile label="Records" value={`${recordCount}/${recordChecklist.length}`} ready={recordCount > 0} />
        <CredentialTile label="Training" value={`${trainingProgress}% complete`} ready={trainingProgress > 0} />
        <CredentialTile label="Community" value={`${communityBadges.length} badge${communityBadges.length === 1 ? "" : "s"}`} ready={communityBadges.length > 0 || shoutOutCount > 0} />
      </div>
      <section className="account-section theme-settings-section settings-page-panel">
        <div className="settings-section-heading">
          <span>Themes</span>
          <strong>Tool-inspired appearance</strong>
          <small>Theme controls stay in your account panel for now, while this page focuses on launch readiness.</small>
        </div>

        <button type="button" className="secondary-action" onClick={onReviewConsent}>
          Open trust setup
        </button>
      </section>
      <section className="provider-readiness-panel" aria-label="Provider readiness">
        <div className="provider-readiness-heading">
          <span>Launch providers</span>
          <h3>Run live setup checks</h3>
          <p>These hit the real backend routes so you can see what still needs credentials.</p>
        </div>
        <button type="button" className="secondary-action provider-run-all" onClick={runAllProviderChecks}>
          Run all checks
        </button>
        <div className="provider-check-list">
          {providerCheckConfigs.map((config) => {
            const result = providerChecks[config.id] ?? {
              status: "idle",
              message: config.purpose,
              missing: [],
            };
            const buttonLabel =
              result.status === "checking"
                ? "Checking"
                : result.status === "ready"
                  ? "Recheck"
                  : "Check";

            return (
              <article className={`provider-check-card ${result.status}`} key={config.id}>
                <div>
                  <span>{config.label}</span>
                  <strong>{result.status === "idle" ? config.purpose : result.message}</strong>
                  <small>
                    {result.missing.length
                      ? `Missing: ${result.missing.join(", ")}`
                      : result.checkedAt
                        ? `Last checked ${result.checkedAt}`
                        : "Not checked yet"}
                  </small>
                </div>
                <button
                  type="button"
                  disabled={result.status === "checking"}
                  onClick={() => runProviderCheck(config)}
                >
                  {buttonLabel}
                </button>
              </article>
            );
          })}
        </div>
      </section>
    </section>
  );
}

function InfoItem({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof BriefcaseBusiness;
  label: string;
  value: string;
}) {
  return (
    <div className="info-item">
      <Icon size={16} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function PostJobModal({
  onClose,
  onPost,
}: {
  onClose: () => void;
  onPost: (job: Job) => void;
}) {
  const [title, setTitle] = useState("Bathroom exhaust fan replacement");
  const [trade, setTrade] = useState<Trade>("Electrical");
  const [difficulty, setDifficulty] = useState<Difficulty>("Moderate");
  const [workType, setWorkType] = useState<WorkType>("Side work");
  const [tools, setTools] = useState("Voltage tester, ladder, drywall saw");
  const [location, setLocation] = useState("Jacksonville, FL");
  const [pay, setPay] = useState(410);
  const [insuranceRequired, setInsuranceRequired] = useState(true);
  const formRef = useRef<HTMLFormElement>(null);
  const canPost = Boolean(title.trim()) && Boolean(location.trim()) && pay >= 100;

  useEffect(() => {
    const el = formRef.current;
    if (!el) return;
    const focusable = el.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    first?.focus();
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    }
    el.addEventListener("keydown", onKeyDown);
    return () => el.removeEventListener("keydown", onKeyDown);
  }, []);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canPost) {
      return;
    }
    const stateMatch = location.match(/,\s*([A-Z]{2})$/i);
    const state = stateMatch ? stateMatch[1].toUpperCase() : "NY";
    const distanceByState: Record<string, number> = { FL: 3.2, NJ: 8.3, CT: 14.5, NY: 3.2 };
    onPost({
      id: Date.now(),
      title: title.trim(),
      contractor: "Your contracting team",
      trade,
      location: location.trim(),
      state,
      distance: distanceByState[state] ?? 10,
      pay: Math.round(pay),
      durationHours:
        difficulty === "Expert"
          ? 8
          : difficulty === "Advanced"
            ? 6
            : difficulty === "Challenging"
              ? 5
              : 4,
      workType,
      difficulty,
      insuranceRequired,
      tools: tools
        .split(",")
        .map((tool) => tool.trim())
        .filter(Boolean),
      trustRequirement: "Legal agreement required",
      addressPolicy: "Full address hidden until both parties confirm.",
      posted: "Just now",
      match: 90,
      rating: 4.9,
      reviewCount: 12,
      applicants: 0,
      status: "Open",
      summary:
        `Side-work job with ${currency(Math.round(pay))} pay, tools listed, and ${insuranceRequired ? "insurance required" : "insurance optional"}.`,
      guidance: stateGuidance[state] ?? stateGuidance.NY,
      risks: ["Customer access", "Tool readiness", "Address privacy"],
      deliverables: ["Completion photos", "Payment note", "Review prompt"],
      matchFactors: [
        "Nearby verified profile",
        "Tools listed clearly",
        insuranceRequired ? "Insurance requirement shown" : "Insurance optional",
        "Schedule-ready scope",
      ],
    });
  }

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <form
        className="post-modal"
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="post-modal-title"
        ref={formRef}
      >
        <div className="modal-header">
          <div>
            <span className="section-label">New side-work job</span>
            <h2 id="post-modal-title">Post job details</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <label>
          Job title
          <input value={title} onChange={(event) => setTitle(event.target.value)} required />
        </label>

        <div className="form-grid">
          <label>
            Trade
            <select
              value={trade}
              onChange={(event) => setTrade(event.target.value as Trade)}
            >
              {tradeOptions.slice(1).map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>
          <label>
            Difficulty
            <select
              value={difficulty}
              onChange={(event) =>
                setDifficulty(event.target.value as Difficulty)
              }
            >
              {difficultyOptions.slice(1).map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>
        </div>

        <label>
          Work type
          <select
            value={workType}
            onChange={(event) => setWorkType(event.target.value as WorkType)}
          >
            {workTypeOptions.slice(1).map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </label>

        <label>
          Location
          <input value={location} onChange={(event) => setLocation(event.target.value)} required />
        </label>

        <label className="toggle-control modal-toggle">
          <input
            type="checkbox"
            checked={insuranceRequired}
            onChange={(event) => setInsuranceRequired(event.target.checked)}
          />
          <span>Insurance required for this job</span>
        </label>

        <label>
          Tools needed
          <input value={tools} onChange={(event) => setTools(event.target.value)} />
        </label>

        <label>
          Pay
          <input
            type="number"
            value={pay}
            min={100}
            required
            onChange={(event) => setPay(Number(event.target.value))}
          />
          <span className="field-help">Required. Jobs with pay get faster replies.</span>
        </label>

        <div className="modal-actions">
          <button type="button" className="secondary-action" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary-action" disabled={!canPost}>
            <Plus size={18} />
            Publish {currency(pay || 0)} job
          </button>
        </div>
      </form>
    </div>
  );
}

export default App;

