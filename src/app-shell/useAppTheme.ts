import { useCallback, useEffect, useState } from "react";
import {
  brandConfig,
  type ThemeMode,
} from "../brandConfig";
import {
  readThemeSourcePreference,
  THEME_SOURCE_KEY,
  THEME_STORAGE_KEY,
} from "./preferences";

export type ThemeSource = "system" | ThemeMode;

export function useAppTheme() {
  const [themeSource, setThemeSource] = useState<ThemeSource>(readThemeSourcePreference);
  const [systemDark, setSystemDark] = useState<boolean>(
    () => typeof window !== "undefined" && Boolean(window.matchMedia?.("(prefers-color-scheme: dark)").matches),
  );
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
    root.dataset.theme = themeMode;
    delete root.dataset.appearance;
    delete root.dataset.themeAccent;
    delete root.dataset.themeChrome;
    delete root.dataset.themeCanvas;
    delete root.dataset.themeDensity;
    root.style.colorScheme = mode.colorScheme;
    Object.entries(mode.cssVariables).forEach(([name, value]) => {
      root.style.setProperty(name, value);
    });

    try {
      if (themeSource === "system") window.localStorage.removeItem(THEME_STORAGE_KEY);
      else window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);
      window.localStorage.setItem(THEME_SOURCE_KEY, themeSource);
      // Retire prior theme experiments so a shared device cannot retain a hidden visual profile.
      [
        "rivt-theme-palette",
        "rivt-theme-accent",
        "rivt-theme-chrome",
        "rivt-theme-canvas",
        "rivt-theme-density",
        "rivt-theme-custom-color",
      ].forEach((key) => window.localStorage.removeItem(key));
    } catch {
      // Storage unavailable - the selected appearance remains active for this session.
    }
  }, [themeMode, themeSource]);

  const handleSetThemeSource = useCallback((source: ThemeSource) => setThemeSource(source), []);
  const handleToggleTheme = useCallback(() => setThemeSource((current) => (current === "dark" ? "light" : "dark")), []);
  return {
    handleSetThemeSource,
    handleToggleTheme,
    themeMode,
    themeSource,
  };
}
