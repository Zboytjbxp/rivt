import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  evaluateLaunchReadiness as evaluateLaunchReadinessBase,
  paymentProviderConfigurationDigest,
  readPaymentProviderEvidenceSha256,
} from "../scripts/launch-readiness-check.js";

const readyEvidenceBody = "Production feature flag read-only snapshot.";
const readyEvidenceSha256 = crypto.createHash("sha256").update(readyEvidenceBody).digest("hex");

function evaluateLaunchReadiness(input, options = {}) {
  return evaluateLaunchReadinessBase(input, {
    paymentProviderEvidenceSha256: readyEvidenceSha256,
    ...options,
  });
}

const readyIncidentConfig = {
  status: "approved",
  primaryOwner: {
    name: "Michael",
    email: "support@rivt.pro",
  },
  backupOwner: {
    name: "Backup Owner",
    email: "backup@rivt.pro",
  },
  supportHours: {
    timezone: "America/New_York",
    coverage: "8am-8pm ET during named-cohort launch",
  },
  alertDestinations: [
    { id: "synthetic", category: "synthetic_monitor", status: "configured" },
    { id: "errors", category: "error_monitoring", status: "configured" },
    { id: "paging", category: "paging", status: "configured" },
  ],
  rehearsals: [
    { status: "passed", completedAt: "2026-06-20T12:00:00.000Z" },
  ],
  approvals: {
    founder: { status: "approved", approvedBy: "Michael", approvedAt: "2026-06-20T12:00:00.000Z" },
    support: { status: "approved", approvedBy: "Michael", approvedAt: "2026-06-20T12:00:00.000Z" },
    legalSafety: { status: "approved", approvedBy: "Michael", approvedAt: "2026-06-20T12:00:00.000Z" },
  },
};

const readyRecoveryPolicy = {
  status: "approved",
  targets: {
    rpoMinutes: 60,
    rpoBasis: "Named encrypted logical backup artifact plus managed Railway Postgres persistence.",
    rtoMinutes: 240,
    rtoBasis: "Latest measured restore was under 16 seconds; four hours leaves room for provider setup and DNS/app verification.",
  },
  backupRetention: {
    days: 30,
    owner: "Michael",
  },
  restoreDrillCadence: {
    days: 30,
    owner: "Michael",
    nextDueAt: "2026-07-20T12:00:00.000Z",
  },
  latestNamedArtifactRestore: {
    status: "passed",
    completedAt: "2026-06-21T04:18:59.000Z",
    artifactKey: "backups/postgres/2026-06-21T04-14-48.795Z-332dbc0.json.gz.aes256gcm",
    restoreDurationMs: 13411,
    verificationDurationMs: 1862,
  },
  approvals: {
    founder: { status: "approved", approvedBy: "Michael", approvedAt: "2026-06-21T12:00:00.000Z" },
    operations: { status: "approved", approvedBy: "Michael", approvedAt: "2026-06-21T12:00:00.000Z" },
  },
};

const readyPaymentProviderConfiguration = {
  version: 1,
  status: "approved",
  mode: "disabled",
  featureFlagVerifiedOff: true,
  providerDestinationScope: "connected_accounts",
  runtimeScopeAttestation: "unset",
  signedDeliveryVerified: false,
  verifiedAt: "2026-06-21T12:00:00.000Z",
  evidence: "docs/evidence/provider-snapshot.md",
  evidenceSha256: readyEvidenceSha256,
  verifiedProductionState: {
    sourceCommit: "a".repeat(40),
    enabled: false,
    configured: false,
    webhookConfigured: true,
    mode: "setup_required",
  },
};
function withPaymentApproval(configuration, approvalOverrides = {}) {
  const policy = {
    ...configuration,
    approval: {
      status: "approved",
      approvedBy: "Michael",
      approvedAt: "2026-06-21T12:00:00.000Z",
      ...approvalOverrides,
    },
  };
  return {
    ...policy,
    approval: {
      ...policy.approval,
      configurationDigest: paymentProviderConfigurationDigest(policy),
    },
  };
}
const readyPaymentProviderPolicy = withPaymentApproval(readyPaymentProviderConfiguration);

test("launch readiness passes only when incident and recovery policy evidence are approved", () => {
  const result = evaluateLaunchReadiness({
    incidentConfig: readyIncidentConfig,
    recoveryPolicy: readyRecoveryPolicy,
    paymentProviderPolicy: readyPaymentProviderPolicy,
  }, { now: new Date("2026-06-21T12:00:00.000Z") });

  assert.equal(result.ok, true);
  assert.equal(result.status, "ready");
  assert.deepEqual(result.findings, []);
});

test("launch readiness reports recovery policy gaps without hiding incident gaps", () => {
  const result = evaluateLaunchReadiness({
    incidentConfig: {
      ...readyIncidentConfig,
      status: "blocked",
      alertDestinations: [{ id: "synthetic", category: "synthetic_monitor", status: "configured" }],
      rehearsals: [],
    },
    recoveryPolicy: {
      ...readyRecoveryPolicy,
      status: "blocked",
      targets: { rpoMinutes: null, rpoBasis: "TBD", rtoMinutes: null, rtoBasis: "TBD" },
      backupRetention: { days: null, owner: "TBD" },
      restoreDrillCadence: { days: null, owner: "TBD", nextDueAt: null },
      latestNamedArtifactRestore: { status: "missing" },
      approvals: {},
    },
    paymentProviderPolicy: readyPaymentProviderPolicy,
  }, { now: new Date("2026-06-21T12:00:00.000Z") });

  assert.equal(result.ok, false);
  assert.deepEqual(result.findings.map((finding) => finding.code), [
    "INCIDENT_ROUTING_NOT_APPROVED",
    "ERROR_MONITORING_MISSING",
    "PAGING_ROUTE_MISSING",
    "INCIDENT_REHEARSAL_MISSING",
    "RECOVERY_POLICY_NOT_APPROVED",
    "RPO_TARGET_MISSING",
    "RTO_TARGET_MISSING",
    "BACKUP_RETENTION_MISSING",
    "RESTORE_CADENCE_MISSING",
    "NEXT_RESTORE_DRILL_MISSING",
    "RECENT_BACKUP_ARTIFACT_RESTORE_MISSING",
    "RECOVERY_APPROVAL_FOUNDER_MISSING",
    "RECOVERY_APPROVAL_OPERATIONS_MISSING",
  ]);
  assert.deepEqual(new Set(result.findings.map((finding) => finding.source)), new Set(["incident", "recovery"]));
});

test("launch readiness rejects future-dated restore evidence", () => {
  const result = evaluateLaunchReadiness({
    incidentConfig: readyIncidentConfig,
    recoveryPolicy: {
      ...readyRecoveryPolicy,
      latestNamedArtifactRestore: {
        ...readyRecoveryPolicy.latestNamedArtifactRestore,
        completedAt: "2026-07-21T12:00:00.000Z",
      },
    },
    paymentProviderPolicy: readyPaymentProviderPolicy,
  }, { now: new Date("2026-06-21T12:00:00.000Z") });

  assert.equal(result.ok, false);
  assert.deepEqual(result.findings.map((finding) => finding.code), ["RECENT_BACKUP_ARTIFACT_RESTORE_MISSING"]);
});

test("launch readiness fails closed while an explicit incident hold is active", () => {
  const result = evaluateLaunchReadiness({
    incidentConfig: {
      ...readyIncidentConfig,
      launchHold: {
        active: true,
        reason: "Emergency credential containment remains open.",
      },
    },
    recoveryPolicy: readyRecoveryPolicy,
    paymentProviderPolicy: readyPaymentProviderPolicy,
  }, { now: new Date("2026-06-21T12:00:00.000Z") });

  assert.equal(result.ok, false);
  assert.equal(result.status, "blocked");
  assert.equal(result.summary.activeLaunchHold, true);
  assert.deepEqual(result.findings, [{
    code: "ACTIVE_LAUNCH_HOLD",
    message: "Emergency credential containment remains open.",
    source: "incident",
  }]);
});

test("launch readiness fails closed when bank-payment launch state is not approved", () => {
  const result = evaluateLaunchReadiness({
    incidentConfig: readyIncidentConfig,
    recoveryPolicy: readyRecoveryPolicy,
    paymentProviderPolicy: { status: "blocked", mode: "unknown" },
  }, { now: new Date("2026-06-21T12:00:00.000Z") });

  assert.equal(result.ok, false);
  assert.deepEqual(result.findings, [{
    code: "PAYMENT_PROVIDER_NOT_APPROVED",
    message: "Bank-payment configuration requires a current named approval; enabled mode also requires verified Connected accounts signed delivery.",
    source: "payment_provider",
  }]);
});

test("enabled bank payments require current Connected accounts signed-delivery proof", () => {
  const enabledConfiguration = {
    version: 1,
    status: "approved",
    mode: "enabled",
    providerDestinationScope: "your_account",
    runtimeScopeAttestation: "unset",
    signedDeliveryVerified: false,
    verifiedAt: "2026-06-21T12:00:00.000Z",
    evidence: readyPaymentProviderConfiguration.evidence,
    evidenceSha256: readyEvidenceSha256,
    verifiedProductionState: {
      sourceCommit: "a".repeat(40),
      enabled: true,
      configured: true,
      webhookConfigured: true,
      mode: "configured",
    },
  };
  const result = evaluateLaunchReadiness({
    incidentConfig: readyIncidentConfig,
    recoveryPolicy: readyRecoveryPolicy,
    paymentProviderPolicy: withPaymentApproval(enabledConfiguration),
  }, { now: new Date("2026-06-21T12:00:00.000Z") });

  assert.equal(result.ok, false);
  assert.deepEqual(result.findings.map((finding) => finding.code), ["CONNECTED_ACCOUNT_WEBHOOK_UNVERIFIED"]);
});

test("enabled bank payments pass with current Connected accounts signed-delivery proof", () => {
  const enabledConfiguration = {
    version: 1,
    status: "approved",
    mode: "enabled",
    featureFlagVerifiedOff: false,
    providerDestinationScope: "connected_accounts",
    runtimeScopeAttestation: "connected_accounts",
    signedDeliveryVerified: true,
    verifiedAt: "2026-06-21T12:00:00.000Z",
    evidence: readyPaymentProviderConfiguration.evidence,
    evidenceSha256: readyEvidenceSha256,
    verifiedProductionState: {
      sourceCommit: "a".repeat(40),
      enabled: true,
      configured: true,
      webhookConfigured: true,
      mode: "configured",
    },
  };
  const result = evaluateLaunchReadiness({
    incidentConfig: readyIncidentConfig,
    recoveryPolicy: readyRecoveryPolicy,
    paymentProviderPolicy: withPaymentApproval(enabledConfiguration),
  }, { now: new Date("2026-06-21T12:00:00.000Z") });

  assert.equal(result.ok, true);
});

test("bank-payment approval expires even when the provider evidence remains current", () => {
  const policy = {
    ...readyPaymentProviderConfiguration,
    verifiedAt: "2026-06-20T12:00:00.000Z",
  };
  const result = evaluateLaunchReadiness({
    incidentConfig: readyIncidentConfig,
    recoveryPolicy: readyRecoveryPolicy,
    paymentProviderPolicy: withPaymentApproval(policy, {
      approvedAt: "2026-05-20T12:00:00.000Z",
    }),
  }, { now: new Date("2026-06-21T12:00:00.000Z") });

  assert.deepEqual(result.findings.map((finding) => finding.code), ["PAYMENT_PROVIDER_APPROVAL_STALE"]);
});

test("bank-payment approval cannot predate provider verification", () => {
  const policy = {
    ...readyPaymentProviderConfiguration,
    verifiedAt: "2026-06-21T11:00:00.000Z",
  };
  const result = evaluateLaunchReadiness({
    incidentConfig: readyIncidentConfig,
    recoveryPolicy: readyRecoveryPolicy,
    paymentProviderPolicy: withPaymentApproval(policy, {
      approvedAt: "2026-06-21T10:59:59.000Z",
    }),
  }, { now: new Date("2026-06-21T12:00:00.000Z") });

  assert.deepEqual(result.findings.map((finding) => finding.code), ["PAYMENT_PROVIDER_APPROVAL_STALE"]);
});

test("bank-payment approval cannot be future-dated", () => {
  const result = evaluateLaunchReadiness({
    incidentConfig: readyIncidentConfig,
    recoveryPolicy: readyRecoveryPolicy,
    paymentProviderPolicy: withPaymentApproval(readyPaymentProviderConfiguration, {
      approvedAt: "2026-06-22T12:00:00.000Z",
    }),
  }, { now: new Date("2026-06-21T12:00:00.000Z") });

  assert.deepEqual(result.findings.map((finding) => finding.code), ["PAYMENT_PROVIDER_APPROVAL_STALE"]);
});

test("bank-payment approval is invalidated when reviewed evidence changes", () => {
  const result = evaluateLaunchReadiness({
    incidentConfig: readyIncidentConfig,
    recoveryPolicy: readyRecoveryPolicy,
    paymentProviderPolicy: {
      ...readyPaymentProviderPolicy,
      evidence: "A different production snapshot.",
    },
  }, { now: new Date("2026-06-21T12:00:00.000Z") });

  assert.deepEqual(
    result.findings.map((finding) => finding.code),
    ["PAYMENT_PROVIDER_APPROVAL_EVIDENCE_MISMATCH"],
  );
});

test("provider destination inventory cannot substitute for runtime scope attestation", () => {
  const enabledConfiguration = {
    ...readyPaymentProviderConfiguration,
    mode: "enabled",
    featureFlagVerifiedOff: false,
    providerDestinationScope: "connected_accounts",
    runtimeScopeAttestation: "unset",
    signedDeliveryVerified: true,
    verifiedProductionState: {
      ...readyPaymentProviderConfiguration.verifiedProductionState,
      enabled: true,
      configured: true,
      mode: "configured",
    },
  };
  const result = evaluateLaunchReadiness({
    incidentConfig: readyIncidentConfig,
    recoveryPolicy: readyRecoveryPolicy,
    paymentProviderPolicy: withPaymentApproval(enabledConfiguration),
  }, { now: new Date("2026-06-21T12:00:00.000Z") });

  assert.deepEqual(result.findings.map((finding) => finding.code), [
    "CONNECTED_ACCOUNT_WEBHOOK_UNVERIFIED",
  ]);
});

test("bank-payment approval is invalidated when evidence content changes in place", () => {
  const result = evaluateLaunchReadiness({
    incidentConfig: readyIncidentConfig,
    recoveryPolicy: readyRecoveryPolicy,
    paymentProviderPolicy: readyPaymentProviderPolicy,
  }, {
    now: new Date("2026-06-21T12:00:00.000Z"),
    paymentProviderEvidenceSha256: crypto
      .createHash("sha256")
      .update("Edited evidence at the same path.")
      .digest("hex"),
  });

  assert.deepEqual(result.findings.map((finding) => finding.code), [
    "PAYMENT_PROVIDER_EVIDENCE_CONTENT_MISMATCH",
  ]);
});

test("payment-provider evidence hashing reads only a repository-relative file", () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "rivt-provider-evidence-"));
  try {
    fs.mkdirSync(path.join(rootDir, "docs"));
    fs.writeFileSync(path.join(rootDir, "docs", "receipt.md"), readyEvidenceBody);

    assert.equal(
      readPaymentProviderEvidenceSha256({ evidence: "docs/receipt.md" }, { rootDir }),
      readyEvidenceSha256,
    );
    assert.equal(
      readPaymentProviderEvidenceSha256({ evidence: "../outside.md" }, { rootDir }),
      null,
    );
    assert.equal(
      readPaymentProviderEvidenceSha256(
        { evidence: path.join(rootDir, "docs", "receipt.md") },
        { rootDir },
      ),
      null,
    );
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test("bank-payment approval digest binds approver identity and timestamp", () => {
  for (const approvalChange of [
    { approvedBy: "Different Person" },
    { approvedAt: "2026-06-21T12:00:01.000Z" },
  ]) {
    const result = evaluateLaunchReadiness({
      incidentConfig: readyIncidentConfig,
      recoveryPolicy: readyRecoveryPolicy,
      paymentProviderPolicy: {
        ...readyPaymentProviderPolicy,
        approval: {
          ...readyPaymentProviderPolicy.approval,
          ...approvalChange,
        },
      },
    }, { now: new Date("2026-06-21T13:00:00.000Z") });

    assert.deepEqual(result.findings.map((finding) => finding.code), [
      "PAYMENT_PROVIDER_APPROVAL_EVIDENCE_MISMATCH",
    ]);
  }
});

test("enabled bank payments reject a contradictory verified-off feature flag", () => {
  const enabledConfiguration = {
    ...readyPaymentProviderConfiguration,
    mode: "enabled",
    featureFlagVerifiedOff: true,
    providerDestinationScope: "connected_accounts",
    runtimeScopeAttestation: "connected_accounts",
    signedDeliveryVerified: true,
    verifiedProductionState: {
      ...readyPaymentProviderConfiguration.verifiedProductionState,
      enabled: true,
      configured: true,
      mode: "configured",
    },
  };
  const result = evaluateLaunchReadiness({
    incidentConfig: readyIncidentConfig,
    recoveryPolicy: readyRecoveryPolicy,
    paymentProviderPolicy: withPaymentApproval(enabledConfiguration),
  }, { now: new Date("2026-06-21T12:00:00.000Z") });

  assert.deepEqual(result.findings.map((finding) => finding.code), [
    "CONNECTED_ACCOUNT_WEBHOOK_UNVERIFIED",
  ]);
});

test("payment-provider evidence hashing is stable across LF and CRLF checkouts", () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "rivt-provider-line-endings-"));
  try {
    fs.mkdirSync(path.join(rootDir, "docs"));
    const evidencePath = path.join(rootDir, "docs", "receipt.md");
    fs.writeFileSync(evidencePath, "First line.\nSecond line.\n");
    const lfHash = readPaymentProviderEvidenceSha256(
      { evidence: "docs/receipt.md" },
      { rootDir },
    );
    fs.writeFileSync(evidencePath, "First line.\r\nSecond line.\r\n");
    const crlfHash = readPaymentProviderEvidenceSha256(
      { evidence: "docs/receipt.md" },
      { rootDir },
    );

    assert.equal(crlfHash, lfHash);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});
