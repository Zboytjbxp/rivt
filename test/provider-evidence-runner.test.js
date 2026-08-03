import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  compiledProviderAdapters,
  evaluateRepositoryReadiness,
  evidenceRunnerExitCode,
  parseEvidencePlanSecret,
  runEvidenceVerification,
  runProviderEvidenceGate,
  validateEvidencePlan,
  validateEvidenceRunnerArguments,
  verifyGitHubIncidentRehearsalEvidence,
  verifyGitHubProductionSyntheticEvidence,
  verifyRailwayStripeDisabledPaymentEvidence,
  verifySentryErrorIngestionEvidence,
} from "../scripts/provider-evidence-runner.js";
import {
  providerEvidenceIdentity,
  repositoryEvidenceSha256,
} from "../scripts/repository-evidence.js";
import { stripeConnectRuntimeProof } from "../server/stripe-connect.js";

const now = new Date("2026-08-01T12:00:00.000Z");
const sourceCommit = "a".repeat(40);
const scope = Object.freeze({
  account: "rivt-account",
  environment: "production",
  project: "rivt-project",
  resource: "production-synthetic-workflow",
});
const incidentRehearsalWorkflow = fs.readFileSync(
  path.join(process.cwd(), ".github", "workflows", "incident-rehearsal.yml"),
  "utf8",
);
const liveGateASmokeSource = fs.readFileSync(
  path.join(process.cwd(), "scripts", "live-gate-a-hardening.js"),
  "utf8",
);

function countIncidentRehearsalStep(name) {
  return [...incidentRehearsalWorkflow.matchAll(/^\s{6}- name: (.+)$/gmu)]
    .filter((match) => match[1] === name)
    .length;
}

function createFixture({
  controlId = "github-production-synthetic",
  provider = "github-actions",
  timestamp = "2026-08-01T11:59:00.000Z",
} = {}) {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "rivt-evidence-runner-"));
  const evidencePath = `evidence/${controlId}.json`;
  fs.mkdirSync(path.join(rootDir, "evidence"));
  const receipt = {
    schemaVersion: 1,
    controlId,
    type: "synthetic-monitor-delivery-test",
    provider,
    status: "passed",
    timestamp,
    category: "synthetic_monitor",
    configuredProvider: "GitHub Actions",
    route: "Production synthetic incident route",
    frequency: "30 minutes",
  };
  const serializedReceipt = `${JSON.stringify(receipt, null, 2)}\n`;
  fs.writeFileSync(path.join(rootDir, evidencePath), serializedReceipt, "utf8");
  const evidenceSha256 = repositoryEvidenceSha256(serializedReceipt);
  const claim = {
    adapterId: "github-production-synthetic",
    controlId,
    evidencePath,
    evidenceSha256,
    expectedReceipt: receipt,
    provider,
    scope: { ...scope },
    type: receipt.type,
  };
  const plan = { schemaVersion: 1, claims: [claim] };
  return { claim, evidenceSha256, plan, receipt, rootDir };
}

function verifiedAdapter(proofId = "b".repeat(64)) {
  return {
    allowedProviders: ["github-actions"],
    allowedReceiptTypes: ["synthetic-monitor-delivery-test"],
    requiredCredentials: ["RIVT_EVIDENCE_GITHUB_TOKEN"],
    async verify({ claim }) {
      return {
        observedAt: "2026-08-01T11:59:30.000Z",
        proofId,
        provider: claim.provider,
        receiptSha256: claim.evidenceSha256,
        scope: { ...claim.scope },
        status: "verified",
      };
    },
  };
}

function runFixture(fixture, overrides = {}) {
  return runEvidenceVerification({
    adapters: { "github-production-synthetic": verifiedAdapter() },
    credentials: { RIVT_EVIDENCE_GITHUB_TOKEN: "test-only-secret" },
    expectedLiveCommit: sourceCommit,
    now,
    plan: fixture.plan,
    rootDir: fixture.rootDir,
    sourceCommit,
    ...overrides,
  });
}

function jsonResponse(payload, { ok = true, status = ok ? 200 : 500 } = {}) {
  const serialized = JSON.stringify(payload);
  return {
    headers: { get: (name) => (name.toLowerCase() === "content-length" ? String(serialized.length) : null) },
    ok,
    status,
    async text() { return serialized; },
  };
}

function routedFetch(routes, calls = []) {
  return async (input, init = {}) => {
    const url = input instanceof URL ? input : new URL(input);
    calls.push({ url, init });
    const route = routes.find((candidate) => (
      candidate.method === (init.method ?? "GET")
      && candidate.match(url, init)
    ));
    if (!route) return jsonResponse({ error: "not found" }, { ok: false, status: 404 });
    return jsonResponse(typeof route.payload === "function" ? route.payload(url, init) : route.payload);
  };
}

function providerContext({ claim, credentials, receipt, observedNow = now } = {}) {
  return {
    claim,
    credentials,
    now: observedNow,
    receipt,
    sourceCommit,
  };
}

test("evidence verification authorizes one exact in-memory identity", async () => {
  const fixture = createFixture();
  try {
    const originalPlan = structuredClone(fixture.plan);
    const result = await runFixture(fixture);
    assert.equal(result.ok, true);
    assert.deepEqual(fixture.plan, originalPlan);
    assert.equal(result.report.controls[0].status, "verified");
    assert.equal(result.externallyVerifiedEvidence.size, 1);
    assert.equal(result.externallyVerifiedEvidence.has(providerEvidenceIdentity({
      controlId: fixture.claim.controlId,
      provider: fixture.claim.provider,
      sha256: fixture.evidenceSha256,
    })), true);
    assert.equal(JSON.stringify(result.report).includes("\u0000"), false);
    assert.equal(Object.hasOwn(result.report, "externallyVerifiedEvidence"), false);
  } finally {
    fs.rmSync(fixture.rootDir, { recursive: true, force: true });
  }
});

test("the compiled registry supports only adapters with provider-verifiable contracts", async () => {
  for (const adapterId of [
    "incident-rehearsal",
    "github-production-synthetic",
    "sentry-error-ingestion",
    "railway-stripe-disabled-payment",
  ]) {
    assert.equal(typeof compiledProviderAdapters[adapterId].verify, "function", adapterId);
  }
  const unsupportedReasons = {
    "sentry-paging-delivery": "PROVIDER_DELIVERY_NOT_OBSERVABLE",
    "private-route-delivery": "PRIVATE_ROUTE_PROVIDER_REQUIRED",
    "backup-schedule": "BACKUP_PROVIDER_SELECTION_REQUIRED",
    "backup-completion": "BACKUP_PROVIDER_SELECTION_REQUIRED",
    "backup-alert-delivery": "BACKUP_ALERT_DELIVERY_SEAM_REQUIRED",
    "backup-retention": "BACKUP_PROVIDER_SELECTION_REQUIRED",
    "backup-failure-domain": "BACKUP_FAILURE_DOMAIN_PROOF_REQUIRED",
    "backup-restore": "BACKUP_RESTORE_PROOF_SEAM_REQUIRED",
  };
  for (const [adapterId, reasonCode] of Object.entries(unsupportedReasons)) {
    const result = await compiledProviderAdapters[adapterId].verify({});
    assert.deepEqual(result, {
      status: "unsupported",
      reasonCode,
    }, adapterId);
  }
});

test("incident rehearsal adapter binds one protected-branch workflow-dispatch run and its critical steps", async () => {
  const receipt = {
    schemaVersion: 1,
    controlId: "rehearsal-2026-08-01",
    type: "incident-rehearsal-test",
    provider: "github-actions",
    status: "passed",
    timestamp: "2026-08-01T11:59:00.000Z",
    scenario: "public-health-provider-failure",
    commanderRoleId: "incident-commander",
  };
  const claim = {
    provider: receipt.provider,
    evidenceSha256: "4".repeat(64),
    scope: {
      account: "rivt-owner",
      environment: "master",
      project: "rivt",
      resource: "workflow:4321:run:9912",
    },
  };
  const repository = { full_name: "rivt-owner/rivt", default_branch: "master" };
  const branch = { name: "master", protected: true };
  const workflow = {
    id: 4321,
    name: "Production Incident Rehearsal",
    path: ".github/workflows/incident-rehearsal.yml",
    state: "active",
  };
  const run = {
    id: 9912,
    workflow_id: 4321,
    event: "workflow_dispatch",
    status: "completed",
    conclusion: "success",
    display_title: "Incident rehearsal: public-health-provider-failure / incident-commander",
    head_sha: sourceCommit,
    head_branch: "master",
    created_at: "2026-08-01T11:50:00.000Z",
    updated_at: receipt.timestamp,
    head_repository: { full_name: "rivt-owner/rivt" },
  };
  const successfulStep = (name, number) => ({
    name,
    number,
    status: "completed",
    conclusion: "success",
  });
  const job = {
    id: 7001,
    run_id: 9912,
    head_sha: sourceCommit,
    name: "rehearsal",
    status: "completed",
    conclusion: "success",
    steps: [
      successfulStep("Check out source", 1),
      successfulStep("Check production health", 2),
      successfulStep("Run production monitor", 3),
      successfulStep("Run live Gate A smoke", 4),
      successfulStep("Verify incident evidence", 5),
      { name: "Post cache cleanup", number: 6, status: "completed", conclusion: "skipped" },
    ],
  };
  const jobsPayload = { total_count: 1, jobs: [job] };
  const calls = [];
  const fetchFunction = routedFetch([
    { method: "GET", match: (url) => url.pathname === "/repos/rivt-owner/rivt", payload: repository },
    { method: "GET", match: (url) => url.pathname.endsWith("/branches/master"), payload: branch },
    { method: "GET", match: (url) => url.pathname.endsWith("/actions/workflows/4321"), payload: workflow },
    { method: "GET", match: (url) => url.pathname.endsWith("/actions/runs/9912"), payload: run },
    {
      method: "GET",
      match: (url) => url.pathname.endsWith("/actions/runs/9912/jobs"),
      payload: jobsPayload,
    },
  ], calls);
  const context = providerContext({
    claim,
    credentials: { RIVT_EVIDENCE_GITHUB_TOKEN: "github-secret" },
    receipt,
  });
  const result = await verifyGitHubIncidentRehearsalEvidence(context, { fetchFunction });
  assert.equal(result.status, "verified", JSON.stringify(result));
  assert.equal(calls.length, 5);
  assert.equal(calls.every(({ url }) => url.origin === "https://api.github.com"), true);
  assert.equal(calls.every(({ init }) => (init.method ?? "GET") === "GET"), true);
  assert.equal(calls.every(({ init }) => init.redirect === "error"), true);
  const jobsCall = calls.find(({ url }) => url.pathname.endsWith("/jobs"));
  assert.equal(jobsCall.url.searchParams.get("filter"), "all");
  assert.equal(jobsCall.url.searchParams.get("per_page"), "100");
  assert.equal(JSON.stringify(result).includes("github-secret"), false);

  branch.protected = false;
  const unprotected = await verifyGitHubIncidentRehearsalEvidence(context, { fetchFunction });
  assert.equal(unprotected.reasonCode, "PROVIDER_BINDING_MISMATCH");
  branch.protected = true;

  run.event = "schedule";
  const scheduled = await verifyGitHubIncidentRehearsalEvidence(context, { fetchFunction });
  assert.equal(scheduled.reasonCode, "PROVIDER_BINDING_MISMATCH");
  run.event = "workflow_dispatch";

  run.display_title = "Incident rehearsal: storage-failure / incident-commander";
  const wrongScenario = await verifyGitHubIncidentRehearsalEvidence(context, { fetchFunction });
  assert.equal(wrongScenario.reasonCode, "PROVIDER_BINDING_MISMATCH");
  run.display_title = "Incident rehearsal: public-health-provider-failure / backup-commander";
  const wrongCommander = await verifyGitHubIncidentRehearsalEvidence(
    context,
    { fetchFunction },
  );
  assert.equal(wrongCommander.reasonCode, "PROVIDER_BINDING_MISMATCH");
  run.display_title = "Incident rehearsal: public-health-provider-failure / incident-commander";

  jobsPayload.total_count = 2;
  const multipleJobs = await verifyGitHubIncidentRehearsalEvidence(context, { fetchFunction });
  assert.equal(multipleJobs.reasonCode, "PROVIDER_BINDING_MISMATCH");
  jobsPayload.total_count = 1;

  job.steps[3].conclusion = "failure";
  const failedCriticalStep = await verifyGitHubIncidentRehearsalEvidence(
    context,
    { fetchFunction },
  );
  assert.equal(failedCriticalStep.reasonCode, "PROVIDER_OBSERVATION_MISMATCH");
  job.steps[3].conclusion = "success";

  job.steps.push({
    name: "Unexpected unfinished setup",
    number: 7,
    status: "completed",
    conclusion: "skipped",
  });
  const skippedNonPostStep = await verifyGitHubIncidentRehearsalEvidence(
    context,
    { fetchFunction },
  );
  assert.equal(skippedNonPostStep.reasonCode, "PROVIDER_OBSERVATION_MISMATCH");
  job.steps.pop();

  run.updated_at = "2026-08-01T10:00:00.000Z";
  receipt.timestamp = run.updated_at;
  const stale = await verifyGitHubIncidentRehearsalEvidence(context, { fetchFunction });
  assert.equal(stale.reasonCode, "PROVIDER_BINDING_MISMATCH");
});

test("GitHub adapter binds a protected default-branch run to one bot-owned recovery delivery", async () => {
  const receipt = {
    schemaVersion: 1,
    controlId: "github-production-synthetic",
    type: "synthetic-monitor-delivery-test",
    provider: "github-actions",
    status: "passed",
    timestamp: "2026-08-01T11:59:00.000Z",
    category: "synthetic_monitor",
    configuredProvider: "GitHub Actions",
    route: "GitHub issue: Production synthetic check failing",
    frequency: "30 minutes",
  };
  const claim = {
    provider: receipt.provider,
    evidenceSha256: "1".repeat(64),
    scope: {
      account: "rivt-owner",
      environment: "master",
      project: "rivt",
      resource: "workflow:1234:issue:77",
    },
  };
  const runUrl = "https://github.com/rivt-owner/rivt/actions/runs/9001";
  const github = {
    repository: { full_name: "rivt-owner/rivt", default_branch: "master" },
    branch: { name: "master", protected: true },
    workflow: {
      id: 1234,
      name: "Production Synthetic Check",
      path: ".github/workflows/production-synthetic.yml",
      state: "active",
    },
    runs: {
      workflow_runs: [{
        id: 9001,
        workflow_id: 1234,
        conclusion: "success",
        status: "completed",
        event: "workflow_dispatch",
        head_sha: sourceCommit,
        head_branch: "master",
        created_at: "2026-08-01T11:58:00.000Z",
        updated_at: "2026-08-01T11:59:30.000Z",
        head_repository: { full_name: "rivt-owner/rivt" },
      }],
    },
    issue: {
      number: 77,
      title: "Production synthetic check failing",
      state: "closed",
      state_reason: "completed",
      body: "<!-- rivt-production-synthetic-incident -->\nSanitized incident.",
      user: { login: "github-actions[bot]", type: "Bot" },
    },
    comments: [{
      id: 501,
      body: `Synthetic check recovered and passed: ${runUrl}`,
      created_at: receipt.timestamp,
      user: { login: "github-actions[bot]", type: "Bot" },
    }],
  };
  const calls = [];
  const fetchFunction = routedFetch([
    { method: "GET", match: (url) => url.pathname === "/repos/rivt-owner/rivt", payload: github.repository },
    { method: "GET", match: (url) => url.pathname.endsWith("/branches/master"), payload: github.branch },
    { method: "GET", match: (url) => url.pathname.endsWith("/actions/workflows/1234"), payload: github.workflow },
    { method: "GET", match: (url) => url.pathname.endsWith("/actions/workflows/1234/runs"), payload: github.runs },
    { method: "GET", match: (url) => url.pathname.endsWith("/issues/77"), payload: github.issue },
    { method: "GET", match: (url) => url.pathname.endsWith("/issues/77/comments"), payload: github.comments },
    { method: "GET", match: (url) => url.pathname.endsWith("/issues"), payload: [] },
  ], calls);
  const context = providerContext({
    claim,
    credentials: { RIVT_EVIDENCE_GITHUB_TOKEN: "github-secret" },
    receipt,
  });
  const result = await verifyGitHubProductionSyntheticEvidence(context, { fetchFunction });
  assert.equal(result.status, "verified", JSON.stringify(result));
  assert.equal(calls.length, 7);
  assert.equal(calls.every(({ url }) => url.origin === "https://api.github.com"), true);
  assert.equal(calls.every(({ init }) => init.redirect === "error"), true);
  assert.equal(JSON.stringify(result).includes("github-secret"), false);

  github.branch.protected = false;
  const unprotected = await verifyGitHubProductionSyntheticEvidence(context, { fetchFunction });
  assert.deepEqual(unprotected, {
    status: "failed",
    reasonCode: "PROVIDER_BINDING_MISMATCH",
  });
  github.branch.protected = true;
  github.runs.workflow_runs[0].event = "pull_request";
  const pullRequestRun = await verifyGitHubProductionSyntheticEvidence(
    context,
    { fetchFunction },
  );
  assert.equal(pullRequestRun.reasonCode, "PROVIDER_OBSERVATION_MISMATCH");

  github.runs.workflow_runs[0].event = "workflow_dispatch";
  github.issue.body = `lookalike\n<!-- rivt-production-synthetic-incident -->`;
  const lookalikeMarker = await verifyGitHubProductionSyntheticEvidence(
    context,
    { fetchFunction },
  );
  assert.equal(lookalikeMarker.reasonCode, "PROVIDER_BINDING_MISMATCH");
});

test("GitHub adapter rejects stale or superseded synthetic state and an open owned incident", async () => {
  const receipt = {
    schemaVersion: 1,
    controlId: "github-production-synthetic",
    type: "synthetic-monitor-delivery-test",
    provider: "github-actions",
    status: "passed",
    timestamp: "2026-08-01T11:40:00.000Z",
    category: "synthetic_monitor",
    configuredProvider: "GitHub Actions",
    route: "GitHub issue: Production synthetic check failing",
    frequency: "30 minutes",
  };
  const claim = {
    provider: receipt.provider,
    evidenceSha256: "1".repeat(64),
    scope: {
      account: "rivt-owner",
      environment: "master",
      project: "rivt",
      resource: "workflow:1234:issue:77",
    },
  };
  const successfulRun = {
    id: 9001,
    workflow_id: 1234,
    conclusion: "success",
    status: "completed",
    event: "schedule",
    head_sha: sourceCommit,
    head_branch: "master",
    created_at: "2026-08-01T11:39:00.000Z",
    updated_at: "2026-08-01T11:41:00.000Z",
    head_repository: { full_name: "rivt-owner/rivt" },
  };
  const latestRun = {
    ...successfulRun,
    id: 9002,
    conclusion: "failure",
    created_at: "2026-08-01T11:50:00.000Z",
    updated_at: "2026-08-01T11:51:00.000Z",
  };
  const repository = { full_name: "rivt-owner/rivt", default_branch: "master" };
  const branch = { name: "master", protected: true };
  const workflow = {
    id: 1234,
    name: "Production Synthetic Check",
    path: ".github/workflows/production-synthetic.yml",
    state: "active",
  };
  const issue = {
    number: 77,
    title: "Production synthetic check failing",
    state: "closed",
    state_reason: "completed",
    body: "<!-- rivt-production-synthetic-incident -->",
    user: { login: "github-actions[bot]", type: "Bot" },
  };
  const comments = [{
    id: 501,
    body: "Synthetic check recovered and passed: https://github.com/rivt-owner/rivt/actions/runs/9001",
    created_at: receipt.timestamp,
    user: { login: "github-actions[bot]", type: "Bot" },
  }];
  const openIncidents = [];
  const fetchFunction = routedFetch([
    { method: "GET", match: (url) => url.pathname === "/repos/rivt-owner/rivt", payload: repository },
    { method: "GET", match: (url) => url.pathname.endsWith("/branches/master"), payload: branch },
    { method: "GET", match: (url) => url.pathname.endsWith("/actions/workflows/1234"), payload: workflow },
    { method: "GET", match: (url) => url.pathname.endsWith("/actions/workflows/1234/runs"), payload: () => ({ workflow_runs: [latestRun, successfulRun] }) },
    { method: "GET", match: (url) => url.pathname.endsWith("/issues/77"), payload: issue },
    { method: "GET", match: (url) => url.pathname.endsWith("/issues/77/comments"), payload: comments },
    { method: "GET", match: (url) => url.pathname.endsWith("/issues"), payload: () => openIncidents },
  ]);
  const context = providerContext({
    claim,
    credentials: { RIVT_EVIDENCE_GITHUB_TOKEN: "github-secret" },
    receipt,
  });

  const newerFailure = await verifyGitHubProductionSyntheticEvidence(context, { fetchFunction });
  assert.equal(newerFailure.reasonCode, "PROVIDER_OBSERVATION_MISMATCH");

  latestRun.conclusion = "success";
  latestRun.updated_at = "2026-08-01T10:00:00.000Z";
  latestRun.created_at = "2026-08-01T09:59:00.000Z";
  successfulRun.updated_at = "2026-08-01T10:01:00.000Z";
  successfulRun.created_at = "2026-08-01T10:00:00.000Z";
  const stale = await verifyGitHubProductionSyntheticEvidence(context, { fetchFunction });
  assert.equal(stale.reasonCode, "PROVIDER_OBSERVATION_MISMATCH");

  latestRun.created_at = "2026-08-01T11:50:00.000Z";
  latestRun.updated_at = "2026-08-01T11:51:00.000Z";
  successfulRun.created_at = "2026-08-01T11:39:00.000Z";
  successfulRun.updated_at = "2026-08-01T11:41:00.000Z";
  openIncidents.push({
    ...issue,
    number: 88,
    state: "open",
  });
  const openIncident = await verifyGitHubProductionSyntheticEvidence(context, { fetchFunction });
  assert.equal(openIncident.reasonCode, "PROVIDER_OBSERVATION_MISMATCH");
});

test("Sentry adapter binds one indexed RIVT error event to project, environment, release, and timestamp", async () => {
  const receipt = {
    schemaVersion: 1,
    controlId: "dedicated-error-monitoring",
    type: "error-monitoring-ingestion-test",
    provider: "sentry",
    status: "ingested",
    timestamp: "2026-08-01T11:58:00.000Z",
    category: "error_monitoring",
    configuredProvider: "Sentry Cloud",
    route: "Sentry project for production API errors",
    frequency: null,
  };
  const eventId = "a".repeat(32);
  const claim = {
    provider: receipt.provider,
    evidenceSha256: "2".repeat(64),
    scope: {
      account: "rivt-org",
      environment: "production",
      project: "node-express",
      resource: eventId,
    },
  };
  const project = { id: "456", slug: "node-express", organization: { slug: "rivt-org" } };
  const event = {
    eventID: eventId,
    projectID: project.id,
    dateReceived: receipt.timestamp,
    platform: "node",
    type: "error",
    release: { version: sourceCommit },
    tags: [
      { key: "environment", value: "production" },
      { key: "service", value: "rivt-api" },
    ],
  };
  const calls = [];
  const fetchFunction = routedFetch([
    { method: "GET", match: (url) => url.pathname === "/api/0/projects/rivt-org/node-express/", payload: project },
    { method: "GET", match: (url) => url.pathname.endsWith(`/events/${eventId}/`), payload: event },
  ], calls);
  const context = providerContext({
    claim,
    credentials: { RIVT_EVIDENCE_SENTRY_TOKEN: "sentry-secret" },
    receipt,
  });
  const result = await verifySentryErrorIngestionEvidence(context, { fetchFunction });
  assert.equal(result.status, "verified");
  assert.equal(calls[1].url.searchParams.get("environment"), "production");
  assert.equal(JSON.stringify(result).includes("sentry-secret"), false);

  event.release.version = "f".repeat(40);
  const wrongRelease = await verifySentryErrorIngestionEvidence(context, { fetchFunction });
  assert.equal(wrongRelease.reasonCode, "PROVIDER_BINDING_MISMATCH");

  event.release.version = sourceCommit;
  event.dateReceived = "2026-08-01T10:00:00.000Z";
  receipt.timestamp = event.dateReceived;
  const staleEvent = await verifySentryErrorIngestionEvidence(context, { fetchFunction });
  assert.equal(staleEvent.reasonCode, "PROVIDER_BINDING_MISMATCH");
});

test("disabled-payment adapter uses read-only Railway and Stripe queries and rejects onboarding drift", async () => {
  const receipt = {
    schemaVersion: 1,
    controlId: "bank-payment-provider-state",
    type: "provider-payment-state-verification",
    provider: "railway-stripe",
    status: "verified",
    timestamp: "2026-08-01T11:57:00.000Z",
    mode: "disabled",
    featureFlagVerifiedOff: true,
    providerDestinationScope: "connected_accounts",
    runtimeScopeAttestation: "unset",
    signedDeliveryVerified: false,
    enabled: false,
    configured: false,
    webhookConfigured: true,
    providerMode: "setup_required",
  };
  const claim = {
    provider: receipt.provider,
    evidenceSha256: "3".repeat(64),
    scope: {
      account: "acct_platform",
      environment: "env_prod",
      project: "project_rivt",
      resource: "service:svc_rivt:event-destination:ed_rivt",
    },
  };
  const railwayVariables = {
    RAILWAY_PROJECT_ID: claim.scope.project,
    RAILWAY_ENVIRONMENT_ID: claim.scope.environment,
    RAILWAY_SERVICE_ID: "svc_rivt",
    RAILWAY_ENVIRONMENT_NAME: "production",
    RAILWAY_GIT_COMMIT_SHA: sourceCommit,
    STRIPE_CONNECT_ACH_ENABLED: "false",
    STRIPE_SECRET_KEY: "test-stripe-secret-never-output",
    STRIPE_CONNECT_WEBHOOK_SECRET: "test-webhook-secret-never-output",
  };
  const runningStripeConfig = {
    secretKey: railwayVariables.STRIPE_SECRET_KEY,
    webhookSecret: railwayVariables.STRIPE_CONNECT_WEBHOOK_SECRET,
  };
  const v1Accounts = { object: "list", has_more: false, data: [] };
  const v2Accounts = { data: [], next_page_url: null };
  const eventDestination = {
    id: "ed_rivt",
    object: "v2.core.event_destination",
    type: "webhook_endpoint",
    status: "enabled",
    livemode: true,
    event_payload: "snapshot",
    snapshot_api_version: "2026-06-24.dahlia",
    events_from: ["@accounts"],
    webhook_endpoint: {
      url: "https://rivt.pro/api/stripe/connect/webhook",
    },
    enabled_events: [
      "checkout.session.completed",
      "checkout.session.async_payment_succeeded",
      "checkout.session.async_payment_failed",
      "checkout.session.expired",
      "payment_intent.processing",
      "payment_intent.succeeded",
      "payment_intent.payment_failed",
      "charge.dispute.created",
      "charge.refunded",
    ],
  };
  const railwayDeployment = {
    id: "deployment_rivt",
    status: "SUCCESS",
    createdAt: "2026-08-01T11:45:00.000Z",
    meta: { commitHash: sourceCommit },
  };
  const healthPayload = {
    ok: true,
    build: { commit: sourceCommit },
    observability: {
      invoiceBankPayments: {
        provider: "stripe_connect",
        accountsApi: "v2",
        enabled: false,
        configured: false,
        webhookConfigured: true,
        webhookScopeConfigured: false,
        mode: "setup_required",
      },
    },
  };
  const calls = [];
  const fetchFunction = routedFetch([
    {
      method: "POST",
      match(url, init) {
        if (url.pathname !== "/graphql/v2") return false;
        const body = JSON.parse(init.body);
        assert.equal(body.query.includes("mutation"), false);
        assert.deepEqual(body.variables, {
          deploymentInput: {
            environmentId: claim.scope.environment,
            projectId: claim.scope.project,
            serviceId: "svc_rivt",
            status: { successfulOnly: true },
          },
          projectId: claim.scope.project,
          environmentId: claim.scope.environment,
          serviceId: "svc_rivt",
        });
        return true;
      },
      payload: {
        data: {
          variablesForServiceDeployment: railwayVariables,
          deployments: {
            edges: [{ node: railwayDeployment }],
          },
        },
      },
    },
    {
      method: "GET",
      match: (url) => url.origin === "https://rivt.pro" && url.pathname === "/api/health",
      payload: healthPayload,
    },
    {
      method: "POST",
      match: (url) => (
        url.origin === "https://rivt.pro"
        && url.pathname === "/api/provider-evidence/stripe-connect/runtime"
      ),
      payload(_url, init) {
        const nonce = init.headers["X-RIVT-Evidence-Nonce"];
        const timestamp = init.headers["X-RIVT-Evidence-Timestamp"];
        const expected = stripeConnectRuntimeProof({
          ...runningStripeConfig,
          enabled: false,
          webhookScope: undefined,
          sourceCommit,
          timestamp,
          nonce,
        });
        return {
          data: {
            provider: init.headers.Authorization === `RIVT-HMAC ${expected}`
              ? "stripe_connect"
              : "unauthorized",
            sourceCommit,
          },
        };
      },
    },
    { method: "GET", match: (url) => url.pathname === "/v1/account", payload: { id: claim.scope.account } },
    {
      method: "GET",
      match(url, init) {
        if (url.pathname !== "/v2/core/event_destinations/ed_rivt") return false;
        assert.equal(url.searchParams.get("include[0]"), "webhook_endpoint.url");
        assert.equal(init.headers["Stripe-Version"], "2026-06-24.dahlia");
        return true;
      },
      payload: eventDestination,
    },
    { method: "GET", match: (url) => url.pathname === "/v1/accounts", payload: v1Accounts },
    {
      method: "GET",
      match: (url) => (
        url.pathname === "/v2/core/accounts"
        && url.searchParams.get("applied_configurations[0]") === "merchant"
      ),
      payload: v2Accounts,
    },
  ], calls);
  const context = providerContext({
    claim,
    credentials: {
      RIVT_EVIDENCE_RAILWAY_TOKEN: "railway-secret",
    },
    receipt,
  });
  const result = await verifyRailwayStripeDisabledPaymentEvidence(context, { fetchFunction });
  assert.equal(result.status, "verified");
  assert.equal(calls.filter(({ init }) => init.method === "POST").length, 2);
  assert.equal(calls.filter(({ url }) => url.origin === "https://api.stripe.com")
    .every(({ init }) => init.method === "GET"), true);
  assert.equal(calls.filter(({ url }) => url.origin === "https://api.stripe.com")
    .every(({ init }) => init.headers.Authorization === "Bearer test-stripe-secret-never-output"), true);
  const serialized = JSON.stringify(result);
  for (const forbidden of [
    "railway-secret",
    "test-stripe-secret-never-output",
    "test-webhook-secret-never-output",
  ]) assert.equal(serialized.includes(forbidden), false);

  eventDestination.events_from = ["@self"];
  const wrongDestinationScope = await verifyRailwayStripeDisabledPaymentEvidence(
    context,
    { fetchFunction },
  );
  assert.equal(wrongDestinationScope.reasonCode, "PROVIDER_BINDING_MISMATCH");

  eventDestination.events_from = ["@accounts"];
  eventDestination.enabled_events.pop();
  const incompleteEventContract = await verifyRailwayStripeDisabledPaymentEvidence(
    context,
    { fetchFunction },
  );
  assert.equal(incompleteEventContract.reasonCode, "PROVIDER_BINDING_MISMATCH");
  eventDestination.enabled_events.push("charge.refunded");

  eventDestination.enabled_events.push("customer.created");
  const extraEventContract = await verifyRailwayStripeDisabledPaymentEvidence(
    context,
    { fetchFunction },
  );
  assert.equal(extraEventContract.reasonCode, "PROVIDER_BINDING_MISMATCH");
  eventDestination.enabled_events.pop();

  eventDestination.events_from.push("@self");
  const extraDestinationScope = await verifyRailwayStripeDisabledPaymentEvidence(
    context,
    { fetchFunction },
  );
  assert.equal(extraDestinationScope.reasonCode, "PROVIDER_BINDING_MISMATCH");
  eventDestination.events_from.pop();

  eventDestination.snapshot_api_version = "2026-02-25.clover";
  const wrongSnapshotVersion = await verifyRailwayStripeDisabledPaymentEvidence(
    context,
    { fetchFunction },
  );
  assert.equal(wrongSnapshotVersion.reasonCode, "PROVIDER_BINDING_MISMATCH");
  eventDestination.snapshot_api_version = "2026-06-24.dahlia";

  v2Accounts.data.push({ id: "acct_unexpected", applied_configurations: ["merchant"] });
  const drift = await verifyRailwayStripeDisabledPaymentEvidence(context, { fetchFunction });
  assert.equal(drift.reasonCode, "PROVIDER_BINDING_MISMATCH");

  v2Accounts.data.length = 0;
  railwayDeployment.meta.commitHash = "f".repeat(40);
  const staleDeployment = await verifyRailwayStripeDisabledPaymentEvidence(
    context,
    { fetchFunction },
  );
  assert.equal(staleDeployment.reasonCode, "PROVIDER_BINDING_MISMATCH");

  railwayDeployment.meta.commitHash = sourceCommit;
  healthPayload.build.commit = "f".repeat(40);
  const staleLiveHealth = await verifyRailwayStripeDisabledPaymentEvidence(
    context,
    { fetchFunction },
  );
  assert.equal(staleLiveHealth.reasonCode, "PROVIDER_BINDING_MISMATCH");

  healthPayload.build.commit = sourceCommit;
  railwayVariables.STRIPE_SECRET_KEY = "test-stripe-staged-but-not-running";
  const stagedRuntimeDrift = await verifyRailwayStripeDisabledPaymentEvidence(
    context,
    { fetchFunction },
  );
  assert.equal(stagedRuntimeDrift.reasonCode, "PROVIDER_BINDING_MISMATCH");
});

test("delivery and recovery claims expose their exact unresolved proof seam", async () => {
  const reasons = {
    "sentry-paging-delivery": "PROVIDER_DELIVERY_NOT_OBSERVABLE",
    "backup-schedule": "BACKUP_PROVIDER_SELECTION_REQUIRED",
    "backup-completion": "BACKUP_PROVIDER_SELECTION_REQUIRED",
    "backup-retention": "BACKUP_PROVIDER_SELECTION_REQUIRED",
    "backup-failure-domain": "BACKUP_FAILURE_DOMAIN_PROOF_REQUIRED",
  };
  for (const [adapterId, reasonCode] of Object.entries(reasons)) {
    const result = await compiledProviderAdapters[adapterId].verify({});
    assert.equal(result.status, "unsupported", adapterId);
    assert.equal(result.reasonCode, reasonCode, adapterId);
  }
});

test("missing credentials fail before the adapter is called", async () => {
  const fixture = createFixture();
  let calls = 0;
  try {
    const adapter = verifiedAdapter();
    adapter.verify = async () => {
      calls += 1;
      return { status: "failed", reasonCode: "SHOULD_NOT_RUN" };
    };
    const result = await runFixture(fixture, {
      adapters: { "github-production-synthetic": adapter },
      credentials: {},
    });
    assert.equal(calls, 0);
    assert.equal(result.report.controls[0].reasonCode, "PROVIDER_CREDENTIAL_MISSING");
  } finally {
    fs.rmSync(fixture.rootDir, { recursive: true, force: true });
  }
});

test("source, provider, receipt, freshness, and scope mismatches fail closed", async (context) => {
  const cases = [
    {
      name: "source",
      overrides: { expectedLiveCommit: "c".repeat(40) },
      reasonCode: "SOURCE_COMMIT_MISMATCH",
    },
    {
      name: "provider",
      mutatePlan(plan) { plan.claims[0].provider = "untrusted-provider"; },
      reasonCode: "PLAN_CLAIM_INVALID",
    },
    {
      name: "receipt",
      mutateReceipt(receipt) { receipt.status = "failed"; },
      reasonCode: "EVIDENCE_BINDING_MISMATCH",
    },
    {
      name: "future timestamp",
      recreate: { timestamp: "2026-08-01T12:01:00.000Z" },
      reasonCode: "EVIDENCE_STALE_OR_FUTURE",
    },
    {
      name: "scope",
      adapter: {
        ...verifiedAdapter(),
        async verify({ claim }) {
          return {
            observedAt: "2026-08-01T11:59:30.000Z",
            proofId: "d".repeat(64),
            provider: claim.provider,
            receiptSha256: claim.evidenceSha256,
            scope: { ...claim.scope, resource: "other-resource" },
            status: "verified",
          };
        },
      },
      reasonCode: "ADAPTER_BINDING_MISMATCH",
    },
  ];
  for (const fixtureCase of cases) {
    await context.test(fixtureCase.name, async () => {
      const fixture = createFixture(fixtureCase.recreate);
      try {
        if (fixtureCase.mutatePlan) fixtureCase.mutatePlan(fixture.plan);
        if (fixtureCase.mutateReceipt) {
          const changedReceipt = structuredClone(fixture.receipt);
          fixtureCase.mutateReceipt(changedReceipt);
          fs.writeFileSync(
            path.join(fixture.rootDir, fixture.claim.evidencePath),
            JSON.stringify(changedReceipt),
            "utf8",
          );
        }
        const result = await runFixture(fixture, {
          ...(fixtureCase.overrides ?? {}),
          ...(fixtureCase.adapter
            ? { adapters: { "github-production-synthetic": fixtureCase.adapter } }
            : {}),
        });
        const reasonCodes = result.report.controls.length > 0
          ? result.report.controls.map((control) => control.reasonCode)
          : result.report.findingCodes;
        assert.ok(reasonCodes.includes(fixtureCase.reasonCode));
        assert.equal(result.externallyVerifiedEvidence.size, 0);
      } finally {
        fs.rmSync(fixture.rootDir, { recursive: true, force: true });
      }
    });
  }
});

test("adapter exceptions and secret-like error text are reduced to a fixed code", async () => {
  const fixture = createFixture();
  try {
    const result = await runFixture(fixture, {
      adapters: {
        "github-production-synthetic": {
          ...verifiedAdapter(),
          async verify() {
            throw new Error("token=super-secret user@example.com private-route-url");
          },
        },
      },
    });
    const serialized = JSON.stringify(result.report);
    assert.equal(result.report.controls[0].reasonCode, "ADAPTER_EXECUTION_FAILED");
    assert.equal(serialized.includes("super-secret"), false);
    assert.equal(serialized.includes("user@example.com"), false);
    assert.equal(serialized.includes("private-route-url"), false);
  } finally {
    fs.rmSync(fixture.rootDir, { recursive: true, force: true });
  }
});

test("provider proof reuse blocks the second independent control", async () => {
  const fixture = createFixture();
  try {
    const second = createFixture({ controlId: "github-production-synthetic-secondary" });
    try {
      const secondPath = "evidence/github-production-synthetic-secondary.json";
      fs.copyFileSync(
        path.join(second.rootDir, second.claim.evidencePath),
        path.join(fixture.rootDir, secondPath),
      );
      fixture.plan.claims.push({ ...second.claim, evidencePath: secondPath });
      const result = await runFixture(fixture, {
        adapters: {
          "github-production-synthetic": verifiedAdapter("e".repeat(64)),
        },
      });
      assert.equal(result.ok, false);
      assert.equal(result.report.controls.filter((control) => control.status === "verified").length, 1);
      assert.equal(result.report.controls.some(
        (control) => control.reasonCode === "PROVIDER_PROOF_REUSED",
      ), true);
    } finally {
      fs.rmSync(second.rootDir, { recursive: true, force: true });
    }
  } finally {
    fs.rmSync(fixture.rootDir, { recursive: true, force: true });
  }
});

test("self-authored verification fields and duplicate evidence are rejected by plan validation", () => {
  const fixture = createFixture();
  try {
    assert.deepEqual(validateEvidencePlan({
      ...fixture.plan,
      verifiedIdentities: [],
    }), { ok: false, findings: ["PLAN_SCHEMA_INVALID"] });
    assert.deepEqual(validateEvidencePlan({
      ...fixture.plan,
      sourceCommit,
    }), { ok: false, findings: ["PLAN_SCHEMA_INVALID"] });
    assert.deepEqual(validateEvidencePlan({
      ...fixture.plan,
      claims: [fixture.claim, structuredClone(fixture.claim)],
    }), {
      ok: false,
      findings: [
        "PLAN_CONTROL_REUSED",
        "PLAN_EVIDENCE_PATH_REUSED",
        "PLAN_EVIDENCE_DIGEST_REUSED",
      ],
    });
  } finally {
    fs.rmSync(fixture.rootDir, { recursive: true, force: true });
  }
});

test("the gate passes identities in memory and keeps readiness and evidence independent", async () => {
  const fixture = createFixture();
  let receivedIdentitySet = null;
  try {
    const result = await runProviderEvidenceGate({
      adapters: { "github-production-synthetic": verifiedAdapter() },
      credentials: { RIVT_EVIDENCE_GITHUB_TOKEN: "test-only-secret" },
      evaluateReadiness({ externallyVerifiedEvidence }) {
        receivedIdentitySet = externallyVerifiedEvidence;
        return { ok: false, findings: [{ code: "ACTIVE_LAUNCH_HOLD", source: "incident" }] };
      },
      expectedLiveCommit: sourceCommit,
      now,
      plan: fixture.plan,
      rootDir: fixture.rootDir,
      sourceCommit,
    });
    assert.ok(receivedIdentitySet instanceof Set);
    assert.equal(receivedIdentitySet.size, 1);
    assert.equal(result.ok, false);
    assert.equal(result.report.status, "blocked");
    assert.deepEqual(result.report.readiness.findingCodes, [
      { code: "ACTIVE_LAUNCH_HOLD", source: "incident" },
    ]);
  } finally {
    fs.rmSync(fixture.rootDir, { recursive: true, force: true });
  }
});

test("launch readiness keeps source policy separate from overlay evidence", async () => {
  const fixture = createFixture();
  const policyRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rivt-policy-root-"));
  let readinessInput = null;
  try {
    const result = await runProviderEvidenceGate({
      adapters: { "github-production-synthetic": verifiedAdapter() },
      credentials: { RIVT_EVIDENCE_GITHUB_TOKEN: "test-only-secret" },
      evidenceCommit: "b".repeat(40),
      evidenceRoot: fixture.rootDir,
      evaluateReadiness(input) {
        readinessInput = input;
        return { ok: false, findings: [{ code: "ACTIVE_LAUNCH_HOLD", source: "incident" }] };
      },
      expectedLiveCommit: sourceCommit,
      now,
      overlayValidator: () => ({
        ok: true,
        findingCodes: [],
        report: {
          evidenceCommit: "b".repeat(40),
          overlayDigest: "c".repeat(64),
          sourceCommit,
        },
      }),
      plan: fixture.plan,
      policyRoot,
      sourceCommit,
      sourceWorktreeValidator: () => ({ ok: true, findingCodes: [] }),
      worktreeValidator: () => ({ ok: true, findingCodes: [] }),
    });

    assert.equal(result.ok, false);
    assert.equal(result.report.providerEvidence.status, "verified");
    assert.deepEqual(result.report.readiness.findingCodes, [
      { code: "ACTIVE_LAUNCH_HOLD", source: "incident" },
    ]);
    assert.equal(readinessInput.policyRoot, policyRoot);
    assert.equal(readinessInput.evidenceRoot, fixture.rootDir);
    assert.equal(Object.hasOwn(readinessInput, "rootDir"), false);
    assert.equal(result.report.policyRevision, sourceCommit);
    assert.equal(result.report.evidenceRevision, "b".repeat(40));
    assert.deepEqual(result.report.rootRoles, {
      evidence: "protected-overlay",
      policy: "immutable-source",
    });
  } finally {
    fs.rmSync(policyRoot, { recursive: true, force: true });
    fs.rmSync(fixture.rootDir, { recursive: true, force: true });
  }
});

test("overlay copies of launch policy cannot clear the immutable source hold", () => {
  const policyRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rivt-source-policy-copy-"));
  const evidenceRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rivt-evidence-policy-copy-"));
  try {
    fs.cpSync(
      path.join(process.cwd(), "docs"),
      path.join(policyRoot, "docs"),
      { recursive: true },
    );
    fs.cpSync(
      path.join(process.cwd(), "docs"),
      path.join(evidenceRoot, "docs"),
      { recursive: true },
    );
    const sourceIncidentPath = path.join(
      policyRoot,
      "docs",
      "operations",
      "incident-routing.json",
    );
    const incidentPath = path.join(
      evidenceRoot,
      "docs",
      "operations",
      "incident-routing.json",
    );
    const recoveryPath = path.join(
      evidenceRoot,
      "docs",
      "operations",
      "recovery-policy.json",
    );
    const sourceIncident = JSON.parse(fs.readFileSync(sourceIncidentPath, "utf8"));
    const incident = JSON.parse(fs.readFileSync(incidentPath, "utf8"));
    const recovery = JSON.parse(fs.readFileSync(recoveryPath, "utf8"));
    sourceIncident.launchHold = {
      active: true,
      reason: "synthetic immutable-source hold",
    };
    incident.launchHold = { active: false, reason: "overlay attempted to clear hold" };
    recovery.targets.rpoMinutes = 525_600;
    recovery.targets.rtoMinutes = 525_600;
    fs.writeFileSync(
      sourceIncidentPath,
      `${JSON.stringify(sourceIncident, null, 2)}\n`,
      "utf8",
    );
    fs.writeFileSync(incidentPath, `${JSON.stringify(incident, null, 2)}\n`, "utf8");
    fs.writeFileSync(recoveryPath, `${JSON.stringify(recovery, null, 2)}\n`, "utf8");

    const readiness = evaluateRepositoryReadiness({
      evidenceRoot,
      now,
      policyRoot,
    });

    assert.ok(readiness.findings.some((finding) => finding.code === "ACTIVE_LAUNCH_HOLD"));
    assert.equal(readiness.summary.activeLaunchHold, true);
  } finally {
    fs.rmSync(policyRoot, { recursive: true, force: true });
    fs.rmSync(evidenceRoot, { recursive: true, force: true });
  }
});

test("an evidence commit without an explicit source policy root fails before adapters", async () => {
  const fixture = createFixture();
  let adapterCalled = false;
  try {
    const adapter = verifiedAdapter();
    const result = await runProviderEvidenceGate({
      adapters: {
        "github-production-synthetic": {
          ...adapter,
          async verify(context) {
            adapterCalled = true;
            return adapter.verify(context);
          },
        },
      },
      credentials: { RIVT_EVIDENCE_GITHUB_TOKEN: "test-only-secret" },
      evidenceCommit: "b".repeat(40),
      evidenceRoot: fixture.rootDir,
      expectedLiveCommit: sourceCommit,
      now,
      plan: fixture.plan,
      rootDir: fixture.rootDir,
      sourceCommit,
    });

    assert.equal(adapterCalled, false);
    assert.equal(result.ok, false);
    assert.ok(result.report.findingCodes.includes("POLICY_ROOT_REQUIRED"));
    assert.equal(result.report.readiness.status, "blocked");
  } finally {
    fs.rmSync(fixture.rootDir, { recursive: true, force: true });
  }
});

test("an untrusted policy root stops before adapters and readiness", async () => {
  const fixture = createFixture();
  let adapterCalled = false;
  let readinessCalled = false;
  try {
    const adapter = verifiedAdapter();
    const result = await runProviderEvidenceGate({
      adapters: {
        "github-production-synthetic": {
          ...adapter,
          async verify(context) {
            adapterCalled = true;
            return adapter.verify(context);
          },
        },
      },
      credentials: { RIVT_EVIDENCE_GITHUB_TOKEN: "test-only-secret" },
      evidenceCommit: "b".repeat(40),
      evidenceRoot: fixture.rootDir,
      evaluateReadiness() {
        readinessCalled = true;
        return { ok: true, findings: [] };
      },
      expectedLiveCommit: sourceCommit,
      now,
      overlayValidator: () => ({
        ok: true,
        findingCodes: [],
        report: {
          evidenceCommit: "b".repeat(40),
          overlayDigest: "c".repeat(64),
          sourceCommit,
        },
      }),
      plan: fixture.plan,
      policyRoot: fixture.rootDir,
      sourceCommit,
      sourceWorktreeValidator: () => ({
        ok: false,
        findingCodes: ["POLICY_WORKTREE_DIRTY"],
      }),
      worktreeValidator: () => ({ ok: true, findingCodes: [] }),
    });

    assert.equal(adapterCalled, false);
    assert.equal(readinessCalled, false);
    assert.ok(result.report.findingCodes.includes("POLICY_WORKTREE_DIRTY"));
    assert.deepEqual(result.report.readiness.findingCodes, [
      { code: "POLICY_ROOT_UNTRUSTED", source: "readiness" },
    ]);
  } finally {
    fs.rmSync(fixture.rootDir, { recursive: true, force: true });
  }
});

test("required policy validation cannot attest success without overlay mode", async () => {
  const fixture = createFixture();
  let adapterCalled = false;
  try {
    const result = await runEvidenceVerification({
      adapters: {
        "github-production-synthetic": {
          ...verifiedAdapter(),
          async verify() {
            adapterCalled = true;
            return { status: "verified", reasonCode: "SHOULD_NOT_RUN" };
          },
        },
      },
      credentials: { RIVT_EVIDENCE_GITHUB_TOKEN: "test-only-secret" },
      expectedLiveCommit: sourceCommit,
      now,
      plan: fixture.plan,
      policyRoot: fixture.rootDir,
      requirePolicyRoot: true,
      rootDir: fixture.rootDir,
      sourceCommit,
      sourceWorktreeValidator: () => ({
        ok: false,
        findingCodes: ["POLICY_WORKTREE_DIRTY"],
      }),
    });

    assert.equal(adapterCalled, false);
    assert.equal(result.ok, false);
    assert.deepEqual(result.report.findingCodes, ["POLICY_WORKTREE_DIRTY"]);
    assert.equal(result.report.overlayValidated, null);
    assert.equal(result.report.policyRootValidated, false);
  } finally {
    fs.rmSync(fixture.rootDir, { recursive: true, force: true });
  }
});

test("an invalid S/E overlay stops before any provider adapter executes", async () => {
  const fixture = createFixture();
  let adapterCalled = false;
  try {
    const result = await runEvidenceVerification({
      adapters: {
        "github-production-synthetic": {
          ...verifiedAdapter(),
          async verify() {
            adapterCalled = true;
            return { status: "failed", reasonCode: "SHOULD_NOT_RUN" };
          },
        },
      },
      credentials: { RIVT_EVIDENCE_GITHUB_TOKEN: "test-only-secret" },
      evidenceCommit: "b".repeat(40),
      evidenceRoot: fixture.rootDir,
      expectedLiveCommit: sourceCommit,
      now,
      overlayValidator: () => ({
        ok: false,
        findingCodes: ["OVERLAY_PATH_NOT_ALLOWED"],
        report: { overlayDigest: "c".repeat(64) },
      }),
      plan: fixture.plan,
      policyRoot: fixture.rootDir,
      rootDir: fixture.rootDir,
      sourceCommit,
      sourceWorktreeValidator: () => ({ ok: true, findingCodes: [] }),
      worktreeValidator: () => ({ ok: true, findingCodes: [] }),
    });
    assert.equal(adapterCalled, false);
    assert.equal(result.ok, false);
    assert.deepEqual(result.report.findingCodes, ["OVERLAY_PATH_NOT_ALLOWED"]);
    assert.equal(result.report.sourceCommit, sourceCommit);
    assert.equal(result.report.evidenceCommit, "b".repeat(40));
  } finally {
    fs.rmSync(fixture.rootDir, { recursive: true, force: true });
  }
});

test("an invalid post-evidence approval stops before any provider adapter executes", async () => {
  const fixture = createFixture();
  const policyRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rivt-approval-source-"));
  const approvalRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rivt-approval-root-"));
  let adapterCalled = false;
  try {
    fs.cpSync(
      path.join(process.cwd(), "docs"),
      path.join(policyRoot, "docs"),
      { recursive: true },
    );
    const adapter = verifiedAdapter();
    const result = await runEvidenceVerification({
      adapters: {
        "github-production-synthetic": {
          ...adapter,
          async verify(context) {
            adapterCalled = true;
            return adapter.verify(context);
          },
        },
      },
      approvalCommit: "c".repeat(40),
      approvalOverlayValidator: () => ({
        ok: false,
        findingCodes: ["APPROVAL_MANIFEST_PLAN_DIGEST_MISMATCH"],
        manifest: null,
        report: null,
      }),
      approvalRoot,
      approvalWorktreeValidator: () => ({ ok: true, findingCodes: [] }),
      credentials: { RIVT_EVIDENCE_GITHUB_TOKEN: "test-only-secret" },
      evidenceCommit: "b".repeat(40),
      evidenceRoot: fixture.rootDir,
      expectedLiveCommit: sourceCommit,
      now,
      overlayValidator: () => ({
        ok: true,
        findingCodes: [],
        report: {
          evidenceCommit: "b".repeat(40),
          overlayDigest: "d".repeat(64),
          sourceCommit,
        },
      }),
      plan: fixture.plan,
      policyRoot,
      requireApprovalRoot: true,
      requirePolicyRoot: true,
      sourceCommit,
      sourceWorktreeValidator: () => ({ ok: true, findingCodes: [] }),
      worktreeValidator: () => ({ ok: true, findingCodes: [] }),
    });

    assert.equal(adapterCalled, false);
    assert.equal(result.ok, false);
    assert.equal(result.report.approvalValidated, false);
    assert.deepEqual(result.report.findingCodes, [
      "APPROVAL_MANIFEST_PLAN_DIGEST_MISMATCH",
    ]);
  } finally {
    fs.rmSync(approvalRoot, { recursive: true, force: true });
    fs.rmSync(policyRoot, { recursive: true, force: true });
    fs.rmSync(fixture.rootDir, { recursive: true, force: true });
  }
});

test("an untrusted evidence root is never parsed by readiness evaluation", async () => {
  const fixture = createFixture();
  let readinessCalled = false;
  try {
    const result = await runProviderEvidenceGate({
      adapters: { "github-production-synthetic": verifiedAdapter() },
      credentials: { RIVT_EVIDENCE_GITHUB_TOKEN: "test-only-secret" },
      evidenceCommit: "b".repeat(40),
      evidenceRoot: fixture.rootDir,
      evaluateReadiness() {
        readinessCalled = true;
        return { ok: true, findings: [] };
      },
      expectedLiveCommit: sourceCommit,
      now,
      overlayValidator: () => ({
        ok: false,
        findingCodes: ["OVERLAY_PATH_NOT_ALLOWED"],
        report: { overlayDigest: null },
      }),
      plan: fixture.plan,
      policyRoot: fixture.rootDir,
      rootDir: fixture.rootDir,
      sourceCommit,
      sourceWorktreeValidator: () => ({ ok: true, findingCodes: [] }),
      worktreeValidator: () => ({ ok: true, findingCodes: [] }),
    });
    assert.equal(readinessCalled, false);
    assert.deepEqual(result.report.readiness.findingCodes, [
      { code: "EVIDENCE_OVERLAY_UNTRUSTED", source: "readiness" },
    ]);
  } finally {
    fs.rmSync(fixture.rootDir, { recursive: true, force: true });
  }
});

test("provider adapters stay bound to S while receipts are read from E", async () => {
  const fixture = createFixture();
  const runtimeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rivt-runtime-source-"));
  let adapterSourceCommit = null;
  try {
    const adapter = verifiedAdapter();
    const result = await runEvidenceVerification({
      adapters: {
        "github-production-synthetic": {
          ...adapter,
          async verify(context) {
            adapterSourceCommit = context.sourceCommit;
            return adapter.verify(context);
          },
        },
      },
      credentials: { RIVT_EVIDENCE_GITHUB_TOKEN: "test-only-secret" },
      evidenceCommit: "b".repeat(40),
      evidenceRoot: fixture.rootDir,
      expectedLiveCommit: sourceCommit,
      now,
      overlayValidator: () => ({
        ok: true,
        findingCodes: [],
        report: {
          evidenceCommit: "b".repeat(40),
          overlayDigest: "c".repeat(64),
          sourceCommit,
        },
      }),
      plan: fixture.plan,
      rootDir: runtimeRoot,
      sourceCommit,
      worktreeValidator: () => ({ ok: true, findingCodes: [] }),
    });
    assert.equal(result.ok, true);
    assert.equal(adapterSourceCommit, sourceCommit);
    assert.equal(result.report.sourceCommit, sourceCommit);
    assert.equal(result.report.evidenceCommit, "b".repeat(40));
    assert.equal(result.report.overlayDigest, "c".repeat(64));
  } finally {
    fs.rmSync(runtimeRoot, { recursive: true, force: true });
    fs.rmSync(fixture.rootDir, { recursive: true, force: true });
  }
});

test("CLI validation requires an explicit read-only protected-run contract", () => {
  assert.equal(validateEvidenceRunnerArguments([]).reasonCode, "READ_ONLY_FLAG_REQUIRED");
  assert.equal(
    validateEvidenceRunnerArguments(["--read-only"]).reasonCode,
    "VERIFICATION_MODE_REQUIRED",
  );
  assert.equal(validateEvidenceRunnerArguments([
    "--read-only",
    "--source-commit", sourceCommit,
    "--expected-live-commit", sourceCommit,
    "--token", "secret",
  ]).reasonCode, "ARGUMENT_UNKNOWN");
  assert.equal(validateEvidenceRunnerArguments([
    "--read-only",
    "--verify-providers-only",
    "--source-commit", sourceCommit,
    "--expected-live-commit", sourceCommit,
  ]).reasonCode, "ARGUMENT_REQUIRED");
  assert.equal(validateEvidenceRunnerArguments([
    "--read-only",
    "--verify-providers-only",
    "--evidence-commit", sourceCommit,
    "--evidence-root", "evidence-root",
    "--source-commit", sourceCommit,
    "--expected-live-commit", sourceCommit,
  ]).ok, true);
  assert.equal(validateEvidenceRunnerArguments([
    "--read-only",
    "--require-ready",
    "--verify-providers-only",
    "--evidence-commit", sourceCommit,
    "--evidence-root", "evidence-root",
    "--source-commit", sourceCommit,
    "--expected-live-commit", sourceCommit,
  ]).reasonCode, "VERIFICATION_MODE_CONFLICT");
  assert.equal(validateEvidenceRunnerArguments([
    "--read-only",
    "--require-ready",
    "--evidence-commit", sourceCommit,
    "--evidence-root", "evidence-root",
    "--source-commit", sourceCommit,
    "--expected-live-commit", sourceCommit,
  ]).reasonCode, "APPROVAL_ARGUMENT_REQUIRED");
  assert.equal(validateEvidenceRunnerArguments([
    "--read-only",
    "--require-ready",
    "--approval-commit", "c".repeat(40),
    "--approval-root", "approval-root",
    "--evidence-commit", sourceCommit,
    "--evidence-root", "evidence-root",
    "--source-commit", sourceCommit,
    "--expected-live-commit", sourceCommit,
  ]).ok, true);
  assert.equal(validateEvidenceRunnerArguments([
    "--read-only",
    "--require-ready",
    "--approval-commit", "c".repeat(40),
    "--evidence-commit", sourceCommit,
    "--evidence-root", "evidence-root",
    "--source-commit", sourceCommit,
    "--expected-live-commit", sourceCommit,
  ]).reasonCode, "APPROVAL_ARGUMENT_PAIR_REQUIRED");
  assert.equal(validateEvidenceRunnerArguments([
    "--read-only",
    "--verify-providers-only",
    "--approval-commit", "c".repeat(40),
    "--approval-root", "approval-root",
    "--evidence-commit", sourceCommit,
    "--evidence-root", "evidence-root",
    "--source-commit", sourceCommit,
    "--expected-live-commit", sourceCommit,
  ]).reasonCode, "APPROVAL_ARGUMENT_NOT_ALLOWED");
  assert.equal(validateEvidenceRunnerArguments([
    "--read-only",
    "--require-ready",
    "--plan-file", "plan.json",
    "--evidence-commit", sourceCommit,
    "--evidence-root", "evidence-root",
    "--source-commit", sourceCommit,
    "--expected-live-commit", sourceCommit,
  ]).reasonCode, "ARGUMENT_UNKNOWN");
  assert.equal(evidenceRunnerExitCode({ ok: false }), 1);
  assert.equal(evidenceRunnerExitCode({ ok: true }), 0);
  assert.equal(evidenceRunnerExitCode({
    ok: false,
    report: {
      providerEvidence: { status: "verified" },
      readiness: {
        status: "blocked",
        findingCodes: [{ code: "ACTIVE_LAUNCH_HOLD", source: "incident" }],
      },
    },
  }, { providersOnly: true }), 0);
  assert.equal(evidenceRunnerExitCode({
    ok: false,
    report: {
      providerEvidence: { status: "blocked" },
      readiness: {
        status: "blocked",
        findingCodes: [{ code: "ACTIVE_LAUNCH_HOLD", source: "incident" }],
      },
    },
  }, { providersOnly: true }), 1);
  assert.equal(evidenceRunnerExitCode({
    ok: true,
    report: {
      providerEvidence: { status: "verified" },
      readiness: { status: "ready", findingCodes: [] },
    },
  }, { providersOnly: true }), 1);
});

test("the provider plan is accepted only as one bounded protected JSON secret", () => {
  const fixture = createFixture();
  try {
    assert.deepEqual(parseEvidencePlanSecret({}), {
      ok: false,
      reasonCode: "PLAN_SECRET_MISSING",
    });
    assert.deepEqual(parseEvidencePlanSecret({ RIVT_PROVIDER_EVIDENCE_PLAN_JSON: "{" }), {
      ok: false,
      reasonCode: "PLAN_SECRET_INVALID",
    });
    assert.deepEqual(parseEvidencePlanSecret({
      RIVT_PROVIDER_EVIDENCE_PLAN_JSON: "x".repeat(32 * 1024 + 1),
    }), {
      ok: false,
      reasonCode: "PLAN_SECRET_TOO_LARGE",
    });
    const parsed = parseEvidencePlanSecret({
      RIVT_PROVIDER_EVIDENCE_PLAN_JSON: JSON.stringify(fixture.plan),
    });
    assert.equal(parsed.ok, true);
    assert.deepEqual(parsed.plan, fixture.plan);
  } finally {
    fs.rmSync(fixture.rootDir, { recursive: true, force: true });
  }
});

test("the production evidence workflow validates protected S, E, and A before dependencies", () => {
  const workflow = fs.readFileSync(
    path.join(process.cwd(), ".github/workflows/production-provider-evidence.yml"),
    "utf8",
  );
  const sourceCheckout = workflow.indexOf("name: Check out immutable deployed source");
  const protectionAttestation = workflow.indexOf(
    "name: Verify evidence and approval branches are protected",
  );
  const evidenceCheckout = workflow.indexOf("name: Check out protected evidence overlay");
  const approvalCheckout = workflow.indexOf(
    "name: Check out protected post-evidence approval overlay",
  );
  const evidenceValidation = workflow.indexOf(
    "name: Validate evidence-only overlay before dependencies or provider credentials",
  );
  const approvalValidation = workflow.indexOf(
    "name: Validate protected approval revision before dependencies or provider credentials",
  );
  const dependencyInstall = workflow.indexOf("name: Install locked dependencies without lifecycle scripts");

  assert.equal(workflow.includes("approval_commit:"), true);
  assert.equal(workflow.includes("refs/heads/production-launch-approval"), true);
  assert.equal(workflow.includes("repos/$GITHUB_REPOSITORY/branches/$branch_name"), true);
  assert.equal(workflow.includes("verify_protected_branch \"production-evidence-overlay\""), true);
  assert.equal(workflow.includes("verify_protected_branch \"production-launch-approval\""), true);
  assert.equal(workflow.includes("--require-plan"), true);
  assert.equal(workflow.includes("scripts/provider-approval-overlay.js"), true);
  assert.equal(workflow.includes("--approval-commit \"$RIVT_APPROVAL_COMMIT\""), true);
  assert.equal(workflow.includes("--approval-root \"$RIVT_APPROVAL_ROOT\""), true);
  assert.equal(protectionAttestation >= 0, true);
  assert.equal(sourceCheckout > protectionAttestation, true);
  assert.equal(evidenceCheckout > sourceCheckout, true);
  assert.equal(approvalCheckout > evidenceCheckout, true);
  assert.equal(evidenceValidation > approvalCheckout, true);
  assert.equal(approvalValidation > evidenceValidation, true);
  assert.equal(dependencyInstall > approvalValidation, true);
});

test("incident rehearsal workflow is one manual protected-master job with an exact run identity", () => {
  assert.match(incidentRehearsalWorkflow, /^name: Production Incident Rehearsal$/mu);
  assert.match(
    incidentRehearsalWorkflow,
    /^run-name: "Incident rehearsal: public-health-provider-failure \/ incident-commander"$/mu,
  );
  assert.match(incidentRehearsalWorkflow, /^on:\r?\n  workflow_dispatch:/mu);
  assert.doesNotMatch(
    incidentRehearsalWorkflow,
    /^\s{2}(?:schedule|push|pull_request|workflow_call):/mu,
  );
  assert.doesNotMatch(incidentRehearsalWorkflow, /\bcron:/u);

  const jobsBlock = incidentRehearsalWorkflow.slice(
    incidentRehearsalWorkflow.indexOf("\njobs:\n"),
  );
  const jobNames = [...jobsBlock.matchAll(/^\s{2}([A-Za-z0-9_-]+):\s*$/gmu)]
    .map((match) => match[1]);
  assert.deepEqual(jobNames, ["rehearsal"]);
  assert.match(incidentRehearsalWorkflow, /^\s{4}name: rehearsal$/mu);
  assert.doesNotMatch(incidentRehearsalWorkflow, /\bmatrix:/u);
  assert.doesNotMatch(incidentRehearsalWorkflow, /\bworkflow_call\b/u);
  assert.doesNotMatch(incidentRehearsalWorkflow, /\bcontinue-on-error:/u);
});

test("incident rehearsal workflow fails closed before credentials and binds exact production source", () => {
  const validateSource = incidentRehearsalWorkflow.indexOf(
    "name: Validate protected production source",
  );
  const dependencyInstall = incidentRehearsalWorkflow.indexOf(
    "name: Install locked dependencies without lifecycle scripts",
  );
  const railwayToken = incidentRehearsalWorkflow.indexOf(
    "RIVT_REHEARSAL_RAILWAY_TOKEN",
  );

  assert.match(incidentRehearsalWorkflow, /github\.repository == 'Zboytjbxp\/rivt'/u);
  assert.match(incidentRehearsalWorkflow, /github\.event_name == 'workflow_dispatch'/u);
  assert.match(incidentRehearsalWorkflow, /github\.ref == 'refs\/heads\/master'/u);
  assert.match(
    incidentRehearsalWorkflow,
    /github\.event\.repository\.default_branch == 'master'/u,
  );
  assert.match(incidentRehearsalWorkflow, /github\.ref_protected == true/u);
  assert.match(incidentRehearsalWorkflow, /github\.ref_name == 'master'/u);
  assert.match(incidentRehearsalWorkflow, /^\s{4}environment: production-rehearsal$/mu);
  assert.match(incidentRehearsalWorkflow, /^\s{4}timeout-minutes: 15$/mu);
  assert.match(
    incidentRehearsalWorkflow,
    /RIVT_PRODUCTION_SOURCE_COMMIT.*vars\.RIVT_PRODUCTION_SOURCE_COMMIT/u,
  );
  assert.match(
    incidentRehearsalWorkflow,
    /RIVT_PRODUCTION_SOURCE_COMMIT" != "\$GITHUB_SHA/u,
  );
  assert.equal(validateSource >= 0, true);
  assert.equal(dependencyInstall > validateSource, true);
  assert.equal(railwayToken > dependencyInstall, true);
});

test("incident rehearsal workflow keeps permissions and dependencies read-only and pinned", () => {
  const permissionsStart = incidentRehearsalWorkflow.indexOf("permissions:\n");
  const permissionsEnd = incidentRehearsalWorkflow.indexOf(
    "\nconcurrency:",
    permissionsStart,
  );
  const permissions = incidentRehearsalWorkflow.slice(
    permissionsStart,
    permissionsEnd,
  );

  assert.equal(permissions.trim(), "permissions:\n  contents: read");
  assert.match(incidentRehearsalWorkflow, /cancel-in-progress: false/u);
  assert.match(
    incidentRehearsalWorkflow,
    /actions\/checkout@11d5960a326750d5838078e36cf38b85af677262/u,
  );
  assert.match(
    incidentRehearsalWorkflow,
    /actions\/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020/u,
  );
  const actionRefs = [
    ...incidentRehearsalWorkflow.matchAll(/^\s*uses:\s+([^\s#]+)(?:\s+#.*)?$/gmu),
  ].map((match) => match[1]);
  assert.equal(actionRefs.length, 2);
  for (const actionRef of actionRefs) {
    assert.match(actionRef, /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+@[a-f0-9]{40}$/u);
  }
  assert.match(incidentRehearsalWorkflow, /persist-credentials: false/u);
  assert.match(incidentRehearsalWorkflow, /npm ci --ignore-scripts/u);
  assert.match(incidentRehearsalWorkflow, /RAILWAY_CLI_VERSION: 5\.20\.0/u);
  assert.match(
    incidentRehearsalWorkflow,
    /RAILWAY_CLI_ARCHIVE_SHA256: 04669f39998edf6b23644d7c3fbb75bdc53430f981f6bcb4aa1e54e5bfb06471/u,
  );
  assert.match(incidentRehearsalWorkflow, /sha256sum --check --strict/u);
  assert.match(incidentRehearsalWorkflow, /tar -tzf "\$archive"/u);
  assert.doesNotMatch(incidentRehearsalWorkflow, /npm rebuild @railway\/cli/u);
  assert.doesNotMatch(
    incidentRehearsalWorkflow,
    /(?:curl|wget)[^\r\n]*\|\s*(?:ba)?sh/iu,
  );
});

test("incident rehearsal workflow requires complete human scenario attestations", () => {
  for (const input of [
    "controlled_failure_exercised",
    "human_page_received",
    "incident_roles_assigned",
    "recovery_confirmed",
    "kill_switch_decision_recorded",
    "decision_log_reference",
  ]) {
    assert.match(
      incidentRehearsalWorkflow,
      new RegExp(`^\\s{6}${input}:$`, "mu"),
    );
  }
  assert.match(
    incidentRehearsalWorkflow,
    /name: Validate human rehearsal attestations/u,
  );
  assert.match(
    incidentRehearsalWorkflow,
    /Every required human rehearsal attestation must be confirmed/u,
  );
  assert.match(incidentRehearsalWorkflow, /incident-note:/u);
  assert.match(
    incidentRehearsalWorkflow,
    /github\.com\/Zboytjbxp\/rivt\/issues/u,
  );
});

test("incident rehearsal workflow exposes exactly four provider-verifiable critical steps", () => {
  for (const name of [
    "Check production health",
    "Run production monitor",
    "Run live Gate A smoke",
    "Verify incident evidence",
  ]) {
    assert.equal(countIncidentRehearsalStep(name), 1, name);
  }

  assert.match(
    incidentRehearsalWorkflow,
    /node scripts\/production-synthetic-monitor\.js/u,
  );
  assert.match(
    incidentRehearsalWorkflow,
    /node scripts\/live-gate-a-hardening\.js/u,
  );
  assert.match(
    incidentRehearsalWorkflow,
    /providerReceipt: "pending-protected-evidence-revision"/u,
  );
  assert.match(incidentRehearsalWorkflow, /launchAuthorized: false/u);
});

test("incident rehearsal workflow scopes remote execution and withholds raw production output", () => {
  const liveSmokeStart = incidentRehearsalWorkflow.indexOf(
    "name: Run live Gate A smoke",
  );
  const evidenceStart = incidentRehearsalWorkflow.indexOf(
    "name: Verify incident evidence",
  );
  const liveSmoke = incidentRehearsalWorkflow.slice(liveSmokeStart, evidenceStart);

  assert.match(
    liveSmoke,
    /RAILWAY_TOKEN:.*secrets\.RIVT_REHEARSAL_RAILWAY_TOKEN/u,
  );
  assert.match(liveSmoke, /--project "\$RIVT_RAILWAY_PROJECT_ID"/u);
  assert.match(liveSmoke, /--environment "\$RIVT_RAILWAY_ENVIRONMENT_ID"/u);
  assert.match(liveSmoke, /--service "\$RIVT_RAILWAY_SERVICE_ID"/u);
  assert.match(
    liveSmoke,
    /\^\[0-9a-f\]\{8\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{12\}\$/u,
  );
  assert.match(liveSmoke, /EXPECTED_SOURCE_COMMIT="\$EXPECTED_SOURCE_COMMIT"/u);
  assert.doesNotMatch(
    liveSmoke,
    /\n\s+SOURCE_COMMIT="\$EXPECTED_SOURCE_COMMIT"/u,
  );
  assert.ok(
    liveSmoke.includes(
      '${RAILWAY_GIT_COMMIT_SHA:-}" != "${EXPECTED_SOURCE_COMMIT:-}',
    ),
  );
  assert.ok(
    liveSmoke.includes(
      '${RAILWAY_PROJECT_ID:-}" != "${EXPECTED_RAILWAY_PROJECT_ID:-}',
    ),
  );
  assert.ok(
    liveSmoke.includes(
      '${RAILWAY_ENVIRONMENT_ID:-}" != "${EXPECTED_RAILWAY_ENVIRONMENT_ID:-}',
    ),
  );
  assert.ok(
    liveSmoke.includes(
      '${RAILWAY_SERVICE_ID:-}" != "${EXPECTED_RAILWAY_SERVICE_ID:-}',
    ),
  );
  assert.ok(
    liveSmoke.includes('${RAILWAY_ENVIRONMENT_NAME:-}" != "production"'),
  );
  assert.match(
    liveSmoke,
    /EXPECTED_RAILWAY_PROJECT_ID="\$RIVT_RAILWAY_PROJECT_ID"/u,
  );
  assert.match(
    liveSmoke,
    /EXPECTED_RAILWAY_ENVIRONMENT_ID="\$RIVT_RAILWAY_ENVIRONMENT_ID"/u,
  );
  assert.match(
    liveSmoke,
    /EXPECTED_RAILWAY_SERVICE_ID="\$RIVT_RAILWAY_SERVICE_ID"/u,
  );
  assert.match(
    liveSmoke,
    /RIVT_SMOKE_BASE_URL="\$RIVT_MONITOR_BASE_URL"/u,
  );
  assert.match(liveSmoke, /sh -eu -c "'\$remote_guard'"/u);
  assert.ok(
    liveSmoke.indexOf("RAILWAY_GIT_COMMIT_SHA") <
      liveSmoke.indexOf("exec node scripts/live-gate-a-hardening.js"),
    "remote identity guards must run before the production smoke",
  );
  assert.match(
    liveSmoke,
    /payload\?\.build\?\.commit, process\.env\.EXPECTED_SOURCE_COMMIT/u,
  );
  assert.match(liveSmoke, /umask 077/u);
  assert.match(liveSmoke, /trap 'rm -f "\$raw_output"' EXIT/u);
  assert.match(liveSmoke, />"\$raw_output" 2>&1/u);
  assert.doesNotMatch(incidentRehearsalWorkflow, /actions\/upload-artifact/u);
  assert.doesNotMatch(
    incidentRehearsalWorkflow,
    /railway\s+(?:up|deploy|variable|variables|delete)/iu,
  );
  assert.doesNotMatch(
    incidentRehearsalWorkflow,
    /npm run (?:migrate|restore|backup)/iu,
  );
});

test("live Gate A smoke checks migrations without creating or repairing the ledger", () => {
  assert.match(liveGateASmokeSource, /import \{ assertMigrationsCurrent \}/u);
  assert.match(
    liveGateASmokeSource,
    /await assertMigrationsCurrent\(pool\)/u,
  );
  assert.doesNotMatch(liveGateASmokeSource, /\bmigrationStatus\b/u);
});
