import assert from "node:assert/strict";
import test from "node:test";

import {
  productAnalyticsConfigured,
  sanitizeProductAnalyticsProperties,
} from "../server/product-analytics.js";

test("product analytics is disabled without a configured endpoint and key", () => {
  const previousEndpoint = process.env.PRODUCT_ANALYTICS_ENDPOINT;
  const previousKey = process.env.PRODUCT_ANALYTICS_KEY;
  delete process.env.PRODUCT_ANALYTICS_ENDPOINT;
  delete process.env.PRODUCT_ANALYTICS_KEY;
  assert.equal(productAnalyticsConfigured(), false);
  if (previousEndpoint === undefined) delete process.env.PRODUCT_ANALYTICS_ENDPOINT;
  else process.env.PRODUCT_ANALYTICS_ENDPOINT = previousEndpoint;
  if (previousKey === undefined) delete process.env.PRODUCT_ANALYTICS_KEY;
  else process.env.PRODUCT_ANALYTICS_KEY = previousKey;
});

test("product analytics removes direct PII properties", () => {
  assert.deepEqual(
    sanitizeProductAnalyticsProperties({
      account_id: "account-1",
      role: "contractor",
      email: "person@example.com",
      phone_number: "5555555555",
      street_address: "123 Main",
      display_name: "Person",
      tool: "invoice",
    }),
    {
      account_id: "account-1",
      role: "contractor",
      tool: "invoice",
    },
  );
});
