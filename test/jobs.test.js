import assert from "node:assert/strict";
import test from "node:test";
import {
  assertPublishableJob,
  calculateMatchScore,
  mapJobRecord,
  transitionFor,
} from "../server/jobs.js";

test("job status transitions fail closed", () => {
  assert.equal(transitionFor("draft", "publish"), "open");
  assert.equal(transitionFor("open", "pause"), "paused");
  assert.equal(transitionFor("paused", "resume"), "open");
  assert.equal(transitionFor("open", "close"), "closed");
  assert.throws(() => transitionFor("closed", "resume"), /cannot be resumed/);
  assert.throws(() => transitionFor("draft", "pause"), /cannot be paused/);
});

test("publish readiness requires scope, pay, duration, public area, and private address", () => {
  const ready = {
    title: "Commercial panel rough-in",
    trade_code: "electrical",
    summary: "Help complete a commercial panel rough-in.",
    scope_description: "Install feeders, label circuits, and leave inspection-ready documentation.",
    budget_cents: 125000,
    duration_hours: 8,
    public_city: "Jacksonville",
    public_region: "FL",
    address_line1: "100 Test Street",
    private_city: "Jacksonville",
    private_region: "FL",
    postal_code: "32202",
    application_deadline: null,
  };
  assert.doesNotThrow(() => assertPublishableJob(ready));
  assert.throws(() => assertPublishableJob({ ...ready, address_line1: "" }), (error) => (
    error.code === "JOB_NOT_READY" && error.details.missing.includes("privateLocation")
  ));
});

test("public job mapping never invents or leaks a private address", () => {
  const row = {
    id: "00000000-0000-4000-8000-000000000001",
    organization_id: "00000000-0000-4000-8000-000000000002",
    organization_name: "River City Electric",
    created_by_account_id: "00000000-0000-4000-8000-000000000003",
    title: "Panel rough-in",
    trade_code: "electrical",
    trade_name: "Electrical",
    summary: "Commercial panel rough-in support.",
    scope_description: "Install feeders and label circuits.",
    status: "open",
    difficulty: "advanced",
    work_type: "side_work",
    budget_cents: 125000,
    budget_unit: "fixed",
    duration_hours: "8.00",
    preferred_start_date: null,
    application_deadline: null,
    insurance_required: true,
    public_city: "Jacksonville",
    public_region: "FL",
    public_country_code: "US",
    postal_prefix: null,
    version: 2,
    published_at: new Date(),
    paused_at: null,
    closed_at: null,
    created_at: new Date(),
    updated_at: new Date(),
    address_line1: "100 Private Street",
  };
  const actor = {
    account: { primaryRole: "tradesperson" },
    profile: { trades: [{ code: "electrical" }], serviceArea: { city: "Jacksonville", region: "FL" } },
  };
  const mapped = mapJobRecord(row, { actor });
  assert.equal(mapped.matchScore, 100);
  assert.equal("privateLocation" in mapped, false);
  assert.equal(JSON.stringify(mapped).includes("Private Street"), false);
  assert.equal(calculateMatchScore(row, actor), 100);
});
