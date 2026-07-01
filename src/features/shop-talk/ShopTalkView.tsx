import { type CSSProperties, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Award,
  BadgeCheck,
  Bookmark,
  BookmarkCheck,
  Briefcase,
  Building2,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  Flag,
  Hammer,
  Hash,
  MessageCircle,
  Newspaper,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  ThumbsDown,
  ThumbsUp,
  Users,
  Wrench,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { TradePostCard } from "./TradePostCard";
import { tradeOptions } from "../../data";
import type { Trade } from "../../types";
import { usePersona } from "../persona/usePersona";
import {
  communityBadgeLabels,
  netScore,
  sortedAnswers,
  type CommunityBadgeThresholds,
} from "./community-utils";
import { apiPath } from "../../lib/api";
import "./shop-talk.css";

interface AccountProfile {
  displayName: string;
  specialties: Trade[];
}

export interface NewsItem {
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

export interface CommunityAnswer {
  id: number;
  author: string;
  body: string;
  upvotes: number;
  downvotes: number;
  verifiedFix: boolean;
}

export type PostType = "question" | "sub-request" | "safety" | "general";

export interface ShopTalkReply {
  id: string;
  author: string;
  text: string;
  createdAt: string;
}

export interface CommunityPost {
  id: number;
  title: string;
  trade: Trade | "General";
  author: string;
  badge?: "Community Prompt" | "Recommendation";
  flair?: "Question" | "Discussion" | "Code Talk" | "Compliance" | "Tip" | "Humor";
  body: string;
  upvotes: number;
  downvotes: number;
  helpfulVotes?: number;
  commentCount?: number;
  replies: CommunityAnswer[];
  createdAt: string;
  status: "Open" | "Verified Fix" | "Needs a pro answer";
  type?: PostType;
  subTrade?: string;
  subLocation?: string;
  subRate?: string;
}

export type PostFlair = "Question" | "Discussion" | "Code Talk" | "Compliance" | "Tip" | "Humor";
export type CommunityReaction = "up" | "down";

export interface CommunityReactionSummary {
  reactionsGiven: number;
  upvotesGiven: number;
  downvotesGiven: number;
  targetsReacted: number;
  lastReactedAt: string | null;
}

export interface CommunityReactionState {
  upvotes: number;
  downvotes: number;
  reaction: CommunityReaction | null;
  serverOwned: boolean;
  pending: boolean;
}

export type CommunityReactionSyncStatus = "idle" | "loading" | "ready" | "error";

export interface CommunityReport {
  id: number;
  postId: number;
  postTitle: string;
  reason: "Misinformation" | "Safety concern" | "Spam" | "Harassment";
  status: "Flagged" | "Cleared" | "Hidden" | "Removed" | "Warned";
}

const specialtyOptions = tradeOptions.filter((trade): trade is Trade => trade !== "All trades");

const PREDEFINED_TAGS = ["#electrical", "#plumbing", "#hvac", "#permits", "#safety", "#tools", "#osha", "#framing", "#roofing"];

const communityBadgeThresholds: CommunityBadgeThresholds = {
  firstAssistVerifiedFixes: 1,
  mentorQualityAnswers: 3,
  topHandQualityAnswers: 8,
};

function isFallbackNewsThumbnail(item: Pick<NewsItem, "thumbnailUrl" | "thumbnailKind">) {
  return item.thumbnailKind === "fallback" || !item.thumbnailUrl || item.thumbnailUrl.startsWith("/news/");
}

function newsSourceInitials(source: string) {
  const words = source
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3);
  const initials = words.map((word) => word[0]).join("").toUpperCase();
  return initials || "R";
}

function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="empty-state">
      <Icon size={22} />
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
      {actionLabel && onAction ? (
        <button type="button" className="secondary-action" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

const FLAIR_CONFIG: Record<PostFlair, { color: string; description: string }> = {
  "Question": { color: "#e8a857", description: "Looking for a specific answer" },
  "Discussion": { color: "#6b9fd4", description: "Open conversation, multiple perspectives" },
  "Code Talk": { color: "#7ac27a", description: "Building codes, inspections, compliance details" },
  "Compliance": { color: "#d47a7a", description: "Licensing, permits, legal requirements" },
  "Tip": { color: "#a87ac2", description: "Share a field technique or shortcut" },
  "Humor": { color: "#888", description: "Keep it trade-relevant" },
};

const POST_TYPE_CHIPS: { type: PostType; emoji: string; label: string }[] = [
  { type: "question", emoji: "❓", label: "Question" },
  { type: "sub-request", emoji: "🔧", label: "Looking for Sub" },
  { type: "safety", emoji: "⚠️", label: "Safety Alert" },
  { type: "general", emoji: "💬", label: "General" },
];

const TRADE_TALK_COMMUNITIES: {
  name: string;
  meta: string;
  count: string;
  icon: LucideIcon;
  tone: string;
}[] = [
  { name: "Carpentry Talk", meta: "Trim, framing, punch-out", count: "124K", icon: Hammer, tone: "#7a4a24" },
  { name: "Electrical Talk", meta: "Code, service, rough-in", count: "98K", icon: Zap, tone: "#1c1c1c" },
  { name: "Jacksonville Trades", meta: "Local work and referrals", count: "8.7K", icon: Building2, tone: "#0f6b7a" },
  { name: "Side Work", meta: "Short-term help needed", count: "5.2K", icon: Briefcase, tone: "#1c1c1c" },
  { name: "Cabinetry Talk", meta: "Installs, layout, scribing", count: "6.1K", icon: Hammer, tone: "#6b4a1c" },
  { name: "Tile Talk", meta: "Layout, thinset, lippage", count: "5.3K", icon: Wrench, tone: "#3b2a6b" },
  { name: "Plumbing Talk", meta: "Rough-in, service, code", count: "7.6K", icon: Wrench, tone: "#0f5f6b" },
  { name: "Remodelers", meta: "Whole-home coordination", count: "4.4K", icon: Users, tone: "#444" },
];

const TRADE_TALK_PROMPTS = [
  "Best way to scribe cabinets to stone?",
  "What are you charging for punch-out work?",
  "Do I need insurance for side jobs?",
];

function ShopTalkNewPostModal({
  profile,
  selectedJobTrade,
  initialFlair = "Question",
  initialTitle = "",
  initialBody = "",
  onClose,
  onSubmit,
}: {
  profile: AccountProfile;
  selectedJobTrade: Trade | "General";
  initialFlair?: PostFlair;
  initialTitle?: string;
  initialBody?: string;
  onClose: () => void;
  onSubmit: (flair: PostFlair, title: string, trade: Trade | "General", body: string, postType: PostType, subTrade?: string, subLocation?: string, subRate?: string) => void;
}) {
  const [flair, setFlair] = useState<PostFlair>(initialFlair);
  const [title, setTitle] = useState(initialTitle);
  const [trade, setTrade] = useState<Trade | "General">(selectedJobTrade);
  const [body, setBody] = useState(initialBody);
  const [postType, setPostType] = useState<PostType>("general");
  const [subTrade, setSubTrade] = useState("");
  const [subLocation, setSubLocation] = useState("");
  const [subRate, setSubRate] = useState("");
  const canSubmit = title.trim().length > 0 && body.trim().length > 0;
  const tradeOptions: (Trade | "General")[] = ["General", ...specialtyOptions];

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="new-post-modal">
        <div className="new-post-modal-header">
          <h2>Create a post</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        <div className="v2-st-type-selector">
          {POST_TYPE_CHIPS.map((chip) => (
            <button
              key={chip.type}
              type="button"
              className={`v2-st-type-chip${postType === chip.type ? " is-active" : ""}`}
              onClick={() => setPostType(chip.type)}
            >
              <span aria-hidden="true">{chip.label.slice(0, 3).toUpperCase()}</span>
              {chip.label}
            </button>
          ))}
        </div>

        <div className="new-post-flair-picker">
          <span>Choose a flair</span>
          <div className="flair-options">
            {(Object.keys(FLAIR_CONFIG) as PostFlair[]).map((f) => (
              <button
                key={f}
                type="button"
                className={`flair-option${flair === f ? " selected" : ""}`}
                style={{ "--flair-color": FLAIR_CONFIG[f].color } as CSSProperties}
                onClick={() => setFlair(f)}
              >
                {f}
              </button>
            ))}
          </div>
          <small>{FLAIR_CONFIG[flair].description}</small>
        </div>

        <label className="input-control">
          <span>Trade</span>
          <select value={trade} onChange={(e) => setTrade(e.target.value as Trade | "General")}>
            {tradeOptions.map((t) => <option key={t}>{t}</option>)}
          </select>
        </label>

        <label className="input-control">
          <span>Title</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={flair === "Question" ? "What would you check first on...?" : "What's on your mind?"}
            maxLength={120}
          />
          <small>{title.length}/120</small>
        </label>

        <label className="input-control">
          <span>Body</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            placeholder="Add context, photos, site conditions, tools on hand..."
          />
        </label>

        {postType === "sub-request" && (
          <div className="v2-st-sub-fields">
            <input
              type="text"
              className="v2-st-sub-input"
              placeholder="Trade needed (e.g. Plumber, Electrician)"
              value={subTrade}
              onChange={(e) => setSubTrade(e.target.value)}
            />
            <input
              type="text"
              className="v2-st-sub-input"
              placeholder="Location (City or zip code)"
              value={subLocation}
              onChange={(e) => setSubLocation(e.target.value)}
            />
            <input
              type="text"
              className="v2-st-sub-input"
              placeholder="Rate (e.g. $400/day or $55/hr)"
              value={subRate}
              onChange={(e) => setSubRate(e.target.value)}
            />
          </div>
        )}

        <div className="new-post-modal-footer">
          <small>Posting as {profile.displayName}</small>
          <button
            type="button"
            className="primary-action"
            onClick={() => {
              if (canSubmit) {
                onSubmit(
                  flair,
                  title.trim(),
                  trade,
                  body.trim(),
                  postType,
                  postType === "sub-request" ? subTrade : undefined,
                  postType === "sub-request" ? subLocation : undefined,
                  postType === "sub-request" ? subRate : undefined,
                );
                onClose();
              }
            }}
            disabled={!canSubmit}
          >
            <Send size={15} />
            Post
          </button>
        </div>
      </div>
    </div>
  );
}

export function ShopTalkView({
  profile,
  communityPosts,
  newsItems,
  initialQuery,
  initialPostId,
  selectedJobTrade,
  userLocation,
  getPostReactionState,
  getAnswerReactionState,
  reactionSummary: _reactionSummary,
  reactionStatus,
  onVotePost,
  onVoteAnswer,
  onAddAnswer,
  onVerifyAnswer,
  onReportPost,
  onNewPost,
}: {
  profile: AccountProfile;
  communityPosts: CommunityPost[];
  newsItems: NewsItem[];
  initialQuery: string;
  initialPostId?: number | null;
  selectedJobTrade: Trade | "General";
  userLocation: string;
  getPostReactionState: (post: CommunityPost) => CommunityReactionState;
  getAnswerReactionState: (postId: number, answer: CommunityAnswer) => CommunityReactionState;
  reactionSummary: CommunityReactionSummary | null;
  reactionStatus: CommunityReactionSyncStatus;
  onVotePost: (postId: number, direction: "up" | "down") => void;
  onVoteAnswer: (postId: number, answerId: number, direction: "up" | "down") => void;
  onAddAnswer: (postId: number, body: string) => void;
  onVerifyAnswer: (postId: number, answerId: number) => void;
  onReportPost: (postId: number, reason: CommunityReport["reason"]) => void;
  onNewPost: (flair: PostFlair, title: string, trade: Trade | "General", body: string, postType: PostType, subTrade?: string, subLocation?: string, subRate?: string) => void;
}) {
  const persona = usePersona();
  const [activeTab, setActiveTab] = useState<"talk" | "news">("talk");
  const [sortMode, setSortMode] = useState<"hot" | "new" | "unanswered">("hot");
  const [tradeFilter, setTradeFilter] = useState("All trades");
  const [answerQueueOnly, setAnswerQueueOnly] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState(initialPostId ?? communityPosts[0]?.id ?? 0);
  const [answerDraft, setAnswerDraft] = useState("");
  const [rulesOpen, setRulesOpen] = useState(false);
  const [newPostOpen, setNewPostOpen] = useState(false);
  const [joinedCommunities, setJoinedCommunities] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("rivt.joinedCommunities.v1") ?? "[]") as string[]); }
    catch { return new Set(); }
  });
  const [talkQuery, setTalkQuery] = useState(() => initialQuery.trim());
  const [newsQuery, setNewsQuery] = useState("");
  const [liveNews, setLiveNews] = useState<NewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsFetched, setNewsFetched] = useState(false);
  const [flairFilter, setFlairFilter] = useState<PostFlair | "All">("All");
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<number>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("rivt.shopTalkBookmarks.v1") ?? "[]") as number[]); }
    catch { return new Set(); }
  });
  const [showBookmarked, setShowBookmarked] = useState(false);
  const [helpfulVotesMap, setHelpfulVotesMap] = useState<Record<number, number>>(() => {
    try { return JSON.parse(localStorage.getItem("rivt.shopTalk.v1") ?? "{}") as Record<number, number>; }
    catch { return {}; }
  });
  const [activeTrendingTag, setActiveTrendingTag] = useState<string | null>(null);
  const [locallyAnswered, setLocallyAnswered] = useState<Set<number>>(new Set());
  const [filterType, setFilterType] = useState<PostType | "all">("all");
  const [_expandedReplyPostId, _setExpandedReplyPostId] = useState<string | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [shopTalkReplies, setShopTalkReplies] = useState<Record<string, ShopTalkReply[]>>(() => {
    try { return JSON.parse(localStorage.getItem("rivt.shopTalkReplies.v1") ?? "{}") as Record<string, ShopTalkReply[]>; }
    catch { return {}; }
  });
  const replyAuthorName = profile.displayName || "Anonymous";
  const displayNews = liveNews.length ? liveNews : newsItems;
  const [selectedNewsId, setSelectedNewsId] = useState(displayNews[0]?.id ?? 0);
  const [mobileDetail, setMobileDetail] = useState(initialPostId != null);
  const [newsDiscussContext, setNewsDiscussContext] = useState<NewsItem | null>(null);
  const tradeFilters = ["All trades", "General", ...specialtyOptions];
  const primaryTrade = profile.specialties[0] ?? selectedJobTrade;
  const answerQueuePosts = communityPosts
    .filter((post) => (
      (post.trade === primaryTrade || post.trade === "General") &&
      post.status !== "Verified Fix"
    ))
    .sort((a, b) => {
      if (a.trade === primaryTrade && b.trade !== primaryTrade) return -1;
      if (a.trade !== primaryTrade && b.trade === primaryTrade) return 1;
      if (a.status === "Needs a pro answer" && b.status !== "Needs a pro answer") return -1;
      if (a.status !== "Needs a pro answer" && b.status === "Needs a pro answer") return 1;
      return b.id - a.id;
    });
  const allReportReasons: CommunityReport["reason"][] = ["Misinformation", "Safety concern", "Spam", "Harassment"];

  function toggleBookmark(postId: number) {
    setBookmarkedIds(prev => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId); else next.add(postId);
      try { localStorage.setItem("rivt.shopTalkBookmarks.v1", JSON.stringify([...next])); } catch { /* noop */ }
      return next;
    });
  }

  function _incrementHelpfulVote(postId: number) {
    setHelpfulVotesMap(prev => {
      const base = communityPosts.find(p => p.id === postId)?.helpfulVotes ?? 0;
      const extra = prev[postId] ?? 0;
      const next = { ...prev, [postId]: extra + 1 };
      const totalForPost = base + extra + 1;
      // store total delta per post
      const persistMap = { ...next };
      try { localStorage.setItem("rivt.shopTalk.v1", JSON.stringify(persistMap)); } catch { /* noop */ }
      void totalForPost;
      return next;
    });
  }

  useEffect(() => {
    try { localStorage.setItem("rivt.shopTalkReplies.v1", JSON.stringify(shopTalkReplies)); } catch { /* noop */ }
  }, [shopTalkReplies]);

  function _sendReply(postId: string) {
    const text = (replyDrafts[postId] ?? "").trim();
    if (!text) return;
    const newReply: ShopTalkReply = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      author: replyAuthorName,
      text,
      createdAt: new Date().toISOString(),
    };
    setShopTalkReplies(prev => {
      const existing = prev[postId] ?? [];
      return { ...prev, [postId]: [...existing, newReply] };
    });
    setReplyDrafts(prev => ({ ...prev, [postId]: "" }));
  }

  function _relativeTime(iso: string): string {
    const diffMs = Date.now() - new Date(iso).getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h ago`;
    const diffD = Math.floor(diffH / 24);
    return `${diffD}d ago`;
  }

  async function activateNews() {
    setActiveTab("news");
    if (newsFetched) return;
    setNewsLoading(true);
    try {
      const response = await fetch(apiPath(`/api/news?location=${encodeURIComponent(userLocation)}`));
      const data = await response.json() as { items?: NewsItem[] };
      const items = Array.isArray(data.items) && data.items.length > 0 ? data.items : newsItems;
      setLiveNews(items);
      setSelectedNewsId(items[0]?.id ?? 0);
    } catch {
      setLiveNews(newsItems);
      setSelectedNewsId(newsItems[0]?.id ?? 0);
    } finally {
      setNewsLoading(false);
      setNewsFetched(true);
    }
  }

  const normalizedTalkQuery = talkQuery.trim().toLowerCase();
  const normalizedNewsQuery = newsQuery.trim().toLowerCase();
  const filteredPosts = communityPosts.filter((post) => {
    const needsAnswer = post.status !== "Verified Fix";
    if (answerQueueOnly && !((post.trade === primaryTrade || post.trade === "General") && needsAnswer)) return false;
    const tradeMatches = tradeFilter === "All trades" || post.trade === tradeFilter;
    if (!tradeMatches) return false;
    if (flairFilter !== "All" && post.flair !== flairFilter) return false;
    if (showBookmarked && !bookmarkedIds.has(post.id)) return false;
    if (filterType !== "all") {
      const postEffectiveType: PostType = post.type ?? "general";
      if (postEffectiveType !== filterType) return false;
    }
    if (activeTrendingTag) {
      const needle = activeTrendingTag.slice(1).toLowerCase();
      const haystack = `${post.title} ${post.body}`.toLowerCase();
      if (!haystack.includes(needle)) return false;
    }

    const searchable = [
      post.title,
      post.body,
      post.trade,
      post.flair ?? "",
      post.author,
      post.status,
      ...post.replies.map((reply) => `${reply.author} ${reply.body}`),
    ].join(" ").toLowerCase();

    if (normalizedTalkQuery && !searchable.includes(normalizedTalkQuery)) return false;
    return true;
  });
  const filteredNews = displayNews.filter((item) => {
    if (!normalizedNewsQuery) return true;
    return [item.headline, item.summary, item.source, item.urgency ?? "", item.date].join(" ").toLowerCase().includes(normalizedNewsQuery);
  });
  const sortedPosts = [...filteredPosts].sort((a, b) => {
    if (sortMode === "new") return b.id - a.id;
    if (sortMode === "unanswered") {
      if (a.replies.length === 0 && b.replies.length > 0) return -1;
      if (a.replies.length > 0 && b.replies.length === 0) return 1;
      return b.id - a.id;
    }
    // hot: "Needs a pro answer" first, then by score
    if (a.status === "Needs a pro answer" && b.status !== "Needs a pro answer") return -1;
    if (a.status !== "Needs a pro answer" && b.status === "Needs a pro answer") return 1;
    return netScore(b) - netScore(a);
  }).sort((a, b) => {
    if (!persona) return 0;
    const aMatch = (a.trade === persona.trade || a.trade === "General") ? 0 : 1;
    const bMatch = (b.trade === persona.trade || b.trade === "General") ? 0 : 1;
    return aMatch - bMatch;
  });
  const selectedPost = filteredPosts.find((p) => p.id === selectedPostId) ?? filteredPosts[0];
  const selectedNews = filteredNews.find((n) => n.id === selectedNewsId) ?? filteredNews[0];
  const profileBadges = communityBadgeLabels(communityPosts, profile.displayName, communityBadgeThresholds);
  const newsSourceCount = new Set(filteredNews.map((item) => item.source)).size;
  const selectedPostReactionState = selectedPost
    ? getPostReactionState(selectedPost)
    : { upvotes: 0, downvotes: 0, reaction: null, serverOwned: reactionStatus === "ready", pending: false };
  const _selectedTradeThreads = filteredPosts.filter((post) => post.trade === selectedJobTrade || post.trade === "General");
  const topContributors = Object.entries(
    communityPosts.reduce<Record<string, { answers: number; fixes: number; score: number }>>((contributors, post) => {
      post.replies.forEach((reply) => {
        const contributor = contributors[reply.author] ?? { answers: 0, fixes: 0, score: 0 };
        contributor.answers += 1;
        contributor.fixes += reply.verifiedFix ? 1 : 0;
        contributor.score += Math.max(0, netScore(reply)) + (reply.verifiedFix ? 5 : 0);
        contributors[reply.author] = contributor;
      });
      return contributors;
    }, {}),
  )
    .sort(([, a], [, b]) => b.score - a.score)
    .slice(0, 3);
  const profileAnswerCount = communityPosts.reduce((count, post) => (
    count + post.replies.filter((reply) => reply.author === profile.displayName).length
  ), 0);
  const profileFixCount = communityPosts.reduce((count, post) => (
    count + post.replies.filter((reply) => reply.author === profile.displayName && reply.verifiedFix).length
  ), 0);
  const reputationGoal = profileFixCount > 0
    ? "Keep your Top Hand signal fresh"
    : profileAnswerCount > 0
      ? "Earn a Verified Fix"
      : "Give your first field answer";
  const reputationSteps = [
    {
      label: "Answer one question",
      value: profileAnswerCount ? `${profileAnswerCount} posted` : "Start here",
      complete: profileAnswerCount > 0,
    },
    {
      label: "Get marked as a fix",
      value: profileFixCount ? `${profileFixCount} fix${profileFixCount === 1 ? "" : "es"}` : "Next proof",
      complete: profileFixCount > 0,
    },
    {
      label: "Show it on your profile",
      value: profileBadges.length ? profileBadges.join(", ") : "Badge path",
      complete: profileBadges.length > 0,
    },
  ];
  const _reactionLedgerLabel = reactionStatus === "ready"
    ? "Server-backed"
    : reactionStatus === "loading"
      ? "Syncing"
      : reactionStatus === "error"
        ? "Offline"
        : "Not loaded";

  // ── Trending tags ─────────────────────────────────────────────────────────
  const trendingTags = useMemo(() => {
    const counts: Record<string, number> = {};
    // Count predefined tags from post content
    for (const post of communityPosts) {
      const text = `${post.title} ${post.body}`.toLowerCase();
      for (const tag of PREDEFINED_TAGS) {
        if (text.includes(tag.slice(1))) {
          counts[tag] = (counts[tag] ?? 0) + 1;
        }
      }
      // Also extract inline #hashtags
      const matches = text.matchAll(/#(\w+)/g);
      for (const match of matches) {
        const t = `#${match[1]}`;
        counts[t] = (counts[t] ?? 0) + 1;
      }
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([tag]) => tag);
  }, [communityPosts]);
  // User total helpful votes.
  const myTotalRep = useMemo(() => {
    const fromPosts = communityPosts
      .filter(p => p.author === profile.displayName)
      .reduce((sum, p) => sum + (p.helpfulVotes ?? 0) + (helpfulVotesMap[p.id] ?? 0), 0);
    const fromAnswers = communityPosts.reduce((sum, post) => {
      const myAnswers = post.replies.filter(r => r.author === profile.displayName);
      return sum + myAnswers.reduce((s, a) => s + Math.max(0, a.upvotes - a.downvotes), 0);
    }, 0);
    return fromPosts + fromAnswers;
  }, [communityPosts, profile.displayName, helpfulVotesMap]);
  // Per-author reputation for badges on cards.
  const _authorRepMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const post of communityPosts) {
      const votes = (post.helpfulVotes ?? 0) + (helpfulVotesMap[post.id] ?? 0);
      if (votes > 0) map[post.author] = (map[post.author] ?? 0) + votes;
      for (const reply of post.replies) {
        const score = Math.max(0, reply.upvotes - reply.downvotes);
        if (score > 0) map[reply.author] = (map[reply.author] ?? 0) + score;
      }
    }
    return map;
  }, [communityPosts, helpfulVotesMap]);

  function submitAnswer() {
    const body = answerDraft.trim();
    if (!selectedPost || !body) return;
    onAddAnswer(selectedPost.id, body);
    setAnswerDraft("");
  }

  function openAnswerQueue() {
    setActiveTab("talk");
    setAnswerQueueOnly(true);
    setSortMode("unanswered");
    setTradeFilter("All trades");
    const nextPost = answerQueuePosts[0];
    if (nextPost) {
      setSelectedPostId(nextPost.id);
      setMobileDetail(true);
    }
  }

  const SHOP_RULES = [
    "Keep it field-relevant - no recruiting or solicitation",
    "Cite the code section when referencing code requirements",
    "No pricing disputes or bidding wars",
    "Mark your answer as a Verified Fix only if you've done it",
    "Be specific - \"I've seen this on X job\" beats generic advice",
    "No spam, no harassment - violations get removed, not warned",
  ];

  return (
    <>
      {newPostOpen && (
        <ShopTalkNewPostModal
          profile={profile}
          selectedJobTrade={selectedJobTrade}
          initialFlair={newsDiscussContext ? "Discussion" : "Question"}
          initialTitle={newsDiscussContext ? newsDiscussContext.headline.slice(0, 120) : ""}
          initialBody={newsDiscussContext ? `Via ${newsDiscussContext.source} · ${newsDiscussContext.date}\n\n` : ""}
          onClose={() => { setNewPostOpen(false); setNewsDiscussContext(null); }}
          onSubmit={(flair, title, trade, body, postType, subTrade, subLocation, subRate) => {
            onNewPost(flair, title, trade, body, postType, subTrade, subLocation, subRate);
            setNewPostOpen(false);
            setNewsDiscussContext(null);
          }}
        />
      )}
      <section className={mobileDetail ? "shop-talk-layout trade-talk-layout mobile-detail-open" : "shop-talk-layout trade-talk-layout"} aria-label="Trade Talk community">
        <aside className="shop-talk-sidebar">
          {/* Tab switcher */}
          <div className="shop-talk-tabs">
            <button
              type="button"
              className={activeTab === "talk" ? "active" : ""}
              onClick={() => setActiveTab("talk")}
            >
              <MessageCircle size={14} />
              Trade Talk
            </button>
            <button
              type="button"
              className={activeTab === "news" ? "active" : ""}
              onClick={activateNews}
            >
              <Newspaper size={14} />
              Trade News
            </button>
          </div>

          {activeTab === "talk" ? (
            <>
              <div className="trade-talk-home-actions" aria-label="Trade Talk actions">
                <button type="button" className="trade-talk-action-card is-ask" onClick={() => setNewPostOpen(true)}>
                  <MessageCircle size={20} />
                  <span>Ask the trades</span>
                </button>
                <button type="button" className="trade-talk-action-card is-crew" onClick={() => setTalkQuery("Jacksonville Trades")}>
                  <Users size={20} />
                  <span>Find your crew</span>
                </button>
              </div>

              <div className="trade-talk-prompt-strip" aria-label="Popular Trade Talk questions">
                {TRADE_TALK_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => {
                      setTalkQuery(prompt);
                      setActiveTrendingTag(null);
                    }}
                  >
                    {prompt}
                  </button>
                ))}
              </div>

              <section className="community-board" aria-label="Communities">
                <div className="community-board-head">
                  <strong>Communities</strong>
                  <span>{joinedCommunities.size} joined</span>
                </div>
                <div className="community-board-list">
                  {TRADE_TALK_COMMUNITIES.map((community) => {
                    const CIcon = community.icon;
                    const joined = joinedCommunities.has(community.name);
                    return (
                      <div key={community.name} className="community-row">
                        <button
                          type="button"
                          className="community-row-main"
                          onClick={() => setTalkQuery(community.name.replace(" Talk", ""))}
                        >
                          <span className="community-row-icon" style={{ background: community.tone }}>
                            <CIcon size={20} strokeWidth={2.4} />
                          </span>
                          <span className="community-row-copy">
                            <b>{community.name}</b>
                            <small>{community.count} members · {community.meta}</small>
                          </span>
                        </button>
                        <button
                          type="button"
                          className={joined ? "community-join is-joined" : "community-join"}
                          aria-pressed={joined}
                          onClick={() => {
                            setJoinedCommunities((prev) => {
                              const next = new Set(prev);
                              if (next.has(community.name)) next.delete(community.name);
                              else next.add(community.name);
                              try { localStorage.setItem("rivt.joinedCommunities.v1", JSON.stringify([...next])); } catch { /* ignore */ }
                              return next;
                            });
                          }}
                        >
                          {joined ? "Joined" : "Join"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>

              <div className="shop-talk-answer-queue" aria-label="Unanswered in your trade">
                <div>
                  <span>Answer queue</span>
                  <strong>
                    {answerQueuePosts.length
                      ? `${answerQueuePosts.length} ${primaryTrade} question${answerQueuePosts.length === 1 ? "" : "s"} need a hand`
                      : `${primaryTrade} is caught up`}
                  </strong>
                </div>
                <div className="shop-talk-answer-actions">
                  <button type="button" className="primary-action" onClick={openAnswerQueue} disabled={answerQueuePosts.length === 0}>
                    <MessageCircle size={15} />
                    Answer now
                  </button>
                  {answerQueueOnly && (
                    <button type="button" onClick={() => setAnswerQueueOnly(false)}>
                      Show all
                    </button>
                  )}
                </div>
              </div>

              <div className="shop-talk-reputation-path" aria-label="Trade Talk reputation path">
                <header>
                  <span><Award size={14} /> Reputation path</span>
                  <strong>{reputationGoal}</strong>
                </header>
                <div className="shop-talk-reputation-steps">
                  {reputationSteps.map((step) => (
                    <span key={step.label} data-complete={step.complete ? "true" : "false"}>
                      {step.complete ? <CheckCircle2 size={14} /> : <Sparkles size={14} />}
                      <b>{step.label}</b>
                      <em>{step.value}</em>
                    </span>
                  ))}
                </div>
                <p>
                  Field-tested answers become part of your trade reputation once they are tied to your profile.
                </p>
              </div>

              {/* Community Rules */}
              <div className="shop-talk-rules">
                <button
                  type="button"
                  className="rules-toggle"
                  onClick={() => setRulesOpen((v) => !v)}
                  aria-expanded={rulesOpen}
                >
                  <ShieldCheck size={14} />
                  <span>Community Rules</span>
                  <ChevronDown size={13} style={{ transform: rulesOpen ? "rotate(180deg)" : undefined, transition: "transform 0.2s" }} />
                </button>
                {rulesOpen && (
                  <ol className="rules-list">
                    {SHOP_RULES.map((rule, i) => (
                      <li key={i}>{rule}</li>
                    ))}
                  </ol>
                )}
              </div>

              {topContributors.length > 0 && (
                <div className="shop-talk-pulse" aria-label="Top contributors">
                  <div className="shop-talk-pulse-head">
                    <span>Top hands this week</span>
                  </div>
                  <div className="shop-talk-contributors">
                    {topContributors.slice(0, 3).map(([name, stats]) => (
                      <span key={name}>
                        <b>{name}</b>
                        <em>{stats.answers} answers · {stats.fixes} fixes</em>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="shop-talk-fieldbar" aria-label="Trade Talk filters">
                <label className="shop-talk-search">
                  <Search size={15} />
                  <span className="sr-only">Search Trade Talk</span>
                  <input
                    type="search"
                    value={talkQuery}
                    onChange={(event) => setTalkQuery(event.target.value)}
                    placeholder="Search jobs, answers, crews"
                  />
                </label>
                <label className="input-control">
                  <span>Trade</span>
                  <select value={tradeFilter} onChange={(e) => setTradeFilter(e.target.value)}>
                    {tradeFilters.map((opt) => <option key={opt}>{opt}</option>)}
                  </select>
                </label>
                <div className="shop-sort-tabs">
                  {(["hot", "new", "unanswered"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      className={sortMode === mode ? "active" : ""}
                      onClick={() => setSortMode(mode)}
                    >
                      {mode === "hot" ? "Hot" : mode === "new" ? "New" : "Unanswered"}
                    </button>
                  ))}
                </div>
                {answerQueueOnly && (
                  <div className="shop-talk-active-filter">
                    <span>{primaryTrade} answer queue</span>
                    <button type="button" onClick={() => setAnswerQueueOnly(false)}>Clear</button>
                  </div>
                )}
                <div className="shop-talk-flair-row">
                  {(["All", "Question", "Discussion", "Tip", "Code Talk", "Compliance", "Humor"] as const).map(flair => (
                    <button
                      key={flair}
                      type="button"
                      className={flairFilter === flair ? "flair-chip active" : "flair-chip"}
                      onClick={() => setFlairFilter(flair)}
                    >
                      {flair}
                    </button>
                  ))}
                </div>
                <div className="shop-talk-bookmark-filter">
                  <button
                    type="button"
                    className={showBookmarked ? "shop-talk-saved-btn active" : "shop-talk-saved-btn"}
                    onClick={() => setShowBookmarked(v => !v)}
                  >
                    {showBookmarked ? <BookmarkCheck size={13} /> : <Bookmark size={13} />}
                    Saved ({bookmarkedIds.size})
                  </button>
                  {showBookmarked && (
                    <button type="button" className="shop-talk-clear-filter-btn" onClick={() => setShowBookmarked(false)}>
                      <X size={11} />
                      Clear
                    </button>
                  )}
                </div>
              </div>

              <div className="v2-st-filter-row" aria-label="Filter by post type">
                {([
                  { type: "all" as const, emoji: "", label: "All" },
                  { type: "question" as const, emoji: "❓", label: "Questions" },
                  { type: "sub-request" as const, emoji: "🔧", label: "Sub Requests" },
                  { type: "safety" as const, emoji: "⚠️", label: "Safety" },
                  { type: "general" as const, emoji: "💬", label: "General" },
                ] satisfies { type: PostType | "all"; emoji: string; label: string }[]).map((f) => (
                  <button
                    key={f.type}
                    type="button"
                    className={`v2-st-filter-pill${filterType === f.type ? " is-active" : ""}`}
                    onClick={() => setFilterType(f.type)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Trending tags */}
              {trendingTags.length > 0 && (
                <div className="v2-st-trending-row" aria-label="Trending tags">
                  <span className="v2-st-trending-label"><Hash size={11} /> Trending</span>
                  <button
                    key="all"
                    type="button"
                    className={`v2-st-trending-pill${activeTrendingTag === null ? " is-active" : ""}`}
                    onClick={() => setActiveTrendingTag(null)}
                  >
                    All
                  </button>
                  {trendingTags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      className={`v2-st-trending-pill${activeTrendingTag === tag ? " is-active" : ""}`}
                      onClick={() => setActiveTrendingTag(prev => prev === tag ? null : tag)}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              )}

              {persona && (
                <div className="shop-talk-persona-header">
                  <span>{persona.shopTalkLabel}</span>
                </div>
              )}
              <div className="shop-post-list">
                {sortedPosts.length === 0 ? (
                  <EmptyState
                    icon={MessageCircle}
                    title="No matching Trade Talk posts"
                    description="Clear the search, broaden the trade filter, or ask the first question in this lane."
                    actionLabel={talkQuery ? "Clear search" : "Ask the trades"}
                    onAction={() => talkQuery ? setTalkQuery("") : setNewPostOpen(true)}
                  />
                ) : sortedPosts.map((post) => (
                  <TradePostCard
                    key={post.id}
                    post={post}
                    saved={bookmarkedIds.has(post.id)}
                    onToggleSave={() => toggleBookmark(post.id)}
                    onOpen={() => { setSelectedPostId(post.id); setMobileDetail(true); }}
                  />
                ))}
              </div>
              <button type="button" className="trade-talk-fab" onClick={() => setNewPostOpen(true)}>
                <Plus size={18} />
                Ask
              </button>
            </>
          ) : (
            <>
              <div className="shop-talk-command news-command">
                <div className="shop-talk-command-head">
                  <span>Trade news</span>
                  <h2>Code, safety, and permitting updates</h2>
                  <p className="news-command-meta">
                    {filteredNews.length} articles · {newsSourceCount} sources · {newsFetched ? "Live feed" : "Curated feed"}
                  </p>
                </div>
              </div>
              <div className="shop-talk-fieldbar news-fieldbar" aria-label="Trade News filters">
                <label className="shop-talk-search">
                  <Search size={15} />
                  <span className="sr-only">Search Trade News</span>
                  <input
                    type="search"
                    value={newsQuery}
                    onChange={(event) => setNewsQuery(event.target.value)}
                    placeholder="Search sources, codes, safety, local"
                  />
                </label>
              </div>
              <div className="shop-news-list">
                {newsLoading ? (
                  <div className="news-loading">
                    {[1,2,3,4,5].map((i) => (
                      <div key={i} className="news-skeleton">
                        <div className="skeleton-pill" />
                        <div className="skeleton-line" />
                        <div className="skeleton-line short" />
                      </div>
                    ))}
                  </div>
                ) : filteredNews.length === 0 ? (
                  <EmptyState
                    icon={Newspaper}
                    title="No matching trade news"
                    description="Clear the search to see the current trade feed."
                    actionLabel="Clear search"
                    onAction={() => setNewsQuery("")}
                  />
                ) : filteredNews.map((item) => (
                  <article
                    key={item.id}
                    className={item.id === selectedNewsId ? "shop-news-card selected" : "shop-news-card"}
                  >
                    <button
                      type="button"
                      className="shop-news-card-main"
                      onClick={() => { setSelectedNewsId(item.id); setMobileDetail(true); }}
                    >
                      <div className="shop-news-card-body-wrap">
                        {isFallbackNewsThumbnail(item) ? (
                          <div className="news-card-thumb is-source-tile" aria-hidden="true">
                            <span>{newsSourceInitials(item.source)}</span>
                            <small>{item.urgency ?? "Trade"}</small>
                          </div>
                        ) : (
                          <div className="news-card-thumb is-real">
                            <img src={item.thumbnailUrl} alt={`${item.source} article image`} loading="lazy" />
                          </div>
                        )}
                        <div className="news-card-body">
                          <div className="news-card-kicker">
                            {item.urgency && <span className="news-urgency-pill">{item.urgency}</span>}
                            <small>{item.date}</small>
                          </div>
                          <strong>{item.headline}</strong>
                          <p>{item.summary}</p>
                          <small>{item.source}</small>
                        </div>
                      </div>
                    </button>
                    {item.url && item.url !== "#" && (
                      <a
                        className="shop-news-source-link"
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <ExternalLink size={12} />
                        Read original
                      </a>
                    )}
                  </article>
                ))}
              </div>
            </>
          )}
        </aside>

        {/* Right panel */}
        {activeTab === "talk" ? (
          selectedPost ? (
            <article className="shop-talk-detail">
              <button type="button" className="mobile-back-btn" onClick={() => setMobileDetail(false)}>
                <ArrowLeft size={15} />
                Back
              </button>
              <div className="shop-question-header">
                <div>
                  <div className="shop-question-meta">
                    {selectedPost.flair && (
                      <span className={`flair-pill flair-${selectedPost.flair.toLowerCase().replace(/\s/g, "-")}`}>
                        {selectedPost.flair}
                      </span>
                    )}
                    <span>{selectedPost.badge ? `${selectedPost.badge} - ${selectedPost.author}` : selectedPost.author}</span>
                    <span>{selectedPost.trade} - {selectedPost.createdAt}</span>
                  </div>
                  <h2>{selectedPost.title}</h2>
                  <p>{selectedPost.body}</p>
                </div>
                <div className="shop-question-header-actions">
                  <span className={selectedPost.status === "Verified Fix" ? "state-pill verified" : "state-pill"}>
                    {selectedPost.status}
                  </span>
                  <button
                    type="button"
                    className={bookmarkedIds.has(selectedPost.id) ? "shop-detail-bookmark active" : "shop-detail-bookmark"}
                    aria-label={bookmarkedIds.has(selectedPost.id) ? "Remove bookmark" : "Bookmark this post"}
                    onClick={() => toggleBookmark(selectedPost.id)}
                  >
                    {bookmarkedIds.has(selectedPost.id) ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
                  </button>
                </div>
              </div>
              {locallyAnswered.has(selectedPost.id) && (
                <div className="shop-talk-answered-banner">
                  <CheckCircle2 size={15} />
                  You marked this as answered
                </div>
              )}

              <div className="shop-question-actions">
                <button
                  type="button"
                  className={selectedPostReactionState.reaction === "up" ? "reaction-button active" : "reaction-button"}
                  aria-pressed={selectedPostReactionState.reaction === "up"}
                  aria-label={selectedPostReactionState.reaction === "up" ? "Remove upvote from thread" : "Upvote thread"}
                  disabled={selectedPostReactionState.pending}
                  onClick={() => onVotePost(selectedPost.id, "up")}
                >
                  <ThumbsUp size={15} />
                  {selectedPostReactionState.upvotes}
                </button>
                <button
                  type="button"
                  className={selectedPostReactionState.reaction === "down" ? "reaction-button active negative" : "reaction-button"}
                  aria-pressed={selectedPostReactionState.reaction === "down"}
                  aria-label={selectedPostReactionState.reaction === "down" ? "Remove downvote from thread" : "Downvote thread"}
                  disabled={selectedPostReactionState.pending}
                  onClick={() => onVotePost(selectedPost.id, "down")}
                >
                  <ThumbsDown size={15} />
                  {selectedPostReactionState.downvotes}
                </button>
                {allReportReasons.map((reason) => (
                  <button type="button" key={reason} onClick={() => onReportPost(selectedPost.id, reason)}>
                    <Flag size={15} />
                    {reason}
                  </button>
                ))}
                {selectedPost.author === profile.displayName &&
                  selectedPost.status !== "Verified Fix" &&
                  !locallyAnswered.has(selectedPost.id) && (
                  <button
                    type="button"
                    className="shop-talk-mark-answered-btn"
                    onClick={() => setLocallyAnswered(prev => new Set([...prev, selectedPost.id]))}
                  >
                    <CheckCircle2 size={15} />
                    Mark as answered
                  </button>
                )}
              </div>

              <section className="answer-composer">
                <div className="answer-composer-byline">
                  <div>
                    <span>Answer as {profile.displayName}</span>
                    <strong>{profileBadges.length ? profileBadges.join(", ") : "New contributor"}</strong>
                  </div>
                  <span className="v2-st-my-rep-badge"><Star size={12} /> {myTotalRep} rep</span>
                  <span className="answer-trade-tag">{selectedPost.trade}</span>
                </div>
                <div className="answer-guidance-card">
                  <strong>Good answers get specific.</strong>
                  <span>Name the condition, the tool or code check, the order of operations, and what proof prevents a callback.</span>
                </div>
                <textarea
                  value={answerDraft}
                  onChange={(e) => setAnswerDraft(e.target.value.slice(0, 1000))}
                  rows={4}
                  placeholder="Share the field habit, safety check, tool setup, or closeout proof that would prevent a callback."
                />
                <div className="answer-composer-footer">
                  <span className={answerDraft.length > 900 ? "answer-char-count is-near-limit" : "answer-char-count"}>
                    {1000 - answerDraft.length}
                  </span>
                  <button type="button" className="primary-action" onClick={submitAnswer} disabled={!answerDraft.trim()}>
                    <Send size={17} />
                    Post answer
                  </button>
                </div>
              </section>

              <section className="answer-list" aria-label="Community answers">
                {selectedPost.replies.length === 0 ? (
                  <article className="empty-ledger">
                    <MessageCircle size={18} />
                    <strong>This needs a real trade answer.</strong>
                    <span>Answer it, then mark the best response as Verified Fix during testing.</span>
                  </article>
                ) : sortedAnswers(selectedPost.replies).map((answer) => {
                  const answerReactionState = getAnswerReactionState(selectedPost.id, answer);

                  return (
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
                        <button
                          type="button"
                          className={answerReactionState.reaction === "up" ? "reaction-button active" : "reaction-button"}
                          aria-pressed={answerReactionState.reaction === "up"}
                          aria-label={answerReactionState.reaction === "up" ? "Remove upvote from answer" : "Upvote answer"}
                          disabled={answerReactionState.pending}
                          onClick={() => onVoteAnswer(selectedPost.id, answer.id, "up")}
                        >
                          <ThumbsUp size={14} />
                          {answerReactionState.upvotes}
                        </button>
                        <button
                          type="button"
                          className={answerReactionState.reaction === "down" ? "reaction-button active negative" : "reaction-button"}
                          aria-pressed={answerReactionState.reaction === "down"}
                          aria-label={answerReactionState.reaction === "down" ? "Remove downvote from answer" : "Downvote answer"}
                          disabled={answerReactionState.pending}
                          onClick={() => onVoteAnswer(selectedPost.id, answer.id, "down")}
                        >
                          <ThumbsDown size={14} />
                          {answerReactionState.downvotes}
                        </button>
                        <button type="button" disabled={answer.verifiedFix} onClick={() => onVerifyAnswer(selectedPost.id, answer.id)}>
                          <BadgeCheck size={14} />
                          {answer.verifiedFix ? "Verified" : "Mark fix"}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </section>
            </article>
          ) : (
            <article className="shop-talk-detail">
              <button type="button" className="mobile-back-btn" onClick={() => setMobileDetail(false)}>
                <ArrowLeft size={15} />
                Back
              </button>
              <EmptyState
                icon={MessageCircle}
                title="No Trade Talk posts yet"
                description="Ask the first field question and let the community answer it."
                actionLabel="Ask the trades"
                onAction={() => setNewPostOpen(true)}
              />
            </article>
          )
        ) : (
          <article className="shop-talk-detail">
            <button type="button" className="mobile-back-btn" onClick={() => setMobileDetail(false)}>
              <ArrowLeft size={15} />
              Back
            </button>
            {selectedNews ? (
              <div className="shop-news-detail">
                <div className={isFallbackNewsThumbnail(selectedNews) ? "news-detail-hero is-source-tile" : "news-detail-hero is-real"} data-urgency={selectedNews.urgency ?? "default"}>
                  {isFallbackNewsThumbnail(selectedNews) ? (
                    <div className="news-detail-source-mark" aria-hidden="true">
                      <span>{newsSourceInitials(selectedNews.source)}</span>
                    </div>
                  ) : (
                    <img src={selectedNews.thumbnailUrl} alt={`${selectedNews.source} article image`} loading="lazy" />
                  )}
                  <div className="news-detail-hero-copy">
                    <span className="news-detail-source">{selectedNews.source}</span>
                    {selectedNews.urgency && <span className="news-urgency-pill">{selectedNews.urgency}</span>}
                  </div>
                </div>
                <div className="shop-news-detail-header">
                  <h2>{selectedNews.headline}</h2>
                  <small>{selectedNews.source} - {selectedNews.date}</small>
                </div>
                <p className="shop-news-detail-body">{selectedNews.summary}</p>
                {selectedNews.url && selectedNews.url !== "#" && (
                  <a href={selectedNews.url} target="_blank" rel="noreferrer" className="primary-action news-read-btn">
                    Read original article
                    <ExternalLink size={15} />
                  </a>
                )}
                <div className="shop-news-discuss">
                  <strong>Discuss this in Trade Talk</strong>
                  <p>Have a take on how this affects your work? Start a conversation.</p>
                  <button
                    type="button"
                    className="primary-action"
                    onClick={() => {
                      setNewsDiscussContext(selectedNews);
                      setActiveTab("talk");
                      setNewPostOpen(true);
                    }}
                  >
                    <MessageCircle size={15} />
                    Discuss
                  </button>
                </div>
              </div>
            ) : (
              <EmptyState icon={Newspaper} title="Select a news item" description="Choose a headline from the left to read the full summary." />
            )}
          </article>
        )}
      </section>
    </>
  );
}

