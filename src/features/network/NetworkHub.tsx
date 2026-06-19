import {
  ArrowRight,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
} from "lucide-react";
import type { Job, Talent } from "../../types";
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
        <span className="v2-network-avatar" aria-hidden="true">{person.name.charAt(0)}</span>
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
    <section className="v2-network-page" aria-label="Network">
      <header className="v2-network-header">
        <div>
          <h1>Network</h1>
          <p>People, answers, and reputation in one place.</p>
        </div>
        <div className="v2-network-header-metrics">
          <article><strong>{activeCrew.length}</strong><span>crew members</span></article>
          <article><strong>{openJobs}</strong><span>open jobs</span></article>
          <article><strong>{shoutOuts.length}</strong><span>shout-outs</span></article>
        </div>
      </header>

      <div className="v2-network-grid">
        <section className="v2-network-panel">
          <header>
            <div>
              <span>Top matches</span>
              <h2>People to reach out to</h2>
            </div>
            <button type="button" onClick={onOpenCrew}>Open crew</button>
          </header>
          <div className="v2-network-person-list">
            {activeCrew.map((person) => <TopTalentCard key={person.id} person={person} />)}
          </div>
        </section>

        <section className="v2-network-panel">
          <header>
            <div>
              <span>Shout-outs</span>
              <h2>Recent reputation signals</h2>
            </div>
            <button type="button" onClick={onOpenShopTalk}>Open Shop Talk</button>
          </header>
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
        </section>

        <section className="v2-network-panel v2-network-panel-wide">
          <header>
            <div>
              <span>Questions worth answering</span>
              <h2>Shop Talk with field weight</h2>
            </div>
            <button type="button" onClick={onOpenShopTalk}>View all</button>
          </header>
          <div className="v2-network-prompts">
            {questionPosts.length ? questionPosts.map((post) => <AnswerPrompt key={post.id} post={post} />) : (
              <article className="v2-network-empty">
                <Sparkles size={20} />
                <strong>No unresolved questions</strong>
                <span>Post a question and the network will start filling in the gaps.</span>
              </article>
            )}
          </div>
        </section>

        <section className="v2-network-panel">
          <header>
            <div>
              <span>Trust signals</span>
              <h2>Who looks ready</h2>
            </div>
            <button type="button" onClick={onOpenReviews}>Open reviews</button>
          </header>
          <div className="v2-network-trust-stack">
            <article>
              <ShieldCheck size={18} />
              <strong>Verified profiles</strong>
              <span>Identity and insurance markers stay visible across the app.</span>
            </article>
            <article>
              <Star size={18} />
              <strong>High reputation</strong>
              <span>Shout-outs and verified fixes can lift the profile before the first deal.</span>
            </article>
            <article>
              <Users size={18} />
              <strong>Active crew</strong>
              <span>Open jobs, crew invites, and referrals flow through one network view.</span>
            </article>
          </div>
        </section>
      </div>
    </section>
  );
}
