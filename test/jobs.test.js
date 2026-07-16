import assert from "node:assert/strict";
import test from "node:test";
import {
  assertPublishableJob,
  calculateMatchScore,
  createJobSchema,
  mapJobRecord,
  matchingJobAlertLimit,
  matchingJobAlertsEnabled,
  normalizeJobCompensation,
  transitionFor,
} from "../server/jobs.js";
import { applicationSubmitSchema } from "../server/matches.js";

test("job status transitions fail closed", () => {
  assert.equal(transitionFor("draft", "publish"), "open");
  assert.equal(transitionFor("open", "pause"), "paused");
  assert.equal(transitionFor("paused", "resume"), "open");
  assert.equal(transitionFor("open", "close"), "closed");
  assert.throws(() => transitionFor("closed", "resume"), /cannot be resumed/);
  assert.throws(() => transitionFor("draft", "pause"), /cannot be paused/);
});

test("matching job alert fan-out uses a bounded operator limit", () => {
  assert.equal(matchingJobAlertsEnabled(undefined), false);
  assert.equal(matchingJobAlertsEnabled("false"), false);
  assert.equal(matchingJobAlertsEnabled("true"), true);
  assert.equal(matchingJobAlertLimit(undefined), 200);
  assert.equal(matchingJobAlertLimit("25"), 25);
  assert.equal(matchingJobAlertLimit("5000"), 500);
  assert.equal(matchingJobAlertLimit("0"), 200);
  assert.equal(matchingJobAlertLimit("not-a-number"), 200);
});

test("publish readiness requires scope, pay, duration, public area, and private address", () => {
  const ready = {
    title: "Commercial panel rough-in",
    trade_code: "electrical",
    summary: "Help complete a commercial panel rough-in.",
    scope_description: "Install feeders, label circuits, and leave inspection-ready documentation.",
    budget_cents: 125000,
    budget_unit: "fixed",
    compensation_type: "fixed",
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
  assert.doesNotThrow(() => assertPublishableJob({
    ...ready,
    budget_cents: null,
    compensation_type: "open_to_offers",
  }));
  assert.doesNotThrow(() => assertPublishableJob({
    ...ready,
    budget_cents: null,
    compensation_type: "request_quotes",
  }));
  assert.throws(() => assertPublishableJob({
    ...ready,
    compensation_type: "hourly",
    budget_unit: "fixed",
  }), (error) => error.code === "JOB_NOT_READY" && error.details.missing.includes("compensationType"));
});

test("job compensation normalization prevents contradictory listing states", () => {
  assert.deepEqual(normalizeJobCompensation({
    compensationType: "hourly",
    budgetCents: 8500,
    budgetUnit: "fixed",
  }), {
    compensationType: "hourly",
    budgetCents: 8500,
    budgetUnit: "hourly",
  });
  assert.deepEqual(normalizeJobCompensation({
    compensationType: "request_quotes",
    budgetCents: 95000,
    budgetUnit: "hourly",
  }), {
    compensationType: "request_quotes",
    budgetCents: null,
    budgetUnit: "fixed",
  });
  assert.deepEqual(normalizeJobCompensation({
    compensationType: "open_to_offers",
    budgetCents: 95000,
    budgetUnit: "hourly",
  }), {
    compensationType: "open_to_offers",
    budgetCents: 95000,
    budgetUnit: "fixed",
  });
});

test("job compensation accepts realistic hourly rates and rejects zero-dollar proposals", () => {
  const job = createJobSchema.parse({
    organizationId: "00000000-0000-4000-8000-000000000001",
    title: "Cabinet install helper",
    tradeCode: "carpentry",
    summary: "Help install base and wall cabinets.",
    scopeDescription: "Set, level, fasten, and align the cabinet run with the lead installer.",
    budgetCents: 3500,
    budgetUnit: "hourly",
    compensationType: "hourly",
    durationHours: 8,
    publicLocation: { city: "Jacksonville", region: "FL", countryCode: "US" },
    privateLocation: null,
  });
  assert.equal(job.budgetCents, 3500);
  assert.throws(() => applicationSubmitSchema.parse({
    message: "Available for this work.",
    proposedStartDate: null,
    proposedAmountCents: 0,
    proposedUnit: "hourly",
    consentAccepted: true,
    consentVersion: "test-v1",
  }));
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
