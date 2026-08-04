import { useCallback, useEffect, useRef, useState } from "react";
import { apiPath, fetchWithTimeout, RIVT_EXPECTED_ACCOUNT_HEADER } from "../../lib/api";

export type PushPermission = "default" | "granted" | "denied";

type PushConfig = {
  configured: boolean;
  publicKey: string | null;
  vapidGeneration?: string | null;
  subscriptionCount: number;
};

let pushSubscriptionMutationTail: Promise<void> = Promise.resolve();

async function serializePushSubscriptionAccess<T>(operation: () => Promise<T>): Promise<T> {
  const previous = pushSubscriptionMutationTail;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  pushSubscriptionMutationTail = previous.then(() => gate);
  await previous;
  try {
    return await operation();
  } finally {
    release();
  }
}

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

export function unsupportedDeviceAlertMessage({
  isAppleMobile,
  installedAsApp,
}: {
  isAppleMobile: boolean;
  installedAsApp: boolean;
}) {
  if (isAppleMobile && installedAsApp) {
    return "Device alerts require iOS or iPadOS 16.4 or later. Update this device if possible. In-app alerts still work.";
  }
  if (isAppleMobile) {
    return "On iPhone or iPad, add RIVT to your Home Screen before enabling device alerts.";
  }
  return "This browser does not support device alerts. In-app alerts still work.";
}

export function deviceAlertStatus({
  loading,
  subscribed,
  providerConfigured,
  browserSupported,
  requiresHomeScreenInstall,
}: {
  loading: boolean;
  subscribed: boolean;
  providerConfigured: boolean;
  browserSupported: boolean;
  requiresHomeScreenInstall: boolean;
}) {
  if (loading) return "Checking";
  if (subscribed) return "On";
  if (!providerConfigured || !browserSupported || requiresHomeScreenInstall) return "Unavailable";
  return "Off";
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((character) => character.charCodeAt(0)));
}

function subscriptionUsesPublicKey(subscription: PushSubscription, publicKey: string) {
  const applicationServerKey = subscription.options?.applicationServerKey;
  if (!applicationServerKey) return true;
  const actual = new Uint8Array(applicationServerKey);
  const expected = urlBase64ToUint8Array(publicKey);
  return actual.length === expected.length
    && actual.every((value, index) => value === expected[index]);
}

export function verifiedSubscriptionGeneration(
  subscription: PushSubscription,
  publicKey: string,
  vapidGeneration: string | null,
) {
  const applicationServerKey = subscription.options?.applicationServerKey;
  if (!applicationServerKey || !vapidGeneration) return null;
  return subscriptionUsesPublicKey(subscription, publicKey) ? vapidGeneration : null;
}

async function responseError(response: Response, fallback: string) {
  const body = await response.json().catch(() => ({})) as { error?: { message?: string } };
  return new Error(body.error?.message || fallback);
}

function accountHeaders(accountId: string, headers?: HeadersInit) {
  const next = new Headers(headers);
  next.set(RIVT_EXPECTED_ACCOUNT_HEADER, accountId);
  return next;
}

async function fetchPushConfig(accountId: string, signal?: AbortSignal): Promise<PushConfig> {
  const response = await fetchWithTimeout(apiPath("/api/v1/push/config"), {
    credentials: "include",
    headers: accountHeaders(accountId),
    signal,
  });
  if (!response.ok) throw await responseError(response, "Device alert setup could not be checked.");
  const body = await response.json() as { data: PushConfig };
  return body.data;
}

async function registerSubscription(
  accountId: string,
  subscription: PushSubscription,
  vapidGeneration: string | null,
  signal?: AbortSignal,
) {
  const response = await fetchWithTimeout(apiPath("/api/v1/push-subscriptions"), {
    method: "POST",
    credentials: "include",
    headers: accountHeaders(accountId, { "Content-Type": "application/json" }),
    body: JSON.stringify({ ...subscription.toJSON(), vapidGeneration }),
    signal,
  });
  if (!response.ok) throw await responseError(response, "This device could not be registered for alerts.");
}

async function removeSubscription(accountId: string, endpoint: string, signal?: AbortSignal) {
  const response = await fetchWithTimeout(apiPath("/api/v1/push-subscriptions"), {
    method: "DELETE",
    credentials: "include",
    headers: accountHeaders(accountId, { "Content-Type": "application/json" }),
    body: JSON.stringify({ endpoint }),
    signal,
  });
  if (!response.ok) throw await responseError(response, "This device could not be removed from alerts.");
}

async function replaceMismatchedSubscription(
  registration: ServiceWorkerRegistration,
  subscription: PushSubscription,
  publicKey: string,
  accountId: string,
  signal: AbortSignal,
  isCurrent: () => boolean,
) {
  if (subscriptionUsesPublicKey(subscription, publicKey)) return subscription;
  const previousEndpoint = subscription.endpoint;
  const previousApplicationServerKey = subscription.options?.applicationServerKey?.slice(0) ?? null;
  const unsubscribed = await subscription.unsubscribe();
  if (!isCurrent() || signal.aborted) throw new Error("ACCOUNT_CONTEXT_CHANGED");
  if (!unsubscribed) return subscription;
  await removeSubscription(accountId, previousEndpoint, signal).catch((error) => {
    if (!isCurrent() || signal.aborted) throw error;
  });
  if (!isCurrent() || signal.aborted) throw new Error("ACCOUNT_CONTEXT_CHANGED");
  try {
    const next = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey).buffer as ArrayBuffer,
    });
    if (!isCurrent() || signal.aborted) throw new Error("ACCOUNT_CONTEXT_CHANGED");
    return next;
  } catch (error) {
    if (previousApplicationServerKey && isCurrent() && !signal.aborted) {
      try {
        const restored = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: previousApplicationServerKey,
        });
        if (!isCurrent() || signal.aborted) throw new Error("ACCOUNT_CONTEXT_CHANGED", { cause: error });
        return restored;
      } catch {
        // Surface the active-key replacement failure after the continuity attempt also fails.
      }
    }
    throw error;
  }
}

export function usePushNotifications({
  accountId = null,
  enabled = true,
  restoreOnMount = true,
}: {
  accountId?: string | null;
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
  const [vapidGeneration, setVapidGeneration] = useState<string | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const accountIdRef = useRef(accountId);
  const accountEpochRef = useRef(0);
  const actionControllerRef = useRef<AbortController | null>(null);
  const actionEpochRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    accountIdRef.current = accountId;
    accountEpochRef.current += 1;
    actionControllerRef.current?.abort();
    return () => {
      mountedRef.current = false;
      accountEpochRef.current += 1;
      actionControllerRef.current?.abort();
    };
  }, [accountId]);

  const captureAccountScope = useCallback(() => {
    return { accountId, epoch: accountEpochRef.current };
  }, [accountId]);

  const accountScopeIsCurrent = useCallback((scope: { accountId: string | null; epoch: number }) => {
    return mountedRef.current
      && Boolean(scope.accountId)
      && accountIdRef.current === scope.accountId
      && accountEpochRef.current === scope.epoch;
  }, []);

  function beginAction() {
    actionControllerRef.current?.abort();
    const controller = new AbortController();
    actionControllerRef.current = controller;
    actionEpochRef.current += 1;
    return { controller, epoch: actionEpochRef.current };
  }

  function actionIsCurrent(
    scope: { accountId: string | null; epoch: number },
    action: { controller: AbortController; epoch: number },
  ) {
    return accountScopeIsCurrent(scope)
      && !action.controller.signal.aborted
      && actionControllerRef.current === action.controller
      && actionEpochRef.current === action.epoch;
  }

  useEffect(() => {
    const scope = captureAccountScope();
    const controller = new AbortController();
    let cancelled = false;
    async function hydrate() {
      if (!enabled || !scope.accountId) {
        setLoading(false);
        return;
      }
      const originAccountId = scope.accountId;
      setLoading(true);
      setError(null);
      setNotice(null);
      setSubscribed(false);
      try {
        const config = await fetchPushConfig(originAccountId, controller.signal);
        if (cancelled || !accountScopeIsCurrent(scope)) return;
        setProviderConfigured(config.configured);
        setPublicKey(config.publicKey);
        setVapidGeneration(config.vapidGeneration ?? null);
        if (!supported() || requiresHomeScreenInstall || !config.configured) return;
        const registration = await navigator.serviceWorker.ready;
        if (cancelled || !accountScopeIsCurrent(scope)) return;
        const current = await serializePushSubscriptionAccess(async () => {
          if (cancelled || !accountScopeIsCurrent(scope)) throw new Error("ACCOUNT_CONTEXT_CHANGED");
          let subscription = await registration.pushManager.getSubscription();
          if (cancelled || !accountScopeIsCurrent(scope)) throw new Error("ACCOUNT_CONTEXT_CHANGED");
          if (restoreOnMount && subscription && config.publicKey) {
            subscription = await replaceMismatchedSubscription(
              registration,
              subscription,
              config.publicKey,
              originAccountId,
              controller.signal,
              () => !cancelled && accountScopeIsCurrent(scope),
            );
          }
          if (cancelled || !accountScopeIsCurrent(scope)) throw new Error("ACCOUNT_CONTEXT_CHANGED");
          if (restoreOnMount && subscription && config.publicKey) {
            await registerSubscription(
              originAccountId,
              subscription,
              verifiedSubscriptionGeneration(subscription, config.publicKey, config.vapidGeneration ?? null),
              controller.signal,
            );
          }
          return subscription;
        });
        if (cancelled || !accountScopeIsCurrent(scope)) return;
        setSubscribed(Boolean(current));
      } catch (caught) {
        if (!cancelled && accountScopeIsCurrent(scope)) {
          setError(caught instanceof Error ? caught.message : "Device alerts could not be checked.");
        }
      } finally {
        if (!cancelled && accountScopeIsCurrent(scope)) setLoading(false);
      }
    }
    void hydrate();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [accountId, accountScopeIsCurrent, captureAccountScope, enabled, requiresHomeScreenInstall, restoreOnMount]);

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
    const scope = captureAccountScope();
    if (!scope.accountId) return;
    const originAccountId = scope.accountId;
    const action = beginAction();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await Notification.requestPermission();
      if (!actionIsCurrent(scope, action)) return;
      setPermission(result as PushPermission);
      if (result !== "granted") {
        setError(result === "denied"
          ? "Device alerts are blocked. Enable them in your browser or phone settings."
          : "Notification permission was not granted.");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      if (!actionIsCurrent(scope, action)) return;
      await serializePushSubscriptionAccess(async () => {
        if (!actionIsCurrent(scope, action)) throw new Error("ACCOUNT_CONTEXT_CHANGED");
        let existing = await registration.pushManager.getSubscription();
        if (!actionIsCurrent(scope, action)) throw new Error("ACCOUNT_CONTEXT_CHANGED");
        if (existing) {
          existing = await replaceMismatchedSubscription(
            registration,
            existing,
            publicKey,
            originAccountId,
            action.controller.signal,
            () => actionIsCurrent(scope, action),
          );
        }
        const subscription = existing ?? await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey).buffer as ArrayBuffer,
        });
        if (!actionIsCurrent(scope, action)) throw new Error("ACCOUNT_CONTEXT_CHANGED");
        await registerSubscription(
          originAccountId,
          subscription,
          verifiedSubscriptionGeneration(subscription, publicKey, vapidGeneration),
          action.controller.signal,
        );
      });
      if (!actionIsCurrent(scope, action)) return;
      setSubscribed(true);
      setNotice("Device alerts are on for this browser.");
    } catch (caught) {
      if (!actionIsCurrent(scope, action)) return;
      setError(caught instanceof Error ? caught.message : "Device alerts could not be enabled.");
    } finally {
      if (actionIsCurrent(scope, action)) setBusy(false);
      if (actionControllerRef.current === action.controller) actionControllerRef.current = null;
    }
  }

  async function sendTestNotification() {
    const scope = captureAccountScope();
    if (!scope.accountId) return;
    const originAccountId = scope.accountId;
    const action = beginAction();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetchWithTimeout(apiPath("/api/v1/push/test"), {
        method: "POST",
        credentials: "include",
        headers: accountHeaders(originAccountId),
        signal: action.controller.signal,
      });
      if (!actionIsCurrent(scope, action)) return;
      if (!response.ok) throw await responseError(response, "The test alert could not be queued.");
      const payload = await response.json() as { data?: { queued?: boolean } };
      if (!actionIsCurrent(scope, action)) return;
      if (!payload.data?.queued) {
        throw new Error("Account notices are off. Turn them on before sending a test alert.");
      }
      setNotice("Test alert queued. It should arrive in a few seconds.");
    } catch (caught) {
      if (!actionIsCurrent(scope, action)) return;
      setError(caught instanceof Error ? caught.message : "The test alert could not be queued.");
    } finally {
      if (actionIsCurrent(scope, action)) setBusy(false);
      if (actionControllerRef.current === action.controller) actionControllerRef.current = null;
    }
  }

  async function unsubscribe() {
    const scope = captureAccountScope();
    if (!scope.accountId) return;
    const originAccountId = scope.accountId;
    const action = beginAction();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const registration = await navigator.serviceWorker.ready;
      if (!actionIsCurrent(scope, action)) return;
      await serializePushSubscriptionAccess(async () => {
        if (!actionIsCurrent(scope, action)) throw new Error("ACCOUNT_CONTEXT_CHANGED");
        const subscription = await registration.pushManager.getSubscription();
        if (!actionIsCurrent(scope, action)) throw new Error("ACCOUNT_CONTEXT_CHANGED");
        if (subscription) {
          const endpoint = subscription.endpoint;
          await subscription.unsubscribe();
          if (!actionIsCurrent(scope, action)) throw new Error("ACCOUNT_CONTEXT_CHANGED");
          await removeSubscription(originAccountId, endpoint, action.controller.signal);
        }
      });
      if (!actionIsCurrent(scope, action)) return;
      setSubscribed(false);
      setNotice("Device alerts are off for this browser.");
    } catch (caught) {
      if (!actionIsCurrent(scope, action)) return;
      setError(caught instanceof Error ? caught.message : "Device alerts could not be turned off.");
    } finally {
      if (actionIsCurrent(scope, action)) setBusy(false);
      if (actionControllerRef.current === action.controller) actionControllerRef.current = null;
    }
  }

  return {
    isAppleMobile,
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

export async function disablePushForCurrentDevice(accountId: string) {
  if (!supported()) return;
  const registration = await navigator.serviceWorker.ready;
  await serializePushSubscriptionAccess(async () => {
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;
    const endpoint = subscription.endpoint;
    await subscription.unsubscribe();
    await removeSubscription(accountId, endpoint).catch(() => {});
  });
}
