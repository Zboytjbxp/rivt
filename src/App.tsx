import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState } from "react";
import {
  difficultyOptions,
  talent,
  tradeOptions,
  workTypeOptions,
} from "./data";
import { brandConfig, type ThemeMode, type ThemePalette, type TrialPlan } from "./brandConfig";
import type { ApplicationRecord, Difficulty, Job, JobId, Role, Trade, WorkType } from "./types";
import { AppShell } from "./app-shell/AppShell";
import { AccountPanel, ActivityPanel, ActivityToast } from "./app-shell/AppPanels";
import {
  defaultViewForDestination,
  pageCopy,
  primaryDestinationForView,
  type NavLabel,
  viewFromPath,
  viewRoutes,
} from "./app-shell/routes";
import { WorkWorkspace } from "./features/work/WorkWorkspace";
import { JobEditorModal } from "./features/work/JobEditorModal";
import { getJob, listJobs, toJobViewModel, transitionJob, type CanonicalDifficulty, type CanonicalWorkType } from "./features/work/job-api";
import { HomeDashboard } from "./features/home/HomeDashboard";
import { NetworkHub } from "./features/network/NetworkHub";
import { InboxCenter } from "./features/inbox/InboxCenter";
import {
  listConversationMessages,
  listConversations,
  listNotifications,
  markConversationRead,
  markNotificationsRead,
  muteConversation,
  reportConversation,
  sendConversationMessage,
  type InboxConversation,
  type InboxMessage,
  type InboxNotification,
} from "./features/inbox/inbox-api";
import { LegacyBridge } from "./features/legacy/LegacyBridge";
import { ToolsStudio } from "./features/tools/ToolsStudio";
import { ProfileRoute, type ProfileRouteView } from "./features/profile/ProfileRoute";
import { ShopTalkView } from "./features/shop-talk/ShopTalkView";
import type { ProfileUpdateInput } from "./features/profile/ProfileHub";
import { apiPath } from "./lib/api";
import {
  AuthGate,
  AuthLinkFlow,
  GuestBanner,
  GuestSignUpPrompt,
  LaunchLoader,
  OnboardingFlow,
  type AuthMethod,
  type OnboardingResult,
} from "./features/auth/AuthScreens";

type TradeFilter = (typeof tradeOptions)[number];
type DifficultyFilter = (typeof difficultyOptions)[number];
type WorkTypeFilter = (typeof workTypeOptions)[number];

interface AccountProfile {
  email: string;
  displayName: string;
  organization: string;
  location: string;
  specialties: Trade[];
  plan: TrialPlan;
  authMethod: AuthMethod;
}

interface AuthUser {
  id: string;
  email: string;
  provider: string;
  display_name: string;
  role: Role | "pending";
  organization: string;
  location: string;
  email_verified: boolean;
  account_status: "onboarding" | "active" | "suspended" | "closed";
  onboarding_status: "draft" | "complete";
}

interface CanonicalAccount {
  id: string;
  status: "onboarding" | "active" | "suspended" | "closed";
  primaryRole: Role | "pending";
  email: string;
  provider: "email" | "google" | "facebook" | "apple";
  emailVerified: boolean;
  profile: {
    displayName: string;
    headline: string;
    bio: string;
    locationText: string;
    visibility: "private" | "network";
    onboardingStatus: "draft" | "complete";
    serviceArea: {
      city: string;
      region: string;
      countryCode: string;
      radiusMiles: number;
    };
    availabilityStatus: "available" | "limited" | "unavailable";
    contactEmailVisibility: "private" | "connections";
    phoneE164: string | null;
    phoneVisibility: "private" | "connections";
    avatarUploadId: string | null;
    trades: Array<{ code: string; name: string; primary: boolean }>;
  };
  organizations: Array<{ id: string; name: string; role: "owner" | "admin" | "member" }>;
  capabilities: {
    canCompleteOnboarding: boolean;
    canPostWork: boolean;
    canApplyToWork: boolean;
    canPublishProfile: boolean;
  };
}

interface ActivityItem {
  id: number | string;
  title: string;
  detail: string;
  timestamp: string;
  unread: boolean;
  kind?: "info" | "success" | "warning" | "error";
}

interface AppToast {
  id: number;
  title: string;
  detail: string;
  kind: "info" | "success" | "warning" | "error";
  timestamp: string;
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
  thumbnailUrl?: string;
  thumbnailKind?: "article" | "feed" | "fallback";
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
  flair?: "Question" | "Discussion" | "Code Talk" | "Compliance" | "Tip" | "Humor";
  body: string;
  upvotes: number;
  downvotes: number;
  replies: CommunityAnswer[];
  createdAt: string;
  status: "Open" | "Verified Fix" | "Needs a pro answer";
}

type PostFlair = "Question" | "Discussion" | "Code Talk" | "Compliance" | "Tip" | "Humor";
type CommunityReaction = "up" | "down";
type CommunityReactionTargetType = "thread" | "answer";

interface CommunityReactionAggregate {
  targetType: CommunityReactionTargetType;
  targetKey: string;
  upvotes: number;
  downvotes: number;
  score: number;
  viewerReaction: CommunityReaction | null;
}

interface CommunityReactionSummary {
  reactionsGiven: number;
  upvotesGiven: number;
  downvotesGiven: number;
  targetsReacted: number;
  lastReactedAt: string | null;
}

interface CommunityReactionState {
  upvotes: number;
  downvotes: number;
  reaction: CommunityReaction | null;
  serverOwned: boolean;
  pending: boolean;
}

type CommunityReactionLedger = Record<string, CommunityReactionAggregate>;
type CommunityReactionSyncStatus = "idle" | "loading" | "ready" | "error";

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

const THEME_STORAGE_KEY = `${brandConfig.appSlug}-theme-mode`;
const THEME_PALETTE_STORAGE_KEY = `${brandConfig.appSlug}-theme-palette`;
const AUTH_MODE_KEY = `${brandConfig.appSlug}-auth-mode`;

const tradeCodeByName: Record<Trade, string> = {
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

const canonicalDifficultyByLabel: Record<Difficulty, CanonicalDifficulty> = {
  Easy: "easy",
  Moderate: "moderate",
  Challenging: "challenging",
  Advanced: "advanced",
  Expert: "expert",
};

const canonicalWorkTypeByLabel: Record<WorkType, CanonicalWorkType> = {
  "Side work": "side_work",
  Emergency: "emergency",
  "Multi-day": "multi_day",
  "Inspection prep": "inspection_prep",
};

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

function readAuthModePreference(): "login" | "signup" {
  if (typeof window === "undefined") return "login";
  try {
    return window.sessionStorage.getItem(AUTH_MODE_KEY) === "signup" ? "signup" : "login";
  } catch {
    return "login";
  }
}

const recordChecklist = [
  "Signed scope",
  "Legal consent accepted",
  "ID check before post/accept",
  "Completion photos",
  "Payment method note",
  "Review prompt",
];

const trainingModules = [
  "Ladder and fall protection",
  "Electrical lockout basics",
  "Dust containment",
  "Customer-site conduct",
];


interface QuizQuestion {
  id: number;
  text: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

interface SafetyQuiz {
  id: string;
  title: string;
  oshaRef: string;
  description: string;
  questions: QuizQuestion[];
}

interface SafetyQuizResult {
  quizId: string;
  score: number;
  passed: boolean;
  completedAt: string;
  attempts: number;
}

const safetyQuizData: SafetyQuiz[] = [
  {
    id: "ladder-safety",
    title: "Ladder Safety",
    oshaRef: "29 CFR 1926.1053",
    description: "Setup angle, 3-point contact, load ratings, and inspection.",
    questions: [
      {
        id: 1,
        text: "OSHA 1926.1053 requires extension ladders to be set up at a pitch of:",
        options: [
          "1 foot out for every 3 feet of height (1:3)",
          "1 foot out for every 4 feet of height (1:4)",
          "1 foot out for every 6 feet of height (1:6)",
          "Flush against the wall (1:10)",
        ],
        correctIndex: 1,
        explanation: "The 4:1 rule — ladder base 1 foot out per 4 feet of height — gives approximately 75° and is required by OSHA 1926.1053(b)(5).",
      },
      {
        id: 2,
        text: "When using a ladder to access a roof or elevated landing, the ladder must extend above the landing by at least:",
        options: ["1 foot", "2 feet", "3 feet", "5 feet"],
        correctIndex: 2,
        explanation: "OSHA 1926.1053(b)(1) requires ladders to extend at least 3 feet above an upper landing surface.",
      },
      {
        id: 3,
        text: "\"3-point contact\" on a ladder means:",
        options: [
          "Three workers may share a ladder simultaneously",
          "Two hands and one foot, or two feet and one hand, always in contact with the ladder",
          "The ladder must have three rungs between each worker",
          "Three separate anchor points secure the ladder top",
        ],
        correctIndex: 1,
        explanation: "3-point contact (two hands + one foot, or two feet + one hand) is the standard for safe climbing — OSHA 1926.1053(b)(22).",
      },
      {
        id: 4,
        text: "A Type IA ladder is rated for a maximum load of:",
        options: ["225 lbs", "250 lbs", "300 lbs", "375 lbs"],
        correctIndex: 2,
        explanation: "Type IA (Extra Heavy Duty) is rated for 300 lbs. Type I is 250 lbs; Type II is 225 lbs. Type IAA is 375 lbs.",
      },
      {
        id: 5,
        text: "On a stepladder, workers are prohibited from:",
        options: [
          "Using one hand on the rails while carrying a tool belt",
          "Standing on the top two rungs or the pail shelf",
          "Climbing while wearing work boots",
          "Descending the ladder facing away from it",
        ],
        correctIndex: 1,
        explanation: "OSHA prohibits standing on the top two rungs of a stepladder or the pail shelf — these are not designed as standing surfaces (1926.1053(b)(13)).",
      },
      {
        id: 6,
        text: "Portable ladders must be inspected:",
        options: [
          "Once a month by a competent person",
          "Annually by a third-party inspector",
          "Before each use",
          "Only after a fall or impact event",
        ],
        correctIndex: 2,
        explanation: "OSHA 1926.1053(b)(15) requires ladders to be inspected before each use for defects that could cause injury.",
      },
    ],
  },
  {
    id: "fall-protection",
    title: "Fall Protection",
    oshaRef: "29 CFR 1926.502",
    description: "Harnesses, anchor points, guardrails, and fall distances.",
    questions: [
      {
        id: 1,
        text: "In the construction industry, OSHA requires fall protection when a worker is at or above a height of:",
        options: ["4 feet", "6 feet", "8 feet", "10 feet"],
        correctIndex: 1,
        explanation: "OSHA 1926.501(b)(1) requires fall protection at 6 feet or more in the construction industry.",
      },
      {
        id: 2,
        text: "An anchor point for a personal fall arrest system (PFAS) must be capable of supporting at least:",
        options: ["2,500 lbs per worker", "3,000 lbs per worker", "5,000 lbs per worker", "7,500 lbs per worker"],
        correctIndex: 2,
        explanation: "OSHA 1926.502(d)(15) requires PFAS anchorages to support at least 5,000 lbs per attached worker.",
      },
      {
        id: 3,
        text: "The top rail of a guardrail system must be at a height of:",
        options: ["36 ± 3 inches", "42 ± 3 inches", "48 ± 3 inches", "54 ± 3 inches"],
        correctIndex: 1,
        explanation: "OSHA 1926.502(b)(1) requires the top edge of guardrails to be 42 inches (± 3 inches) above the walking/working surface.",
      },
      {
        id: 4,
        text: "Fall protection equipment (harnesses, lanyards, connectors) must be inspected:",
        options: [
          "Quarterly by a certified rigger",
          "Annually, logged in a maintenance book",
          "Before each use by the user",
          "Only when visible damage is present",
        ],
        correctIndex: 2,
        explanation: "OSHA 1926.502(d)(21) requires all fall arrest equipment to be inspected before each use for wear, damage, and deterioration.",
      },
      {
        id: 5,
        text: "When using a self-retracting lifeline (SRL), the device should be positioned:",
        options: [
          "At foot level to maximize free fall distance",
          "Offset 3 feet to one side of the worker",
          "Directly overhead, as close to plumb as possible",
          "At waist level to reduce tension",
        ],
        correctIndex: 2,
        explanation: "SRLs are designed to be used directly overhead. Off-axis use increases swing-fall risk and reduces device effectiveness.",
      },
      {
        id: 6,
        text: "Safety nets used as fall protection must be installed no more than how far below the work surface?",
        options: ["10 feet", "15 feet", "25 feet", "30 feet"],
        correctIndex: 3,
        explanation: "OSHA 1926.502(c)(1) requires safety nets to be installed as close as practicable under the work surface but never more than 30 feet below.",
      },
    ],
  },
  {
    id: "electrical-safety",
    title: "Electrical Safety",
    oshaRef: "29 CFR 1926.416",
    description: "GFCI, lockout/tagout, working clearances, and wet conditions.",
    questions: [
      {
        id: 1,
        text: "At what current level does a GFCI device trip to protect a worker?",
        options: ["4–6 milliamps", "15 milliamps", "20 milliamps", "30 milliamps"],
        correctIndex: 0,
        explanation: "GFCIs trip at 4–6 milliamps — well below the 10 mA threshold that can cause inability to release and 100+ mA that causes ventricular fibrillation.",
      },
      {
        id: 2,
        text: "The minimum safe approach distance for an unqualified worker near energized overhead lines rated 50 kV or less is:",
        options: ["3 feet", "6 feet", "10 feet", "25 feet"],
        correctIndex: 2,
        explanation: "OSHA 1926.416(a)(1) and 1926.1408 set the limit at 10 feet for voltages up to 50 kV for unqualified workers.",
      },
      {
        id: 3,
        text: "Lockout/tagout (LOTO) procedures are used to:",
        options: [
          "Record energy readings from live circuits",
          "Ensure machinery cannot be accidentally energized while being serviced",
          "Replace the function of GFCI protection on outlets",
          "Label circuits over 240 V",
        ],
        correctIndex: 1,
        explanation: "LOTO (29 CFR 1910.147) controls hazardous energy during service/maintenance so equipment cannot be accidentally started.",
      },
      {
        id: 4,
        text: "Extension cords used at construction sites must be:",
        options: [
          "Listed for indoor use only",
          "No longer than 100 feet",
          "3-wire grounded types designed for hard or extra-hard usage",
          "Replaced monthly regardless of condition",
        ],
        correctIndex: 2,
        explanation: "OSHA 1926.405(a)(2)(ii)(J) requires extension cords on construction sites to be of the 3-wire grounded type rated for hard or extra-hard service.",
      },
      {
        id: 5,
        text: "The Assured Equipment Grounding Conductor Program (AEGCP) is used as an alternative to:",
        options: [
          "Hard hat requirements",
          "GFCI protection on construction sites",
          "Lockout/tagout procedures",
          "Ladder safety inspections",
        ],
        correctIndex: 1,
        explanation: "OSHA 1926.404(b)(1) permits an AEGCP (regular testing/inspection of grounding conductors) as an alternative to GFCI devices at construction sites.",
      },
      {
        id: 6,
        text: "Before a worker contacts any electrical conductor or circuit part, it must be:",
        options: [
          "Rated below 120 V",
          "De-energized, locked out, and tested to verify it is de-energized",
          "Covered with electrical tape rated for that voltage",
          "Tested only if the panel breaker has been off for more than 30 minutes",
        ],
        correctIndex: 1,
        explanation: "OSHA 1926.417 requires de-energizing, locking out, and verifying de-energization before contacting conductors. Tape is not a substitute.",
      },
    ],
  },
  {
    id: "ppe-basics",
    title: "PPE Basics",
    oshaRef: "29 CFR 1926.95",
    description: "Employer obligations, head, eye, hand, and respiratory protection.",
    questions: [
      {
        id: 1,
        text: "Under OSHA 1926.95, who is primarily responsible for providing and paying for required PPE?",
        options: ["The worker", "The employer", "OSHA directly", "The general contractor's insurance carrier"],
        correctIndex: 1,
        explanation: "Employers must provide required PPE at no cost to employees — established by OSHA 1926.95 and reinforced by the 2008 final rule on employer payment.",
      },
      {
        id: 2,
        text: "A Class C hard hat provides:",
        options: [
          "High-voltage electrical protection up to 20,000 V",
          "Both impact protection and limited low-voltage protection",
          "Impact protection only — no electrical protection",
          "Full face protection plus head impact protection",
        ],
        correctIndex: 2,
        explanation: "Class C hard hats protect against impact only. Class E provides electrical protection up to 20,000 V; Class G up to 2,200 V.",
      },
      {
        id: 3,
        text: "Safety glasses marked \"Z87+\" indicate they meet:",
        options: [
          "NIOSH respirator standards for splash protection",
          "ANSI/ISEA Z87.1 high-impact certification",
          "UL listing for electrical arc flash",
          "CE marking for European markets only",
        ],
        correctIndex: 1,
        explanation: "The \"+\" in Z87+ denotes high-impact certification under ANSI/ISEA Z87.1. Glasses without \"+\" meet basic impact only.",
      },
      {
        id: 4,
        text: "An N95 respirator filters out at least what percentage of airborne particles ≥ 0.3 microns?",
        options: ["85%", "90%", "95%", "99%"],
        correctIndex: 2,
        explanation: "\"N95\" means it filters out at least 95% of airborne particles when properly fitted. \"N\" = not oil-resistant; \"95\" = efficiency level.",
      },
      {
        id: 5,
        text: "Which glove type provides the best cut resistance for handling sharp sheet metal?",
        options: [
          "Thin latex disposable gloves",
          "Chemical-resistant nitrile gloves",
          "ANSI A4 or higher cut-resistant gloves",
          "Standard leather work gloves",
        ],
        correctIndex: 2,
        explanation: "ANSI cut-level A4 or higher gloves (e.g., HDPE or stainless mesh) are designed for cut hazards like sheet metal edges.",
      },
      {
        id: 6,
        text: "High-visibility (ANSI Class 2 or 3) safety vests are required when working:",
        options: [
          "Any time outdoors after 5 PM",
          "In any confined space",
          "Near vehicle or equipment traffic as set by the project or jurisdiction",
          "Only on federal highway projects",
        ],
        correctIndex: 2,
        explanation: "OSHA 1926.201 and MUTCD require high-vis garments near active traffic. Many state and local jurisdictions extend this to any site with moving equipment.",
      },
    ],
  },
  {
    id: "tool-safety",
    title: "Tool Safety",
    oshaRef: "29 CFR 1926.300",
    description: "Guards, powder-actuated tools, abrasive wheels, and hand tool condition.",
    questions: [
      {
        id: 1,
        text: "Portable circular saws and similar rotary tools must be equipped with:",
        options: [
          "A two-hand interlock requiring both hands to operate",
          "A guard that automatically covers the blade when not cutting",
          "An electronic speed control preventing overspeed",
          "A built-in voltage tester",
        ],
        correctIndex: 1,
        explanation: "OSHA 1926.304(d) requires portable circular saws to have guards that automatically and instantly return to the covering position when the cut is complete.",
      },
      {
        id: 2,
        text: "Powder-actuated tools (stud drivers, nail guns fired by a cartridge) may be operated only by workers who are:",
        options: [
          "At least 18 years old and hold a general contractor's license",
          "Trained and qualified per the manufacturer's requirements (and OSHA 1926.302(e)(1))",
          "Wearing Class E hard hats and cut-resistant gloves",
          "Supervised by a licensed electrician",
        ],
        correctIndex: 1,
        explanation: "OSHA 1926.302(e)(1) limits powder-actuated tool use to trained workers who have demonstrated competence per the manufacturer's training program.",
      },
      {
        id: 3,
        text: "A cracked or chipped abrasive wheel (grinding disc) must be:",
        options: [
          "Marked with a caution tag and used only for light-duty work",
          "Removed from service immediately and replaced",
          "Tested by spinning it freehand before each use",
          "Returned to the manufacturer for regrading",
        ],
        correctIndex: 1,
        explanation: "OSHA 1926.303(b)(1) requires damaged abrasive wheels to be taken out of service immediately. A cracked wheel can fragment at high speed.",
      },
      {
        id: 4,
        text: "Pneumatic tools must be disconnected from the air supply:",
        options: [
          "Only at the end of each shift",
          "When the air pressure exceeds 125 PSI",
          "Before making adjustments, changing attachments, or clearing a jam",
          "Only when stored overnight",
        ],
        correctIndex: 2,
        explanation: "OSHA 1926.302(b)(3) requires disconnecting the air supply before any adjustment, attachment change, or repair to prevent accidental actuation.",
      },
      {
        id: 5,
        text: "Hand tools with cracked, broken, or loose handles must be:",
        options: [
          "Wrapped in duct tape and reported within 48 hours",
          "Used only for tasks where torque is minimal",
          "Tagged out and removed from service immediately",
          "Replaced at the end of the job",
        ],
        correctIndex: 2,
        explanation: "OSHA 1926.301(a) requires that hand tools be kept in safe condition. Broken handles cause loss of control and must be taken out of service immediately.",
      },
      {
        id: 6,
        text: "The \"dead man\" (constant-pressure) switch on a power tool is designed to:",
        options: [
          "Lock the tool ON for sustained operation without hand fatigue",
          "Stop the tool automatically when pressure on the trigger is released",
          "Trigger an emergency shutoff accessible from 10 feet",
          "Monitor motor temperature and shut down if overheating occurs",
        ],
        correctIndex: 1,
        explanation: "A dead man or constant-pressure switch requires continuous grip to keep the tool running. Releasing it cuts power — a basic safety feature on power tools.",
      },
    ],
  },
  {
    id: "hazcom",
    title: "Hazard Communication",
    oshaRef: "29 CFR 1910.1200",
    description: "GHS labels, Safety Data Sheets (SDS), pictograms, and worker training.",
    questions: [
      {
        id: 1,
        text: "Under OSHA's HazCom 2012 standard (aligned with GHS), a Safety Data Sheet (SDS) must have:",
        options: ["4 sections", "8 sections", "16 sections", "24 sections"],
        correctIndex: 2,
        explanation: "OSHA's HazCom 2012 requires 16 standardized SDS sections (1910.1200(g)(2)), matching the UN GHS format used globally.",
      },
      {
        id: 2,
        text: "The GHS pictogram that looks like a gas cylinder represents:",
        options: [
          "Compressed or liquefied gases",
          "Flammable gases or aerosols",
          "Asphyxiants that displace oxygen",
          "Products stored under pressure only",
        ],
        correctIndex: 0,
        explanation: "The gas cylinder GHS pictogram (GHS04) is used for gases under pressure: compressed, liquefied, refrigerated liquefied, or dissolved gases.",
      },
      {
        id: 3,
        text: "On a GHS-compliant label, the signal word \"DANGER\" indicates:",
        options: [
          "The product is restricted to licensed applicators",
          "The hazard can cause death or serious injury under normal exposure conditions",
          "The product requires special PPE but poses no acute risk",
          "The container must be stored above 50°F",
        ],
        correctIndex: 1,
        explanation: "\"DANGER\" is used for the more severe hazard categories. \"WARNING\" is used for less severe. \"DANGER\" means the hazard can cause death or serious injury.",
      },
      {
        id: 4,
        text: "Section 8 of an SDS covers:",
        options: [
          "Physical and chemical properties",
          "Ecological information",
          "Exposure controls and personal protection (PPE recommendations)",
          "Disposal considerations",
        ],
        correctIndex: 2,
        explanation: "SDS Section 8 (Exposure Controls/Personal Protection) lists OSHA PELs, ACGIH TLVs, engineering controls, and required PPE for the chemical.",
      },
      {
        id: 5,
        text: "Employers subject to HazCom must provide workers with training on chemical hazards:",
        options: [
          "Annually, regardless of whether new chemicals are introduced",
          "Only when a worker is assigned to handle chemicals for the first time",
          "When new chemical hazards are introduced, and at initial assignment",
          "Within 30 days of a chemical spill incident",
        ],
        correctIndex: 2,
        explanation: "OSHA 1910.1200(h)(1) requires training at initial assignment and whenever a new physical or health hazard is introduced into the work area.",
      },
      {
        id: 6,
        text: "On the NFPA 704 (fire diamond), the BLUE quadrant represents:",
        options: ["Flammability", "Reactivity", "Health hazard", "Special hazard (e.g., radioactive, water-reactive)"],
        correctIndex: 2,
        explanation: "Blue = health hazard (0–4 scale). Red = fire hazard. Yellow = instability/reactivity. White = special hazards like OX (oxidizer) or W (water-reactive).",
      },
    ],
  },
];
const communityBadgeThresholds = {
  firstAssistVerifiedFixes: 1,
  mentorQualityAnswers: 10,
  topHandQualityAnswers: 25,
  premiumRewardMonths: 1,
};
const emptyJob: Job = {
  id: 0,
  title: "No jobs posted yet",
  contractor: "RIVT",
  trade: "Electrical",
  location: "Jacksonville, FL",
  state: "FL",
  distance: 0,
  pay: 0,
  durationHours: 0,
  workType: "Side work",
  difficulty: "Moderate",
  insuranceRequired: false,
  tools: [],
  trustRequirement: "Legal agreement required",
  addressPolicy: "Exact address stays hidden until you accept a job.",
  posted: "Today",
  match: 0,
  rating: 0,
  reviewCount: 0,
  applicants: 0,
  status: "Open",
  summary: "Post the first real job to start building the live marketplace.",
  guidance: ["No active work order yet."],
  risks: ["No active work order"],
  deliverables: ["Job posting", "Acceptance", "Closeout"],
  matchFactors: ["Launch ready"],
};
function recordServerEvent(type: string, payload: Record<string, unknown>) {
  void type;
  void payload;
  // The legacy generic event bridge is retired. Canonical workflows write
  // auditable events through their dedicated server APIs.
}

function currentTimeLabel() {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date());
}

function idempotencyKey(scope: string) {
  const randomPart = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `${scope}-${randomPart}`;
}

function netScore(item: { upvotes: number; downvotes: number }) {
  return item.upvotes - item.downvotes;
}

function communityReactionLedgerKey(targetType: CommunityReactionTargetType, targetKey: string) {
  return `${targetType}:${targetKey}`;
}

function communityPostReactionKey(postId: number) {
  return `post:${postId}`;
}

function communityAnswerReactionKey(postId: number, answerId: number) {
  return `answer:${postId}:${answerId}`;
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

// Legacy fixture retained only until the marketplace packet removes the old local model.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const guestDemoJobs: Job[] = [
  {
    id: 9001,
    title: "Service Panel Upgrade – 200A",
    contractor: "Coastal Electric LLC",
    trade: "Electrical",
    location: "Jacksonville, FL",
    state: "FL",
    distance: 4,
    pay: 1400,
    durationHours: 8,
    workType: "Multi-day",
    difficulty: "Advanced",
    insuranceRequired: true,
    tools: ["Multimeter", "Wire strippers", "Conduit bender"],
    trustRequirement: "ID check required",
    addressPolicy: "Address shared after acceptance",
    posted: "2h ago",
    match: 91,
    rating: 4.8,
    reviewCount: 22,
    applicants: 3,
    status: "Open",
    summary: "Upgrade a residential 150A panel to 200A service for a Riverside home. Coordinate with JEA for meter pull.",
    guidance: ["Confirm JEA schedule before start", "Panel is in garage – 6ft clearance available"],
    risks: ["Live service during prep", "Older aluminum branch wiring on second floor"],
    deliverables: ["Passed inspection sign-off", "Updated load calculation sheet left on site"],
    matchFactors: ["Licensed master electrician", "JEA coordination experience"],
  },
  {
    id: 9002,
    title: "Emergency Water Heater Replacement",
    contractor: "Jax Plumbing Solutions",
    trade: "Plumbing",
    location: "Orange Park, FL",
    state: "FL",
    distance: 11,
    pay: 680,
    durationHours: 4,
    workType: "Emergency",
    difficulty: "Moderate",
    insuranceRequired: true,
    tools: ["Pipe wrench", "Teflon tape", "Soldering kit"],
    trustRequirement: "ID check required",
    addressPolicy: "Address provided on confirmation",
    posted: "45m ago",
    match: 87,
    rating: 4.6,
    reviewCount: 14,
    applicants: 2,
    status: "Open",
    summary: "50-gallon natural gas water heater failed overnight. Customer needs same-day replacement.",
    guidance: ["Gas shutoff is in rear utility room", "Replacement unit provided by contractor"],
    risks: ["Gas line proximity to copper supply", "Tight utility closet – 28in wide"],
    deliverables: ["Working hot water restored", "Old unit hauled away and permit pulled"],
    matchFactors: ["Licensed plumber", "Emergency availability", "Gas line experience"],
  },
  {
    id: 9003,
    title: "Residential Addition Framing",
    contractor: "Northeast FL Builders",
    trade: "Framing",
    location: "Atlantic Beach, FL",
    state: "FL",
    distance: 18,
    pay: 3200,
    durationHours: 32,
    workType: "Multi-day",
    difficulty: "Challenging",
    insuranceRequired: true,
    tools: ["Framing nailer", "Circular saw", "Speed square"],
    trustRequirement: "ID check required",
    addressPolicy: "Address shared after acceptance",
    posted: "1d ago",
    match: 84,
    rating: 4.7,
    reviewCount: 31,
    applicants: 5,
    status: "Shortlisting",
    summary: "Frame a 400 sq ft bedroom addition with exterior walls, roof tie-in, and window rough openings.",
    guidance: ["Stamped plans on site", "Crane access from rear alley available Tue/Thu"],
    risks: ["Roof tie-in near load-bearing wall", "Permit inspection required on day 3"],
    deliverables: ["Framing inspected and approved", "Sheathing ready for housewrap"],
    matchFactors: ["Framing crew experience", "Inspection-ready work quality"],
  },
  {
    id: 9004,
    title: "HVAC Mini-Split Install – 3 Ton",
    contractor: "Comfort Zone HVAC",
    trade: "HVAC",
    location: "Mandarin, FL",
    state: "FL",
    distance: 7,
    pay: 1800,
    durationHours: 10,
    workType: "Side work",
    difficulty: "Advanced",
    insuranceRequired: true,
    tools: ["Manifold gauges", "Vacuum pump", "Refrigerant recovery unit"],
    trustRequirement: "Completion photos required",
    addressPolicy: "Address on confirmation",
    posted: "3h ago",
    match: 89,
    rating: 4.9,
    reviewCount: 41,
    applicants: 4,
    status: "Open",
    summary: "Install 3-ton mini-split in converted garage. Line set run approximately 35ft through attic.",
    guidance: ["Existing 240V circuit available at panel", "Attic access through hallway closet"],
    risks: ["Attic temp may exceed 110°F in afternoon", "Verify BTU sizing with load calc before ordering"],
    deliverables: ["System commissioned and tested at rated temp", "Startup sheet signed by client"],
    matchFactors: ["EPA 608 certified", "Mini-split installation experience"],
  },
  {
    id: 9005,
    title: "Built-In Bookcase & Mudroom Bench",
    contractor: "Riverside Custom Carpentry",
    trade: "Carpentry",
    location: "Riverside, FL",
    state: "FL",
    distance: 3,
    pay: 960,
    durationHours: 12,
    workType: "Side work",
    difficulty: "Moderate",
    insuranceRequired: false,
    tools: ["Table saw", "Brad nailer", "Router"],
    trustRequirement: "Legal agreement required",
    addressPolicy: "Address shared day before start",
    posted: "5h ago",
    match: 82,
    rating: 4.5,
    reviewCount: 9,
    applicants: 1,
    status: "Open",
    summary: "Build and install floor-to-ceiling bookcase in living room and a bench with storage in mudroom.",
    guidance: ["Materials pre-purchased and staged in garage", "Paint-grade MDF throughout"],
    risks: ["Plaster walls – anchoring requires toggle bolts or blocking"],
    deliverables: ["Bookcase and bench installed, caulked, and sanded", "Ready for paint by property owner"],
    matchFactors: ["Finish carpentry experience", "Portfolio of built-ins preferred"],
  },
];

const seedNews: NewsItem[] = [
  {
    id: 1,
    headline: "OSHA expands heat inspections for high-risk outdoor work",
    source: "OSHA",
    date: "Apr 10, 2026",
    summary: "OSHA updated its National Emphasis Program on heat exposure. For contractors, the practical takeaway is simple: document water, rest, shade, acclimatization, and heat-response plans before the first hot-weather site visit.",
    url: "https://www.osha.gov/news/newsreleases/osha-national-news-release/20260410",
    urgency: "Safety",
    thumbnailUrl: "/news/heat-safety.svg",
  },
  {
    id: 2,
    headline: "NFPA previews the biggest changes in the 2026 NEC",
    source: "NFPA",
    date: "Jan 29, 2026",
    summary: "The 2026 National Electrical Code cycle is moving, with changes that can affect planning, estimates, and inspection conversations. Electrical contractors should review updates early instead of waiting until a failed rough-in.",
    url: "https://www.nfpa.org/news-blogs-and-articles/blogs/2026/01/29/2026-nec-key-changes",
    urgency: "Code Update",
    thumbnailUrl: "/news/code-update.svg",
  },
  {
    id: 3,
    headline: "EPA removes the R-410A installation deadline",
    source: "ACHR News",
    date: "May 21, 2026",
    summary: "ACHR News reports that EPA removed the R-410A installation deadline. HVAC contractors still need to watch refrigerant rules closely, but this update changes how some pending equipment installs get scheduled.",
    url: "https://www.achrnews.com/articles/166226-epa-removes-r-410a-installation-deadline",
    urgency: "HVAC",
    thumbnailUrl: "/news/hvac-refrigerant.svg",
  },
  {
    id: 4,
    headline: "ABC says construction must attract 349,000 workers in 2026",
    source: "Associated Builders and Contractors",
    date: "Jan 15, 2026",
    summary: "ABC estimates the industry needs hundreds of thousands of additional workers in 2026. For RIVT users, that is the market signal behind faster crew-building, better profiles, and keeping reliable subs close.",
    url: "https://www.abc.org/News-Media/News-Releases/abc-construction-industry-must-attract-349000-workers-in-2026-despite-macroeconomic-headwinds",
    urgency: "Labor",
    thumbnailUrl: "/news/workforce-market.svg",
  },
  {
    id: 5,
    headline: "Florida electrical contractor renewals and CE reminders",
    source: "DBPR",
    date: "2026",
    summary: "Florida DBPR keeps contractor renewal, continuing education, and board information in one place. Keep this bookmarked before hiring, accepting specialty work, or updating compliance records.",
    url: "https://www2.myfloridalicense.com/electrical-contractors/",
    urgency: "License",
    thumbnailUrl: "/news/license-renewal.svg",
  },
  {
    id: 6,
    headline: "Jacksonville permitting guide for contractors",
    source: "PermitFlow",
    date: "Mar 13, 2026",
    summary: "A contractor-focused look at Jacksonville permitting, review steps, and local process expectations. Useful context before posting work that depends on inspection timing or access to permit records.",
    url: "https://www.permitflow.com/blog/jacksonville-building-permit",
    urgency: "Local",
    thumbnailUrl: "/news/permit-watch.svg",
  },
];
const seedCommunityPosts: CommunityPost[] = [
  {
    id: 1,
    title: "What's the best way to handle a mid-job scope change without losing margin?",
    trade: "General",
    author: "FieldPro",
    badge: "Community Prompt",
    flair: "Question",
    body: "Client keeps adding scope after the contract is signed. Looking for a clean way to document and price change orders on the spot without losing the job or the margin.",
    upvotes: 14,
    downvotes: 1,
    replies: [],
    createdAt: "Jun 2026",
    status: "Needs a pro answer",
  },
  {
    id: 2,
    title: "How are you handling the new OSHA heat rule on outdoor jobs this summer?",
    trade: "General",
    author: "CrewLead",
    badge: "Community Prompt",
    flair: "Discussion",
    body: "OSHA heat rule is coming August 2026. Curious what other crews are doing — written plans, scheduling changes, gear, etc. Share what's actually working in the field.",
    upvotes: 9,
    downvotes: 0,
    replies: [],
    createdAt: "Jun 2026",
    status: "Open",
  },
  {
    id: 3,
    title: "NEC 2023: Are you already pulling permits under the new AFCI expansion rules?",
    trade: "Electrical",
    author: "SparkCheck",
    badge: "Community Prompt",
    flair: "Question",
    body: "Florida is moving to NEC 2023. AFCI now covers all dwelling areas. Have any of you already had inspections fail under the old wiring assumptions? What did you have to change?",
    upvotes: 11,
    downvotes: 2,
    replies: [],
    createdAt: "May 2026",
    status: "Needs a pro answer",
  },
];

function App() {
  const [activeView, setActiveView] = useState<NavLabel>(() => viewFromPath(window.location.pathname));
  const [role, setRole] = useState<Role>("contractor");
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [accountProfile, setAccountProfile] = useState<AccountProfile>({
    email: "",
    displayName: "",
    organization: "",
    location: "Jacksonville, FL",
    specialties: [],
    plan: brandConfig.pricing.betaPlan.label,
    authMethod: "Email",
  });
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [canonicalAccount, setCanonicalAccount] = useState<CanonicalAccount | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState<"login" | "signup">(readAuthModePreference);
  const [authError, setAuthError] = useState<string | null>(() => (
    new URLSearchParams(window.location.search).get("auth_error") === "google"
      ? "Google sign-in could not be completed. Try again or use email."
      : null
  ));
  const [authProviders, setAuthProviders] = useState<Record<string, { ok: boolean; mode: string; missing: string[]; purpose: string }>>({});
  const [pilotInviteRequired, setPilotInviteRequired] = useState(false);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [shopTalkGlobalQuery, setShopTalkGlobalQuery] = useState("");
  const [trade, setTrade] = useState<TradeFilter>("All trades");
  const [difficulty, setDifficulty] =
    useState<DifficultyFilter>("Any difficulty");
  const [workType, setWorkType] = useState<WorkTypeFilter>("All work types");
  const [locationQuery, setLocationQuery] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedId, setSelectedId] = useState<JobId>(0);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobsError, setJobsError] = useState<string | null>(null);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const jobsRequestRef = useRef(0);
  const [applications] = useState<ApplicationRecord[]>([]);
  const [isPostOpen, setPostOpen] = useState(false);
  const [isActivityOpen, setActivityOpen] = useState(false);
  const [isAccountOpen, setAccountOpen] = useState(false);
  const [trustReady, setTrustReady] = useState(true);
  const [messageDraft, setMessageDraft] = useState("");
  const [inboxConversations, setInboxConversations] = useState<InboxConversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [inboxMessages, setInboxMessages] = useState<InboxMessage[]>([]);
  const [inboxNotifications, setInboxNotifications] = useState<InboxNotification[]>([]);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [inboxSending, setInboxSending] = useState(false);
  const [inboxError, setInboxError] = useState<string | null>(null);
  const [uploadedRecords, setUploadedRecords] = useState<Set<string>>(
    () => new Set(["Signed scope", "Legal consent accepted"]),
  );
  const [completedTraining] = useState<Set<string>>(
    () => new Set(["Customer-site conduct"]),
  );
  const [safetyQuizResults] = useState<Record<string, SafetyQuizResult>>({});
  const [activityFeed, setActivityFeed] = useState<ActivityItem[]>([]);
  const [feedbackItems] = useState<FeedbackItem[]>([]);
  const [paymentRecords] = useState<PaymentRecord[]>([]);
  const [communityPosts, setCommunityPosts] = useState<CommunityPost[]>(seedCommunityPosts);
  const [communityReactionLedger, setCommunityReactionLedger] = useState<CommunityReactionLedger>({});
  const [communityReactionSummary, setCommunityReactionSummary] = useState<CommunityReactionSummary | null>(null);
  const [communityReactionStatus, setCommunityReactionStatus] = useState<CommunityReactionSyncStatus>("idle");
  const [pendingCommunityReactions, setPendingCommunityReactions] = useState<Set<string>>(() => new Set());
  const [, setCommunityReports] = useState<CommunityReport[]>([]);
  const [shoutOuts] = useState<ShoutOut[]>([]);
  const [themeMode, setThemeMode] = useState<ThemeMode>(readThemePreference);
  const [themePalette, setThemePalette] = useState<ThemePalette>(readThemePalettePreference);
  const [isGuest, setIsGuest] = useState(false);
  const [guestPromptOpen, setGuestPromptOpen] = useState(false);

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
      window.sessionStorage.setItem(AUTH_MODE_KEY, authMode);
    } catch {
      // no-op
    }
  }, [authMode]);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("auth_error")) return;
    url.searchParams.delete("auth_error");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);

  useEffect(() => {
    function handleHistoryNavigation() {
      setActiveView(viewFromPath(window.location.pathname));
      setActivityOpen(false);
      setAccountOpen(false);
      setPostOpen(false);
    }

    window.addEventListener("popstate", handleHistoryNavigation);
    return () => window.removeEventListener("popstate", handleHistoryNavigation);
  }, []);

  const applyCanonicalAccount = useCallback((account: CanonicalAccount) => {
    const accountRole = account.primaryRole === "tradesperson" ? "tradesperson" : "contractor";
    const authMethod: AuthMethod = account.provider === "google" ? "Google" : account.provider === "facebook" ? "Facebook" : account.provider === "apple" ? "Apple" : "Email";
    setCanonicalAccount(account);
    setAuthUser({
      id: account.id,
      email: account.email,
      provider: account.provider,
      display_name: account.profile.displayName,
      role: account.primaryRole,
      organization: account.organizations[0]?.name ?? "",
      location: account.profile.locationText,
      email_verified: account.emailVerified,
      account_status: account.status,
      onboarding_status: account.profile.onboardingStatus,
    });
    setRole(accountRole);
    setAccountProfile((current) => ({
      email: account.email,
      displayName: account.profile.displayName || "RIVT member",
      organization: account.organizations[0]?.name ?? "",
      location: account.profile.locationText,
      specialties: account.profile.trades.map((trade) => trade.name as Trade),
      plan: current.plan,
      authMethod,
    }));
    setOnboardingComplete(account.status === "active" && account.profile.onboardingStatus === "complete");
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function hydrateAuth() {
      try {
        const [meResponse, providersResponse] = await Promise.all([
          fetch(apiPath("/api/v1/me"), { credentials: "include" }),
          fetch(apiPath("/api/auth/providers"), { credentials: "include" }),
        ]);
        const meBody = await meResponse.json().catch(() => ({})) as { data?: CanonicalAccount };
        const providersBody = await providersResponse.json().catch(() => ({})) as {
          providers?: Record<string, { ok: boolean; mode: string; missing: string[]; purpose: string }>;
          inviteRequired?: boolean;
        };
        if (cancelled) return;
        setAuthProviders(providersBody.providers ?? {});
        setPilotInviteRequired(Boolean(providersBody.inviteRequired));
        if (meResponse.ok && meBody.data) {
          applyCanonicalAccount(meBody.data);
        } else if (meResponse.status === 401) {
          setAuthUser(null);
          setCanonicalAccount(null);
          setOnboardingComplete(false);
          setCommunityReactionLedger({});
          setCommunityReactionSummary(null);
          setCommunityReactionStatus("idle");
        } else {
          throw new Error("Session lookup failed.");
        }
      } catch {
        if (!cancelled) {
          setAuthUser(null);
          setCanonicalAccount(null);
          setOnboardingComplete(false);
          setCommunityReactionLedger({});
          setCommunityReactionSummary(null);
          setCommunityReactionStatus("idle");
          setAuthProviders({});
          setAuthError("RIVT could not verify your session. Check your connection and sign in again.");
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
  }, [applyCanonicalAccount]);

  async function refreshCanonicalAccount() {
    const response = await fetch(apiPath("/api/v1/me"), { credentials: "include" });
    const body = await response.json().catch(() => ({})) as { data?: CanonicalAccount; error?: { message?: string } };
    if (!response.ok || !body.data) throw new Error(body.error?.message || "RIVT could not load your account.");
    applyCanonicalAccount(body.data);
    return body.data;
  }

  const reloadJobs = useCallback(async () => {
    if (!authUser || !onboardingComplete) return;
    const requestId = ++jobsRequestRef.current;
    setJobsLoading(true);
    setJobsError(null);
    const [locationCity = "", locationRegion = ""] = locationQuery.split(",").map((part) => part.trim());
    try {
      const canonicalJobs = await listJobs({
        query: query.trim() || undefined,
        trade: trade === "All trades" ? undefined : tradeCodeByName[trade],
        difficulty: difficulty === "Any difficulty" ? undefined : canonicalDifficultyByLabel[difficulty],
        workType: workType === "All work types" ? undefined : canonicalWorkTypeByLabel[workType],
        city: locationCity || undefined,
        region: locationRegion || undefined,
        insuranceRequired: verifiedOnly ? true : undefined,
      });
      if (jobsRequestRef.current !== requestId) return;
      const nextJobs = canonicalJobs.map(toJobViewModel);
      setJobs(nextJobs);
      setSelectedId((current) => nextJobs.some((job) => job.id === current) ? current : nextJobs[0]?.id ?? 0);
    } catch (cause) {
      if (jobsRequestRef.current !== requestId) return;
      setJobs([]);
      setSelectedId(0);
      setJobsError(cause instanceof Error ? cause.message : "Jobs could not be loaded.");
    } finally {
      if (jobsRequestRef.current === requestId) setJobsLoading(false);
    }
  }, [authUser, difficulty, locationQuery, onboardingComplete, query, trade, verifiedOnly, workType]);

  useEffect(() => {
    const timeout = window.setTimeout(() => { void reloadJobs(); }, 250);
    return () => window.clearTimeout(timeout);
  }, [reloadJobs]);

  const reloadInbox = useCallback(async () => {
    if (!authUser || !onboardingComplete) return;
    setInboxLoading(true);
    setInboxError(null);
    try {
      const [conversationRows, notificationRows] = await Promise.all([
        listConversations(),
        listNotifications(),
      ]);
      setInboxConversations(conversationRows);
      setInboxNotifications(notificationRows.notifications);
      setSelectedConversationId((current) => (
        current && conversationRows.some((conversation) => conversation.id === current)
          ? current
          : conversationRows[0]?.id ?? null
      ));
    } catch (error) {
      setInboxError(error instanceof Error ? error.message : "Inbox could not be loaded.");
    } finally {
      setInboxLoading(false);
    }
  }, [authUser, onboardingComplete]);

  const loadConversationMessages = useCallback(async (conversationId: string | null) => {
    if (!conversationId || !authUser || !onboardingComplete) {
      setInboxMessages([]);
      return;
    }
    setInboxError(null);
    try {
      const messages = await listConversationMessages(conversationId);
      setInboxMessages(messages);
    } catch (error) {
      setInboxMessages([]);
      setInboxError(error instanceof Error ? error.message : "Messages could not be loaded.");
    }
  }, [authUser, onboardingComplete]);

  useEffect(() => {
    if (!authUser || !onboardingComplete) return;
    const timeout = window.setTimeout(() => {
      void reloadInbox();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [authUser, onboardingComplete, reloadInbox]);

  useEffect(() => {
    if (activeView !== "Messages") return;
    const timeout = window.setTimeout(() => {
      void reloadInbox();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [activeView, reloadInbox]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadConversationMessages(selectedConversationId);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [loadConversationMessages, selectedConversationId]);

  useEffect(() => {
    if (onboardingComplete) {
      window.scrollTo({ top: 0, left: 0 });
    }
  }, [activeView, onboardingComplete]);

  function handleToggleTheme() {
    setThemeMode((currentMode) => (currentMode === "dark" ? "light" : "dark"));
  }

  function handleSelectThemePalette(nextPalette: ThemePalette) {
    setThemePalette(nextPalette);
  }

  const selectedJob = jobs.find((job) => job.id === selectedId) ?? jobs[0] ?? emptyJob;
  const primaryProfileTrade = canonicalAccount?.profile.trades.find((tradeItem) => tradeItem.primary)?.name
    ?? accountProfile.specialties[0]
    ?? selectedJob.trade
    ?? "General trades";
  const answerQueueCount = communityPosts.filter((post) => (
    (post.trade === primaryProfileTrade || post.trade === "General") &&
    post.status !== "Verified Fix"
  )).length;

  const filteredJobs = jobs;

  const matchingTalent = useMemo(() => {
    return talent
      .filter((person) => person.trade === selectedJob.trade)
      .sort((a, b) => b.match - a.match);
  }, [selectedJob.trade]);

  const notificationActivityItems = useMemo<ActivityItem[]>(() => inboxNotifications.map((item) => ({
    id: item.id,
    title: item.title,
    detail: item.body,
    timestamp: item.createdAt ? new Date(item.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "",
    unread: !item.readAt,
    kind: item.priority === "high" ? "warning" : item.type === "message" ? "info" : "success",
  })), [inboxNotifications]);
  const unreadActivities = inboxNotifications.filter((item) => !item.readAt).length;
  const [uiToast, setUiToast] = useState<AppToast | null>(null);
  const communityReactionTargets = useMemo(() => {
    const targets: { targetType: CommunityReactionTargetType; targetKey: string }[] = [];
    communityPosts.forEach((post) => {
      targets.push({ targetType: "thread", targetKey: communityPostReactionKey(post.id) });
      post.replies.forEach((answer) => {
        targets.push({ targetType: "answer", targetKey: communityAnswerReactionKey(post.id, answer.id) });
      });
    });
    return targets;
  }, [communityPosts]);
  const communityReactionTargetsKey = useMemo(() => (
    communityReactionTargets.map((target) => communityReactionLedgerKey(target.targetType, target.targetKey)).join("|")
  ), [communityReactionTargets]);

  const getCommunityPostReactionState = useCallback((post: CommunityPost): CommunityReactionState => {
    const targetKey = communityPostReactionKey(post.id);
    const ledgerKey = communityReactionLedgerKey("thread", targetKey);
    const aggregate = communityReactionLedger[ledgerKey];
    return {
      upvotes: post.upvotes + (aggregate?.upvotes ?? 0),
      downvotes: post.downvotes + (aggregate?.downvotes ?? 0),
      reaction: aggregate?.viewerReaction ?? null,
      serverOwned: communityReactionStatus === "ready",
      pending: pendingCommunityReactions.has(ledgerKey),
    };
  }, [communityReactionLedger, communityReactionStatus, pendingCommunityReactions]);

  const getCommunityAnswerReactionState = useCallback((postId: number, answer: CommunityAnswer): CommunityReactionState => {
    const targetKey = communityAnswerReactionKey(postId, answer.id);
    const ledgerKey = communityReactionLedgerKey("answer", targetKey);
    const aggregate = communityReactionLedger[ledgerKey];
    return {
      upvotes: answer.upvotes + (aggregate?.upvotes ?? 0),
      downvotes: answer.downvotes + (aggregate?.downvotes ?? 0),
      reaction: aggregate?.viewerReaction ?? null,
      serverOwned: communityReactionStatus === "ready",
      pending: pendingCommunityReactions.has(ledgerKey),
    };
  }, [communityReactionLedger, communityReactionStatus, pendingCommunityReactions]);

  function addActivity(title: string, detail: string, kind: AppToast["kind"] = "info") {
    void recordServerEvent("activity", { title, detail, role, activeView });
    setUiToast({
      id: Date.now(),
      title,
      detail,
      kind,
      timestamp: currentTimeLabel(),
    });
    setActivityFeed((current) => [
      {
        id: Date.now() + current.length,
        title,
        detail,
        timestamp: currentTimeLabel(),
        unread: true,
        kind,
      },
      ...current,
    ].slice(0, 16));
  }

  function mergeCommunityReactionAggregate(reaction: CommunityReactionAggregate) {
    setCommunityReactionLedger((current) => ({
      ...current,
      [communityReactionLedgerKey(reaction.targetType, reaction.targetKey)]: reaction,
    }));
  }

  useEffect(() => {
    if (!authUser || !canonicalAccount || !onboardingComplete) {
      return;
    }

    let cancelled = false;
    async function loadCommunityReactionLedger() {
      setCommunityReactionStatus("loading");
      try {
        const response = await fetch(apiPath("/api/v1/shop-talk/reactions/batch"), {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targets: communityReactionTargets }),
        });
        const body = await response.json().catch(() => ({})) as {
          data?: { reactions?: CommunityReactionAggregate[]; reputation?: CommunityReactionSummary };
          error?: { message?: string };
        };
        if (!response.ok) throw new Error(body.error?.message || "Shop Talk reactions could not be loaded.");
        if (cancelled) return;
        setCommunityReactionLedger(
          (body.data?.reactions ?? []).reduce<CommunityReactionLedger>((ledger, reaction) => {
            ledger[communityReactionLedgerKey(reaction.targetType, reaction.targetKey)] = reaction;
            return ledger;
          }, {}),
        );
        setCommunityReactionSummary(body.data?.reputation ?? null);
        setCommunityReactionStatus("ready");
      } catch {
        if (cancelled) return;
        setCommunityReactionLedger({});
        setCommunityReactionSummary(null);
        setCommunityReactionStatus("error");
      }
    }

    void loadCommunityReactionLedger();
    return () => {
      cancelled = true;
    };
  }, [authUser, canonicalAccount, onboardingComplete, communityReactionTargets, communityReactionTargetsKey]);

  useEffect(() => {
    if (!uiToast) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setUiToast(null);
    }, 3200);

    return () => window.clearTimeout(timeout);
  }, [uiToast]);

  function markAllActivityRead() {
    setActivityFeed((current) =>
      current.map((item) => ({ ...item, unread: false })),
    );
  }

  async function handleAuthSubmit(form: { email: string; password: string; displayName?: string; role?: Role; inviteCode?: string }) {
    setAuthError(null);
    setAuthNotice(null);
    try {
      const path = authMode === "signup" ? "/api/v1/auth/signup" : "/api/v1/auth/login";
      const response = await fetch(apiPath(path), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = await response.json().catch(() => ({})) as {
        data?: { user?: AuthUser; verificationRequired?: boolean; verificationDelivered?: boolean };
        error?: { message?: string };
      };
      if (!response.ok || !body.data?.user) {
        throw new Error(body.error?.message || "Sign-in failed.");
      }
      const account = await refreshCanonicalAccount();
      if (body.data.verificationRequired || !account.emailVerified) {
        setAuthNotice(body.data.verificationDelivered === false
          ? `Your account was created, but the verification email could not be delivered. Use Resend on the next screen.`
          : `We sent a verification link to ${account.email}.`);
      }
    } catch (error) {
      setAuthUser(null);
      setCanonicalAccount(null);
      setOnboardingComplete(false);
      setCommunityReactionLedger({});
      setCommunityReactionSummary(null);
      setCommunityReactionStatus("idle");
      setAuthError(error instanceof Error ? error.message : "Sign-in failed. Check your connection and try again.");
    }
  }

  async function handleForgotPassword(email: string) {
    setAuthError(null);
    setAuthNotice(null);
    try {
      const response = await fetch(apiPath("/api/v1/auth/password/forgot"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = await response.json().catch(() => ({})) as { data?: { message?: string }; error?: { message?: string } };
      if (!response.ok) throw new Error(body.error?.message || "Reset request could not be sent.");
      setAuthNotice(body.data?.message || "If that account exists, a reset email will arrive shortly.");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Reset request could not be sent.");
    }
  }

  async function handleResendVerification() {
    setAuthError(null);
    setAuthNotice(null);
    try {
      const response = await fetch(apiPath("/api/v1/auth/email/resend"), {
        method: "POST",
        credentials: "include",
      });
      const body = await response.json().catch(() => ({})) as { error?: { message?: string } };
      if (!response.ok) throw new Error(body.error?.message || "Verification email could not be sent.");
      setAuthNotice(`A fresh verification link was sent to ${canonicalAccount?.email ?? accountProfile.email}.`);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Verification email could not be sent.");
    }
  }

  async function handleSaveProfile(input: ProfileUpdateInput) {
    const response = await fetch(apiPath("/api/v1/profile"), {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...input,
        tradeCodes: input.specialties.map((specialty) => tradeCodeByName[specialty]),
      }),
    });
    const body = await response.json().catch(() => ({})) as { error?: { message?: string } };
    if (!response.ok) throw new Error(body.error?.message || "Profile could not be saved.");
    await refreshCanonicalAccount();
    addActivity("Profile saved", "Your network profile and service area are up to date.", "success");
  }

  async function handleSetAvailability(availabilityStatus: CanonicalAccount["profile"]["availabilityStatus"]) {
    const response = await fetch(apiPath("/api/v1/profile"), {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ availabilityStatus }),
    });
    const body = await response.json().catch(() => ({})) as { error?: { message?: string } };
    if (!response.ok) throw new Error(body.error?.message || "Availability could not be saved.");
    await refreshCanonicalAccount();
    addActivity(
      "Availability updated",
      availabilityStatus === "available"
        ? "Your profile is marked available for new conversations."
        : availabilityStatus === "limited"
          ? "Your profile is marked limited for new conversations."
          : "Your profile is marked booked for now.",
      "success",
    );
  }

  async function handleSetProfileVisibility(visibility: "private" | "network") {
    const response = await fetch(apiPath(`/api/v1/profile/${visibility === "network" ? "publish" : "unpublish"}`), {
      method: "POST",
      credentials: "include",
    });
    const body = await response.json().catch(() => ({})) as { error?: { message?: string } };
    if (!response.ok) throw new Error(body.error?.message || "Profile visibility could not be changed.");
    await refreshCanonicalAccount();
    addActivity(
      visibility === "network" ? "Profile visible" : "Profile private",
      visibility === "network" ? "Other RIVT members can now discover your profile." : "Your profile is hidden from network discovery.",
      "success",
    );
  }

  function handleCurrentSessionRevoked() {
    setAuthUser(null);
    setCanonicalAccount(null);
    setOnboardingComplete(false);
    setCommunityReactionLedger({});
    setCommunityReactionSummary(null);
    setCommunityReactionStatus("idle");
  }

  async function handleLogout() {
    try {
      await fetch(apiPath("/api/v1/auth/logout"), {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // Ignore logout network hiccups; the local session can still be cleared.
    } finally {
      setAuthUser(null);
      setCanonicalAccount(null);
      setOnboardingComplete(false);
      setCommunityReactionLedger({});
      setCommunityReactionSummary(null);
      setCommunityReactionStatus("idle");
      setAuthNotice(null);
      setAccountOpen(false);
      setActivityOpen(false);
      setActiveView("Home");
      window.history.replaceState({}, "", "/");
    }
  }

  function handleNavigate(view: NavLabel) {
    setActiveView(view);
    const nextPath = viewRoutes[view];
    if (window.location.pathname !== nextPath) {
      window.history.pushState({ view }, "", nextPath);
    }
    setActivityOpen(false);
    setAccountOpen(false);
    setPostOpen(false);
  }

  function setCommunityReactionPending(ledgerKey: string, pending: boolean) {
    setPendingCommunityReactions((current) => {
      const next = new Set(current);
      if (pending) {
        next.add(ledgerKey);
      } else {
        next.delete(ledgerKey);
      }
      return next;
    });
  }

  async function commitCommunityReaction(targetType: CommunityReactionTargetType, targetKey: string, direction: "up" | "down") {
    const ledgerKey = communityReactionLedgerKey(targetType, targetKey);
    if (pendingCommunityReactions.has(ledgerKey)) return;
    const previousReaction = communityReactionLedger[ledgerKey]?.viewerReaction ?? null;
    const nextReaction = previousReaction === direction ? null : direction;
    setCommunityReactionPending(ledgerKey, true);
    try {
      const response = await fetch(apiPath("/api/v1/shop-talk/reactions"), {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey("shop-talk-reaction"),
        },
        body: JSON.stringify({ targetType, targetKey, reaction: nextReaction }),
      });
      const body = await response.json().catch(() => ({})) as {
        data?: { reaction?: CommunityReactionAggregate; reputation?: CommunityReactionSummary };
        error?: { message?: string };
      };
      if (!response.ok || !body.data?.reaction) {
        throw new Error(body.error?.message || "Shop Talk reaction could not be saved.");
      }
      mergeCommunityReactionAggregate(body.data.reaction);
      setCommunityReactionSummary(body.data.reputation ?? null);
      setCommunityReactionStatus("ready");
    } catch (error) {
      addActivity(
        "Reaction not saved",
        error instanceof Error ? error.message : "Shop Talk reaction could not be saved.",
        "error",
      );
    } finally {
      setCommunityReactionPending(ledgerKey, false);
    }
  }

  function handleVoteCommunityPost(postId: number, direction: "up" | "down") {
    void commitCommunityReaction("thread", communityPostReactionKey(postId), direction);
  }

  function handleVoteCommunityAnswer(postId: number, answerId: number, direction: "up" | "down") {
    void commitCommunityReaction("answer", communityAnswerReactionKey(postId, answerId), direction);
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

  function handleNewShopTalkPost(flair: PostFlair, title: string, trade: Trade | "General", body: string) {
    setCommunityPosts((current) => [
      {
        id: Date.now(),
        title,
        trade,
        flair,
        author: accountProfile.displayName,
        body,
        upvotes: 0,
        downvotes: 0,
        replies: [],
        createdAt: "Just now",
        status: "Open",
      },
      ...current,
    ]);
    addActivity("Shop Talk post created", `"${title}" posted to Shop Talk.`);
  }

  function handleJobSaved(job: Job, published: boolean) {
    setJobs((current) => {
      const exists = current.some((candidate) => candidate.id === job.id);
      return exists ? current.map((candidate) => candidate.id === job.id ? job : candidate) : [job, ...current];
    });
    setSelectedId(job.id);
    setEditingJob(job);
    if (published) {
      addActivity("Job published", `${job.title} is now visible to tradespeople in ${job.location}.`);
    }
  }

  function handleJobLoaded(job: Job) {
    setJobs((current) => {
      const exists = current.some((candidate) => candidate.id === job.id);
      return exists ? current.map((candidate) => candidate.id === job.id ? job : candidate) : [job, ...current];
    });
    setSelectedId(job.id);
  }

  async function handleEditJob(job: Job) {
    setJobsError(null);
    try {
      if (!job.canonical) throw new Error("This job is missing its server identity.");
      const canonical = await getJob(job.canonical.id);
      setEditingJob(toJobViewModel(canonical));
      setPostOpen(true);
    } catch (cause) {
      setJobsError(cause instanceof Error ? cause.message : "The job could not be opened.");
    }
  }

  async function handleJobTransition(job: Job, action: "publish" | "pause" | "resume" | "close") {
    if (!job.canonical) throw new Error("This job is missing canonical lifecycle data.");
    setJobsError(null);
    try {
      const updated = toJobViewModel(await transitionJob(job.canonical.id, action, job.canonical.version));
      setJobs((current) => current.map((candidate) => candidate.id === updated.id ? updated : candidate));
      setSelectedId(updated.id);
      const activityLabel = { publish: "published", pause: "paused", resume: "reopened", close: "closed" }[action];
      addActivity(`Job ${activityLabel}`, `${updated.title} is now ${updated.status.toLowerCase()}.`);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "The job status could not be changed.";
      setJobsError(message);
      throw cause;
    }
  }

  async function handleOnboardingComplete(result: OnboardingResult) {
    setAuthError(null);
    try {
      const response = await fetch(apiPath("/api/v1/onboarding/complete"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: result.role,
          displayName: result.displayName,
          serviceAreaCity: result.serviceAreaCity,
          serviceAreaRegion: result.serviceAreaRegion,
          serviceRadiusMiles: result.serviceRadiusMiles,
          tradeCodes: result.specialties.map((specialty) => tradeCodeByName[specialty]),
          organizationName: result.role === "contractor" ? result.organization : undefined,
          consentAccepted: true,
          consentVersion: "2026-06-19",
        }),
      });
      const body = await response.json().catch(() => ({})) as { error?: { message?: string } };
      if (!response.ok) {
        throw new Error(body.error?.message || "Account setup could not be saved.");
      }
      await refreshCanonicalAccount();
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Account setup could not be saved.");
      return;
    }

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

  function openJob(jobId: JobId) {
    setSelectedId(jobId);
    handleNavigate("Marketplace");
  }

  async function handleSendMessage() {
    const trimmed = messageDraft.trim();
    if (!trimmed) {
      addActivity(
        "Message not sent",
        "Write a message in the composer before sending.",
        "warning",
      );
      return;
    }
    if (!selectedConversationId) {
      addActivity(
        "No work thread selected",
        "Open an accepted work thread before sending a message.",
        "warning",
      );
      return;
    }

    setInboxSending(true);
    setInboxError(null);
    try {
      const message = await sendConversationMessage(selectedConversationId, trimmed);
      setInboxMessages((current) => [...current, message]);
      setMessageDraft("");
      await reloadInbox();
    } catch (error) {
      setInboxError(error instanceof Error ? error.message : "Message could not be sent.");
      addActivity(
        "Message not sent",
        error instanceof Error ? error.message : "Message could not be sent.",
        "error",
      );
    } finally {
      setInboxSending(false);
    }
  }

  function handleSelectConversation(conversationId: string) {
    setSelectedConversationId(conversationId);
    void markConversationRead(conversationId)
      .then((conversation) => {
        setInboxConversations((current) => current.map((item) => item.id === conversation.id ? conversation : item));
        setInboxNotifications((current) => current.map((item) => {
          const metadataConversationId = typeof item.metadata?.conversationId === "string" ? item.metadata.conversationId : null;
          return metadataConversationId === conversationId && !item.readAt
            ? { ...item, readAt: new Date().toISOString() }
            : item;
        }));
      })
      .catch(() => {
        // The messages still load; read-state retry is available through the thread actions.
      });
  }

  async function handleMarkSelectedConversationRead() {
    if (!selectedConversationId) return;
    try {
      const conversation = await markConversationRead(selectedConversationId);
      setInboxConversations((current) => current.map((item) => item.id === conversation.id ? conversation : item));
      await reloadInbox();
    } catch (error) {
      setInboxError(error instanceof Error ? error.message : "Conversation could not be marked read.");
    }
  }

  async function handleMarkNotificationsRead() {
    try {
      await markNotificationsRead([], true);
      setInboxNotifications((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })));
    } catch (error) {
      setInboxError(error instanceof Error ? error.message : "Notifications could not be marked read.");
    }
  }

  async function handleMuteSelectedConversation() {
    if (!selectedConversationId) return;
    try {
      const mutedUntil = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
      await muteConversation(selectedConversationId, mutedUntil);
      addActivity("Thread muted", "This conversation is muted for 8 hours.", "success");
      await reloadInbox();
    } catch (error) {
      setInboxError(error instanceof Error ? error.message : "Conversation could not be muted.");
    }
  }

  async function handleReportSelectedConversation() {
    if (!selectedConversationId) return;
    try {
      await reportConversation(selectedConversationId, "safety", "Reported from the inbox for review.");
      addActivity("Conversation reported", "RIVT recorded this conversation for admin review.", "warning");
    } catch (error) {
      setInboxError(error instanceof Error ? error.message : "Conversation could not be reported.");
    }
  }

  function handleExitGuest() {
    setIsGuest(false);
    setJobs([]);
    setSelectedId(0);
    setAccountProfile((current) => ({ ...current, displayName: "" }));
  }

  function handleSignUpFromGuest() {
    setAuthMode("signup");
    setIsGuest(false);
    setJobs([]);
    setSelectedId(0);
    setAccountProfile((current) => ({ ...current, displayName: "" }));
  }

  const page = pageCopy[activeView];
  const primaryOrganizationId = canonicalAccount?.organizations[0]?.id ?? "";
  function openCreateJob() {
    if (!primaryOrganizationId) {
      setJobsError("Finish your contractor organization setup before creating a job.");
      return;
    }
    setEditingJob(null);
    setPostOpen(true);
  }
  const profileSubtitle =
    role === "contractor"
      ? accountProfile.organization
      : accountProfile.specialties.slice(0, 2).join(", ");
  if (authLoading) {
    return <LaunchLoader />;
  }

  const authLinkPath = window.location.pathname;
  if (authLinkPath === "/verify-email" || authLinkPath === "/reset-password") {
    return <AuthLinkFlow mode={authLinkPath === "/verify-email" ? "verify" : "reset"} />;
  }

  if (!authUser) {
    return (
      <AuthGate
        mode={authMode}
        error={authError}
        notice={authNotice}
        providers={authProviders}
        inviteRequired={pilotInviteRequired}
        onModeChange={setAuthMode}
        onSubmit={handleAuthSubmit}
        onForgotPassword={handleForgotPassword}
      />
    );
  }

  if (!onboardingComplete) {
    return (
      <OnboardingFlow
        themeMode={themeMode}
        onToggleTheme={handleToggleTheme}
        onComplete={handleOnboardingComplete}
        onResendVerification={handleResendVerification}
        error={authError}
        notice={authNotice}
        emailVerified={Boolean(canonicalAccount?.emailVerified)}
        initialRole={authUser.role}
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
    <>
      <AppShell
        activeDestination={primaryDestinationForView(activeView)}
        role={role}
        profile={{
          name: accountProfile.displayName || (isGuest ? "Guest" : "RIVT member"),
          subtitle: profileSubtitle || accountProfile.location,
          location: accountProfile.location,
        }}
        activeJob={
          selectedJob.id
            ? {
                title: selectedJob.title,
                trade: selectedJob.trade,
                location: selectedJob.location,
                status: selectedJob.status,
              }
            : null
        }
        notificationCount={unreadActivities}
        isGuest={isGuest}
        guestBanner={
          <GuestBanner
            onSignUp={handleSignUpFromGuest}
            onExit={handleExitGuest}
          />
        }
        onNavigate={(destination) => handleNavigate(defaultViewForDestination(destination))}
        onOpenAccount={() => { setActivityOpen(false); setPostOpen(false); setAccountOpen(true); }}
        onOpenMessages={() => handleNavigate("Messages")}
        onOpenNotifications={() => {
          setAccountOpen(false);
          setPostOpen(false);
          setActivityOpen(true);
          void handleMarkNotificationsRead();
        }}
        onOpenActiveJob={() => handleNavigate("Marketplace")}
        onSearch={(nextQuery, target = "work") => {
          if (target === "shop-talk") {
            setShopTalkGlobalQuery(nextQuery);
            handleNavigate("Shop Talk");
            return;
          }
          if (target === "tools") {
            handleNavigate("Tools");
            return;
          }
          setQuery(nextQuery);
          handleNavigate("Marketplace");
        }}
      >

        {["Home", "Marketplace", "My Crew", "Shop Talk", "Reviews", "Messages", "Tools", "Records", "Trust & Legal", "Safety & Training", "Feedback", "Settings", "Admin"].includes(activeView) ? null : (
          <header className="page-heading" aria-label={`${page.title} heading`}>
            <div>
              <h1>{page.title}</h1>
              <p>{page.description}</p>
            </div>
          </header>
        )}

        {activeView === "Home" ? (
          <HomeDashboard
            role={role}
            name={accountProfile.displayName || (isGuest ? "Guest" : "RIVT member")}
            location={accountProfile.location}
            activeJob={selectedJob.id ? selectedJob : null}
            upcomingJobs={jobs.filter((job) => job.id !== selectedJob.id)}
            applicationCount={Math.max(applications.length, selectedJob.applicants || 0)}
            unreadCount={unreadActivities}
            pendingPaymentCount={paymentRecords.filter((record) => record.status === "Payment pending").length}
            communityCount={communityPosts.length}
            shoutOutCount={shoutOuts.length}
            availabilityStatus={canonicalAccount?.profile.availabilityStatus ?? "available"}
            primaryTrade={primaryProfileTrade}
            newsCount={seedNews.length}
            answerQueueCount={answerQueueCount}
            onPostJob={openCreateJob}
            onOpenJob={openJob}
            onNavigate={(destination) => handleNavigate(defaultViewForDestination(destination))}
            onSetAvailability={handleSetAvailability}
          />
        ) : activeView === "Marketplace" ? (
          <WorkWorkspace
            role={role}
            jobs={filteredJobs}
            selectedJob={selectedJob.id ? selectedJob : null}
            loading={jobsLoading}
            error={jobsError}
            query={query}
            trade={trade}
            difficulty={difficulty}
            workType={workType}
            locationQuery={locationQuery}
            verifiedOnly={verifiedOnly}
            onQueryChange={setQuery}
            onTradeChange={setTrade}
            onDifficultyChange={setDifficulty}
            onWorkTypeChange={setWorkType}
            onLocationChange={setLocationQuery}
            onVerifiedChange={setVerifiedOnly}
            onSelectJob={setSelectedId}
            onPostJob={openCreateJob}
            onEditJob={(job) => void handleEditJob(job)}
            onTransition={handleJobTransition}
            onJobLoaded={handleJobLoaded}
            onRetry={() => void reloadJobs()}
          />
        ) : activeView === "Shop Talk" ? (
          <ShopTalkView
            key={`shop-talk-${shopTalkGlobalQuery}`}
            profile={accountProfile}
            communityPosts={communityPosts}
            newsItems={seedNews}
            initialQuery={shopTalkGlobalQuery}
            selectedJobTrade={selectedJob.trade}
            userLocation={accountProfile.location}
            getPostReactionState={getCommunityPostReactionState}
            getAnswerReactionState={getCommunityAnswerReactionState}
            reactionSummary={communityReactionSummary}
            reactionStatus={communityReactionStatus}
            onVotePost={handleVoteCommunityPost}
            onVoteAnswer={handleVoteCommunityAnswer}
            onAddAnswer={handleAddCommunityAnswer}
            onVerifyAnswer={handleVerifyCommunityAnswer}
            onReportPost={handleReportCommunityPost}
            onNewPost={handleNewShopTalkPost}
          />
        ) : ["My Crew", "Reviews"].includes(activeView) ? (
          <NetworkHub
            jobs={jobs}
            talent={matchingTalent}
            communityPosts={communityPosts}
            shoutOuts={shoutOuts}
            onOpenCrew={() => handleNavigate("My Crew")}
            onOpenShopTalk={() => handleNavigate("Shop Talk")}
            onOpenReviews={() => handleNavigate("Reviews")}
          />
        ) : activeView === "Messages" ? (
          <InboxCenter
            accountId={canonicalAccount?.id ?? authUser.id}
            conversations={inboxConversations}
            selectedConversationId={selectedConversationId}
            messages={inboxMessages}
            notifications={inboxNotifications}
            messageDraft={messageDraft}
            loading={inboxLoading}
            sending={inboxSending}
            error={inboxError}
            onSelectConversation={handleSelectConversation}
            onMessageDraft={setMessageDraft}
            onSendMessage={() => {
              if (isGuest) {
                setGuestPromptOpen(true);
                return;
              }
              void handleSendMessage();
            }}
            onMarkSelectedRead={() => void handleMarkSelectedConversationRead()}
            onMarkNotificationsRead={() => void handleMarkNotificationsRead()}
            onMuteSelected={() => void handleMuteSelectedConversation()}
            onReportSelected={() => void handleReportSelectedConversation()}
            onRefresh={() => void reloadInbox()}
            onNavigate={(destination) => handleNavigate(defaultViewForDestination(destination))}
          />
        ) : ["Trust & Legal", "Safety & Training", "Reviews", "Feedback", "Settings"].includes(activeView) ? (
          <ProfileRoute
            view={activeView as ProfileRouteView}
            role={role}
            accountProfile={accountProfile}
            canonicalAccount={canonicalAccount}
            trustReady={trustReady}
            recordCount={uploadedRecords.size}
            trainingProgress={Math.round((completedTraining.size / trainingModules.length) * 100)}
            safetyCertCount={Object.values(safetyQuizResults).filter((result) => result.passed).length}
            communityBadges={communityBadgeLabels(communityPosts, accountProfile.displayName)}
            shoutOutCount={
              shoutOuts.filter(
                (shoutOut) =>
                  shoutOut.to === accountProfile.displayName ||
                  shoutOut.to === accountProfile.organization,
              ).length
            }
            feedbackCount={feedbackItems.length}
            themeMode={themeMode}
            themePalette={themePalette}
            onToggleTheme={handleToggleTheme}
            onSelectThemePalette={handleSelectThemePalette}
            onLogout={handleLogout}
            onSaveProfile={handleSaveProfile}
            onSetProfileVisibility={handleSetProfileVisibility}
            onCurrentSessionRevoked={handleCurrentSessionRevoked}
            onActivity={addActivity}
          />
        ) : activeView === "Admin" ? (
          <section className="v2-profile-page" aria-label="Admin access">
            <header className="v2-profile-hero">
              <span>Staff access</span>
              <h1>Admin console</h1>
              <p>Admin tools are only available to authorized RIVT staff. Normal user sessions cannot access moderation, support, or account restriction controls.</p>
            </header>
            <section className="v2-profile-panel v2-profile-panel-wide">
              <header>
                <span>Access boundary</span>
                <strong>Server-side permission required</strong>
              </header>
              <p className="v2-profile-note">
                If you need help with an account, use Support from the profile menu. Admin-only actions require a staff role and an auditable reason.
              </p>
            </section>
          </section>
        ) : ["Tools", "Records"].includes(activeView) ? (
          <ToolsStudio
            jobs={jobs}
            paymentRecords={paymentRecords}
            mode={activeView === "Records" ? "records" : "tools"}
            onNavigate={(destination) => handleNavigate(defaultViewForDestination(destination))}
            onOpenJob={openJob}
            onOpenRecords={() => handleNavigate("Records")}
          />
        ) : (
          <LegacyBridge
            view={activeView as "My Jobs" | "Applications" | "Invites" | "My Crew" | "Messages" | "Trust & Legal" | "Records" | "Safety & Training" | "Reviews" | "Feedback" | "Settings" | "Admin" | "Marketplace" | "Home" | "Shop Talk" | "Tools"}
            onNavigate={(view) => handleNavigate(view)}
            onOpenAccount={() => handleNavigate("Settings")}
          />
        )}
      </AppShell>

      {uiToast && (
        <ActivityToast
          activity={uiToast}
          onDismiss={() => setUiToast(null)}
        />
      )}

      {isActivityOpen && (
        <ActivityPanel
          items={notificationActivityItems.length ? notificationActivityItems : activityFeed}
          onClose={() => setActivityOpen(false)}
          onMarkAllRead={() => {
            markAllActivityRead();
            void handleMarkNotificationsRead();
          }}
          onNavigate={handleNavigate}
        />
      )}

      {isAccountOpen && (
        <AccountPanel
          role={role}
          profile={accountProfile}
          trustReady={trustReady}
          recordCount={uploadedRecords.size}
          recordGoal={recordChecklist.length}
          trainingProgress={Math.round((completedTraining.size / trainingModules.length) * 100)}
          safetyCertCount={Object.values(safetyQuizResults).filter((r) => r.passed).length}
          safetyModuleCount={safetyQuizData.length}
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
          onLogout={handleLogout}
          onClose={() => setAccountOpen(false)}
          onNavigate={handleNavigate}
        />
      )}

      {isPostOpen && primaryOrganizationId ? (
        <JobEditorModal
          organizationId={primaryOrganizationId}
          job={editingJob}
          defaultLocation={accountProfile.location}
          onClose={() => { setPostOpen(false); setEditingJob(null); }}
          onSaved={handleJobSaved}
        />
      ) : null}

      {guestPromptOpen && (
        <GuestSignUpPrompt
          onClose={() => setGuestPromptOpen(false)}
          onSignUp={handleSignUpFromGuest}
        />
      )}
    </>
  );
}

export default App;
