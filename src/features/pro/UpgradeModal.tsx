import { useState } from "react";
import {
  ArrowRight,
  BriefcaseBusiness,
  Check,
  ClipboardCheck,
  Cloud,
  CreditCard,
  FileText,
  ShieldCheck,
  X,
  type LucideIcon,
} from "lucide-react";
import { BillingApiError, startStripeCheckout } from "../../lib/billing";
import { useFocusTrap } from "../../app-shell/useFocusTrap";
import { RIVT_PRO_OFFER } from "./proOffer";
import "./pro.css";

interface UpgradeModalProps {
  reason?: string;   // e.g. "Export CSV", "Multiple punch lists", "90-day history"
  onClose: () => void;
}

const OUTCOMES: Array<{ icon: LucideIcon; title: string; copy: string }> = [
  {
    icon: ClipboardCheck,
    title: "Keep the job record",
    copy: "More room for daily logs, closeout notes, punch lists, and project photos.",
  },
  {
    icon: FileText,
    title: "Send cleaner paperwork",
    copy: "Use polished invoice, estimate, and expense exports without rebuilding forms by hand.",
  },
  {
    icon: BriefcaseBusiness,
    title: "Run the side work",
    copy: "Time, mileage, expenses, records, and work history stay tied to the account.",
  },
];

const INCLUDED = [
  "90-day time history",
  "CSV expense export",
  "Cloud project photos and records",
  "Invoice, estimate, daily log, and closeout tools",
  "Self-serve cancellation and receipts",
];

export function UpgradeModal({ reason, onClose }: UpgradeModalProps) {
  const [state, setState] = useState<"idle" | "paying" | "unavailable">("idle");
  const [message, setMessage] = useState("Subscription checkout is unavailable right now.");

  async function handleUpgrade() {
    setState("paying");
    try {
      const checkout = await startStripeCheckout();
      window.location.href = checkout.url;
    } catch (error) {
      setMessage(error instanceof BillingApiError ? "Subscriptions are temporarily unavailable. Try again in a moment." : "Billing is not available right now.");
      setState("unavailable");
    }
  }

  const trapRef = useFocusTrap<HTMLDivElement>(onClose);
  return (
    <div className="v2-upgrade-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={trapRef} className="v2-upgrade-modal" role="dialog" aria-modal="true">
        {state === "unavailable" ? (
          <div className="v2-upgrade-status">
            <CreditCard size={40} />
            <strong>Checkout is unavailable</strong>
            <p>{message}</p>
            <button type="button" className="v2-secondary-button" onClick={onClose}>Close</button>
          </div>
        ) : (
          <>
            <button type="button" className="v2-upgrade-close" onClick={onClose} aria-label="Close upgrade dialog"><X size={18} /></button>
            <header className="v2-upgrade-hero">
              <span className="v2-upgrade-kicker">RIVT Pro</span>
              <div>
                <strong>Keep better records. Send better paperwork.</strong>
                <p>{reason ? `${reason} is included with Pro.` : RIVT_PRO_OFFER.summary}</p>
              </div>
            </header>
            <section className="v2-upgrade-price" aria-label="RIVT Pro pricing">
              <div>
                <strong>{RIVT_PRO_OFFER.price}<span>{RIVT_PRO_OFFER.interval}</span></strong>
                <small>Launch price. Cancel anytime from Settings.</small>
              </div>
              <ShieldCheck size={22} aria-hidden="true" />
            </section>
            <div className="v2-upgrade-outcomes">
              {OUTCOMES.map(({ icon: Icon, title, copy }) => (
                <article key={title}>
                  <Icon size={17} />
                  <div>
                    <strong>{title}</strong>
                    <span>{copy}</span>
                  </div>
                </article>
              ))}
            </div>
            <section className="v2-upgrade-included" aria-label="Included with RIVT Pro">
              <strong>Included</strong>
              <ul>
                {INCLUDED.map((benefit) => <li key={benefit}><Check size={14} />{benefit}</li>)}
              </ul>
            </section>
            <div className="v2-upgrade-free-note">
              <Cloud size={16} />
              <span>Browse work, Crew, Shop Talk, and basic tools stay available while the Jacksonville network grows.</span>
            </div>
            <button
              type="button"
              className="v2-primary-button v2-upgrade-cta"
              onClick={handleUpgrade}
              disabled={state === "paying"}
            >
              {state === "paying"
                ? "Redirecting to checkout..."
                : <>Start RIVT Pro <ArrowRight size={16} /></>}
            </button>
            <p className="v2-upgrade-fineprint">{RIVT_PRO_OFFER.trustLine} RIVT does not take a cut of job payments or hold escrow.</p>
            <button type="button" className="v2-upgrade-skip" onClick={onClose}>Keep using the free plan</button>
          </>
        )}
      </div>
    </div>
  );
}
