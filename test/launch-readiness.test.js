import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { evaluateLaunchReadiness } from "../scripts/launch-readiness-check.js";

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

const readyApplicationObjectRecovery = {
  expectedProductionSourceRevision: "0123456789abcdef0123456789abcdef01234567",
  sourceCapability: {
    status: "verified_local_only",
    evidence: "docs/delivery/packets/100_APPLICATION_OBJECT_RECOVERY_SOURCE.md",
    providerIo: false,
    productionDataRead: false,
    chargeBearingAction: false,
  },
  latestCoordinatedRestore: {
    status: "passed",
    completedAt: "2026-06-21T10:30:00.000Z",
    recoverySetIdentity: {
      status: "recorded_restricted",
      reference: "restricted-operational-evidence:test-recovery-set",
    },
    databaseArtifactIdentity: {
      status: "recorded_restricted",
      reference: "restricted-operational-evidence:test-database-artifact",
    },
    objectCompletionIdentity: {
      status: "recorded_restricted",
      reference: "restricted-operational-evidence:test-object-completion",
    },
    sourceRevision: "0123456789abcdef0123456789abcdef01234567",
    binding: {
      sourceRevision: "0123456789abcdef0123456789abcdef01234567",
      databaseManifestSha256: "1".repeat(64),
      databaseArtifactSha256: "2".repeat(64),
      objectManifestSha256: "3".repeat(64),
      sourceInventorySha256: "4".repeat(64),
      sourceStoreIdentitySha256: "5".repeat(64),
      recoverySetIdentitySha256: "6".repeat(64),
    },
    immutableVersionIdsRecorded: true,
    complianceRetentionVerified: true,
    minimumRetentionDays: 30,
    activeKeyOnly: true,
    predecessorPresentDuringVerification: false,
    identitySeparationVerified: true,
    counts: { sourceObjects: 8, backedUpObjects: 8, restoredObjects: 8 },
    bytes: { source: 8192, backedUp: 8192, restored: 8192 },
    mismatches: { missing: 0, checksum: 0, metadata: 0, unresolved: 0, unexpected: 0 },
    scopes: [
      "legacy",
      "project",
      "album",
      "shop-talk",
      "document-brand",
      "professional-profile",
      "message",
      "contact-note",
    ],
    isolatedDatabaseRestoreVerified: true,
    isolatedObjectRestoreVerified: true,
    applicationReadSmokePassed: true,
    totalDurationMs: 45_000,
    rtoMinutes: 240,
    isolatedRestoreDatabaseDropped: true,
    isolatedRestoreTargetCleared: true,
    temporaryProviderCredentialsActiveAfterCloseout: false,
    localRestoreProcessesStopped: true,
    temporaryHelpersRemoved: true,
    productionHealthVerified: true,
    productionMonitorPassed: true,
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
  operationalReadiness: {
    status: "ready",
    evidenceUpdatedAt: "2026-06-21T11:00:00.000Z",
    postgresqlLogicalRecovery: "passed",
    recurringBackup: "active",
    backupFreshnessMonitor: "active",
    applicationObjectByteRecovery: "passed",
  },
  applicationObjectRecovery: readyApplicationObjectRecovery,
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
    artifactIdentity: {
      status: "recorded_restricted",
      reference: "restricted-operational-evidence:test-artifact",
    },
    tableCount: 59,
    rowCount: 1524,
    pendingMigrations: 0,
    countDiffs: 0,
    contentDiffs: 0,
    restoreDurationMs: 13411,
    verificationDurationMs: 1862,
    totalDurationMs: 15273,
    activeKeyOnly: true,
    predecessorPresentAfterCloseout: false,
    temporaryProviderCredentialsActiveAfterCloseout: false,
    temporaryRailwayVaultSensitiveValuesPresent: false,
    isolatedRestoreDatabaseDropped: true,
    localRestoreProcessesStopped: true,
    temporaryHelpersRemoved: true,
    productionHealthVerified: true,
    productionMonitorPassed: true,
  },
  approvals: {
    founder: { status: "approved", approvedBy: "Michael", approvedAt: "2026-06-21T12:00:00.000Z" },
    operations: { status: "approved", approvedBy: "Michael", approvedAt: "2026-06-21T12:00:00.000Z" },
  },
  operationalApproval: {
    status: "approved",
    approvedBy: "Michael",
    approvedAt: "2026-06-21T12:00:00.000Z",
  },
};

test("launch readiness passes only when incident and recovery policy evidence are approved", () => {
  const result = evaluateLaunchReadiness({
    incidentConfig: readyIncidentConfig,
    recoveryPolicy: readyRecoveryPolicy,
  }, { now: new Date("2026-06-21T12:00:00.000Z") });

  assert.equal(result.ok, true);
  assert.equal(result.status, "ready");
  assert.deepEqual(result.findings, []);
});

test("local-only application-object source capability can never satisfy live recovery readiness", () => {
  const result = evaluateLaunchReadiness({
    incidentConfig: readyIncidentConfig,
    recoveryPolicy: {
      ...readyRecoveryPolicy,
      applicationObjectRecovery: {
        ...readyApplicationObjectRecovery,
        latestCoordinatedRestore: { status: "missing" },
      },
    },
  }, { now: new Date("2026-06-21T12:00:00.000Z") });

  assert.equal(result.summary.recovery.applicationObjectByteRecoveryPassed, false);
  assert.equal(result.summary.recovery.applicationObjectRecoveryEvidenceReady, false);
  assert.deepEqual(result.findings.map((finding) => finding.code), [
    "APPLICATION_OBJECT_RECOVERY_MISSING",
    "APPLICATION_OBJECT_RECOVERY_EVIDENCE_INVALID",
    "RECOVERY_OPERATIONAL_STATUS_INCONSISTENT",
  ]);
});

test("application-object recovery evidence fails closed on incomplete or contradictory receipts", () => {
  const cases = [
    ["provider I/O during source proof", (recovery) => { recovery.sourceCapability.providerIo = true; }],
    ["failed live receipt", (recovery) => { recovery.latestCoordinatedRestore.status = "failed"; }],
    ["unrestricted artifact reference", (recovery) => {
      recovery.latestCoordinatedRestore.objectCompletionIdentity.status = "public";
    }],
    ["inexact source revision", (recovery) => { recovery.latestCoordinatedRestore.sourceRevision = "main"; }],
    ["receipt differs from reviewed production source", (recovery) => {
      recovery.expectedProductionSourceRevision = "f".repeat(40);
    }],
    ["missing binding", (recovery) => {
      recovery.latestCoordinatedRestore.binding.objectManifestSha256 = null;
    }],
    ["unbound source revision", (recovery) => {
      recovery.latestCoordinatedRestore.binding.sourceRevision = "f".repeat(40);
    }],
    ["unrecorded immutable versions", (recovery) => {
      recovery.latestCoordinatedRestore.immutableVersionIdsRecorded = false;
    }],
    ["short retention", (recovery) => { recovery.latestCoordinatedRestore.minimumRetentionDays = 29; }],
    ["predecessor-assisted restore", (recovery) => {
      recovery.latestCoordinatedRestore.predecessorPresentDuringVerification = true;
    }],
    ["identity reuse", (recovery) => {
      recovery.latestCoordinatedRestore.identitySeparationVerified = false;
    }],
    ["object-count mismatch", (recovery) => {
      recovery.latestCoordinatedRestore.counts.restoredObjects = 7;
    }],
    ["empty object set", (recovery) => {
      recovery.latestCoordinatedRestore.counts = {
        sourceObjects: 0,
        backedUpObjects: 0,
        restoredObjects: 0,
      };
    }],
    ["byte-count mismatch", (recovery) => {
      recovery.latestCoordinatedRestore.bytes.backedUp = 8191;
    }],
    ["negative byte set", (recovery) => {
      recovery.latestCoordinatedRestore.bytes = { source: -1, backedUp: -1, restored: -1 };
    }],
    ["unresolved object", (recovery) => {
      recovery.latestCoordinatedRestore.mismatches.unresolved = 1;
    }],
    ["omitted storage scope", (recovery) => {
      recovery.latestCoordinatedRestore.scopes = recovery.latestCoordinatedRestore.scopes.slice(1);
    }],
    ["missing object restore", (recovery) => {
      recovery.latestCoordinatedRestore.isolatedObjectRestoreVerified = false;
    }],
    ["missing application read smoke", (recovery) => {
      recovery.latestCoordinatedRestore.applicationReadSmokePassed = false;
    }],
    ["receipt RTO differs from policy", (recovery) => {
      recovery.latestCoordinatedRestore.rtoMinutes = 480;
    }],
    ["restore target not cleared", (recovery) => {
      recovery.latestCoordinatedRestore.isolatedRestoreTargetCleared = false;
    }],
    ["production monitor failed", (recovery) => {
      recovery.latestCoordinatedRestore.productionMonitorPassed = false;
    }],
  ];

  for (const [label, mutate] of cases) {
    const applicationObjectRecovery = structuredClone(readyApplicationObjectRecovery);
    mutate(applicationObjectRecovery);
    const result = evaluateLaunchReadiness({
      incidentConfig: readyIncidentConfig,
      recoveryPolicy: { ...readyRecoveryPolicy, applicationObjectRecovery },
    }, { now: new Date("2026-06-21T12:00:00.000Z") });
    const codes = result.findings.map((finding) => finding.code);

    assert.equal(result.ok, false, label);
    assert.equal(result.summary.recovery.applicationObjectByteRecoveryPassed, false, label);
    assert.equal(codes.includes("APPLICATION_OBJECT_RECOVERY_EVIDENCE_INVALID"), true, label);
    assert.equal(codes.includes("RECOVERY_OPERATIONAL_STATUS_INCONSISTENT"), true, label);
  }
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
      operationalReadiness: { status: "blocked" },
      approvals: {},
      operationalApproval: { status: "pending", approvedBy: null, approvedAt: null },
    },
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
    "BACKUP_ARTIFACT_IDENTITY_MISSING",
    "POSTGRESQL_RESTORE_COUNTS_INVALID",
    "POSTGRESQL_RESTORE_PENDING_MIGRATIONS",
    "POSTGRESQL_RESTORE_COUNT_DIFFS_PRESENT",
    "POSTGRESQL_RESTORE_CONTENT_DIFFS_PRESENT",
    "POSTGRESQL_RESTORE_DURATION_INVALID",
    "ACTIVE_KEY_ONLY_RESTORE_MISSING",
    "BACKUP_KEY_PREDECESSOR_NOT_RETIRED",
    "TEMPORARY_PROVIDER_CREDENTIALS_NOT_RETIRED",
    "TEMPORARY_RAILWAY_VAULT_NOT_CLEARED",
    "ISOLATED_RESTORE_DATABASE_NOT_DROPPED",
    "LOCAL_RESTORE_PROCESSES_NOT_STOPPED",
    "TEMPORARY_RESTORE_HELPERS_NOT_REMOVED",
    "PRODUCTION_HEALTH_NOT_VERIFIED_AFTER_RESTORE",
    "PRODUCTION_MONITOR_NOT_PASSED_AFTER_RESTORE",
    "RECOVERY_OPERATIONAL_EVIDENCE_TIMESTAMP_MISSING_OR_INVALID",
    "POSTGRESQL_LOGICAL_RECOVERY_MISSING",
    "RECURRING_BACKUP_INACTIVE",
    "BACKUP_FRESHNESS_MONITOR_INACTIVE",
    "APPLICATION_OBJECT_RECOVERY_MISSING",
    "RECOVERY_APPROVAL_FOUNDER_MISSING",
    "RECOVERY_APPROVAL_OPERATIONS_MISSING",
    "RECOVERY_OPERATIONAL_APPROVAL_MISSING_OR_STALE",
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
  }, { now: new Date("2026-06-21T12:00:00.000Z") });

  assert.equal(result.ok, false);
  assert.deepEqual(result.findings.map((finding) => finding.code), [
    "RECENT_BACKUP_ARTIFACT_RESTORE_MISSING",
    "RECOVERY_OPERATIONAL_STATUS_INCONSISTENT",
    "RECOVERY_OPERATIONAL_APPROVAL_MISSING_OR_STALE",
  ]);
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

test("removing the explicit launch hold cannot hide inactive recovery capabilities", () => {
  const currentRecoveryPolicy = JSON.parse(fs.readFileSync(
    new URL("../docs/operations/recovery-policy.json", import.meta.url),
    "utf8",
  ));
  const result = evaluateLaunchReadiness({
    incidentConfig: {
      ...readyIncidentConfig,
      rehearsals: [{ status: "passed", completedAt: "2026-08-15T12:00:00.000Z" }],
    },
    recoveryPolicy: currentRecoveryPolicy,
  }, { now: new Date("2026-08-16T22:00:00.000Z") });

  assert.equal(result.ok, false);
  assert.equal(result.status, "blocked");
  assert.equal(result.findings.some((finding) => finding.code === "ACTIVE_LAUNCH_HOLD"), false);
  assert.deepEqual(result.findings.map((finding) => finding.code), [
    "RECURRING_BACKUP_INACTIVE",
    "BACKUP_FRESHNESS_MONITOR_INACTIVE",
    "APPLICATION_OBJECT_RECOVERY_MISSING",
    "RECOVERY_OPERATIONAL_APPROVAL_MISSING_OR_STALE",
  ]);
});

test("the checked-in policy retains exactly the five current launch blockers", () => {
  const incidentConfig = JSON.parse(fs.readFileSync(
    new URL("../docs/operations/incident-routing.json", import.meta.url),
    "utf8",
  ));
  const recoveryPolicy = JSON.parse(fs.readFileSync(
    new URL("../docs/operations/recovery-policy.json", import.meta.url),
    "utf8",
  ));
  const result = evaluateLaunchReadiness({ incidentConfig, recoveryPolicy }, {
    now: new Date("2026-08-16T22:00:00.000Z"),
  });

  assert.deepEqual(result.findings.map((finding) => finding.code), [
    "ACTIVE_LAUNCH_HOLD",
    "RECURRING_BACKUP_INACTIVE",
    "BACKUP_FRESHNESS_MONITOR_INACTIVE",
    "APPLICATION_OBJECT_RECOVERY_MISSING",
    "RECOVERY_OPERATIONAL_APPROVAL_MISSING_OR_STALE",
  ]);
});

test("recovery operational status cannot overrule inactive evidence leaves", () => {
  const result = evaluateLaunchReadiness({
    incidentConfig: readyIncidentConfig,
    recoveryPolicy: {
      ...readyRecoveryPolicy,
      operationalReadiness: {
        ...readyRecoveryPolicy.operationalReadiness,
        status: "ready",
        recurringBackup: "inactive",
      },
    },
  }, { now: new Date("2026-06-21T12:00:00.000Z") });

  assert.deepEqual(result.findings.map((finding) => finding.code), [
    "RECURRING_BACKUP_INACTIVE",
    "RECOVERY_OPERATIONAL_STATUS_INCONSISTENT",
  ]);
});

test("recovery operational status cannot remain blocked when every evidence leaf passes", () => {
  const result = evaluateLaunchReadiness({
    incidentConfig: readyIncidentConfig,
    recoveryPolicy: {
      ...readyRecoveryPolicy,
      operationalReadiness: {
        ...readyRecoveryPolicy.operationalReadiness,
        status: "blocked",
      },
    },
  }, { now: new Date("2026-06-21T12:00:00.000Z") });

  assert.deepEqual(result.findings.map((finding) => finding.code), [
    "RECOVERY_OPERATIONAL_STATUS_INCONSISTENT",
  ]);
});

test("recovery operational status cannot hide backup-key closeout contradictions", () => {
  for (const [restorePatch, expectedCode] of [
    [{ activeKeyOnly: false }, "ACTIVE_KEY_ONLY_RESTORE_MISSING"],
    [{ predecessorPresentAfterCloseout: true }, "BACKUP_KEY_PREDECESSOR_NOT_RETIRED"],
  ]) {
    const result = evaluateLaunchReadiness({
      incidentConfig: readyIncidentConfig,
      recoveryPolicy: {
        ...readyRecoveryPolicy,
        latestNamedArtifactRestore: {
          ...readyRecoveryPolicy.latestNamedArtifactRestore,
          ...restorePatch,
        },
      },
    }, { now: new Date("2026-06-21T12:00:00.000Z") });

    assert.deepEqual(result.findings.map((finding) => finding.code), [
      expectedCode,
      "RECOVERY_OPERATIONAL_STATUS_INCONSISTENT",
    ]);
  }
});

test("legacy artifact keys cannot satisfy restricted artifact identity evidence", () => {
  const result = evaluateLaunchReadiness({
    incidentConfig: readyIncidentConfig,
    recoveryPolicy: {
      ...readyRecoveryPolicy,
      latestNamedArtifactRestore: {
        ...readyRecoveryPolicy.latestNamedArtifactRestore,
        artifactIdentity: undefined,
        artifactKey: "backups/postgres/raw-provider-object-key",
      },
    },
  }, { now: new Date("2026-06-21T12:00:00.000Z") });

  assert.deepEqual(result.findings.map((finding) => finding.code), [
    "BACKUP_ARTIFACT_IDENTITY_MISSING",
    "RECOVERY_OPERATIONAL_STATUS_INCONSISTENT",
  ]);
});

test("contradictory restore integrity and cleanup evidence cannot satisfy launch readiness", () => {
  const cases = [
    ["status", "failed", "RECENT_BACKUP_ARTIFACT_RESTORE_MISSING"],
    ["completedAt", "2026-07-21T12:00:00.000Z", "RECENT_BACKUP_ARTIFACT_RESTORE_MISSING"],
    ["tableCount", 0, "POSTGRESQL_RESTORE_COUNTS_INVALID"],
    ["rowCount", -1, "POSTGRESQL_RESTORE_COUNTS_INVALID"],
    ["pendingMigrations", 1, "POSTGRESQL_RESTORE_PENDING_MIGRATIONS"],
    ["countDiffs", 1, "POSTGRESQL_RESTORE_COUNT_DIFFS_PRESENT"],
    ["contentDiffs", 1, "POSTGRESQL_RESTORE_CONTENT_DIFFS_PRESENT"],
    ["restoreDurationMs", 0, "POSTGRESQL_RESTORE_DURATION_INVALID"],
    ["verificationDurationMs", 0, "POSTGRESQL_RESTORE_DURATION_INVALID"],
    ["totalDurationMs", 0, "POSTGRESQL_RESTORE_DURATION_INVALID"],
    ["totalDurationMs", 15274, "POSTGRESQL_RESTORE_DURATION_MISMATCH"],
    ["activeKeyOnly", false, "ACTIVE_KEY_ONLY_RESTORE_MISSING"],
    ["predecessorPresentAfterCloseout", true, "BACKUP_KEY_PREDECESSOR_NOT_RETIRED"],
    ["temporaryProviderCredentialsActiveAfterCloseout", true, "TEMPORARY_PROVIDER_CREDENTIALS_NOT_RETIRED"],
    ["temporaryRailwayVaultSensitiveValuesPresent", true, "TEMPORARY_RAILWAY_VAULT_NOT_CLEARED"],
    ["isolatedRestoreDatabaseDropped", false, "ISOLATED_RESTORE_DATABASE_NOT_DROPPED"],
    ["localRestoreProcessesStopped", false, "LOCAL_RESTORE_PROCESSES_NOT_STOPPED"],
    ["temporaryHelpersRemoved", false, "TEMPORARY_RESTORE_HELPERS_NOT_REMOVED"],
    ["productionHealthVerified", false, "PRODUCTION_HEALTH_NOT_VERIFIED_AFTER_RESTORE"],
    ["productionMonitorPassed", false, "PRODUCTION_MONITOR_NOT_PASSED_AFTER_RESTORE"],
  ];

  for (const [field, value, expectedCode] of cases) {
    const result = evaluateLaunchReadiness({
      incidentConfig: readyIncidentConfig,
      recoveryPolicy: {
        ...readyRecoveryPolicy,
        latestNamedArtifactRestore: {
          ...readyRecoveryPolicy.latestNamedArtifactRestore,
          [field]: value,
        },
      },
    }, { now: new Date("2026-06-21T12:00:00.000Z") });

    const codes = result.findings.map((finding) => finding.code);
    assert.equal(result.ok, false, `${field} contradiction must block readiness`);
    assert.equal(codes.includes(expectedCode), true, `${field} must report ${expectedCode}`);
    assert.equal(
      codes.includes("RECOVERY_OPERATIONAL_STATUS_INCONSISTENT"),
      true,
      `${field} must invalidate the declared ready status`,
    );
  }

  const overRtoDurationMs = readyRecoveryPolicy.targets.rtoMinutes * 60_000 + 1;
  const result = evaluateLaunchReadiness({
    incidentConfig: readyIncidentConfig,
    recoveryPolicy: {
      ...readyRecoveryPolicy,
      latestNamedArtifactRestore: {
        ...readyRecoveryPolicy.latestNamedArtifactRestore,
        restoreDurationMs: overRtoDurationMs - 1,
        verificationDurationMs: 1,
        totalDurationMs: overRtoDurationMs,
      },
    },
  }, { now: new Date("2026-06-21T12:00:00.000Z") });

  assert.deepEqual(result.findings.map((finding) => finding.code), [
    "POSTGRESQL_RESTORE_RTO_EXCEEDED",
    "RECOVERY_OPERATIONAL_STATUS_INCONSISTENT",
  ]);
});

test("restore cadence rejects invalid and overdue next-due dates", () => {
  for (const [nextDueAt, expectedCode] of [
    ["not-a-date", "NEXT_RESTORE_DRILL_MISSING"],
    ["2026-06-20", "NEXT_RESTORE_DRILL_OVERDUE"],
  ]) {
    const result = evaluateLaunchReadiness({
      incidentConfig: readyIncidentConfig,
      recoveryPolicy: {
        ...readyRecoveryPolicy,
        restoreDrillCadence: {
          ...readyRecoveryPolicy.restoreDrillCadence,
          nextDueAt,
        },
      },
    }, { now: new Date("2026-06-21T12:00:00.000Z") });

    assert.deepEqual(result.findings.map((finding) => finding.code), [expectedCode]);
  }
});

test("current operational approval must postdate restore evidence", () => {
  for (const operationalApproval of [
    { status: "pending", approvedBy: null, approvedAt: null },
    { status: "approved", approvedBy: "Michael", approvedAt: "2026-06-21T03:00:00.000Z" },
    { status: "approved", approvedBy: "Michael", approvedAt: "2026-06-22T12:00:00.000Z" },
  ]) {
    const result = evaluateLaunchReadiness({
      incidentConfig: readyIncidentConfig,
      recoveryPolicy: {
        ...readyRecoveryPolicy,
        operationalApproval,
      },
    }, { now: new Date("2026-06-21T12:00:00.000Z") });

    assert.deepEqual(result.findings.map((finding) => finding.code), [
      "RECOVERY_OPERATIONAL_APPROVAL_MISSING_OR_STALE",
    ]);
  }
});

test("current operational approval must postdate operational evidence changes", () => {
  const result = evaluateLaunchReadiness({
    incidentConfig: readyIncidentConfig,
    recoveryPolicy: {
      ...readyRecoveryPolicy,
      operationalReadiness: {
        ...readyRecoveryPolicy.operationalReadiness,
        evidenceUpdatedAt: "2026-06-21T12:30:00.000Z",
      },
    },
  }, { now: new Date("2026-06-21T13:00:00.000Z") });

  assert.deepEqual(result.findings.map((finding) => finding.code), [
    "RECOVERY_OPERATIONAL_APPROVAL_MISSING_OR_STALE",
  ]);
});

test("current operational approval must postdate coordinated object-restore evidence", () => {
  const result = evaluateLaunchReadiness({
    incidentConfig: readyIncidentConfig,
    recoveryPolicy: {
      ...readyRecoveryPolicy,
      operationalApproval: {
        status: "approved",
        approvedBy: "Michael",
        approvedAt: "2026-06-21T11:15:00.000Z",
      },
      applicationObjectRecovery: {
        ...readyApplicationObjectRecovery,
        latestCoordinatedRestore: {
          ...readyApplicationObjectRecovery.latestCoordinatedRestore,
          completedAt: "2026-06-21T11:30:00.000Z",
        },
      },
    },
  }, { now: new Date("2026-06-21T12:00:00.000Z") });

  assert.deepEqual(result.findings.map((finding) => finding.code), [
    "RECOVERY_OPERATIONAL_APPROVAL_MISSING_OR_STALE",
  ]);
});

test("operational evidence update timestamps must be valid and non-future", () => {
  for (const evidenceUpdatedAt of [undefined, "not-a-date", "2026-06-22T12:00:00.000Z"]) {
    const result = evaluateLaunchReadiness({
      incidentConfig: readyIncidentConfig,
      recoveryPolicy: {
        ...readyRecoveryPolicy,
        operationalReadiness: {
          ...readyRecoveryPolicy.operationalReadiness,
          evidenceUpdatedAt,
        },
      },
    }, { now: new Date("2026-06-21T12:00:00.000Z") });

    assert.deepEqual(result.findings.map((finding) => finding.code), [
      "RECOVERY_OPERATIONAL_EVIDENCE_TIMESTAMP_MISSING_OR_INVALID",
      "RECOVERY_OPERATIONAL_STATUS_INCONSISTENT",
      "RECOVERY_OPERATIONAL_APPROVAL_MISSING_OR_STALE",
    ]);
  }
});
