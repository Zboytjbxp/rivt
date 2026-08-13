import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  incidentRoutingConfigurationDigest,
} from "../scripts/incident-readiness-check.js";
import {
  evaluateLaunchReadiness,
  paymentProviderConfigurationDigest,
  recoveryPolicyConfigurationDigest,
} from "../scripts/launch-readiness-check.js";
import { sanitizedSuccess } from "../scripts/logical-backup-utils.js";
import { providerEvidenceIdentity } from "../scripts/repository-evidence.js";
import {
  materializeProviderReadiness,
  providerReadinessMaterializerContract,
} from "../scripts/provider-readiness-materializer.js";
import {
  providerEvidencePlanDigest,
  providerReadinessConfigurationDigest,
  sourcePolicyBundleDigest,
} from "../scripts/provider-approval-overlay.js";

const sourceCommit = "a".repeat(40);
const evidenceCommit = "b".repeat(40);
const evidenceOverlayDigest = "c".repeat(64);
const recordedAt = "2026-08-03T14:00:00.000Z";
const latestBackupIdentity = "d".repeat(64);

function digest(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function receipt(controlId, type, provider, fields) {
  return {
    schemaVersion: 1,
    controlId,
    type,
    provider,
    ...fields,
  };
}

function sourcePolicies() {
  return {
    incidentConfig: {
      version: 4,
      status: "approved",
      routeApproval: {
        status: "approved",
        approverRoleId: "founder",
        approvedAt: "2026-08-01T12:00:00.000Z",
        scope: "Named-cohort incident routing plan",
      },
      launchHold: {
        active: true,
        incident: "docs/operations/incidents/credential-containment.md",
        reason: "Containment remains open.",
        setAt: "2026-08-01T12:00:00.000Z",
      },
      primaryOwner: {
        roleId: "incident-commander",
        contactRouteId: "primary-support-route",
      },
      backupOwner: {
        roleId: "backup-incident-owner",
        contactRouteId: "backup-support-route",
      },
      contactRoutes: [
        {
          id: "primary-support-route",
          status: "configured",
          kind: "organization-support-inbox",
        },
        {
          id: "backup-support-route",
          status: "configured",
          kind: "private-incident-roster",
          routeRef: "github-actions-secret:RIVT_BACKUP_ROUTE",
        },
      ],
      supportHours: {
        timezone: "America/New_York",
        coverage: "8am-8pm ET during named-cohort launch",
      },
      alertDestinations: [
        {
          id: "synthetic",
          category: "synthetic_monitor",
          status: "configured",
          provider: "GitHub Actions",
          route: "GitHub issue: Production synthetic check failing",
          frequency: "30 minutes",
        },
        {
          id: "errors",
          category: "error_monitoring",
          status: "configured",
          provider: "Sentry Cloud",
          route: "Sentry project for production API errors",
        },
        {
          id: "paging",
          category: "paging",
          status: "configured",
          provider: "Sentry Cloud issue alert",
          route: "Sentry high-priority issue alert",
          frequency: "Notify on every trigger",
        },
      ],
      rehearsals: [],
      evidenceControls: {
        backupRoute: {
          adapterId: "adapter-backup-support-route",
          controlId: "backup-support-route",
          provider: "github-actions",
          routeId: "backup-support-route",
        },
        syntheticMonitor: {
          adapterId: "adapter-synthetic",
          controlId: "synthetic",
          destinationId: "synthetic",
          provider: "github-actions",
        },
        errorMonitoring: {
          adapterId: "adapter-errors",
          controlId: "errors",
          destinationId: "errors",
          provider: "sentry-cloud",
        },
        paging: {
          adapterId: "adapter-paging",
          controlId: "paging",
          destinationId: "paging",
          provider: "sentry-cloud",
        },
        rehearsal: {
          adapterId: "adapter-rehearsal-2026-08-03",
          controlId: "rehearsal-2026-08-03",
          provider: "railway-production",
          scenario: "public-health-provider-failure",
          commanderRoleId: "incident-commander",
        },
      },
      approvals: {
        founder: { status: "pending" },
        support: { status: "pending" },
        legalSafety: { status: "pending" },
      },
    },
    recoveryPolicy: {
      version: 4,
      status: "approved",
      targets: {
        rpoMinutes: 60,
        rpoBasis: "Named encrypted logical backup artifact.",
        rtoMinutes: 240,
        rtoBasis: "Measured restore plus verification.",
      },
      backupSchedule: { status: "configured", cadenceMinutes: 30, owner: "Michael" },
      missedBackupAlert: {
        status: "tested",
        retryAllowanceMinutes: 15,
        destination: "named paging route",
      },
      backupRetention: {
        days: 30,
        owner: "Michael",
        enforcement: { status: "verified", mode: "provider lifecycle policy" },
      },
      failureDomain: {
        status: "independent",
        primaryProvider: "primary-host",
        backupProvider: "independent-backup-host",
      },
      restoreDrillCadence: {
        days: 30,
        owner: "Michael",
      },
      evidenceControls: {
        backupSchedule: {
          adapterId: "adapter-backup-schedule", controlId: "backup-schedule", provider: "railway",
        },
        latestSuccessfulBackup: {
          adapterId: "adapter-latest-successful-backup", controlId: "latest-successful-backup", provider: "railway",
        },
        missedBackupAlert: {
          adapterId: "adapter-missed-backup-alert", controlId: "missed-backup-alert", provider: "sentry-cloud",
        },
        backupRetention: {
          adapterId: "adapter-backup-retention-enforcement", controlId: "backup-retention-enforcement", provider: "object-storage",
        },
        failureDomain: {
          adapterId: "adapter-backup-failure-domain", controlId: "backup-failure-domain", provider: "independent-backup-host",
        },
        latestNamedArtifactRestore: {
          adapterId: "adapter-named-artifact-restore", controlId: "named-artifact-restore", provider: "railway",
        },
      },
      approvals: {
        founder: { status: "pending" },
        operations: { status: "pending" },
      },
    },
    paymentProviderPolicy: {
      version: 2,
      status: "approved",
      mode: "disabled",
      evidenceControl: {
        adapterId: "adapter-bank-payment-provider-state",
        controlId: "bank-payment-provider-state",
        provider: "railway-stripe",
      },
      desiredProviderState: {
        featureFlagVerifiedOff: true,
        providerDestinationScope: "connected_accounts",
        runtimeScopeAttestation: "unset",
        signedDeliveryVerified: false,
        enabled: false,
        configured: false,
        webhookConfigured: true,
        providerMode: "setup_required",
      },
      approval: { status: "pending" },
    },
  };
}

function evidenceReceipts() {
  const sanitizedRestore = sanitizedSuccess({
    ok: true,
    mode: "restore-and-verify",
    endpoint: "https://s3.us-east-1.amazonaws.com",
    region: "us-east-1",
    bucket: "private-provider-identifier",
    prefix: "rivt/postgres",
    forcePathStyle: false,
    key: "rivt/postgres/2026-08-03T12-00-00.000Z-slot.json.gz.aes256gcm",
    versionId: "private-provider-version",
    sha256: "f".repeat(64),
    tableCount: 82,
    rowCount: 7100,
    restoreDurationMs: 15000,
    verificationDurationMs: 2000,
  });
  return [
    receipt("backup-support-route", "private-route-delivery-test", "github-actions", {
      status: "delivered",
      timestamp: "2026-08-03T13:00:00.000Z",
      routeRef: "github-actions-secret:RIVT_BACKUP_ROUTE",
    }),
    receipt("synthetic", "synthetic-monitor-delivery-test", "github-actions", {
      status: "passed",
      timestamp: "2026-08-03T13:01:00.000Z",
      category: "synthetic_monitor",
      configuredProvider: "GitHub Actions",
      route: "GitHub issue: Production synthetic check failing",
      frequency: "30 minutes",
    }),
    receipt("errors", "error-monitoring-ingestion-test", "sentry-cloud", {
      status: "ingested",
      timestamp: "2026-08-03T13:02:00.000Z",
      category: "error_monitoring",
      configuredProvider: "Sentry Cloud",
      route: "Sentry project for production API errors",
      frequency: null,
    }),
    receipt("paging", "paging-delivery-test", "sentry-cloud", {
      status: "delivered",
      timestamp: "2026-08-03T13:03:00.000Z",
      category: "paging",
      configuredProvider: "Sentry Cloud issue alert",
      route: "Sentry high-priority issue alert",
      frequency: "Notify on every trigger",
    }),
    receipt("rehearsal-2026-08-03", "incident-rehearsal-test", "railway-production", {
      status: "passed",
      timestamp: "2026-08-03T13:04:00.000Z",
      scenario: "public-health-provider-failure",
      commanderRoleId: "incident-commander",
    }),
    receipt("backup-schedule", "provider-backup-schedule", "railway", {
      status: "configured",
      timestamp: "2026-08-03T13:05:00.000Z",
      cadenceMinutes: 30,
      owner: "Michael",
    }),
    receipt("latest-successful-backup", "provider-backup-completion", "railway", {
      status: "passed",
      timestamp: "2026-08-03T13:30:00.000Z",
      artifactIdentitySha256: latestBackupIdentity,
      tableCount: 82,
      rowCount: 7100,
    }),
    receipt("missed-backup-alert", "provider-alert-delivery-test", "sentry-cloud", {
      status: "tested",
      timestamp: "2026-08-03T13:06:00.000Z",
      retryAllowanceMinutes: 15,
      destination: "named paging route",
    }),
    receipt("backup-retention-enforcement", "provider-retention-policy", "object-storage", {
      status: "verified",
      timestamp: "2026-08-03T13:07:00.000Z",
      retentionDays: 30,
      owner: "Michael",
      mode: "provider lifecycle policy",
    }),
    receipt("backup-failure-domain", "provider-failure-domain-verification", "independent-backup-host", {
      status: "independent",
      timestamp: "2026-08-03T13:08:00.000Z",
      primaryProvider: "primary-host",
      backupProvider: "independent-backup-host",
    }),
    receipt("named-artifact-restore", "provider-restore-verification", "railway", {
      status: "passed",
      timestamp: "2026-08-03T13:09:00.000Z",
      artifactIdentitySha256: sanitizedRestore.artifactIdentitySha256,
      tableCount: sanitizedRestore.tableCount,
      rowCount: sanitizedRestore.rowCount,
      restoreDurationMs: sanitizedRestore.restoreDurationMs,
      verificationDurationMs: sanitizedRestore.verificationDurationMs,
    }),
    receipt("bank-payment-provider-state", "provider-payment-state-verification", "railway-stripe", {
      status: "verified",
      timestamp: "2026-08-03T13:10:00.000Z",
      mode: "disabled",
      featureFlagVerifiedOff: true,
      providerDestinationScope: "connected_accounts",
      runtimeScopeAttestation: "unset",
      signedDeliveryVerified: false,
      enabled: false,
      configured: false,
      webhookConfigured: true,
      providerMode: "setup_required",
    }),
  ];
}

function fixture() {
  const policies = sourcePolicies();
  const receipts = evidenceReceipts();
  const claims = receipts.map((value, index) => {
    const evidencePath = `docs/delivery/evidence/railway-stage1/provider/${sourceCommit}/${String(index + 1).padStart(2, "0")}-${value.controlId}.json`;
    return {
      adapterId: `adapter-${value.controlId}`,
      controlId: value.controlId,
      evidencePath,
      evidenceSha256: digest(value),
      expectedReceipt: value,
      provider: value.provider,
      scope: {
        account: "rivt",
        environment: "production",
        project: "rivt",
        resource: value.controlId,
      },
      type: value.type,
    };
  });
  const plan = { schemaVersion: 1, claims };
  const evidenceRecords = claims.map((claim) => ({
    canonicalPath: `C:/validated-evidence/${claim.controlId}.json`,
    path: claim.evidencePath,
    receipt: structuredClone(claim.expectedReceipt),
    sha256: claim.evidenceSha256,
  }));

  const evidenceByControl = Object.fromEntries(receipts.map((value) => [value.controlId, value]));
  const claimByControl = Object.fromEntries(claims.map((claim) => [claim.controlId, claim]));
  const approvalAt = "2026-08-03T13:50:00.000Z";
  const incidentConfig = structuredClone(policies.incidentConfig);
  incidentConfig.contactRoutes[1] = {
    ...incidentConfig.contactRoutes[1],
    evidenceProvider: evidenceByControl["backup-support-route"].provider,
    lastVerifiedAt: evidenceByControl["backup-support-route"].timestamp,
    evidencePath: claimByControl["backup-support-route"].evidencePath,
    evidenceSha256: claimByControl["backup-support-route"].evidenceSha256,
  };
  for (const destination of incidentConfig.alertDestinations) {
    const value = evidenceByControl[destination.id];
    const claim = claimByControl[destination.id];
    Object.assign(destination, {
      evidenceProvider: value.provider,
      lastVerifiedAt: value.timestamp,
      evidencePath: claim.evidencePath,
      evidenceSha256: claim.evidenceSha256,
    });
  }
  const rehearsal = evidenceByControl["rehearsal-2026-08-03"];
  incidentConfig.rehearsals = [{
    id: rehearsal.controlId,
    status: rehearsal.status,
    completedAt: rehearsal.timestamp,
    scenario: rehearsal.scenario,
    commanderRoleId: rehearsal.commanderRoleId,
    evidenceProvider: rehearsal.provider,
    evidencePath: claimByControl[rehearsal.controlId].evidencePath,
    evidenceSha256: claimByControl[rehearsal.controlId].evidenceSha256,
  }];
  incidentConfig.approvals = {
    founder: { status: "approved", approverRoleId: "founder", approvedAt: approvalAt },
    support: { status: "approved", approverRoleId: "support-owner", approvedAt: approvalAt },
    legalSafety: { status: "approved", approverRoleId: "legal-safety-owner", approvedAt: approvalAt },
  };

  const recoveryPolicy = structuredClone(policies.recoveryPolicy);
  const evidenceFields = (controlId, timestampField) => ({
    [timestampField]: evidenceByControl[controlId].timestamp,
    evidenceProvider: evidenceByControl[controlId].provider,
    evidence: claimByControl[controlId].evidencePath,
    evidenceSha256: claimByControl[controlId].evidenceSha256,
  });
  Object.assign(recoveryPolicy.backupSchedule, evidenceFields("backup-schedule", "verifiedAt"));
  recoveryPolicy.latestSuccessfulBackup = {
    status: "passed",
    completedAt: evidenceByControl["latest-successful-backup"].timestamp,
    artifactIdentitySha256: evidenceByControl["latest-successful-backup"].artifactIdentitySha256,
    tableCount: evidenceByControl["latest-successful-backup"].tableCount,
    rowCount: evidenceByControl["latest-successful-backup"].rowCount,
    ...evidenceFields("latest-successful-backup", "completedAt"),
  };
  Object.assign(recoveryPolicy.missedBackupAlert, evidenceFields("missed-backup-alert", "lastTestedAt"));
  Object.assign(recoveryPolicy.backupRetention.enforcement, evidenceFields("backup-retention-enforcement", "verifiedAt"));
  Object.assign(recoveryPolicy.failureDomain, evidenceFields("backup-failure-domain", "verifiedAt"));
  const restore = evidenceByControl["named-artifact-restore"];
  recoveryPolicy.latestNamedArtifactRestore = {
    status: restore.status,
    completedAt: restore.timestamp,
    artifactIdentitySha256: restore.artifactIdentitySha256,
    tableCount: restore.tableCount,
    rowCount: restore.rowCount,
    restoreDurationMs: restore.restoreDurationMs,
    verificationDurationMs: restore.verificationDurationMs,
    ...evidenceFields("named-artifact-restore", "completedAt"),
  };
  recoveryPolicy.restoreDrillCadence.nextDueAt = "2026-09-02T13:09:00.000Z";
  recoveryPolicy.approvals = {
    founder: { status: "approved", approvedBy: "founder", approvedAt: approvalAt },
    operations: { status: "approved", approvedBy: "operations-owner", approvedAt: approvalAt },
  };

  const paymentProviderPolicy = structuredClone(policies.paymentProviderPolicy);
  const paymentReceipt = evidenceByControl["bank-payment-provider-state"];
  const paymentClaim = claimByControl["bank-payment-provider-state"];
  Object.assign(paymentProviderPolicy, {
    featureFlagVerifiedOff: paymentReceipt.featureFlagVerifiedOff,
    providerDestinationScope: paymentReceipt.providerDestinationScope,
    runtimeScopeAttestation: paymentReceipt.runtimeScopeAttestation,
    signedDeliveryVerified: paymentReceipt.signedDeliveryVerified,
    verifiedAt: paymentReceipt.timestamp,
    evidenceProvider: paymentReceipt.provider,
    evidence: paymentClaim.evidencePath,
    evidenceSha256: paymentClaim.evidenceSha256,
    verifiedProductionState: {
      enabled: paymentReceipt.enabled,
      configured: paymentReceipt.configured,
      webhookConfigured: paymentReceipt.webhookConfigured,
      mode: paymentReceipt.providerMode,
    },
    approval: { status: "approved", approvedBy: "operations-owner", approvedAt: approvalAt },
  });

  const incidentDigest = incidentRoutingConfigurationDigest(incidentConfig);
  const recoveryDigest = recoveryPolicyConfigurationDigest(recoveryPolicy);
  const paymentDigest = paymentProviderConfigurationDigest(paymentProviderPolicy);
  for (const approval of Object.values(incidentConfig.approvals)) approval.configurationDigest = incidentDigest;
  for (const approval of Object.values(recoveryPolicy.approvals)) approval.configurationDigest = recoveryDigest;
  paymentProviderPolicy.approval.configurationDigest = paymentDigest;
  const holdDigest = providerReadinessConfigurationDigest({
    incidentConfig,
    recoveryPolicy,
    paymentProviderPolicy,
  });

  const evidenceBindings = claims
    .map(({ adapterId, controlId, evidencePath, evidenceSha256, provider, type }) => ({
      adapterId,
      controlId,
      evidencePath,
      evidenceSha256,
      provider,
      type,
    }))
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  const approvalManifest = {
    schemaVersion: 1,
    sourceCommit,
    evidenceCommit,
    evidenceOverlayDigest,
    evidencePlanDigest: providerEvidencePlanDigest(plan),
    sourcePolicyDigest: sourcePolicyBundleDigest(policies),
    evidenceBindings,
    approvals: {
      incident: {
        founder: { status: "approved", approverRoleId: "founder", approvedAt: approvalAt, configurationDigest: incidentDigest },
        support: { status: "approved", approverRoleId: "support-owner", approvedAt: approvalAt, configurationDigest: incidentDigest },
        legalSafety: { status: "approved", approverRoleId: "legal-safety-owner", approvedAt: approvalAt, configurationDigest: incidentDigest },
      },
      recovery: {
        founder: { status: "approved", approverRoleId: "founder", approvedAt: approvalAt, configurationDigest: recoveryDigest },
        operations: { status: "approved", approverRoleId: "operations-owner", approvedAt: approvalAt, configurationDigest: recoveryDigest },
      },
      payment: { status: "approved", approverRoleId: "operations-owner", approvedAt: approvalAt, configurationDigest: paymentDigest },
    },
    hold: {
      status: "cleared",
      decidedByRoleId: "founder",
      decidedAt: approvalAt,
      incident: policies.incidentConfig.launchHold.incident,
      reason: "All recorded containment exit criteria passed.",
      configurationDigest: holdDigest,
    },
    recordedAt,
  };
  return {
    approvalManifest,
    evidenceCommit,
    evidenceOverlayDigest,
    evidenceRecords,
    expected: { incidentConfig, recoveryPolicy, paymentProviderPolicy },
    plan,
    policies,
    sourceCommit,
  };
}

function refreshPlanBindings(input) {
  input.approvalManifest.evidencePlanDigest = providerEvidencePlanDigest(input.plan);
  input.approvalManifest.evidenceBindings = input.plan.claims
    .map(({ adapterId, controlId, evidencePath, evidenceSha256, provider, type }) => ({
      adapterId, controlId, evidencePath, evidenceSha256, provider, type,
    }))
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
}

test("materializes exact volatile evidence and later approvals without mutating S, E, or A", () => {
  const input = fixture();
  const before = structuredClone(input);
  const result = materializeProviderReadiness(input);

  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(input.plan.claims.length, 12);
  assert.deepEqual(input, before);
  assert.deepEqual(result.incidentConfig, input.expected.incidentConfig);
  assert.deepEqual(result.recoveryPolicy, input.expected.recoveryPolicy);
  assert.deepEqual(result.paymentProviderPolicy, input.expected.paymentProviderPolicy);
  assert.equal(result.holdContext.status, "cleared");
  assert.deepEqual(Object.keys(result.holdContext).sort(), [
    "configurationDigest", "decidedAt", "decidedByRoleId", "incident", "reason", "status",
  ].sort());
  assert.equal(result.readinessEvidence.recoveryEvidenceByPath[
    input.plan.claims.find((claim) => claim.controlId === "backup-schedule").evidencePath
  ].receipt.controlId, "backup-schedule");
  assert.equal(result.readinessEvidence.paymentProviderEvidence.receipt.controlId, "bank-payment-provider-state");
});

test("materialized S, E, and A inputs satisfy the real launch-readiness evaluator", () => {
  const input = fixture();
  const evidenceRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rivt-readiness-materializer-"));
  try {
    for (const evidence of input.evidenceRecords) {
      const resolvedPath = path.join(evidenceRoot, evidence.path);
      fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
      fs.writeFileSync(resolvedPath, JSON.stringify(evidence.receipt), "utf8");
      evidence.canonicalPath = fs.realpathSync(resolvedPath);
    }

    const materialized = materializeProviderReadiness(input);
    assert.equal(materialized.ok, true, JSON.stringify(materialized));
    const externallyVerifiedEvidence = new Set(input.evidenceRecords.map((evidence) => (
      providerEvidenceIdentity({
        controlId: evidence.receipt.controlId,
        provider: evidence.receipt.provider,
        sha256: evidence.sha256,
      })
    )));

    const readiness = evaluateLaunchReadiness({
      incidentConfig: materialized.incidentConfig,
      paymentProviderPolicy: materialized.paymentProviderPolicy,
      recoveryPolicy: materialized.recoveryPolicy,
    }, {
      externallyVerifiedEvidence,
      incidentEvidenceRoot: evidenceRoot,
      launchHoldClearance: materialized.holdContext,
      now: new Date(recordedAt),
      paymentProviderEvidence: materialized.readinessEvidence.paymentProviderEvidence,
      recoveryEvidenceByPath: materialized.readinessEvidence.recoveryEvidenceByPath,
      recoveryEvidenceSha256ByPath:
        materialized.readinessEvidence.recoveryEvidenceSha256ByPath,
    });

    assert.equal(readiness.ok, true, JSON.stringify(readiness));
    assert.deepEqual(readiness.findings, []);
    assert.equal(readiness.summary.sourceLaunchHoldActive, true);
    assert.equal(readiness.summary.launchHoldClearanceApplied, true);
    assert.equal(readiness.summary.activeLaunchHold, false);
  } finally {
    fs.rmSync(evidenceRoot, { force: true, recursive: true });
  }
});

test("fails closed on unknown, missing, and duplicate stable control identities", () => {
  const unknown = fixture();
  unknown.plan.claims[0].controlId = "unknown-control";
  unknown.plan.claims[0].expectedReceipt.controlId = "unknown-control";
  unknown.plan.claims[0].evidenceSha256 = digest(unknown.plan.claims[0].expectedReceipt);
  unknown.evidenceRecords[0].receipt.controlId = "unknown-control";
  unknown.evidenceRecords[0].sha256 = unknown.plan.claims[0].evidenceSha256;
  refreshPlanBindings(unknown);
  assert.equal(materializeProviderReadiness(unknown).findingCodes.includes("MATERIALIZER_CONTROL_UNKNOWN"), true);

  const missing = fixture();
  missing.plan.claims.pop();
  missing.evidenceRecords.pop();
  refreshPlanBindings(missing);
  assert.equal(materializeProviderReadiness(missing).findingCodes.includes("MATERIALIZER_CONTROL_MISSING"), true);

  const duplicate = fixture();
  duplicate.policies.recoveryPolicy.evidenceControls.backupSchedule.controlId = "synthetic";
  duplicate.approvalManifest.sourcePolicyDigest = sourcePolicyBundleDigest(duplicate.policies);
  assert.equal(materializeProviderReadiness(duplicate).findingCodes.includes("MATERIALIZER_CONTROL_DUPLICATE"), true);
});

test("rejects plan, receipt, source, evidence, and approval binding changes", () => {
  const cases = [
    ["MATERIALIZER_RECEIPT_MISMATCH", (input) => { input.evidenceRecords[0].receipt.status = "failed"; }],
    ["MATERIALIZER_SOURCE_BINDING_MISMATCH", (input) => { input.approvalManifest.sourceCommit = "d".repeat(40); }],
    ["MATERIALIZER_EVIDENCE_BINDING_MISMATCH", (input) => { input.approvalManifest.evidenceCommit = "e".repeat(40); }],
    ["MATERIALIZER_OVERLAY_BINDING_MISMATCH", (input) => { input.approvalManifest.evidenceOverlayDigest = "f".repeat(64); }],
    ["MATERIALIZER_PLAN_BINDING_MISMATCH", (input) => { input.approvalManifest.evidencePlanDigest = "0".repeat(64); }],
    ["MATERIALIZER_POLICY_BINDING_MISMATCH", (input) => { input.policies.recoveryPolicy.targets.rpoMinutes = 120; }],
    ["MATERIALIZER_APPROVAL_SCHEMA_INVALID", (input) => { input.approvalManifest.approvals.payment.status = "pending"; }],
    ["MATERIALIZER_APPROVAL_DIGEST_MISMATCH", (input) => { input.approvalManifest.approvals.payment.configurationDigest = "1".repeat(64); }],
    ["MATERIALIZER_HOLD_DIGEST_MISMATCH", (input) => { input.approvalManifest.hold.configurationDigest = "2".repeat(64); }],
    ["MATERIALIZER_HOLD_INCIDENT_MISMATCH", (input) => { input.approvalManifest.hold.incident = "docs/operations/incidents/unrelated.md"; }],
  ];
  for (const [code, mutate] of cases) {
    const input = fixture();
    mutate(input);
    const result = materializeProviderReadiness(input);
    assert.equal(result.ok, false, code);
    assert.equal(result.findingCodes.includes(code), true, `${code}: ${JSON.stringify(result)}`);
    assert.equal(Object.hasOwn(result, "incidentConfig"), false);
  }
});

test("rejects private backup object keys even when plan and evidence agree", () => {
  const input = fixture();
  const index = input.plan.claims.findIndex((claim) => claim.controlId === "latest-successful-backup");
  const changed = { ...input.plan.claims[index].expectedReceipt };
  delete changed.artifactIdentitySha256;
  changed.artifactKey = "private/backups/postgres/named-object.json.gz.aes256gcm";
  const changedDigest = digest(changed);
  input.plan.claims[index].expectedReceipt = changed;
  input.plan.claims[index].evidenceSha256 = changedDigest;
  input.evidenceRecords[index].receipt = structuredClone(changed);
  input.evidenceRecords[index].sha256 = changedDigest;
  refreshPlanBindings(input);

  const result = materializeProviderReadiness(input);
  assert.equal(result.ok, false);
  assert.equal(result.findingCodes.includes("MATERIALIZER_RECEIPT_MISMATCH"), true);
});

test("rejects impossible backup aggregate counts even when plan and evidence agree", () => {
  for (const [controlId, field, value] of [
    ["latest-successful-backup", "tableCount", 0.5],
    ["latest-successful-backup", "rowCount", Number.MAX_SAFE_INTEGER + 1],
    ["named-artifact-restore", "tableCount", 0.5],
    ["named-artifact-restore", "rowCount", Number.MAX_SAFE_INTEGER + 1],
  ]) {
    const input = fixture();
    const index = input.plan.claims.findIndex((claim) => claim.controlId === controlId);
    const changed = { ...input.plan.claims[index].expectedReceipt, [field]: value };
    const changedDigest = digest(changed);
    input.plan.claims[index].expectedReceipt = changed;
    input.plan.claims[index].evidenceSha256 = changedDigest;
    input.evidenceRecords[index].receipt = structuredClone(changed);
    input.evidenceRecords[index].sha256 = changedDigest;
    refreshPlanBindings(input);

    const result = materializeProviderReadiness(input);
    assert.equal(result.ok, false, `${controlId}.${field}`);
    assert.equal(
      result.findingCodes.includes("MATERIALIZER_POLICY_OVERRIDE_ATTEMPT"),
      true,
      `${controlId}.${field}`,
    );
  }
});

test("checked-in source policies declare exactly 12 adapter- and provider-pinned controls", () => {
  const readJson = (relativePath) => JSON.parse(fs.readFileSync(
    new URL(`../${relativePath}`, import.meta.url),
    "utf8",
  ));
  const incident = readJson("docs/operations/incident-routing.json");
  const recovery = readJson("docs/operations/recovery-policy.json");
  const payment = readJson("docs/operations/payment-provider-readiness.json");
  const declared = [
    ...Object.entries(incident.evidenceControls).map(([slot, control]) => ({
      area: "incident", slot, control,
    })),
    ...Object.entries(recovery.evidenceControls).map(([slot, control]) => ({
      area: "recovery", slot, control,
    })),
    { area: "payment", slot: "providerState", control: payment.evidenceControl },
  ];

  assert.equal(declared.length, 12);
  assert.equal(new Set(declared.map(({ control }) => control.controlId)).size, 12);
  for (const { area, slot, control } of declared) {
    const contract = area === "payment"
      ? providerReadinessMaterializerContract.payment
      : providerReadinessMaterializerContract[area][slot];
    assert.deepEqual(Object.keys(control).sort(), [...contract.sourceKeys].sort(), `${area}.${slot}`);
    assert.match(control.adapterId, /^[a-z0-9][a-z0-9-]+$/u, `${area}.${slot}.adapterId`);
    assert.match(control.provider, /^[a-z0-9][a-z0-9-]+$/u, `${area}.${slot}.provider`);
  }
  assert.equal(incident.launchHold.active, true);
  assert.equal(payment.mode, "disabled");
  assert.equal(Object.hasOwn(recovery.restoreDrillCadence, "nextDueAt"), false);
});

test("materializes recovery readiness status and next drill date only from fresh evidence", () => {
  const input = fixture();
  input.policies.recoveryPolicy.backupSchedule.status = "pending_evidence";
  input.policies.recoveryPolicy.missedBackupAlert.status = "pending_evidence";
  input.policies.recoveryPolicy.backupRetention.enforcement.status = "pending_evidence";
  input.policies.recoveryPolicy.failureDomain.status = "pending_evidence";
  input.approvalManifest.sourcePolicyDigest = sourcePolicyBundleDigest(input.policies);

  const result = materializeProviderReadiness(input);
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.recoveryPolicy.backupSchedule.status, "configured");
  assert.equal(result.recoveryPolicy.missedBackupAlert.status, "tested");
  assert.equal(result.recoveryPolicy.backupRetention.enforcement.status, "verified");
  assert.equal(result.recoveryPolicy.failureDomain.status, "independent");
  assert.equal(
    result.recoveryPolicy.restoreDrillCadence.nextDueAt,
    "2026-09-02T13:09:00.000Z",
  );
});

test("fails closed instead of throwing when a restore date cannot produce the next due date", () => {
  const input = fixture();
  const index = input.plan.claims.findIndex(
    (claim) => claim.controlId === "named-artifact-restore",
  );
  const changed = {
    ...input.plan.claims[index].expectedReceipt,
    timestamp: "+275760-09-12T00:00:00.000Z",
  };
  input.plan.claims[index].expectedReceipt = changed;
  input.plan.claims[index].evidenceSha256 = digest(changed);
  input.evidenceRecords[index].receipt = structuredClone(changed);
  input.evidenceRecords[index].sha256 = digest(changed);
  refreshPlanBindings(input);

  const result = materializeProviderReadiness(input);
  assert.equal(result.ok, false);
  assert.equal(
    result.findingCodes.includes("MATERIALIZER_DERIVED_TIMESTAMP_INVALID"),
    true,
  );
});

test("rejects adapter and provider substitution even when E and A agree on the substitute", () => {
  for (const field of ["adapterId", "provider"]) {
    const input = fixture();
    const index = input.plan.claims.findIndex((claim) => claim.controlId === "synthetic");
    const substitute = field === "adapterId" ? "substituted-adapter" : "substituted-provider";
    input.plan.claims[index][field] = substitute;
    if (field === "provider") {
      input.plan.claims[index].expectedReceipt.provider = substitute;
      input.plan.claims[index].evidenceSha256 = digest(input.plan.claims[index].expectedReceipt);
      input.evidenceRecords[index].receipt.provider = substitute;
      input.evidenceRecords[index].sha256 = input.plan.claims[index].evidenceSha256;
    }
    refreshPlanBindings(input);

    const result = materializeProviderReadiness(input);
    assert.equal(result.ok, false, field);
    assert.equal(
      result.findingCodes.includes("MATERIALIZER_PLAN_SOURCE_BINDING_MISMATCH"),
      true,
      `${field}: ${JSON.stringify(result)}`,
    );
  }
});

test("legacy unbound payment control IDs fail closed", () => {
  const input = fixture();
  input.policies.paymentProviderPolicy.evidenceControlId =
    input.policies.paymentProviderPolicy.evidenceControl.controlId;
  delete input.policies.paymentProviderPolicy.evidenceControl;
  input.approvalManifest.sourcePolicyDigest = sourcePolicyBundleDigest(input.policies);

  const result = materializeProviderReadiness(input);
  assert.equal(result.ok, false);
  assert.equal(result.findingCodes.includes("MATERIALIZER_PAYMENT_CONTROL_SCHEMA_INVALID"), true);
});

test("rejects evidence that tries to override source policy semantics", () => {
  const input = fixture();
  const index = input.plan.claims.findIndex((claim) => claim.controlId === "backup-schedule");
  const changed = { ...input.plan.claims[index].expectedReceipt, cadenceMinutes: 120 };
  input.plan.claims[index].expectedReceipt = changed;
  input.plan.claims[index].evidenceSha256 = digest(changed);
  input.evidenceRecords[index].receipt = structuredClone(changed);
  input.evidenceRecords[index].sha256 = digest(changed);
  input.approvalManifest.evidencePlanDigest = providerEvidencePlanDigest(input.plan);
  input.approvalManifest.evidenceBindings = input.approvalManifest.evidenceBindings.map((binding) => (
    binding.controlId === "backup-schedule"
      ? { ...binding, evidenceSha256: digest(changed) }
      : binding
  ));

  const result = materializeProviderReadiness(input);
  assert.equal(result.ok, false);
  assert.equal(result.findingCodes.includes("MATERIALIZER_POLICY_OVERRIDE_ATTEMPT"), true);
});
