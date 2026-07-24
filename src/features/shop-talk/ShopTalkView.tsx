import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  AlertTriangle,
  BadgeCheck,
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  ExternalLink,
  Flag,
  ImagePlus,
  MessageCircle,
  Newspaper,
  Plus,
  RefreshCw,
  Search,
  Send,
  SlidersHorizontal,
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
  inferCommunityDefaultTrade,
  netScore,
  sortedAnswers,
} from "./community-utils";
import { apiPath, fetchWithTimeout } from "../../lib/api";
import { DialogBackdrop, DialogSurface } from "../../components/ui";
import { ZoomableImage } from "../../components/ZoomableImage";
import {
  buildArticleDiscussionBody,
  parseShopTalkPostBody,
} from "./shop-talk-post-content";
import "./shop-talk.css";

const NEWS_RENDER_NOW = Date.now();

interface AccountProfile {
  displayName: string;
  specialties: Trade[];
}

export interface NewsItem {
  id: number;
  headline: string;
  source: string;
  date: string;
  publishedAt?: string;
  summary: string;
  url: string;
  urgency?: string;
  category?: string;
  topics?: string[];
  trades?: string[];
  impactLevel?: "critical" | "high" | "medium" | "routine";
  impactReason?: string;
  sourceKind?: "official" | "publisher";
  geography?: "local" | "national" | "global";
  isLocal?: boolean;
  tier?: "local" | "national";
  relatedSourceCount?: number;
  relatedSources?: string[];
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
  viewerCanDelete?: boolean;
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

function isFallbackNewsThumbnail(item: Pick<NewsItem, "thumbnailUrl" | "thumbnailKind">) {
  return !item.thumbnailUrl;
}

interface NewsResource {
  title: string;
  source: string;
  url: string;
}

type NewsChannel = "for-you" | "local" | "critical" | "following" | "saved";

function newsItemTrades(item: NewsItem) {
  if (item.trades?.length) return item.trades;
  const text = `${item.headline} ${item.summary}`.toLowerCase();
  const patterns: Array<[string, RegExp]> = [
    ["Electrical", /\belectric(?:al|ian|ians)?\b|\bnec\b|low voltage/],
    ["Plumbing", /\bplumb(?:ing|er|ers)?\b|pipefitt|water heater/],
    ["HVAC", /\bhvac\b|refrigerant|air condition|heat pump/],
    ["Carpentry", /carpentr|woodwork|millwork/],
    ["Roofing", /roof|shingle/],
    ["Drywall", /drywall|gypsum/],
    ["Concrete/Masonry", /concrete|masonry|brick|block wall/],
    ["Framing", /\bframing\b|\bframer/],
    ["Excavation", /excavat|trench/],
    ["Solar", /\bsolar\b|photovoltaic/],
  ];
  const matches = patterns.filter(([, pattern]) => pattern.test(text)).map(([trade]) => trade);
  return matches.length ? matches : ["General construction"];
}

function canonicalNewsUrl(value: string) {
  try {
    const url = new URL(value);
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|fbclid$|gclid$|mc_|ref$|source$)/i.test(key)) url.searchParams.delete(key);
    }
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    return url.href;
  } catch {
    return "";
  }
}

function relativeNewsTime(item: NewsItem, now = Date.now()) {
  const published = Date.parse(item.publishedAt ?? "");
  if (!Number.isFinite(published)) return item.date;
  const hours = Math.max(0, Math.floor((now - published) / 3_600_000));
  if (hours < 1) return "now";
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function newsTagKind(item: NewsItem) {
  const label = item.category ?? item.topics?.[0] ?? "Construction";
  if (/licens/i.test(item.topics?.join(" ") ?? "")) return { label: "Licensing", kind: "licensing" };
  if (/safety|osha/i.test(label)) return { label: "Safety", kind: "safety" };
  if (/code/i.test(label)) return { label: "Codes", kind: "codes" };
  if (/project/i.test(label)) return { label: "Projects", kind: "projects" };
  if (/labor|business/i.test(label)) return { label, kind: "neutral" };
  return { label, kind: "neutral" };
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
    <DialogBackdrop className="shop-report-backdrop" onClose={onClose}>
      <DialogSurface className="shop-report-sheet" onClose={onClose} labelledBy="shop-report-title">
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
      </DialogSurface>
    </DialogBackdrop>
  );
}

const FLAIR_CONFIG: Record<PostFlair, { tone: string; description: string }> = {
  "Question": { tone: "warning", description: "Looking for a specific answer" },
  "Discussion": { tone: "info", description: "Open conversation, multiple perspectives" },
  "Code Talk": { tone: "success", description: "Building codes, inspections, compliance details" },
  "Compliance": { tone: "danger", description: "Licensing, permits, legal requirements" },
  "Tip": { tone: "accent", description: "Share a field technique or shortcut" },
  "Humor": { tone: "neutral", description: "Keep it trade-relevant" },
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
  articleContext,
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
  articleContext?: Pick<NewsItem, "headline" | "source" | "date" | "url"> | null;
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
  const canSubmit = title.trim().length > 0 && (
    body.trim().length > 0
    || Boolean(photoFile)
    || Boolean(articleContext?.url)
  );
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
          <div>
            <span className="new-post-modal-eyebrow">{articleContext ? "Trade News discussion" : "Shop Talk"}</span>
            <h2>{articleContext ? "Start a discussion" : "Create a post"}</h2>
          </div>
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
                  className={`flair-option is-${FLAIR_CONFIG[f].tone}${flair === f ? " selected" : ""}`}
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

          {articleContext ? (
            <aside className="new-post-article-attachment" aria-label="Attached article">
              <Newspaper size={18} aria-hidden="true" />
              <div>
                <span>Article attached</span>
                <strong>{articleContext.headline}</strong>
                <small>{articleContext.source} · {articleContext.date}</small>
              </div>
              <a href={articleContext.url} target="_blank" rel="noreferrer" aria-label="Preview attached article">
                <ExternalLink size={16} />
              </a>
            </aside>
          ) : null}

          <label className="input-control">
            <span>{articleContext ? "Your take" : "Body"}</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              placeholder={articleContext
                ? "What changes for crews, bids, schedules, safety, or code compliance?"
                : "Add context, photos, site conditions, tools on hand..."}
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
              <ZoomableImage
                src={photoPreviewUrl}
                alt={photoFile?.name ?? "Selected Shop Talk post"}
                viewerLabel="Preview post photo"
              />
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
                  articleContext
                    ? buildArticleDiscussionBody(body, articleContext)
                    : body.trim(),
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
  communityPostsLoaded,
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
  communityPostsLoaded: boolean;
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
  const [answerComposerOpen, setAnswerComposerOpen] = useState(false);
  const answerComposerInputRef = useRef<HTMLTextAreaElement>(null);
  const [newPostOpen, setNewPostOpen] = useState(Boolean(openComposer));
  const [joinedCommunities, setJoinedCommunities] = useState<Set<string>>(
    () => new Set(communities.filter((community) => community.joined).map((community) => community.slug)),
  );
  const [communityQuery, setCommunityQuery] = useState("");
  const [communityName, setCommunityName] = useState("");
  const [communityCreateOpen, setCommunityCreateOpen] = useState(false);
  const [communityCreateError, setCommunityCreateError] = useState<string | null>(null);
  const [communityCreateBusy, setCommunityCreateBusy] = useState(false);
  const [communityCreateAudience, setCommunityCreateAudience] = useState<CommunityAudience>("public");
  const [duplicateCommunityCandidates, setDuplicateCommunityCandidates] = useState<ServerCommunity[]>([]);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);
  const [deleteConfirmPostId, setDeleteConfirmPostId] = useState<string | null>(null);
  const [selectedCommunitySlug, setSelectedCommunitySlug] = useState<string | null>(initialCommunitySlug ?? null);
  const [talkQuery, setTalkQuery] = useState(() => initialQuery.trim());
  const [newsQuery, setNewsQuery] = useState("");
  const [newsCategory, setNewsCategory] = useState(() => localStorage.getItem("rivt.news.category.v1") || "All topics");
  const [newsTrade, setNewsTrade] = useState(() => localStorage.getItem("rivt.news.trade.v1") || "All trades");
  const [newsScope, setNewsScope] = useState<"local" | "all">(() => localStorage.getItem("rivt.news.scope.v1") === "all" ? "all" : "local");
  const [newsLocation, setNewsLocation] = useState(() => localStorage.getItem("rivt.news.location.v1") || userLocation);
  const [newsChannel, setNewsChannel] = useState<NewsChannel>("for-you");
  const [newsCustomizeOpen, setNewsCustomizeOpen] = useState(false);
  const [newsSearchOpen, setNewsSearchOpen] = useState(false);
  const [followedNewsTrades, setFollowedNewsTrades] = useState<Set<string>>(() => readStringSet("rivt.news.followedTrades.v1"));
  const [followedNewsTopics, setFollowedNewsTopics] = useState<Set<string>>(() => readStringSet("rivt.news.followedTopics.v1"));
  const [savedNewsUrls, setSavedNewsUrls] = useState<Set<string>>(() => readStringSet("rivt.news.savedUrls.v1"));
  const [liveNews, setLiveNews] = useState<NewsItem[]>([]);
  const [newsResources, setNewsResources] = useState<NewsResource[]>([]);
  const [newsFetchedAt, setNewsFetchedAt] = useState<number | null>(null);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsFetched, setNewsFetched] = useState(false);
  const [newsRefreshMessage, setNewsRefreshMessage] = useState("Open Trade News to load current sources.");
  const [flairFilter, setFlairFilter] = useState<PostFlair | "All">(() => readShopTalkFilterPrefs().flairFilter);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(() => readStringSet("rivt.shopTalkBookmarks.v1"));
  const [showBookmarked, setShowBookmarked] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
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
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setAnswerComposerOpen(false);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [selectedPostId]);
  useEffect(() => {
    if (answerComposerOpen) answerComposerInputRef.current?.focus();
  }, [answerComposerOpen]);
  useEffect(() => {
    const next = new Set(communities.filter((community) => community.joined).map((community) => community.slug));
    /* eslint-disable react-hooks/set-state-in-effect */
    setJoinedCommunities(next);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [communities]);

  useEffect(() => {
    localStorage.setItem("rivt.news.category.v1", newsCategory);
    localStorage.setItem("rivt.news.trade.v1", newsTrade);
    localStorage.setItem("rivt.news.scope.v1", newsScope);
    localStorage.setItem("rivt.news.location.v1", newsLocation);
  }, [newsCategory, newsLocation, newsScope, newsTrade]);
  useEffect(() => {
    localStorage.setItem("rivt.news.followedTrades.v1", JSON.stringify([...followedNewsTrades]));
    localStorage.setItem("rivt.news.followedTopics.v1", JSON.stringify([...followedNewsTopics]));
    localStorage.setItem("rivt.news.savedUrls.v1", JSON.stringify([...savedNewsUrls]));
  }, [followedNewsTopics, followedNewsTrades, savedNewsUrls]);

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
    const name = communityName.trim();
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
        setCommunityName("");
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
      return next;
    });
    const saved = await setCommunityMembership(community.slug, willJoin);
    if (saved) return;
    setJoinedCommunities((prev) => {
      const next = new Set(prev);
      if (willJoin) next.delete(community.slug);
      else next.add(community.slug);
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

  async function activateNews(forceRefresh = false, scopeOverride: "local" | "all" = newsScope) {
    setActiveTab("news");
    if (newsFetched && !forceRefresh) return;
    setNewsLoading(true);
    try {
      const params = new URLSearchParams();
      if (scopeOverride === "local" && newsLocation.trim()) params.set("location", newsLocation.trim());
      if (forceRefresh) params.set("refresh", "1");
      const response = await fetchWithTimeout(apiPath(`/api/news?${params.toString()}`));
      if (!response.ok) throw new Error("Trade News request failed");
      const data = await response.json() as { items?: NewsItem[]; resources?: NewsResource[]; fallback?: boolean; cached?: boolean };
      const items = Array.isArray(data.items) ? data.items : [];
      setLiveNews(items);
      setNewsResources(Array.isArray(data.resources) ? data.resources : []);
      setNewsFetchedAt(NEWS_RENDER_NOW);
      setNewsRefreshMessage(items.length
        ? `${data.cached ? "Current cached feed" : forceRefresh ? "Feed refreshed" : "Live feed loaded"} · ${items.length} articles`
        : "No current articles were returned by the live sources.");
      setSelectedNewsId(items[0]?.id ?? 0);
    } catch {
      setLiveNews([]);
      setNewsResources([]);
      setNewsRefreshMessage("Trade News could not reach its sources. Try refreshing shortly.");
      setSelectedNewsId(0);
    } finally {
      setNewsLoading(false);
      setNewsFetched(true);
    }
  }

  function toggleNewsPreference(setter: typeof setFollowedNewsTrades, value: string) {
    setter((current) => {
      const next = new Set(current);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }

  function selectNewsChannel(channel: NewsChannel) {
    setNewsChannel(channel);
    if (channel === "local" && newsScope !== "local") {
      setNewsScope("local");
      void activateNews(true, "local");
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
  const newsCategories = ["All topics", ...new Set(displayNews.flatMap((item) => item.topics?.length ? item.topics : [item.category || "Industry news"]))];
  const newsTrades = ["All trades", ...new Set(displayNews.flatMap(newsItemTrades))];
  const filteredNews = displayNews.filter((item) => {
    const itemTopics = item.topics?.length ? item.topics : [item.category || "Industry news"];
    const itemTrades = newsItemTrades(item);
    if (newsCategory !== "All topics" && !itemTopics.includes(newsCategory)) return false;
    if (newsTrade !== "All trades" && !newsItemTrades(item).includes(newsTrade)) return false;
    if (newsChannel === "local" && !item.isLocal && item.geography !== "local") return false;
    if (newsChannel === "critical" && !["critical", "high"].includes(item.impactLevel ?? "routine")) return false;
    if (newsChannel === "following" && !(
      itemTrades.some((trade) => followedNewsTrades.has(trade)) ||
      itemTopics.some((topic) => followedNewsTopics.has(topic))
    )) return false;
    if (newsChannel === "saved" && !savedNewsUrls.has(item.url)) return false;
    if (!normalizedNewsQuery) return true;
    return [item.headline, item.summary, item.source, item.category ?? "", item.urgency ?? "", item.date].join(" ").toLowerCase().includes(normalizedNewsQuery);
  }).sort((a, b) => {
    if (newsChannel !== "for-you") return 0;
    const recommendationScore = (item: NewsItem) => {
      const trades = newsItemTrades(item);
      const topics = item.topics?.length ? item.topics : [item.category || "Industry news"];
      return (
        trades.filter((trade) => followedNewsTrades.has(trade)).length * 6 +
        topics.filter((topic) => followedNewsTopics.has(topic)).length * 4 +
        (trades.includes(primaryTrade) ? 3 : 0) +
        (item.isLocal || item.geography === "local" ? 2 : 0) +
        (item.impactLevel === "critical" ? 2 : item.impactLevel === "high" ? 1 : 0)
      );
    };
    return recommendationScore(b) - recommendationScore(a);
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
  const newsSourceCount = new Set(filteredNews.map((item) => item.source)).size;
  const criticalNewsCount = displayNews.filter((item) => ["critical", "high"].includes(item.impactLevel ?? "")).length;
  const newsThreadMatches = useMemo(() => {
    const matches = new Map<string, { postId: string; replies: number }>();
    for (const item of displayNews) {
      const articleUrl = canonicalNewsUrl(item.url);
      if (!articleUrl) continue;
      const related = communityPosts.filter((post) => (
        (post.body.match(/https?:\/\/[^\s)]+/g) ?? []).some((url) => canonicalNewsUrl(url) === articleUrl)
      ));
      if (related.length) {
        matches.set(articleUrl, {
          postId: related[0].id,
          replies: related.reduce((sum, post) => sum + post.replies.length, 0),
        });
      }
    }
    return matches;
  }, [communityPosts, displayNews]);
  const newThisWeek = filteredNews.filter((item) => {
    const published = Date.parse(item.publishedAt ?? "");
    return Number.isFinite(published) && NEWS_RENDER_NOW - published <= 7 * 86_400_000;
  }).length;
  const freshestNews = filteredNews.reduce<NewsItem | null>((freshest, item) => {
    if (!freshest) return item;
    return Date.parse(item.publishedAt ?? "") > Date.parse(freshest.publishedAt ?? "") ? item : freshest;
  }, null);
  const newsIntelSummary = newThisWeek > 0
    ? `${newThisWeek} new this week · ${filteredNews.length} stories`
    : `${filteredNews.length} stories${freshestNews ? ` · freshest ${relativeNewsTime(freshestNews)}` : ""}`;
  const groupNewsByTier = newsChannel === "for-you"
    && newsScope === "local"
    && filteredNews.some((item) => item.tier === "local")
    && filteredNews.some((item) => item.tier === "national");
  const orderedNews = groupNewsByTier
    ? [
        ...filteredNews.filter((item) => item.tier === "local"),
        ...filteredNews.filter((item) => item.tier === "national"),
        ...filteredNews.filter((item) => !item.tier),
      ]
    : filteredNews;
  const featuredPool = groupNewsByTier
    ? orderedNews.filter((item) => item.tier === "local")
    : orderedNews;
  const featuredNews = featuredPool.find((item) => {
    const publishedAt = Date.parse(item.publishedAt ?? "");
    return ["critical", "high"].includes(item.impactLevel ?? "")
      && Number.isFinite(publishedAt)
      && NEWS_RENDER_NOW - publishedAt <= 7 * 86_400_000;
  }) ?? null;
  const newsRows = featuredNews ? orderedNews.filter((item) => item.id !== featuredNews.id) : orderedNews;
  const firstNationalRowId = groupNewsByTier
    ? newsRows.find((item) => item.tier === "national")?.id
    : undefined;
  const briefingTrade = followedNewsTrades.size ? [...followedNewsTrades].slice(0, 2).join(" + ") : primaryTrade;
  const strictNewsView = newsChannel !== "for-you";
  const newsEmptyTitle = normalizedNewsQuery
    ? "No stories match this search"
    : strictNewsView || newsCategory !== "All topics" || newsTrade !== "All trades"
      ? `No stories in ${newsChannel === "following" ? "Following" : newsChannel === "saved" ? "Saved" : "this briefing"}`
      : "No current trade news";
  const newsEmptyDescription = normalizedNewsQuery
    ? "Clear the search or broaden the trade and topic filters."
    : newsChannel === "following" && !followedNewsTrades.size && !followedNewsTopics.size
      ? "Choose Customize and follow at least one trade or topic."
      : newsChannel === "saved"
        ? "Save an article from any briefing and it will appear here."
        : strictNewsView || newsCategory !== "All topics" || newsTrade !== "All trades"
          ? "No verified stories match this channel and the current filters. Broaden the briefing to see more."
          : "RIVT could not confirm any current articles from its live sources. No articles or images have been invented.";

  function openNewsThread(item: NewsItem) {
    const match = newsThreadMatches.get(canonicalNewsUrl(item.url));
    if (!match) return;
    setSelectedPostId(match.postId);
    setActiveTab("talk");
    setMobileDetail(true);
  }
  const selectedPostReactionState = selectedPost
    ? getPostReactionState(selectedPost)
    : { upvotes: 0, downvotes: 0, reaction: null, serverOwned: reactionStatus === "ready", pending: false };
  const selectedPostContent = selectedPost ? parseShopTalkPostBody(selectedPost.body) : null;
  const canDeleteSelectedPost = Boolean(selectedPost && !selectedPost.badge && (
    selectedPost.viewerCanDelete === true
    || (selectedPost.viewerCanDelete == null && selectedPost.author === profile.displayName)
  ));
  const SelectedCommunityIcon = selectedCommunity?.icon;
  const reactionLedgerLabel = reactionStatus === "ready"
    ? "Server-backed"
    : reactionStatus === "loading"
      ? "Syncing"
      : reactionStatus === "error"
        ? "Offline"
        : "Not loaded";

  async function handleDeleteSelectedPost() {
    if (!selectedPost) return;
    setDeletingPostId(selectedPost.id);
    try {
      const deleted = await onDeletePost(selectedPost.id);
      if (deleted) {
        setDeleteConfirmPostId(null);
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

  function renderNewsActions(item: NewsItem) {
    const thread = newsThreadMatches.get(canonicalNewsUrl(item.url));
    return (
      <div className="news-card-actions">
        <button type="button" className="news-discuss-action" aria-label={thread ? "Open article discussion" : "Start article discussion"} onClick={() => {
          if (thread) openNewsThread(item);
          else {
            setNewsDiscussContext(item);
            setNewPostOpen(true);
          }
        }}>
          <MessageCircle size={14} />
          {thread ? `${thread.replies} replies` : "Discuss"}
        </button>
        {item.url && item.url !== "#" ? (
          <a className="shop-news-source-link" href={item.url} target="_blank" rel="noreferrer"><ExternalLink size={12} />Read original</a>
        ) : null}
        <button type="button" aria-label={savedNewsUrls.has(item.url) ? "Remove saved article" : "Save article"} aria-pressed={savedNewsUrls.has(item.url)} onClick={() => toggleNewsPreference(setSavedNewsUrls, item.url)}>
          {savedNewsUrls.has(item.url) ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
        </button>
      </div>
    );
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
          initialBody=""
          articleContext={newsDiscussContext}
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
                  aria-label="Filters"
                  title="Filters"
                  onClick={() => setFiltersOpen((open) => !open)}
                >
                  <SlidersHorizontal size={18} aria-hidden="true" />
                  <span className="sr-only">Filters</span>
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
                    {answerQueueOnly && <button type="button" className="shop-talk-active-filter" onClick={() => setAnswerQueueOnly(false)} aria-label={`Clear ${primaryTrade} answer queue filter`}>{primaryTrade} queue <X size={14} aria-hidden="true" /></button>}
                    <button type="button" className="shop-talk-filter-reset" onClick={() => {
                      setTradeFilter("All trades"); setFlairFilter("All"); setFilterType("all"); setSortMode("hot"); setShowBookmarked(false); setAnswerQueueOnly(false);
                    }}>Reset</button>
                  </div>
                </section>
              )}

              <div className="shop-post-list">
                {!communityPostsLoaded ? (
                  <div className="shop-talk-feed-loading" aria-label="Loading Shop Talk posts">
                    {[1, 2, 3].map((item) => <div key={item} className="shop-talk-post-skeleton" />)}
                  </div>
                ) : sortedPosts.length === 0 ? (
                  <EmptyState
                    icon={MessageCircle}
                    title="No matching Shop Talk posts"
                    description={talkQuery
                      ? "Clear the search or broaden the trade filter."
                      : selectedCommunity
                        ? "Start the first useful post in this community."
                        : "Start the first useful Shop Talk post."}
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
                    <input type="text" value={communityName} onChange={(event) => setCommunityName(event.target.value)} placeholder="Jacksonville finish carpentry" />
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
                    <button type="button" className="v2-secondary-button" onClick={() => { setCommunityCreateOpen(false); setCommunityName(""); }}>Cancel</button>
                    <button type="button" className="v2-primary-button" onClick={() => void handleCreateCommunity()} disabled={communityCreateBusy || !communityName.trim()}>
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
              <div className="news-intel-strip" aria-label="Trade News status">
                <div className="news-intel-copy">
                  <strong>{newsScope === "local" ? newsLocation || "Near you" : "All regions"} · {briefingTrade || "All trades"}</strong>
                  <span>{newsIntelSummary} · {newsFetchedAt ? "updated now" : "not updated yet"}</span>
                  <p className="news-command-meta">
                    {filteredNews.length} articles · {newsSourceCount} sources
                  </p>
                  <p className="news-command-live-status">
                    {newsLoading ? "Refreshing live sources…" : newsRefreshMessage}
                  </p>
                </div>
                <button type="button" className="v2-icon-button" onClick={() => void activateNews(true)} aria-label="Refresh trade news" title="Refresh trade news" disabled={newsLoading}>
                  <RefreshCw size={17} className={newsLoading ? "is-spinning" : ""} />
                </button>
                <button type="button" className="v2-icon-button" onClick={() => setNewsCustomizeOpen((open) => !open)} aria-label="Customize Trade News" aria-expanded={newsCustomizeOpen}>
                  <SlidersHorizontal size={17} />
                </button>
              </div>
              <section className="news-obsolete-strip is-obsolete" aria-hidden="true">
                <div><strong>{criticalNewsCount}</strong><span>critical updates</span></div>
                <div><strong>{newsScope === "local" ? newsLocation || "Near you" : "All regions"}</strong><span>coverage</span></div>
                <button type="button" onClick={() => setNewsCustomizeOpen((open) => !open)} aria-expanded={newsCustomizeOpen}>
                  <SlidersHorizontal size={15} />Customize
                </button>
              </section>
              <nav className="news-channel-nav" aria-label="Trade News channels">
                {([
                  ["for-you", "For you"], ["local", "Local"], ["critical", "Critical"],
                  ["following", "Following"], ["saved", "Saved"],
                ] as Array<[NewsChannel, string]>).map(([channel, label]) => (
                  <button key={channel} type="button" className={newsChannel === channel ? "is-active" : ""} aria-pressed={newsChannel === channel} onClick={() => selectNewsChannel(channel)}>
                    {label}
                  </button>
                ))}
                <button type="button" className={newsSearchOpen ? "news-search-chip is-active" : "news-search-chip"} aria-label="Search Trade News" aria-expanded={newsSearchOpen} onClick={() => setNewsSearchOpen((open) => !open)}>
                  <Search size={16} />
                </button>
              </nav>
              {newsSearchOpen ? (
                <label className="shop-talk-search news-inline-search">
                  <Search size={15} />
                  <span className="sr-only">Search Trade News</span>
                  <input autoFocus type="search" value={newsQuery} onChange={(event) => setNewsQuery(event.target.value)} placeholder="Search trades, codes, safety, local" />
                </label>
              ) : null}
              {newsCustomizeOpen ? (
                <section className="news-customize-panel" aria-label="Customize Trade News">
                  <div className="news-customize-heading">
                    <div><strong>Build your briefing</strong><small>Follow any combination. Recommendations stay on this device.</small></div>
                    <button type="button" className="v2-icon-button" onClick={() => setNewsCustomizeOpen(false)} aria-label="Close Trade News customization"><X size={16} /></button>
                  </div>
                  <fieldset>
                    <legend>Coverage location</legend>
                    <div className="news-location-editor">
                      <input aria-label="Trade News coverage location" value={newsLocation} maxLength={80} placeholder="City, ST" onChange={(event) => setNewsLocation(event.target.value)} />
                      <button type="button" onClick={() => {
                        setNewsScope("local");
                        setNewsChannel("local");
                        void activateNews(true, "local");
                      }}>Load local briefing</button>
                      <button type="button" onClick={() => {
                        setNewsScope("all");
                        setNewsChannel("for-you");
                        void activateNews(true, "all");
                      }}>All regions</button>
                    </div>
                  </fieldset>
                  <fieldset>
                    <legend>Follow trades</legend>
                    <div className="news-follow-grid">
                      {newsTrades.filter((trade) => trade !== "All trades").map((trade) => (
                        <button key={trade} type="button" aria-pressed={followedNewsTrades.has(trade)} className={followedNewsTrades.has(trade) ? "is-followed" : ""} onClick={() => toggleNewsPreference(setFollowedNewsTrades, trade)}>
                          {followedNewsTrades.has(trade) ? "Following" : "Follow"} {trade}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                  <fieldset>
                    <legend>Follow topics</legend>
                    <div className="news-follow-grid">
                      {newsCategories.filter((topic) => topic !== "All topics").map((topic) => (
                        <button key={topic} type="button" aria-pressed={followedNewsTopics.has(topic)} className={followedNewsTopics.has(topic) ? "is-followed" : ""} onClick={() => toggleNewsPreference(setFollowedNewsTopics, topic)}>
                          {followedNewsTopics.has(topic) ? "Following" : "Follow"} {topic}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                </section>
              ) : null}
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
                    title={newsEmptyTitle}
                    description={newsEmptyDescription}
                    actionLabel={normalizedNewsQuery || strictNewsView || newsCategory !== "All topics" || newsTrade !== "All trades" ? "Show all current news" : "Refresh sources"}
                    onAction={() => {
                      if (normalizedNewsQuery || strictNewsView || newsCategory !== "All topics" || newsTrade !== "All trades") {
                        setNewsQuery("");
                        setNewsCategory("All topics");
                        setNewsTrade("All trades");
                        setNewsChannel("for-you");
                        if (newsScope !== "all") {
                          setNewsScope("all");
                          void activateNews(true, "all");
                        }
                        return;
                      }
                      void activateNews(true);
                    }}
                  />
                ) : (
                  <>
                    {featuredNews ? (
                      <article className="shop-news-card is-featured">
                        <button type="button" className="shop-news-card-main" onClick={() => { setSelectedNewsId(featuredNews.id); setMobileDetail(true); }}>
                          {isFallbackNewsThumbnail(featuredNews)
                            ? <div className="news-featured-fallback" aria-hidden="true"><Newspaper size={24} /><small>No article image</small></div>
                            : <img className="news-featured-image" src={featuredNews.thumbnailUrl} alt="" loading="lazy" />}
                          <div className="news-featured-copy">
                            <span className="news-featured-label">Featured briefing</span>
                            <div className="news-card-kicker">
                              <span className={`news-type-tag is-${newsTagKind(featuredNews).kind}`}>{newsTagKind(featuredNews).label}</span>
                              {featuredNews.impactLevel === "critical" ? <span className="news-critical-marker"><i />Critical</span> : null}
                              <small>{relativeNewsTime(featuredNews)}</small>
                            </div>
                            <strong>{featuredNews.headline}</strong>
                            <p className="news-why-line">{featuredNews.impactReason}</p>
                            <small>{featuredNews.source}{featuredNews.sourceKind === "official" ? " · Official" : ""}</small>
                          </div>
                        </button>
                        {renderNewsActions(featuredNews)}
                      </article>
                    ) : null}
                    {newsRows.map((item) => (
                  <Fragment key={item.id}>
                    {item.id === firstNationalRowId ? (
                      <div className="news-local-references news-tier-divider" role="separator">
                        <strong>Beyond your area · national trade news</strong>
                      </div>
                    ) : null}
                    <article
                      className={item.id === selectedNewsId ? "shop-news-card is-compact selected" : "shop-news-card is-compact"}
                    >
                    <button
                      type="button"
                      className="shop-news-card-main"
                      onClick={() => { setSelectedNewsId(item.id); setMobileDetail(true); }}
                    >
                      <div className="shop-news-card-body-wrap">
                        {isFallbackNewsThumbnail(item) ? (
                          <div className="news-card-thumb is-source-tile" aria-hidden="true">
                            <Newspaper size={20} />
                            <small>No image</small>
                          </div>
                        ) : (
                          <div className="news-card-thumb is-real">
                            <img src={item.thumbnailUrl} alt={`${item.source} article image`} loading="lazy" />
                          </div>
                        )}
                        <div className="news-card-body">
                          <div className="news-card-kicker">
                            <span className={`news-type-tag is-${newsTagKind(item).kind}`}>{newsTagKind(item).label}</span>
                            {item.impactLevel === "critical" ? <span className="news-critical-marker"><i />Critical</span> : null}
                            <small>{relativeNewsTime(item)}</small>
                          </div>
                          <strong>{item.headline}</strong>
                          <p className="news-why-line">{item.impactReason}</p>
                          <div className="news-card-tags">
                            {newsItemTrades(item).slice(0, 2).map((trade) => <span key={trade}>{trade}</span>)}
                            {(item.topics?.slice(0, 1) ?? []).map((topic) => <span key={topic}>{topic}</span>)}
                          </div>
                          <small>{item.source}{item.sourceKind === "official" ? " · Official" : ""}{(item.relatedSourceCount ?? 1) > 1 ? ` · ${item.relatedSourceCount} sources` : ""}</small>
                        </div>
                      </div>
                    </button>
                    {renderNewsActions(item)}
                    </article>
                  </Fragment>
                    ))}
                    {newsResources.length ? (
                      <aside className="news-local-references" aria-label="Local references">
                        <strong>Local references · official portals</strong>
                        <div>{newsResources.map((resource) => <a key={resource.url} href={resource.url} target="_blank" rel="noreferrer">{resource.title}<ExternalLink size={11} /></a>)}</div>
                      </aside>
                    ) : null}
                    <p className="news-feed-floor">Older stories are archived — nothing stale is ranked as urgent.</p>
                  </>
                )}
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
                <div className="shop-question-copy">
                  <div className="shop-question-topline">
                    {selectedPost.flair && (
                      <span className={`flair-pill flair-${selectedPost.flair.toLowerCase().replace(/\s/g, "-")}`}>
                        {selectedPost.flair}
                      </span>
                    )}
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
                        {bookmarkedIds.has(selectedPost.id) ? <BookmarkCheck size={17} /> : <Bookmark size={17} />}
                      </button>
                      {canDeleteSelectedPost && (
                        <button
                          type="button"
                          className="shop-detail-delete"
                          aria-label="Delete this post"
                          disabled={deletingPostId === selectedPost.id}
                          onClick={() => setDeleteConfirmPostId(selectedPost.id)}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="shop-question-byline">
                    {selectedPost.author}
                    {selectedPost.badge ? ` · ${selectedPost.badge}` : ""}
                    {` · ${selectedPost.trade} · ${selectedPost.createdAt}`}
                  </p>
                  <h2>{selectedPost.title}</h2>
                  {selectedPostContent?.content ? <p className="shop-question-body">{selectedPostContent.content}</p> : null}
                  {selectedPostContent?.article ? (
                    <aside className="shop-question-article" aria-label="Linked article">
                      <span className="shop-question-article-icon"><Newspaper size={17} aria-hidden="true" /></span>
                      <div>
                        <strong>{selectedPostContent.article.source}</strong>
                        <small>{selectedPostContent.article.date
                          ? `${selectedPostContent.article.date} · ${selectedPostContent.article.domain}`
                          : selectedPostContent.article.domain}</small>
                      </div>
                      <a href={selectedPostContent.article.url} target="_blank" rel="noreferrer">
                        Read article
                        <ExternalLink size={14} />
                      </a>
                    </aside>
                  ) : null}
                  {selectedPost.thumbnailUrl && (
                    <figure className="shop-question-media">
                      <ZoomableImage
                        src={selectedPost.thumbnailUrl}
                        alt={selectedPost.thumbnailAlt ?? ""}
                        loading="lazy"
                        viewerLabel="Open post photo"
                      />
                    </figure>
                  )}
                </div>
              </div>
              <div className="shop-question-actions">
                <div className="thread-vote-group" role="group" aria-label="Thread voting">
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
                </div>
                <button
                  type="button"
                  className="shop-question-report"
                  aria-label="Report this post"
                  onClick={() => openReport({
                    kind: "post",
                    postId: selectedPost.id,
                    title: selectedPost.title,
                    description: "Report a Shop Talk post for unsafe advice, spam, harassment, misinformation, or other review needs.",
                  })}
                >
                  <Flag size={15} />
                </button>
              </div>

              <section className="answer-list" aria-label="Community answers">
                <header className="answer-list-heading">
                  <h3>Answers <span>({selectedPost.replies.length})</span></h3>
                </header>
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

              <section
                className={answerComposerOpen ? "answer-composer is-expanded" : "answer-composer is-collapsed"}
                aria-label="Write an answer"
              >
                {answerComposerOpen ? (
                  <>
                    <div className="answer-composer-byline">
                      <span>
                        Answering as {profile.displayName}
                        {reactionStatus === "ready"
                          ? ` · ${myTotalRep} rep`
                          : ` · ${reactionLedgerLabel}`}
                      </span>
                      <button
                        type="button"
                        className="answer-composer-collapse"
                        aria-label="Collapse answer composer"
                        onClick={() => setAnswerComposerOpen(false)}
                      >
                        <X size={16} />
                      </button>
                    </div>
                    <small className="answer-composer-helper">
                      Name the condition, the check, and the proof that prevents a callback.
                    </small>
                    <textarea
                      ref={answerComposerInputRef}
                      value={answerDraft}
                      onChange={(e) => setAnswerDraft(e.target.value.slice(0, 1000))}
                      onKeyDown={(event) => {
                        if (event.key === "Escape") {
                          setAnswerComposerOpen(false);
                          return;
                        }
                        if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && answerDraft.trim()) {
                          event.preventDefault();
                          submitAnswer();
                        }
                      }}
                      rows={4}
                      placeholder="Share the condition, tool or code check, order of operations, and proof that prevents a callback."
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
                  </>
                ) : (
                  <button
                    type="button"
                    className="answer-composer-trigger"
                    aria-expanded="false"
                    onClick={() => setAnswerComposerOpen(true)}
                  >
                    <MessageCircle size={18} aria-hidden="true" />
                    <span>
                      <strong>Write an answer…</strong>
                      <small>Share field-tested advice</small>
                    </span>
                  </button>
                )}
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
                      <Newspaper size={28} />
                      <small>No article image</small>
                    </div>
                  ) : (
                    <ZoomableImage
                      src={selectedNews.thumbnailUrl}
                      alt={`${selectedNews.source} article image`}
                      loading="lazy"
                      viewerLabel="Open article image"
                    />
                  )}
                  <div className="news-detail-hero-copy">
                    <span className="news-detail-source">{selectedNews.source}</span>
                    <span className="news-urgency-pill">{selectedNews.category ?? selectedNews.urgency ?? "Construction"}</span>
                  </div>
                </div>
                <div className="shop-news-detail-header">
                  <div className="news-detail-intelligence">
                    <span className={`news-impact-badge is-${selectedNews.impactLevel ?? "routine"}`}>{selectedNews.impactLevel ?? "briefing"} impact</span>
                    {newsItemTrades(selectedNews).map((trade) => <span key={trade}>{trade}</span>)}
                    {(selectedNews.topics ?? []).map((topic) => <span key={topic}>{topic}</span>)}
                  </div>
                  <h2>{selectedNews.headline}</h2>
                  <small>{selectedNews.source}{selectedNews.sourceKind === "official" ? " · Official source" : ""} · {selectedNews.date}{(selectedNews.relatedSourceCount ?? 1) > 1 ? ` · ${selectedNews.relatedSourceCount} related sources` : ""}</small>
                </div>
                <p className="shop-news-detail-body">{selectedNews.summary}</p>
                {selectedNews.impactReason ? (
                  <section className="news-why-it-matters">
                    <AlertTriangle size={18} />
                    <div><strong>Why RIVT flagged it</strong><p>{selectedNews.impactReason}</p></div>
                  </section>
                ) : null}
                {selectedNews.url && selectedNews.url !== "#" && (
                  <a href={selectedNews.url} target="_blank" rel="noreferrer" className="primary-action news-read-btn">
                    Read original article
                    <ExternalLink size={15} />
                  </a>
                )}
                <button type="button" className="news-save-detail" aria-pressed={savedNewsUrls.has(selectedNews.url)} onClick={() => toggleNewsPreference(setSavedNewsUrls, selectedNews.url)}>
                  {savedNewsUrls.has(selectedNews.url) ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
                  {savedNewsUrls.has(selectedNews.url) ? "Saved" : "Save for later"}
                </button>
                <div className="shop-news-discuss">
                  <strong>Discuss this in Shop Talk</strong>
                  <p>{newsThreadMatches.has(canonicalNewsUrl(selectedNews.url)) ? "Continue the field conversation about this story." : "Have a take on how this affects your work? Start a conversation."}</p>
                  <button
                    type="button"
                    className="primary-action"
                    onClick={() => {
                      if (newsThreadMatches.has(canonicalNewsUrl(selectedNews.url))) openNewsThread(selectedNews);
                      else {
                        setNewsDiscussContext(selectedNews);
                        setNewPostOpen(true);
                      }
                    }}
                  >
                    <MessageCircle size={15} />
                    {newsThreadMatches.has(canonicalNewsUrl(selectedNews.url))
                      ? `${newsThreadMatches.get(canonicalNewsUrl(selectedNews.url))?.replies ?? 0} replies`
                      : "Start the discussion"}
                  </button>
                </div>
              </div>
            ) : (
              <EmptyState icon={Newspaper} title="Select a news item" description="Choose a headline from the left to read the full summary." />
            )}
          </article>
        )}
      </section>
      {deleteConfirmPostId && selectedPost?.id === deleteConfirmPostId ? (
        <DialogBackdrop className="shop-delete-backdrop" onClose={() => {
          if (deletingPostId !== deleteConfirmPostId) setDeleteConfirmPostId(null);
        }}>
          <DialogSurface
            className="shop-delete-dialog"
            labelledBy="shop-delete-title"
            onClose={() => {
              if (deletingPostId !== deleteConfirmPostId) setDeleteConfirmPostId(null);
            }}
          >
            <span className="shop-delete-icon"><Trash2 size={20} aria-hidden="true" /></span>
            <div>
              <span>Your post</span>
              <h2 id="shop-delete-title">Delete this discussion?</h2>
              <p>It will leave the feed, its replies will no longer be visible, and any attached photo will be removed from active records.</p>
            </div>
            <div className="shop-delete-actions">
              <button
                type="button"
                className="secondary-action"
                disabled={deletingPostId === deleteConfirmPostId}
                onClick={() => setDeleteConfirmPostId(null)}
              >
                Keep post
              </button>
              <button
                type="button"
                className="shop-delete-confirm"
                disabled={deletingPostId === deleteConfirmPostId}
                onClick={() => void handleDeleteSelectedPost()}
              >
                <Trash2 size={15} />
                {deletingPostId === deleteConfirmPostId ? "Deleting..." : "Delete post"}
              </button>
            </div>
          </DialogSurface>
        </DialogBackdrop>
      ) : null}
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

