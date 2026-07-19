import {
  brandConfig,
  type ThemeAccent,
  type ThemeCanvas,
  type ThemeChrome,
  type ThemeDensity,
  type ThemeMode,
} from "../brandConfig";

export const THEME_STORAGE_KEY = `${brandConfig.appSlug}-theme-mode`;
export const THEME_SOURCE_KEY = `${brandConfig.appSlug}-theme-source`;
export const THEME_PALETTE_STORAGE_KEY = `${brandConfig.appSlug}-theme-palette`;
export const THEME_ACCENT_STORAGE_KEY = `${brandConfig.appSlug}-theme-accent`;
export const THEME_CHROME_STORAGE_KEY = `${brandConfig.appSlug}-theme-chrome`;
export const THEME_CANVAS_STORAGE_KEY = `${brandConfig.appSlug}-theme-canvas`;
export const THEME_DENSITY_STORAGE_KEY = `${brandConfig.appSlug}-theme-density`;
export const THEME_CUSTOM_COLOR_STORAGE_KEY = `${brandConfig.appSlug}-theme-custom-color`;
export const AUTH_MODE_KEY = `${brandConfig.appSlug}-auth-mode`;
export const COLOR_VISION_STORAGE_KEY = `${brandConfig.appSlug}-color-safe-status`;
export const ENHANCED_CONTRAST_STORAGE_KEY = `${brandConfig.appSlug}-enhanced-contrast`;
export const LARGE_TEXT_STORAGE_KEY = `${brandConfig.appSlug}-large-text`;

export type AccessibilityPreferenceKey = "colorSafe" | "enhancedContrast" | "largeText";

export interface AccessibilityPreferences {
  colorSafe: boolean;
  enhancedContrast: boolean;
  largeText: boolean;
}

function readBooleanPreference(key: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(key) === "on";
  } catch {
    return false;
  }
}

export function readAccessibilityPreferences(): AccessibilityPreferences {
  return {
    colorSafe: readBooleanPreference(COLOR_VISION_STORAGE_KEY),
    enhancedContrast: readBooleanPreference(ENHANCED_CONTRAST_STORAGE_KEY),
    largeText: readBooleanPreference(LARGE_TEXT_STORAGE_KEY),
  };
}

export function readThemePreference(): ThemeMode {
  if (typeof window === "undefined") return "light";

  try {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (storedTheme === "light" || storedTheme === "dark") return storedTheme;
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch {
    return "light";
  }
}

function legacyAppearance() {
  try {
    const legacy = window.localStorage.getItem(THEME_PALETTE_STORAGE_KEY);
    if (legacy && legacy in brandConfig.theme.appearance.legacyPaletteMap) {
      return brandConfig.theme.appearance.legacyPaletteMap[
        legacy as keyof typeof brandConfig.theme.appearance.legacyPaletteMap
      ];
    }
  } catch {
    // Storage may be unavailable. Defaults below keep the UI usable.
  }
  return brandConfig.theme.appearance.legacyPaletteMap.rivtOrange;
}

function readChoice<T extends string>(key: string, options: Record<T, unknown>, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const stored = window.localStorage.getItem(key);
    if (stored && stored in options) return stored as T;
  } catch {
    // Use the supplied fallback when storage is not available.
  }
  return fallback;
}

export function readThemeAccentPreference(): ThemeAccent {
  return readChoice(
    THEME_ACCENT_STORAGE_KEY,
    brandConfig.theme.appearance.accents,
    legacyAppearance().accent,
  );
}

export function readThemeChromePreference(): ThemeChrome {
  return readChoice(
    THEME_CHROME_STORAGE_KEY,
    brandConfig.theme.appearance.chromes,
    legacyAppearance().chrome,
  );
}

export function readThemeCanvasPreference(): ThemeCanvas {
  return readChoice(
    THEME_CANVAS_STORAGE_KEY,
    brandConfig.theme.appearance.canvases,
    legacyAppearance().canvas,
  );
}

export function readThemeDensityPreference(): ThemeDensity {
  return readChoice(THEME_DENSITY_STORAGE_KEY, brandConfig.theme.appearance.densities, "field");
}

export function readThemeCustomColorPreference(): string {
  if (typeof window === "undefined") return "#ff4b00";
  try {
    const stored = window.localStorage.getItem(THEME_CUSTOM_COLOR_STORAGE_KEY);
    if (stored && /^#[0-9a-f]{6}$/i.test(stored)) return stored.toLowerCase();
  } catch {
    // Keep the default when storage is unavailable.
  }
  return "#ff4b00";
}

export function readThemeSourcePreference(): "system" | ThemeMode {
  if (typeof window === "undefined") return "system";
  try {
    const source = window.localStorage.getItem(THEME_SOURCE_KEY);
    if (source === "light" || source === "dark" || source === "system") return source;
    const mode = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (mode === "light" || mode === "dark") return mode;
  } catch {
    // System is the safe device-level default.
  }
  return "system";
}

export function readAuthModePreference(): "login" | "signup" {
  if (typeof window === "undefined") return "login";
  try {
    return window.sessionStorage.getItem(AUTH_MODE_KEY) === "signup" ? "signup" : "login";
  } catch {
    return "login";
  }
}
