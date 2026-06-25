import {
  ArrowRight,
  Briefcase,
  MessageSquareText,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  ThumbsUp,
  Users,
} from "lucide-react";
import { useState } from "react";
import type { Job, Talent } from "../../types";
import { Avatar, EmptyState, MetricTile, PageHeader, Panel } from "../../components/ui";
import "./network-hub.css";

interface CommunityPost {
  id: number;
  title: string;
  trade: string;
  status: string;
  flair?: string;
}

interface ShoutOut {
  id: number;
  from: string;
  to: string;
  trade: string;
  message: string;
  createdAt: string;
}

interface NetworkHubProps {
  view: "My Crew" | "Reviews";
  jobs: Job[];
  talent: Talent[];
  communityPosts: CommunityPost[];
  shoutOuts: ShoutOut[];
  displayName: string;
  onOpenCrew: () => void;
  onOpenShopTalk: () => void;
  onOpenReviews: () => void;
  onAddShoutOut: (to: string, trade: string, message: string) => void;
}

function TopTalentCard({ person }: { person: Talent }) {
  return (
    <article className="v2-network-person-card">
      <div className="v2-network-person-header">
        <Avatar name={person.name} size="md" className="v2-network-avatar" />
        <div>
          <strong>{person.name}</strong>
          <span>{person.trade} · {person.location}</span>
        </div>
        <strong>{person.match}%</strong>
      </div>

      <p>{person.availability} · {person.responseTime}</p>

      <footer>
        <span>{person.rating.toFixed(1)} rating</span>
        <span>{person.reviews} reviews</span>
      </footer>
    </article>
  );
}

function AnswerPrompt({ post }: { post: CommunityPost }) {
  return (
    <button type="button" className="v2-network-prompt">
      <span className="v2-network-prompt-icon"><MessageSquareText size={16} /></span>
      <span>
        <strong>{post.title}</strong>
        <small>{post.trade} · {post.status}</small>
      </span>
      <ArrowRight size={15} />
    </button>
  );
}

function ReviewsView({
  shoutOuts,
  displayName,
  onAddShoutOut,
  onOpenCrew,
}: {
  shoutOuts: ShoutOut[];
  displayName: string;
  onAddShoutOut: (to: string, trade: string, message: string) => void;
  onOpenCrew: () => void;
}) {
  const [to, setTo] = useState("");
  const [trade, setTrade] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const received = shoutOuts.filter((s) => s.to === displayName);
  const given = shoutOuts.filter((s) => s.from === displayName);

  function submit() {
    if (!to.trim() || !message.trim()) return;
    onAddShoutOut(to.trim(), trade.trim(), message.trim());
    setTo("");
    setTrade("");
    setMessage("");
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
  }

  return (
    <div className="v2-reviews-page">
      <div className="v2-reviews-grid">
        <Panel
          className="v2-reviews-panel v2-reviews-panel-wide"
          eyebrow="Write a review"
          title="Shout out someone you worked with"
        >
          <div className="v2-review-form">
            <label>
              <span>Who are you reviewing?</span>
              <input
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="Name or company"
              />
            </label>
            <label>
              <span>Trade / context</span>
              <input
                value={trade}
                onChange={(e) => setTrade(e.target.value)}
                placeholder="Electrical, roofing, general…"
              />
            </label>
            <label className="is-wide">
              <span>Your review</span>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                placeholder="What made them worth working with?"
              />
            </label>
            <div className="v2-review-form-actions">
              {submitted && <span className="v2-review-sent">Review posted!</span>}
              <button
                type="button"
                className="v2-primary-button"
                disabled={!to.trim() || !message.trim()}
                onClick={submit}
              >
                <Send size={15} />
                Post review
              </button>
            </div>
          </div>
        </Panel>

        <Panel
          className="v2-reviews-panel"
          eyebrow={`${received.length} received`}
          title="Reviews you've received"
        >
          {received.length ? (
            <div className="v2-reviews-list">
              {received.map((item) => (
                <article key={item.id} className="v2-review-item">
                  <div className="v2-review-item-header">
                    <Avatar name={item.from} size="sm" />
                    <div>
                      <strong>{item.from}</strong>
                      {item.trade && <span>{item.trade}</span>}
                    </div>
                  </div>
                  <p>{item.message}</p>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              className="v2-network-empty"
              icon={<Star size={20} />}
              title="No reviews yet"
              description="Complete jobs and build connections. Reviews from contractors you've worked with will appear here."
              action={<button type="button" onClick={onOpenCrew}>Find crew</button>}
              compact
            />
          )}
        </Panel>

        <Panel
          className="v2-reviews-panel"
          eyebrow={`${given.length} given`}
          title="Reviews you've written"
        >
          {given.length ? (
            <div className="v2-reviews-list">
              {given.map((item) => (
                <article key={item.id} className="v2-review-item">
                  <div className="v2-review-item-header">
                    <Avatar name={item.to} size="sm" />
                    <div>
                      <strong>{item.to}</strong>
                      {item.trade && <span>{item.trade}</span>}
                    </div>
                  </div>
                  <p>{item.message}</p>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              className="v2-network-empty"
              icon={<Star size={20} />}
              title="No reviews written yet"
              description="Use the form above to write your first shout-out."
              compact
            />
          )}
        </Panel>
      </div>
    </div>
  );
}

export function NetworkHub({ view, jobs, talent, communityPosts, shoutOuts, displayName, onOpenCrew, onOpenShopTalk, onOpenReviews, onAddShoutOut }: NetworkHubProps) {
  const activeCrew = talent.slice(0, 3);
  const questionPosts = communityPosts.filter((post) => post.flair === "Question" || post.status !== "Open").slice(0, 4);
  const highlightedShoutOuts = shoutOuts.slice(0, 4);
  const openJobs = jobs.filter((job) => job.status === "Open").length;

  if (view === "Reviews") {
    return (
      <section className="v2-network-page" aria-label="Reviews">
        <PageHeader
          className="v2-network-header"
          title="Reviews"
          description="Shout-outs and reputation from people you've worked with."
          actions={
            <div className="v2-network-header-metrics">
              <MetricTile icon={<Star size={18} />} value={shoutOuts.filter((s) => s.to === displayName).length} label="received" />
              <MetricTile icon={<ThumbsUp size={18} />} value={shoutOuts.filter((s) => s.from === displayName).length} label="given" />
            </div>
          }
        />
        <ReviewsView
          shoutOuts={shoutOuts}
          displayName={displayName}
          onAddShoutOut={onAddShoutOut}
          onOpenCrew={onOpenCrew}
        />
      </section>
    );
  }

  return (
    <section className="v2-network-page" aria-label="Crew">
      <PageHeader
        className="v2-network-header"
        title="Crew"
        description="Trusted connections and reputation."
        actions={
        <div className="v2-network-header-metrics">
          <MetricTile icon={<Users size={18} />} value={activeCrew.length} label="crew members" />
          <MetricTile icon={<Briefcase size={18} />} value={openJobs} label="open jobs" />
          <MetricTile icon={<ThumbsUp size={18} />} value={shoutOuts.length} label="shout-outs" />
        </div>
        }
      />

      <div className="v2-network-grid">
        <Panel
          className="v2-network-panel"
          eyebrow="Top matches"
          title="People to reach out to"
          action={<button type="button" onClick={onOpenCrew}>Open crew</button>}
        >
          <div className="v2-network-person-list">
            {activeCrew.length ? activeCrew.map((person) => <TopTalentCard key={person.id} person={person} />) : (
              <EmptyState
                className="v2-network-empty"
                icon={<Users size={20} />}
                title="Your crew starts here"
                description="Add contractors and tradespeople you have worked with. Your crew is your reputation network."
                action={<button type="button" onClick={onOpenCrew}>Find people</button>}
                compact
              />
            )}
          </div>
        </Panel>

        <Panel
          className="v2-network-panel"
          eyebrow="Shout-outs"
          title="Recent reputation signals"
          action={<button type="button" onClick={onOpenReviews}>See all reviews</button>}
        >
          <div className="v2-network-shoutouts">
            {highlightedShoutOuts.length ? highlightedShoutOuts.map((item) => (
              <article key={item.id}>
                <div>
                  <strong>{item.to}</strong>
                  <span>{item.trade}</span>
                </div>
                <p>{item.message}</p>
              </article>
            )) : (
              <EmptyState
                className="v2-network-empty"
                icon={<Star size={20} />}
                title="No shout-outs yet"
                description="Shout-outs from jobs and Shop Talk will appear here."
                compact
              />
            )}
          </div>
        </Panel>

        <Panel
          className="v2-network-panel v2-network-panel-wide"
          eyebrow="Questions worth answering"
          title="Shop Talk with field weight"
          action={<button type="button" onClick={onOpenShopTalk}>View all</button>}
        >
          <div className="v2-network-prompts">
            {questionPosts.length ? questionPosts.map((post) => <AnswerPrompt key={post.id} post={post} />) : (
              <EmptyState
                className="v2-network-empty"
                icon={<Sparkles size={20} />}
                title="Nothing posted in your trade yet"
                description="Be the first to ask a question or share a field-tested fix."
                action={<button type="button" onClick={onOpenShopTalk}>Post in Shop Talk</button>}
                compact
              />
            )}
          </div>
        </Panel>

        <Panel
          className="v2-network-panel"
          eyebrow="Trust signals"
          title="Who looks ready"
          action={<button type="button" onClick={onOpenReviews}>Open reviews</button>}
        >
          <div className="v2-network-trust-stack">
            <article>
              <ShieldCheck size={18} />
              <strong>Evidence states</strong>
              <span>Self-reported, uploaded, and verified markers stay distinct.</span>
            </article>
            <article>
              <Star size={18} />
              <strong>High reputation</strong>
              <span>Shout-outs and field answers build trust before the first deal.</span>
            </article>
            <article>
              <Users size={18} />
              <strong>Active crew</strong>
              <span>Jobs, invites, and referrals in one network view.</span>
            </article>
          </div>
        </Panel>
      </div>
    </section>
  );
}
