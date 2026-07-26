import type { Role } from "../types";

export type ProductEventName =
  | "signup_started"
  | "signup_completed"
  | "onboarding_completed"
  | "first_post_created"
  | "job_posted"
  | "job_applied"
  | "tool_used"
  | "checkout_started"
  | "checkout_completed"
  | "session_start";

type AnalyticsIdentity = {
  account_id: string;
  role: Role | "pending";
};

type ProductEventProperties = Record<string, string | number | boolean | null | undefined>;

const endpoint = String(import.meta.env.VITE_PRODUCT_ANALYTICS_ENDPOINT ?? "").trim();
const writeKey = String(import.meta.env.VITE_PRODUCT_ANALYTICS_KEY ?? "").trim();
let identity: AnalyticsIdentity | null = null;

const forbiddenProperty = /(?:^|_)(?:email|phone|address|name)(?:_|$)/i;
const anonymousIdKey = "rivt.analytics.anonymous-id.v1";

export function getAnonymousAnalyticsId() {
  try {
    const existing = window.sessionStorage.getItem(anonymousIdKey);
    if (existing) return existing;
    const created = `anonymous:${crypto.randomUUID()}`;
    window.sessionStorage.setItem(anonymousIdKey, created);
    return created;
  } catch {
    return `anonymous:${crypto.randomUUID()}`;
  }
}

export function setAnalyticsIdentity(nextIdentity: AnalyticsIdentity | null) {
  identity = nextIdentity;
}

export function analyticsConfigured() {
  return Boolean(endpoint && writeKey);
}

export function sanitizedAnalyticsProperties(properties: ProductEventProperties) {
  return Object.fromEntries(
    Object.entries(properties)
      .filter(([key, value]) => !forbiddenProperty.test(key) && value !== undefined)
      .map(([key, value]) => [key, value ?? null]),
  );
}

export function trackProductEvent(name: ProductEventName, properties: ProductEventProperties = {}) {
  if (!analyticsConfigured() || !identity) return;

  void fetch(endpoint, {
    method: "POST",
    mode: "cors",
    keepalive: true,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${writeKey}`,
    },
    body: JSON.stringify({
      event: name,
      occurred_at: new Date().toISOString(),
      properties: sanitizedAnalyticsProperties({
        ...properties,
        account_id: identity.account_id,
        role: identity.role,
      }),
    }),
  }).catch(() => {
    // Product analytics must never block or alter the user workflow.
  });
}
