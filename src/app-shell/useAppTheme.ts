import { useCallback, useEffect, useRef, useState } from "react";
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
  const largeTextRef = useRef(accessibilityPreferences.largeText);
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

  useEffect(() => {
    largeTextRef.current = accessibilityPreferences.largeText;
  }, [accessibilityPreferences.largeText]);

  useEffect(() => {
    let startDistance = 0;
    let startLargeText = false;

    function distance(touches: TouchList) {
      const [first, second] = [touches.item(0), touches.item(1)];
      if (!first || !second) return 0;
      return Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);
    }

    function isCameraGesture(target: EventTarget | null) {
      return target instanceof Element && Boolean(target.closest(".v2-camera-overlay"));
    }

    function handleTouchStart(event: TouchEvent) {
      if (event.touches.length !== 2 || isCameraGesture(event.target)) return;
      startDistance = distance(event.touches);
      startLargeText = largeTextRef.current;
    }

    function handleTouchMove(event: TouchEvent) {
      if (event.touches.length !== 2 || !startDistance || isCameraGesture(event.target)) return;
      event.preventDefault();
      const ratio = distance(event.touches) / startDistance;
      if (ratio > 1.12 && !startLargeText) {
        setAccessibilityPreferences((current) => ({ ...current, largeText: true }));
      } else if (ratio < 0.9 && startLargeText) {
        setAccessibilityPreferences((current) => ({ ...current, largeText: false }));
      }
    }

    function handleTouchEnd(event: TouchEvent) {
      if (event.touches.length < 2) startDistance = 0;
    }

    function preventSafariPageZoom(event: Event) {
      if (!isCameraGesture(event.target)) event.preventDefault();
    }

    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    document.addEventListener("touchend", handleTouchEnd, { passive: true });
    document.addEventListener("gesturestart", preventSafariPageZoom, { passive: false });
    document.addEventListener("gesturechange", preventSafariPageZoom, { passive: false });
    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
      document.removeEventListener("gesturestart", preventSafariPageZoom);
      document.removeEventListener("gesturechange", preventSafariPageZoom);
    };
  }, []);

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
