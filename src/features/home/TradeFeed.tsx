import { useEffect, useMemo, useState } from "react";
import {
  Circle,
  ClipboardList,
  MessageCircle,
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
import { getProjectForActiveWork, type ProjectRecord } from "../tools/project-api";
import type { GuestPreviewSummary } from "../../demo/guestPreview";
import "./trade-feed.css";

const BOOKMARK_KEY = "rivt.shopTalkBookmarks.v1";
const AVAIL_KEY = "rivt.availability.v1";
const GET_STARTED_DISMISS_KEY = "rivt.homeGetStarted.dismissed.v1";
type Availability = "available" | "limited" | "booked";
const AVAIL_LABEL: Record<Availability, string> = {
  available: "Available this week",
  limited: "Limited availability",
  booked: "Booked up",
};
const AVAIL_ORDER: Availability[] = ["available", "limited", "booked"];
const SETUP_RECORD_BASELINE = 0;

function isToday(iso: string | null | undefined) {
  if (!iso) return false;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  return date.getFullYear() === today.getFullYear()
    && date.getMonth() === today.getMonth()
    && date.getDate() === today.getDate();
}

function isDailyLogEntry(body: string) {
  return body.trimStart().toLowerCase().startsWith("rivt daily log");
}

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
  profileHasBasics: boolean;
  profileHasBio: boolean;
  onboardingComplete?: boolean;
  recordCount: number;
  safetyCertCount: number;
  demoSummary?: GuestPreviewSummary | null;
  getPostReactionState: (post: CommunityPost) => CommunityReactionState;
  onVotePost: (postId: string, direction: "up" | "down") => void;
  onOpenPost: (postId: string) => void;
  onAsk: () => void;
  onPostWork: () => void;
  onOpenCommunity: (name: string) => void;
  onNavigate: (destination: PrimaryDestination) => void;
  onOpenProfile: () => void;
  onOpenTool: (tool: ToolMode) => void;
  onOpenActiveWorkWorkspace: (activeWorkId: string) => void;
}

export function TradeFeed({
  posts,
  communities = fallbackCommunities,
  jobs = [],
  activeWork = [],
  role = "contractor",
  name,
  location,
  profileHasBasics = false,
  profileHasBio = false,
  onboardingComplete = false,
  recordCount = 0,
  safetyCertCount = 0,
  demoSummary = null,
  getPostReactionState,
  onVotePost,
  onOpenPost,
  onAsk,
  onPostWork,
  onOpenCommunity,
  onNavigate,
  onOpenProfile = () => undefined,
  onOpenTool = () => undefined,
  onOpenActiveWorkWorkspace = () => undefined,
}: TradeFeedProps) {
  const [saved, setSaved] = useState<Set<string>>(readBookmarks);
  const [availability, setAvailability] = useState<Availability>(readAvailability);
  const [getStartedDismissed, setGetStartedDismissed] = useState(readGetStartedDismissed);
  const [activeProject, setActiveProject] = useState<ProjectRecord | null>(null);
  const [activeProjectLoading, setActiveProjectLoading] = useState(false);
  const primaryActiveWork = activeWork.find((work) => work.status === "active") ?? activeWork[0] ?? null;

  useEffect(() => {
    let cancelled = false;
    const activeWorkId = primaryActiveWork?.id ?? null;
    if (!activeWorkId || demoSummary) {
      void Promise.resolve().then(() => {
        if (cancelled) return;
        setActiveProject(null);
        setActiveProjectLoading(false);
      });
      return () => { cancelled = true; };
    }

    void Promise.resolve()
      .then(() => {
        if (cancelled) return null;
        setActiveProjectLoading(true);
        return getProjectForActiveWork(activeWorkId);
      })
      .then((project) => {
        if (!cancelled && project) setActiveProject(project);
      })
      .catch(() => {
        // The workspace remains usable when an anonymous preview or a brief
        // network interruption cannot read the private project timeline.
        if (!cancelled) setActiveProject(null);
      })
      .finally(() => {
        if (!cancelled) setActiveProjectLoading(false);
      });

    return () => { cancelled = true; };
  }, [demoSummary, primaryActiveWork?.id]);

  const activeWorkPulse = useMemo(() => {
    if (!primaryActiveWork) return null;
    if (activeProjectLoading) return { state: "loading" as const, label: "Loading today’s work" };
    if (!activeProject) return { state: "unavailable" as const, label: "Open the workspace for today’s record" };

    const dailyLogSaved = activeProject.entries.some((entry) => entry.entryType === "note" && isToday(entry.createdAt) && isDailyLogEntry(entry.body));
    const photoCount = activeProject.media.filter((media) => media.status === "stored").length;
    const completionPending = activeProject.status === "completion_submitted";

    if (completionPending) return { state: "completion" as const, label: "Completion is waiting for review" };
    if (dailyLogSaved) return {
      state: "complete" as const,
      label: `${photoCount ? `${photoCount} photo${photoCount === 1 ? "" : "s"} on record · ` : ""}Daily log saved today`,
    };
    return {
      state: "due" as const,
      label: photoCount ? `${photoCount} photo${photoCount === 1 ? "" : "s"} on record · Add today’s log` : "No log yet today",
    };
  }, [activeProject, activeProjectLoading, primaryActiveWork]);

  const trendingPosts = useMemo(
    () => [...posts].sort((a, b) => netScore(b) - netScore(a)),
    [posts],
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
    <div className={`${showGetStarted ? "trade-feed has-start-card" : "trade-feed"}${demoSummary ? " is-demo" : ""}`}>
      {/* Personalized header */}
      {demoSummary ? (
        <section className="trade-feed-demo" aria-labelledby="trade-feed-demo-title">
          <div className="trade-feed-demo-labels">
            <span>{demoSummary.roleLabel}</span>
            <small>Clearly labeled sample data</small>
          </div>
          <div className="trade-feed-demo-copy">
            <span>{demoSummary.accountAge}</span>
            <h1 id="trade-feed-demo-title">{demoSummary.headline}</h1>
            <p>{demoSummary.body}</p>
          </div>
          <div className="trade-feed-demo-metrics" aria-label="Sample account results">
            <article><strong>{demoSummary.completedJobs}</strong><span>completed jobs</span></article>
            <article><strong>${demoSummary.moneyValue.toLocaleString()}</strong><span>{demoSummary.moneyLabel}</span></article>
            <article><strong>{demoSummary.photoCount}</strong><span>job records</span></article>
            <article><strong>{demoSummary.repeatConnections}</strong><span>{role === "contractor" ? "repeat crew" : "repeat contractors"}</span></article>
          </div>
          <div className="trade-feed-demo-foot">
            <button type="button" className="v2-secondary-button" onClick={onOpenProfile}>View sample profile</button>
            <span>{demoSummary.reputation}</span>
          </div>
        </section>
      ) : (
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
      )}

      {primaryActiveWork ? (
        <section className="trade-feed-active-work" aria-label="Active work">
          <div className="trade-feed-active-copy">
            <span>You're active now</span>
            <h2>{primaryActiveWork.job?.title ?? "Accepted work"}</h2>
            <p>Everything for this job is in one workspace.</p>
            {activeWorkLocation(primaryActiveWork) ? <small>{activeWorkLocation(primaryActiveWork)}</small> : null}
            {activeWorkPulse ? (
              <div className={`trade-feed-work-pulse is-${activeWorkPulse.state}`} aria-live="polite">
                <Circle size={9} fill="currentColor" aria-hidden="true" />
                <span>{activeWorkPulse.label}</span>
              </div>
            ) : null}
          </div>
          <div className="trade-feed-active-actions">
            <button type="button" className="v2-primary-button" onClick={() => onOpenActiveWorkWorkspace(primaryActiveWork.id)}>
              Open workspace
            </button>
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
