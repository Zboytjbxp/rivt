import { Check, Monitor, Moon, Sun } from "lucide-react";
import type { CSSProperties } from "react";
import { brandConfig, type ThemeMode, type ThemePalette } from "../brandConfig";
import type { ThemeSource } from "../app-shell/useAppTheme";

interface ThemeStudioProps {
  themeMode: ThemeMode;
  themeSource: ThemeSource;
  themePalette: ThemePalette;
  onSetThemeSource: (source: ThemeSource) => void;
  onSelectThemePalette: (palette: ThemePalette) => void;
}

const paletteEntries = Object.entries(brandConfig.theme.palettes) as Array<
  [ThemePalette, (typeof brandConfig.theme.palettes)[ThemePalette]]
>;

function paletteStyle(palette: (typeof brandConfig.theme.palettes)[ThemePalette], mode: ThemeMode): CSSProperties {
  const variables = palette.modes[mode];
  return {
    "--theme-preview-accent": variables["--accent"],
    "--theme-preview-nav": variables["--nav"],
    "--theme-preview-surface": variables["--accent-soft"],
    "--theme-preview-signal": variables["--blue"],
  } as CSSProperties;
}

export function ThemeStudio({
  themeMode,
  themeSource,
  themePalette,
  onSetThemeSource,
  onSelectThemePalette,
}: ThemeStudioProps) {
  const selected = brandConfig.theme.palettes[themePalette];
  const sourceLabel = themeSource === "system" ? "Follows this device" : themeSource === "light" ? "Light mode" : "Dark mode";

  return (
    <section className="theme-studio" aria-label="Appearance">
      <div className="theme-studio-heading">
        <span>Appearance</span>
        <strong>Make RIVT yours</strong>
        <small>Changes apply to navigation, active states, buttons, and highlights on this device.</small>
      </div>

      <div className="theme-studio-current" style={paletteStyle(selected, themeMode)} aria-label={`Current appearance: ${selected.label}, ${sourceLabel}`}>
        <div className="theme-studio-current-preview" aria-hidden="true">
          <span className="theme-preview-nav"><i /><i /><i /></span>
          <span className="theme-preview-card"><i /><b /></span>
          <span className="theme-preview-button" />
        </div>
        <div>
          <span>Current style</span>
          <strong>{selected.label}</strong>
          <small>{sourceLabel}</small>
        </div>
      </div>

      <div className="theme-studio-mode" role="group" aria-label="Color mode">
        {(["system", "light", "dark"] as ThemeSource[]).map((source) => {
          const Icon = source === "system" ? Monitor : source === "light" ? Sun : Moon;
          return (
            <button
              key={source}
              type="button"
              className={themeSource === source ? "is-selected" : ""}
              aria-pressed={themeSource === source}
              onClick={() => onSetThemeSource(source)}
            >
              <Icon size={16} />
              {source === "system" ? "System" : source === "light" ? "Light" : "Dark"}
            </button>
          );
        })}
      </div>

      <div className="theme-studio-palette-grid" role="group" aria-label="Color palettes">
        {paletteEntries.map(([paletteId, palette]) => (
          <button
            key={paletteId}
            type="button"
            className={paletteId === themePalette ? "theme-studio-palette is-selected" : "theme-studio-palette"}
            aria-label={`Use ${palette.label} appearance`}
            aria-pressed={paletteId === themePalette}
            onClick={() => onSelectThemePalette(paletteId)}
            style={paletteStyle(palette, themeMode)}
          >
            <span className="theme-studio-palette-preview" aria-hidden="true">
              <i className="theme-palette-preview-nav" />
              <i className="theme-palette-preview-surface" />
              <i className="theme-palette-preview-accent" />
            </span>
            <span className="theme-studio-palette-copy">
              <strong>{palette.label}</strong>
              <small>{palette.inspiration}</small>
            </span>
            {paletteId === themePalette ? <Check size={16} aria-hidden="true" /> : null}
          </button>
        ))}
      </div>
    </section>
  );
}
