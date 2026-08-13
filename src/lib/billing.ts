import {
  makeRequest,
  RIVT_EXPECTED_ACCOUNT_HEADER,
  RivtApiError,
  type ApiErrorBody,
} from "./api";

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

const billingRequest = makeRequest((status, body) => new BillingApiError(status, body));

function accountBoundOptions(accountId: string, options: RequestInit = {}): RequestInit {
  const headers = new Headers(options.headers);
  headers.set(RIVT_EXPECTED_ACCOUNT_HEADER, accountId);
  return { ...options, headers };
}

export async function getBillingStatus(accountId: string, signal?: AbortSignal) {
  const body = await billingRequest<{ data: { billing: BillingStatus } }>(
    "/api/v1/billing/status",
    accountBoundOptions(accountId, { signal }),
  );
  return body.data.billing;
}

export async function startStripeCheckout(accountId: string, signal?: AbortSignal) {
  const body = await billingRequest<{ data: { url: string; sessionId: string } }>("/api/v1/billing/checkout", {
    method: "POST",
    ...accountBoundOptions(accountId, {
      signal,
      headers: { "Content-Type": "application/json" },
    }),
    body: "{}",
  });
  return body.data;
}

export async function startBillingPortal(accountId: string, signal?: AbortSignal) {
  const body = await billingRequest<{ data: { url: string } }>("/api/v1/billing/portal", {
    method: "POST",
    ...accountBoundOptions(accountId, {
      signal,
      headers: { "Content-Type": "application/json" },
    }),
    body: "{}",
  });
  return body.data;
}

export async function reconcileStripeCheckout(accountId: string, sessionId: string, signal?: AbortSignal) {
  const body = await billingRequest<{ data: { billing: BillingStatus; reconciled: boolean; sessionId: string } }>(
    "/api/v1/billing/reconcile",
    accountBoundOptions(accountId, {
      method: "POST",
      signal,
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify({ sessionId }),
    }),
  );
  return body.data;
}

export async function cancelSubscription(accountId: string, signal?: AbortSignal) {
  const body = await billingRequest<{ data: { billing: BillingStatus; changed: boolean; subscriptionId: string } }>(
    "/api/v1/billing/subscription/cancel",
    accountBoundOptions(accountId, {
      method: "POST",
      signal,
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": crypto.randomUUID(),
      },
      body: "{}",
    }),
  );
  return body.data;
}

export async function resumeSubscription(accountId: string, signal?: AbortSignal) {
  const body = await billingRequest<{ data: { billing: BillingStatus; changed: boolean; subscriptionId: string } }>(
    "/api/v1/billing/subscription/resume",
    accountBoundOptions(accountId, {
      method: "POST",
      signal,
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": crypto.randomUUID(),
      },
      body: "{}",
    }),
  );
  return body.data;
}
