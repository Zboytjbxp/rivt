import { createContext, createElement, useContext, useEffect, type ReactNode } from "react";
import { getPersona, type TradePersona } from "./tradePersona";

const PersonaTradeContext = createContext<string | null | undefined>(undefined);

function storageAvailable() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readTrade(): string | null {
  if (!storageAvailable()) return null;
  try {
    const profile = JSON.parse(window.localStorage.getItem("rivt.profile.v1") ?? "null");
    return profile?.primaryTrade ?? null;
  } catch { return null; }
}

export function isTradeMode(): boolean {
  if (!storageAvailable()) return true;
  return window.localStorage.getItem("rivt.tradeMode.v1") !== "false";
}

export function usePersona(): TradePersona | null {
  const serverTrade = useContext(PersonaTradeContext);
  if (!isTradeMode()) return null;
  return getPersona(serverTrade === undefined ? readTrade() : serverTrade);
}

export function PersonaProvider({ trade, children }: { trade: string | null; children: ReactNode }) {
  useEffect(() => {
    if (!storageAvailable() || !trade) return;
    try {
      const existing = JSON.parse(window.localStorage.getItem("rivt.profile.v1") ?? "{}");
      window.localStorage.setItem("rivt.profile.v1", JSON.stringify({ ...existing, primaryTrade: trade }));
    } catch {
      // The server profile remains authoritative when offline caching is unavailable.
    }
  }, [trade]);

  return createElement(PersonaTradeContext.Provider, { value: trade }, children);
}

export function useTradeModeToggle(): [boolean, () => void] {
  // Returns [isEnabled, toggle]
  // Reads from localStorage directly — no state needed at call site,
  // just for the settings toggle which re-renders the page on change.
  const enabled = isTradeMode();
  function toggle() {
    if (!storageAvailable()) return;
    window.localStorage.setItem("rivt.tradeMode.v1", enabled ? "false" : "true");
    window.location.reload(); // simplest way to re-read persona across all components
  }
  return [enabled, toggle];
}
