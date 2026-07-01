import { useState } from "react";
import { Zap } from "lucide-react";
import { persistRateCardEntries } from "../lib/rateCard";
import "./LocalSetupPrompt.css";

const TRADES = [
  "Electrician",
  "Plumber",
  "Carpenter",
  "HVAC",
  "General Contractor",
  "Painter",
  "Mason",
  "Welder",
  "Roofer",
  "Landscaper",
  "Other",
] as const;

export interface LocalSetupPromptProps {
  onDone: () => void;
}

function writeLocalSetupDone() {
  try {
    window.localStorage.setItem("rivt.localSetupDone.v1", "true");
  } catch {
    // localStorage may be unavailable; proceed anyway.
  }
}

export function LocalSetupPrompt({ onDone }: LocalSetupPromptProps) {
  const [displayName, setDisplayName] = useState("");
  const [primaryTrade, setPrimaryTrade] = useState<string>(TRADES[0]);
  const [hourlyRate, setHourlyRate] = useState<number>(75);

  function handleSubmit() {
    try {
      const existing = window.localStorage.getItem("rivt.profile.v1");
      const profile = existing ? (JSON.parse(existing) as Record<string, unknown>) : {};
      const updated = { ...profile, displayName, primaryTrade };
      window.localStorage.setItem("rivt.profile.v1", JSON.stringify(updated));
      persistRateCardEntries([{
        id: "standard",
        trade: primaryTrade || "Standard",
        hourlyRate,
        dayRate: 0,
        minimumCharge: 0,
        notes: "",
        updatedAt: new Date().toISOString(),
      }]);
    } catch {
      // localStorage may be unavailable; proceed anyway.
    }
    writeLocalSetupDone();
    onDone();
  }

  function handleSkip() {
    writeLocalSetupDone();
    onDone();
  }

  return (
    <div className="v2-setup-backdrop" role="dialog" aria-modal="true" aria-label="Welcome setup">
      <div className="v2-setup-sheet">
        <h2 className="v2-setup-title">
          <Zap size={20} className="v2-setup-title-icon" aria-hidden="true" />
          Welcome to RIVT
        </h2>
        <p className="v2-setup-subtitle">
          Set up your profile in seconds. You can change this anytime.
        </p>

        <div className="v2-setup-fields">
          <div className="v2-setup-field">
            <label htmlFor="v2-setup-name" className="v2-setup-label">
              What should we call you?
            </label>
            <input
              id="v2-setup-name"
              type="text"
              className="v2-setup-input"
              placeholder="Your name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              autoComplete="given-name"
            />
          </div>

          <div className="v2-setup-field">
            <label htmlFor="v2-setup-trade" className="v2-setup-label">
              Your trade
            </label>
            <select
              id="v2-setup-trade"
              className="v2-setup-select"
              value={primaryTrade}
              onChange={(e) => setPrimaryTrade(e.target.value)}
            >
              {TRADES.map((trade) => (
                <option key={trade} value={trade}>
                  {trade}
                </option>
              ))}
            </select>
          </div>

          <div className="v2-setup-field">
            <label htmlFor="v2-setup-rate" className="v2-setup-label">
              Hourly rate
            </label>
            <div className="v2-setup-rate-wrap">
              <span className="v2-setup-rate-prefix">$</span>
              <input
                id="v2-setup-rate"
                type="number"
                className="v2-setup-input"
                min={0}
                step={1}
                value={hourlyRate}
                onChange={(e) => setHourlyRate(Number(e.target.value))}
              />
            </div>
          </div>
        </div>

        <button type="button" className="v2-setup-cta" onClick={handleSubmit}>
          Let&rsquo;s go &rarr;
        </button>
        <button type="button" className="v2-setup-skip" onClick={handleSkip}>
          Skip for now
        </button>
      </div>
    </div>
  );
}
