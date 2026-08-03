import { useCallback, useEffect, useRef, useState } from "react";
import { getBillingStatus, type BillingStatus } from "../../lib/billing";

const PRO_KEY = "rivt.pro.v1";
const ALLOW_LOCAL_PRO = import.meta.env.VITE_ALLOW_LOCAL_PRO === "true";

interface ProStatus { active: boolean; activatedAt: string | null; }

function readPro(): ProStatus {
  if (!ALLOW_LOCAL_PRO) return { active: false, activatedAt: null };
  try { return JSON.parse(localStorage.getItem(PRO_KEY) ?? "null") ?? { active: false, activatedAt: null }; }
  catch { return { active: false, activatedAt: null }; }
}

export function usePro(accountId: string) {
  const [pro, setPro] = useState<ProStatus>(readPro);
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const accountIdRef = useRef(accountId);

  const refreshBilling = useCallback(async () => {
    try {
      const status = await getBillingStatus(accountId);
      if (accountIdRef.current !== accountId) return null;
      setBilling(status);
      setPro({
        active: status.active || (ALLOW_LOCAL_PRO && readPro().active),
        activatedAt: status.activeUntil,
      });
      return status;
    } catch {
      if (accountIdRef.current !== accountId) return null;
      const local = readPro();
      setBilling(null);
      setPro(local);
      return null;
    } finally {
      if (accountIdRef.current === accountId) setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    accountIdRef.current = accountId;
    getBillingStatus(accountId, controller.signal)
      .then((status) => {
        if (cancelled || accountIdRef.current !== accountId) return;
        setBilling(status);
        setPro({
          active: status.active || (ALLOW_LOCAL_PRO && readPro().active),
          activatedAt: status.activeUntil,
        });
      })
      .catch(() => {
        if (cancelled || accountIdRef.current !== accountId) return;
        setBilling(null);
        setPro(readPro());
      })
      .finally(() => {
        if (!cancelled && accountIdRef.current === accountId) setLoading(false);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [accountId]);

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
