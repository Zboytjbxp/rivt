import { Check, ChevronRight, Monitor, Moon, Palette, Sun, X } from "lucide-react";
import { useState, type CSSProperties } from "react";
import { brandConfig, type ThemeMode, type ThemePalette } from "../brandConfig";
import type { ThemeSource } from "../app-shell/useAppTheme";

interface ThemeStudioProps {
  themeMode: ThemeMode;
  themeSource: ThemeSource;
  themePalette: ThemePalette;
  onSetThemeSource: (source: ThemeSource) => void;
  onSelectThemePalette: (palette: ThemePalette) => void;
  variant?: "full" | "compact";
}

const paletteEntries = Object.entries(brandConfig.theme.palettes) as Array<
  [ThemePalette, (typeof brandConfig.theme.palettes)[ThemePalette]]
>;

function paletteStyle(palette: (typeof brandConfig.theme.palettes)[ThemePalette], mode: ThemeMode): CSSProperties {
  const variables = palette.modes[mode];
  return {
    "--theme-preview-accent": variables["--accent"],
    "--theme-preview-accent-soft": variables["--accent-soft"],
    "--theme-preview-bg": variables["--bg"],
    "--theme-preview-border": variables["--border"],
    "--theme-preview-nav": variables["--nav"],
    "--theme-preview-surface": variables["--surface"],
    "--theme-preview-surface-soft": variables["--surface-soft"],
    "--theme-preview-text": variables["--text"],
    "--theme-preview-signal": variables["--blue"],
  } as CSSProperties;
}

function sourceLabel(source: ThemeSource) {
  if (source === "system") return "System";
  return source === "light" ? "Light" : "Dark";
}

function FinishPreview({
  palette,
  mode,
  compact = false,
}: {
  palette: (typeof brandConfig.theme.palettes)[ThemePalette];
  mode: ThemeMode;
  compact?: boolean;
}) {
  return (
    <span className={compact ? "field-finish-preview is-compact" : "field-finish-preview"} style={paletteStyle(palette, mode)} aria-hidden="true">
      <span className="field-finish-preview-topbar"><i>R</i><b /><b /></span>
      <span className="field-finish-preview-body">
        <span className="field-finish-preview-kicker" />
        <span className="field-finish-preview-card"><i /><b /><em /></span>
        <span className="field-finish-preview-card is-signal"><i /><b /><em /></span>
      </span>
      <span className="field-finish-preview-nav"><i /><i className="is-active" /><i /><i /><i /></span>
    </span>
  );
}

function ThemeStudioEditor({
  themeMode,
  themeSource,
  themePalette,
  onSetThemeSource,
  onSelectThemePalette,
}: Omit<ThemeStudioProps, "variant">) {
  const selected = brandConfig.theme.palettes[themePalette];

  return (
    <div className="theme-studio-editor">
      <div className="theme-studio-heading">
        <span>Appearance</span>
        <strong>Field finishes</strong>
        <small>Choose a complete RIVT finish for this device. It changes the canvas, panels, navigation, active states, and action color together.</small>
      </div>

      <div className="theme-studio-current" style={paletteStyle(selected, themeMode)} aria-label={`Current field finish: ${selected.label} in ${sourceLabel(themeSource)} mode`}>
        <FinishPreview palette={selected} mode={themeMode} />
        <div>
          <span>Currently applied</span>
          <strong>{selected.label}</strong>
          <small>{selected.description}</small>
          <em>{sourceLabel(themeSource)} mode</em>
        </div>
      </div>

      <div className="theme-studio-control-heading">
        <strong>Display mode</strong>
        <span>Use your device setting or choose one deliberately.</span>
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
              {sourceLabel(source)}
            </button>
          );
        })}
      </div>

      <div className="theme-studio-control-heading">
        <strong>Choose a finish</strong>
        <span>Original RIVT color systems, not tool-brand skins.</span>
      </div>
      <div className="theme-studio-palette-grid" role="group" aria-label="Field finishes">
        {paletteEntries.map(([paletteId, palette]) => {
          const selectedPalette = paletteId === themePalette;
          return (
            <button
              key={paletteId}
              type="button"
              className={selectedPalette ? "theme-studio-palette is-selected" : "theme-studio-palette"}
              aria-label={`Use ${palette.label} field finish`}
              aria-pressed={selectedPalette}
              onClick={() => onSelectThemePalette(paletteId)}
              style={paletteStyle(palette, themeMode)}
            >
              <FinishPreview palette={palette} mode={themeMode} compact />
              <span className="theme-studio-palette-copy">
                <strong>{palette.label}</strong>
                <small>{palette.description}</small>
                <em>{palette.inspiration}</em>
              </span>
              {selectedPalette ? <Check size={18} aria-label="Selected" /> : <span className="theme-studio-palette-radio" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
      <p className="theme-studio-boundary">Appearance is saved only on this device. RIVT uses original field finishes and is not affiliated with tool manufacturers.</p>
    </div>
  );
}

export function ThemeStudio({ variant = "full", ...props }: ThemeStudioProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selected = brandConfig.theme.palettes[props.themePalette];

  if (variant === "compact") {
    return (
      <section className="theme-studio theme-studio--compact" aria-label="Appearance">
        <button type="button" className="theme-studio-launcher" onClick={() => setIsOpen(true)} style={paletteStyle(selected, props.themeMode)}>
          <span className="theme-studio-launcher-icon"><Palette size={18} /></span>
          <FinishPreview palette={selected} mode={props.themeMode} compact />
          <span className="theme-studio-launcher-copy">
            <span>Appearance</span>
            <strong>{selected.label}</strong>
            <small>{sourceLabel(props.themeSource)} mode</small>
          </span>
          <ChevronRight size={18} aria-hidden="true" />
        </button>

        {isOpen ? (
          <div className="theme-studio-dialog-backdrop" onClick={(event) => { if (event.target === event.currentTarget) setIsOpen(false); }}>
            <section className="theme-studio-dialog" role="dialog" aria-modal="true" aria-label="Field finishes">
              <div className="theme-studio-dialog-bar">
                <div><span>RIVT</span><strong>Field finishes</strong></div>
                <button type="button" onClick={() => setIsOpen(false)} aria-label="Close appearance"><X size={18} /></button>
              </div>
              <div className="theme-studio-dialog-scroll">
                <ThemeStudioEditor {...props} />
              </div>
            </section>
          </div>
        ) : null}
      </section>
    );
  }

  return <section className="theme-studio" aria-label="Appearance"><ThemeStudioEditor {...props} /></section>;
}
