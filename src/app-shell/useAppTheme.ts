import { useCallback, useEffect, useState } from "react";
import { brandConfig, type ThemeMode, type ThemePalette } from "../brandConfig";
import {
  readThemePalettePreference,
  readThemePreference,
  THEME_PALETTE_STORAGE_KEY,
  THEME_STORAGE_KEY,
} from "./preferences";

export function useAppTheme() {
  const [themeMode, setThemeMode] = useState<ThemeMode>(readThemePreference);
  const [themePalette, setThemePalette] = useState<ThemePalette>(readThemePalettePreference);

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
      window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);
      window.localStorage.setItem(THEME_PALETTE_STORAGE_KEY, themePalette);
    } catch {
      // If browser storage is unavailable, the visual theme still applies for this session.
    }
  }, [themeMode, themePalette]);

  const handleToggleTheme = useCallback(() => {
    setThemeMode((currentMode) => (currentMode === "dark" ? "light" : "dark"));
  }, []);

  const handleSelectThemePalette = useCallback((nextPalette: ThemePalette) => {
    setThemePalette(nextPalette);
  }, []);

  return {
    handleSelectThemePalette,
    handleToggleTheme,
    themeMode,
    themePalette,
  };
}
