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
  Share2,
  Users,
  Wrench,
} from "lucide-react";
import type { CommunityPost } from "./ShopTalkView";
import "../home/trade-feed.css";

// Map a post's trade to its community label + icon so cards read like the references.
const TRADE_COMMUNITY: Record<string, { label: string; icon: typeof Hammer; tone: string }> = {
  Carpentry: { label: "Carpentry Talk", icon: Hammer, tone: "#7a4a24" },
  Electrical: { label: "Electrical Talk", icon: Wrench, tone: "#1c1c1c" },
  Plumbing: { label: "Plumbing Talk", icon: Wrench, tone: "#0f5f6b" },
  Tile: { label: "Tile Talk", icon: Wrench, tone: "#3b2a6b" },
  Cabinetry: { label: "Cabinetry Talk", icon: Hammer, tone: "#6b4a1c" },
  Jacksonville: { label: "Jacksonville Trades", icon: Building2, tone: "#0f6b7a" },
  General: { label: "General Talk", icon: Users, tone: "#444" },
};

function communityFor(trade: string) {
  return TRADE_COMMUNITY[trade] ?? { label: `${trade} Talk`, icon: Users, tone: "#444" };
}

const AVATAR_TONES = ["#c2410c", "#0f766e", "#7c3aed", "#b45309", "#1d4ed8", "#be123c"];
function avatarTone(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}

interface TradePostCardProps {
  post: CommunityPost;
  saved: boolean;
  onToggleSave: () => void;
  onOpen: () => void;
}

const VOTES_KEY = "rivt.postVotes.v1";
function readVotes(): Record<string, "up" | "down"> {
  try { return JSON.parse(localStorage.getItem(VOTES_KEY) ?? "{}") as Record<string, "up" | "down">; }
  catch { return {}; }
}

export function TradePostCard({ post, saved, onToggleSave, onOpen }: TradePostCardProps) {
  const [vote, setVote] = useState<"up" | "down" | null>(() => readVotes()[String(post.id)] ?? null);
  const community = communityFor(post.trade);
  const CIcon = community.icon;
  const baseScore = post.upvotes - post.downvotes;
  const score = baseScore + (vote === "up" ? 1 : vote === "down" ? -1 : 0);
  const comments = post.commentCount ?? post.replies.length;

  const [shared, setShared] = useState(false);

  function toggleVote(dir: "up" | "down") {
    setVote((prev) => {
      const next = prev === dir ? null : dir;
      try {
        const map = readVotes();
        if (next) map[String(post.id)] = next;
        else delete map[String(post.id)];
        localStorage.setItem(VOTES_KEY, JSON.stringify(map));
      } catch { /* ignore */ }
      return next;
    });
  }

  function handleShare() {
    const url = `${window.location.origin}/app?post=${post.id}`;
    const done = () => { setShared(true); window.setTimeout(() => setShared(false), 1600); };
    if (navigator.share) {
      navigator.share({ title: post.title, url }).then(done).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(done).catch(() => {});
    } else {
      done();
    }
  }

  return (
    <article className="trade-post">
      <header className="trade-post-head">
        <span className="trade-post-avatar" style={{ background: avatarTone(post.author) }}>
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

      <button type="button" className="trade-post-body-btn" onClick={onOpen}>
        <h3 className="trade-post-title">{post.title}</h3>
        <p className="trade-post-excerpt">{post.body}</p>
      </button>

      <footer className="trade-post-actions">
        <div className="trade-post-votes">
          <button
            type="button"
            className={vote === "up" ? "trade-vote is-up" : "trade-vote"}
            aria-label="Upvote"
            aria-pressed={vote === "up"}
            onClick={() => toggleVote("up")}
          >
            <ArrowBigUp size={20} />
          </button>
          <span className="trade-vote-count">{score}</span>
          <button
            type="button"
            className={vote === "down" ? "trade-vote is-down" : "trade-vote"}
            aria-label="Downvote"
            aria-pressed={vote === "down"}
            onClick={() => toggleVote("down")}
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
          className={shared ? "trade-post-icon is-saved" : "trade-post-icon"}
          aria-label={shared ? "Link copied" : "Share"}
          onClick={handleShare}
        >
          {shared ? <Check size={18} /> : <Share2 size={18} />}
        </button>
      </footer>
    </article>
  );
}
