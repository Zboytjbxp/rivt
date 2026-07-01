import { useMemo, useState } from "react";
import {
  Briefcase,
  Building2,
  ChevronRight,
  Hammer,
  MessageCircle,
  Plus,
  TrendingUp,
  Users,
  Wrench,
  Zap,
} from "lucide-react";
import type { CommunityPost } from "../shop-talk/ShopTalkView";
import { TradePostCard } from "../shop-talk/TradePostCard";
import type { PrimaryDestination } from "../../app-shell/types";
import "./trade-feed.css";

const BOOKMARK_KEY = "rivt.shopTalkBookmarks.v1";
const AVAIL_KEY = "rivt.availability.v1";
type Availability = "available" | "limited" | "booked";
const AVAIL_LABEL: Record<Availability, string> = {
  available: "Available this week",
  limited: "Limited availability",
  booked: "Booked up",
};
const AVAIL_ORDER: Availability[] = ["available", "limited", "booked"];

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

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function readBookmarks(): Set<number> {
  try { return new Set(JSON.parse(localStorage.getItem(BOOKMARK_KEY) ?? "[]") as number[]); }
  catch { return new Set(); }
}
function readAvailability(): Availability {
  try {
    const v = localStorage.getItem(AVAIL_KEY);
    if (v === "available" || v === "limited" || v === "booked") return v;
  } catch { /* ignore */ }
  return "available";
}

interface TradeFeedProps {
  posts: CommunityPost[];
  name: string;
  location: string;
  primaryTrade: string;
  onOpenPost: (postId: number) => void;
  onAsk: () => void;
  onPostWork: () => void;
  onNavigate: (destination: PrimaryDestination) => void;
}

export function TradeFeed({ posts, name, location, primaryTrade, onOpenPost, onAsk, onPostWork, onNavigate }: TradeFeedProps) {
  const [saved, setSaved] = useState<Set<number>>(readBookmarks);
  const [availability, setAvailability] = useState<Availability>(readAvailability);

  const trendingPosts = useMemo(
    () => [...posts].sort((a, b) => netScore(b) - netScore(a)),
    [posts],
  );

  // Questions in the user's trade that still need an answer — a real, personal nudge.
  const tradeQuestions = useMemo(
    () => posts.filter((p) => (p.trade === primaryTrade || p.trade === "General") && p.status !== "Verified Fix").length,
    [posts, primaryTrade],
  );

  function toggleSave(id: number) {
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

  return (
    <div className="trade-feed">
      {/* Personalized header */}
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

      {/* Primary actions */}
      <div className="trade-feed-cta-row">
        <button type="button" className="trade-feed-cta is-ask" onClick={onPostWork}>
          <Plus size={18} /> Post work
        </button>
        <button type="button" className="trade-feed-cta is-crew" onClick={() => onNavigate("crew")}>
          <Users size={18} /> Find your crew
        </button>
      </div>

      {/* Answer-queue nudge — deep link into the trades */}
      {tradeQuestions > 0 && (
        <button type="button" className="trade-feed-nudge" onClick={onAsk}>
          <span className="trade-feed-nudge-icon"><MessageCircle size={18} /></span>
          <span className="trade-feed-nudge-copy">
            <b>{tradeQuestions} {primaryTrade} question{tradeQuestions === 1 ? "" : "s"} need a hand</b>
            <small>Answer one to build your reputation</small>
          </span>
          <ChevronRight size={18} />
        </button>
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
            <span>Field answers from the trades will show up here.</span>
            <button type="button" className="trade-feed-cta is-ask" onClick={onAsk}>Ask the trades</button>
          </div>
        ) : (
          trendingPosts.map((post) => (
            <TradePostCard
              key={post.id}
              post={post}
              saved={saved.has(post.id)}
              onToggleSave={() => toggleSave(post.id)}
              onOpen={() => onOpenPost(post.id)}
            />
          ))
        )}
      </div>

      {trendingPosts.length > 0 && (
        <div className="trade-feed-footer">
          <button type="button" className="trade-feed-footer-link" onClick={() => onNavigate("shop-talk")}>
            See all in Shop Talk <ChevronRight size={15} />
          </button>
        </div>
      )}

      <button type="button" className="trade-feed-fab" onClick={onAsk}>
        <Plus size={20} /> Ask
      </button>
    </div>
  );
}
