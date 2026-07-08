import { useEffect, useMemo, useState } from "react";
import {
  Camera,
  Clock3,
  ChevronRight,
  Circle,
  ClipboardList,
  FileText,
  MessageCircle,
  SignalLow,
  Plus,
  TrendingUp,
  X,
} from "lucide-react";
import type { CommunityPost } from "../shop-talk/ShopTalkView";
import type { CommunityReactionState } from "../shop-talk/ShopTalkView";
import { TradePostCard } from "../shop-talk/TradePostCard";
import type { PrimaryDestination } from "../../app-shell/types";
import { fallbackCommunities, type CommunityDisplay } from "../shop-talk/community-directory";
import type { Job, Role } from "../../types";
import type { CanonicalActiveWork } from "../work/job-api";
import type { ToolMode } from "../tools/ToolsStudio";
import "./trade-feed.css";

const BOOKMARK_KEY = "rivt.shopTalkBookmarks.v1";
const AVAIL_KEY = "rivt.availability.v1";
const GET_STARTED_DISMISS_KEY = "rivt.homeGetStarted.dismissed.v1";
const RECENT_TOOLS_KEY = "rivt.recentTools.v1";
const DEVICE_DRAFT_KEYS = [
  "rivt.dailyLogDraft.v1",
  "rivt.bids.v1",
  "rivt.expenses.v1",
  "rivt.timeSessions.v1",
  "rivt.mileage.v1",
  "rivt.payments.v1",
  "rivt.dailyReports.v1",
];
type Availability = "available" | "limited" | "booked";
const AVAIL_LABEL: Record<Availability, string> = {
  available: "Available this week",
  limited: "Limited availability",
  booked: "Booked up",
};
const AVAIL_ORDER: Availability[] = ["available", "limited", "booked"];
const SETUP_RECORD_BASELINE = 0;
const RECENT_TOOL_LABELS: Partial<Record<ToolMode, string>> = {
  calculator: "Calculator",
  invoice: "Invoice",
  estimate: "Estimate",
  "daily-log": "Daily log",
  "job-photos": "Records & photos",
  "expense-logger": "Expenses",
  "time-tracker": "Time tracker",
  mileage: "Mileage",
  materials: "Materials",
  payments: "Payments",
};

function formatCommunityCardCount(memberCount: number) {
  if (memberCount <= 0) return "";
  return `${memberCount} member${memberCount === 1 ? "" : "s"}`;
}

function activeWorkLocation(work: CanonicalActiveWork) {
  const location = work.job?.publicLocation;
  if (!location?.city && !location?.region) return "";
  return [location.city, location.region].filter(Boolean).join(", ");
}

function netScore(post: CommunityPost) {
  return post.upvotes - post.downvotes;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function readBookmarks(): Set<string> {
  try { return new Set((JSON.parse(localStorage.getItem(BOOKMARK_KEY) ?? "[]") as Array<string | number>).map(String)); }
  catch { return new Set(); }
}
function readAvailability(): Availability {
  try {
    const v = localStorage.getItem(AVAIL_KEY);
    if (v === "available" || v === "limited" || v === "booked") return v;
  } catch { /* ignore */ }
  return "available";
}

function readGetStartedDismissed(): boolean {
  try { return localStorage.getItem(GET_STARTED_DISMISS_KEY) === "1"; }
  catch { return false; }
}

function readRecentTools(): ToolMode[] {
  try {
    const stored = localStorage.getItem(RECENT_TOOLS_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((tool): tool is ToolMode => typeof tool === "string").slice(0, 3);
  } catch {
    return [];
  }
}

function hasStoredValue(raw: string | null) {
  if (!raw) return false;
  const trimmed = raw.trim();
  return trimmed.length > 0 && trimmed !== "[]" && trimmed !== "{}" && trimmed !== "null";
}

function readDeviceToolStateCount() {
  try {
    return DEVICE_DRAFT_KEYS.reduce((count, key) => (
      hasStoredValue(localStorage.getItem(key)) ? count + 1 : count
    ), 0);
  } catch {
    return 0;
  }
}

type StartStep = {
  id: string;
  title: string;
  done: boolean;
  actionLabel: string;
  onAction: () => void;
};

interface TradeFeedProps {
  posts: CommunityPost[];
  communities?: CommunityDisplay[];
  jobs: Job[];
  activeWork?: CanonicalActiveWork[];
  role: Role;
  name: string;
  location: string;
  primaryTrade: string;
  unreadMessages?: number;
  profileHasBasics: boolean;
  profileHasBio: boolean;
  onboardingComplete?: boolean;
  recordCount: number;
  safetyCertCount: number;
  getPostReactionState: (post: CommunityPost) => CommunityReactionState;
  onVotePost: (postId: string, direction: "up" | "down") => void;
  onOpenPost: (postId: string) => void;
  onAsk: () => void;
  onOpenAnswerQueue: () => void;
  onPostWork: () => void;
  onOpenCommunity: (name: string) => void;
  onNavigate: (destination: PrimaryDestination) => void;
  onOpenProfile: () => void;
  onOpenTool: (tool: ToolMode) => void;
  onOpenActiveWorkWorkspace: (activeWorkId: string) => void;
  onOpenActiveWorkMessages: (activeWorkId: string) => void;
  onOpenActiveWorkTool: (activeWorkId: string, tool: ToolMode) => void;
}

export function TradeFeed({
  posts,
  communities = fallbackCommunities,
  jobs = [],
  activeWork = [],
  role = "contractor",
  name,
  location,
  primaryTrade,
  unreadMessages = 0,
  profileHasBasics = false,
  profileHasBio = false,
  onboardingComplete = false,
  recordCount = 0,
  safetyCertCount = 0,
  getPostReactionState,
  onVotePost,
  onOpenPost,
  onAsk,
  onOpenAnswerQueue,
  onPostWork,
  onOpenCommunity,
  onNavigate,
  onOpenProfile = () => undefined,
  onOpenTool = () => undefined,
  onOpenActiveWorkWorkspace = () => undefined,
  onOpenActiveWorkMessages,
  onOpenActiveWorkTool,
}: TradeFeedProps) {
  const [saved, setSaved] = useState<Set<string>>(readBookmarks);
  const [availability, setAvailability] = useState<Availability>(readAvailability);
  const [getStartedDismissed, setGetStartedDismissed] = useState(readGetStartedDismissed);
  const [recentTools, setRecentTools] = useState<ToolMode[]>(readRecentTools);
  const [deviceToolStateCount, setDeviceToolStateCount] = useState(readDeviceToolStateCount);
  const [isOnline, setIsOnline] = useState(() => (typeof window === "undefined" ? true : window.navigator.onLine));
  const primaryActiveWork = activeWork.find((work) => work.status === "active") ?? activeWork[0] ?? null;

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const syncDeviceState = () => {
      setRecentTools(readRecentTools());
      setDeviceToolStateCount(readDeviceToolStateCount());
      setIsOnline(window.navigator.onLine);
    };
    syncDeviceState();
    window.addEventListener("focus", syncDeviceState);
    window.addEventListener("online", syncDeviceState);
    window.addEventListener("offline", syncDeviceState);
    window.addEventListener("storage", syncDeviceState);
    document.addEventListener("visibilitychange", syncDeviceState);
    return () => {
      window.removeEventListener("focus", syncDeviceState);
      window.removeEventListener("online", syncDeviceState);
      window.removeEventListener("offline", syncDeviceState);
      window.removeEventListener("storage", syncDeviceState);
      document.removeEventListener("visibilitychange", syncDeviceState);
    };
  }, []);

  const trendingPosts = useMemo(
    () => [...posts].sort((a, b) => netScore(b) - netScore(a)),
    [posts],
  );

  // Questions in the user's trade that still need an answer — a real, personal nudge.
  const tradeQuestions = useMemo(
    () => posts.filter((p) => (p.trade === primaryTrade || p.trade === "General") && p.status !== "Verified Fix").length,
    [posts, primaryTrade],
  );

  const getStartedSteps = useMemo<StartStep[]>(() => {
    const normalizedName = name.trim().toLowerCase();
    const hasPostedOrDraftedWork = jobs.some((job) => job.status !== "Closed" && job.status !== "Paid / Closed");
    const hasOpenWork = jobs.some((job) => ["Open", "Shortlisting", "Scheduled"].includes(job.status));
    const hasJoinedCommunity = communities.some((community) => community.joined);
    const hasAuthoredPost = normalizedName.length > 0 && posts.some((post) => post.author.trim().toLowerCase() === normalizedName);
    const hasFieldProof = recordCount > SETUP_RECORD_BASELINE || safetyCertCount > 0;
    const openFirstCommunity = () => {
      const target = communities.find((community) => !community.joined)?.name ?? communities[0]?.name;
      if (target) onOpenCommunity(target);
      else onNavigate("shop-talk");
    };

    if (role === "contractor") {
      return [
        {
          id: "post-work",
          title: "Post or draft your first job",
          done: hasPostedOrDraftedWork,
          actionLabel: "Post work",
          onAction: onPostWork,
        },
        {
          id: "service-area",
          title: "Set your company basics",
          done: profileHasBasics,
          actionLabel: "Edit profile",
          onAction: onOpenProfile,
        },
        {
          id: "community",
          title: "Follow one trade community",
          done: hasJoinedCommunity,
          actionLabel: "Find communities",
          onAction: openFirstCommunity,
        },
        {
          id: "ask-trades",
          title: "Start a Shop Talk post",
          done: hasAuthoredPost,
          actionLabel: "Ask",
          onAction: onAsk,
        },
        {
          id: "invoice",
          title: "Try the invoice tool",
          done: hasFieldProof,
          actionLabel: "Open invoice",
          onAction: () => onOpenTool("invoice"),
        },
      ];
    }

    return [
      {
        id: "trade-basics",
        title: "Confirm your trade and location",
        done: profileHasBasics,
        actionLabel: "Edit profile",
        onAction: onOpenProfile,
      },
      {
        id: "bio",
        title: "Add a short work bio",
        done: profileHasBio,
        actionLabel: "Add bio",
        onAction: onOpenProfile,
      },
      {
        id: "work-feed",
        title: "Check local work",
        done: hasOpenWork,
        actionLabel: "Open Work",
        onAction: () => onNavigate("work"),
      },
      {
        id: "community",
        title: "Join one trade community",
        done: hasJoinedCommunity,
        actionLabel: "Find communities",
        onAction: openFirstCommunity,
      },
      {
        id: "proof",
        title: "Add proof of your work",
        done: hasFieldProof,
        actionLabel: "Open daily log",
        onAction: () => onOpenTool("daily-log"),
      },
    ];
  }, [
    communities,
    jobs,
    name,
    onAsk,
    onNavigate,
    onOpenCommunity,
    onOpenProfile,
    onOpenTool,
    onPostWork,
    posts,
    profileHasBasics,
    profileHasBio,
    recordCount,
    role,
    safetyCertCount,
  ]);

  const completedGetStartedSteps = getStartedSteps.filter((step) => step.done).length;
  const nextGetStartedStep = getStartedSteps.find((step) => !step.done) ?? null;
  const showGetStarted = !onboardingComplete && !getStartedDismissed && Boolean(nextGetStartedStep);
  const showPickup = onboardingComplete && (
    unreadMessages > 0
    || recentTools.length > 0
    || deviceToolStateCount > 0
    || !isOnline
  );

  function toggleSave(id: string) {
    setSaved((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try { localStorage.setItem(BOOKMARK_KEY, JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  }

  function cycleAvailability() {
    setAvailability((prev) => {
      const next = AVAIL_ORDER[(AVAIL_ORDER.indexOf(prev) + 1) % AVAIL_ORDER.length];
      try { localStorage.setItem(AVAIL_KEY, next); } catch { /* ignore */ }
      return next;
    });
  }

  function dismissGetStarted() {
    setGetStartedDismissed(true);
    try { localStorage.setItem(GET_STARTED_DISMISS_KEY, "1"); } catch { /* ignore */ }
  }

  return (
    <div className={showGetStarted ? "trade-feed has-start-card" : "trade-feed"}>
      {/* Personalized header */}
      <header className="trade-feed-welcome">
        <div className="trade-feed-welcome-text">
          <h1>{greeting()}, {name}</h1>
          {location && <span>{location}</span>}
        </div>
        <button
          type="button"
          className={`trade-feed-avail is-${availability}`}
          onClick={cycleAvailability}
          aria-label={`Availability: ${AVAIL_LABEL[availability]}. Tap to change.`}
        >
          <span className="trade-feed-avail-dot" />
          {AVAIL_LABEL[availability]}
        </button>
      </header>

      {primaryActiveWork ? (
        <section className="trade-feed-active-work" aria-label="Active work">
          <div className="trade-feed-active-copy">
            <span>You're active now</span>
            <h2>{primaryActiveWork.job?.title ?? "Accepted work"}</h2>
            <p>
              Offer accepted. Messages, photos, and daily logs stay tied to this job.
            </p>
            {activeWorkLocation(primaryActiveWork) ? <small>{activeWorkLocation(primaryActiveWork)}</small> : null}
          </div>
          <div className="trade-feed-active-actions">
            <button type="button" className="v2-primary-button" onClick={() => onOpenActiveWorkWorkspace(primaryActiveWork.id)}>
              Open workspace
            </button>
            <button
              type="button"
              className="v2-secondary-button"
              onClick={() => onOpenActiveWorkMessages(primaryActiveWork.id)}
            >
              <MessageCircle size={15} />
              Messages
            </button>
            <button
              type="button"
              className="v2-secondary-button"
              onClick={() => onOpenActiveWorkTool(primaryActiveWork.id, "job-photos")}
            >
              <Camera size={15} />
              Photos
            </button>
            <button
              type="button"
              className="v2-secondary-button"
              onClick={() => onOpenActiveWorkTool(primaryActiveWork.id, "daily-log")}
            >
              <FileText size={15} />
              Daily log
            </button>
          </div>
        </section>
      ) : null}

      {showPickup ? (
        <section className="trade-feed-pickup" aria-labelledby="trade-feed-pickup-title">
          <div className="trade-feed-section-head trade-feed-pickup-head">
            <h2 id="trade-feed-pickup-title">Pick up where you left off</h2>
          </div>
          <div className="trade-feed-pickup-list">
            {unreadMessages > 0 ? (
              <button type="button" className="trade-feed-pickup-row" onClick={() => onNavigate("messages")}>
                <span className="trade-feed-pickup-icon">
                  <MessageCircle size={18} />
                </span>
                <span className="trade-feed-pickup-copy">
                  <strong>{unreadMessages} unread message{unreadMessages === 1 ? "" : "s"}</strong>
                  <small>Open the latest conversation and keep the job moving.</small>
                </span>
                <ChevronRight size={18} />
              </button>
            ) : null}

            {recentTools.length > 0 ? (
              <div className="trade-feed-pickup-row trade-feed-pickup-row-static">
                <span className="trade-feed-pickup-icon">
                  <Clock3 size={18} />
                </span>
                <span className="trade-feed-pickup-copy">
                  <strong>Recent tools</strong>
                  <small>Jump back into the tools you've been using on this phone.</small>
                </span>
                <div className="trade-feed-pickup-chip-row">
                  {recentTools.map((tool) => (
                    <button
                      key={tool}
                      type="button"
                      className="trade-feed-pickup-chip"
                      onClick={() => onOpenTool(tool)}
                    >
                      {RECENT_TOOL_LABELS[tool] ?? tool}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {!isOnline || deviceToolStateCount > 0 ? (
              <button type="button" className="trade-feed-pickup-row" onClick={() => onNavigate("tools")}>
                <span className="trade-feed-pickup-icon">
                  <SignalLow size={18} />
                </span>
                <span className="trade-feed-pickup-copy">
                  <strong>{!isOnline ? "You're offline" : "Saved on this phone"}</strong>
                  <small>
                    {!isOnline
                      ? "New tool changes stay on this phone until service returns."
                      : `${deviceToolStateCount} tool workspace${deviceToolStateCount === 1 ? "" : "s"} still live on this device.`}
                  </small>
                </span>
                <ChevronRight size={18} />
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* Getting-started checklist */}
      {showGetStarted && (
        <section className="trade-feed-start-card" aria-labelledby="trade-feed-start-title">
          <div className="trade-feed-start-top">
            <span className="trade-feed-start-icon" aria-hidden="true">
              <ClipboardList size={19} />
            </span>
            <div className="trade-feed-start-copy">
              <p className="trade-feed-start-kicker">
                {role === "contractor" ? "Contractor setup" : "Tradesperson setup"}
              </p>
              <h2 id="trade-feed-start-title">Get RIVT working for you</h2>
              <span>{completedGetStartedSteps} of {getStartedSteps.length} done</span>
            </div>
            <button
              type="button"
              className="trade-feed-start-dismiss"
              onClick={dismissGetStarted}
              aria-label="Hide getting started checklist"
            >
              <X size={17} />
            </button>
          </div>
          <div className="trade-feed-start-progress" aria-hidden="true">
            <span style={{ width: `${(completedGetStartedSteps / getStartedSteps.length) * 100}%` }} />
          </div>
          {nextGetStartedStep ? (
            <div className="trade-feed-start-list">
              <article className="trade-feed-start-item">
                <span className="trade-feed-start-check" aria-hidden="true">
                  <Circle size={19} />
                </span>
                <div className="trade-feed-start-item-copy">
                  <strong>{nextGetStartedStep.title}</strong>
                </div>
                <button type="button" className="trade-feed-start-action" onClick={nextGetStartedStep.onAction}>
                  {nextGetStartedStep.actionLabel}
                </button>
              </article>
            </div>
          ) : null}
        </section>
      )}

      {/* Answer-queue nudge */}
      {tradeQuestions > 0 && (
        <button type="button" className="trade-feed-nudge" onClick={onOpenAnswerQueue}>
          <span className="trade-feed-nudge-icon"><MessageCircle size={18} /></span>
          <span className="trade-feed-nudge-copy">
            <b>{tradeQuestions} {primaryTrade} question{tradeQuestions === 1 ? "" : "s"} need a hand</b>
            <small>Answer one to build your reputation</small>
          </span>
          <ChevronRight size={18} />
        </button>
      )}

      {/* Communities */}
      <div className="trade-feed-communities">
        <div className="trade-feed-section-head">
          <h2>Communities</h2>
          <button type="button" className="trade-feed-seeall" onClick={() => onNavigate("shop-talk")}>
            See all
          </button>
        </div>
        <div className="trade-feed-community-row">
          {communities.map((c) => {
            const Icon = c.icon;
            return (
              <button
                key={c.name}
                type="button"
                className="trade-feed-community-card"
                onClick={() => onOpenCommunity(c.name)}
              >
                <span className="trade-feed-community-icon">
                  <Icon size={22} strokeWidth={2.4} />
                </span>
                <span className="trade-feed-community-name">{c.name}</span>
                {formatCommunityCardCount(c.memberCount) ? (
                  <span className="trade-feed-community-count">{formatCommunityCardCount(c.memberCount)}</span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* Trending feed */}
      <div className="trade-feed-section-head trade-feed-trending-head">
        <h2><TrendingUp size={18} /> Trending in the trades</h2>
        <button type="button" className="trade-feed-seeall" onClick={() => onNavigate("shop-talk")}>
          See all
        </button>
      </div>

      <div className="trade-feed-list">
        {trendingPosts.length === 0 ? (
          <div className="trade-feed-empty">
            <MessageCircle size={26} />
            <b>No posts yet</b>
            <span>Use Ask to start one.</span>
          </div>
        ) : (
          trendingPosts.map((post) => (
            <TradePostCard
              key={post.id}
              post={post}
              reactionState={getPostReactionState(post)}
              saved={saved.has(post.id)}
              onToggleSave={() => toggleSave(post.id)}
              onVote={(direction) => onVotePost(post.id, direction)}
              onOpen={() => onOpenPost(post.id)}
            />
          ))
        )}
      </div>

      <button
        type="button"
        className="trade-feed-fab"
        onClick={role === "contractor" ? onPostWork : onAsk}
        aria-label={role === "contractor" ? "Post work" : "Ask"}
      >
        <Plus size={20} />
        <span className="trade-feed-fab-label">{role === "contractor" ? "Post work" : "Ask"}</span>
      </button>
    </div>
  );
}
