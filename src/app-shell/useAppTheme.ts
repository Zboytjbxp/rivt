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
  readThemeDensityPreference,
  readThemeSourcePreference,
  THEME_ACCENT_STORAGE_KEY,
  THEME_CANVAS_STORAGE_KEY,
  THEME_CHROME_STORAGE_KEY,
  THEME_DENSITY_STORAGE_KEY,
  THEME_SOURCE_KEY,
  THEME_STORAGE_KEY,
} from "./preferences";

export type ThemeSource = "system" | ThemeMode;

export function useAppTheme() {
  const [themeSource, setThemeSource] = useState<ThemeSource>(readThemeSourcePreference);
  const [systemDark, setSystemDark] = useState<boolean>(
    () => typeof window !== "undefined" && Boolean(window.matchMedia?.("(prefers-color-scheme: dark)").matches),
  );
  const [themeAccent, setThemeAccent] = useState<ThemeAccent>(readThemeAccentPreference);
  const [themeChrome, setThemeChrome] = useState<ThemeChrome>(readThemeChromePreference);
  const [themeCanvas, setThemeCanvas] = useState<ThemeCanvas>(readThemeCanvasPreference);
  const [themeDensity, setThemeDensity] = useState<ThemeDensity>(readThemeDensityPreference);

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
    const accent = brandConfig.theme.appearance.accents[themeAccent].modes[themeMode];
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
    } catch {
      // Storage unavailable - the selected appearance remains active for this session.
    }
  }, [themeAccent, themeCanvas, themeChrome, themeDensity, themeMode, themeSource]);

  const handleSetThemeSource = useCallback((source: ThemeSource) => setThemeSource(source), []);
  const handleToggleTheme = useCallback(() => setThemeSource((current) => (current === "dark" ? "light" : "dark")), []);
  const handleSetThemeAccent = useCallback((accent: ThemeAccent) => setThemeAccent(accent), []);
  const handleSetThemeChrome = useCallback((chrome: ThemeChrome) => setThemeChrome(chrome), []);
  const handleSetThemeCanvas = useCallback((canvas: ThemeCanvas) => setThemeCanvas(canvas), []);
  const handleSetThemeDensity = useCallback((density: ThemeDensity) => setThemeDensity(density), []);

  return {
    handleSetThemeAccent,
    handleSetThemeCanvas,
    handleSetThemeChrome,
    handleSetThemeDensity,
    handleSetThemeSource,
    handleToggleTheme,
    themeAccent,
    themeCanvas,
    themeChrome,
    themeDensity,
    themeMode,
    themeSource,
  };
}
