import { useState } from "react";

const PUSH_SUB_KEY = "rivt.pushSubscription.v1";

export type PushPermission = "default" | "granted" | "denied";

function readStoredSub(): PushSubscriptionJSON | null {
  try { return JSON.parse(localStorage.getItem(PUSH_SUB_KEY) ?? "null"); } catch { return null; }
}

export function usePushNotifications() {
  const [permission, setPermission] = useState<PushPermission>(
    () => (typeof Notification !== "undefined" ? Notification.permission : "default") as PushPermission
  );
  const [subscribed, setSubscribed] = useState(() => Boolean(readStoredSub()));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function requestAndSubscribe() {
    if (typeof Notification === "undefined") {
      setError("Notifications are not supported in this browser.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await Notification.requestPermission();
      setPermission(result as PushPermission);
      if (result !== "granted") {
        setError(result === "denied" ? "Notifications blocked. Enable them in your browser settings." : "Permission not granted.");
        return;
      }

      const reg = await navigator.serviceWorker.ready;

      // Try to get VAPID public key from env (optional — subscription still works for local notifications)
      const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

      let sub: PushSubscription;
      if (vapidKey) {
        const keyBytes = urlBase64ToUint8Array(vapidKey);
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: keyBytes.buffer as ArrayBuffer,
        });

        const subJson = sub.toJSON();
        localStorage.setItem(PUSH_SUB_KEY, JSON.stringify(subJson));
      } else {
        // Without VAPID key, we can still show local notifications via service worker
        // Store a flag indicating subscription intent
        localStorage.setItem(PUSH_SUB_KEY, JSON.stringify({ local: true }));
      }
      setSubscribed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not enable notifications.");
    } finally {
      setBusy(false);
    }
  }

  async function sendTestNotification() {
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "granted") return;
    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification("RIVT", {
        body: "Notifications are working. You'll get alerts for new job matches and messages.",
        icon: "/rivt-maskable-icon-192.png",
        badge: "/rivt-favicon-192.png",
        tag: "rivt-test",
      });
    } catch {
      // fallback to Notification API directly
      new Notification("RIVT", {
        body: "Notifications are working!",
        icon: "/rivt-maskable-icon-192.png",
      });
    }
  }

  async function unsubscribe() {
    localStorage.removeItem(PUSH_SUB_KEY);
    setSubscribed(false);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
    } catch { /* noop */ }
  }

  return { permission, subscribed, busy, error, requestAndSubscribe, sendTestNotification, unsubscribe };
}

// Utility: convert base64 VAPID key to Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}
