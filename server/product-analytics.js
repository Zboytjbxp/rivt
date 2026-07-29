import { logWarn } from "./logger.js";
import { providerAbortSignal } from "./provider-safety.js";

const forbiddenProperty = /(?:^|_)(?:email|phone|address|name)(?:_|$)/i;

function config() {
  return {
    endpoint: process.env.PRODUCT_ANALYTICS_ENDPOINT?.trim() ?? "",
    writeKey: process.env.PRODUCT_ANALYTICS_KEY?.trim() ?? "",
  };
}

export function productAnalyticsConfigured() {
  const current = config();
  return Boolean(current.endpoint && current.writeKey);
}

export function sanitizeProductAnalyticsProperties(properties = {}) {
  return Object.fromEntries(
    Object.entries(properties)
      .filter(([key, value]) => !forbiddenProperty.test(key) && value !== undefined)
      .map(([key, value]) => [key, value ?? null]),
  );
}

export async function emitProductEvent(event, { accountId, role, properties = {} } = {}) {
  const current = config();
  if (!current.endpoint || !current.writeKey || !accountId || !role) return false;

  try {
    const response = await fetch(current.endpoint, {
      method: "POST",
      signal: providerAbortSignal(),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${current.writeKey}`,
      },
      body: JSON.stringify({
        event,
        occurred_at: new Date().toISOString(),
        properties: sanitizeProductAnalyticsProperties({
          ...properties,
          account_id: accountId,
          role,
        }),
      }),
    });
    if (!response.ok) throw new Error(`Analytics endpoint returned ${response.status}.`);
    return true;
  } catch (error) {
    logWarn("product_analytics.delivery_failed", {
      event,
      accountId,
      reason: error instanceof Error ? error.message : "Unknown analytics delivery error",
    });
    return false;
  }
}
