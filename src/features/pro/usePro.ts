import { useState } from "react";

const PRO_KEY = "rivt.pro.v1";
const ALLOW_LOCAL_PRO = import.meta.env.VITE_ALLOW_LOCAL_PRO === "true";

interface ProStatus { active: boolean; activatedAt: string | null; }

function readPro(): ProStatus {
  if (!ALLOW_LOCAL_PRO) return { active: false, activatedAt: null };
  try { return JSON.parse(localStorage.getItem(PRO_KEY) ?? "null") ?? { active: false, activatedAt: null }; }
  catch { return { active: false, activatedAt: null }; }
}

export function usePro() {
  const [pro, setPro] = useState<ProStatus>(readPro);

  function activatePro() {
    if (!ALLOW_LOCAL_PRO) return false;
    const next: ProStatus = { active: true, activatedAt: new Date().toISOString() };
    setPro(next);
    try { localStorage.setItem(PRO_KEY, JSON.stringify(next)); } catch { /* noop */ }
    return true;
  }

  return { isPro: pro.active, activatedAt: pro.activatedAt, activatePro, localProEnabled: ALLOW_LOCAL_PRO };
}

export function getIsPro(): boolean {
  return readPro().active;
}
