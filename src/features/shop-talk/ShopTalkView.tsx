import { type CSSProperties, useState } from "react";
import {
  ArrowLeft,
  Award,
  BadgeCheck,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  Flag,
  MessageCircle,
  Newspaper,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  X,
  type LucideIcon,
} from "lucide-react";
import { tradeOptions } from "../../data";
import type { Trade } from "../../types";

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
  replies: CommunityAnswer[];
  createdAt: string;
  status: "Open" | "Verified Fix" | "Needs a pro answer";
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

const API_BASE_URL = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? "http://127.0.0.1:8787" : "");
const specialtyOptions = tradeOptions.filter((trade): trade is Trade => trade !== "All trades");

const communityBadgeThresholds = {
  firstAssistVerifiedFixes: 1,
  mentorQualityAnswers: 3,
  topHandQualityAnswers: 8,
};

function apiPath(path: string) {
  return `${API_BASE_URL}${path}`;
}

function newsTopicThumbnail(item: Pick<NewsItem, "headline" | "source" | "urgency">) {
  const haystack = `${item.urgency ?? ""} ${item.source ?? ""} ${item.headline ?? ""}`.toLowerCase();

  if (/osha|heat|safety/.test(haystack)) return "/news/heat-safety.svg";
  if (/\bnec\b|code|electrical/.test(haystack)) return "/news/code-update.svg";
  if (/hvac|refrigerant|r-410a|epa/.test(haystack)) return "/news/hvac-refrigerant.svg";
  if (/permit|jacksonville|inspection|ordinance/.test(haystack)) return "/news/permit-watch.svg";
  if (/license|renewal|dbpr|certification/.test(haystack)) return "/news/license-renewal.svg";
  if (/labor|workforce|shortage|hiring|wage/.test(haystack)) return "/news/workforce-market.svg";

  return "/news/rivt-trade-brief.svg";
}

function newsThumbnailUrl(item: Pick<NewsItem, "url" | "thumbnailUrl" | "source" | "headline" | "urgency">) {
  if (item.thumbnailUrl) return item.thumbnailUrl;
  return newsTopicThumbnail(item);
}

function isFallbackNewsThumbnail(item: Pick<NewsItem, "thumbnailUrl" | "thumbnailKind">) {
  return item.thumbnailKind === "fallback" || !item.thumbnailUrl || item.thumbnailUrl.startsWith("/news/");
}

function newsThumbClassName(baseClass: string, item: Pick<NewsItem, "thumbnailUrl" | "thumbnailKind">) {
  return `${baseClass} ${isFallbackNewsThumbnail(item) ? "is-fallback" : "is-real"}`;
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

  if (verifiedFixes >= communityBadgeThresholds.firstAssistVerifiedFixes) badges.push("First Assist");
  if (qualityAnswers >= communityBadgeThresholds.mentorQualityAnswers) badges.push("Trade Mentor");
  if (qualityAnswers >= communityBadgeThresholds.topHandQualityAnswers && verifiedFixes > 1) badges.push("Top Hand");

  return badges;
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

function ShopTalkNewPostModal({
  profile,
  selectedJobTrade,
  onClose,
  onSubmit,
}: {
  profile: AccountProfile;
  selectedJobTrade: Trade | "General";
  onClose: () => void;
  onSubmit: (flair: PostFlair, title: string, trade: Trade | "General", body: string) => void;
}) {
  const [flair, setFlair] = useState<PostFlair>("Question");
  const [title, setTitle] = useState("");
  const [trade, setTrade] = useState<Trade | "General">(selectedJobTrade);
  const [body, setBody] = useState("");
  const canSubmit = title.trim().length > 0 && body.trim().length > 0;
  const tradeOptions: (Trade | "General")[] = ["General", ...specialtyOptions];

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="new-post-modal">
        <div className="new-post-modal-header">
          <h2>Create a post</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button>
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

        <div className="new-post-modal-footer">
          <small>Posting as {profile.displayName}</small>
          <button type="button" className="primary-action" onClick={() => { if (canSubmit) { onSubmit(flair, title.trim(), trade, body.trim()); onClose(); } }} disabled={!canSubmit}>
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
  selectedJobTrade,
  userLocation,
  getPostReactionState,
  getAnswerReactionState,
  reactionSummary,
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
  onNewPost: (flair: PostFlair, title: string, trade: Trade | "General", body: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<"talk" | "news">("talk");
  const [sortMode, setSortMode] = useState<"hot" | "new" | "unanswered">("hot");
  const [tradeFilter, setTradeFilter] = useState("All trades");
  const [answerQueueOnly, setAnswerQueueOnly] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState(communityPosts[0]?.id ?? 0);
  const [answerDraft, setAnswerDraft] = useState("");
  const [rulesOpen, setRulesOpen] = useState(false);
  const [newPostOpen, setNewPostOpen] = useState(false);
  const [talkQuery, setTalkQuery] = useState(() => initialQuery.trim());
  const [newsQuery, setNewsQuery] = useState("");
  const [liveNews, setLiveNews] = useState<NewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsFetched, setNewsFetched] = useState(false);
  const displayNews = liveNews.length ? liveNews : newsItems;
  const [selectedNewsId, setSelectedNewsId] = useState(displayNews[0]?.id ?? 0);
  const [mobileDetail, setMobileDetail] = useState(false);
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
    if (!normalizedTalkQuery) return true;

    const searchable = [
      post.title,
      post.body,
      post.trade,
      post.flair ?? "",
      post.author,
      post.status,
      ...post.replies.map((reply) => `${reply.author} ${reply.body}`),
    ].join(" ").toLowerCase();

    return searchable.includes(normalizedTalkQuery);
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
  });
  const selectedPost = filteredPosts.find((p) => p.id === selectedPostId) ?? filteredPosts[0];
  const selectedNews = filteredNews.find((n) => n.id === selectedNewsId) ?? filteredNews[0];
  const profileBadges = communityBadgeLabels(communityPosts, profile.displayName);
  const unansweredCount = filteredPosts.filter((post) => post.replies.length === 0 || post.status === "Needs a pro answer").length;
  const verifiedFixCount = filteredPosts.filter((post) => post.status === "Verified Fix").length;
  const newsSourceCount = new Set(filteredNews.map((item) => item.source)).size;
  const selectedPostReactionState = selectedPost
    ? getPostReactionState(selectedPost)
    : { upvotes: 0, downvotes: 0, reaction: null, serverOwned: reactionStatus === "ready", pending: false };
  const selectedTradeThreads = filteredPosts.filter((post) => post.trade === selectedJobTrade || post.trade === "General");
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
  const reactionLedgerLabel = reactionStatus === "ready"
    ? "Server-backed"
    : reactionStatus === "loading"
      ? "Syncing"
      : reactionStatus === "error"
        ? "Offline"
        : "Not loaded";

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
          onClose={() => setNewPostOpen(false)}
          onSubmit={(flair, title, trade, body) => {
            onNewPost(flair, title, trade, body);
            setNewPostOpen(false);
          }}
        />
      )}
      <section className={mobileDetail ? "shop-talk-layout mobile-detail-open" : "shop-talk-layout"} aria-label="Shop Talk community">
        <aside className="shop-talk-sidebar">
          {/* Tab switcher */}
          <div className="shop-talk-tabs">
            <button
              type="button"
              className={activeTab === "talk" ? "active" : ""}
              onClick={() => setActiveTab("talk")}
            >
              <MessageCircle size={14} />
              Shop Talk
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
              <div className="shop-talk-command">
                <div className="shop-talk-command-head">
                  <span>Community knowledge</span>
                  <h2>Field answers, not generic Q&amp;A</h2>
                  <p>Search first, then ask. Keep code, safety, and site-condition answers tied to real trade experience.</p>
                </div>
                <button type="button" className="primary-action" onClick={() => setNewPostOpen(true)}>
                  <Plus size={17} />
                  New post
                </button>
                <div className="shop-talk-kpi-strip" aria-label="Shop Talk summary">
                  <span><strong>{filteredPosts.length}</strong><small>threads</small></span>
                  <span><strong>{unansweredCount}</strong><small>need answers</small></span>
                  <span><strong>{verifiedFixCount}</strong><small>verified fixes</small></span>
                </div>
              </div>

              <div className="shop-talk-answer-queue" aria-label="Unanswered in your trade">
                <div>
                  <span>Answer queue</span>
                  <strong>
                    {answerQueuePosts.length
                      ? `${answerQueuePosts.length} ${primaryTrade} question${answerQueuePosts.length === 1 ? "" : "s"} need a hand`
                      : `${primaryTrade} is caught up`}
                  </strong>
                  <p>
                    Jump straight into questions where a field-tested answer can build trust before the next hiring conversation.
                  </p>
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

              <div className="shop-talk-reputation-path" aria-label="Shop Talk reputation path">
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
                  Field-tested answers become hiring proof when reputation is server-owned. For this pilot surface, use Shop Talk to practice the loop and find the questions worth closing.
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

              <div className="shop-talk-pulse" aria-label="Shop Talk social pulse">
                <div className="shop-talk-pulse-head">
                  <span>Social hub</span>
                  <strong>Reaction integrity</strong>
                </div>
                <div className="shop-talk-pulse-grid">
                  <span><strong>{reactionSummary?.reactionsGiven ?? 0}</strong><small>server reactions</small></span>
                  <span><strong>{selectedTradeThreads.length}</strong><small>{selectedJobTrade} threads</small></span>
                  <span><strong>{reactionLedgerLabel}</strong><small>ledger status</small></span>
                </div>
                {topContributors.length > 0 ? (
                  <div className="shop-talk-contributors">
                    <small>Top hands this week</small>
                    {topContributors.map(([name, stats]) => (
                      <span key={name}>
                        <b>{name}</b>
                        <em>{stats.answers} answers - {stats.fixes} fixes</em>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p>Reactions are account-owned now; earned author reputation comes next when posts and answers move fully server-side.</p>
                )}
              </div>

              <div className="shop-talk-fieldbar" aria-label="Shop Talk filters">
                <label className="shop-talk-search">
                  <Search size={15} />
                  <span className="sr-only">Search Shop Talk</span>
                  <input
                    type="search"
                    value={talkQuery}
                    onChange={(event) => setTalkQuery(event.target.value)}
                    placeholder="Search questions, trades, fixes"
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
              </div>

              <div className="shop-post-list">
                {sortedPosts.length === 0 ? (
                  <EmptyState
                    icon={MessageCircle}
                    title="No matching questions"
                    description="Clear the search, broaden the trade filter, or start the first field question in this lane."
                    actionLabel={talkQuery ? "Clear search" : "Ask a question"}
                    onAction={() => talkQuery ? setTalkQuery("") : setNewPostOpen(true)}
                  />
                ) : sortedPosts.map((post) => (
                  <button
                    type="button"
                    key={post.id}
                    className={post.id === (selectedPost?.id ?? 0) ? "shop-post-card selected" : "shop-post-card"}
                    onClick={() => { setSelectedPostId(post.id); setMobileDetail(true); }}
                  >
                    <div className="shop-post-card-meta">
                      {post.flair && (
                        <span className={`flair-pill flair-${post.flair.toLowerCase().replace(/\s/g, "-")}`}>
                          {post.flair}
                        </span>
                      )}
                      <span className="post-trade-label">{post.trade}</span>
                    </div>
                    <strong>{post.title}</strong>
                    <div className="shop-post-card-stats">
                      <span>Score {netScore(post)}</span>
                      <span>{post.replies.length} replies</span>
                      <span>{post.createdAt}</span>
                    </div>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="shop-talk-command">
                <div className="shop-talk-command-head">
                  <span>Trade news</span>
                  <h2>Original sources, contractor context</h2>
                  <p>Curated code, safety, licensing, labor, and local permitting updates with links back to the source.</p>
                </div>
                <div className="shop-talk-kpi-strip" aria-label="Trade news summary">
                  <span><strong>{filteredNews.length}</strong><small>articles</small></span>
                  <span><strong>{newsSourceCount}</strong><small>sources</small></span>
                  <span><strong>{newsFetched ? "Live" : "Curated"}</strong><small>feed</small></span>
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
                      <div className={newsThumbClassName("news-card-thumb", item)}>
                        <img src={newsThumbnailUrl(item)} alt={`${item.source} article thumbnail`} loading="lazy" />
                      </div>
                      <div className="news-card-body">
                        <div className="news-card-kicker">
                          {item.urgency && <span className="news-urgency-pill">{item.urgency}</span>}
                          <small>{item.date}</small>
                        </div>
                        <strong>{item.headline}</strong>
                        <p>{item.summary}</p>
                        <small>{item.source}</small>
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
                <span className={selectedPost.status === "Verified Fix" ? "state-pill verified" : "state-pill"}>
                  {selectedPost.status}
                </span>
              </div>

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
              </div>

              <section className="answer-composer">
                <div>
                  <span>Answer as {profile.displayName}</span>
                  <strong>{profileBadges.length ? profileBadges.join(", ") : "New contributor"}</strong>
                </div>
                <div className="answer-guidance-card">
                  <strong>Good answers get specific.</strong>
                  <span>Name the condition, the tool or code check, the order of operations, and what proof prevents a callback.</span>
                </div>
                <textarea
                  value={answerDraft}
                  onChange={(e) => setAnswerDraft(e.target.value)}
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
                title="No Shop Talk posts yet"
                description="Create the first field question and let the community answer it."
                actionLabel="Create post"
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
                <div className={newsThumbClassName("news-detail-hero", selectedNews)} data-urgency={selectedNews.urgency ?? "default"}>
                  <img src={newsThumbnailUrl(selectedNews)} alt={`${selectedNews.source} article thumbnail`} loading="lazy" />
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
                  <strong>Discuss this in Shop Talk</strong>
                  <p>Have a take on how this affects your work? Start a conversation.</p>
                  <button
                    type="button"
                    className="primary-action"
                    onClick={() => {
                      setActiveTab("talk");
                      setNewPostOpen(true);
                    }}
                  >
                    <MessageCircle size={15} />
                    Start discussion
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
