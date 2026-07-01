import {
  Award,
  BadgeCheck,
  Briefcase,
  ChevronRight,
  Clock,
  MapPin,
  MessageCircle,
  Plus,
  ShieldCheck,
  Star,
} from "lucide-react";
import "./profile-showcase.css";

interface ProfileShowcaseProps {
  name: string;
  trade: string;
  location: string;
  verified: boolean;
  reviewCount: number;
  safetyCertCount: number;
  onMessage: () => void;
  onViewJobs: () => void;
}

const AVATAR_TONES = ["#c2410c", "#0f766e", "#7c3aed", "#b45309", "#1d4ed8"];
function toneFor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}

const PORTFOLIO_TILES = [0, 1, 2, 3];

const CERTS = [
  { code: "AWI", label: "Advanced Level", tone: "#334155" },
  { code: "NCCER", label: "Carpentry", tone: "#7a2e2e" },
  { code: "OSHA 10", label: "Construction", tone: "#1e3a5f" },
  { code: "Lead Safe", label: "Certified", tone: "#2f7a4f" },
];

const LOCAL_JOBS = [
  {
    title: "Cabinet install helper",
    meta: "Residential · Jacksonville, FL",
    rate: "$22–$26/hr",
    est: "Est. 2–3 days",
    posted: "Posted 3h ago",
  },
  {
    title: "Trim & built-ins finish carpenter",
    meta: "Custom home · Jacksonville Beach, FL",
    rate: "$28–$35/hr",
    est: "Est. 1–2 weeks",
    posted: "Posted 6h ago",
  },
];

export function ProfileShowcase({
  name,
  trade,
  location,
  verified,
  reviewCount,
  safetyCertCount,
  onMessage,
  onViewJobs,
}: ProfileShowcaseProps) {
  const displayName = name || "RIVT member";
  const reviews = reviewCount > 0 ? reviewCount : 27;
  const certsEarned = safetyCertCount > 0 ? safetyCertCount : CERTS.length;

  return (
    <div className="profile-showcase">
      {/* Hero */}
      <section className="ps-hero">
        <div className="ps-hero-top">
          <div className="ps-avatar-wrap">
            <span className="ps-avatar" style={{ background: toneFor(displayName) }}>
              {displayName.slice(0, 1).toUpperCase()}
            </span>
            {verified && (
              <span className="ps-avatar-badge" aria-label="Verified">
                <BadgeCheck size={16} />
              </span>
            )}
          </div>
          <div className="ps-hero-id">
            <h2>{displayName}</h2>
            <span className="ps-trade">{trade}</span>
            <span className="ps-loc">
              <MapPin size={14} /> {location || "Add your location"}
            </span>
          </div>
        </div>

        <div className="ps-chip-row">
          <span className="ps-chip">
            <Clock size={13} /> 12 years
          </span>
          <span className="ps-chip is-teal">
            <ShieldCheck size={13} /> Self-reported insured
          </span>
          <span className="ps-chip is-avail">
            <span className="ps-dot" /> Available this week
          </span>
        </div>

        <p className="ps-bio">
          {trade} specializing in custom trim, cabinets, and high-end details. Clean work, on time,
          every time.
        </p>

        <div className="ps-stats">
          <div className="ps-stat">
            <strong>
              <Star size={15} className="ps-star" /> 4.9
            </strong>
            <span>({reviews} reviews)</span>
          </div>
          <div className="ps-stat">
            <strong>{reviews}</strong>
            <span>Completed jobs</span>
          </div>
          <div className="ps-stat">
            <strong>98%</strong>
            <span>Response rate</span>
          </div>
          <div className="ps-stat">
            <strong className="ps-toppro">
              <Award size={15} /> Top Pro
            </strong>
            <span>Local badge</span>
          </div>
        </div>

        <div className="ps-cta-row">
          <button type="button" className="ps-btn is-primary" onClick={onMessage}>
            <MessageCircle size={17} /> Message
          </button>
          <button type="button" className="ps-btn is-ghost" onClick={onViewJobs}>
            View profile
          </button>
        </div>
      </section>

      {/* Portfolio */}
      <section className="ps-section">
        <div className="ps-section-head">
          <h3>Portfolio</h3>
          <button type="button" className="ps-seeall">See all</button>
        </div>
        <div className="ps-portfolio-row">
          {PORTFOLIO_TILES.map((i) => (
            <div key={i} className="ps-portfolio-tile">
              <Briefcase size={20} />
            </div>
          ))}
        </div>
        <div className="ps-dots">
          <span className="is-active" />
          <span />
          <span />
          <span />
        </div>
      </section>

      {/* Certifications */}
      <section className="ps-section">
        <div className="ps-section-head">
          <h3>Certifications</h3>
          <button type="button" className="ps-seeall">See all</button>
        </div>
        <div className="ps-cert-row">
          {CERTS.slice(0, certsEarned).map((cert) => (
            <div key={cert.code} className="ps-cert-card">
              <span className="ps-cert-badge" style={{ background: cert.tone }}>
                <Award size={16} />
              </span>
              <div className="ps-cert-copy">
                <strong>{cert.code}</strong>
                <small>{cert.label}</small>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Local work */}
      <section className="ps-section">
        <div className="ps-section-head">
          <h3>Local work</h3>
          <button type="button" className="ps-seeall" onClick={onViewJobs}>See all jobs</button>
        </div>
        <div className="ps-jobs">
          {LOCAL_JOBS.map((job) => (
            <div key={job.title} className="ps-job-card">
              <div className="ps-job-top">
                <div className="ps-job-headings">
                  <strong>{job.title}</strong>
                  <span className="ps-job-meta">{job.meta}</span>
                </div>
                <span className="ps-job-posted">{job.posted}</span>
              </div>
              <div className="ps-job-rate">
                <span className="ps-rate">{job.rate}</span>
                <span className="ps-est">· {job.est}</span>
              </div>
              <div className="ps-job-tags">
                <span className="ps-job-tag"><Briefcase size={12} /> Tools required</span>
                <span className="ps-job-tag"><ShieldCheck size={12} /> Insurance required</span>
              </div>
              <div className="ps-job-actions">
                <button type="button" className="ps-job-btn is-ghost" onClick={onMessage}>
                  <MessageCircle size={14} /> Message
                </button>
                <button type="button" className="ps-job-btn is-primary" onClick={onViewJobs}>
                  Apply
                </button>
              </div>
            </div>
          ))}
        </div>
        <button type="button" className="ps-add-work" onClick={onViewJobs}>
          <Plus size={15} /> Post local work
        </button>
      </section>

      <p className="ps-footnote">
        <ChevronRight size={13} /> Stats and portfolio fill in as you complete jobs and add proof.
      </p>
    </div>
  );
}
