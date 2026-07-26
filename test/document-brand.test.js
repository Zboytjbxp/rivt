import assert from "node:assert/strict";
import test from "node:test";
import { documentBrandInputSchema } from "../server/document-brand.js";

test("document branding accepts bounded customer-facing identity and styles", () => {
  const parsed = documentBrandInputSchema.parse({
    businessName: "River City Electrical",
    businessEmail: "office@example.com",
    businessPhone: "(904) 555-0100",
    businessAddress: "Jacksonville, FL",
    website: "https://example.com",
    licenseNumber: "EC-12345",
    estimateStyle: "compact",
    invoiceStyle: "field",
    showContact: true,
    showAddress: false,
    showLicense: true,
  });
  assert.equal(parsed.businessName, "River City Electrical");
  assert.equal(parsed.estimateStyle, "compact");
  assert.equal(parsed.invoiceStyle, "field");
});

test("document branding rejects invalid email, website, and unknown styles", () => {
  assert.equal(documentBrandInputSchema.safeParse({
    businessName: "River City Electrical",
    businessEmail: "not-an-email",
    website: "example.com",
    estimateStyle: "loud",
    invoiceStyle: "classic",
  }).success, false);
});

test("document branding allows optional contact fields to stay empty", () => {
  const parsed = documentBrandInputSchema.parse({
    businessName: "Solo Tradesperson",
    businessEmail: "",
    website: "",
  });
  assert.equal(parsed.businessEmail, "");
  assert.equal(parsed.website, "");
  assert.equal(parsed.estimateStyle, "classic");
  assert.equal(parsed.invoiceStyle, "classic");
});
