import { useCallback, useEffect, useState } from "react";
import { getBillingStatus, type BillingStatus } from "../../lib/billing";

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
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshBilling = useCallback(async () => {
    try {
      const status = await getBillingStatus();
      setBilling(status);
      setPro({
        active: status.active || (ALLOW_LOCAL_PRO && readPro().active),
        activatedAt: status.activeUntil,
      });
      return status;
    } catch {
      const local = readPro();
      setBilling(null);
      setPro(local);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    getBillingStatus()
      .then((status) => {
        if (cancelled) return;
        setBilling(status);
        setPro({
          active: status.active || (ALLOW_LOCAL_PRO && readPro().active),
          activatedAt: status.activeUntil,
        });
      })
      .catch(() => {
        if (cancelled) return;
        setBilling(null);
        setPro(readPro());
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  function activatePro() {
    if (!ALLOW_LOCAL_PRO) return false;
    const next: ProStatus = { active: true, activatedAt: new Date().toISOString() };
    setPro(next);
    try { localStorage.setItem(PRO_KEY, JSON.stringify(next)); } catch { /* noop */ }
    return true;
  }

  return {
    isPro: pro.active,
    activatedAt: pro.activatedAt,
    activatePro,
    billing,
    billingLoading: loading,
    localProEnabled: ALLOW_LOCAL_PRO,
    refreshBilling,
  };
}

export function getIsPro(): boolean {
  return readPro().active;
}
