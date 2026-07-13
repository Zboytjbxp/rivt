import { Check, ChevronRight, LayoutTemplate, Monitor, Moon, Palette, Pipette, Rows3, Sun, X } from "lucide-react";
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
  themeCustomColor: string;
  themeDensity: ThemeDensity;
  onSetThemeSource: (source: ThemeSource) => void;
  onSetThemeAccent: (accent: ThemeAccent) => void;
  onSetThemeChrome: (chrome: ThemeChrome) => void;
  onSetThemeCanvas: (canvas: ThemeCanvas) => void;
  onSetThemeCustomColor: (color: string) => void;
  onSetThemeDensity: (density: ThemeDensity) => void;
  variant?: "full" | "compact";
}

type AccentConfig = (typeof brandConfig.theme.appearance.accents)[ThemeAccent];
type ChromeConfig = (typeof brandConfig.theme.appearance.chromes)[ThemeChrome];
type CanvasConfig = (typeof brandConfig.theme.appearance.canvases)[ThemeCanvas];

interface FieldKit {
  id: string;
  label: string;
  description: string;
  accent: Exclude<ThemeAccent, "custom">;
  chrome: ThemeChrome;
  canvas: ThemeCanvas;
  density: ThemeDensity;
}

const FIELD_KITS: FieldKit[] = [
  { id: "orange-black", label: "Orange / black", description: "Safety orange with a carbon tool body.", accent: "rivtOrange", chrome: "graphite", canvas: "paper", density: "field" },
  { id: "red-black", label: "Red / black", description: "Hard red markings on a black chassis.", accent: "ironRed", chrome: "graphite", canvas: "clean", density: "field" },
  { id: "yellow-black", label: "Yellow / black", description: "High-visibility yellow with dark controls.", accent: "signalBrass", chrome: "graphite", canvas: "clean", density: "field" },
  { id: "teal-black", label: "Teal / black", description: "Clean teal details with a tool-body frame.", accent: "toolTeal", chrome: "graphite", canvas: "concrete", density: "field" },
  { id: "green-black", label: "Green / black", description: "Bright green markings on black chrome.", accent: "workshopGreen", chrome: "graphite", canvas: "concrete", density: "field" },
  { id: "blue-black", label: "Blue / black", description: "Strong blue controls with a black frame.", accent: "harborBlue", chrome: "navy", canvas: "clean", density: "field" },
];

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
  customColor?: string,
): CSSProperties {
  const accentValues = accent.modes[mode];
  const chromeValues = chrome.modes[mode];
  const canvasValues = canvas.modes[mode];
  const activeAccent = customColor ?? accentValues["--accent"];
  return {
    "--appearance-preview-accent": activeAccent,
    "--appearance-preview-accent-soft": customColor
      ? `color-mix(in srgb, ${activeAccent} 16%, ${canvasValues["--surface"]})`
      : accentValues["--accent-soft"],
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
  customColor,
  compact = false,
}: {
  accent: AccentConfig;
  chrome: ChromeConfig;
  canvas: CanvasConfig;
  mode: ThemeMode;
  customColor?: string;
  compact?: boolean;
}) {
  return (
    <span className={compact ? "appearance-preview is-compact" : "appearance-preview"} style={appearanceStyle(accent, chrome, canvas, mode, customColor)} aria-hidden="true">
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

function StudioSection({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <section className="appearance-studio-section"><header><strong>{title}</strong><span>{description}</span></header>{children}</section>;
}

function AppearanceStudioEditor({
  themeMode,
  themeSource,
  themeAccent,
  themeChrome,
  themeCanvas,
  themeCustomColor,
  themeDensity,
  onSetThemeSource,
  onSetThemeAccent,
  onSetThemeChrome,
  onSetThemeCanvas,
  onSetThemeCustomColor,
  onSetThemeDensity,
}: Omit<ThemeStudioProps, "variant">) {
  const accent = brandConfig.theme.appearance.accents[themeAccent];
  const chrome = brandConfig.theme.appearance.chromes[themeChrome];
  const canvas = brandConfig.theme.appearance.canvases[themeCanvas];
  const currentKit = FIELD_KITS.find((kit) => kit.accent === themeAccent && kit.chrome === themeChrome && kit.canvas === themeCanvas && kit.density === themeDensity);
  const currentLabel = themeAccent === "custom" ? "My tool color" : currentKit?.label ?? accent.label;

  function applyKit(kit: FieldKit) {
    onSetThemeAccent(kit.accent);
    onSetThemeChrome(kit.chrome);
    onSetThemeCanvas(kit.canvas);
    onSetThemeDensity(kit.density);
  }

  return (
    <div className="appearance-studio-editor">
      <div className="appearance-studio-heading">
        <span>My field kit</span>
        <strong>Match the gear you carry.</strong>
        <small>Pick a familiar tool-color system first. RIVT uses it across the real workspace, not only in this preview.</small>
      </div>

      <div className="appearance-studio-current" style={appearanceStyle(accent, chrome, canvas, themeMode, themeAccent === "custom" ? themeCustomColor : undefined)}>
        <AppPreview accent={accent} chrome={chrome} canvas={canvas} mode={themeMode} customColor={themeAccent === "custom" ? themeCustomColor : undefined} />
        <div><span>Active field kit</span><strong>{currentLabel}</strong><small>{chrome.label} chassis / {canvas.label} surface</small></div>
      </div>

      <StudioSection title="Choose a field kit" description="These tool-color systems are visual choices only. They are not manufacturer skins or affiliations.">
        <div className="field-kit-grid" role="group" aria-label="Field kit color profiles">
          {FIELD_KITS.map((kit) => {
            const kitAccent = brandConfig.theme.appearance.accents[kit.accent];
            const kitChrome = brandConfig.theme.appearance.chromes[kit.chrome];
            const kitCanvas = brandConfig.theme.appearance.canvases[kit.canvas];
            const isSelected = currentKit?.id === kit.id;
            return (
              <button key={kit.id} type="button" className={isSelected ? "field-kit is-selected" : "field-kit"} aria-label={`Use ${kit.label} field kit`} aria-pressed={isSelected} onClick={() => applyKit(kit)} style={appearanceStyle(kitAccent, kitChrome, kitCanvas, themeMode)}>
                <AppPreview accent={kitAccent} chrome={kitChrome} canvas={kitCanvas} mode={themeMode} compact />
                <span><strong>{kit.label}</strong><small>{kit.description}</small></span>
                {isSelected ? <Check size={16} aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>
      </StudioSection>

      <StudioSection title="Match my tools" description="Choose the exact color that fits the tools in your hand.">
        <div className={themeAccent === "custom" ? "field-kit-custom is-selected" : "field-kit-custom"}>
          <span className="field-kit-custom-swatch" style={{ background: themeCustomColor }} aria-hidden="true" />
          <div><strong>My tool color</strong><small>{themeCustomColor.toUpperCase()} / saved on this device</small></div>
          <label aria-label="Choose custom tool color"><Pipette size={16} /><input type="color" value={themeCustomColor} onChange={(event) => onSetThemeCustomColor(event.target.value)} /></label>
        </div>
      </StudioSection>

      <details className="appearance-studio-fine-tune">
        <summary>Fine tune this kit</summary>
        <div className="appearance-studio-fine-tune-body">
          <StudioSection title="Display mode" description="Follow the phone, or set a mode here.">
            <div className="appearance-studio-mode" role="group" aria-label="Color mode">
              {(["system", "light", "dark"] as ThemeSource[]).map((source) => {
                const Icon = source === "system" ? Monitor : source === "light" ? Sun : Moon;
                return <button key={source} type="button" className={themeSource === source ? "is-selected" : ""} aria-pressed={themeSource === source} onClick={() => onSetThemeSource(source)}><Icon size={16} />{sourceLabel(source)}</button>;
              })}
            </div>
          </StudioSection>

          <StudioSection title="Tool body" description="Choose the dark frame behind your working surfaces.">
            <div className="appearance-choice-grid appearance-choice-grid--chrome" role="group" aria-label="Application chrome">
              {chromeEntries.map(([id, option]) => <button key={id} type="button" className={id === themeChrome ? "is-selected" : ""} aria-label={`Use ${option.label} chrome`} aria-pressed={id === themeChrome} onClick={() => onSetThemeChrome(id)}><i style={{ background: option.swatch }} aria-hidden="true" /><span><strong>{option.label}</strong><small>{option.description}</small></span>{id === themeChrome ? <Check size={16} aria-hidden="true" /> : null}</button>)}
            </div>
          </StudioSection>

          <StudioSection title="Work surface" description="Choose the background behind records, forms, and plans.">
            <div className="appearance-choice-grid appearance-choice-grid--canvas" role="group" aria-label="Application canvas">
              {canvasEntries.map(([id, option]) => <button key={id} type="button" className={id === themeCanvas ? "is-selected" : ""} aria-label={`Use ${option.label} canvas`} aria-pressed={id === themeCanvas} onClick={() => onSetThemeCanvas(id)}><i style={{ background: option.swatch }} aria-hidden="true" /><span><strong>{option.label}</strong><small>{option.description}</small></span>{id === themeCanvas ? <Check size={16} aria-hidden="true" /> : null}</button>)}
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
        </div>
      </details>
      <p className="appearance-studio-boundary">RIVT does not use logos, brand names, or manufacturer affiliations in these visual settings.</p>
    </div>
  );
}

export function ThemeStudio({ variant = "full", ...props }: ThemeStudioProps) {
  const [isOpen, setIsOpen] = useState(false);
  const accent = brandConfig.theme.appearance.accents[props.themeAccent];
  const chrome = brandConfig.theme.appearance.chromes[props.themeChrome];
  const canvas = brandConfig.theme.appearance.canvases[props.themeCanvas];
  const currentKit = FIELD_KITS.find((kit) => kit.accent === props.themeAccent && kit.chrome === props.themeChrome && kit.canvas === props.themeCanvas && kit.density === props.themeDensity);
  const currentLabel = props.themeAccent === "custom" ? "My tool color" : currentKit?.label ?? accent.label;

  if (variant === "compact") {
    return (
      <section className="appearance-studio appearance-studio--compact" aria-label="Appearance">
        <button type="button" className="appearance-studio-launcher" onClick={() => setIsOpen(true)} style={appearanceStyle(accent, chrome, canvas, props.themeMode, props.themeAccent === "custom" ? props.themeCustomColor : undefined)}>
          <span className="appearance-studio-launcher-icon"><Palette size={18} /></span>
          <AppPreview accent={accent} chrome={chrome} canvas={canvas} mode={props.themeMode} customColor={props.themeAccent === "custom" ? props.themeCustomColor : undefined} compact />
          <span className="appearance-studio-launcher-copy"><span>My field kit</span><strong>{currentLabel}</strong><small>Customize the real RIVT workspace</small></span>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
        {isOpen ? <div className="appearance-studio-dialog-backdrop" onClick={(event) => { if (event.target === event.currentTarget) setIsOpen(false); }}><section className="appearance-studio-dialog" role="dialog" aria-modal="true" aria-label="Field kit"><div className="appearance-studio-dialog-bar"><div><span>RIVT</span><strong>My field kit</strong></div><button type="button" onClick={() => setIsOpen(false)} aria-label="Close appearance"><X size={18} /></button></div><div className="appearance-studio-dialog-scroll"><AppearanceStudioEditor {...props} /></div></section></div> : null}
      </section>
    );
  }

  return <section className="appearance-studio" aria-label="My field kit"><AppearanceStudioEditor {...props} /></section>;
}
