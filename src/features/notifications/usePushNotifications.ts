import { useEffect, useState } from "react";
import { apiPath, fetchWithTimeout } from "../../lib/api";

export type PushPermission = "default" | "granted" | "denied";

type PushConfig = {
  configured: boolean;
  publicKey: string | null;
  subscriptionCount: number;
};

function supported() {
  return typeof window !== "undefined"
    && "Notification" in window
    && "serviceWorker" in navigator
    && "PushManager" in window;
}

function installedAsApp() {
  if (typeof window === "undefined") return false;
  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || navigatorWithStandalone.standalone === true;
}

function appleMobileDevice() {
  if (typeof navigator === "undefined") return false;
  const platform = navigator.userAgent || navigator.platform || "";
  return /iPhone|iPad|iPod/i.test(platform)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((character) => character.charCodeAt(0)));
}

async function responseError(response: Response, fallback: string) {
  const body = await response.json().catch(() => ({})) as { error?: { message?: string } };
  return new Error(body.error?.message || fallback);
}

async function fetchPushConfig(): Promise<PushConfig> {
  const response = await fetchWithTimeout(apiPath("/api/v1/push/config"), { credentials: "include" });
  if (!response.ok) throw await responseError(response, "Device alert setup could not be checked.");
  const body = await response.json() as { data: PushConfig };
  return body.data;
}

async function registerSubscription(subscription: PushSubscription) {
  const response = await fetchWithTimeout(apiPath("/api/v1/push-subscriptions"), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription.toJSON()),
  });
  if (!response.ok) throw await responseError(response, "This device could not be registered for alerts.");
}

async function removeSubscription(endpoint: string) {
  const response = await fetchWithTimeout(apiPath("/api/v1/push-subscriptions"), {
    method: "DELETE",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint }),
  });
  if (!response.ok) throw await responseError(response, "This device could not be removed from alerts.");
}

export function usePushNotifications({
  enabled = true,
  restoreOnMount = true,
}: {
  enabled?: boolean;
  restoreOnMount?: boolean;
} = {}) {
  const isAppleMobile = appleMobileDevice();
  const installed = installedAsApp();
  const requiresHomeScreenInstall = isAppleMobile && !installed;
  const [permission, setPermission] = useState<PushPermission>(() => (
    typeof Notification === "undefined" ? "default" : Notification.permission as PushPermission
  ));
  const [providerConfigured, setProviderConfigured] = useState(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function hydrate() {
      if (!enabled) {
        setLoading(false);
        return;
      }
      try {
        const config = await fetchPushConfig();
        if (cancelled) return;
        setProviderConfigured(config.configured);
        setPublicKey(config.publicKey);
        if (!supported() || requiresHomeScreenInstall || !config.configured) return;
        const registration = await navigator.serviceWorker.ready;
        const current = await registration.pushManager.getSubscription();
        if (cancelled) return;
        setSubscribed(Boolean(current));
        if (restoreOnMount && current) await registerSubscription(current);
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Device alerts could not be checked.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void hydrate();
    return () => { cancelled = true; };
  }, [enabled, requiresHomeScreenInstall, restoreOnMount]);

  async function requestAndSubscribe() {
    if (requiresHomeScreenInstall) {
      setError("On iPhone or iPad, add RIVT to your Home Screen and open it from the app icon before enabling device alerts.");
      return;
    }
    if (!supported()) {
      setError("Device alerts are not supported in this browser.");
      return;
    }
    if (!providerConfigured || !publicKey) {
      setError("Background device alerts are temporarily unavailable.");
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await Notification.requestPermission();
      setPermission(result as PushPermission);
      if (result !== "granted") {
        setError(result === "denied"
          ? "Device alerts are blocked. Enable them in your browser or phone settings."
          : "Notification permission was not granted.");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      const subscription = existing ?? await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey).buffer as ArrayBuffer,
      });
      await registerSubscription(subscription);
      setSubscribed(true);
      setNotice("Device alerts are on for this browser.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Device alerts could not be enabled.");
    } finally {
      setBusy(false);
    }
  }

  async function sendTestNotification() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetchWithTimeout(apiPath("/api/v1/push/test"), {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) throw await responseError(response, "The test alert could not be queued.");
      const payload = await response.json() as { data?: { queued?: boolean } };
      if (!payload.data?.queued) {
        throw new Error("Account notices are off. Turn them on before sending a test alert.");
      }
      setNotice("Test alert queued. It should arrive in a few seconds.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The test alert could not be queued.");
    } finally {
      setBusy(false);
    }
  }

  async function unsubscribe() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();
        await removeSubscription(endpoint).catch(() => {});
      }
      setSubscribed(false);
      setNotice("Device alerts are off for this browser.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Device alerts could not be turned off.");
    } finally {
      setBusy(false);
    }
  }

  return {
    permission,
    providerConfigured,
    supported: supported(),
    installedAsApp: installed,
    requiresHomeScreenInstall,
    subscribed,
    busy,
    loading,
    error,
    notice,
    requestAndSubscribe,
    sendTestNotification,
    unsubscribe,
  };
}

export async function disablePushForCurrentDevice() {
  if (!supported()) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;
  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  await removeSubscription(endpoint).catch(() => {});
}
