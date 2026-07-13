import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
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
  RefreshCw,
  Search,
  Send,
  SlidersHorizontal,
  Star,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { TradePostCard } from "./TradePostCard";
import {
  communitySlug,
  createCommunity,
  setCommunityMembership,
  type CommunityAudience,
  type ServerCommunity,
} from "./communities-api";
import {
  communityAudienceDescription,
  roleCanAccessCommunity,
  type CommunityDisplay,
} from "./community-directory";
import { tradeOptions } from "../../data";
import type { Role, Trade } from "../../types";
import { usePersona } from "../persona/usePersona";
import {
  communityBadgeLabelsFromReputation,
  inferCommunityDefaultTrade,
  netScore,
  sortedAnswers,
  type CommunityBadgeThresholds,
} from "./community-utils";
import { apiPath, fetchWithTimeout } from "../../lib/api";
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
  communityAudience?: CommunityAudience;
}

export type PostFlair = "Question" | "Discussion" | "Code Talk" | "Compliance" | "Tip" | "Humor";
export type CommunityReaction = "up" | "down";

export interface CommunityReactionSummary {
  reactionsGiven: number;
  upvotesGiven: number;
  downvotesGiven: number;
  targetsReacted: number;
  lastReactedAt: string | null;
  upvotesEarned: number;
  downvotesEarned: number;
  earnedScore: number;
  verifiedFixes: number;
  qualityAnswers: number;
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

function pluralize(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
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

const SHOP_TALK_FILTER_PREFS_KEY = "rivt.shopTalkFilters.v1";

interface ShopTalkFilterPrefs {
  sortMode: "hot" | "new" | "unanswered";
  tradeFilter: string;
  flairFilter: PostFlair | "All";
  filterType: PostType | "all";
}

function readShopTalkFilterPrefs(): ShopTalkFilterPrefs {
  const fallback: ShopTalkFilterPrefs = {
    sortMode: "hot",
    tradeFilter: "All trades",
    flairFilter: "All",
    filterType: "all",
  };
  try {
    const parsed = JSON.parse(localStorage.getItem(SHOP_TALK_FILTER_PREFS_KEY) ?? "null") as Partial<ShopTalkFilterPrefs> | null;
    if (!parsed || typeof parsed !== "object") return fallback;
    const sortMode = parsed.sortMode === "new" || parsed.sortMode === "unanswered" ? parsed.sortMode : fallback.sortMode;
    return {
      sortMode,
      tradeFilter: typeof parsed.tradeFilter === "string" ? parsed.tradeFilter : fallback.tradeFilter,
      flairFilter: typeof parsed.flairFilter === "string" ? parsed.flairFilter as PostFlair | "All" : fallback.flairFilter,
      filterType: typeof parsed.filterType === "string" ? parsed.filterType as PostType | "all" : fallback.filterType,
    };
  } catch {
    return fallback;
  }
}

function writeShopTalkFilterPrefs(next: ShopTalkFilterPrefs) {
  try { localStorage.setItem(SHOP_TALK_FILTER_PREFS_KEY, JSON.stringify(next)); } catch { /* harmless preference */ }
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

        <div className="new-post-modal-body">
          <div className="v2-st-type-selector">
            {POST_TYPE_CHIPS.map((chip) => (
              <button
                key={chip.type}
                type="button"
                className={`v2-st-type-chip${postType === chip.type ? " is-active" : ""}`}
                onClick={() => setPostType(chip.type)}
              >
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
        </div>

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
  onLoadPost,
  role,
  isGuest = false,
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
  onLoadPost: (postId: string) => Promise<CommunityPost | null>;
  role: Role;
  isGuest?: boolean;
}) {
  const persona = usePersona();
  const [activeTab, setActiveTab] = useState<"talk" | "communities" | "news">("talk");
  const [sortMode, setSortMode] = useState<"hot" | "new" | "unanswered">(() => (
    initialAnswerQueue ? "unanswered" : readShopTalkFilterPrefs().sortMode
  ));
  const [tradeFilter, setTradeFilter] = useState(() => readShopTalkFilterPrefs().tradeFilter);
  const [answerQueueOnly, setAnswerQueueOnly] = useState(Boolean(initialAnswerQueue));
  // Desktop opens on the feed. A thread is a deliberate second step unless a
  // deep link or answer queue has already named the exact post to open.
  const [selectedPostId, setSelectedPostId] = useState<string | null>(initialPostId ?? null);
  const attemptedDeepLinkPostIds = useRef(new Set<string>());
  const [answerDraft, setAnswerDraft] = useState("");
  const [newPostOpen, setNewPostOpen] = useState(Boolean(openComposer));
  const [joinedCommunities, setJoinedCommunities] = useState<Set<string>>(() => {
    return readStringSet("rivt.joinedCommunities.v1", communitySlug);
  });
  const [communityQuery, setCommunityQuery] = useState("");
  const [communityCreateOpen, setCommunityCreateOpen] = useState(false);
  const [communityCreateError, setCommunityCreateError] = useState<string | null>(null);
  const [communityCreateBusy, setCommunityCreateBusy] = useState(false);
  const [communityCreateAudience, setCommunityCreateAudience] = useState<CommunityAudience>("public");
  const [duplicateCommunityCandidates, setDuplicateCommunityCandidates] = useState<ServerCommunity[]>([]);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);
  const [selectedCommunitySlug, setSelectedCommunitySlug] = useState<string | null>(initialCommunitySlug ?? null);
  const [talkQuery, setTalkQuery] = useState(() => initialQuery.trim());
  const [newsQuery, setNewsQuery] = useState("");
  const [liveNews, setLiveNews] = useState<NewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsFetched, setNewsFetched] = useState(false);
  const [newsIsFallback, setNewsIsFallback] = useState(false);
  const [flairFilter, setFlairFilter] = useState<PostFlair | "All">(() => readShopTalkFilterPrefs().flairFilter);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(() => readStringSet("rivt.shopTalkBookmarks.v1"));
  const [showBookmarked, setShowBookmarked] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Legacy tag filters are intentionally dormant while the single filter sheet is active.
  const [activeTrendingTag, setActiveTrendingTag] = useState<string | null>(null);
  const trendingTags: string[] = [];
  const [locallyAnswered, setLocallyAnswered] = useState<Set<string>>(new Set());
  const [filterType, setFilterType] = useState<PostType | "all">(() => readShopTalkFilterPrefs().filterType);
  const displayNews = liveNews.length ? liveNews : newsItems;
  const [selectedNewsId, setSelectedNewsId] = useState(displayNews[0]?.id ?? 0);
  const [mobileDetail, setMobileDetail] = useState(initialPostId != null || Boolean(initialAnswerQueue));
  const [newsDiscussContext, setNewsDiscussContext] = useState<NewsItem | null>(null);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [reportReason, setReportReason] = useState<CommunityReportReason>("Safety concern");
  const [reportNote, setReportNote] = useState("");
  const [reportBusy, setReportBusy] = useState(false);
  useEffect(() => {
    if (answerQueueOnly) return;
    writeShopTalkFilterPrefs({ sortMode, tradeFilter, flairFilter, filterType });
  }, [answerQueueOnly, flairFilter, filterType, sortMode, tradeFilter]);
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
  const canCreateCommunity = !isGuest;
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
    setSelectedCommunitySlug(community.slug);
    setTalkQuery("");
    setTradeFilter("All trades");
    setAnswerQueueOnly(false);
    setShowBookmarked(false);
    setFlairFilter("All");
    setFilterType("all");
    setSortMode("hot");
    setMobileDetail(false);
    setSelectedPostId(null);
    setActiveTab("talk");
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
        audience: communityCreateAudience,
        confirmDuplicate,
      });
      if (result?.community) {
        onCommunityCreated(result.community);
        setSelectedCommunitySlug(result.community.slug);
        setCommunityQuery("");
        setCommunityCreateOpen(false);
        setActiveTab("talk");
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

  async function toggleCommunityMembership(community: CommunityDisplay) {
    const joined = joinedCommunities.has(community.slug);
    const willJoin = !joined;
    if (willJoin && !roleCanAccessCommunity(community.audience, role)) {
      setCommunityCreateError(communityAudienceDescription(community.audience));
      return;
    }
    setCommunityCreateError(null);
    setJoinedCommunities((prev) => {
      const next = new Set(prev);
      if (willJoin) next.add(community.slug);
      else next.delete(community.slug);
      try { localStorage.setItem("rivt.joinedCommunities.v1", JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
    const saved = await setCommunityMembership(community.slug, willJoin);
    if (saved) return;
    setJoinedCommunities((prev) => {
      const next = new Set(prev);
      if (willJoin) next.delete(community.slug);
      else next.add(community.slug);
      try { localStorage.setItem("rivt.joinedCommunities.v1", JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
    setCommunityCreateError(willJoin
      ? "That community could not be joined. It may be restricted or temporarily unavailable."
      : "That community could not be left. Try again in a minute.");
  }

  function closeCommunity() {
    setSelectedCommunitySlug(null);
    setCommunityQuery("");
    setMobileDetail(false);
    setActiveTab("communities");
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

  async function activateNews(forceRefresh = false) {
    setActiveTab("news");
    if (newsFetched && !forceRefresh) return;
    setNewsLoading(true);
    try {
      const response = await fetchWithTimeout(apiPath(`/api/news?location=${encodeURIComponent(userLocation)}${forceRefresh ? "&refresh=1" : ""}`));
      const data = await response.json() as { items?: NewsItem[]; fallback?: boolean };
      const items = Array.isArray(data.items) && data.items.length > 0 ? data.items : newsItems;
      setLiveNews(items);
      setNewsIsFallback(data.fallback === true || !Array.isArray(data.items) || data.items.length === 0);
      setSelectedNewsId(items[0]?.id ?? 0);
    } catch {
      setLiveNews(newsItems);
      setNewsIsFallback(true);
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
  const selectedPost = communityPosts.find((p) => p.id === selectedPostId) ?? null;
  const selectedNews = filteredNews.find((n) => n.id === selectedNewsId) ?? filteredNews[0];
  const profileBadges = communityBadgeLabelsFromReputation(_reactionSummary, communityBadgeThresholds);
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
  const myTotalRep = _reactionSummary?.earnedScore ?? 0;

  useEffect(() => {
    if (!initialPostId || communityPosts.some((post) => post.id === initialPostId)) return;
    if (attemptedDeepLinkPostIds.current.has(initialPostId)) return;
    attemptedDeepLinkPostIds.current.add(initialPostId);
    void onLoadPost(initialPostId);
  }, [communityPosts, initialPostId, onLoadPost]);

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
        className={`${mobileDetail ? "shop-talk-layout shop-talk-community-layout mobile-detail-open" : "shop-talk-layout shop-talk-community-layout"}${selectedCommunity ? " community-open" : ""}${selectedPost ? " thread-selected" : ""}`}
        aria-label="Shop Talk community"
      >
        <div className="shop-talk-tabs shop-talk-primary-tabs">
          <button
            type="button"
            className={activeTab === "talk" ? "active" : ""}
            onClick={() => setActiveTab("talk")}
          >
            <MessageCircle size={14} />
            Feed
          </button>
          <button
            type="button"
            className={activeTab === "communities" ? "active" : ""}
            onClick={() => setActiveTab("communities")}
          >
            <UsersRound size={14} />
            Communities
          </button>
          <button
            type="button"
            className={activeTab === "news" ? "active" : ""}
            onClick={() => void activateNews()}
          >
            <Newspaper size={14} />
            Trade News
          </button>
        </div>
        <aside className="shop-talk-sidebar">
          {activeTab === "talk" && selectedCommunity ? (
            <>
              {SelectedCommunityIcon ? (
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
                        <span>{pluralize(selectedCommunity.memberCount, "member")}</span>
                        <span>{pluralize(communityPostCounts[selectedCommunity.slug] ?? 0, "post")}</span>
                        <span>{selectedCommunity.audienceLabel}</span>
                        <span>{joinedCommunities.has(selectedCommunity.slug) ? "Joined" : "Not joined"}</span>
                      </div>
                    </div>
                  </div>
                  <div className="community-page-actions">
                    <button
                      type="button"
                      className={joinedCommunities.has(selectedCommunity.slug) ? "community-join is-joined" : "community-join"}
                      aria-pressed={joinedCommunities.has(selectedCommunity.slug)}
                      disabled={!joinedCommunities.has(selectedCommunity.slug) && !roleCanAccessCommunity(selectedCommunity.audience, role)}
                      onClick={() => { void toggleCommunityMembership(selectedCommunity); }}
                    >
                      {joinedCommunities.has(selectedCommunity.slug)
                        ? "Joined"
                        : roleCanAccessCommunity(selectedCommunity.audience, role)
                          ? "Join"
                          : selectedCommunity.audienceLabel}
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

            </>
          ) : null}
        </aside>

        <main className="shop-talk-feed-panel" aria-label={activeTab === "talk" ? "Shop Talk feed" : activeTab === "communities" ? "Community directory" : "Trade News feed"}>
          {activeTab === "talk" ? (
            <>
              <div className="shop-talk-feed-toolbar" aria-label="Shop Talk feed controls">
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
                <button
                  type="button"
                  className={filtersOpen ? "shop-talk-filter-trigger is-active" : "shop-talk-filter-trigger"}
                  aria-expanded={filtersOpen}
                  onClick={() => setFiltersOpen((open) => !open)}
                >
                  <SlidersHorizontal size={16} />
                  Filters
                </button>
                <button type="button" className="shop-talk-compose-trigger" onClick={() => setNewPostOpen(true)}>
                  <Plus size={17} />
                  <span>Post</span>
                </button>
              </div>

              {filtersOpen && (
                <section className="shop-talk-filter-panel" aria-label="Shop Talk filters">
                  <div className="shop-talk-filter-grid">
                    <label className="input-control">
                      <span>Trade</span>
                      <select value={tradeFilter} onChange={(event) => setTradeFilter(event.target.value)}>
                        {tradeFilters.map((option) => <option key={option}>{option}</option>)}
                      </select>
                    </label>
                    <label className="input-control">
                      <span>Post style</span>
                      <select value={flairFilter} onChange={(event) => setFlairFilter(event.target.value as PostFlair | "All")}>
                        {["All", "Question", "Discussion", "Tip", "Code Talk", "Compliance", "Humor"].map((flair) => <option key={flair}>{flair}</option>)}
                      </select>
                    </label>
                  </div>
                  <div className="shop-talk-filter-section">
                    <span>Sort</span>
                    <div className="shop-talk-filter-options">
                      {(["hot", "new", "unanswered"] as const).map((mode) => (
                        <button key={mode} type="button" className={sortMode === mode ? "is-active" : ""} onClick={() => setSortMode(mode)}>
                          {mode === "hot" ? "Hot" : mode === "new" ? "New" : "Needs answers"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="shop-talk-filter-section">
                    <span>Type</span>
                    <div className="shop-talk-filter-options">
                      {([
                        ["all", "All"], ["question", "Questions"], ["sub-request", "Work requests"], ["safety", "Safety"], ["general", "Discussion"],
                      ] as const satisfies Array<[PostType | "all", string]>).map(([type, label]) => (
                        <button key={type} type="button" className={filterType === type ? "is-active" : ""} onClick={() => setFilterType(type)}>{label}</button>
                      ))}
                    </div>
                  </div>
                  <div className="shop-talk-filter-actions">
                    <button type="button" className={showBookmarked ? "is-active" : ""} onClick={() => setShowBookmarked((saved) => !saved)}>
                      {showBookmarked ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
                      Saved ({bookmarkedIds.size})
                    </button>
                    {answerQueueOnly && <button type="button" onClick={() => setAnswerQueueOnly(false)}>{primaryTrade} queue</button>}
                    <button type="button" className="shop-talk-filter-reset" onClick={() => {
                      setTradeFilter("All"); setFlairFilter("All"); setFilterType("all"); setSortMode("hot"); setShowBookmarked(false); setAnswerQueueOnly(false);
                    }}>Reset</button>
                  </div>
                </section>
              )}

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
                    description={talkQuery ? "Clear the search or broaden the trade filter." : "Start the first useful post in this community."}
                    actionLabel={talkQuery ? "Clear search" : "Create post"}
                    onAction={talkQuery ? () => setTalkQuery("") : () => setNewPostOpen(true)}
                  />
                ) : sortedPosts.map((post) => (
                  <TradePostCard
                    key={post.id}
                    post={post}
                    reactionState={getPostReactionState(post)}
                    saved={bookmarkedIds.has(post.id)}
                    onToggleSave={() => toggleBookmark(post.id)}
                    onVote={(direction) => onVotePost(post.id, direction)}
                    onOpen={() => { setSelectedPostId(post.id); setMobileDetail(true); }}
                  />
                ))}
              </div>
            </>
          ) : activeTab === "communities" ? (
            <section className="shop-talk-community-directory" aria-label="Communities">
              <header className="community-directory-header">
                <div>
                  <span>Communities</span>
                  <h2>Discover communities</h2>
                  <p>Follow a trade, place, specialty, or work topic.</p>
                </div>
                {canCreateCommunity && (
                  <button type="button" className="v2-primary-button community-create-button" onClick={() => setCommunityCreateOpen((open) => !open)} aria-expanded={communityCreateOpen}>
                    <Plus size={16} />
                    Create
                  </button>
                )}
              </header>
              <label className="community-directory-search">
                <Search size={16} />
                <span className="sr-only">Search communities</span>
                <input type="search" value={communityQuery} onChange={(event) => setCommunityQuery(event.target.value)} placeholder="Search communities" />
              </label>
              {communityCreateOpen && canCreateCommunity && (
                <section className="community-create-panel" aria-label="Create a community">
                  <div>
                    <span>Create a community</span>
                    <p>Name a trade, place, crew topic, or work specialty. We check for close matches first.</p>
                  </div>
                  <label className="input-control">
                    <span>Community name</span>
                    <input type="text" value={communityQuery} onChange={(event) => setCommunityQuery(event.target.value)} placeholder="Jacksonville finish carpentry" />
                  </label>
                  <div className="community-audience-picker" aria-label="Community audience">
                    {([
                      ["public", "Public"],
                      ["contractors", "Contractors only"],
                      ["tradespeople", "Tradespeople only"],
                    ] as const satisfies Array<[CommunityAudience, string]>).map(([audience, label]) => (
                      <button key={audience} type="button" className={communityCreateAudience === audience ? "is-active" : ""} onClick={() => setCommunityCreateAudience(audience)} aria-pressed={communityCreateAudience === audience}>
                        {label}
                      </button>
                    ))}
                  </div>
                  <p className="community-audience-description">{communityAudienceDescription(communityCreateAudience)}</p>
                  <div className="community-create-actions">
                    <button type="button" className="v2-secondary-button" onClick={() => setCommunityCreateOpen(false)}>Cancel</button>
                    <button type="button" className="v2-primary-button" onClick={() => void handleCreateCommunity()} disabled={communityCreateBusy || !communityQuery.trim()}>
                      {communityCreateBusy ? "Creating..." : "Create community"}
                    </button>
                  </div>
                  {communityCreateError && (
                    <div className="community-create-feedback" role="status">
                      <strong>{communityCreateError}</strong>
                      {duplicateCommunityCandidates.length > 0 && (
                        <div className="community-duplicate-list">
                          {duplicateCommunityCandidates.map((candidate) => (
                            <button key={candidate.slug} type="button" onClick={() => {
                              const match = communities.find((community) => community.slug === candidate.slug);
                              if (match) openCommunity(match);
                            }}>Open {candidate.name}</button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </section>
              )}
              <div className="community-directory-list">
                {filteredCommunities.length === 0 ? (
                  <EmptyState icon={UsersRound} title="No communities found" description="Try a trade, a city, or a work topic." />
                ) : filteredCommunities.map((community) => {
                  const CommunityIcon = community.icon;
                  const joined = joinedCommunities.has(community.slug);
                  const accessible = roleCanAccessCommunity(community.audience, role);
                  return (
                    <article key={community.slug} className="community-directory-row">
                      <button type="button" className="community-directory-main" onClick={() => openCommunity(community)}>
                        <span className="community-row-icon" style={{ background: community.tone }}><CommunityIcon size={20} strokeWidth={2.4} /></span>
                        <span className="community-directory-copy">
                          <strong>{community.name}</strong>
                          <small>{pluralize(community.memberCount, "member")} · {pluralize(communityPostCounts[community.slug] ?? 0, "post")} · {community.audienceLabel}</small>
                          {community.meta && <em>{community.meta}</em>}
                        </span>
                      </button>
                      <button type="button" className={joined ? "community-join is-joined" : "community-join"} aria-pressed={joined} disabled={!joined && !accessible} onClick={() => { void toggleCommunityMembership(community); }}>
                        {joined ? "Joined" : accessible ? "Join" : community.audienceLabel}
                      </button>
                    </article>
                  );
                })}
              </div>
            </section>
          ) : (
            <>
              <div className="shop-talk-command news-command">
                <div className="shop-talk-command-head">
                  <span>Trade News</span>
                  <h2>What's changing in the field</h2>
                  <p className="news-command-meta">
                    {filteredNews.length} articles · {newsSourceCount} sources · {newsFetched ? "Live feed" : "Curated feed"}
                  </p>
                  <p className="news-command-live-status">
                    {newsFetched && !newsIsFallback ? "Live sources" : "Fallback sources"}
                  </p>
                </div>
                <button type="button" className="v2-icon-button" onClick={() => void activateNews(true)} aria-label="Refresh trade news" title="Refresh trade news" disabled={newsLoading}>
                  <RefreshCw size={17} className={newsLoading ? "is-spinning" : ""} />
                </button>
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
        </main>

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
                  onKeyDown={(event) => {
                    if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && answerDraft.trim()) {
                      event.preventDefault();
                      submitAnswer();
                    }
                  }}
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
                title="Select a thread"
                description="Choose a question from the feed to read the conversation or add a field-tested answer."
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

