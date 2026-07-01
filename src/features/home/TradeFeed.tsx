import { useMemo, useState } from "react";
import {
  Briefcase,
  Building2,
  ChevronRight,
  Hammer,
  MessageCircle,
  Plus,
  SlidersHorizontal,
  Users,
  Wrench,
  Zap,
} from "lucide-react";
import type { CommunityPost } from "../shop-talk/ShopTalkView";
import { TradePostCard } from "../shop-talk/TradePostCard";
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
  const [saved, setSaved] = useState<Set<number>>(new Set());

  const orderedPosts = useMemo(() => {
    const list = [...posts];
    if (tab === "for-you") list.sort((a, b) => netScore(b) - netScore(a));
    return list;
  }, [posts, tab]);

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
        {orderedPosts.map((post) => (
          <TradePostCard
            key={post.id}
            post={post}
            saved={saved.has(post.id)}
            onToggleSave={() => toggleSave(post.id)}
            onOpen={() => onOpenPost(post.id)}
          />
        ))}
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
