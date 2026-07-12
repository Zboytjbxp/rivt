import { Check, ChevronRight, LayoutTemplate, Monitor, Moon, Palette, Rows3, Sun, X } from "lucide-react";
import { useState, type CSSProperties, type ReactNode } from "react";
import {
  brandConfig,
  type ThemeAccent,
  type ThemeCanvas,
  type ThemeChrome,
  type ThemeDensity,
  type ThemeMode,
} from "../brandConfig";
import type { ThemeSource } from "../app-shell/useAppTheme";

interface ThemeStudioProps {
  themeMode: ThemeMode;
  themeSource: ThemeSource;
  themeAccent: ThemeAccent;
  themeChrome: ThemeChrome;
  themeCanvas: ThemeCanvas;
  themeDensity: ThemeDensity;
  onSetThemeSource: (source: ThemeSource) => void;
  onSetThemeAccent: (accent: ThemeAccent) => void;
  onSetThemeChrome: (chrome: ThemeChrome) => void;
  onSetThemeCanvas: (canvas: ThemeCanvas) => void;
  onSetThemeDensity: (density: ThemeDensity) => void;
  variant?: "full" | "compact";
}

type AccentConfig = (typeof brandConfig.theme.appearance.accents)[ThemeAccent];
type ChromeConfig = (typeof brandConfig.theme.appearance.chromes)[ThemeChrome];
type CanvasConfig = (typeof brandConfig.theme.appearance.canvases)[ThemeCanvas];

const accentEntries = Object.entries(brandConfig.theme.appearance.accents) as Array<[ThemeAccent, AccentConfig]>;
const chromeEntries = Object.entries(brandConfig.theme.appearance.chromes) as Array<[ThemeChrome, ChromeConfig]>;
const canvasEntries = Object.entries(brandConfig.theme.appearance.canvases) as Array<[ThemeCanvas, CanvasConfig]>;
const densityEntries = Object.entries(brandConfig.theme.appearance.densities) as Array<[
  ThemeDensity,
  (typeof brandConfig.theme.appearance.densities)[ThemeDensity]
]>;

function sourceLabel(source: ThemeSource) {
  return source === "system" ? "System" : source === "light" ? "Light" : "Dark";
}

function appearanceStyle(
  accent: AccentConfig,
  chrome: ChromeConfig,
  canvas: CanvasConfig,
  mode: ThemeMode,
): CSSProperties {
  const accentValues = accent.modes[mode];
  const chromeValues = chrome.modes[mode];
  const canvasValues = canvas.modes[mode];
  return {
    "--appearance-preview-accent": accentValues["--accent"],
    "--appearance-preview-accent-soft": accentValues["--accent-soft"],
    "--appearance-preview-nav": chromeValues["--nav"],
    "--appearance-preview-bg": canvasValues["--bg"],
    "--appearance-preview-border": canvasValues["--border"],
    "--appearance-preview-surface": canvasValues["--surface"],
    "--appearance-preview-surface-soft": canvasValues["--surface-soft"],
    "--appearance-preview-text": canvasValues["--text"],
    "--appearance-preview-signal": canvasValues["--blue"],
  } as CSSProperties;
}

function AppPreview({
  accent,
  chrome,
  canvas,
  mode,
  compact = false,
}: {
  accent: AccentConfig;
  chrome: ChromeConfig;
  canvas: CanvasConfig;
  mode: ThemeMode;
  compact?: boolean;
}) {
  return (
    <span className={compact ? "appearance-preview is-compact" : "appearance-preview"} style={appearanceStyle(accent, chrome, canvas, mode)} aria-hidden="true">
      <span className="appearance-preview-topbar"><i>R</i><b /><b /></span>
      <span className="appearance-preview-body">
        <span className="appearance-preview-kicker" />
        <span className="appearance-preview-card"><i /><b /><em /></span>
        <span className="appearance-preview-card is-active"><i /><b /><em /></span>
      </span>
      <span className="appearance-preview-nav"><i /><i className="is-active" /><i /><i /><i /></span>
    </span>
  );
}

function StudioSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="appearance-studio-section">
      <header><strong>{title}</strong><span>{description}</span></header>
      {children}
    </section>
  );
}

function AppearanceStudioEditor({
  themeMode,
  themeSource,
  themeAccent,
  themeChrome,
  themeCanvas,
  themeDensity,
  onSetThemeSource,
  onSetThemeAccent,
  onSetThemeChrome,
  onSetThemeCanvas,
  onSetThemeDensity,
}: Omit<ThemeStudioProps, "variant">) {
  const accent = brandConfig.theme.appearance.accents[themeAccent];
  const chrome = brandConfig.theme.appearance.chromes[themeChrome];
  const canvas = brandConfig.theme.appearance.canvases[themeCanvas];
  const density = brandConfig.theme.appearance.densities[themeDensity];

  return (
    <div className="appearance-studio-editor">
      <div className="appearance-studio-heading">
        <span>Appearance</span>
        <strong>Build your RIVT setup</strong>
        <small>Set the accent, chrome, canvas, and density separately. Every control updates the real app immediately.</small>
      </div>

      <div className="appearance-studio-current" style={appearanceStyle(accent, chrome, canvas, themeMode)}>
        <AppPreview accent={accent} chrome={chrome} canvas={canvas} mode={themeMode} />
        <div>
          <span>Current setup</span>
          <strong>{accent.label} / {chrome.label}</strong>
          <small>{canvas.label} canvas / {density.label} density</small>
        </div>
      </div>

      <StudioSection title="Display mode" description="Follow the phone, or set a mode here.">
        <div className="appearance-studio-mode" role="group" aria-label="Color mode">
          {(["system", "light", "dark"] as ThemeSource[]).map((source) => {
            const Icon = source === "system" ? Monitor : source === "light" ? Sun : Moon;
            return <button key={source} type="button" className={themeSource === source ? "is-selected" : ""} aria-pressed={themeSource === source} onClick={() => onSetThemeSource(source)}><Icon size={16} />{sourceLabel(source)}</button>;
          })}
        </div>
      </StudioSection>

      <StudioSection title="Accent" description="Used for the primary action, selected state, and key highlights.">
        <div className="appearance-choice-grid appearance-choice-grid--accent" role="group" aria-label="Accent color">
          {accentEntries.map(([id, option]) => (
            <button key={id} type="button" className={id === themeAccent ? "is-selected" : ""} aria-label={`Use ${option.label} accent`} aria-pressed={id === themeAccent} onClick={() => onSetThemeAccent(id)}>
              <i style={{ background: option.swatch }} aria-hidden="true" />
              <span><strong>{option.label}</strong><small>{option.description}</small></span>
              {id === themeAccent ? <Check size={16} aria-hidden="true" /> : null}
            </button>
          ))}
        </div>
      </StudioSection>

      <StudioSection title="Chrome" description="The dark application bar and navigation frame.">
        <div className="appearance-choice-grid appearance-choice-grid--chrome" role="group" aria-label="Application chrome">
          {chromeEntries.map(([id, option]) => (
            <button key={id} type="button" className={id === themeChrome ? "is-selected" : ""} aria-label={`Use ${option.label} chrome`} aria-pressed={id === themeChrome} onClick={() => onSetThemeChrome(id)}>
              <i style={{ background: option.swatch }} aria-hidden="true" /><span><strong>{option.label}</strong><small>{option.description}</small></span>{id === themeChrome ? <Check size={16} aria-hidden="true" /> : null}
            </button>
          ))}
        </div>
      </StudioSection>

      <StudioSection title="Canvas" description="The background and working surfaces behind your records.">
        <div className="appearance-choice-grid appearance-choice-grid--canvas" role="group" aria-label="Application canvas">
          {canvasEntries.map(([id, option]) => (
            <button key={id} type="button" className={id === themeCanvas ? "is-selected" : ""} aria-label={`Use ${option.label} canvas`} aria-pressed={id === themeCanvas} onClick={() => onSetThemeCanvas(id)}>
              <i style={{ background: option.swatch }} aria-hidden="true" /><span><strong>{option.label}</strong><small>{option.description}</small></span>{id === themeCanvas ? <Check size={16} aria-hidden="true" /> : null}
            </button>
          ))}
        </div>
      </StudioSection>

      <StudioSection title="Workspace density" description="Field keeps controls roomy. Compact fits more into a scan.">
        <div className="appearance-density-grid" role="group" aria-label="Workspace density">
          {densityEntries.map(([id, option]) => {
            const Icon = id === "field" ? LayoutTemplate : Rows3;
            return <button key={id} type="button" className={id === themeDensity ? "is-selected" : ""} aria-label={`Use ${option.label} density`} aria-pressed={id === themeDensity} onClick={() => onSetThemeDensity(id)}><Icon size={18} /><span><strong>{option.label}</strong><small>{option.description}</small></span>{id === themeDensity ? <Check size={16} aria-hidden="true" /> : null}</button>;
          })}
        </div>
      </StudioSection>
      <p className="appearance-studio-boundary">Saved on this device. These are original RIVT controls, not manufacturer skins or affiliations.</p>
    </div>
  );
}

export function ThemeStudio({ variant = "full", ...props }: ThemeStudioProps) {
  const [isOpen, setIsOpen] = useState(false);
  const accent = brandConfig.theme.appearance.accents[props.themeAccent];
  const chrome = brandConfig.theme.appearance.chromes[props.themeChrome];
  const canvas = brandConfig.theme.appearance.canvases[props.themeCanvas];

  if (variant === "compact") {
    return (
      <section className="appearance-studio appearance-studio--compact" aria-label="Appearance">
        <button type="button" className="appearance-studio-launcher" onClick={() => setIsOpen(true)} style={appearanceStyle(accent, chrome, canvas, props.themeMode)}>
          <span className="appearance-studio-launcher-icon"><Palette size={18} /></span>
          <AppPreview accent={accent} chrome={chrome} canvas={canvas} mode={props.themeMode} compact />
          <span className="appearance-studio-launcher-copy"><span>Appearance</span><strong>{accent.label} / {chrome.label}</strong><small>{canvas.label} / {props.themeDensity}</small></span>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
        {isOpen ? (
          <div className="appearance-studio-dialog-backdrop" onClick={(event) => { if (event.target === event.currentTarget) setIsOpen(false); }}>
            <section className="appearance-studio-dialog" role="dialog" aria-modal="true" aria-label="Appearance studio">
              <div className="appearance-studio-dialog-bar"><div><span>RIVT</span><strong>Appearance studio</strong></div><button type="button" onClick={() => setIsOpen(false)} aria-label="Close appearance"><X size={18} /></button></div>
              <div className="appearance-studio-dialog-scroll"><AppearanceStudioEditor {...props} /></div>
            </section>
          </div>
        ) : null}
      </section>
    );
  }

  return <section className="appearance-studio" aria-label="Appearance studio"><AppearanceStudioEditor {...props} /></section>;
}
