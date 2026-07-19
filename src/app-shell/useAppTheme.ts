import { useCallback, useEffect, useState } from "react";
import {
  brandConfig,
  type ThemeMode,
} from "../brandConfig";
import {
  type AccessibilityPreferenceKey,
  type AccessibilityPreferences,
  COLOR_VISION_STORAGE_KEY,
  ENHANCED_CONTRAST_STORAGE_KEY,
  LARGE_TEXT_STORAGE_KEY,
  readAccessibilityPreferences,
  readThemeSourcePreference,
  THEME_SOURCE_KEY,
  THEME_STORAGE_KEY,
} from "./preferences";

export type ThemeSource = "system" | ThemeMode;

export function useAppTheme() {
  const [themeSource, setThemeSource] = useState<ThemeSource>(readThemeSourcePreference);
  const [accessibilityPreferences, setAccessibilityPreferences] = useState<AccessibilityPreferences>(
    readAccessibilityPreferences,
  );
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

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.colorVision = accessibilityPreferences.colorSafe ? "safe" : "standard";
    root.dataset.contrast = accessibilityPreferences.enhancedContrast ? "high" : "standard";
    root.dataset.legibility = accessibilityPreferences.largeText ? "large" : "standard";

    try {
      const preferences: Array<[string, boolean]> = [
        [COLOR_VISION_STORAGE_KEY, accessibilityPreferences.colorSafe],
        [ENHANCED_CONTRAST_STORAGE_KEY, accessibilityPreferences.enhancedContrast],
        [LARGE_TEXT_STORAGE_KEY, accessibilityPreferences.largeText],
      ];
      preferences.forEach(([key, enabled]) => {
        if (enabled) window.localStorage.setItem(key, "on");
        else window.localStorage.removeItem(key);
      });
    } catch {
      // Storage unavailable - the selected display settings remain active for this session.
    }
  }, [accessibilityPreferences]);

  const handleSetThemeSource = useCallback((source: ThemeSource) => setThemeSource(source), []);
  const handleToggleTheme = useCallback(() => setThemeSource((current) => (current === "dark" ? "light" : "dark")), []);
  const handleToggleAccessibility = useCallback((key: AccessibilityPreferenceKey) => {
    setAccessibilityPreferences((current) => ({ ...current, [key]: !current[key] }));
  }, []);
  return {
    accessibilityPreferences,
    handleSetThemeSource,
    handleToggleAccessibility,
    handleToggleTheme,
    themeMode,
    themeSource,
  };
}
