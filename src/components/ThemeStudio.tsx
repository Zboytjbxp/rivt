import { Contrast, Eye, Monitor, Moon, Palette, Sun } from "lucide-react";
import type { ThemeMode } from "../brandConfig";
import type {
  AccessibilityPreferenceKey,
  AccessibilityPreferences,
} from "../app-shell/preferences";
import type { ThemeSource } from "../app-shell/useAppTheme";

interface ThemeStudioProps {
  themeMode: ThemeMode;
  themeSource: ThemeSource;
  onSetThemeSource: (source: ThemeSource) => void;
  accessibilityPreferences?: AccessibilityPreferences;
  onToggleAccessibility?: (key: AccessibilityPreferenceKey) => void;
  variant?: "full" | "compact";
}

const choices: Array<{
  id: ThemeSource;
  label: string;
  description: string;
  Icon: typeof Monitor;
}> = [
  { id: "system", label: "System", description: "Match this device", Icon: Monitor },
  { id: "light", label: "Light", description: "Bright workspace", Icon: Sun },
  { id: "dark", label: "Dark", description: "Low-light workspace", Icon: Moon },
];

const accessibilityChoices: Array<{
  id: AccessibilityPreferenceKey;
  label: string;
  description: string;
  Icon: typeof Eye;
}> = [
  { id: "largeText", label: "Larger text", description: "Raises small text and control sizes", Icon: Eye },
  { id: "enhancedContrast", label: "Higher contrast", description: "Strengthens borders, labels, and focus", Icon: Contrast },
  { id: "colorSafe", label: "Color-safe status", description: "Adds distinct blue, amber, and magenta cues", Icon: Palette },
];

const defaultAccessibilityPreferences: AccessibilityPreferences = {
  colorSafe: false,
  enhancedContrast: false,
  largeText: false,
};

export function ThemeStudio({
  themeMode,
  themeSource,
  onSetThemeSource,
  accessibilityPreferences = defaultAccessibilityPreferences,
  onToggleAccessibility = () => undefined,
  variant = "full",
}: ThemeStudioProps) {
  const isCompact = variant === "compact";

  return (
    <section className={`appearance-preference${isCompact ? " is-compact" : ""}`} aria-label="Appearance">
      <header>
        <div>
          <span>Appearance</span>
          <strong>{isCompact ? "Light, dark, or your device" : "Keep RIVT familiar"}</strong>
        </div>
        {isCompact ? <small>{themeSource === "system" ? `System (${themeMode})` : themeSource}</small> : null}
      </header>
      {!isCompact ? <p>Choose how RIVT looks on this device. The workspace stays the same for everyone.</p> : null}
      <div className="appearance-mode-control" role="group" aria-label="Color mode">
        {choices.map(({ id, label, description, Icon }) => (
          <button
            key={id}
            type="button"
            className={themeSource === id ? "is-selected" : ""}
            aria-pressed={themeSource === id}
            onClick={() => onSetThemeSource(id)}
          >
            <Icon size={18} aria-hidden="true" />
            <span><strong>{label}</strong><small>{description}</small></span>
          </button>
        ))}
      </div>
      <section className="accessibility-preferences" aria-labelledby="accessibility-preferences-title">
        <header>
          <span>Accessibility</span>
          <strong id="accessibility-preferences-title">Make RIVT easier to read</strong>
        </header>
        <div className="accessibility-options">
          {accessibilityChoices.map(({ id, label, description, Icon }) => {
            const enabled = accessibilityPreferences[id];
            return (
              <button
                key={id}
                type="button"
                className={`accessibility-option${enabled ? " is-enabled" : ""}`}
                role="switch"
                aria-checked={enabled}
                onClick={() => onToggleAccessibility(id)}
              >
                <span className="accessibility-option-icon"><Icon size={20} aria-hidden="true" /></span>
                <span className="accessibility-option-copy"><strong>{label}</strong><small>{description}</small></span>
                <span className="accessibility-option-state" aria-hidden="true">{enabled ? "On" : "Off"}</span>
              </button>
            );
          })}
        </div>
      </section>
    </section>
  );
}
