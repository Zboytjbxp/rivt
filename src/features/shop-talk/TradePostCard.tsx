import { useState } from "react";
import {
  ArrowBigDown,
  ArrowBigUp,
  BadgeCheck,
  Bookmark,
  Building2,
  Check,
  Hammer,
  MessageCircle,
  Newspaper,
  Share2,
  Users,
  Wrench,
} from "lucide-react";
import type { CommunityPost } from "./ShopTalkView";
import type { CommunityReactionState } from "./ShopTalkView";
import { parseShopTalkPostBody } from "./shop-talk-post-content";
import "../home/trade-feed.css";

// Map a post's trade to its community label + icon so cards read like the references.
const TRADE_COMMUNITY: Record<string, { label: string; icon: typeof Hammer }> = {
  Carpentry: { label: "Carpentry Talk", icon: Hammer },
  Electrical: { label: "Electrical Talk", icon: Wrench },
  Plumbing: { label: "Plumbing Talk", icon: Wrench },
  Tile: { label: "Tile Talk", icon: Wrench },
  Cabinetry: { label: "Cabinetry Talk", icon: Hammer },
  Jacksonville: { label: "Jacksonville Trades", icon: Building2 },
  General: { label: "General Talk", icon: Users },
};

function communityFor(trade: string) {
  return TRADE_COMMUNITY[trade] ?? { label: `${trade} Talk`, icon: Users };
}

function avatarToneIndex(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return hash % 6;
}

interface TradePostCardProps {
  post: CommunityPost;
  reactionState: CommunityReactionState;
  saved: boolean;
  onToggleSave: () => void;
  onVote: (direction: "up" | "down") => void;
  onOpen: () => void;
}

export function TradePostCard({ post, reactionState, saved, onToggleSave, onVote, onOpen }: TradePostCardProps) {
  const [failedThumbnailUrl, setFailedThumbnailUrl] = useState<string | null>(null);
  const community = post.communityName
    ? { ...communityFor(post.trade), label: post.communityName }
    : communityFor(post.trade);
  const CIcon = community.icon;
  const score = reactionState.upvotes - reactionState.downvotes;
  const comments = post.replies.length;
  const hasThumbnail = Boolean(post.thumbnailUrl && failedThumbnailUrl !== post.thumbnailUrl);
  const postContent = parseShopTalkPostBody(post.body);

  const [shareResult, setShareResult] = useState<"copied" | "shared" | null>(null);

  function handleShare() {
    const url = `${window.location.origin}/app?post=${post.id}`;
    const showResult = (result: "copied" | "shared") => {
      setShareResult(result);
      window.setTimeout(() => setShareResult(null), 1600);
    };
    if (navigator.share) {
      navigator.share({ title: post.title, url }).then(() => showResult("shared")).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => showResult("copied")).catch(() => {});
    }
  }

  return (
    <article className="trade-post">
      <header className="trade-post-head">
        <span className={`trade-post-avatar is-tone-${avatarToneIndex(post.author)}`}>
          {post.author.slice(0, 1).toUpperCase()}
        </span>
        <div className="trade-post-byline">
          <span className="trade-post-author">
            {post.author}
            {post.badge && <BadgeCheck size={13} className="trade-post-verified" />}
          </span>
          <span className="trade-post-community">
            <CIcon size={11} /> {community.label} · {post.createdAt}
          </span>
        </div>
      </header>

      <button type="button" className={hasThumbnail ? "trade-post-body-btn has-thumbnail" : "trade-post-body-btn"} onClick={onOpen}>
        <span className="trade-post-copy">
          <h3 className="trade-post-title">{post.title}</h3>
          {postContent.content ? <p className="trade-post-excerpt">{postContent.content}</p> : null}
          {postContent.article ? (
            <span className="trade-post-article-link">
              <Newspaper size={15} aria-hidden="true" />
              <span>
                <small>Linked article</small>
                <strong>{postContent.article.source}</strong>
              </span>
            </span>
          ) : null}
        </span>
        {hasThumbnail ? (
          <span className="trade-post-thumbnail">
            <img src={post.thumbnailUrl} alt={post.thumbnailAlt ?? ""} loading="lazy" onError={() => setFailedThumbnailUrl(post.thumbnailUrl ?? null)} />
          </span>
        ) : null}
      </button>

      <footer className="trade-post-actions">
        <div className="trade-post-votes">
          <button
            type="button"
            className={reactionState.reaction === "up" ? "trade-vote is-up" : "trade-vote"}
            aria-label="Upvote"
            aria-pressed={reactionState.reaction === "up"}
            disabled={reactionState.pending}
            onClick={() => onVote("up")}
          >
            <ArrowBigUp size={20} />
          </button>
          <span className="trade-vote-count">{score}</span>
          <button
            type="button"
            className={reactionState.reaction === "down" ? "trade-vote is-down" : "trade-vote"}
            aria-label="Downvote"
            aria-pressed={reactionState.reaction === "down"}
            disabled={reactionState.pending}
            onClick={() => onVote("down")}
          >
            <ArrowBigDown size={20} />
          </button>
        </div>
        <button type="button" className="trade-post-comment" onClick={onOpen}>
          <MessageCircle size={18} /> {comments}
        </button>
        <div className="trade-post-spacer" />
        <button
          type="button"
          className={saved ? "trade-post-icon is-saved" : "trade-post-icon"}
          aria-label={saved ? "Remove bookmark" : "Bookmark"}
          aria-pressed={saved}
          onClick={onToggleSave}
        >
          <Bookmark size={18} fill={saved ? "currentColor" : "none"} />
        </button>
        <button
          type="button"
          className={shareResult ? "trade-post-icon is-saved" : "trade-post-icon"}
          aria-label={shareResult === "copied" ? "Link copied" : shareResult === "shared" ? "Shared" : "Share"}
          onClick={handleShare}
        >
          {shareResult ? <Check size={18} /> : <Share2 size={18} />}
        </button>
      </footer>
    </article>
  );
}
