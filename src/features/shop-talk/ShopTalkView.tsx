import { type CSSProperties, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  ExternalLink,
  Flag,
  Hash,
  ImagePlus,
  MessageCircle,
  Newspaper,
  Plus,
  Search,
  Send,
  Star,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";
import { TradePostCard } from "./TradePostCard";
import {
  communitySlug,
  createCommunity,
  setCommunityMembership,
  type ServerCommunity,
} from "./communities-api";
import type { CommunityDisplay } from "./community-directory";
import { tradeOptions } from "../../data";
import type { Trade } from "../../types";
import { usePersona } from "../persona/usePersona";
import {
  communityBadgeLabels,
  inferCommunityDefaultTrade,
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
  id: string;
  author: string;
  body: string;
  upvotes: number;
  downvotes: number;
  verifiedFix: boolean;
}

export type PostType = "question" | "sub-request" | "safety" | "general";

export interface CommunityPost {
  id: string;
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
  sortOrder?: number;
  status: "Open" | "Verified Fix" | "Needs a pro answer";
  type?: PostType;
  subTrade?: string;
  subLocation?: string;
  subRate?: string;
  thumbnailUrl?: string;
  thumbnailAlt?: string;
  communitySlug?: string;
  communityName?: string;
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
  postId: string;
  postTitle: string;
  reason: CommunityReportReason;
  status: "Flagged" | "Cleared" | "Hidden" | "Removed" | "Warned";
}

export type CommunityReportReason =
  | "Misinformation"
  | "Safety concern"
  | "Spam"
  | "Harassment"
  | "Privacy/contact info"
  | "Duplicate/off-topic"
  | "Other";

type ReportTarget =
  | { kind: "post"; postId: string; title: string; description: string }
  | { kind: "answer"; postId: string; answerId: string; title: string; description: string }
  | { kind: "community"; community: CommunityDisplay; title: string; description: string };

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

function ReportSheet({
  target,
  selectedReason,
  note,
  busy,
  onReasonChange,
  onNoteChange,
  onSubmit,
  onClose,
}: {
  target: ReportTarget;
  selectedReason: CommunityReportReason;
  note: string;
  busy: boolean;
  onReasonChange: (reason: CommunityReportReason) => void;
  onNoteChange: (note: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}) {
  return (
    <div className="shop-report-backdrop" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside className="shop-report-sheet" role="dialog" aria-modal="true" aria-labelledby="shop-report-title">
        <div className="shop-report-header">
          <div>
            <span>Report {target.kind}</span>
            <h2 id="shop-report-title">{target.title}</h2>
            <p>{target.description}</p>
          </div>
          <button type="button" className="shop-report-close" onClick={onClose} aria-label="Close report form">
            <X size={18} />
          </button>
        </div>

        <div className="shop-report-reasons" aria-label="Report reason">
          {REPORT_REASON_OPTIONS.map((option) => (
            <button
              key={option.reason}
              type="button"
              className={selectedReason === option.reason ? "is-selected" : ""}
              aria-pressed={selectedReason === option.reason}
              onClick={() => onReasonChange(option.reason)}
            >
              <strong>{option.label}</strong>
              <span>{option.description}</span>
            </button>
          ))}
        </div>

        <label className="shop-report-note">
          <span>Optional context for support</span>
          <textarea
            value={note}
            maxLength={1000}
            rows={3}
            onChange={(event) => onNoteChange(event.target.value)}
            placeholder="Add details that help us review this faster."
          />
        </label>

        <div className="shop-report-footer">
          <button type="button" className="secondary-action" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="primary-action" onClick={onSubmit} disabled={busy}>
            <Flag size={15} />
            {busy ? "Sending..." : "Send report"}
          </button>
        </div>
      </aside>
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

const REPORT_REASON_OPTIONS: Array<{ reason: CommunityReportReason; label: string; description: string }> = [
  { reason: "Safety concern", label: "Unsafe trade advice", description: "Could cause injury, property damage, or illegal work." },
  { reason: "Misinformation", label: "Wrong or misleading", description: "Bad code, licensing, pricing, or technical information." },
  { reason: "Spam", label: "Spam or promotion", description: "Repeated, irrelevant, salesy, or low-quality posting." },
  { reason: "Harassment", label: "Harassment", description: "Threats, hate, bullying, or personal attacks." },
  { reason: "Privacy/contact info", label: "Private info", description: "Phone, address, email, or personal details shared wrongly." },
  { reason: "Duplicate/off-topic", label: "Duplicate or off-topic", description: "Does not belong in this community or repeats another thread." },
  { reason: "Other", label: "Something else", description: "Use the note field so support knows what to review." },
];

function readStringSet(key: string, normalize: (value: string) => string = (value) => value): Set<string> {
  try {
    return new Set(
      (JSON.parse(localStorage.getItem(key) ?? "[]") as Array<string | number>)
        .map((value) => normalize(String(value)))
        .filter(Boolean),
    );
  } catch {
    return new Set();
  }
}

function postSortValue(post: CommunityPost) {
  if (typeof post.sortOrder === "number") return post.sortOrder;
  const parsedDate = new Date(post.createdAt).getTime();
  if (Number.isFinite(parsedDate)) return parsedDate;
  const trailingNumber = post.id.match(/(\d+)(?!.*\d)/)?.[1];
  return trailingNumber ? Number(trailingNumber) : 0;
}

function textIncludesAny(text: string, needles: string[]) {
  const haystack = text.toLowerCase();
  return needles.some((needle) => haystack.includes(needle));
}

function postBelongsToCommunity(post: CommunityPost, community: CommunityDisplay) {
  const slug = community.slug;
  if (post.communitySlug) return post.communitySlug === slug;
  const titleBody = `${post.title} ${post.body} ${post.subTrade ?? ""} ${post.subLocation ?? ""}`;
  const tradeSlug = communitySlug(post.trade === "General" ? "General Talk" : `${post.trade} Talk`);

  if (slug === tradeSlug) return true;
  if (slug === "side-work") return post.type === "sub-request" || textIncludesAny(titleBody, ["side work", "weekend", "sub", "helper"]);
  if (slug === "jacksonville-trades") return textIncludesAny(titleBody, ["jacksonville", "jax", "beach", "st. johns", "orange park"]);
  if (slug === "remodelers") return textIncludesAny(titleBody, ["remodel", "renovation", "bath", "kitchen", "whole home"]);
  if (slug === "cabinetry-talk") return post.trade === "Cabinetry";
  if (slug === "tile-talk") return post.trade === "Tile";
  if (slug === "carpentry-talk") return post.trade === "Carpentry" || post.trade === "Framing";
  return false;
}

function ShopTalkNewPostModal({
  profile,
  selectedJobTrade,
  initialFlair = "Question",
  initialTitle = "",
  initialBody = "",
  communities,
  initialCommunitySlug,
  onClose,
  onSubmit,
}: {
  profile: AccountProfile;
  selectedJobTrade: Trade | "General";
  initialFlair?: PostFlair;
  initialTitle?: string;
  initialBody?: string;
  communities: CommunityDisplay[];
  initialCommunitySlug?: string | null;
  onClose: () => void;
  onSubmit: (flair: PostFlair, title: string, trade: Trade | "General", body: string, postType: PostType, subTrade?: string, subLocation?: string, subRate?: string, communitySlug?: string | null, photoFile?: File | null) => void;
}) {
  const posterDefaultTrade = profile.specialties[0] ?? selectedJobTrade;
  const initialPostCommunitySlug = initialCommunitySlug ?? communities[0]?.slug ?? null;
  const initialPostCommunity = communities.find((community) => community.slug === initialPostCommunitySlug) ?? null;
  const [flair, setFlair] = useState<PostFlair>(initialFlair);
  const [title, setTitle] = useState(initialTitle);
  const [trade, setTrade] = useState<Trade | "General">(() => inferCommunityDefaultTrade(initialPostCommunity, posterDefaultTrade));
  const [selectedPostCommunitySlug, setSelectedPostCommunitySlug] = useState<string | null>(initialPostCommunitySlug);
  const [body, setBody] = useState(initialBody);
  const [postType, setPostType] = useState<PostType>("general");
  const [subTrade, setSubTrade] = useState("");
  const [subLocation, setSubLocation] = useState("");
  const [subRate, setSubRate] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoError, setPhotoError] = useState("");
  const canSubmit = title.trim().length > 0 && (body.trim().length > 0 || Boolean(photoFile));
  const tradeOptions: (Trade | "General")[] = ["General", ...specialtyOptions];
  const photoPreviewUrl = useMemo(() => photoFile ? URL.createObjectURL(photoFile) : null, [photoFile]);

  useEffect(() => {
    return () => {
      if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    };
  }, [photoPreviewUrl]);

  function handlePhotoSelected(file: File | undefined) {
    setPhotoError("");
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setPhotoError("Choose an image file.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setPhotoError("Photos must be 10 MB or less.");
      return;
    }
    setPhotoFile(file);
  }

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
          <span>Community</span>
          <select
            value={selectedPostCommunitySlug ?? ""}
            onChange={(e) => {
              const nextSlug = e.target.value || null;
              const nextCommunity = communities.find((community) => community.slug === nextSlug) ?? null;
              setSelectedPostCommunitySlug(nextSlug);
              setTrade(inferCommunityDefaultTrade(nextCommunity, posterDefaultTrade));
            }}
          >
            {communities.map((community) => (
              <option key={community.slug} value={community.slug}>{community.name}</option>
            ))}
          </select>
        </label>

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

        <div className="shop-post-media-picker">
          <input
            id="shop-talk-photo-upload"
            type="file"
            accept="image/*"
            onChange={(event) => handlePhotoSelected(event.target.files?.[0])}
          />
          <label htmlFor="shop-talk-photo-upload" className="shop-post-media-button">
            <ImagePlus size={16} />
            {photoFile ? "Change photo" : "Add photo"}
          </label>
          {photoFile && (
            <button
              type="button"
              className="shop-post-media-remove"
              onClick={() => {
                setPhotoFile(null);
                setPhotoError("");
              }}
            >
              <Trash2 size={15} />
              Remove
            </button>
          )}
        </div>
        {photoError && <p className="shop-post-media-error">{photoError}</p>}
        {photoPreviewUrl && (
          <figure className="shop-post-photo-preview">
            <img src={photoPreviewUrl} alt={photoFile?.name ?? "Selected Shop Talk post"} />
            <figcaption>{photoFile?.name}</figcaption>
          </figure>
        )}

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
                  selectedPostCommunitySlug,
                  photoFile,
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
  communities,
  newsItems,
  initialQuery,
  initialPostId,
  initialCommunitySlug,
  initialAnswerQueue,
  openComposer,
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
  onReportAnswer,
  onReportCommunity,
  onNewPost,
  onDeletePost,
  onCommunityCreated,
}: {
  profile: AccountProfile;
  communityPosts: CommunityPost[];
  communities: CommunityDisplay[];
  newsItems: NewsItem[];
  initialQuery: string;
  initialPostId?: string | null;
  initialCommunitySlug?: string | null;
  initialAnswerQueue?: boolean;
  openComposer?: boolean;
  selectedJobTrade: Trade | "General";
  userLocation: string;
  getPostReactionState: (post: CommunityPost) => CommunityReactionState;
  getAnswerReactionState: (postId: string, answer: CommunityAnswer) => CommunityReactionState;
  reactionSummary: CommunityReactionSummary | null;
  reactionStatus: CommunityReactionSyncStatus;
  onVotePost: (postId: string, direction: "up" | "down") => void;
  onVoteAnswer: (postId: string, answerId: string, direction: "up" | "down") => void;
  onAddAnswer: (postId: string, body: string) => void | Promise<void>;
  onVerifyAnswer: (postId: string, answerId: string) => void | Promise<void>;
  onReportPost: (postId: string, reason: CommunityReport["reason"], note?: string) => void | Promise<void>;
  onReportAnswer: (postId: string, answerId: string, reason: CommunityReport["reason"], note?: string) => void | Promise<void>;
  onReportCommunity: (community: CommunityDisplay, reason: CommunityReport["reason"], note?: string) => void | Promise<void>;
  onNewPost: (flair: PostFlair, title: string, trade: Trade | "General", body: string, postType: PostType, subTrade?: string, subLocation?: string, subRate?: string, communitySlug?: string | null, photoFile?: File | null) => void | Promise<void>;
  onDeletePost: (postId: string) => boolean | Promise<boolean>;
  onCommunityCreated: (community: ServerCommunity) => void;
}) {
  const persona = usePersona();
  const [activeTab, setActiveTab] = useState<"talk" | "news">("talk");
  const [sortMode, setSortMode] = useState<"hot" | "new" | "unanswered">(initialAnswerQueue ? "unanswered" : "hot");
  const [tradeFilter, setTradeFilter] = useState("All trades");
  const [answerQueueOnly, setAnswerQueueOnly] = useState(Boolean(initialAnswerQueue));
  const [selectedPostId, setSelectedPostId] = useState<string | null>(initialPostId ?? communityPosts[0]?.id ?? null);
  const [answerDraft, setAnswerDraft] = useState("");
  const [newPostOpen, setNewPostOpen] = useState(Boolean(openComposer));
  const [joinedCommunities, setJoinedCommunities] = useState<Set<string>>(() => {
    return readStringSet("rivt.joinedCommunities.v1", communitySlug);
  });
  const [communityQuery, setCommunityQuery] = useState("");
  const [communityCreateError, setCommunityCreateError] = useState<string | null>(null);
  const [communityCreateBusy, setCommunityCreateBusy] = useState(false);
  const [duplicateCommunityCandidates, setDuplicateCommunityCandidates] = useState<ServerCommunity[]>([]);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);
  const [selectedCommunitySlug, setSelectedCommunitySlug] = useState<string | null>(initialCommunitySlug ?? null);
  const [talkQuery, setTalkQuery] = useState(() => initialQuery.trim());
  const [newsQuery, setNewsQuery] = useState("");
  const [liveNews, setLiveNews] = useState<NewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsFetched, setNewsFetched] = useState(false);
  const [flairFilter, setFlairFilter] = useState<PostFlair | "All">("All");
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(() => readStringSet("rivt.shopTalkBookmarks.v1"));
  const [showBookmarked, setShowBookmarked] = useState(false);
  const [helpfulVotesMap, setHelpfulVotesMap] = useState<Record<string, number>>(() => {
    try { return JSON.parse(localStorage.getItem("rivt.shopTalk.v1") ?? "{}") as Record<string, number>; }
    catch { return {}; }
  });
  const [activeTrendingTag, setActiveTrendingTag] = useState<string | null>(null);
  const [locallyAnswered, setLocallyAnswered] = useState<Set<string>>(new Set());
  const [filterType, setFilterType] = useState<PostType | "all">("all");
  const displayNews = liveNews.length ? liveNews : newsItems;
  const [selectedNewsId, setSelectedNewsId] = useState(displayNews[0]?.id ?? 0);
  const [mobileDetail, setMobileDetail] = useState(initialPostId != null || Boolean(initialAnswerQueue));
  const [newsDiscussContext, setNewsDiscussContext] = useState<NewsItem | null>(null);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [reportReason, setReportReason] = useState<CommunityReportReason>("Safety concern");
  const [reportNote, setReportNote] = useState("");
  const [reportBusy, setReportBusy] = useState(false);
  const serverCommunitiesLoaded = communities.some((community) => community.serverOwned);

  useEffect(() => {
    if (!serverCommunitiesLoaded) return;
    const next = new Set(communities.filter((community) => community.joined).map((community) => community.slug));
    /* eslint-disable react-hooks/set-state-in-effect */
    setJoinedCommunities(next);
    /* eslint-enable react-hooks/set-state-in-effect */
    try { localStorage.setItem("rivt.joinedCommunities.v1", JSON.stringify([...next])); } catch { /* ignore */ }
  }, [communities, serverCommunitiesLoaded]);

  const tradeFilters = ["All trades", "General", ...specialtyOptions];
  const primaryTrade = profile.specialties[0] ?? selectedJobTrade;
  const selectedCommunity = communities.find((community) => community.slug === selectedCommunitySlug) ?? null;
  const communityPostCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const community of communities) {
      counts[community.slug] = communityPosts.filter((post) => postBelongsToCommunity(post, community)).length;
    }
    return counts;
  }, [communities, communityPosts]);
  const filteredCommunities = useMemo(() => {
    const normalized = communityQuery.trim().toLowerCase();
    if (!normalized) return communities;
    return communities.filter((community) => (
      [community.name, community.meta, community.slug].join(" ").toLowerCase().includes(normalized)
    ));
  }, [communities, communityQuery]);
  const canStartCommunity = communityQuery.trim().length >= 2 &&
    !communities.some((community) => community.slug === communitySlug(communityQuery));
  const answerQueuePosts = useMemo(() => communityPosts
    .filter((post) => (
      (post.trade === primaryTrade || post.trade === "General") &&
      post.status !== "Verified Fix"
    ))
    .sort((a, b) => {
      if (a.trade === primaryTrade && b.trade !== primaryTrade) return -1;
      if (a.trade !== primaryTrade && b.trade === primaryTrade) return 1;
      if (a.status === "Needs a pro answer" && b.status !== "Needs a pro answer") return -1;
      if (a.status !== "Needs a pro answer" && b.status === "Needs a pro answer") return 1;
      return postSortValue(b) - postSortValue(a);
    }), [communityPosts, primaryTrade]);

  useEffect(() => {
    if (!initialAnswerQueue) return;
    const nextPost = answerQueuePosts[0];
    if (!nextPost) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setSelectedPostId(nextPost.id);
    setMobileDetail(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [answerQueuePosts, initialAnswerQueue]);
  function toggleBookmark(postId: string) {
    setBookmarkedIds(prev => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId); else next.add(postId);
      try { localStorage.setItem("rivt.shopTalkBookmarks.v1", JSON.stringify([...next])); } catch { /* noop */ }
      return next;
    });
  }

  function openCommunity(community: CommunityDisplay) {
    const communityPostsForView = communityPosts.filter((post) => postBelongsToCommunity(post, community));
    setSelectedCommunitySlug(community.slug);
    setTalkQuery("");
    setTradeFilter("All trades");
    setActiveTrendingTag(null);
    setAnswerQueueOnly(false);
    setShowBookmarked(false);
    setFlairFilter("All");
    setFilterType("all");
    setSortMode("hot");
    setMobileDetail(false);
    if (communityPostsForView[0]) setSelectedPostId(communityPostsForView[0].id);
  }

  async function handleCreateCommunity(confirmDuplicate = false) {
    const name = communityQuery.trim();
    if (name.length < 2) return;
    setCommunityCreateBusy(true);
    setCommunityCreateError(null);
    setDuplicateCommunityCandidates([]);
    try {
      const result = await createCommunity({
        name,
        description: `${name} community`,
        confirmDuplicate,
      });
      if (result?.community) {
        onCommunityCreated(result.community);
        setSelectedCommunitySlug(result.community.slug);
        setCommunityQuery("");
        return;
      }
      if (result?.duplicateCandidates?.length) {
        setDuplicateCommunityCandidates(result.duplicateCandidates);
        setCommunityCreateError(result.error ?? "A similar community already exists.");
        return;
      }
      setCommunityCreateError(result?.error ?? "Community could not be created.");
    } finally {
      setCommunityCreateBusy(false);
    }
  }

  function closeCommunity() {
    setSelectedCommunitySlug(null);
    setCommunityQuery("");
    setMobileDetail(false);
  }

  function openReport(target: ReportTarget, defaultReason: CommunityReportReason = "Safety concern") {
    setReportTarget(target);
    setReportReason(defaultReason);
    setReportNote("");
  }

  async function submitReport() {
    if (!reportTarget) return;
    setReportBusy(true);
    const note = reportNote.trim();
    try {
      if (reportTarget.kind === "post") {
        await onReportPost(reportTarget.postId, reportReason, note || undefined);
      } else if (reportTarget.kind === "answer") {
        await onReportAnswer(reportTarget.postId, reportTarget.answerId, reportReason, note || undefined);
      } else {
        await onReportCommunity(reportTarget.community, reportReason, note || undefined);
      }
      setReportTarget(null);
    } finally {
      setReportBusy(false);
    }
  }

  function _incrementHelpfulVote(postId: string) {
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
    if (selectedCommunity && !postBelongsToCommunity(post, selectedCommunity)) return false;
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
    if (sortMode === "new") return postSortValue(b) - postSortValue(a);
    if (sortMode === "unanswered") {
      if (a.replies.length === 0 && b.replies.length > 0) return -1;
      if (a.replies.length > 0 && b.replies.length === 0) return 1;
      return postSortValue(b) - postSortValue(a);
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
  const canDeleteSelectedPost = Boolean(selectedPost && selectedPost.author === profile.displayName && !selectedPost.badge);
  const SelectedCommunityIcon = selectedCommunity?.icon;
  const _selectedTradeThreads = filteredPosts.filter((post) => post.trade === selectedJobTrade || post.trade === "General");
  const _reactionLedgerLabel = reactionStatus === "ready"
    ? "Server-backed"
    : reactionStatus === "loading"
      ? "Syncing"
      : reactionStatus === "error"
        ? "Offline"
        : "Not loaded";

  async function handleDeleteSelectedPost() {
    if (!selectedPost) return;
    const confirmed = window.confirm("Delete this Shop Talk post? It will be removed from the feed and any attached photo will be removed from active records.");
    if (!confirmed) return;
    setDeletingPostId(selectedPost.id);
    try {
      const deleted = await onDeletePost(selectedPost.id);
      if (deleted) {
        setSelectedPostId(null);
        setMobileDetail(false);
      }
    } finally {
      setDeletingPostId(null);
    }
  }

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
    void onAddAnswer(selectedPost.id, body);
    setAnswerDraft("");
  }

  return (
    <>
      {newPostOpen && (
        <ShopTalkNewPostModal
          profile={profile}
          selectedJobTrade={selectedJobTrade}
          communities={communities}
          initialCommunitySlug={selectedCommunitySlug}
          initialFlair={newsDiscussContext ? "Discussion" : "Question"}
          initialTitle={newsDiscussContext ? newsDiscussContext.headline.slice(0, 120) : ""}
          initialBody={newsDiscussContext ? `Via ${newsDiscussContext.source} · ${newsDiscussContext.date}\n\n` : ""}
          onClose={() => { setNewPostOpen(false); setNewsDiscussContext(null); }}
          onSubmit={(flair, title, trade, body, postType, subTrade, subLocation, subRate, communitySlug, photoFile) => {
            void onNewPost(flair, title, trade, body, postType, subTrade, subLocation, subRate, communitySlug, photoFile);
            setNewPostOpen(false);
            setNewsDiscussContext(null);
          }}
        />
      )}
      <section
        className={`${mobileDetail ? "shop-talk-layout shop-talk-community-layout mobile-detail-open" : "shop-talk-layout shop-talk-community-layout"}${selectedCommunity ? " community-open" : ""}`}
        aria-label="Shop Talk community"
      >
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
              {selectedCommunity && SelectedCommunityIcon ? (
                <section className="community-page-card" aria-label={`${selectedCommunity.name} community`}>
                  <div className="community-page-main">
                    <span className="community-row-icon" style={{ background: selectedCommunity.tone }}>
                      <SelectedCommunityIcon size={24} strokeWidth={2.4} />
                    </span>
                    <div>
                      <button type="button" className="community-back-link" onClick={closeCommunity}>
                        <ArrowLeft size={13} />
                        All communities
                      </button>
                      <h2>{selectedCommunity.name}</h2>
                      <p>{selectedCommunity.meta}</p>
                      <div className="community-page-stats">
                        <span>{selectedCommunity.count} members</span>
                        <span>{communityPostCounts[selectedCommunity.slug] ?? 0} posts</span>
                        <span>{joinedCommunities.has(selectedCommunity.slug) ? "Joined" : "Open community"}</span>
                      </div>
                    </div>
                  </div>
                  <div className="community-page-actions">
                    <button
                      type="button"
                      className={joinedCommunities.has(selectedCommunity.slug) ? "community-join is-joined" : "community-join"}
                      aria-pressed={joinedCommunities.has(selectedCommunity.slug)}
                      onClick={() => {
                        const willJoin = !joinedCommunities.has(selectedCommunity.slug);
                        void setCommunityMembership(selectedCommunity.slug, willJoin);
                        setJoinedCommunities((prev) => {
                          const next = new Set(prev);
                          if (next.has(selectedCommunity.slug)) next.delete(selectedCommunity.slug);
                          else next.add(selectedCommunity.slug);
                          try { localStorage.setItem("rivt.joinedCommunities.v1", JSON.stringify([...next])); } catch { /* ignore */ }
                          return next;
                        });
                      }}
                    >
                      {joinedCommunities.has(selectedCommunity.slug) ? "Joined" : "Join"}
                    </button>
                    {selectedCommunity.serverOwned && (
                      <button
                        type="button"
                        className="community-report"
                        onClick={() => openReport({
                          kind: "community",
                          community: selectedCommunity,
                          title: selectedCommunity.name,
                          description: selectedCommunity.meta || "Report a community for spam, abuse, unsafe content, or off-topic activity.",
                        }, "Spam")}
                      >
                        <Flag size={13} />
                        Report
                      </button>
                    )}
                  </div>
                </section>
              ) : null}

              {!selectedCommunity ? (
              <section className="community-board" aria-label="Discover communities">
                <div className="community-board-head">
                  <strong>{selectedCommunity ? "Discover more" : "Discover communities"}</strong>
                  <span>{joinedCommunities.size} joined</span>
                </div>
                <label className="community-discover-search">
                  <Search size={14} />
                  <span className="sr-only">Search communities</span>
                  <input
                    type="search"
                    value={communityQuery}
                    onChange={(event) => setCommunityQuery(event.target.value)}
                    placeholder="Search communities"
                  />
                </label>
                <div className="community-board-list">
                  {filteredCommunities.length === 0 ? (
                    <div className="community-empty">
                      <strong>No communities found</strong>
                      <span>Try a trade, city, or topic like tile, side work, or code.</span>
                      {canStartCommunity && (
                        <button type="button" className="primary-action" onClick={() => void handleCreateCommunity()} disabled={communityCreateBusy}>
                          <Plus size={14} />
                          Start "{communityQuery.trim()}"
                        </button>
                      )}
                    </div>
                  ) : filteredCommunities.map((community) => {
                    const CIcon = community.icon;
                    const joined = joinedCommunities.has(community.slug);
                    return (
                      <div key={community.name} className={selectedCommunitySlug === community.slug ? "community-row is-active" : "community-row"}>
                        <button
                          type="button"
                          className="community-row-main"
                          onClick={() => openCommunity(community)}
                        >
                          <span className="community-row-icon" style={{ background: community.tone }}>
                            <CIcon size={20} strokeWidth={2.4} />
                          </span>
                          <span className="community-row-copy">
                            <b>{community.name}</b>
                            <small>{community.count} members · {communityPostCounts[community.slug] ?? 0} posts · {community.meta}</small>
                          </span>
                        </button>
                        <button
                          type="button"
                          className={joined ? "community-join is-joined" : "community-join"}
                          aria-pressed={joined}
                          onClick={() => {
                            const willJoin = !joinedCommunities.has(community.slug);
                            void setCommunityMembership(community.slug, willJoin);
                            setJoinedCommunities((prev) => {
                              const next = new Set(prev);
                              if (next.has(community.slug)) next.delete(community.slug);
                              else next.add(community.slug);
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
                {communityCreateError && (
                  <div className="community-create-feedback" role="status">
                    <strong>{communityCreateError}</strong>
                    {duplicateCommunityCandidates.length > 0 && (
                      <>
                        <div className="community-duplicate-list">
                          {duplicateCommunityCandidates.map((candidate) => (
                            <button
                              type="button"
                              key={candidate.slug}
                              onClick={() => {
                                const match = communities.find((community) => community.slug === candidate.slug);
                                if (match) openCommunity(match);
                              }}
                            >
                              Join {candidate.name}
                            </button>
                          ))}
                        </div>
                        <button type="button" className="secondary-action" onClick={() => void handleCreateCommunity(true)} disabled={communityCreateBusy}>
                          Create separate community anyway
                        </button>
                      </>
                    )}
                  </div>
                )}
                {filteredCommunities.length > 0 && canStartCommunity && (
                  <button type="button" className="community-start-button" onClick={() => void handleCreateCommunity()} disabled={communityCreateBusy}>
                    <Plus size={14} />
                    Start "{communityQuery.trim()}"
                  </button>
                )}
              </section>
              ) : null}

              <div className="shop-talk-fieldbar" aria-label="Shop Talk filters">
                <label className="shop-talk-search">
                  <Search size={15} />
                  <span className="sr-only">Search Shop Talk</span>
                  <input
                    type="search"
                    value={talkQuery}
                    onChange={(event) => setTalkQuery(event.target.value)}
                    placeholder={selectedCommunity ? `Search ${selectedCommunity.name}` : "Search Shop Talk"}
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
                    title="No matching Shop Talk posts"
                    description={talkQuery ? "Clear the search or broaden the trade filter." : "Use the Ask button when you're ready to start the first post in this lane."}
                    actionLabel={talkQuery ? "Clear search" : undefined}
                    onAction={talkQuery ? () => setTalkQuery("") : undefined}
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
              <button type="button" className="shop-talk-fab" onClick={() => setNewPostOpen(true)}>
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
                  {selectedPost.body && <p>{selectedPost.body}</p>}
                  {selectedPost.thumbnailUrl && (
                    <figure className="shop-question-media">
                      <img
                        src={selectedPost.thumbnailUrl}
                        alt={selectedPost.thumbnailAlt ?? ""}
                        loading="lazy"
                      />
                    </figure>
                  )}
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
                  {canDeleteSelectedPost && (
                    <button
                      type="button"
                      className="shop-detail-delete"
                      aria-label="Delete this post"
                      disabled={deletingPostId === selectedPost.id}
                      onClick={() => void handleDeleteSelectedPost()}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
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
                <button
                  type="button"
                  onClick={() => openReport({
                    kind: "post",
                    postId: selectedPost.id,
                    title: selectedPost.title,
                    description: "Report a Shop Talk post for unsafe advice, spam, harassment, misinformation, or other review needs.",
                  })}
                >
                  <Flag size={15} />
                  Report
                </button>
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
                    <span>Answer it, then mark the best response as the Verified Fix.</span>
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
                        {(selectedPost.author === profile.displayName || answer.verifiedFix) && (
                          <button type="button" disabled={answer.verifiedFix} onClick={() => { void onVerifyAnswer(selectedPost.id, answer.id); }}>
                            <BadgeCheck size={14} />
                            {answer.verifiedFix ? "Verified" : "Mark fix"}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openReport({
                            kind: "answer",
                            postId: selectedPost.id,
                            answerId: answer.id,
                            title: `Answer from ${answer.author}`,
                            description: selectedPost.title,
                          })}
                        >
                          <Flag size={14} />
                          Report
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
                description="Use the Ask button when you're ready to start the first field question."
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
                  <strong>Discuss this in Shop Talk</strong>
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
      {reportTarget ? (
        <ReportSheet
          target={reportTarget}
          selectedReason={reportReason}
          note={reportNote}
          busy={reportBusy}
          onReasonChange={setReportReason}
          onNoteChange={setReportNote}
          onSubmit={() => { void submitReport(); }}
          onClose={() => setReportTarget(null)}
        />
      ) : null}
    </>
  );
}

