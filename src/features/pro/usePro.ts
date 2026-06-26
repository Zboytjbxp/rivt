import { useState } from "react";

const PRO_KEY = "rivt.pro.v1";

interface ProStatus { active: boolean; activatedAt: string | null; }

function readPro(): ProStatus {
  try { return JSON.parse(localStorage.getItem(PRO_KEY) ?? "null") ?? { active: false, activatedAt: null }; }
  catch { return { active: false, activatedAt: null }; }
}

export function usePro() {
  const [pro, setPro] = useState<ProStatus>(readPro);

  function activatePro() {
    const next: ProStatus = { active: true, activatedAt: new Date().toISOString() };
    setPro(next);
    try { localStorage.setItem(PRO_KEY, JSON.stringify(next)); } catch {}
  }

  return { isPro: pro.active, activatedAt: pro.activatedAt, activatePro };
}

export function getIsPro(): boolean {
  return readPro().active;
}
