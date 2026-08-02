import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  evaluateLaunchReadiness as evaluateLaunchReadinessBase,
  loadPaymentProviderPolicy,
  loadRecoveryPolicy,
  paymentProviderConfigurationDigest,
  readPaymentProviderEvidence,
  readPaymentProviderEvidenceSha256,
  readRecoveryPolicyEvidence,
  readRecoveryPolicyEvidenceSha256,
  recoveryPolicyConfigurationDigest,
} from "../scripts/launch-readiness-check.js";
import {
  incidentRoutingConfigurationDigest,
  loadIncidentRoutingConfig,
} from "../scripts/incident-readiness-check.js";
import { providerEvidenceIdentity } from "../scripts/repository-evidence.js";

const arbitraryEvidenceBody = "Production feature flag read-only snapshot.";
const arbitraryEvidenceSha256 = crypto.createHash("sha256").update(arbitraryEvidenceBody).digest("hex");
const paymentProviderEvidenceControlId = "bank-payment-provider-state";
const paymentProviderEvidenceType = "provider-payment-state-verification";
const paymentProviderEvidenceStatus = "verified";

function paymentProviderReceipt(configuration) {
  const state = configuration.verifiedProductionState ?? {};
  return {
    schemaVersion: 1,
    controlId: paymentProviderEvidenceControlId,
    type: paymentProviderEvidenceType,
    provider: configuration.evidenceProvider,
    status: paymentProviderEvidenceStatus,
    timestamp: configuration.verifiedAt,
    mode: configuration.mode,
    featureFlagVerifiedOff: configuration.featureFlagVerifiedOff,
    providerDestinationScope: configuration.providerDestinationScope,
    runtimeScopeAttestation: configuration.runtimeScopeAttestation,
    signedDeliveryVerified: configuration.signedDeliveryVerified,
    enabled: state.enabled,
    configured: state.configured,
    webhookConfigured: state.webhookConfigured,
    providerMode: state.mode,
  };
}

function paymentProviderEvidenceFor(configuration, receipt = paymentProviderReceipt(configuration)) {
  const body = JSON.stringify(receipt);
  return {
    canonicalPath: path.resolve(process.cwd(), configuration.evidence),
    receipt,
    sha256: crypto.createHash("sha256").update(body).digest("hex"),
  };
}
const privateBackupRouteEvidenceBody = JSON.stringify({
  schemaVersion: 1,
  controlId: "backup-support-route",
  type: "private-route-delivery-test",
  provider: "github-actions",
  status: "delivered",
  timestamp: "2026-06-20T13:00:00.000Z",
  routeRef: "github-actions-secret:RIVT_BACKUP_ROUTE",
});
const privateBackupRouteEvidenceSha256 = crypto
  .createHash("sha256")
  .update(privateBackupRouteEvidenceBody)
  .digest("hex");
const privateBackupRouteEvidencePath = path.join(
  "test",
  `.launch-readiness-private-route-${process.pid}.json`,
);
const incidentControlEvidence = {
  synthetic: {
    path: path.join("test", `.launch-readiness-synthetic-${process.pid}.json`),
    receipt: {
      schemaVersion: 1,
      controlId: "synthetic",
      type: "synthetic-monitor-delivery-test",
      provider: "github-actions",
      status: "passed",
      timestamp: "2026-06-20T12:10:00.000Z",
      category: "synthetic_monitor",
      configuredProvider: "GitHub Actions",
      route: "GitHub issue: Production synthetic check failing",
      frequency: "30 minutes",
    },
  },
  errors: {
    path: path.join("test", `.launch-readiness-errors-${process.pid}.json`),
    receipt: {
      schemaVersion: 1,
      controlId: "errors",
      type: "error-monitoring-ingestion-test",
      provider: "sentry-cloud",
      status: "ingested",
      timestamp: "2026-06-20T12:20:00.000Z",
      category: "error_monitoring",
      configuredProvider: "Sentry Cloud",
      route: "Sentry project for production API errors",
      frequency: null,
    },
  },
  paging: {
    path: path.join("test", `.launch-readiness-paging-${process.pid}.json`),
    receipt: {
      schemaVersion: 1,
      controlId: "paging",
      type: "paging-delivery-test",
      provider: "sentry-cloud",
      status: "delivered",
      timestamp: "2026-06-20T12:30:00.000Z",
      category: "paging",
      configuredProvider: "Sentry Cloud issue alert",
      route: "Sentry high-priority issue alert",
      frequency: "Notify on every trigger",
    },
  },
  rehearsal: {
    path: path.join("test", `.launch-readiness-rehearsal-${process.pid}.json`),
    receipt: {
      schemaVersion: 1,
      controlId: "rehearsal-2026-06-20",
      type: "incident-rehearsal-test",
      provider: "railway-production",
      status: "passed",
      timestamp: "2026-06-20T12:00:00.000Z",
      scenario: "public-health-provider-failure",
      commanderRoleId: "incident-commander",
    },
  },
};
for (const fixture of Object.values(incidentControlEvidence)) {
  fixture.body = JSON.stringify(fixture.receipt);
  fixture.sha256 = crypto.createHash("sha256").update(fixture.body).digest("hex");
}
const recoveryEvidenceFixtures = {
  backupSchedule: {
    path: "external/recovery/backup-schedule.json",
    receipt: {
      schemaVersion: 1,
      controlId: "backup-schedule",
      type: "provider-backup-schedule",
      provider: "railway",
      status: "configured",
      timestamp: "2026-06-21T11:00:00.000Z",
      cadenceMinutes: 30,
      owner: "Michael",
    },
  },
  latestSuccessfulBackup: {
    path: "external/recovery/latest-backup.json",
    receipt: {
      schemaVersion: 1,
      controlId: "latest-successful-backup",
      type: "provider-backup-completion",
      provider: "railway",
      status: "passed",
      timestamp: "2026-06-21T11:30:00.000Z",
      artifactKey: "backups/postgres/2026-06-21T11-30-00.000Z-aaaaaaa.json.gz.aes256gcm",
      tableCount: 59,
      rowCount: 1524,
    },
  },
  missedBackupAlert: {
    path: "external/recovery/missed-backup-alert.json",
    receipt: {
      schemaVersion: 1,
      controlId: "missed-backup-alert",
      type: "provider-alert-delivery-test",
      provider: "sentry",
      status: "tested",
      timestamp: "2026-06-21T11:00:00.000Z",
      retryAllowanceMinutes: 15,
      destination: "named paging route",
    },
  },
  backupRetention: {
    path: "external/recovery/retention-policy.json",
    receipt: {
      schemaVersion: 1,
      controlId: "backup-retention-enforcement",
      type: "provider-retention-policy",
      provider: "object-storage",
      status: "verified",
      timestamp: "2026-06-21T11:00:00.000Z",
      retentionDays: 30,
      owner: "Michael",
      mode: "provider lifecycle policy",
    },
  },
  failureDomain: {
    path: "external/recovery/failure-domain.json",
    receipt: {
      schemaVersion: 1,
      controlId: "backup-failure-domain",
      type: "provider-failure-domain-verification",
      provider: "independent-backup-host",
      status: "independent",
      timestamp: "2026-06-21T11:00:00.000Z",
      primaryProvider: "primary-host",
      backupProvider: "independent-backup-host",
    },
  },
  latestNamedArtifactRestore: {
    path: "external/recovery/restore-drill.json",
    receipt: {
      schemaVersion: 1,
      controlId: "named-artifact-restore",
      type: "provider-restore-verification",
      provider: "railway",
      status: "passed",
      timestamp: "2026-06-21T04:18:59.000Z",
      artifactKey: "backups/postgres/2026-06-21T04-14-48.795Z-332dbc0.json.gz.aes256gcm",
      tableCount: 59,
      rowCount: 1524,
      restoreDurationMs: 13411,
      verificationDurationMs: 1862,
    },
  },
};
const readyRecoveryEvidenceByPath = Object.fromEntries(
  Object.values(recoveryEvidenceFixtures).map(({ path: evidencePath, receipt }) => {
    const body = JSON.stringify(receipt);
    return [evidencePath, {
      canonicalPath: path.resolve(process.cwd(), evidencePath),
      receipt,
      sha256: crypto.createHash("sha256").update(body).digest("hex"),
    }];
  }),
);
const readyRecoveryEvidenceSha256ByPath = Object.fromEntries(
  Object.entries(readyRecoveryEvidenceByPath)
    .map(([evidencePath, evidence]) => [evidencePath, evidence.sha256]),
);
const readyExternallyVerifiedEvidence = new Set([
  providerEvidenceIdentity({
    controlId: "backup-support-route",
    provider: "github-actions",
    sha256: privateBackupRouteEvidenceSha256,
  }),
  ...Object.values(recoveryEvidenceFixtures).map(({ receipt }) => providerEvidenceIdentity({
    controlId: receipt.controlId,
    provider: receipt.provider,
    sha256: crypto.createHash("sha256").update(JSON.stringify(receipt)).digest("hex"),
  })),
  ...Object.values(incidentControlEvidence).map(({ receipt, sha256 }) => providerEvidenceIdentity({
    controlId: receipt.controlId,
    provider: receipt.provider,
    sha256,
  })),
].filter(Boolean));

function evaluateLaunchReadiness(input, options = {}) {
  fs.writeFileSync(privateBackupRouteEvidencePath, privateBackupRouteEvidenceBody);
  for (const fixture of Object.values(incidentControlEvidence)) {
    fs.writeFileSync(fixture.path, fixture.body);
  }
  try {
    return evaluateLaunchReadinessBase(input, {
      paymentProviderEvidence: readyPaymentProviderEvidence,
      recoveryEvidenceByPath: readyRecoveryEvidenceByPath,
      recoveryEvidenceSha256ByPath: readyRecoveryEvidenceSha256ByPath,
      externallyVerifiedEvidence: readyExternallyVerifiedEvidence,
      ...options,
    });
  } finally {
    fs.rmSync(privateBackupRouteEvidencePath, { force: true });
    for (const fixture of Object.values(incidentControlEvidence)) {
      fs.rmSync(fixture.path, { force: true });
    }
  }
}

const readyIncidentConfiguration = {
  version: 3,
  status: "approved",
  routeApproval: {
    status: "approved",
    approverRoleId: "founder",
    approvedAt: "2026-06-19T12:00:00.000Z",
    scope: "Named-cohort incident routing plan",
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
    { id: "primary-support-route", status: "configured", kind: "organization-support-inbox" },
    {
      id: "backup-support-route",
      status: "configured",
      kind: "private-incident-roster",
      routeRef: "github-actions-secret:RIVT_BACKUP_ROUTE",
      evidenceProvider: "github-actions",
      lastVerifiedAt: "2026-06-20T13:00:00.000Z",
      evidencePath: privateBackupRouteEvidencePath,
      evidenceSha256: privateBackupRouteEvidenceSha256,
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
      evidenceProvider: incidentControlEvidence.synthetic.receipt.provider,
      lastVerifiedAt: incidentControlEvidence.synthetic.receipt.timestamp,
      evidencePath: incidentControlEvidence.synthetic.path,
      evidenceSha256: incidentControlEvidence.synthetic.sha256,
    },
    {
      id: "errors",
      category: "error_monitoring",
      status: "configured",
      provider: "Sentry Cloud",
      route: "Sentry project for production API errors",
      evidenceProvider: incidentControlEvidence.errors.receipt.provider,
      lastVerifiedAt: incidentControlEvidence.errors.receipt.timestamp,
      evidencePath: incidentControlEvidence.errors.path,
      evidenceSha256: incidentControlEvidence.errors.sha256,
    },
    {
      id: "paging",
      category: "paging",
      status: "configured",
      provider: "Sentry Cloud issue alert",
      route: "Sentry high-priority issue alert",
      frequency: "Notify on every trigger",
      evidenceProvider: incidentControlEvidence.paging.receipt.provider,
      lastVerifiedAt: incidentControlEvidence.paging.receipt.timestamp,
      evidencePath: incidentControlEvidence.paging.path,
      evidenceSha256: incidentControlEvidence.paging.sha256,
    },
  ],
  rehearsals: [
    {
      id: incidentControlEvidence.rehearsal.receipt.controlId,
      status: "passed",
      completedAt: incidentControlEvidence.rehearsal.receipt.timestamp,
      scenario: incidentControlEvidence.rehearsal.receipt.scenario,
      commanderRoleId: incidentControlEvidence.rehearsal.receipt.commanderRoleId,
      evidenceProvider: incidentControlEvidence.rehearsal.receipt.provider,
      evidencePath: incidentControlEvidence.rehearsal.path,
      evidenceSha256: incidentControlEvidence.rehearsal.sha256,
    },
  ],
  approvals: {
    founder: { status: "approved", approverRoleId: "founder", approvedAt: "2026-06-20T14:00:00.000Z" },
    support: { status: "approved", approverRoleId: "support-owner", approvedAt: "2026-06-20T14:00:00.000Z" },
    legalSafety: { status: "approved", approverRoleId: "legal-safety-owner", approvedAt: "2026-06-20T14:00:00.000Z" },
  },
};

function withIncidentApprovalDigests(configuration) {
  const configurationDigest = incidentRoutingConfigurationDigest(configuration);
  return {
    ...configuration,
    approvals: Object.fromEntries(
      Object.entries(configuration.approvals ?? {}).map(([key, approval]) => [key, {
        ...approval,
        configurationDigest,
      }]),
    ),
  };
}

const readyIncidentConfig = withIncidentApprovalDigests(readyIncidentConfiguration);

const readyRecoveryConfiguration = {
  version: 3,
  status: "approved",
  targets: {
    rpoMinutes: 60,
    rpoBasis: "Named encrypted logical backup artifact plus managed Railway Postgres persistence.",
    rtoMinutes: 240,
    rtoBasis: "Latest measured restore was under 16 seconds; four hours leaves room for provider setup and DNS/app verification.",
  },
  backupSchedule: {
    status: "configured",
    cadenceMinutes: 30,
    owner: "Michael",
    verifiedAt: "2026-06-21T11:00:00.000Z",
    evidenceProvider: recoveryEvidenceFixtures.backupSchedule.receipt.provider,
    evidence: recoveryEvidenceFixtures.backupSchedule.path,
    evidenceSha256: readyRecoveryEvidenceByPath[recoveryEvidenceFixtures.backupSchedule.path].sha256,
  },
  latestSuccessfulBackup: {
    status: "passed",
    completedAt: "2026-06-21T11:30:00.000Z",
    artifactKey: "backups/postgres/2026-06-21T11-30-00.000Z-aaaaaaa.json.gz.aes256gcm",
    tableCount: 59,
    rowCount: 1524,
    evidenceProvider: recoveryEvidenceFixtures.latestSuccessfulBackup.receipt.provider,
    evidence: recoveryEvidenceFixtures.latestSuccessfulBackup.path,
    evidenceSha256: readyRecoveryEvidenceByPath[recoveryEvidenceFixtures.latestSuccessfulBackup.path].sha256,
  },
  missedBackupAlert: {
    status: "tested",
    retryAllowanceMinutes: 15,
    destination: "named paging route",
    lastTestedAt: "2026-06-21T11:00:00.000Z",
    evidenceProvider: recoveryEvidenceFixtures.missedBackupAlert.receipt.provider,
    evidence: recoveryEvidenceFixtures.missedBackupAlert.path,
    evidenceSha256: readyRecoveryEvidenceByPath[recoveryEvidenceFixtures.missedBackupAlert.path].sha256,
  },
  backupRetention: {
    days: 30,
    owner: "Michael",
    enforcement: {
      status: "verified",
      mode: "provider lifecycle policy",
      verifiedAt: "2026-06-21T11:00:00.000Z",
      evidenceProvider: recoveryEvidenceFixtures.backupRetention.receipt.provider,
      evidence: recoveryEvidenceFixtures.backupRetention.path,
      evidenceSha256: readyRecoveryEvidenceByPath[recoveryEvidenceFixtures.backupRetention.path].sha256,
    },
  },
  failureDomain: {
    status: "independent",
    primaryProvider: "primary-host",
    backupProvider: "independent-backup-host",
    verifiedAt: "2026-06-21T11:00:00.000Z",
    evidenceProvider: recoveryEvidenceFixtures.failureDomain.receipt.provider,
    evidence: recoveryEvidenceFixtures.failureDomain.path,
    evidenceSha256: readyRecoveryEvidenceByPath[recoveryEvidenceFixtures.failureDomain.path].sha256,
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
    tableCount: 59,
    rowCount: 1524,
    restoreDurationMs: 13411,
    verificationDurationMs: 1862,
    evidenceProvider: recoveryEvidenceFixtures.latestNamedArtifactRestore.receipt.provider,
    evidence: recoveryEvidenceFixtures.latestNamedArtifactRestore.path,
    evidenceSha256: readyRecoveryEvidenceByPath[recoveryEvidenceFixtures.latestNamedArtifactRestore.path].sha256,
  },
};

function withRecoveryApprovals(configuration, approvalOverrides = {}) {
  const policy = {
    ...configuration,
    approvals: {
      founder: {
        status: "approved",
        approvedBy: "Michael",
        approvedAt: "2026-06-21T12:00:00.000Z",
        ...approvalOverrides.founder,
      },
      operations: {
        status: "approved",
        approvedBy: "Michael",
        approvedAt: "2026-06-21T12:00:00.000Z",
        ...approvalOverrides.operations,
      },
    },
  };
  const configurationDigest = recoveryPolicyConfigurationDigest(policy);
  return {
    ...policy,
    approvals: Object.fromEntries(
      Object.entries(policy.approvals).map(([key, approval]) => [key, {
        ...approval,
        configurationDigest,
      }]),
    ),
  };
}

const readyRecoveryPolicy = withRecoveryApprovals(readyRecoveryConfiguration);

function recoveryFindingCodes(configuration, now = new Date("2026-06-21T12:00:00.000Z")) {
  const result = evaluateLaunchReadiness({
    incidentConfig: readyIncidentConfig,
    recoveryPolicy: withRecoveryApprovals(configuration),
    paymentProviderPolicy: readyPaymentProviderPolicy,
  }, { now });
  return result.findings.map((finding) => finding.code);
}

function evaluateBoundRestoreTiming({
  rtoMinutes,
  restoreDurationMs,
  verificationDurationMs,
  externallyVerified = true,
}) {
  const fixture = recoveryEvidenceFixtures.latestNamedArtifactRestore;
  const receipt = {
    ...fixture.receipt,
    restoreDurationMs,
    verificationDurationMs,
  };
  const sha256 = crypto.createHash("sha256").update(JSON.stringify(receipt)).digest("hex");
  const configuration = {
    ...readyRecoveryConfiguration,
    targets: {
      ...readyRecoveryConfiguration.targets,
      rtoMinutes,
    },
    latestNamedArtifactRestore: {
      ...readyRecoveryConfiguration.latestNamedArtifactRestore,
      restoreDurationMs,
      verificationDurationMs,
      evidenceSha256: sha256,
    },
  };
  const externallyVerifiedEvidence = new Set(readyExternallyVerifiedEvidence);
  if (externallyVerified) {
    externallyVerifiedEvidence.add(providerEvidenceIdentity({
      controlId: receipt.controlId,
      provider: receipt.provider,
      sha256,
    }));
  }

  return evaluateLaunchReadiness({
    incidentConfig: readyIncidentConfig,
    recoveryPolicy: withRecoveryApprovals(configuration),
    paymentProviderPolicy: readyPaymentProviderPolicy,
  }, {
    now: new Date("2026-06-21T12:00:00.000Z"),
    recoveryEvidenceByPath: {
      ...readyRecoveryEvidenceByPath,
      [fixture.path]: {
        canonicalPath: path.resolve(process.cwd(), fixture.path),
        receipt,
        sha256,
      },
    },
    recoveryEvidenceSha256ByPath: {
      ...readyRecoveryEvidenceSha256ByPath,
      [fixture.path]: sha256,
    },
    externallyVerifiedEvidence,
  });
}

const readyPaymentProviderConfiguration = {
  version: 1,
  status: "approved",
  mode: "disabled",
  featureFlagVerifiedOff: true,
  providerDestinationScope: "connected_accounts",
  runtimeScopeAttestation: "unset",
  signedDeliveryVerified: false,
  verifiedAt: "2026-06-21T11:00:00.000Z",
  evidenceProvider: "stripe",
  evidence: "external/payment/provider-state.json",
  verifiedProductionState: {
    enabled: false,
    configured: false,
    webhookConfigured: true,
    mode: "setup_required",
  },
};
const readyPaymentProviderEvidence = paymentProviderEvidenceFor(readyPaymentProviderConfiguration);
readyPaymentProviderConfiguration.evidenceSha256 = readyPaymentProviderEvidence.sha256;
const readyPaymentProviderEvidenceIdentity = providerEvidenceIdentity({
  controlId: paymentProviderEvidenceControlId,
  provider: readyPaymentProviderConfiguration.evidenceProvider,
  sha256: readyPaymentProviderEvidence.sha256,
});
readyExternallyVerifiedEvidence.add(readyPaymentProviderEvidenceIdentity);
function withPaymentApproval(configuration, approvalOverrides = {}) {
  const policy = {
    ...configuration,
    approval: {
      status: "approved",
      approvedBy: "Michael",
      approvedAt: "2026-06-21T11:30:00.000Z",
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

function bindPaymentEvidence(configuration, approvalOverrides = {}) {
  const evidenceConfiguration = {
    ...configuration,
    evidenceProvider: configuration.evidenceProvider ?? "stripe",
    evidence: configuration.evidence ?? readyPaymentProviderConfiguration.evidence,
  };
  const evidence = paymentProviderEvidenceFor(evidenceConfiguration);
  const policy = withPaymentApproval({
    ...evidenceConfiguration,
    evidenceSha256: evidence.sha256,
  }, approvalOverrides);
  const externallyVerifiedEvidence = new Set([
    ...readyExternallyVerifiedEvidence,
    providerEvidenceIdentity({
      controlId: paymentProviderEvidenceControlId,
      provider: evidenceConfiguration.evidenceProvider,
      sha256: evidence.sha256,
    }),
  ].filter(Boolean));
  return { evidence, externallyVerifiedEvidence, policy };
}

test("launch readiness passes only when incident and recovery policy evidence are approved", () => {
  const result = evaluateLaunchReadiness({
    incidentConfig: readyIncidentConfig,
    recoveryPolicy: readyRecoveryPolicy,
    paymentProviderPolicy: readyPaymentProviderPolicy,
  }, { now: new Date("2026-06-21T12:00:00.000Z") });

  assert.deepEqual(result.findings, []);
  assert.equal(result.ok, true);
  assert.equal(result.status, "ready");
});

test("launch readiness resolves incident evidence against an explicit repository root", () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "rivt-launch-incident-root-"));
  try {
    const writeFixture = (relativePath, body) => {
      const absolutePath = path.resolve(rootDir, relativePath);
      fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
      fs.writeFileSync(absolutePath, body);
    };
    writeFixture(privateBackupRouteEvidencePath, privateBackupRouteEvidenceBody);
    for (const fixture of Object.values(incidentControlEvidence)) {
      writeFixture(fixture.path, fixture.body);
    }
    const result = evaluateLaunchReadinessBase({
      incidentConfig: readyIncidentConfig,
      recoveryPolicy: readyRecoveryPolicy,
      paymentProviderPolicy: readyPaymentProviderPolicy,
    }, {
      externallyVerifiedEvidence: readyExternallyVerifiedEvidence,
      incidentEvidenceRoot: rootDir,
      now: new Date("2026-06-21T12:00:00.000Z"),
      paymentProviderEvidence: readyPaymentProviderEvidence,
      recoveryEvidenceByPath: readyRecoveryEvidenceByPath,
      recoveryEvidenceSha256ByPath: readyRecoveryEvidenceSha256ByPath,
    });

    assert.equal(result.ok, true);
    assert.deepEqual(result.findings, []);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test("checked-in readiness configuration stays blocked without typed provider evidence", () => {
  const recoveryPolicy = loadRecoveryPolicy();
  const paymentProviderPolicy = loadPaymentProviderPolicy();
  const recoveryEvidenceByPath = readRecoveryPolicyEvidence(recoveryPolicy);
  const paymentProviderEvidence = readPaymentProviderEvidence(paymentProviderPolicy);
  const result = evaluateLaunchReadinessBase({
    incidentConfig: loadIncidentRoutingConfig(),
    recoveryPolicy,
    paymentProviderPolicy,
  }, {
    now: new Date("2026-08-01T16:00:00.000Z"),
    paymentProviderEvidence,
    recoveryEvidenceByPath,
    recoveryEvidenceSha256ByPath: Object.fromEntries(
      Object.entries(recoveryEvidenceByPath)
        .map(([evidencePath, evidence]) => [evidencePath, evidence?.sha256 ?? null]),
    ),
  });
  const codes = new Set(result.findings.map((finding) => finding.code));

  assert.equal(result.ok, false);
  assert.equal(result.status, "blocked");
  assert.equal(codes.has("ACTIVE_LAUNCH_HOLD"), true);
  assert.equal(codes.has("BACKUP_ROUTE_UNVERIFIED"), true);
  assert.equal(codes.has("BACKUP_SCHEDULE_UNVERIFIED"), true);
  assert.equal(codes.has("RECENT_BACKUP_ARTIFACT_RESTORE_MISSING"), true);
  assert.equal(codes.has("PAYMENT_PROVIDER_EVIDENCE_UNVERIFIED"), true);
});

test("launch readiness propagates future incident-approval blockers", () => {
  const result = evaluateLaunchReadiness({
    incidentConfig: withIncidentApprovalDigests({
      ...readyIncidentConfig,
      approvals: {
        ...readyIncidentConfig.approvals,
        founder: {
          ...readyIncidentConfig.approvals.founder,
          approvedAt: "2026-06-22T12:00:00.000Z",
        },
      },
    }),
    recoveryPolicy: readyRecoveryPolicy,
    paymentProviderPolicy: readyPaymentProviderPolicy,
  }, { now: new Date("2026-06-21T12:00:00.000Z") });

  assert.equal(result.ok, false);
  assert.deepEqual(result.findings, [{
    code: "APPROVAL_FOUNDER_INVALID",
    message: "founder approval must have a parseable timestamp that is not in the future.",
    source: "incident",
  }]);
});

test("launch readiness propagates invalid incident-approval blockers", () => {
  const result = evaluateLaunchReadiness({
    incidentConfig: withIncidentApprovalDigests({
      ...readyIncidentConfig,
      approvals: {
        ...readyIncidentConfig.approvals,
        support: {
          ...readyIncidentConfig.approvals.support,
          approvedAt: "not-a-timestamp",
        },
      },
    }),
    recoveryPolicy: readyRecoveryPolicy,
    paymentProviderPolicy: readyPaymentProviderPolicy,
  }, { now: new Date("2026-06-21T12:00:00.000Z") });

  assert.equal(result.ok, false);
  assert.deepEqual(result.findings, [{
    code: "APPROVAL_SUPPORT_INVALID",
    message: "support approval must have a parseable timestamp that is not in the future.",
    source: "incident",
  }]);
});

test("launch readiness propagates pre-evidence incident-approval blockers", () => {
  const result = evaluateLaunchReadiness({
    incidentConfig: withIncidentApprovalDigests({
      ...readyIncidentConfig,
      approvals: {
        ...readyIncidentConfig.approvals,
        legalSafety: {
          ...readyIncidentConfig.approvals.legalSafety,
          approvedAt: "2026-06-20T12:30:00.000Z",
        },
      },
    }),
    recoveryPolicy: readyRecoveryPolicy,
    paymentProviderPolicy: readyPaymentProviderPolicy,
  }, { now: new Date("2026-06-21T12:00:00.000Z") });

  assert.equal(result.ok, false);
  assert.deepEqual(result.findings, [{
    code: "APPROVAL_LEGALSAFETY_STALE",
    message: "legalSafety approval must be recorded after the latest incident rehearsal and verified private backup-route test.",
    source: "incident",
  }]);
});

test("launch readiness propagates incident configuration-binding blockers", () => {
  const result = evaluateLaunchReadiness({
    incidentConfig: {
      ...readyIncidentConfig,
      supportHours: {
        ...readyIncidentConfig.supportHours,
        coverage: "replacement support coverage",
      },
    },
    recoveryPolicy: readyRecoveryPolicy,
    paymentProviderPolicy: readyPaymentProviderPolicy,
  }, { now: new Date("2026-06-21T12:00:00.000Z") });

  assert.equal(result.ok, false);
  assert.deepEqual(result.findings.map((finding) => ({
    code: finding.code,
    source: finding.source,
  })), [
    { code: "APPROVAL_FOUNDER_CONFIGURATION_MISMATCH", source: "incident" },
    { code: "APPROVAL_SUPPORT_CONFIGURATION_MISMATCH", source: "incident" },
    { code: "APPROVAL_LEGALSAFETY_CONFIGURATION_MISMATCH", source: "incident" },
  ]);
});

test("launch readiness reports recovery policy gaps without hiding incident gaps", () => {
  const result = evaluateLaunchReadiness({
    incidentConfig: withIncidentApprovalDigests({
      ...readyIncidentConfig,
      status: "blocked",
      alertDestinations: [{ id: "synthetic", category: "synthetic_monitor", status: "configured" }],
      rehearsals: [],
    }),
    recoveryPolicy: {
      ...readyRecoveryPolicy,
      status: "blocked",
      targets: { rpoMinutes: null, rpoBasis: "TBD", rtoMinutes: null, rtoBasis: "TBD" },
      backupSchedule: { status: "missing" },
      latestSuccessfulBackup: { status: "missing" },
      missedBackupAlert: { status: "missing" },
      backupRetention: { days: null, owner: "TBD" },
      failureDomain: { status: "missing" },
      restoreDrillCadence: { days: null, owner: "TBD", nextDueAt: null },
      latestNamedArtifactRestore: { status: "missing" },
      approvals: {},
    },
    paymentProviderPolicy: readyPaymentProviderPolicy,
  }, { now: new Date("2026-06-21T12:00:00.000Z") });

  assert.equal(result.ok, false);
  assert.deepEqual(result.findings.map((finding) => finding.code), [
    "INCIDENT_ROUTING_NOT_APPROVED",
    "SYNTHETIC_MONITOR_MISSING",
    "ERROR_MONITORING_MISSING",
    "PAGING_ROUTE_MISSING",
    "INCIDENT_REHEARSAL_MISSING",
    "RECOVERY_POLICY_NOT_APPROVED",
    "RPO_TARGET_MISSING",
    "RTO_TARGET_MISSING",
    "BACKUP_SCHEDULE_UNVERIFIED",
    "RECENT_BACKUP_CHECKPOINT_MISSING",
    "MISSED_BACKUP_ALERT_UNVERIFIED",
    "BACKUP_RETENTION_MISSING",
    "BACKUP_RETENTION_UNENFORCED",
    "BACKUP_FAILURE_DOMAIN_NOT_INDEPENDENT",
    "RESTORE_CADENCE_MISSING",
    "NEXT_RESTORE_DRILL_MISSING",
    "RECENT_BACKUP_ARTIFACT_RESTORE_MISSING",
    "RECOVERY_APPROVAL_FOUNDER_MISSING",
    "RECOVERY_APPROVAL_OPERATIONS_MISSING",
  ]);
  assert.deepEqual(new Set(result.findings.map((finding) => finding.source)), new Set(["incident", "recovery"]));
});

test("launch readiness rejects future-dated restore evidence", () => {
  const recoveryPolicy = withRecoveryApprovals({
    ...readyRecoveryConfiguration,
    restoreDrillCadence: {
      ...readyRecoveryConfiguration.restoreDrillCadence,
      nextDueAt: "2026-08-20T12:00:00.000Z",
    },
    latestNamedArtifactRestore: {
      ...readyRecoveryConfiguration.latestNamedArtifactRestore,
      completedAt: "2026-07-21T12:00:00.000Z",
    },
  });
  const result = evaluateLaunchReadiness({
    incidentConfig: readyIncidentConfig,
    recoveryPolicy,
    paymentProviderPolicy: readyPaymentProviderPolicy,
  }, { now: new Date("2026-06-21T12:00:00.000Z") });

  assert.equal(result.ok, false);
  assert.deepEqual(result.findings.map((finding) => finding.code), [
    "RECENT_BACKUP_ARTIFACT_RESTORE_MISSING",
    "RECOVERY_APPROVAL_FOUNDER_STALE",
    "RECOVERY_APPROVAL_OPERATIONS_STALE",
  ]);
});

test("launch readiness rejects missing continuous-backup controls even when the policy is approved", () => {
  const {
    backupSchedule: _backupSchedule,
    latestSuccessfulBackup: _latestSuccessfulBackup,
    missedBackupAlert: _missedBackupAlert,
    failureDomain: _failureDomain,
    ...legacyConfiguration
  } = readyRecoveryConfiguration;
  legacyConfiguration.backupRetention = {
    days: readyRecoveryConfiguration.backupRetention.days,
    owner: readyRecoveryConfiguration.backupRetention.owner,
  };

  assert.deepEqual(recoveryFindingCodes(legacyConfiguration), [
    "BACKUP_SCHEDULE_UNVERIFIED",
    "RECENT_BACKUP_CHECKPOINT_MISSING",
    "MISSED_BACKUP_ALERT_UNVERIFIED",
    "BACKUP_RETENTION_UNENFORCED",
    "BACKUP_FAILURE_DOMAIN_NOT_INDEPENDENT",
  ]);
});

test("launch readiness rejects stale and future-dated successful-backup evidence", () => {
  for (const [completedAt, expectedCodes] of [
    ["2026-06-21T10:59:00.000Z", ["RECENT_BACKUP_CHECKPOINT_MISSING"]],
    ["2026-06-21T12:01:00.000Z", [
      "RECENT_BACKUP_CHECKPOINT_MISSING",
      "RECOVERY_APPROVAL_FOUNDER_STALE",
      "RECOVERY_APPROVAL_OPERATIONS_STALE",
    ]],
  ]) {
    assert.deepEqual(recoveryFindingCodes({
      ...readyRecoveryConfiguration,
      latestSuccessfulBackup: {
        ...readyRecoveryConfiguration.latestSuccessfulBackup,
        completedAt,
      },
    }), expectedCodes);
  }
});

test("launch readiness requires backup cadence plus alert retry allowance to fit the RPO", () => {
  assert.deepEqual(recoveryFindingCodes({
    ...readyRecoveryConfiguration,
    targets: {
      ...readyRecoveryConfiguration.targets,
      rpoMinutes: 40,
    },
  }), ["BACKUP_RPO_WINDOW_EXCEEDED"]);
});

test("launch readiness rejects untested alerts, unenforced retention, and a shared failure domain", () => {
  assert.deepEqual(recoveryFindingCodes({
    ...readyRecoveryConfiguration,
    missedBackupAlert: {
      ...readyRecoveryConfiguration.missedBackupAlert,
      status: "configured",
      evidenceSha256: null,
    },
    backupRetention: {
      ...readyRecoveryConfiguration.backupRetention,
      enforcement: {
        ...readyRecoveryConfiguration.backupRetention.enforcement,
        status: "planned",
      },
    },
    failureDomain: {
      ...readyRecoveryConfiguration.failureDomain,
      backupProvider: readyRecoveryConfiguration.failureDomain.primaryProvider,
    },
  }), [
    "MISSED_BACKUP_ALERT_UNVERIFIED",
    "BACKUP_RETENTION_UNENFORCED",
    "BACKUP_FAILURE_DOMAIN_NOT_INDEPENDENT",
  ]);
});

test("launch readiness rejects an overdue restore drill", () => {
  assert.deepEqual(recoveryFindingCodes({
    ...readyRecoveryConfiguration,
    restoreDrillCadence: {
      ...readyRecoveryConfiguration.restoreDrillCadence,
      nextDueAt: "2026-06-21T11:59:59.000Z",
    },
  }), ["RESTORE_DRILL_OVERDUE"]);
});

test("launch readiness rejects restore evidence without matched content and positive counts", () => {
  for (const latestNamedArtifactRestore of [
    {
      ...readyRecoveryConfiguration.latestNamedArtifactRestore,
      evidenceSha256: null,
    },
    {
      ...readyRecoveryConfiguration.latestNamedArtifactRestore,
      tableCount: 0,
    },
    {
      ...readyRecoveryConfiguration.latestNamedArtifactRestore,
      rowCount: 0,
    },
  ]) {
    assert.deepEqual(recoveryFindingCodes({
      ...readyRecoveryConfiguration,
      latestNamedArtifactRestore,
    }), ["RECENT_BACKUP_ARTIFACT_RESTORE_MISSING"]);
  }
});

test("launch readiness accepts measured recovery below or equal to the approved RTO and rejects the first millisecond above it", () => {
  for (const [label, durations, expectedCodes] of [
    ["below", [30_000, 29_999], []],
    ["equal", [30_000, 30_000], []],
    ["above", [30_000, 30_001], ["RECOVERY_RTO_EXCEEDED"]],
  ]) {
    const result = evaluateBoundRestoreTiming({
      rtoMinutes: 1,
      restoreDurationMs: durations[0],
      verificationDurationMs: durations[1],
    });
    assert.deepEqual(result.findings.map((finding) => finding.code), expectedCodes, label);
  }
});

test("launch readiness rejects either individual recovery phase or their combined duration above the RTO", () => {
  for (const [label, restoreDurationMs, verificationDurationMs] of [
    ["restore phase", 60_001, 1],
    ["verification phase", 1, 60_001],
    ["combined phases", 40_000, 30_000],
  ]) {
    const result = evaluateBoundRestoreTiming({
      rtoMinutes: 1,
      restoreDurationMs,
      verificationDurationMs,
    });
    assert.deepEqual(
      result.findings.map((finding) => finding.code),
      ["RECOVERY_RTO_EXCEEDED"],
      label,
    );
  }
});

test("launch readiness applies the RTO to newly rebound slow restore evidence", () => {
  const result = evaluateBoundRestoreTiming({
    rtoMinutes: 1,
    restoreDurationMs: 45_000,
    verificationDurationMs: 30_000,
  });

  assert.deepEqual(result.findings.map((finding) => finding.code), ["RECOVERY_RTO_EXCEEDED"]);
});

test("launch readiness still blocks slow restore claims without matching external provenance", () => {
  const result = evaluateBoundRestoreTiming({
    rtoMinutes: 1,
    restoreDurationMs: 45_000,
    verificationDurationMs: 30_000,
    externallyVerified: false,
  });

  assert.deepEqual(result.findings.map((finding) => finding.code), [
    "RECENT_BACKUP_ARTIFACT_RESTORE_MISSING",
  ]);
  assert.equal(result.findings.some((finding) => finding.code === "RECOVERY_RTO_EXCEEDED"), false);
});

test("launch readiness fails closed on recovery timing values that cannot be added or converted safely", () => {
  for (const [label, restoreDurationMs, verificationDurationMs] of [
    ["unsafe individual duration", Number.MAX_SAFE_INTEGER + 1, 1],
    ["unsafe combined duration", Number.MAX_SAFE_INTEGER, 1],
    ["fractional millisecond duration", 1.5, 1],
  ]) {
    const result = evaluateBoundRestoreTiming({
      rtoMinutes: 240,
      restoreDurationMs,
      verificationDurationMs,
    });
    assert.deepEqual(result.findings.map((finding) => finding.code), [
      "RECENT_BACKUP_ARTIFACT_RESTORE_MISSING",
    ], label);
  }

  const unsafeRto = evaluateBoundRestoreTiming({
    rtoMinutes: Number.MAX_VALUE,
    restoreDurationMs: 1,
    verificationDurationMs: 1,
  });
  assert.deepEqual(unsafeRto.findings.map((finding) => finding.code), ["RTO_TARGET_MISSING"]);
});

test("launch readiness rejects a restore older than its cadence", () => {
  assert.deepEqual(recoveryFindingCodes({
    ...readyRecoveryConfiguration,
    restoreDrillCadence: {
      ...readyRecoveryConfiguration.restoreDrillCadence,
      days: 0.25,
      nextDueAt: "2026-06-21T10:18:59.000Z",
    },
  }), [
    "RESTORE_DRILL_OVERDUE",
    "RECENT_BACKUP_ARTIFACT_RESTORE_MISSING",
  ]);
});

test("launch readiness rejects a next restore date beyond the approved cadence", () => {
  assert.deepEqual(recoveryFindingCodes({
    ...readyRecoveryConfiguration,
    restoreDrillCadence: {
      ...readyRecoveryConfiguration.restoreDrillCadence,
      nextDueAt: "2026-12-20T12:00:00.000Z",
    },
  }), ["NEXT_RESTORE_DRILL_INCONSISTENT"]);
});

test("recovery approvals must be current, non-future, and later than bound evidence", () => {
  for (const approvedAt of [
    "not-a-date",
    "2026-06-21T12:01:00.000Z",
    "2026-05-21T12:00:00.000Z",
    readyRecoveryConfiguration.latestSuccessfulBackup.completedAt,
  ]) {
    const recoveryPolicy = withRecoveryApprovals(readyRecoveryConfiguration, {
      founder: { approvedAt },
    });
    const result = evaluateLaunchReadiness({
      incidentConfig: readyIncidentConfig,
      recoveryPolicy,
      paymentProviderPolicy: readyPaymentProviderPolicy,
    }, { now: new Date("2026-06-21T12:00:00.000Z") });

    assert.deepEqual(result.findings.map((finding) => finding.code), [
      "RECOVERY_APPROVAL_FOUNDER_STALE",
    ]);
  }
});

test("recovery approvals are invalidated when the reviewed configuration changes", () => {
  const changedPolicy = {
    ...readyRecoveryPolicy,
    targets: {
      ...readyRecoveryPolicy.targets,
      rpoBasis: "A changed recovery basis that requires fresh approval.",
    },
  };
  const result = evaluateLaunchReadiness({
    incidentConfig: readyIncidentConfig,
    recoveryPolicy: changedPolicy,
    paymentProviderPolicy: readyPaymentProviderPolicy,
  }, { now: new Date("2026-06-21T12:00:00.000Z") });

  assert.deepEqual(result.findings.map((finding) => finding.code), [
    "RECOVERY_APPROVAL_FOUNDER_EVIDENCE_MISMATCH",
    "RECOVERY_APPROVAL_OPERATIONS_EVIDENCE_MISMATCH",
  ]);
});

test("recovery evidence claims must match the current repository evidence contents", () => {
  const result = evaluateLaunchReadiness({
    incidentConfig: readyIncidentConfig,
    recoveryPolicy: readyRecoveryPolicy,
    paymentProviderPolicy: readyPaymentProviderPolicy,
  }, {
    now: new Date("2026-06-21T12:00:00.000Z"),
    recoveryEvidenceSha256ByPath: {
      ...readyRecoveryEvidenceSha256ByPath,
      [readyRecoveryConfiguration.backupSchedule.evidence]: "c".repeat(64),
    },
  });

  assert.deepEqual(result.findings.map((finding) => finding.code), [
    "BACKUP_SCHEDULE_UNVERIFIED",
  ]);

  const restoreMismatch = evaluateLaunchReadiness({
    incidentConfig: readyIncidentConfig,
    recoveryPolicy: readyRecoveryPolicy,
    paymentProviderPolicy: readyPaymentProviderPolicy,
  }, {
    now: new Date("2026-06-21T12:00:00.000Z"),
    recoveryEvidenceSha256ByPath: {
      ...readyRecoveryEvidenceSha256ByPath,
      [readyRecoveryConfiguration.latestNamedArtifactRestore.evidence]: "c".repeat(64),
    },
  });

  assert.deepEqual(restoreMismatch.findings.map((finding) => finding.code), [
    "RECENT_BACKUP_ARTIFACT_RESTORE_MISSING",
  ]);
});

test("recovery controls cannot reuse one evidence artifact", () => {
  const sharedEvidence = readyRecoveryConfiguration.backupSchedule.evidence;
  const sharedEvidenceSha256 = readyRecoveryConfiguration.backupSchedule.evidenceSha256;
  const recoveryPolicy = withRecoveryApprovals({
    ...readyRecoveryConfiguration,
    latestSuccessfulBackup: {
      ...readyRecoveryConfiguration.latestSuccessfulBackup,
      evidence: sharedEvidence,
      evidenceProvider: readyRecoveryConfiguration.backupSchedule.evidenceProvider,
      evidenceSha256: sharedEvidenceSha256,
    },
  });
  const result = evaluateLaunchReadiness({
    incidentConfig: readyIncidentConfig,
    recoveryPolicy,
    paymentProviderPolicy: readyPaymentProviderPolicy,
  }, { now: new Date("2026-06-21T12:00:00.000Z") });

  assert.deepEqual(result.findings.map((finding) => finding.code), [
    "BACKUP_SCHEDULE_UNVERIFIED",
    "RECENT_BACKUP_CHECKPOINT_MISSING",
  ]);
});

test("recovery evidence must match its control, type, provider, status, and timestamp", () => {
  const fixture = recoveryEvidenceFixtures.backupSchedule;
  const invalidReceipts = [
    { ...fixture.receipt, schemaVersion: 2 },
    { ...fixture.receipt, controlId: "another-control" },
    { ...fixture.receipt, type: "repository-file" },
    { ...fixture.receipt, provider: "another-provider" },
    { ...fixture.receipt, status: "pending" },
    { ...fixture.receipt, timestamp: "2026-06-21T10:59:59.000Z" },
    { ...fixture.receipt, selfAssertedVerified: true },
  ];

  for (const receipt of invalidReceipts) {
    const evidenceSha256 = crypto
      .createHash("sha256")
      .update(JSON.stringify(receipt))
      .digest("hex");
    const recoveryPolicy = withRecoveryApprovals({
      ...readyRecoveryConfiguration,
      backupSchedule: {
        ...readyRecoveryConfiguration.backupSchedule,
        evidenceSha256,
      },
    });
    const result = evaluateLaunchReadiness({
      incidentConfig: readyIncidentConfig,
      recoveryPolicy,
      paymentProviderPolicy: readyPaymentProviderPolicy,
    }, {
      now: new Date("2026-06-21T12:00:00.000Z"),
      recoveryEvidenceByPath: {
        ...readyRecoveryEvidenceByPath,
        [fixture.path]: {
          canonicalPath: path.resolve(process.cwd(), fixture.path),
          receipt,
          sha256: evidenceSha256,
        },
      },
      recoveryEvidenceSha256ByPath: {
        ...readyRecoveryEvidenceSha256ByPath,
        [fixture.path]: evidenceSha256,
      },
      externallyVerifiedEvidence: new Set([
        ...readyExternallyVerifiedEvidence,
        providerEvidenceIdentity({
          controlId: receipt.controlId,
          provider: receipt.provider,
          sha256: evidenceSha256,
        }),
      ].filter(Boolean)),
    });

    assert.deepEqual(
      result.findings.map((finding) => finding.code),
      ["BACKUP_SCHEDULE_UNVERIFIED"],
      JSON.stringify(receipt),
    );
  }
});

test("repository-authored recovery receipts stay blocked without external verification", () => {
  const result = evaluateLaunchReadiness({
    incidentConfig: readyIncidentConfig,
    recoveryPolicy: readyRecoveryPolicy,
    paymentProviderPolicy: readyPaymentProviderPolicy,
  }, {
    now: new Date("2026-06-21T12:00:00.000Z"),
    externallyVerifiedEvidence: new Set(),
  });

  assert.deepEqual(result.findings.map((finding) => finding.code), [
    "BACKUP_ROUTE_UNVERIFIED",
    "SYNTHETIC_MONITOR_MISSING",
    "ERROR_MONITORING_MISSING",
    "PAGING_ROUTE_MISSING",
    "INCIDENT_REHEARSAL_MISSING",
    "BACKUP_SCHEDULE_UNVERIFIED",
    "RECENT_BACKUP_CHECKPOINT_MISSING",
    "MISSED_BACKUP_ALERT_UNVERIFIED",
    "BACKUP_RETENTION_UNENFORCED",
    "BACKUP_FAILURE_DOMAIN_NOT_INDEPENDENT",
    "RECENT_BACKUP_ARTIFACT_RESTORE_MISSING",
    "PAYMENT_PROVIDER_EVIDENCE_UNVERIFIED",
  ]);
});

test("recovery receipts bind every readiness-driving provider field", () => {
  const cases = [
    {
      code: "BACKUP_SCHEDULE_UNVERIFIED",
      mutate: (policy) => ({
        ...policy,
        backupSchedule: { ...policy.backupSchedule, cadenceMinutes: 31 },
      }),
    },
    {
      code: "RECENT_BACKUP_CHECKPOINT_MISSING",
      mutate: (policy) => ({
        ...policy,
        latestSuccessfulBackup: {
          ...policy.latestSuccessfulBackup,
          artifactKey: "backups/postgres/different-artifact.json.gz.aes256gcm",
        },
      }),
    },
    {
      code: "MISSED_BACKUP_ALERT_UNVERIFIED",
      mutate: (policy) => ({
        ...policy,
        missedBackupAlert: { ...policy.missedBackupAlert, destination: "different paging route" },
      }),
    },
    {
      code: "BACKUP_RETENTION_UNENFORCED",
      mutate: (policy) => ({
        ...policy,
        backupRetention: { ...policy.backupRetention, days: 31 },
      }),
    },
    {
      code: "BACKUP_FAILURE_DOMAIN_NOT_INDEPENDENT",
      mutate: (policy) => ({
        ...policy,
        failureDomain: { ...policy.failureDomain, backupProvider: "different-independent-host" },
      }),
    },
    {
      code: "RECENT_BACKUP_ARTIFACT_RESTORE_MISSING",
      mutate: (policy) => ({
        ...policy,
        latestNamedArtifactRestore: {
          ...policy.latestNamedArtifactRestore,
          restoreDurationMs: policy.latestNamedArtifactRestore.restoreDurationMs + 1,
        },
      }),
    },
  ];

  for (const { code, mutate } of cases) {
    const recoveryPolicy = withRecoveryApprovals(mutate(readyRecoveryConfiguration));
    const result = evaluateLaunchReadiness({
      incidentConfig: readyIncidentConfig,
      recoveryPolicy,
      paymentProviderPolicy: readyPaymentProviderPolicy,
    }, { now: new Date("2026-06-21T12:00:00.000Z") });

    assert.deepEqual(result.findings.map((finding) => finding.code), [code], code);
  }
});

test("recovery evidence reuse is deduplicated by canonical file identity", () => {
  const schedulePath = "external/recovery/shared-receipt.json";
  const backupPathAlias = "external/recovery/./shared-receipt.json";
  const canonicalPath = path.resolve(process.cwd(), schedulePath);
  const scheduleReceipt = recoveryEvidenceFixtures.backupSchedule.receipt;
  const backupReceipt = recoveryEvidenceFixtures.latestSuccessfulBackup.receipt;
  const scheduleSha256 = crypto.createHash("sha256").update(JSON.stringify(scheduleReceipt)).digest("hex");
  const backupSha256 = crypto.createHash("sha256").update(JSON.stringify(backupReceipt)).digest("hex");
  const recoveryPolicy = withRecoveryApprovals({
    ...readyRecoveryConfiguration,
    backupSchedule: {
      ...readyRecoveryConfiguration.backupSchedule,
      evidence: schedulePath,
      evidenceSha256: scheduleSha256,
    },
    latestSuccessfulBackup: {
      ...readyRecoveryConfiguration.latestSuccessfulBackup,
      evidence: backupPathAlias,
      evidenceSha256: backupSha256,
    },
  });
  const result = evaluateLaunchReadiness({
    incidentConfig: readyIncidentConfig,
    recoveryPolicy,
    paymentProviderPolicy: readyPaymentProviderPolicy,
  }, {
    now: new Date("2026-06-21T12:00:00.000Z"),
    recoveryEvidenceByPath: {
      ...readyRecoveryEvidenceByPath,
      [schedulePath]: { canonicalPath, receipt: scheduleReceipt, sha256: scheduleSha256 },
      [backupPathAlias]: { canonicalPath, receipt: backupReceipt, sha256: backupSha256 },
    },
    recoveryEvidenceSha256ByPath: {
      ...readyRecoveryEvidenceSha256ByPath,
      [schedulePath]: scheduleSha256,
      [backupPathAlias]: backupSha256,
    },
    externallyVerifiedEvidence: new Set([
      ...readyExternallyVerifiedEvidence,
      providerEvidenceIdentity({
        controlId: scheduleReceipt.controlId,
        provider: scheduleReceipt.provider,
        sha256: scheduleSha256,
      }),
      providerEvidenceIdentity({
        controlId: backupReceipt.controlId,
        provider: backupReceipt.provider,
        sha256: backupSha256,
      }),
    ].filter(Boolean)),
  });

  assert.deepEqual(result.findings.map((finding) => finding.code), [
    "BACKUP_SCHEDULE_UNVERIFIED",
    "RECENT_BACKUP_CHECKPOINT_MISSING",
  ]);
});

test("recovery evidence hashing reads only repository-relative files", () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "rivt-recovery-evidence-"));
  try {
    fs.mkdirSync(path.join(rootDir, "docs"));
    fs.writeFileSync(path.join(rootDir, "docs", "schedule.md"), arbitraryEvidenceBody);

    assert.deepEqual(
      readRecoveryPolicyEvidenceSha256({
        backupSchedule: { evidence: "docs/schedule.md" },
        latestSuccessfulBackup: { evidence: "../outside.md" },
        missedBackupAlert: { evidence: path.join(rootDir, "docs", "schedule.md") },
      }, { rootDir }),
      {
        "docs/schedule.md": arbitraryEvidenceSha256,
        "../outside.md": null,
        [path.join(rootDir, "docs", "schedule.md")]: null,
      },
    );
    assert.deepEqual(
      readRecoveryPolicyEvidenceSha256({
        latestNamedArtifactRestore: { evidence: "docs/schedule.md" },
      }, { rootDir }),
      { "docs/schedule.md": arbitraryEvidenceSha256 },
    );
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test("recovery evidence reader canonicalizes aliases and rejects links and non-files", (t) => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "rivt-canonical-evidence-"));
  const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), "rivt-linked-evidence-"));
  try {
    fs.mkdirSync(path.join(rootDir, "docs"));
    fs.writeFileSync(path.join(rootDir, "docs", "receipt.json"), arbitraryEvidenceBody);
    fs.writeFileSync(path.join(outsideDir, "receipt.json"), arbitraryEvidenceBody);

    const directPath = "docs/receipt.json";
    const aliasPath = "docs/./receipt.json";
    const evidence = readRecoveryPolicyEvidence({
      backupSchedule: { evidence: directPath },
      latestSuccessfulBackup: { evidence: aliasPath },
      missedBackupAlert: { evidence: "docs" },
    }, { rootDir });

    assert.equal(evidence[directPath].canonicalPath, evidence[aliasPath].canonicalPath);
    assert.equal(evidence.missedBackupAlert, undefined);
    assert.equal(evidence.docs, null);

    const linkPath = path.join(rootDir, "linked");
    try {
      fs.symlinkSync(outsideDir, linkPath, process.platform === "win32" ? "junction" : "dir");
    } catch (error) {
      if (["EPERM", "EACCES", "ENOTSUP"].includes(error?.code)) {
        t.diagnostic(`symlink creation unavailable: ${error.code}`);
        return;
      }
      throw error;
    }
    const linkedEvidencePath = "linked/receipt.json";
    const linkedEvidence = readRecoveryPolicyEvidence({
      failureDomain: { evidence: linkedEvidencePath },
    }, { rootDir });
    assert.equal(linkedEvidence[linkedEvidencePath], null);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
    fs.rmSync(outsideDir, { recursive: true, force: true });
  }
});

test("recovery evidence reader preserves a typed provider receipt for evaluation", () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "rivt-typed-recovery-evidence-"));
  try {
    const evidencePath = path.join("docs", "schedule.json");
    const arbitraryPath = path.join("docs", "arbitrary.json");
    fs.mkdirSync(path.join(rootDir, "docs"));
    fs.writeFileSync(
      path.join(rootDir, evidencePath),
      JSON.stringify(recoveryEvidenceFixtures.backupSchedule.receipt),
    );
    fs.writeFileSync(path.join(rootDir, arbitraryPath), JSON.stringify({ name: "rivt" }));

    const evidence = readRecoveryPolicyEvidence({
      backupSchedule: { evidence: evidencePath },
      latestSuccessfulBackup: { evidence: arbitraryPath },
    }, { rootDir });

    assert.deepEqual(
      evidence[evidencePath].receipt,
      recoveryEvidenceFixtures.backupSchedule.receipt,
    );
    assert.deepEqual(evidence[arbitraryPath].receipt, { name: "rivt" });
    assert.match(evidence[evidencePath].sha256, /^[a-f0-9]{64}$/);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test("launch readiness fails closed while an explicit incident hold is active", () => {
  const result = evaluateLaunchReadiness({
    incidentConfig: withIncidentApprovalDigests({
      ...readyIncidentConfig,
      launchHold: {
        active: true,
        reason: "Emergency credential containment remains open.",
      },
    }),
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
    verifiedAt: "2026-06-21T11:00:00.000Z",
    evidence: readyPaymentProviderConfiguration.evidence,
    verifiedProductionState: {
      enabled: true,
      configured: true,
      webhookConfigured: true,
      mode: "configured",
    },
  };
  const bound = bindPaymentEvidence(enabledConfiguration);
  const result = evaluateLaunchReadiness({
    incidentConfig: readyIncidentConfig,
    recoveryPolicy: readyRecoveryPolicy,
    paymentProviderPolicy: bound.policy,
  }, {
    now: new Date("2026-06-21T12:00:00.000Z"),
    paymentProviderEvidence: bound.evidence,
    externallyVerifiedEvidence: bound.externallyVerifiedEvidence,
  });

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
    verifiedAt: "2026-06-21T11:00:00.000Z",
    evidence: readyPaymentProviderConfiguration.evidence,
    verifiedProductionState: {
      enabled: true,
      configured: true,
      webhookConfigured: true,
      mode: "configured",
    },
  };
  const bound = bindPaymentEvidence(enabledConfiguration);
  const result = evaluateLaunchReadiness({
    incidentConfig: readyIncidentConfig,
    recoveryPolicy: readyRecoveryPolicy,
    paymentProviderPolicy: bound.policy,
  }, {
    now: new Date("2026-06-21T12:00:00.000Z"),
    paymentProviderEvidence: bound.evidence,
    externallyVerifiedEvidence: bound.externallyVerifiedEvidence,
  });

  assert.equal(result.ok, true);
});

test("payment-provider receipts require external verification independent of repository content", () => {
  const externallyVerifiedEvidence = new Set(
    [...readyExternallyVerifiedEvidence]
      .filter((identity) => identity !== readyPaymentProviderEvidenceIdentity),
  );
  const result = evaluateLaunchReadiness({
    incidentConfig: readyIncidentConfig,
    recoveryPolicy: readyRecoveryPolicy,
    paymentProviderPolicy: readyPaymentProviderPolicy,
  }, {
    now: new Date("2026-06-21T12:00:00.000Z"),
    externallyVerifiedEvidence,
  });

  assert.deepEqual(result.findings.map((finding) => finding.code), [
    "PAYMENT_PROVIDER_EVIDENCE_UNVERIFIED",
  ]);
});

test("payment-provider receipts require an exact external control, provider, and digest identity", () => {
  const externallyVerifiedEvidence = new Set([
    ...[...readyExternallyVerifiedEvidence]
      .filter((identity) => identity !== readyPaymentProviderEvidenceIdentity),
    providerEvidenceIdentity({
      controlId: paymentProviderEvidenceControlId,
      provider: "stripe-shadow",
      sha256: readyPaymentProviderEvidence.sha256,
    }),
  ].filter(Boolean));
  const result = evaluateLaunchReadiness({
    incidentConfig: readyIncidentConfig,
    recoveryPolicy: readyRecoveryPolicy,
    paymentProviderPolicy: readyPaymentProviderPolicy,
  }, {
    now: new Date("2026-06-21T12:00:00.000Z"),
    externallyVerifiedEvidence,
  });

  assert.deepEqual(result.findings.map((finding) => finding.code), [
    "PAYMENT_PROVIDER_EVIDENCE_UNVERIFIED",
  ]);
});

test("payment-provider evidence rejects arbitrary text and self-asserted receipt fields", () => {
  const invalidReceipts = [
    null,
    { ...readyPaymentProviderEvidence.receipt, selfAssertedVerified: true },
  ];

  for (const receipt of invalidReceipts) {
    const body = receipt === null ? arbitraryEvidenceBody : JSON.stringify(receipt);
    const evidence = {
      canonicalPath: readyPaymentProviderEvidence.canonicalPath,
      receipt,
      sha256: crypto.createHash("sha256").update(body).digest("hex"),
    };
    const policy = withPaymentApproval({
      ...readyPaymentProviderConfiguration,
      evidenceSha256: evidence.sha256,
    });
    const result = evaluateLaunchReadiness({
      incidentConfig: readyIncidentConfig,
      recoveryPolicy: readyRecoveryPolicy,
      paymentProviderPolicy: policy,
    }, {
      now: new Date("2026-06-21T12:00:00.000Z"),
      paymentProviderEvidence: evidence,
      externallyVerifiedEvidence: new Set([
        ...readyExternallyVerifiedEvidence,
        providerEvidenceIdentity({
          controlId: paymentProviderEvidenceControlId,
          provider: readyPaymentProviderConfiguration.evidenceProvider,
          sha256: evidence.sha256,
        }),
      ].filter(Boolean)),
    });

    assert.deepEqual(result.findings.map((finding) => finding.code), [
      "PAYMENT_PROVIDER_EVIDENCE_UNVERIFIED",
    ]);
  }
});

test("payment-provider receipt binds every readiness-driving state field", () => {
  const mutations = [
    { mode: "enabled" },
    { featureFlagVerifiedOff: false },
    { providerDestinationScope: "your_account" },
    { runtimeScopeAttestation: "connected_accounts" },
    { signedDeliveryVerified: true },
    { verifiedAt: "2026-06-21T11:59:00.000Z" },
    { verifiedProductionState: { ...readyPaymentProviderConfiguration.verifiedProductionState, enabled: true } },
    { verifiedProductionState: { ...readyPaymentProviderConfiguration.verifiedProductionState, configured: true } },
    { verifiedProductionState: { ...readyPaymentProviderConfiguration.verifiedProductionState, webhookConfigured: false } },
    { verifiedProductionState: { ...readyPaymentProviderConfiguration.verifiedProductionState, mode: "configured" } },
  ];

  for (const mutation of mutations) {
    const policy = withPaymentApproval({
      ...readyPaymentProviderConfiguration,
      ...mutation,
    });
    const result = evaluateLaunchReadiness({
      incidentConfig: readyIncidentConfig,
      recoveryPolicy: readyRecoveryPolicy,
      paymentProviderPolicy: policy,
    }, { now: new Date("2026-06-21T12:00:00.000Z") });

    assert.equal(
      result.findings.some((finding) => finding.code === "PAYMENT_PROVIDER_EVIDENCE_UNVERIFIED"),
      true,
      JSON.stringify(mutation),
    );
  }
});

test("legacy payment sourceCommit metadata is ignored after runtime source binding migration", () => {
  const legacyConfiguration = {
    ...readyPaymentProviderConfiguration,
    verifiedProductionState: {
      ...readyPaymentProviderConfiguration.verifiedProductionState,
      sourceCommit: "b".repeat(40),
    },
  };
  assert.equal(
    paymentProviderConfigurationDigest(withPaymentApproval(legacyConfiguration)),
    paymentProviderConfigurationDigest(withPaymentApproval(readyPaymentProviderConfiguration)),
  );

  const bound = bindPaymentEvidence(legacyConfiguration);
  assert.equal(Object.hasOwn(bound.evidence.receipt, "sourceCommit"), false);
  const result = evaluateLaunchReadiness({
    incidentConfig: readyIncidentConfig,
    recoveryPolicy: readyRecoveryPolicy,
    paymentProviderPolicy: bound.policy,
  }, {
    now: new Date("2026-06-21T12:00:00.000Z"),
    paymentProviderEvidence: bound.evidence,
    externallyVerifiedEvidence: bound.externallyVerifiedEvidence,
  });
  assert.equal(result.ok, true);
});

test("payment evidence cannot reuse a recovery artifact through a path alias", () => {
  const paymentConfiguration = {
    ...readyPaymentProviderConfiguration,
    evidence: "external/recovery/./backup-schedule.json",
  };
  const bound = bindPaymentEvidence(paymentConfiguration);
  const result = evaluateLaunchReadiness({
    incidentConfig: readyIncidentConfig,
    recoveryPolicy: readyRecoveryPolicy,
    paymentProviderPolicy: bound.policy,
  }, {
    now: new Date("2026-06-21T12:00:00.000Z"),
    paymentProviderEvidence: bound.evidence,
    externallyVerifiedEvidence: bound.externallyVerifiedEvidence,
  });

  assert.deepEqual(result.findings.map((finding) => finding.code), [
    "BACKUP_SCHEDULE_UNVERIFIED",
    "PAYMENT_PROVIDER_EVIDENCE_UNVERIFIED",
  ]);
});

test("bank-payment approval expires even when the provider evidence remains current", () => {
  const policy = {
    ...readyPaymentProviderConfiguration,
    verifiedAt: "2026-06-20T12:00:00.000Z",
  };
  const bound = bindPaymentEvidence(policy, {
    approvedAt: "2026-05-20T12:00:00.000Z",
  });
  const result = evaluateLaunchReadiness({
    incidentConfig: readyIncidentConfig,
    recoveryPolicy: readyRecoveryPolicy,
    paymentProviderPolicy: bound.policy,
  }, {
    now: new Date("2026-06-21T12:00:00.000Z"),
    paymentProviderEvidence: bound.evidence,
    externallyVerifiedEvidence: bound.externallyVerifiedEvidence,
  });

  assert.deepEqual(result.findings.map((finding) => finding.code), ["PAYMENT_PROVIDER_APPROVAL_STALE"]);
});

test("bank-payment approval cannot predate provider verification", () => {
  const policy = {
    ...readyPaymentProviderConfiguration,
    verifiedAt: "2026-06-21T11:00:00.000Z",
  };
  const bound = bindPaymentEvidence(policy, {
    approvedAt: "2026-06-21T10:59:59.000Z",
  });
  const result = evaluateLaunchReadiness({
    incidentConfig: readyIncidentConfig,
    recoveryPolicy: readyRecoveryPolicy,
    paymentProviderPolicy: bound.policy,
  }, {
    now: new Date("2026-06-21T12:00:00.000Z"),
    paymentProviderEvidence: bound.evidence,
    externallyVerifiedEvidence: bound.externallyVerifiedEvidence,
  });

  assert.deepEqual(result.findings.map((finding) => finding.code), ["PAYMENT_PROVIDER_APPROVAL_STALE"]);
});

test("bank-payment approval must be recorded after provider verification, not at the same instant", () => {
  const verifiedAt = "2026-06-21T11:00:00.000Z";
  const policy = {
    ...readyPaymentProviderConfiguration,
    verifiedAt,
  };
  const bound = bindPaymentEvidence(policy, { approvedAt: verifiedAt });
  const result = evaluateLaunchReadiness({
    incidentConfig: readyIncidentConfig,
    recoveryPolicy: readyRecoveryPolicy,
    paymentProviderPolicy: bound.policy,
  }, {
    now: new Date("2026-06-21T12:00:00.000Z"),
    paymentProviderEvidence: bound.evidence,
    externallyVerifiedEvidence: bound.externallyVerifiedEvidence,
  });

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
  const bound = bindPaymentEvidence(enabledConfiguration);
  const result = evaluateLaunchReadiness({
    incidentConfig: readyIncidentConfig,
    recoveryPolicy: readyRecoveryPolicy,
    paymentProviderPolicy: bound.policy,
  }, {
    now: new Date("2026-06-21T12:00:00.000Z"),
    paymentProviderEvidence: bound.evidence,
    externallyVerifiedEvidence: bound.externallyVerifiedEvidence,
  });

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
    paymentProviderEvidence: {
      ...readyPaymentProviderEvidence,
      receipt: null,
      sha256: crypto
        .createHash("sha256")
        .update("Edited evidence at the same path.")
        .digest("hex"),
    },
  });

  assert.deepEqual(result.findings.map((finding) => finding.code), [
    "PAYMENT_PROVIDER_EVIDENCE_UNVERIFIED",
  ]);
});

test("payment-provider evidence hashing reads only a repository-relative file", () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "rivt-provider-evidence-"));
  try {
    fs.mkdirSync(path.join(rootDir, "docs"));
    fs.writeFileSync(path.join(rootDir, "docs", "receipt.md"), arbitraryEvidenceBody);

    assert.equal(
      readPaymentProviderEvidenceSha256({ evidence: "docs/receipt.md" }, { rootDir }),
      arbitraryEvidenceSha256,
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
    }, { now: new Date("2026-06-21T12:30:00.000Z") });

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
  const bound = bindPaymentEvidence(enabledConfiguration);
  const result = evaluateLaunchReadiness({
    incidentConfig: readyIncidentConfig,
    recoveryPolicy: readyRecoveryPolicy,
    paymentProviderPolicy: bound.policy,
  }, {
    now: new Date("2026-06-21T12:00:00.000Z"),
    paymentProviderEvidence: bound.evidence,
    externallyVerifiedEvidence: bound.externallyVerifiedEvidence,
  });

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
