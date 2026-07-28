import {
  BadgeCheck,
  BriefcaseBusiness,
  CalendarDays,
  Clock3,
  ExternalLink,
  MapPin,
  ShieldCheck,
  X,
} from "lucide-react";
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { Avatar, DialogBackdrop, DialogSurface } from "../../components/ui";
import {
  fetchNetworkProfessionalProfile,
  type NetworkProfessionalProfile,
} from "./professional-profile-api";
import "./professional-profile-drawer.css";

function money(cents: number | null) {
  return cents == null ? null : new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function ProfessionalProfileDrawer({
  accountId,
  onClose,
}: {
  accountId: string;
  onClose: () => void;
}) {
  const [profile, setProfile] = useState<NetworkProfessionalProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void fetchNetworkProfessionalProfile(accountId)
      .then((next) => {
        if (active) setProfile(next);
      })
      .catch((nextError) => {
        if (active) setError(nextError instanceof Error ? nextError.message : "Professional profile could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [accountId]);

  return createPortal(
    <DialogBackdrop className="rivt-v2 v2-professional-profile-backdrop" onClose={onClose}>
      <DialogSurface className="v2-professional-profile-drawer" label="Professional profile" onClose={onClose}>
        <header>
          <span>RIVT professional profile</span>
          <button type="button" className="v2-icon-button" aria-label="Close professional profile" onClick={onClose}><X size={20} /></button>
        </header>

        {loading ? (
          <div className="v2-professional-profile-loading" aria-busy="true"><span /><span /><span /></div>
        ) : error || !profile ? (
          <div className="v2-professional-profile-error">
            <strong>Profile unavailable</strong>
            <p>{error || "This member has not published a professional profile."}</p>
          </div>
        ) : (
          <div className="v2-professional-profile-content">
            <section className="v2-professional-profile-hero">
              <Avatar name={profile.displayName} src={profile.avatarUrl} size="lg" />
              <div>
                <h2>{profile.displayName}</h2>
                {profile.headline ? <p>{profile.headline}</p> : null}
                <span>{profile.primaryRole === "contractor" ? "Contractor" : "Tradesperson"}</span>
              </div>
            </section>

            <div className="v2-professional-profile-facts">
              {profile.locationText ? <span><MapPin size={15} />{profile.locationText}</span> : null}
              <span><Clock3 size={15} />{profile.availabilityStatus === "available" ? "Available" : profile.availabilityStatus === "limited" ? "Limited availability" : "Unavailable"}</span>
            </div>

            {profile.trades.length ? (
              <section>
                <h3>Trades</h3>
                <div className="v2-professional-profile-chips">{profile.trades.map((trade) => <span key={trade.code}>{trade.name}{trade.primary ? " · Primary" : ""}</span>)}</div>
              </section>
            ) : null}

            {profile.bio ? <section><h3>About</h3><p>{profile.bio}</p></section> : null}

            {profile.availabilityWindows.length ? (
              <section>
                <h3>Availability</h3>
                <div className="v2-professional-profile-list">
                  {profile.availabilityWindows.map((window) => (
                    <article key={window.id}>
                      <CalendarDays size={17} />
                      <div><strong>{window.availability === "available" ? "Available" : window.availability === "limited" ? "Limited" : "Unavailable"}</strong><span>{window.startsOn} through {window.endsOn}</span>{window.notes ? <p>{window.notes}</p> : null}</div>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            {profile.credentials.length ? (
              <section>
                <h3>Credentials</h3>
                <div className="v2-professional-profile-list">
                  {profile.credentials.map((credential) => (
                    <article key={credential.id}>
                      <BadgeCheck size={17} />
                      <div>
                        <strong>{credential.name}</strong>
                        <span>{[credential.issuer, credential.expiryDate ? `Expires ${credential.expiryDate}` : ""].filter(Boolean).join(" · ")}</span>
                        <small><ShieldCheck size={12} />{credential.evidenceState === "evidence_on_file" ? "Evidence on file — not verified by RIVT" : "Self reported"}</small>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            {profile.rateCards.length ? (
              <section>
                <h3>Reference rates</h3>
                <div className="v2-professional-profile-list">
                  {profile.rateCards.map((rate) => (
                    <article key={rate.tradeCode}>
                      <BriefcaseBusiness size={17} />
                      <div><strong>{rate.tradeName}</strong><span>{[rate.hourlyRateCents == null ? "" : `${money(rate.hourlyRateCents)}/hr`, rate.dayRateCents == null ? "" : `${money(rate.dayRateCents)}/day`, rate.minimumChargeCents == null ? "" : `${money(rate.minimumChargeCents)} minimum`].filter(Boolean).join(" · ")}</span>{rate.notes ? <p>{rate.notes}</p> : null}</div>
                    </article>
                  ))}
                </div>
                <p className="v2-professional-profile-disclaimer">Reference rates are not a quote or guaranteed job price.</p>
              </section>
            ) : null}

            {profile.portfolioItems.length ? (
              <section>
                <h3>Work samples</h3>
                <div className="v2-professional-profile-portfolio">
                  {profile.portfolioItems.map((item) => (
                    <article key={item.id}>
                      {item.imageUrl ? <img src={item.imageUrl} alt={item.imageAlt} width="640" height="480" loading="lazy" /> : null}
                      <div><strong>{item.title}</strong><span>{[item.tradeName, item.projectLabel, item.completedOn].filter(Boolean).join(" · ")}</span>{item.description ? <p>{item.description}</p> : null}</div>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            <footer><ExternalLink size={14} />Only information this member chose to share with RIVT members appears here.</footer>
          </div>
        )}
      </DialogSurface>
    </DialogBackdrop>,
    document.body,
  );
}
