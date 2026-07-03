import { ArrowRight, BriefcaseBusiness, Home, Inbox, Settings, Users, Wrench } from "lucide-react";
import "./legacy-bridge.css";

type BridgeView =
  | "Applications"
  | "Invites"
  | "My Jobs"
  | "Crew"
  | "Messages"
  | "Trust & Legal"
  | "Safety & Training"
  | "Reviews"
  | "Feedback"
  | "Settings"
  | "Admin"
  | "Records"
  | "Work"
  | "Home"
  | "Shop Talk"
  | "Tools";

interface LegacyBridgeProps {
  view: BridgeView;
  onNavigate: (view: BridgeView) => void;
  onOpenAccount: () => void;
}

const destinations: Array<{
  label: string;
  hint: string;
  icon: typeof Home;
  view: BridgeView;
}> = [
  { label: "Home", hint: "Dashboard, updates, and shortcuts", icon: Home, view: "Home" },
  { label: "Work", hint: "Jobs, applications, invites, and job detail", icon: BriefcaseBusiness, view: "Work" },
  { label: "Crew", hint: "Subs, clients, reviews, and reputation", icon: Users, view: "Crew" },
  { label: "Inbox", hint: "Messages and active coordination", icon: Inbox, view: "Messages" },
  { label: "Tools", hint: "Calculator, invoice, and records", icon: Wrench, view: "Tools" },
  { label: "Profile", hint: "Settings, trust, safety, and sign out", icon: Settings, view: "Settings" },
];

export function LegacyBridge({ view, onNavigate, onOpenAccount }: LegacyBridgeProps) {
  return (
    <section className="v2-legacy-bridge" aria-label={`${view} moved`}>
      <header className="v2-legacy-hero">
        <span className="v2-legacy-eyebrow">Moved section</span>
        <h1>This area now lives in the modern shell</h1>
        <p>Where skilled trades connect. The older workspace for this area has been folded into the cleaner primary tabs.</p>
      </header>

      <div className="v2-legacy-grid">
        {destinations.map(({ label, hint, icon: Icon, view: targetView }) => (
          <button
            key={label}
            type="button"
            className="v2-legacy-card"
            onClick={() => (targetView === "Settings" ? onOpenAccount() : onNavigate(targetView))}
          >
            <span className="v2-legacy-card-icon"><Icon size={18} /></span>
            <span className="v2-legacy-card-copy">
              <strong>{label}</strong>
              <span>{hint}</span>
            </span>
            <ArrowRight size={16} />
          </button>
        ))}
      </div>

      <div className="v2-legacy-note">
        <p>
          If you were looking for a specific old panel, the core workflow is still available through Home, Work, Crew, Tools, and the profile menu.
        </p>
      </div>
    </section>
  );
}
