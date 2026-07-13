import { Monitor, Moon, Sun } from "lucide-react";
import type { ThemeMode } from "../brandConfig";
import type { ThemeSource } from "../app-shell/useAppTheme";

interface ThemeStudioProps {
  themeMode: ThemeMode;
  themeSource: ThemeSource;
  onSetThemeSource: (source: ThemeSource) => void;
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

export function ThemeStudio({ themeMode, themeSource, onSetThemeSource, variant = "full" }: ThemeStudioProps) {
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
    </section>
  );
}
