import {
  Component,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState } from "react";
import { OfflineBanner } from "./components/OfflineBanner";
import { LocalSetupPrompt } from "./components/LocalSetupPrompt";
import { ReportViewer } from "./features/report/ReportViewer";
import "./components/OfflineBanner.css";
import "./components/LocalSetupPrompt.css";
import { tradeOptions } from "./data";
import { brandConfig } from "./brandConfig";
import type { ApplicationRecord, Job, JobId, Role, Trade } from "./types";
import { AppShell } from "./app-shell/AppShell";
import type { ProfileSearchResult } from "./app-shell/types";
import { AccountPanel, ActivityPanel, ActivityToast } from "./app-shell/AppPanels";
import type {
  AccountProfile,
  AuthUser,
  CanonicalAccount,
  DifficultyFilter,
  FeedbackItem,
  PaymentRecord,
  ShoutOut,
  TradeFilter,
  WorkTypeFilter,
} from "./app-shell/app-state-types";
import {
  defaultViewForDestination,
  pageCopy,
  primaryDestinationForView,
  type NavLabel,
  viewFromPath,
  viewRoutes,
} from "./app-shell/routes";
import {
  AUTH_MODE_KEY,
  readAuthModePreference,
  THEME_PALETTE_STORAGE_KEY,
  THEME_SOURCE_KEY,
  THEME_STORAGE_KEY,
} from "./app-shell/preferences";
import { useAppTheme } from "./app-shell/useAppTheme";
import { useActivityFeed } from "./app-shell/useActivityFeed";
import {
  getJob,
  listActiveWork,
  listJobs,
  toJobViewModel,
  transitionJob,
  type CanonicalActiveWork,
} from "./features/work/job-api";
import { canonicalDifficultyByLabel, canonicalWorkTypeByLabel, tradeCodeByName } from "./features/work/work-mappings";
import { emptyJob } from "./features/work/empty-job";
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
import type { ProfileRouteView } from "./features/profile/ProfileRoute";
import type {
  CommunityPost,
  CommunityReport,
  PostFlair,
  PostType,
} from "./features/shop-talk/ShopTalkView";
import { communityBadgeLabels, relativeTime } from "./features/shop-talk/community-utils";
import { communityPromptPosts, fallbackNewsItems } from "./features/shop-talk/fallback-data";
import {
  createShopTalkAnswer,
  createShopTalkPost,
  deleteShopTalkPost,
  fetchShopTalkPosts,
  reportShopTalkTarget,
  uploadShopTalkPostPhoto,
  verifyShopTalkAnswer,
  type ServerShopTalkAnswer,
  type ServerShopTalkPost,
  type ShopTalkReportReason,
} from "./features/shop-talk/shop-talk-api";
import { communitySlug, fetchCommunities, type ServerCommunity } from "./features/shop-talk/communities-api";
import {
  fallbackCommunities,
  mapServerCommunity,
  type CommunityDisplay,
} from "./features/shop-talk/community-directory";
import { useCommunityReactions } from "./features/shop-talk/useCommunityReactions";
import type { ProfileUpdateInput } from "./features/profile/ProfileHub";
import type { ToolMode } from "./features/tools/ToolsStudio";
import { recordChecklist, safetyQuizData, trainingModules, type SafetyQuizResult } from "./features/profile/training-data";
import { apiPath, RIVT_SESSION_EXPIRED_EVENT } from "./lib/api";
import {
  AuthGate,
  AuthLinkFlow,
  GuestBanner,
  GuestSignUpPrompt,
  GUEST_PREVIEW_PREFS_KEY,
  LaunchLoader,
  OnboardingFlow,
  type AuthMethod,
  type GuestPreviewPreferences,
  type OnboardingResult,
} from "./features/auth/AuthScreens";

const TradeFeed = lazy(() => import("./features/home/TradeFeed").then((m) => ({ default: m.TradeFeed })));
const WorkWorkspace = lazy(() => import("./features/work/WorkWorkspace").then((m) => ({ default: m.WorkWorkspace })));
const JobEditorModal = lazy(() => import("./features/work/JobEditorModal").then((m) => ({ default: m.JobEditorModal })));
const NetworkHub = lazy(() => import("./features/network/NetworkHub").then((m) => ({ default: m.NetworkHub })));
const InboxCenter = lazy(() => import("./features/inbox/InboxCenter").then((m) => ({ default: m.InboxCenter })));
const ShopTalkView = lazy(() => import("./features/shop-talk/ShopTalkView").then((m) => ({ default: m.ShopTalkView })));
const ProfileRoute = lazy(() => import("./features/profile/ProfileRoute").then((m) => ({ default: m.ProfileRoute })));
const ToolsStudio = lazy(() => import("./features/tools/ToolsStudio").then((m) => ({ default: m.ToolsStudio })));
const ModerationConsole = lazy(() => import("./features/admin/ModerationConsole").then((m) => ({ default: m.ModerationConsole })));
const LegacyBridge = lazy(() => import("./features/legacy/LegacyBridge").then((m) => ({ default: m.LegacyBridge })));

const toolModes = new Set<ToolMode>([
  "calculator",
  "estimate",
  "invoice",
  "materials",
  "daily-log",
  "job-photos",
  "time-tracker",
  "expense-logger",
  "earnings",
  "bid-builder",
  "mileage",
  "price-book",
  "safety-checklist",
  "tax-estimator",
  "punch-list",
  "contracts",
  "job-checklist",
  "payments",
  "daily-report",
  "tax-summary",
]);

function readToolFromUrl() {
  if (typeof window === "undefined") return null;
  const tool = new URLSearchParams(window.location.search).get("tool");
  return tool && toolModes.has(tool as ToolMode) ? tool as ToolMode : null;
}

function pathForTool(tool: ToolMode | null) {
  if (!tool || tool === "hub") return viewRoutes.Tools;
  return `${viewRoutes.Tools}?tool=${encodeURIComponent(tool)}`;
}

function currentPathAndSearch() {
  return `${window.location.pathname}${window.location.search}`;
}

function communityReportReasonCode(reason: CommunityReport["reason"]): ShopTalkReportReason {
  switch (reason) {
    case "Misinformation":
      return "misinformation";
    case "Safety concern":
      return "unsafe_advice";
    case "Spam":
      return "spam";
    case "Harassment":
      return "harassment";
    case "Privacy/contact info":
      return "privacy";
    case "Duplicate/off-topic":
      return "duplicate";
    case "Other":
      return "other";
    default:
      return "other";
  }
}

const validGuestPreviewTrades = new Set<Trade>(
  tradeOptions.filter((option): option is Trade => option !== "All trades"),
);

function readGuestPreviewPreferences(): GuestPreviewPreferences | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(GUEST_PREVIEW_PREFS_KEY) ?? "null") as Partial<GuestPreviewPreferences> | null;
    if (!parsed || typeof parsed.location !== "string" || !validGuestPreviewTrades.has(parsed.trade as Trade)) return null;
    return {
      trade: parsed.trade as Trade,
      location: parsed.location.trim() || "Jacksonville, FL",
      role: parsed.role === "tradesperson" ? "tradesperson" : "contractor",
    };
  } catch {
    return null;
  }
}

type StorageUsageSnapshot = {
  usedBytes: number;
  objectCount: number;
  storageLimitBytes?: number | null;
  storageScope?: string;
  bucket?: string | null;
  region?: string | null;
  endpoint?: string | null;
  objectStorage?: string;
  mode?: string;
  database?: string;
  missing?: string[];
};

const SAFETY_QUIZ_RESULTS_KEY = "rivt.safetyQuizResults.v1";
const PRESERVED_LOCAL_KEYS = new Set([
  THEME_STORAGE_KEY,
  THEME_SOURCE_KEY,
  THEME_PALETTE_STORAGE_KEY,
]);

function clearRivtLocalState() {
  if (typeof window === "undefined") return;
  const keysToRemove: string[] = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key?.startsWith("rivt.") || PRESERVED_LOCAL_KEYS.has(key)) continue;
    keysToRemove.push(key);
  }
  keysToRemove.forEach((key) => window.localStorage.removeItem(key));
}

function readSafetyQuizResults(): Record<string, SafetyQuizResult> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(SAFETY_QUIZ_RESULTS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    return Object.entries(parsed as Record<string, Partial<SafetyQuizResult>>).reduce<Record<string, SafetyQuizResult>>(
      (acc, [quizId, result]) => {
        if (
          result &&
          typeof result.quizId === "string" &&
          typeof result.score === "number" &&
          typeof result.passed === "boolean" &&
          typeof result.completedAt === "string" &&
          typeof result.attempts === "number"
        ) {
          acc[quizId] = {
            quizId: result.quizId,
            score: result.score,
            passed: result.passed,
            completedAt: result.completedAt,
            attempts: result.attempts,
          };
        }
        return acc;
      },
      {},
    );
  } catch {
    return {};
  }
}

function writeSafetyQuizResults(results: Record<string, SafetyQuizResult>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SAFETY_QUIZ_RESULTS_KEY, JSON.stringify(results));
  } catch {
    // Device storage can be unavailable in private browsing; quiz state remains in memory.
  }
}

function RouteFallback() {
  return <div className="route-loading" role="status" aria-live="polite" aria-label="Loading" />;
}

class RouteErrorBoundary extends Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) {
      return (
        <div className="route-error" role="alert">
          <p>This page couldn't load. <button type="button" onClick={() => window.location.reload()}>Reload</button></p>
        </div>
      );
    }
    return this.props.children;
  }
}

const VALID_POST_FLAIRS: PostFlair[] = ["Question", "Discussion", "Code Talk", "Compliance", "Tip", "Humor"];
const VALID_POST_TYPES: PostType[] = ["question", "sub-request", "safety", "general"];
const VALID_POST_STATUSES: CommunityPost["status"][] = ["Open", "Verified Fix", "Needs a pro answer"];
const WORK_FILTER_PREFS_KEY = "rivt.workFilters.v1";

interface WorkFilterPrefs {
  query: string;
  trade: TradeFilter;
  difficulty: DifficultyFilter;
  workType: WorkTypeFilter;
  locationQuery: string;
  verifiedOnly: boolean;
}

function readWorkFilterPrefs(): WorkFilterPrefs {
  const fallback: WorkFilterPrefs = {
    query: "",
    trade: "All trades",
    difficulty: "Any difficulty",
    workType: "All work types",
    locationQuery: "",
    verifiedOnly: false,
  };
  try {
    const parsed = JSON.parse(localStorage.getItem(WORK_FILTER_PREFS_KEY) ?? "null") as Partial<WorkFilterPrefs> | null;
    if (!parsed || typeof parsed !== "object") return fallback;
    return {
      query: typeof parsed.query === "string" ? parsed.query : fallback.query,
      trade: typeof parsed.trade === "string" ? parsed.trade as TradeFilter : fallback.trade,
      difficulty: typeof parsed.difficulty === "string" ? parsed.difficulty as DifficultyFilter : fallback.difficulty,
      workType: typeof parsed.workType === "string" ? parsed.workType as WorkTypeFilter : fallback.workType,
      locationQuery: typeof parsed.locationQuery === "string" ? parsed.locationQuery : fallback.locationQuery,
      verifiedOnly: Boolean(parsed.verifiedOnly),
    };
  } catch {
    return fallback;
  }
}

function writeWorkFilterPrefs(next: WorkFilterPrefs) {
  try { localStorage.setItem(WORK_FILTER_PREFS_KEY, JSON.stringify(next)); } catch { /* harmless preference */ }
}
const TRADE_OPTION_NAMES = new Set<string>(tradeOptions.filter((option) => option !== "All trades"));

function normalizeShopTalkTrade(value: string): Trade | "General" {
  return TRADE_OPTION_NAMES.has(value) ? value as Trade : "General";
}

function defaultShopTalkCommunitySlug(trade: Trade | "General") {
  switch (trade) {
    case "Carpentry":
      return "carpentry-talk";
    case "Electrical":
      return "electrical-talk";
    case "Plumbing":
      return "plumbing-talk";
    case "Tile":
      return "tile-talk";
    case "Cabinetry":
      return "cabinetry-talk";
    default:
      return "jacksonville-trades";
  }
}

function normalizePostFlair(value?: string): PostFlair | undefined {
  return value && VALID_POST_FLAIRS.includes(value as PostFlair) ? value as PostFlair : undefined;
}

function normalizePostType(value?: string): PostType {
  return value && VALID_POST_TYPES.includes(value as PostType) ? value as PostType : "general";
}

function normalizePostStatus(value?: string): CommunityPost["status"] {
  return value && VALID_POST_STATUSES.includes(value as CommunityPost["status"])
    ? value as CommunityPost["status"]
    : "Open";
}

function toCommunityAnswerViewModel(answer: ServerShopTalkAnswer): CommunityPost["replies"][number] {
  return {
    id: answer.id,
    author: answer.author?.trim() || "RIVT member",
    body: answer.body,
    upvotes: 0,
    downvotes: 0,
    verifiedFix: Boolean(answer.verifiedFix),
  };
}

function toCommunityPostViewModel(post: ServerShopTalkPost): CommunityPost {
  const createdAtMs = new Date(post.createdAt).getTime();
  const firstMedia = Array.isArray(post.media) ? post.media[0] : undefined;
  const thumbnailUrl = post.thumbnailUrl ?? firstMedia?.signedUrl ?? undefined;
  return {
    id: post.id,
    title: post.title,
    trade: normalizeShopTalkTrade(post.trade),
    author: post.author?.trim() || "RIVT member",
    flair: normalizePostFlair(post.flair),
    body: post.body,
    upvotes: 0,
    downvotes: 0,
    replies: Array.isArray(post.answers) ? post.answers.map(toCommunityAnswerViewModel) : [],
    createdAt: relativeTime(post.createdAt),
    sortOrder: Number.isFinite(createdAtMs) ? createdAtMs : undefined,
    status: normalizePostStatus(post.status),
    type: normalizePostType(post.type),
    communitySlug: post.communitySlug,
    communityName: post.communityName,
    communityAudience: post.communityAudience,
    ...(thumbnailUrl ? { thumbnailUrl } : {}),
    ...(thumbnailUrl ? { thumbnailAlt: post.thumbnailAlt ?? firstMedia?.altText ?? firstMedia?.originalName ?? post.title } : {}),
  };
}

function App() {
  const [activeView, setActiveView] = useState<NavLabel>(() => viewFromPath(window.location.pathname));
  const [requestedTool, setRequestedTool] = useState<ToolMode | null>(() => readToolFromUrl());
  const [toolsImmersive, setToolsImmersive] = useState(false);
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
  const [query, setQuery] = useState(() => readWorkFilterPrefs().query);
  const [profileSearchFocus, setProfileSearchFocus] = useState<ProfileSearchResult | null>(null);
  const [shopTalkGlobalQuery, setShopTalkGlobalQuery] = useState("");
  const [shopTalkPostId, setShopTalkPostId] = useState<string | null>(null);
  const [shopTalkCompose, setShopTalkCompose] = useState(false);
  const [shopTalkCommunitySlug, setShopTalkCommunitySlug] = useState<string | null>(null);
  const [shopTalkAnswerQueue, setShopTalkAnswerQueue] = useState(false);
  // Consume one-shot Shop Talk intents (open a post / open the composer) once we leave the view.
  useEffect(() => {
    if (activeView === "Shop Talk") return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setShopTalkCompose(false);
    setShopTalkPostId(null);
    setShopTalkCommunitySlug(null);
    setShopTalkAnswerQueue(false);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [activeView]);
  const [trade, setTrade] = useState<TradeFilter>(() => readWorkFilterPrefs().trade);
  const [difficulty, setDifficulty] =
    useState<DifficultyFilter>(() => readWorkFilterPrefs().difficulty);
  const [workType, setWorkType] = useState<WorkTypeFilter>(() => readWorkFilterPrefs().workType);
  const [locationQuery, setLocationQuery] = useState(() => readWorkFilterPrefs().locationQuery);
  const [verifiedOnly, setVerifiedOnly] = useState(() => readWorkFilterPrefs().verifiedOnly);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedId, setSelectedId] = useState<JobId>(0);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobsError, setJobsError] = useState<string | null>(null);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const jobsRequestRef = useRef(0);
  useEffect(() => {
    writeWorkFilterPrefs({ query, trade, difficulty, workType, locationQuery, verifiedOnly });
  }, [difficulty, locationQuery, query, trade, verifiedOnly, workType]);
  const [_applications] = useState<ApplicationRecord[]>([]);
  const [isPostOpen, setPostOpen] = useState(false);
  const [isActivityOpen, setActivityOpen] = useState(false);
  const [isAccountOpen, setAccountOpen] = useState(false);
  const [trustReady, setTrustReady] = useState(false);
  const [messageDraft, setMessageDraft] = useState("");
  const [inboxConversations, setInboxConversations] = useState<InboxConversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [inboxMessages, setInboxMessages] = useState<InboxMessage[]>([]);
  const [inboxNotifications, setInboxNotifications] = useState<InboxNotification[]>([]);
  const [activeWork, setActiveWork] = useState<CanonicalActiveWork[]>([]);
  const [messageBrowserNotificationsEnabled, setMessageBrowserNotificationsEnabled] = useState(true);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [inboxSending, setInboxSending] = useState(false);
  const [inboxError, setInboxError] = useState<string | null>(null);
  const [uploadedRecords, setUploadedRecords] = useState<Set<string>>(
    () => new Set(),
  );
  const [storageUsage, setStorageUsage] = useState<StorageUsageSnapshot | null>(null);
  const [completedTraining] = useState<Set<string>>(
    () => new Set(),
  );
  const [safetyQuizResults, setSafetyQuizResults] = useState<Record<string, SafetyQuizResult>>(readSafetyQuizResults);
  const [feedbackItems] = useState<FeedbackItem[]>([]);
  const [paymentRecords] = useState<PaymentRecord[]>([]);
  const [communityPosts, setCommunityPosts] = useState<CommunityPost[]>(communityPromptPosts);
  const [communities, setCommunities] = useState<CommunityDisplay[]>(fallbackCommunities);
  const [, setCommunityReports] = useState<CommunityReport[]>([]);
  const [shoutOuts, setShoutOuts] = useState<ShoutOut[]>([]);
  const shopTalkPostsRequestRef = useRef(0);
  const communitiesRequestRef = useRef(0);
  const {
    handleSelectThemePalette,
    handleSetThemeSource,
    handleToggleTheme,
    themeMode,
    themePalette,
    themeSource,
  } = useAppTheme();
  const {
    activityItems,
    addActivity,
    dismissToast,
    markAllActivityRead,
    uiToast,
    unreadActivities,
  } = useActivityFeed({
    activeView,
    notifications: inboxNotifications,
    role,
  });
  const unreadMessages = inboxConversations.reduce((sum, conversation) => sum + Math.max(0, conversation.unreadCount || 0), 0);
  const [isGuest, setIsGuest] = useState(false);
  const [guestPromptOpen, setGuestPromptOpen] = useState(false);
  const [localSetupOpen, setLocalSetupOpen] = useState(false);
  const {
    communityReactionStatus,
    communityReactionSummary,
    getCommunityAnswerReactionState,
    getCommunityPostReactionState,
    handleVoteCommunityAnswer,
    handleVoteCommunityPost,
    resetCommunityReactions,
  } = useCommunityReactions({
    authReady: Boolean(authUser && canonicalAccount && onboardingComplete),
    communityPosts,
    onReactionError: (message) => addActivity("Reaction not saved", message, "error"),
  });

  useEffect(() => {
    const root = document.documentElement;
    const mediaQuery = window.matchMedia("(pointer: coarse)");
    const hoverNoneQuery = window.matchMedia("(hover: none)");
    const visualViewport = window.visualViewport;

    function syncCompactDeviceFlag() {
      const viewportFloor = Math.min(window.innerWidth || Number.MAX_SAFE_INTEGER, window.innerHeight || Number.MAX_SAFE_INTEGER);
      const screenFloor = Math.min(window.screen.width || Number.MAX_SAFE_INTEGER, window.screen.height || Number.MAX_SAFE_INTEGER);
      const hasTouchLikeInput = mediaQuery.matches || hoverNoneQuery.matches || navigator.maxTouchPoints > 0;
      const isCompactDevice = hasTouchLikeInput && (screenFloor <= 430 || viewportFloor <= 430);

      if (isCompactDevice) {
        root.setAttribute("data-rivt-compact-device", "true");
      } else {
        root.removeAttribute("data-rivt-compact-device");
      }
    }

    syncCompactDeviceFlag();
    mediaQuery.addEventListener?.("change", syncCompactDeviceFlag);
    hoverNoneQuery.addEventListener?.("change", syncCompactDeviceFlag);
    window.addEventListener("resize", syncCompactDeviceFlag);
    window.addEventListener("orientationchange", syncCompactDeviceFlag);
    visualViewport?.addEventListener("resize", syncCompactDeviceFlag);

    return () => {
      mediaQuery.removeEventListener?.("change", syncCompactDeviceFlag);
      hoverNoneQuery.removeEventListener?.("change", syncCompactDeviceFlag);
      window.removeEventListener("resize", syncCompactDeviceFlag);
      window.removeEventListener("orientationchange", syncCompactDeviceFlag);
      visualViewport?.removeEventListener("resize", syncCompactDeviceFlag);
    };
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
    writeSafetyQuizResults(safetyQuizResults);
  }, [safetyQuizResults]);

  useEffect(() => {
    function handleSessionExpired() {
      if (!authUser || isGuest) return;
      clearRivtLocalState();
      setAuthUser(null);
      setCanonicalAccount(null);
      setOnboardingComplete(false);
      resetCommunityReactions();
      setStorageUsage(null);
      setActiveView("Home");
      setRequestedTool(null);
      setToolsImmersive(false);
      addActivity(
        "Session ended",
        "Your account session ended or was signed out on another device. Sign in again to keep working.",
        "warning",
      );
    }

    window.addEventListener(RIVT_SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () => window.removeEventListener(RIVT_SESSION_EXPIRED_EVENT, handleSessionExpired);
  }, [addActivity, authUser, isGuest, resetCommunityReactions]);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("auth_error")) return;
    url.searchParams.delete("auth_error");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);

  useEffect(() => {
    function handleHistoryNavigation() {
      const nextView = viewFromPath(window.location.pathname);
      const nextTool = nextView === "Tools" ? readToolFromUrl() : null;
      setActiveView(nextView);
      setRequestedTool(nextTool);
      setToolsImmersive(Boolean(nextTool));
      setActivityOpen(false);
      setAccountOpen(false);
      setPostOpen(false);
    }

    window.addEventListener("popstate", handleHistoryNavigation);
    return () => window.removeEventListener("popstate", handleHistoryNavigation);
  }, []);

  const applyCanonicalAccount = useCallback((account: CanonicalAccount) => {
    const normalizedAccount = { ...account, adminRoles: account.adminRoles ?? [] };
    const accountRole = account.primaryRole === "tradesperson" ? "tradesperson" : "contractor";
    const authMethod: AuthMethod = account.provider === "google" ? "Google" : account.provider === "facebook" ? "Facebook" : account.provider === "apple" ? "Apple" : "Email";
    setCanonicalAccount(normalizedAccount);
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
    const accountOnboardingComplete = account.status === "active" && account.profile.onboardingStatus === "complete";
    setOnboardingComplete(accountOnboardingComplete);
    setTrustReady(accountOnboardingComplete);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function hydrateAuth() {
      // Dev bypass: set localStorage key "rivt_dev_bypass=1" to skip auth
      if (import.meta.env.DEV && localStorage.getItem("rivt_dev_bypass") === "1") {
        const mockAccount: CanonicalAccount = {
          id: "dev-user-1",
          email: "dev@rivt.app",
          provider: "email",
          status: "active",
          emailVerified: true,
          primaryRole: "contractor",
          profile: {
            displayName: "Jake Torres",
            headline: "Commercial electrician and service contractor",
            bio: "Jacksonville contractor using RIVT for work, crews, records, and tools.",
            locationText: "Jacksonville, FL",
            visibility: "network",
            onboardingStatus: "complete",
            serviceArea: {
              city: "Jacksonville",
              region: "FL",
              countryCode: "US",
              radiusMiles: 25,
            },
            availabilityStatus: "available",
            contactEmailVisibility: "connections",
            phoneE164: null,
            phoneVisibility: "private",
            avatarUploadId: null,
            trades: [{ code: "electrical", name: "Electrical", primary: true }],
          },
          organizations: [{ id: "dev-org-1", name: "Torres Electric LLC", role: "owner" }],
          adminRoles: ["moderator", "owner", "support"],
          capabilities: {
            canCompleteOnboarding: true,
            canPostWork: true,
            canApplyToWork: true,
            canPublishProfile: true,
          },
        };
        applyCanonicalAccount(mockAccount);
        setAuthLoading(false);
        return;
      }
      try {
        const [meResponse, providersResponse, storageResponse] = await Promise.all([
          fetch(apiPath("/api/v1/me"), { credentials: "include" }),
          fetch(apiPath("/api/auth/providers"), { credentials: "include" }),
          fetch(apiPath("/api/storage"), { credentials: "include" }),
        ]);
        const meBody = await meResponse.json().catch(() => ({})) as { data?: CanonicalAccount };
        const providersBody = await providersResponse.json().catch(() => ({})) as {
          providers?: Record<string, { ok: boolean; mode: string; missing: string[]; purpose: string }>;
          inviteRequired?: boolean;
        };
        const storageBody = await storageResponse.json().catch(() => ({})) as {
          usedBytes?: number;
          objectCount?: number;
          accountStorage?: { usedBytes?: number; objectCount?: number };
          plan?: { storageLimitBytes?: number | null; storageScope?: string };
          bucket?: string | null;
          region?: string | null;
          endpoint?: string | null;
          objectStorage?: string;
          mode?: string;
          database?: string;
          missing?: string[];
        };
        if (cancelled) return;
        setAuthProviders(providersBody.providers ?? {});
        setPilotInviteRequired(Boolean(providersBody.inviteRequired));
        const storageSnapshot = storageBody.accountStorage ?? storageBody;
        if (storageResponse.ok && typeof storageSnapshot.usedBytes === "number") {
          setStorageUsage({
            usedBytes: Number(storageSnapshot.usedBytes),
            objectCount: Number(storageSnapshot.objectCount ?? 0),
            storageLimitBytes: storageBody.plan?.storageLimitBytes ?? null,
            storageScope: storageBody.plan?.storageScope ?? "account",
            bucket: storageBody.bucket ?? null,
            region: storageBody.region ?? null,
            endpoint: storageBody.endpoint ?? null,
            objectStorage: storageBody.objectStorage,
            mode: storageBody.mode,
            database: storageBody.database,
            missing: storageBody.missing ?? [],
          });
        } else {
          setStorageUsage({
            usedBytes: 0,
            objectCount: 0,
            storageLimitBytes: null,
            storageScope: "account",
            bucket: null,
            region: null,
            endpoint: null,
            objectStorage: "s3-compatible",
          });
        }
        if (meResponse.ok && meBody.data) {
          applyCanonicalAccount(meBody.data);
        } else if (meResponse.status === 401) {
          setAuthUser(null);
          setCanonicalAccount(null);
          setOnboardingComplete(false);
          resetCommunityReactions();
          setStorageUsage(null);
        } else {
          throw new Error("Session lookup failed.");
        }
      } catch {
        if (!cancelled) {
          setAuthUser(null);
          setCanonicalAccount(null);
          setOnboardingComplete(false);
          resetCommunityReactions();
          setAuthProviders({});
          setStorageUsage(null);
          setAuthError(null);
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
  }, [applyCanonicalAccount, resetCommunityReactions]);

  async function refreshCanonicalAccount() {
    const response = await fetch(apiPath("/api/v1/me"), { credentials: "include" });
    const body = await response.json().catch(() => ({})) as { data?: CanonicalAccount; error?: { message?: string } };
    if (!response.ok || !body.data) throw new Error(body.error?.message || "RIVT could not load your account.");
    applyCanonicalAccount(body.data);
    return body.data;
  }

  const reloadJobs = useCallback(async () => {
    if (isGuest || !authUser || !onboardingComplete) return;
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
  }, [authUser, difficulty, isGuest, locationQuery, onboardingComplete, query, trade, verifiedOnly, workType]);

  useEffect(() => {
    const timeout = window.setTimeout(() => { void reloadJobs(); }, 250);
    return () => window.clearTimeout(timeout);
  }, [reloadJobs]);

  const reloadActiveWork = useCallback(async () => {
    if (isGuest || !authUser || !onboardingComplete) {
      setActiveWork([]);
      return;
    }
    try {
      setActiveWork(await listActiveWork());
    } catch {
      setActiveWork([]);
    }
  }, [authUser, isGuest, onboardingComplete]);

  useEffect(() => {
    const timeout = window.setTimeout(() => { void reloadActiveWork(); }, 0);
    return () => window.clearTimeout(timeout);
  }, [reloadActiveWork]);

  const reloadShopTalkPosts = useCallback(async () => {
    if (isGuest || !authUser || !onboardingComplete) return;
    const requestId = ++shopTalkPostsRequestRef.current;
    const posts = await fetchShopTalkPosts();
    if (shopTalkPostsRequestRef.current !== requestId) return;
    if (posts === null) return;
    setCommunityPosts(posts.map(toCommunityPostViewModel));
  }, [authUser, isGuest, onboardingComplete]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    void reloadShopTalkPosts();
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [reloadShopTalkPosts]);

  const reloadCommunities = useCallback(async () => {
    if (isGuest || !authUser || !onboardingComplete) return;
    const requestId = ++communitiesRequestRef.current;
    const rows = await fetchCommunities();
    if (communitiesRequestRef.current !== requestId) return;
    if (rows === null) return;
    setCommunities(rows.map(mapServerCommunity));
  }, [authUser, isGuest, onboardingComplete]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    void reloadCommunities();
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [reloadCommunities]);

  const reloadInbox = useCallback(async () => {
    if (isGuest || !authUser || !onboardingComplete) return;
    setInboxLoading(true);
    setInboxError(null);
    try {
      const [conversationRows, notificationRows] = await Promise.all([
        listConversations(),
        listNotifications(),
      ]);
      const safeConversations = Array.isArray(conversationRows) ? conversationRows : [];
      const safeNotifications = Array.isArray(notificationRows?.notifications) ? notificationRows.notifications : [];
      setInboxConversations(safeConversations);
      setInboxNotifications(safeNotifications);
      setSelectedConversationId((current) => (
        current && safeConversations.some((conversation) => conversation.id === current)
          ? current
          : safeConversations[0]?.id ?? null
      ));
    } catch (error) {
      setInboxError(error instanceof Error ? error.message : "Inbox could not be loaded.");
    } finally {
      setInboxLoading(false);
    }
  }, [authUser, isGuest, onboardingComplete]);

  const loadConversationMessages = useCallback(async (conversationId: string | null) => {
    if (!conversationId || isGuest || !authUser || !onboardingComplete) {
      setInboxMessages([]);
      return;
    }
    setInboxError(null);
    try {
      const messages = await listConversationMessages(conversationId);
      setInboxMessages(Array.isArray(messages) ? messages : []);
    } catch (error) {
      setInboxMessages([]);
      setInboxError(error instanceof Error ? error.message : "Messages could not be loaded.");
    }
  }, [authUser, isGuest, onboardingComplete]);

  useEffect(() => {
    if (isGuest || !authUser || !onboardingComplete) return;
    const timeout = window.setTimeout(() => {
      void reloadInbox();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [authUser, isGuest, onboardingComplete, reloadInbox]);

  useEffect(() => {
    if (activeView !== "Messages") return;
    const timeout = window.setTimeout(() => {
      void reloadInbox();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [activeView, reloadInbox]);

  // Poll inbox every 30 seconds while authenticated
  useEffect(() => {
    if (isGuest || !authUser || !onboardingComplete) return;
    const interval = window.setInterval(() => { void reloadInbox(); }, 30000);
    return () => window.clearInterval(interval);
  }, [authUser, isGuest, onboardingComplete, reloadInbox]);

  useEffect(() => {
    function handleNotificationPreference(event: Event) {
      const detail = (event as CustomEvent<{
        notificationType?: string;
        channel?: string;
        enabled?: boolean;
      }>).detail;
      if (detail?.notificationType === "messages" && detail.channel === "push" && typeof detail.enabled === "boolean") {
        setMessageBrowserNotificationsEnabled(detail.enabled);
      }
    }
    window.addEventListener("rivt:notification-pref", handleNotificationPreference);
    return () => window.removeEventListener("rivt:notification-pref", handleNotificationPreference);
  }, []);

  useEffect(() => {
    if (isGuest || !authUser || !onboardingComplete) return;
    let cancelled = false;
    async function loadMessageNotificationPreference() {
      try {
        const response = await fetch(apiPath("/api/v1/notification-preferences"), { credentials: "include" });
        const body = await response.json().catch(() => ({})) as {
          data?: { preferences?: Array<{ notificationType: string; channel: string; enabled: boolean }> };
        };
        if (!response.ok || cancelled) return;
        const messagesPush = body.data?.preferences?.find((item) => item.notificationType === "messages" && item.channel === "push");
        setMessageBrowserNotificationsEnabled(messagesPush?.enabled ?? true);
      } catch {
        if (!cancelled) setMessageBrowserNotificationsEnabled(true);
      }
    }
    void loadMessageNotificationPreference();
    return () => { cancelled = true; };
  }, [authUser, isGuest, onboardingComplete]);

  // Request browser notification permission when user visits Messages
  useEffect(() => {
    if (activeView !== "Messages") return;
    if ("Notification" in window && Notification.permission === "default") {
      void Notification.requestPermission();
    }
  }, [activeView]);

  // Show browser notification on new unread inbox messages
  const prevUnreadRef = useRef(0);
  useEffect(() => {
    const unread = inboxConversations.reduce((sum, c) => sum + c.unreadCount, 0);
    if (
      unread > prevUnreadRef.current &&
      messageBrowserNotificationsEnabled &&
      "Notification" in window &&
      Notification.permission === "granted" &&
      activeView !== "Messages"
    ) {
      new Notification("RIVT — new message", {
        body: `You have ${unread} unread message${unread === 1 ? "" : "s"}`,
        icon: "/rivt-maskable-icon-192.png",
      });
    }
    prevUnreadRef.current = unread;
  }, [inboxConversations, activeView, messageBrowserNotificationsEnabled]);

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

  const selectedJob = jobs.find((job) => job.id === selectedId) ?? jobs[0] ?? emptyJob;
  const primaryProfileTrade = canonicalAccount?.profile.trades.find((tradeItem) => tradeItem.primary)?.name
    ?? accountProfile.specialties[0]
    ?? selectedJob.trade
    ?? "General trades";
  const _answerQueueCount = communityPosts.filter((post) => (
    (post.trade === primaryProfileTrade || post.trade === "General") &&
    post.status !== "Verified Fix"
  )).length;

  const filteredJobs = jobs;

  type AuthFailureBody = {
    error?: {
      code?: string;
      message?: string;
      details?: {
        issues?: Array<{ path?: string; message?: string }>;
      };
    };
  };

  function formatAuthFailure(mode: "login" | "signup", body: AuthFailureBody) {
    const code = body.error?.code;
    if (mode === "signup") {
      switch (code) {
        case "SIGNUP_NOT_AVAILABLE":
          return "That email may already be registered. Log in instead, or use Forgot password to reset it.";
        case "INVITATION_REQUIRED":
          return "Enter your pilot invitation code to create an account.";
        case "INVITATION_INVALID":
          return "That invite code is invalid, expired, fully used, or not assigned to this email or account type. Check the code and try again.";
        case "PASSWORD_POLICY_FAILED":
          return body.error?.message || "Use at least 8 characters with uppercase, lowercase, a number, and a symbol.";
        case "VALIDATION_FAILED": {
          const fields = body.error?.details?.issues
            ?.map((issue) => issue.path)
            .filter((path): path is string => Boolean(path));
          if (fields?.includes("inviteCode")) return "Invite codes must be at least 5 characters. Check the code and try again.";
          if (fields?.includes("email")) return "Enter a valid email address.";
          if (fields?.includes("displayName")) return "Enter your name or business name with at least 2 characters.";
          return "Check the signup fields and try again.";
        }
        case "EMAIL_PROVIDER_UNAVAILABLE":
          return "Email signup is temporarily unavailable. Try again shortly or contact support@rivt.pro.";
        case "SIGNUPS_DISABLED":
          return "RIVT signups are temporarily closed. Try again later or contact support@rivt.pro.";
        default:
          return body.error?.message || "Account could not be created. Check your email, password, account type, and invite code.";
      }
    }
    return body.error?.message || "Sign-in failed.";
  }

  async function handleAuthSubmit(form: { email: string; password: string; displayName?: string; role?: Role; inviteCode?: string }) {
    setAuthError(null);
    setAuthNotice(null);
    try {
      const requestMode = authMode;
      const path = requestMode === "signup" ? "/api/v1/auth/signup" : "/api/v1/auth/login";
      const response = await fetch(apiPath(path), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = await response.json().catch(() => ({})) as {
        data?: { user?: AuthUser; verificationRequired?: boolean; verificationDelivered?: boolean };
        error?: AuthFailureBody["error"];
      };
      if (!response.ok || !body.data?.user) {
        throw new Error(formatAuthFailure(requestMode, body));
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
      resetCommunityReactions();
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

  async function _handleSetAvailability(availabilityStatus: CanonicalAccount["profile"]["availabilityStatus"]) {
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
    clearRivtLocalState();
    setAuthUser(null);
    setCanonicalAccount(null);
    setOnboardingComplete(false);
    resetCommunityReactions();
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
      clearRivtLocalState();
      setAuthUser(null);
      setCanonicalAccount(null);
      setOnboardingComplete(false);
      resetCommunityReactions();
      setAuthNotice(null);
      setAccountOpen(false);
      setActivityOpen(false);
      setActiveView("Home");
      window.history.replaceState({}, "", "/");
    }
  }

  function handleNavigate(view: NavLabel) {
    setRequestedTool(null);
    setToolsImmersive(false);
    setActiveView(view);
    const nextPath = viewRoutes[view];
    if (currentPathAndSearch() !== nextPath) {
      window.history.pushState({ view }, "", nextPath);
    }
    setActivityOpen(false);
    setAccountOpen(false);
    setPostOpen(false);
  }

  function handleOpenTool(tool: ToolMode) {
    const nextTool = tool === "hub" ? null : tool;
    setRequestedTool(nextTool);
    setToolsImmersive(Boolean(nextTool));
    setActiveView("Tools");
    const nextPath = pathForTool(nextTool);
    if (currentPathAndSearch() !== nextPath) {
      window.history.pushState({ view: "Tools", tool: nextTool }, "", nextPath);
    }
    setActivityOpen(false);
    setAccountOpen(false);
    setPostOpen(false);
  }

  function handleToolChange(tool: ToolMode) {
    const nextTool = tool === "hub" ? null : tool;
    setRequestedTool(nextTool);
    setToolsImmersive(Boolean(nextTool));
    const nextPath = pathForTool(nextTool);
    if (currentPathAndSearch() === nextPath) return;
    if (nextTool) {
      window.history.pushState({ view: "Tools", tool: nextTool }, "", nextPath);
    } else {
      window.history.replaceState({ view: "Tools" }, "", nextPath);
    }
  }

  async function handleAddCommunityAnswer(postId: string, body: string) {
    const post = communityPosts.find((candidate) => candidate.id === postId);
    if (!post) {
      return;
    }

    let answerToAdd: CommunityPost["replies"][number] = {
      id: `local-answer-${Date.now()}`,
      author: accountProfile.displayName,
      body,
      upvotes: 0,
      downvotes: 0,
      verifiedFix: false,
    };

    if (!isGuest && authUser && onboardingComplete && !postId.startsWith("local-") && !postId.startsWith("prompt-")) {
      const serverAnswer = await createShopTalkAnswer(postId, body);
      if (!serverAnswer) {
        addActivity("Shop Talk answer not saved", "Your answer could not reach the server. Try again when your connection is stable.");
        return;
      }
      answerToAdd = toCommunityAnswerViewModel(serverAnswer);
    }

    setCommunityPosts((current) =>
      current.map((candidate) =>
        candidate.id === postId
          ? {
              ...candidate,
              status: candidate.status === "Needs a pro answer" ? "Open" : candidate.status,
              replies: [answerToAdd, ...candidate.replies],
            }
          : candidate,
      ),
    );
    addActivity(
      "Shop Talk answer posted",
      `${accountProfile.displayName} answered "${post.title}".`,
    );
  }

  async function handleVerifyCommunityAnswer(postId: string, answerId: string) {
    const post = communityPosts.find((candidate) => candidate.id === postId);
    const answer = post?.replies.find((candidate) => candidate.id === answerId);
    if (!post || !answer) {
      return;
    }

    if (!isGuest && authUser && onboardingComplete && !postId.startsWith("local-") && !postId.startsWith("prompt-")) {
      const serverAnswers = await verifyShopTalkAnswer(postId, answerId);
      if (!serverAnswers) {
        addActivity("Verified Fix not saved", "Only the original poster can mark a server-owned verified fix.");
        return;
      }
      setCommunityPosts((current) =>
        current.map((candidate) =>
          candidate.id === postId
            ? {
                ...candidate,
                status: "Verified Fix",
                replies: serverAnswers.map(toCommunityAnswerViewModel),
              }
            : candidate,
        ),
      );
      addActivity(
        "Verified Fix marked",
        `${answer.author}'s answer on "${post.title}" now appears as the trusted fix.`,
      );
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

  async function handleReportCommunityPost(postId: string, reason: CommunityReport["reason"], note?: string) {
    const post = communityPosts.find((candidate) => candidate.id === postId);
    if (!post) {
      return;
    }
    const persisted = await reportShopTalkTarget({
      targetType: "post",
      targetId: postId,
      reasonCode: communityReportReasonCode(reason),
      note: (note ? `${reason}: ${note}` : reason).slice(0, 1000),
    });

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
      persisted ? "Shop Talk report filed" : "Shop Talk report saved locally",
      persisted
        ? `"${post.title}" is in the admin moderation queue for ${reason.toLowerCase()}.`
        : `"${post.title}" was flagged in this session, but the server report could not be filed.`,
    );
  }

  async function handleReportCommunityAnswer(postId: string, answerId: string, reason: CommunityReport["reason"], note?: string) {
    const post = communityPosts.find((candidate) => candidate.id === postId);
    const answer = post?.replies.find((candidate) => candidate.id === answerId);
    if (!post || !answer) return;

    const persisted = await reportShopTalkTarget({
      targetType: "answer",
      targetId: answerId,
      reasonCode: communityReportReasonCode(reason),
      note: (note ? `${reason} on answer for "${post.title}": ${note}` : `${reason} on answer for "${post.title}"`).slice(0, 1000),
    });
    addActivity(
      persisted ? "Shop Talk answer reported" : "Shop Talk answer flagged locally",
      persisted
        ? `An answer from ${answer.author} is in the admin moderation queue for ${reason.toLowerCase()}.`
        : `An answer from ${answer.author} was flagged in this session, but the server report could not be filed.`,
    );
  }

  async function handleReportCommunity(community: CommunityDisplay, reason: CommunityReport["reason"], note?: string) {
    if (!community.id) {
      addActivity(
        "Community report unavailable",
        `${community.name} is not loaded as a server community yet, so it cannot be sent to the admin queue.`,
      );
      return;
    }

    const persisted = await reportShopTalkTarget({
      targetType: "community",
      targetId: community.id,
      reasonCode: communityReportReasonCode(reason),
      note: (note ? `${reason} in ${community.name}: ${note}` : `${reason} in ${community.name}`).slice(0, 1000),
    });
    addActivity(
      persisted ? "Community report filed" : "Community report saved locally",
      persisted
        ? `${community.name} is in the admin moderation queue for ${reason.toLowerCase()}.`
        : `${community.name} was flagged in this session, but the server report could not be filed.`,
    );
  }

  async function handleNewShopTalkPost(
    flair: PostFlair,
    title: string,
    trade: Trade | "General",
    body: string,
    postType: PostType,
    subTrade?: string,
    subLocation?: string,
    subRate?: string,
    communitySlugOverride?: string | null,
    photoFile?: File | null,
  ) {
    const localThumbnailUrl = photoFile ? URL.createObjectURL(photoFile) : undefined;
    const localPost: CommunityPost = {
      id: `local-${Date.now()}`,
      title,
      trade,
      flair,
      author: accountProfile.displayName,
      body,
      upvotes: 0,
      downvotes: 0,
      replies: [],
      createdAt: "Just now",
      sortOrder: Date.now(),
      status: "Open",
      type: postType,
      communitySlug: communitySlugOverride ?? defaultShopTalkCommunitySlug(trade),
      ...(localThumbnailUrl ? { thumbnailUrl: localThumbnailUrl, thumbnailAlt: photoFile?.name ?? title } : {}),
      ...(subTrade ? { subTrade } : {}),
      ...(subLocation ? { subLocation } : {}),
      ...(subRate ? { subRate } : {}),
    };

    let postToAdd = localPost;
    let photoUploadFailed = false;
    if (!isGuest && authUser && onboardingComplete) {
      const serverPost = await createShopTalkPost({
        title,
        body,
        trade,
        flair,
        postType,
        communitySlug: communitySlugOverride ?? undefined,
      });
      if (!serverPost) {
        addActivity(
          "Shop Talk post was not saved",
          "RIVT could not save that post to the server. Nothing was published. Try again in a minute.",
          "error",
        );
        return;
      }
      const mediaPost = photoFile ? await uploadShopTalkPostPhoto(serverPost.id, photoFile) : null;
      photoUploadFailed = Boolean(photoFile && !mediaPost);
      postToAdd = toCommunityPostViewModel(mediaPost ?? serverPost);
    }

    setCommunityPosts((current) => [
      postToAdd,
      ...current.filter((post) => post.id !== postToAdd.id),
    ]);
    addActivity(
      photoUploadFailed ? "Shop Talk post created without photo" : "Shop Talk post created",
      photoUploadFailed
        ? `"${title}" posted, but the photo could not be uploaded. Try editing or reposting with the image.`
        : `"${title}" posted to Shop Talk${photoFile ? " with a photo" : ""}.`,
    );
  }

  async function handleDeleteShopTalkPost(postId: string) {
    const target = communityPosts.find((candidate) => candidate.id === postId);
    const serverOwned = Boolean(target && !target.badge && !postId.startsWith("local-"));
    if (serverOwned && (!isGuest && authUser && onboardingComplete)) {
      const deleted = await deleteShopTalkPost(postId);
      if (!deleted) {
        addActivity("Shop Talk post was not deleted", "RIVT could not remove that post from the server. Try again in a minute.");
        return false;
      }
    } else if (serverOwned) {
      addActivity("Sign in required", "Sign in again before deleting a server-owned Shop Talk post.");
      return false;
    }

    setCommunityPosts((current) => current.filter((post) => post.id !== postId));
    if (shopTalkPostId === postId) setShopTalkPostId(null);
    addActivity("Shop Talk post deleted", target ? `"${target.title}" was removed from the feed.` : "The post was removed from the feed.");
    return true;
  }

  function handleCommunityCreated(community: ServerCommunity) {
    const display = mapServerCommunity(community);
    setCommunities((current) => [
      display,
      ...current.filter((candidate) => candidate.slug !== display.slug),
    ]);
    addActivity("Community created", `${display.name} is ready for posts and local discussion.`);
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
      let transitionTarget = job;
      if (action === "publish" || !Number.isInteger(job.canonical.version) || job.canonical.version < 1) {
        transitionTarget = toJobViewModel(await getJob(job.canonical.id));
      }
      if (!transitionTarget.canonical) throw new Error("This job is missing canonical lifecycle data.");
      const updated = toJobViewModel(await transitionJob(transitionTarget.canonical.id, action, transitionTarget.canonical.version));
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
          onboardingGoal: result.goal,
          topicInterests: result.topicInterests,
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
    setUploadedRecords(() => new Set());
    const postOnboardingView = ({
      home: "Home",
      work: "Work",
      crew: "Crew",
      "shop-talk": "Shop Talk",
      tools: "Tools",
      profile: "Settings",
    } as const satisfies Record<OnboardingResult["preferredStartView"], typeof activeView>)[result.preferredStartView];
    setActiveView(postOnboardingView);
    setOnboardingComplete(true);
    addActivity(
      "Account setup complete",
      `${result.role === "contractor" ? "Contractor" : "Tradesperson"} setup is ready. Opening ${postOnboardingView}.`,
    );
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

  function notificationMetadataValue(notification: InboxNotification, keys: string[]) {
    for (const key of keys) {
      const value = notification.metadata?.[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
    return null;
  }

  function notificationSearchParams(notification: InboxNotification) {
    try {
      const parsed = new URL(notification.actionHref || "/", window.location.origin);
      return parsed.searchParams;
    } catch {
      return new URLSearchParams();
    }
  }

  function notificationRouteText(notification: InboxNotification) {
    return `${notification.type} ${notification.sourceType} ${notification.actionHref}`.toLowerCase();
  }

  async function handleOpenNotification(notification: InboxNotification) {
    const readAt = new Date().toISOString();
    setInboxNotifications((current) => current.map((candidate) => (
      candidate.id === notification.id ? { ...candidate, readAt: candidate.readAt ?? readAt } : candidate
    )));
    void markNotificationsRead([notification.id], false).catch(() => {
      // Navigation is more important than blocking on read-state persistence.
    });

    const params = notificationSearchParams(notification);
    const routeText = notificationRouteText(notification);
    const sourceId = notification.sourceId ?? null;
    const conversationId = notificationMetadataValue(notification, ["conversationId", "conversation_id"]) ??
      params.get("conversation") ??
      params.get("conversationId") ??
      (notification.sourceType === "message" ? sourceId : null);
    const postId = notificationMetadataValue(notification, ["postId", "post_id", "shopTalkPostId"]) ??
      params.get("post") ??
      params.get("postId") ??
      (notification.sourceType === "shop_talk_post" ? sourceId : null);
    const communitySlugValue = notificationMetadataValue(notification, ["communitySlug", "community_slug"]) ??
      params.get("community") ??
      params.get("communitySlug");
    const jobId = notificationMetadataValue(notification, ["jobId", "job_id"]) ??
      params.get("job") ??
      params.get("jobId") ??
      (notification.sourceType === "job" ? sourceId : null);
    const activeWorkId = notificationMetadataValue(notification, ["activeWorkId", "active_work_id"]) ??
      params.get("activeWork") ??
      params.get("activeWorkId") ??
      (notification.sourceType === "active_work" ? sourceId : null);
    const projectId = notificationMetadataValue(notification, ["projectId", "project_id"]) ??
      params.get("project") ??
      params.get("projectId") ??
      (notification.sourceType === "project" ? sourceId : null);

    setActivityOpen(false);
    setAccountOpen(false);

    if (conversationId || routeText.includes("message") || routeText.includes("conversation") || routeText.includes("inbox")) {
      if (conversationId) setSelectedConversationId(conversationId);
      handleNavigate("Messages");
      void reloadInbox();
      return;
    }

    if (routeText.includes("shop-talk") || routeText.includes("community") || routeText.includes("answer")) {
      setShopTalkGlobalQuery("");
      setShopTalkCompose(false);
      setShopTalkAnswerQueue(false);
      setShopTalkCommunitySlug(communitySlugValue ?? null);
      setShopTalkPostId(postId ?? null);
      handleNavigate("Shop Talk");
      return;
    }

    if (routeText.includes("record") || routeText.includes("project") || routeText.includes("photo") || routeText.includes("media") || routeText.includes("tool")) {
      void projectId;
      handleOpenTool("job-photos");
      return;
    }

    if (routeText.includes("support") || routeText.includes("feedback")) {
      handleNavigate("Feedback");
      return;
    }

    if (routeText.includes("profile") || routeText.includes("review") || routeText.includes("account")) {
      handleNavigate(routeText.includes("review") ? "Reviews" : "Settings");
      return;
    }

    if (routeText.includes("work") || routeText.includes("job") || routeText.includes("offer") || activeWorkId || jobId) {
      const match = jobs.find((candidate) => (
        jobId && (candidate.canonical?.id === jobId || String(candidate.id) === jobId)
      ));
      if (match) setSelectedId(match.id);
      handleNavigate("Work");
      void reloadJobs();
      return;
    }

    handleNavigate("Home");
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

  function handleQuizComplete(result: SafetyQuizResult) {
    setSafetyQuizResults((prev) => ({ ...prev, [result.quizId]: result }));
    const quiz = safetyQuizData.find((q) => q.id === result.quizId);
    addActivity(
      result.passed ? "Safety cert earned" : "Quiz complete",
      result.passed
        ? `You passed ${quiz?.title ?? result.quizId}. Certificate saved on this device.`
        : `Score: ${result.score}%. You need 80% to earn the certificate. Try again.`,
      result.passed ? "success" : "info",
    );
  }

  function handleAddShoutOut(to: string, trade: string, message: string) {
    setShoutOuts((prev) => [
      ...prev,
      {
        id: Date.now(),
        from: accountProfile.displayName || "RIVT member",
        to,
        trade: (trade || "General trades") as ShoutOut["trade"],
        message,
        createdAt: new Date().toISOString(),
      },
    ]);
    addActivity("Review posted", `Your shout-out for ${to} was saved to your records.`, "success");
  }

  function handleExitGuest() {
    setIsGuest(false);
    setAuthUser(null);
    setCanonicalAccount(null);
    setOnboardingComplete(false);
    setJobs([]);
    setSelectedId(0);
    setAccountProfile((current) => ({ ...current, displayName: "" }));
  }

  function handleSignUpFromGuest() {
    setAuthMode("signup");
    setIsGuest(false);
    setAuthUser(null);
    setCanonicalAccount(null);
    setOnboardingComplete(false);
    setJobs([]);
    setSelectedId(0);
    setAccountProfile((current) => ({ ...current, displayName: "" }));
  }

  function handleBrowseAsGuest() {
    const previewPreferences = readGuestPreviewPreferences();
    const previewTrade = previewPreferences?.trade ?? "Carpentry";
    const previewLocation = previewPreferences?.location ?? "Jacksonville, FL";
    const previewRole = previewPreferences?.role ?? "contractor";
    setAuthError(null);
    setAuthNotice(null);
    setIsGuest(true);
    setCanonicalAccount(null);
    setAuthUser({
      id: "guest-preview",
      email: "",
      provider: "Email",
      display_name: "Guest",
      role: previewRole,
      organization: "",
      location: previewLocation,
      email_verified: false,
      account_status: "active",
      onboarding_status: "complete",
    });
    setRole(previewRole);
    setAccountProfile((current) => ({
      ...current,
      email: "",
      displayName: "Guest",
      organization: "",
      location: previewLocation,
      specialties: [previewTrade, "Electrical", "Plumbing"].filter((item, index, list) => list.indexOf(item) === index) as Trade[],
      authMethod: "Email",
    }));
    setTrade(previewTrade);
    setLocationQuery(previewLocation);
    setOnboardingComplete(true);
    setActiveView("Home");
    const nextPath = viewRoutes.Home;
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, "", nextPath);
    }
  }

  const page = pageCopy[activeView];
  const primaryOrganizationId = canonicalAccount?.organizations[0]?.id ?? "";
  function openCreateJob() {
    if (isGuest) {
      setGuestPromptOpen(true);
      return;
    }
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
  const homeProfileName = canonicalAccount?.profile.displayName || accountProfile.displayName;
  const homeProfileLocation = canonicalAccount?.profile.locationText
    || [
      canonicalAccount?.profile.serviceArea.city,
      canonicalAccount?.profile.serviceArea.region,
    ].filter(Boolean).join(", ")
    || accountProfile.location;
  const homeProfileTradeCount = canonicalAccount?.profile.trades.length ?? accountProfile.specialties.length;
  const homeProfileHasBasics = Boolean(homeProfileName.trim()) && Boolean(homeProfileLocation.trim()) && homeProfileTradeCount > 0;
  const homeProfileHasBio = Boolean(canonicalAccount?.profile.headline?.trim() || canonicalAccount?.profile.bio?.trim());
  const safetyCertCount = Object.values(safetyQuizResults).filter((result) => result.passed).length;
  if (authLoading) {
    return <LaunchLoader />;
  }

  // Check for report share URL — publicly accessible, no auth needed
  const reportParam = new URLSearchParams(window.location.search).get("report");
  if (reportParam) {
    return <ReportViewer encoded={reportParam} />;
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
        onBrowseAsGuest={handleBrowseAsGuest}
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
        messageCount={unreadMessages}
        isGuest={isGuest}
        mobileNavHidden={toolsImmersive}
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
        onOpenActiveJob={() => handleNavigate("Work")}
        onSearch={(nextQuery, target = "work") => {
          if (target === "shop-talk") {
            setShopTalkGlobalQuery(nextQuery);
            setShopTalkCommunitySlug(null);
            handleNavigate("Shop Talk");
            return;
          }
          if (target === "tools") {
            handleNavigate("Tools");
            return;
          }
          setQuery(nextQuery);
          handleNavigate("Work");
        }}
        onOpenProfileResult={(profileResult) => {
          setProfileSearchFocus(profileResult);
          handleNavigate("Crew");
        }}
      >

        {["Home", "Work", "Crew", "Shop Talk", "Reviews", "Messages", "Tools", "Records", "Trust & Legal", "Safety & Training", "Feedback", "Settings", "Admin"].includes(activeView) ? null : (
          <header className="page-heading" aria-label={`${page.title} heading`}>
            <div>
              <h1>{page.title}</h1>
            </div>
          </header>
        )}

        <RouteErrorBoundary>
        <Suspense fallback={<RouteFallback />}>
        {activeView === "Home" ? (
          <TradeFeed
            posts={communityPosts}
            communities={communities}
            jobs={jobs}
            activeWork={activeWork}
            role={role}
            name={accountProfile.displayName || (isGuest ? "there" : "there")}
            location={accountProfile.location}
            primaryTrade={primaryProfileTrade}
            profileHasBasics={homeProfileHasBasics}
            profileHasBio={homeProfileHasBio}
            onboardingComplete={onboardingComplete}
            recordCount={uploadedRecords.size}
            safetyCertCount={safetyCertCount}
            getPostReactionState={getCommunityPostReactionState}
            onVotePost={handleVoteCommunityPost}
            onOpenPost={(postId) => { setShopTalkPostId(postId); setShopTalkCompose(false); setShopTalkAnswerQueue(false); setShopTalkGlobalQuery(""); handleNavigate(defaultViewForDestination("shop-talk")); }}
            onAsk={() => { setShopTalkPostId(null); setShopTalkAnswerQueue(false); setShopTalkCompose(true); handleNavigate(defaultViewForDestination("shop-talk")); }}
            onOpenAnswerQueue={() => { setShopTalkPostId(null); setShopTalkCompose(false); setShopTalkGlobalQuery(""); setShopTalkCommunitySlug(null); setShopTalkAnswerQueue(true); handleNavigate(defaultViewForDestination("shop-talk")); }}
            onPostWork={openCreateJob}
            onOpenCommunity={(name) => { setShopTalkPostId(null); setShopTalkCompose(false); setShopTalkAnswerQueue(false); setShopTalkGlobalQuery(""); setShopTalkCommunitySlug(communitySlug(name)); handleNavigate(defaultViewForDestination("shop-talk")); }}
            onNavigate={(destination) => handleNavigate(defaultViewForDestination(destination))}
            onOpenProfile={() => handleNavigate("Settings")}
            onOpenTool={handleOpenTool}
          />
        ) : activeView === "Work" ? (
          <WorkWorkspace
            role={role}
            jobs={filteredJobs}
            activeWorkRecords={activeWork}
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
            onOpenTool={handleOpenTool}
            onOpenRecords={() => handleNavigate("Records")}
            onRetry={() => void reloadJobs()}
            onActiveWorkChanged={() => {
              void reloadActiveWork();
              void reloadJobs();
              void reloadInbox();
            }}
          />
        ) : activeView === "Shop Talk" ? (
          <ShopTalkView
            key={`shop-talk-${shopTalkGlobalQuery}-${shopTalkCommunitySlug ?? ""}-${shopTalkPostId ?? ""}-${shopTalkCompose ? "c" : ""}-${shopTalkAnswerQueue ? "answers" : ""}`}
            role={role}
            profile={accountProfile}
            communityPosts={communityPosts}
            communities={communities}
            newsItems={fallbackNewsItems}
            initialQuery={shopTalkGlobalQuery}
            initialPostId={shopTalkPostId}
            initialCommunitySlug={shopTalkCommunitySlug}
            initialAnswerQueue={shopTalkAnswerQueue}
            openComposer={shopTalkCompose}
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
            onReportAnswer={handleReportCommunityAnswer}
            onReportCommunity={handleReportCommunity}
            onNewPost={handleNewShopTalkPost}
            onDeletePost={handleDeleteShopTalkPost}
            onCommunityCreated={handleCommunityCreated}
          />
        ) : ["Crew", "Reviews"].includes(activeView) ? (
          <NetworkHub
            view={activeView as "Crew" | "Reviews"}
            communityPosts={communityPosts}
            shoutOuts={shoutOuts}
            displayName={accountProfile.displayName}
            profileFocus={profileSearchFocus}
            onClearProfileFocus={() => setProfileSearchFocus(null)}
            onOpenCrew={() => handleNavigate("Crew")}
            onOpenShopTalk={() => handleNavigate("Shop Talk")}
            onOpenReviews={() => handleNavigate("Reviews")}
            onAddShoutOut={handleAddShoutOut}
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
            onOpenNotification={(notification) => {
              void handleOpenNotification(notification);
            }}
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
            storageUsage={storageUsage}
            trainingProgress={Math.round((completedTraining.size / trainingModules.length) * 100)}
            safetyCertCount={Object.values(safetyQuizResults).filter((result) => result.passed).length}
            safetyQuizResults={safetyQuizResults}
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
            themeSource={themeSource}
            themePalette={themePalette}
            onToggleTheme={handleToggleTheme}
            onSetThemeSource={handleSetThemeSource}
            onSelectThemePalette={handleSelectThemePalette}
            onLogout={handleLogout}
            onSaveProfile={handleSaveProfile}
            onSetProfileVisibility={handleSetProfileVisibility}
            onCurrentSessionRevoked={handleCurrentSessionRevoked}
            onActivity={addActivity}
            onQuizComplete={handleQuizComplete}
          />
        ) : ["Tools", "Records"].includes(activeView) ? (
          <ToolsStudio
            jobs={jobs}
            paymentRecords={paymentRecords}
            mode={activeView === "Records" ? "records" : "tools"}
            openTool={activeView === "Tools" ? requestedTool ?? "hub" : null}
            onToolChange={handleToolChange}
            onImmersiveChange={setToolsImmersive}
            onNavigate={(destination) => handleNavigate(defaultViewForDestination(destination))}
          />
        ) : activeView === "Admin" ? (
          <ModerationConsole
            adminRoles={canonicalAccount?.adminRoles ?? []}
            onActivity={addActivity}
          />
        ) : (
          <LegacyBridge
            view={activeView as "My Jobs" | "Applications" | "Invites" | "Crew" | "Messages" | "Trust & Legal" | "Records" | "Safety & Training" | "Reviews" | "Feedback" | "Settings" | "Admin" | "Work" | "Home" | "Shop Talk" | "Tools"}
            onNavigate={(view) => handleNavigate(view)}
            onOpenAccount={() => handleNavigate("Settings")}
          />
        )}
        </Suspense>
        </RouteErrorBoundary>
      </AppShell>

      {uiToast && (
        <ActivityToast
          activity={uiToast}
          onDismiss={dismissToast}
        />
      )}

      {isActivityOpen && (
        <ActivityPanel
          items={activityItems}
          onClose={() => setActivityOpen(false)}
          onMarkAllRead={() => {
            markAllActivityRead();
            void handleMarkNotificationsRead();
          }}
          onOpenItem={(item) => {
            const notification = inboxNotifications.find((candidate) => candidate.id === item.id);
            if (notification) void handleOpenNotification(notification);
          }}
          onNavigate={handleNavigate}
        />
      )}

      {isAccountOpen && (
        <AccountPanel
          role={role}
          profile={accountProfile}
          recordCount={uploadedRecords.size}
          recordGoal={recordChecklist.length}
          trainingProgress={Math.round((completedTraining.size / trainingModules.length) * 100)}
          safetyCertCount={Object.values(safetyQuizResults).filter((r) => r.passed).length}
          safetyModuleCount={safetyQuizData.length}
          themeMode={themeMode}
          themeSource={themeSource}
          themePalette={themePalette}
          adminRoles={canonicalAccount?.adminRoles ?? []}
          communityBadges={communityBadgeLabels(communityPosts, accountProfile.displayName)}
          shoutOutCount={
            shoutOuts.filter(
              (shoutOut) =>
                shoutOut.to === accountProfile.displayName ||
                shoutOut.from === accountProfile.organization,
            ).length
          }
          onToggleTheme={handleToggleTheme}
          onSetThemeSource={handleSetThemeSource}
          onSelectThemePalette={handleSelectThemePalette}
          onLogout={handleLogout}
          onClose={() => setAccountOpen(false)}
          onNavigate={handleNavigate}
        />
      )}

      {isPostOpen && primaryOrganizationId ? (
        <RouteErrorBoundary>
          <Suspense fallback={null}>
            <JobEditorModal
              organizationId={primaryOrganizationId}
              job={editingJob}
              defaultLocation={accountProfile.location}
              onClose={() => { setPostOpen(false); setEditingJob(null); }}
              onSaved={handleJobSaved}
            />
          </Suspense>
        </RouteErrorBoundary>
      ) : null}

      {guestPromptOpen && (
        <GuestSignUpPrompt
          onClose={() => setGuestPromptOpen(false)}
          onSignUp={handleSignUpFromGuest}
        />
      )}

      <OfflineBanner />
      {isGuest && localSetupOpen && (
        <LocalSetupPrompt onDone={() => setLocalSetupOpen(false)} />
      )}
    </>
  );
}

export default App;
