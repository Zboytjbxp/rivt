import { useCallback, useEffect, useState } from "react";
import {
  brandConfig,
  type ThemeAccent,
  type ThemeCanvas,
  type ThemeChrome,
  type ThemeDensity,
  type ThemeMode,
} from "../brandConfig";
import {
  readThemeAccentPreference,
  readThemeCanvasPreference,
  readThemeChromePreference,
  readThemeCustomColorPreference,
  readThemeDensityPreference,
  readThemeSourcePreference,
  THEME_ACCENT_STORAGE_KEY,
  THEME_CANVAS_STORAGE_KEY,
  THEME_CHROME_STORAGE_KEY,
  THEME_CUSTOM_COLOR_STORAGE_KEY,
  THEME_DENSITY_STORAGE_KEY,
  THEME_SOURCE_KEY,
  THEME_STORAGE_KEY,
} from "./preferences";

export type ThemeSource = "system" | ThemeMode;

function clampByte(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function adjustHex(hex: string, amount: number) {
  const normalized = hex.replace("#", "");
  const channels = [0, 2, 4].map((offset) => parseInt(normalized.slice(offset, offset + 2), 16));
  return `#${channels.map((channel) => clampByte(channel + amount).toString(16).padStart(2, "0")).join("")}`;
}

function customAccentVariables(color: string, mode: ThemeMode) {
  return {
    "--accent": color,
    "--accent-deep": adjustHex(color, mode === "dark" ? 76 : -58),
    "--accent-soft": `color-mix(in srgb, ${color} ${mode === "dark" ? "24" : "13"}%, var(--surface))`,
    "--amber": color,
    "--amber-soft": `color-mix(in srgb, ${color} ${mode === "dark" ? "24" : "13"}%, var(--surface))`,
  };
}

export function useAppTheme() {
  const [themeSource, setThemeSource] = useState<ThemeSource>(readThemeSourcePreference);
  const [systemDark, setSystemDark] = useState<boolean>(
    () => typeof window !== "undefined" && Boolean(window.matchMedia?.("(prefers-color-scheme: dark)").matches),
  );
  const [themeAccent, setThemeAccent] = useState<ThemeAccent>(readThemeAccentPreference);
  const [themeChrome, setThemeChrome] = useState<ThemeChrome>(readThemeChromePreference);
  const [themeCanvas, setThemeCanvas] = useState<ThemeCanvas>(readThemeCanvasPreference);
  const [themeDensity, setThemeDensity] = useState<ThemeDensity>(readThemeDensityPreference);
  const [themeCustomColor, setThemeCustomColor] = useState(readThemeCustomColorPreference);

  const themeMode: ThemeMode = themeSource === "system" ? (systemDark ? "dark" : "light") : themeSource;

  useEffect(() => {
    const mediaQuery = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mediaQuery) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSystemDark(mediaQuery.matches);
    function handleChange(event: MediaQueryListEvent) {
      setSystemDark(event.matches);
    }
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const mode = brandConfig.theme.modes[themeMode];
    const accent = themeAccent === "custom"
      ? customAccentVariables(themeCustomColor, themeMode)
      : brandConfig.theme.appearance.accents[themeAccent].modes[themeMode];
    const chrome = brandConfig.theme.appearance.chromes[themeChrome].modes[themeMode];
    const canvas = brandConfig.theme.appearance.canvases[themeCanvas].modes[themeMode];
    const density = brandConfig.theme.appearance.densities[themeDensity].cssVariables;

    root.dataset.theme = themeMode;
    root.dataset.appearance = "true";
    root.dataset.themeAccent = themeAccent;
    root.dataset.themeChrome = themeChrome;
    root.dataset.themeCanvas = themeCanvas;
    root.dataset.themeDensity = themeDensity;
    root.style.colorScheme = mode.colorScheme;
    [mode.cssVariables, canvas, chrome, accent, density].forEach((variables) => {
      Object.entries(variables).forEach(([name, value]) => root.style.setProperty(name, value));
    });

    try {
      if (themeSource === "system") window.localStorage.removeItem(THEME_STORAGE_KEY);
      else window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);
      window.localStorage.setItem(THEME_SOURCE_KEY, themeSource);
      window.localStorage.setItem(THEME_ACCENT_STORAGE_KEY, themeAccent);
      window.localStorage.setItem(THEME_CHROME_STORAGE_KEY, themeChrome);
      window.localStorage.setItem(THEME_CANVAS_STORAGE_KEY, themeCanvas);
      window.localStorage.setItem(THEME_DENSITY_STORAGE_KEY, themeDensity);
      window.localStorage.setItem(THEME_CUSTOM_COLOR_STORAGE_KEY, themeCustomColor);
    } catch {
      // Storage unavailable - the selected appearance remains active for this session.
    }
  }, [themeAccent, themeCanvas, themeChrome, themeCustomColor, themeDensity, themeMode, themeSource]);

  const handleSetThemeSource = useCallback((source: ThemeSource) => setThemeSource(source), []);
  const handleToggleTheme = useCallback(() => setThemeSource((current) => (current === "dark" ? "light" : "dark")), []);
  const handleSetThemeAccent = useCallback((accent: ThemeAccent) => setThemeAccent(accent), []);
  const handleSetThemeChrome = useCallback((chrome: ThemeChrome) => setThemeChrome(chrome), []);
  const handleSetThemeCanvas = useCallback((canvas: ThemeCanvas) => setThemeCanvas(canvas), []);
  const handleSetThemeDensity = useCallback((density: ThemeDensity) => setThemeDensity(density), []);
  const handleSetThemeCustomColor = useCallback((color: string) => {
    if (/^#[0-9a-f]{6}$/i.test(color)) {
      setThemeCustomColor(color.toLowerCase());
      setThemeAccent("custom");
    }
  }, []);

  return {
    handleSetThemeAccent,
    handleSetThemeCanvas,
    handleSetThemeChrome,
    handleSetThemeCustomColor,
    handleSetThemeDensity,
    handleSetThemeSource,
    handleToggleTheme,
    themeAccent,
    themeCanvas,
    themeChrome,
    themeCustomColor,
    themeDensity,
    themeMode,
    themeSource,
  };
}
