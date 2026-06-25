import {
  Component,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState } from "react";
import { talent } from "./data";
import { brandConfig } from "./brandConfig";
import type { ApplicationRecord, Job, JobId, Role, Trade } from "./types";
import { AppShell } from "./app-shell/AppShell";
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
} from "./app-shell/preferences";
import { useAppTheme } from "./app-shell/useAppTheme";
import { useActivityFeed } from "./app-shell/useActivityFeed";
import { getJob, listJobs, toJobViewModel, transitionJob } from "./features/work/job-api";
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
} from "./features/shop-talk/ShopTalkView";
import { communityBadgeLabels } from "./features/shop-talk/community-utils";
import { communityPromptPosts, fallbackNewsItems } from "./features/shop-talk/fallback-data";
import { useCommunityReactions } from "./features/shop-talk/useCommunityReactions";
import type { ProfileUpdateInput } from "./features/profile/ProfileHub";
import { recordChecklist, safetyQuizData, trainingModules, type SafetyQuizResult } from "./features/profile/training-data";
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

const HomeDashboard = lazy(() => import("./features/home/HomeDashboard").then((m) => ({ default: m.HomeDashboard })));
const WorkWorkspace = lazy(() => import("./features/work/WorkWorkspace").then((m) => ({ default: m.WorkWorkspace })));
const JobEditorModal = lazy(() => import("./features/work/JobEditorModal").then((m) => ({ default: m.JobEditorModal })));
const NetworkHub = lazy(() => import("./features/network/NetworkHub").then((m) => ({ default: m.NetworkHub })));
const InboxCenter = lazy(() => import("./features/inbox/InboxCenter").then((m) => ({ default: m.InboxCenter })));
const ShopTalkView = lazy(() => import("./features/shop-talk/ShopTalkView").then((m) => ({ default: m.ShopTalkView })));
const ProfileRoute = lazy(() => import("./features/profile/ProfileRoute").then((m) => ({ default: m.ProfileRoute })));
const ToolsStudio = lazy(() => import("./features/tools/ToolsStudio").then((m) => ({ default: m.ToolsStudio })));
const LegacyBridge = lazy(() => import("./features/legacy/LegacyBridge").then((m) => ({ default: m.LegacyBridge })));

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
  const [safetyQuizResults, setSafetyQuizResults] = useState<Record<string, SafetyQuizResult>>({});
  const [feedbackItems] = useState<FeedbackItem[]>([]);
  const [paymentRecords] = useState<PaymentRecord[]>([]);
  const [communityPosts, setCommunityPosts] = useState<CommunityPost[]>(communityPromptPosts);
  const [, setCommunityReports] = useState<CommunityReport[]>([]);
  const [shoutOuts, setShoutOuts] = useState<ShoutOut[]>([]);
  const {
    handleSelectThemePalette,
    handleToggleTheme,
    themeMode,
    themePalette,
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
  const [isGuest, setIsGuest] = useState(false);
  const [guestPromptOpen, setGuestPromptOpen] = useState(false);
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
          resetCommunityReactions();
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
  }, [applyCanonicalAccount, resetCommunityReactions]);

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

  // Poll inbox every 30 seconds while authenticated
  useEffect(() => {
    if (!authUser || !onboardingComplete) return;
    const interval = window.setInterval(() => { void reloadInbox(); }, 30000);
    return () => window.clearInterval(interval);
  }, [authUser, onboardingComplete, reloadInbox]);

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
      "Notification" in window &&
      Notification.permission === "granted" &&
      activeView !== "Messages"
    ) {
      new Notification("RIVT — new message", {
        body: `You have ${unread} unread message${unread === 1 ? "" : "s"}`,
        icon: "/favicon.ico",
      });
    }
    prevUnreadRef.current = unread;
  }, [inboxConversations, activeView]);

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
    setActiveView(view);
    const nextPath = viewRoutes[view];
    if (window.location.pathname !== nextPath) {
      window.history.pushState({ view }, "", nextPath);
    }
    setActivityOpen(false);
    setAccountOpen(false);
    setPostOpen(false);
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

  function handleQuizComplete(result: SafetyQuizResult) {
    setSafetyQuizResults((prev) => ({ ...prev, [result.quizId]: result }));
    const quiz = safetyQuizData.find((q) => q.id === result.quizId);
    addActivity(
      result.passed ? "Safety cert earned" : "Quiz complete",
      result.passed
        ? `You passed ${quiz?.title ?? result.quizId}. Certificate added to your safety record.`
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
    addActivity("Review posted", `Your shout-out for ${to} is now part of their crew record.`, "success");
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

        <RouteErrorBoundary>
        <Suspense fallback={<RouteFallback />}>
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
            newsCount={fallbackNewsItems.length}
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
            newsItems={fallbackNewsItems}
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
            view={activeView as "My Crew" | "Reviews"}
            jobs={jobs}
            talent={matchingTalent}
            communityPosts={communityPosts}
            shoutOuts={shoutOuts}
            displayName={accountProfile.displayName}
            onOpenCrew={() => handleNavigate("My Crew")}
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
            themePalette={themePalette}
            onToggleTheme={handleToggleTheme}
            onSelectThemePalette={handleSelectThemePalette}
            onLogout={handleLogout}
            onSaveProfile={handleSaveProfile}
            onSetProfileVisibility={handleSetProfileVisibility}
            onCurrentSessionRevoked={handleCurrentSessionRevoked}
            onActivity={addActivity}
            onQuizComplete={handleQuizComplete}
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
    </>
  );
}

export default App;
