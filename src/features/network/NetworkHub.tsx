import {
  ArrowRight,
  Briefcase,
  CheckCircle2,
  MessageSquareText,
  Plus,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  ThumbsUp,
  Users,
  X,
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

// ── Sub Roster ────────────────────────────────────────────────────────────────

const subRosterKey = "rivt.subRoster.v1";

interface SubRosterEntry {
  id: string;
  name: string;
  trade: string;
  rateNote: string;
  addedAt: string;
}

function readSubRoster(): SubRosterEntry[] {
  try {
    const stored = localStorage.getItem(subRosterKey);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as SubRosterEntry[];
    return Array.isArray(parsed) ? parsed.slice(0, 50) : [];
  } catch { return []; }
}

function persistSubRoster(entries: SubRosterEntry[]) {
  try { localStorage.setItem(subRosterKey, JSON.stringify(entries.slice(0, 50))); } catch {}
}

function SubRosterPanel() {
  const [roster, setRoster] = useState<SubRosterEntry[]>(readSubRoster);
  const [name, setName] = useState("");
  const [trade, setTrade] = useState("");
  const [rateNote, setRateNote] = useState("");
  const [notice, setNotice] = useState("");

  function addToRoster() {
    if (!name.trim()) return;
    const entry: SubRosterEntry = {
      id: crypto.randomUUID(),
      name: name.trim(),
      trade: trade.trim(),
      rateNote: rateNote.trim(),
      addedAt: new Date().toISOString(),
    };
    const next = [entry, ...roster];
    setRoster(next);
    persistSubRoster(next);
    setName("");
    setTrade("");
    setRateNote("");
    setNotice("Added to roster.");
    setTimeout(() => setNotice(""), 3000);
  }

  function removeFromRoster(id: string) {
    const next = roster.filter((e) => e.id !== id);
    setRoster(next);
    persistSubRoster(next);
  }

  return (
    <Panel
      className="v2-network-panel v2-network-panel-wide"
      eyebrow={`${roster.length} saved`}
      title="Sub roster"
    >
      <div className="v2-sub-roster">
        <div className="v2-sub-roster-form">
          <div className="v2-sub-roster-inputs">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name or company" />
            <input value={trade} onChange={(e) => setTrade(e.target.value)} placeholder="Trade (electrical, framing…)" />
            <input value={rateNote} onChange={(e) => setRateNote(e.target.value)} placeholder="Rate note ($65/hr, $800/day…)" />
          </div>
          {notice ? <p className="v2-sub-roster-notice" role="status">{notice}</p> : null}
          <button type="button" className="v2-primary-button" disabled={!name.trim()} onClick={addToRoster}><Plus size={14} />Add to roster</button>
        </div>
        {roster.length ? (
          <div className="v2-sub-roster-list">
            {roster.map((entry) => (
              <article key={entry.id} className="v2-sub-roster-item">
                <Avatar name={entry.name} size="sm" className="v2-network-avatar" />
                <div className="v2-sub-roster-item-copy">
                  <strong>{entry.name}</strong>
                  {entry.trade ? <span>{entry.trade}</span> : null}
                  {entry.rateNote ? <small>{entry.rateNote}</small> : null}
                </div>
                <button type="button" className="v2-sub-roster-remove" aria-label={`Remove ${entry.name}`} onClick={() => removeFromRoster(entry.id)}><X size={14} /></button>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            className="v2-network-empty"
            icon={<Users size={20} />}
            title="No roster entries yet"
            description="Save contractors and tradespeople you rely on for quick access when new work comes in."
            compact
          />
        )}
      </div>
    </Panel>
  );
}

// ── Crew Invite Planner ───────────────────────────────────────────────────────

const crewInviteKey = "rivt.crewInvites.v1";

type InviteStatus = "pending" | "accepted" | "declined";

interface CrewInvite {
  id: string;
  jobRef: string;
  name: string;
  trade: string;
  note: string;
  status: InviteStatus;
  createdAt: string;
}

function readCrewInvites(): CrewInvite[] {
  try {
    const stored = localStorage.getItem(crewInviteKey);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as CrewInvite[];
    return Array.isArray(parsed) ? parsed.slice(0, 50) : [];
  } catch { return []; }
}

function persistCrewInvites(invites: CrewInvite[]) {
  try { localStorage.setItem(crewInviteKey, JSON.stringify(invites.slice(0, 50))); } catch {}
}

function CrewInvitePlanner() {
  const [invites, setInvites] = useState<CrewInvite[]>(readCrewInvites);
  const [jobRef, setJobRef] = useState("");
  const [name, setName] = useState("");
  const [trade, setTrade] = useState("");
  const [note, setNote] = useState("");
  const [notice, setNotice] = useState("");

  function addInvite() {
    if (!name.trim()) return;
    const invite: CrewInvite = {
      id: crypto.randomUUID(),
      jobRef: jobRef.trim(),
      name: name.trim(),
      trade: trade.trim(),
      note: note.trim(),
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    const next = [invite, ...invites];
    setInvites(next);
    persistCrewInvites(next);
    setJobRef("");
    setName("");
    setTrade("");
    setNote("");
    setNotice("Invite planned.");
    setTimeout(() => setNotice(""), 2500);
  }

  function updateStatus(id: string, status: InviteStatus) {
    const next = invites.map((i) => i.id === id ? { ...i, status } : i);
    setInvites(next);
    persistCrewInvites(next);
  }

  function removeInvite(id: string) {
    const next = invites.filter((i) => i.id !== id);
    setInvites(next);
    persistCrewInvites(next);
  }

  const pending = invites.filter((i) => i.status === "pending").length;
  const accepted = invites.filter((i) => i.status === "accepted").length;

  return (
    <Panel
      className="v2-network-panel v2-network-panel-wide"
      eyebrow={`${pending} pending · ${accepted} accepted`}
      title="Crew invite planner"
    >
      <div className="v2-crew-invite-planner">
        <div className="v2-crew-invite-form">
          <div className="v2-crew-invite-inputs">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name or company" />
            <input value={trade} onChange={(e) => setTrade(e.target.value)} placeholder="Trade (electrical, framing…)" />
            <input value={jobRef} onChange={(e) => setJobRef(e.target.value)} placeholder="Job or project name" />
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (rate, scope, start date…)" />
          </div>
          {notice ? <p className="v2-sub-roster-notice" role="status">{notice}</p> : null}
          <button type="button" className="v2-primary-button" disabled={!name.trim()} onClick={addInvite}><Plus size={14} />Plan invite</button>
        </div>
        {invites.length ? (
          <div className="v2-crew-invite-list">
            {invites.map((inv) => (
              <article key={inv.id} className={`v2-crew-invite-item ci-status-${inv.status}`}>
                <div className="v2-crew-invite-item-head">
                  <Avatar name={inv.name} size="sm" className="v2-network-avatar" />
                  <div className="v2-crew-invite-copy">
                    <strong>{inv.name}</strong>
                    {inv.trade ? <span>{inv.trade}</span> : null}
                    {inv.jobRef ? <small>Job: {inv.jobRef}</small> : null}
                    {inv.note ? <small>{inv.note}</small> : null}
                  </div>
                  <span className={`v2-ci-pill ci-status-${inv.status}`}>{inv.status}</span>
                  <button type="button" className="v2-sub-roster-remove" aria-label={`Remove ${inv.name}`} onClick={() => removeInvite(inv.id)}><X size={14} /></button>
                </div>
                {inv.status === "pending" ? (
                  <div className="v2-crew-invite-actions">
                    <button type="button" className="v2-primary-button" onClick={() => updateStatus(inv.id, "accepted")}><CheckCircle2 size={13} />Accepted</button>
                    <button type="button" onClick={() => updateStatus(inv.id, "declined")}>Declined</button>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            className="v2-network-empty"
            icon={<Users size={20} />}
            title="No planned invites yet"
            description="Track who you plan to bring on to upcoming jobs. Mark accepted or declined as responses come in."
            compact
          />
        )}
      </div>
    </Panel>
  );
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

        <SubRosterPanel />

        <CrewInvitePlanner />

        <Panel
          className="v2-network-panel"
          eyebrow="Shout-outs"
          title="Recent reputation signals"
          action={<div className="v2-network-panel-actions"><button type="button" className="v2-primary-button" onClick={onOpenReviews}>Write shout-out</button><button type="button" onClick={onOpenReviews}>See all</button></div>}
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
