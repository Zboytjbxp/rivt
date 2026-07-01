import { useMemo, useState } from "react";
import {
  ArrowBigDown,
  ArrowBigUp,
  BadgeCheck,
  Bookmark,
  Briefcase,
  Building2,
  ChevronRight,
  Ellipsis,
  Hammer,
  MessageCircle,
  Plus,
  Share2,
  SlidersHorizontal,
  Users,
  Wrench,
  Zap,
} from "lucide-react";
import type { CommunityPost } from "../shop-talk/ShopTalkView";
import type { PrimaryDestination } from "../../app-shell/types";
import "./trade-feed.css";

type FeedTab = "for-you" | "following" | "nearby";

interface Community {
  name: string;
  count: string;
  icon: typeof Hammer;
  tone: string;
}

const COMMUNITIES: Community[] = [
  { name: "Carpentry Talk", count: "124K", icon: Hammer, tone: "#7a4a24" },
  { name: "Electrical Talk", count: "98K", icon: Zap, tone: "#1c1c1c" },
  { name: "Jacksonville Trades", count: "8.7K", icon: Building2, tone: "#0f6b7a" },
  { name: "Side Work", count: "5.2K", icon: Briefcase, tone: "#1c1c1c" },
  { name: "Tile Talk", count: "5.3K", icon: Wrench, tone: "#3b2a6b" },
  { name: "Plumbing Talk", count: "7.6K", icon: Wrench, tone: "#0f5f6b" },
];

// Map a post's trade to its community label + icon so feed cards read like the references.
const TRADE_COMMUNITY: Record<string, { label: string; icon: typeof Hammer; tone: string }> = {
  Carpentry: { label: "Carpentry Talk", icon: Hammer, tone: "#7a4a24" },
  Electrical: { label: "Electrical Talk", icon: Zap, tone: "#1c1c1c" },
  Plumbing: { label: "Plumbing Talk", icon: Wrench, tone: "#0f5f6b" },
  Tile: { label: "Tile Talk", icon: Wrench, tone: "#3b2a6b" },
  Cabinetry: { label: "Cabinetry Talk", icon: Hammer, tone: "#6b4a1c" },
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

function netScore(post: CommunityPost) {
  return post.upvotes - post.downvotes;
}

interface TradeFeedProps {
  posts: CommunityPost[];
  onOpenPost: (postId: number) => void;
  onAsk: () => void;
  onNavigate: (destination: PrimaryDestination) => void;
}

export function TradeFeed({ posts, onOpenPost, onAsk, onNavigate }: TradeFeedProps) {
  const [tab, setTab] = useState<FeedTab>("for-you");
  const [votes, setVotes] = useState<Record<number, "up" | "down" | null>>({});
  const [saved, setSaved] = useState<Set<number>>(new Set());

  const orderedPosts = useMemo(() => {
    const list = [...posts];
    if (tab === "for-you") list.sort((a, b) => netScore(b) - netScore(a));
    return list;
  }, [posts, tab]);

  function toggleVote(id: number, dir: "up" | "down") {
    setVotes((prev) => ({ ...prev, [id]: prev[id] === dir ? null : dir }));
  }
  function toggleSave(id: number) {
    setSaved((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="trade-feed">
      <div className="trade-feed-cta-row">
        <button type="button" className="trade-feed-cta is-ask" onClick={onAsk}>
          <MessageCircle size={18} /> Ask the trades
        </button>
        <button type="button" className="trade-feed-cta is-crew" onClick={() => onNavigate("crew")}>
          <Users size={18} /> Find your crew
        </button>
      </div>

      <div className="trade-feed-communities">
        <div className="trade-feed-section-head">
          <h2>Communities</h2>
          <button type="button" className="trade-feed-seeall" onClick={() => onNavigate("shop-talk")}>
            See all
          </button>
        </div>
        <div className="trade-feed-community-row">
          {COMMUNITIES.map((c) => {
            const Icon = c.icon;
            return (
              <button
                key={c.name}
                type="button"
                className="trade-feed-community-card"
                onClick={() => onNavigate("shop-talk")}
              >
                <span className="trade-feed-community-icon" style={{ background: c.tone }}>
                  <Icon size={22} strokeWidth={2.4} />
                </span>
                <span className="trade-feed-community-name">{c.name}</span>
                <span className="trade-feed-community-count">{c.count}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="trade-feed-tabs">
        <div className="trade-feed-tab-group" role="tablist" aria-label="Feed filter">
          <button type="button" role="tab" aria-selected={tab === "for-you"} className={tab === "for-you" ? "is-active" : ""} onClick={() => setTab("for-you")}>For you</button>
          <button type="button" role="tab" aria-selected={tab === "following"} className={tab === "following" ? "is-active" : ""} onClick={() => setTab("following")}>Following</button>
          <button type="button" role="tab" aria-selected={tab === "nearby"} className={tab === "nearby" ? "is-active" : ""} onClick={() => setTab("nearby")}>Nearby</button>
        </div>
        <button type="button" className="trade-feed-filter-btn" aria-label="Feed settings">
          <SlidersHorizontal size={18} />
        </button>
      </div>

      <div className="trade-feed-list">
        {orderedPosts.map((post) => {
          const community = communityFor(post.trade);
          const CIcon = community.icon;
          const vote = votes[post.id] ?? null;
          const score = netScore(post) + (vote === "up" ? 1 : vote === "down" ? -1 : 0);
          const isSaved = saved.has(post.id);
          return (
            <article key={post.id} className="trade-post">
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
                <button type="button" className="trade-post-more" aria-label="Post options">
                  <Ellipsis size={18} />
                </button>
              </header>

              <button type="button" className="trade-post-body-btn" onClick={() => onOpenPost(post.id)}>
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
                    onClick={() => toggleVote(post.id, "up")}
                  >
                    <ArrowBigUp size={20} />
                  </button>
                  <span className="trade-vote-count">{score}</span>
                  <button
                    type="button"
                    className={vote === "down" ? "trade-vote is-down" : "trade-vote"}
                    aria-label="Downvote"
                    aria-pressed={vote === "down"}
                    onClick={() => toggleVote(post.id, "down")}
                  >
                    <ArrowBigDown size={20} />
                  </button>
                </div>
                <button type="button" className="trade-post-comment" onClick={() => onOpenPost(post.id)}>
                  <MessageCircle size={18} /> {post.commentCount ?? post.replies.length}
                </button>
                <div className="trade-post-spacer" />
                <button
                  type="button"
                  className={isSaved ? "trade-post-icon is-saved" : "trade-post-icon"}
                  aria-label={isSaved ? "Remove bookmark" : "Bookmark"}
                  aria-pressed={isSaved}
                  onClick={() => toggleSave(post.id)}
                >
                  <Bookmark size={18} fill={isSaved ? "currentColor" : "none"} />
                </button>
                <button type="button" className="trade-post-icon" aria-label="Share">
                  <Share2 size={18} />
                </button>
              </footer>
            </article>
          );
        })}
      </div>

      <button type="button" className="trade-feed-fab" onClick={onAsk}>
        <Plus size={20} /> Ask
      </button>

      <div className="trade-feed-footer">
        <button type="button" className="trade-feed-footer-link" onClick={() => onNavigate("shop-talk")}>
          Browse all communities <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}
