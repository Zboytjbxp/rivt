import {
  ArrowRight,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
} from "lucide-react";
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
  to: string;
  trade: string;
  message: string;
}

interface NetworkHubProps {
  jobs: Job[];
  talent: Talent[];
  communityPosts: CommunityPost[];
  shoutOuts: ShoutOut[];
  onOpenCrew: () => void;
  onOpenShopTalk: () => void;
  onOpenReviews: () => void;
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

export function NetworkHub({ jobs, talent, communityPosts, shoutOuts, onOpenCrew, onOpenShopTalk, onOpenReviews }: NetworkHubProps) {
  const activeCrew = talent.slice(0, 3);
  const questionPosts = communityPosts.filter((post) => post.flair === "Question" || post.status !== "Open").slice(0, 4);
  const highlightedShoutOuts = shoutOuts.slice(0, 4);
  const openJobs = jobs.filter((job) => job.status === "Open").length;

  return (
    <section className="v2-network-page" aria-label="Crew">
      <PageHeader
        className="v2-network-header"
        title="Crew"
        description="Your trusted trade connections and reputation signals."
        actions={
        <div className="v2-network-header-metrics">
          <MetricTile value={activeCrew.length} label="crew members" />
          <MetricTile value={openJobs} label="open jobs" />
          <MetricTile value={shoutOuts.length} label="shout-outs" />
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
          action={<button type="button" onClick={onOpenShopTalk}>Open Shop Talk</button>}
        >
          <div className="v2-network-shoutouts">
            {highlightedShoutOuts.map((item) => (
              <article key={item.id}>
                <div>
                  <strong>{item.to}</strong>
                  <span>{item.trade}</span>
                </div>
                <p>{item.message}</p>
              </article>
            ))}
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
              <span>Self-reported, uploaded, reviewed, and verified markers stay distinct.</span>
            </article>
            <article>
              <Star size={18} />
              <strong>High reputation</strong>
              <span>Shout-outs and accepted field fixes can lift the profile before the first deal.</span>
            </article>
            <article>
              <Users size={18} />
              <strong>Active crew</strong>
              <span>Open jobs, crew invites, and referrals flow through one network view.</span>
            </article>
          </div>
        </Panel>
      </div>
    </section>
  );
}
