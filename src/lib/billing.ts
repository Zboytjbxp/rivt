import { apiPath, RivtApiError, type ApiErrorBody } from "./api";

export interface BillingStatus {
  active: boolean;
  plan: "free" | "pro";
  status: string;
  source: "stripe";
  activeUntil: string | null;
  cancelAtPeriodEnd: boolean;
  stripeSubscriptionId: string | null;
  provider: {
    checkoutConfigured: boolean;
    webhookConfigured: boolean;
    portalConfigured: boolean;
    missing: string[];
  };
}

export class BillingApiError extends RivtApiError {
  constructor(status: number, body: ApiErrorBody) {
    super(status, body, "RIVT could not complete the billing request.");
    this.name = "BillingApiError";
  }
}

async function billingRequest<T>(path: string, options: RequestInit = {}) {
  const response = await fetch(apiPath(path), { credentials: "include", ...options });
  const body = await response.json().catch(() => ({})) as ApiErrorBody & T;
  if (!response.ok) throw new BillingApiError(response.status, body);
  return body;
}

export async function getBillingStatus() {
  const body = await billingRequest<{ data: { billing: BillingStatus } }>("/api/v1/billing/status");
  return body.data.billing;
}

export async function startStripeCheckout() {
  const body = await billingRequest<{ data: { url: string; sessionId: string } }>("/api/v1/billing/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  return body.data;
}

export async function startBillingPortal() {
  const body = await billingRequest<{ data: { url: string } }>("/api/v1/billing/portal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  return body.data;
}

export async function cancelSubscription() {
  const body = await billingRequest<{ data: { billing: BillingStatus; changed: boolean; subscriptionId: string } }>(
    "/api/v1/billing/subscription/cancel",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": crypto.randomUUID(),
      },
      body: "{}",
    },
  );
  return body.data;
}

export async function resumeSubscription() {
  const body = await billingRequest<{ data: { billing: BillingStatus; changed: boolean; subscriptionId: string } }>(
    "/api/v1/billing/subscription/resume",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": crypto.randomUUID(),
      },
      body: "{}",
    },
  );
  return body.data;
}
