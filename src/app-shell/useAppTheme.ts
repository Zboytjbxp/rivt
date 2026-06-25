import { useCallback, useEffect, useState } from "react";
import { brandConfig, type ThemeMode, type ThemePalette } from "../brandConfig";
import {
  readThemePalettePreference,
  readThemeSourcePreference,
  THEME_PALETTE_STORAGE_KEY,
  THEME_SOURCE_KEY,
  THEME_STORAGE_KEY,
} from "./preferences";

export type ThemeSource = "system" | ThemeMode;

export function useAppTheme() {
  const [themeSource, setThemeSource] = useState<ThemeSource>(readThemeSourcePreference);
  const [systemDark, setSystemDark] = useState<boolean>(
    () => typeof window !== "undefined" && Boolean(window.matchMedia?.("(prefers-color-scheme: dark)").matches),
  );
  const [themePalette, setThemePalette] = useState<ThemePalette>(readThemePalettePreference);

  const themeMode: ThemeMode = themeSource === "system" ? (systemDark ? "dark" : "light") : themeSource;

  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mq) return;
    setSystemDark(mq.matches);
    function handleChange(event: MediaQueryListEvent) {
      setSystemDark(event.matches);
    }
    mq.addEventListener("change", handleChange);
    return () => mq.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const theme = brandConfig.theme.modes[themeMode];
    const palette = brandConfig.theme.palettes[themePalette];
    const paletteVariables = palette.modes[themeMode];

    root.dataset.theme = themeMode;
    root.dataset.palette = themePalette;
    root.style.colorScheme = theme.colorScheme;
    Object.entries(theme.cssVariables).forEach(([name, value]) => {
      root.style.setProperty(name, value);
    });
    Object.entries(paletteVariables).forEach(([name, value]) => {
      root.style.setProperty(name, value);
    });

    try {
      if (themeSource === "system") {
        window.localStorage.removeItem(THEME_STORAGE_KEY);
      } else {
        window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);
      }
      window.localStorage.setItem(THEME_SOURCE_KEY, themeSource);
      window.localStorage.setItem(THEME_PALETTE_STORAGE_KEY, themePalette);
    } catch {
      // Storage unavailable — visual theme still applies for this session.
    }
  }, [themeMode, themeSource, themePalette]);

  const handleSetThemeSource = useCallback((source: ThemeSource) => {
    setThemeSource(source);
  }, []);

  const handleToggleTheme = useCallback(() => {
    setThemeSource((current) => (current === "dark" ? "light" : "dark"));
  }, []);

  const handleSelectThemePalette = useCallback((nextPalette: ThemePalette) => {
    setThemePalette(nextPalette);
  }, []);

  return {
    handleSelectThemePalette,
    handleSetThemeSource,
    handleToggleTheme,
    themeMode,
    themePalette,
    themeSource,
  };
}
