import { useState } from "react";
import { Lock, Check, Zap, X } from "lucide-react";
import { usePro } from "./usePro";
import "./pro.css";

interface UpgradeModalProps {
  reason?: string;   // e.g. "Export CSV", "Multiple punch lists", "90-day history"
  onClose: () => void;
}

const BENEFITS = [
  "Unlimited history — time logs, expenses, mileage",
  "Unlimited photo albums",
  "Unlimited punch lists",
  "Export expenses as CSV",
  "PDF invoices & estimates (send to clients)",
  "Client report share link",
  "Cloud backup — access from any device",
];

export function UpgradeModal({ reason, onClose }: UpgradeModalProps) {
  const { activatePro } = usePro();
  const [state, setState] = useState<"idle" | "paying" | "done">("idle");

  function handleUpgrade() {
    setState("paying");
    // Simulate payment processing — in production, redirect to Stripe checkout
    setTimeout(() => {
      activatePro();
      setState("done");
      setTimeout(onClose, 2000);
    }, 1500);
  }

  return (
    <div className="v2-upgrade-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="v2-upgrade-modal" role="dialog" aria-modal="true">
        {state === "done" ? (
          <div className="v2-upgrade-success">
            <Zap size={40} />
            <strong>Welcome to RIVT Pro!</strong>
            <p>All features are now unlocked.</p>
          </div>
        ) : (
          <>
            <button type="button" className="v2-upgrade-close" onClick={onClose}><X size={18} /></button>
            <div className="v2-upgrade-hero">
              <Lock size={24} />
              <strong>RIVT Pro</strong>
              {reason && <p className="v2-upgrade-reason">{reason} is a Pro feature.</p>}
            </div>
            <ul className="v2-upgrade-benefits">
              {BENEFITS.map(b => <li key={b}><Check size={14} />{b}</li>)}
            </ul>
            <div className="v2-upgrade-price">
              <strong>$99<span>/year</span></strong>
              <small>About $8/month · cancel anytime</small>
            </div>
            <button
              type="button"
              className="v2-primary-button v2-upgrade-cta"
              onClick={handleUpgrade}
              disabled={state === "paying"}
            >
              {state === "paying" ? "Processing…" : "Upgrade to Pro — $99/year"}
            </button>
            <button type="button" className="v2-upgrade-skip" onClick={onClose}>Maybe later</button>
          </>
        )}
      </div>
    </div>
  );
}
