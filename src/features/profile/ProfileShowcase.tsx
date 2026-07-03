import {
  Award,
  Briefcase,
  MapPin,
  Plus,
  Share2,
  ShieldCheck,
  Star,
} from "lucide-react";
import type { NavLabel } from "../../app-shell/routes";
import "./profile-showcase.css";

interface ProfileShowcaseProps {
  name: string;
  trade: string;
  location: string;
  shoutOutCount: number;
  safetyCertCount: number;
  onEditProfile: () => void;
  onNavigate: (view: NavLabel) => void;
}

interface StoredReview { rating?: number }
interface StoredJob { id?: string; title?: string; trade?: string; location?: string; status?: string }
interface StoredCert { name?: string; issuer?: string }
interface StoredPhoto { id?: string; url?: string; caption?: string }

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T) : fallback;
  } catch { return fallback; }
}

const AVATAR_TONES = ["#c2410c", "#0f766e", "#7c3aed", "#b45309", "#1d4ed8"];
function toneFor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}

const AVAIL_LABEL: Record<string, string> = {
  available: "Available this week",
  limited: "Limited availability",
  booked: "Booked up",
};

export function ProfileShowcase({
  name,
  trade,
  location,
  shoutOutCount,
  safetyCertCount,
  onEditProfile,
  onNavigate,
}: ProfileShowcaseProps) {
  const displayName = name || "RIVT member";

  const reviews = readJSON<StoredReview[]>("rivt.reviews.v1", []);
  const jobs = readJSON<StoredJob[]>("rivt.jobs.v1", []);
  const certs = readJSON<StoredCert[]>("rivt.certs.v1", []);
  const photos = readJSON<StoredPhoto[]>("rivt.photos.v1", []).filter((p) => p.url);

  const reviewCount = reviews.length;
  const ratingAvg = reviewCount
    ? (reviews.reduce((s, r) => s + (Number(r.rating) || 0), 0) / reviewCount)
    : 0;
  const completedJobs = jobs.filter((j) => j.status === "Paid / Closed").length || jobs.length;
  const certTotal = safetyCertCount + certs.length;

  let availability = "available";
  try {
    const v = localStorage.getItem("rivt.availability.v1");
    if (v === "available" || v === "limited" || v === "booked") availability = v;
  } catch { /* ignore */ }

  function share() {
    const url = `${window.location.origin}/app`;
    if (navigator.share) navigator.share({ title: `${displayName} on RIVT`, url }).catch(() => {});
    else if (navigator.clipboard) navigator.clipboard.writeText(url).catch(() => {});
  }

  return (
    <div className="profile-showcase">
      {/* Hero */}
      <section className="ps-hero">
        <div className="ps-hero-top">
          <div className="ps-avatar-wrap">
            <span className="ps-avatar" style={{ background: toneFor(displayName) }}>
              {displayName.slice(0, 1).toUpperCase()}
            </span>
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
          <span className={`ps-chip ${availability === "available" ? "is-avail" : ""}`}>
            <span className="ps-dot" /> {AVAIL_LABEL[availability]}
          </span>
        </div>

        <div className="ps-stats">
          <div className="ps-stat">
            <strong>
              {reviewCount ? <><Star size={15} className="ps-star" /> {ratingAvg.toFixed(1)}</> : "New"}
            </strong>
            <span>{reviewCount ? `${reviewCount} review${reviewCount === 1 ? "" : "s"}` : "No reviews yet"}</span>
          </div>
          <div className="ps-stat">
            <strong>{completedJobs}</strong>
            <span>Jobs</span>
          </div>
          <div className="ps-stat">
            <strong>{certTotal}</strong>
            <span>Certifications</span>
          </div>
          <div className="ps-stat">
            <strong>{shoutOutCount}</strong>
            <span>Shout-outs</span>
          </div>
        </div>

        <div className="ps-cta-row">
          <button type="button" className="ps-btn is-primary" onClick={onEditProfile}>
            Edit profile
          </button>
          <button type="button" className="ps-btn is-ghost" onClick={share}>
            <Share2 size={16} /> Share
          </button>
        </div>
      </section>

      {/* Portfolio */}
      <section className="ps-section">
        <div className="ps-section-head">
          <h3>Portfolio</h3>
          {photos.length > 0 && (
            <button type="button" className="ps-seeall" onClick={() => onNavigate("Records")}>See all</button>
          )}
        </div>
        {photos.length > 0 ? (
          <div className="ps-portfolio-row">
            {photos.slice(0, 4).map((p, i) => (
              <div key={p.id ?? i} className="ps-portfolio-tile has-photo">
                <img src={p.url} alt={p.caption ?? "Job photo"} loading="lazy" />
              </div>
            ))}
          </div>
        ) : (
          <button type="button" className="ps-empty" onClick={() => onNavigate("Records")}>
            <Briefcase size={20} />
            <b>Show your craft</b>
            <span>Add job photos to build a portfolio clients can see.</span>
          </button>
        )}
      </section>

      {/* Certifications */}
      <section className="ps-section">
        <div className="ps-section-head">
          <h3>Certifications</h3>
          <button type="button" className="ps-seeall" onClick={() => onNavigate("Safety & Training")}>
            {certTotal > 0 ? "See all" : "Add"}
          </button>
        </div>
        {certTotal > 0 ? (
          <div className="ps-cert-row">
            {safetyCertCount > 0 && (
              <div className="ps-cert-card">
                <span className="ps-cert-badge"><ShieldCheck size={16} /></span>
                <div className="ps-cert-copy">
                  <strong>Safety training</strong>
                  <small>{safetyCertCount} passed</small>
                </div>
              </div>
            )}
            {certs.map((c, i) => (
              <div key={i} className="ps-cert-card">
                <span className="ps-cert-badge"><Award size={16} /></span>
                <div className="ps-cert-copy">
                  <strong>{c.name || "Certification"}</strong>
                  <small>{c.issuer || "Credential"}</small>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <button type="button" className="ps-empty" onClick={() => onNavigate("Safety & Training")}>
            <Award size={20} />
            <b>No certifications yet</b>
            <span>Complete safety training or add credentials to stand out.</span>
          </button>
        )}
      </section>

      {/* Local work */}
      <section className="ps-section">
        <div className="ps-section-head">
          <h3>Your jobs</h3>
          <button type="button" className="ps-seeall" onClick={() => onNavigate("Marketplace")}>See all</button>
        </div>
        {jobs.length > 0 ? (
          <div className="ps-jobs">
            {jobs.slice(0, 2).map((job, i) => (
              <button key={job.id ?? i} type="button" className="ps-job-card" onClick={() => onNavigate("Marketplace")}>
                <div className="ps-job-top">
                  <div className="ps-job-headings">
                    <strong>{job.title || "Untitled job"}</strong>
                    <span className="ps-job-meta">{[job.trade, job.location].filter(Boolean).join(" · ")}</span>
                  </div>
                  {job.status && <span className="ps-job-status">{job.status}</span>}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <button type="button" className="ps-empty" onClick={() => onNavigate("Marketplace")}>
            <Plus size={20} />
            <b>No jobs yet</b>
            <span>Post work to start building your track record.</span>
          </button>
        )}
      </section>
    </div>
  );
}
