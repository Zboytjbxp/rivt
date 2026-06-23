import { brandConfig, type ThemeMode, type ThemePalette } from "../brandConfig";

export const THEME_STORAGE_KEY = `${brandConfig.appSlug}-theme-mode`;
export const THEME_PALETTE_STORAGE_KEY = `${brandConfig.appSlug}-theme-palette`;
export const AUTH_MODE_KEY = `${brandConfig.appSlug}-auth-mode`;

export function readThemePreference(): ThemeMode {
  if (typeof window === "undefined") return "light";

  try {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (storedTheme === "light" || storedTheme === "dark") {
      return storedTheme;
    }

    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function readThemePalettePreference(): ThemePalette {
  if (typeof window === "undefined") return "orangeRidge";

  try {
    const storedPalette = window.localStorage.getItem(THEME_PALETTE_STORAGE_KEY);
    if (storedPalette && storedPalette in brandConfig.theme.palettes) {
      return storedPalette as ThemePalette;
    }
  } catch {
    return "orangeRidge";
  }

  return "orangeRidge";
}

export function readAuthModePreference(): "login" | "signup" {
  if (typeof window === "undefined") return "login";
  try {
    return window.sessionStorage.getItem(AUTH_MODE_KEY) === "signup" ? "signup" : "login";
  } catch {
    return "login";
  }
}
