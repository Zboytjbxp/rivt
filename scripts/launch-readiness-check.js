import "dotenv/config";
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { evaluateIncidentReadiness, loadIncidentRoutingConfig } from "./incident-readiness-check.js";

const defaultIncidentPath = "docs/operations/incident-routing.json";
const defaultRecoveryPath = "docs/operations/recovery-policy.json";
const maxEvidenceAgeDays = 30;
const liveApplicationReadSmokeEvidenceLevel =
  "live-cookie-session-http-provider-delivery";
const liveWriterAuthorityEvidenceLevel =
  "live-aws-control-and-data-plane";
const applicationObjectRecoveryScopes = [
  "album",
  "contact-note",
  "document-brand",
  "legacy",
  "message",
  "professional-profile",
  "project",
  "shop-talk",
];

function hasValue(value) {
  return typeof value === "string" && value.trim() && value.trim().toUpperCase() !== "TBD";
}

function approved(record) {
  return record?.status === "approved" && hasValue(record.approvedBy) && Boolean(record.approvedAt);
}

function positiveNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function positiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function nonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

function dateTime(value, { endOfDate = false } = {}) {
  if (typeof value !== "string" || !value.trim()) return null;
  const normalized = endOfDate && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())
    ? `${value.trim()}T23:59:59.999Z`
    : value.trim();
  const date = new Date(normalized);
  return Number.isFinite(date.getTime()) ? date : null;
}

function withinDays(value, days, now = new Date()) {
  const date = dateTime(value);
  if (!date) return false;
  const ageMs = now.getTime() - date.getTime();
  return ageMs >= 0 && ageMs <= days * 24 * 60 * 60 * 1000;
}

function restrictedArtifactIdentityRecorded(identity) {
  return identity?.status === "recorded_restricted" && hasValue(identity.reference);
}

function sha256Recorded(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/i.test(value);
}

function exactSourceRevisionRecorded(value) {
  return typeof value === "string" && /^[a-f0-9]{40}$/i.test(value);
}

function exactRecoveryScopesRecorded(scopes) {
  return Array.isArray(scopes) &&
    scopes.length === applicationObjectRecoveryScopes.length &&
    [...scopes].sort().every((scope, index) => scope === applicationObjectRecoveryScopes[index]);
}

function independentWriterRetirementFinalizationRecorded(finalization, recoveryCompletedAt) {
  const registeredAt = dateTime(finalization?.registeredAt);
  const deadlineAt = dateTime(finalization?.deadlineAt);
  const finalizedAt = dateTime(finalization?.finalizedAt);
  const proofDeadlineAt = dateTime(finalization?.proofDeadlineAt);
  const writerSessionExpiresAt = dateTime(finalization?.writerSessionExpiresAt);
  const completedAt = dateTime(recoveryCompletedAt);
  return finalization?.status === "retired_verified" &&
    finalization?.authority === "independent-controller" &&
    finalization?.trigger === "writer-requested" &&
    finalization?.operationOutcome === "completed" &&
    sha256Recorded(finalization?.controllerIdentitySha256) &&
    sha256Recorded(finalization?.auditorIdentitySha256) &&
    finalization.auditorIdentitySha256 !== finalization.controllerIdentitySha256 &&
    registeredAt && deadlineAt && finalizedAt && proofDeadlineAt &&
    writerSessionExpiresAt && completedAt &&
    registeredAt <= finalizedAt &&
    registeredAt < deadlineAt &&
    deadlineAt < proofDeadlineAt &&
    finalizedAt <= proofDeadlineAt &&
    finalizedAt <= completedAt &&
    proofDeadlineAt < writerSessionExpiresAt &&
    restrictedArtifactIdentityRecorded(finalization?.identity);
}

function coordinatedApplicationObjectRestoreReady(
  applicationObjectRecovery,
  backupRetention,
  targets,
  now,
) {
  const receipt = applicationObjectRecovery?.latestCoordinatedRestore;
  const counts = receipt?.counts;
  const bytes = receipt?.bytes;
  const mismatches = receipt?.mismatches;
  const binding = receipt?.binding;

  return applicationObjectRecovery?.sourceCapability?.status === "verified_local_only" &&
    hasValue(applicationObjectRecovery.sourceCapability.evidence) &&
    applicationObjectRecovery.sourceCapability.providerIo === false &&
    applicationObjectRecovery.sourceCapability.productionDataRead === false &&
    applicationObjectRecovery.sourceCapability.chargeBearingAction === false &&
    receipt?.status === "passed" &&
    withinDays(receipt.completedAt, maxEvidenceAgeDays, now) &&
    restrictedArtifactIdentityRecorded(receipt?.recoverySetIdentity) &&
    restrictedArtifactIdentityRecorded(receipt?.databaseArtifactIdentity) &&
    restrictedArtifactIdentityRecorded(receipt?.objectCompletionIdentity) &&
    exactSourceRevisionRecorded(receipt?.sourceRevision) &&
    exactSourceRevisionRecorded(applicationObjectRecovery?.expectedProductionSourceRevision) &&
    receipt.sourceRevision === applicationObjectRecovery.expectedProductionSourceRevision &&
    binding?.sourceRevision === receipt.sourceRevision &&
    sha256Recorded(binding?.databaseManifestSha256) &&
    sha256Recorded(binding?.databaseArtifactSha256) &&
    sha256Recorded(binding?.objectManifestSha256) &&
    sha256Recorded(binding?.sourceInventorySha256) &&
    sha256Recorded(binding?.sourceStoreIdentitySha256) &&
    sha256Recorded(binding?.recoverySetIdentitySha256) &&
    receipt?.immutableVersionIdsRecorded === true &&
    receipt?.complianceRetentionVerified === true &&
    positiveNumber(receipt?.minimumRetentionDays) &&
    positiveNumber(backupRetention?.days) &&
    receipt.minimumRetentionDays >= backupRetention.days &&
    receipt?.activeKeyOnly === true &&
    receipt?.predecessorPresentDuringVerification === false &&
    receipt?.identitySeparationVerified === true &&
    positiveInteger(counts?.sourceObjects) &&
    counts.sourceObjects === counts?.backedUpObjects &&
    counts.sourceObjects === counts?.restoredObjects &&
    nonNegativeInteger(bytes?.source) &&
    bytes.source === bytes?.backedUp &&
    bytes.source === bytes?.restored &&
    mismatches?.missing === 0 &&
    mismatches?.checksum === 0 &&
    mismatches?.metadata === 0 &&
    mismatches?.unresolved === 0 &&
    mismatches?.unexpected === 0 &&
    exactRecoveryScopesRecorded(receipt?.scopes) &&
    receipt?.isolatedDatabaseRestoreVerified === true &&
    receipt?.isolatedObjectRestoreVerified === true &&
    receipt?.applicationReadSmokePassed === true &&
    receipt?.applicationReadSmokeEvidenceLevel
      === liveApplicationReadSmokeEvidenceLevel &&
    receipt?.writerAuthorityEvidenceLevel === liveWriterAuthorityEvidenceLevel &&
    independentWriterRetirementFinalizationRecorded(
      receipt?.writerRetirementFinalization,
      receipt?.completedAt,
    ) &&
    positiveNumber(receipt?.totalDurationMs) &&
    positiveNumber(targets?.rtoMinutes) &&
    receipt?.rtoMinutes === targets.rtoMinutes &&
    receipt.totalDurationMs <= targets.rtoMinutes * 60_000 &&
    receipt?.isolatedRestoreDatabaseDropped === true &&
    receipt?.isolatedRestoreTargetCleared === true &&
    receipt?.temporaryProviderCredentialsActiveAfterCloseout === false &&
    receipt?.localRestoreProcessesStopped === true &&
    receipt?.temporaryHelpersRemoved === true &&
    receipt?.productionHealthVerified === true &&
    receipt?.productionMonitorPassed === true;
}

function currentOperationalApproval(
  approval,
  latestRestore,
  operationalReadiness,
  applicationObjectRecovery,
  now,
) {
  if (approval?.status !== "approved" || !hasValue(approval.approvedBy)) return false;
  const approvedAt = dateTime(approval.approvedAt);
  const restoreEvidenceAt = dateTime(latestRestore?.completedAt);
  const operationalEvidenceAt = dateTime(operationalReadiness?.evidenceUpdatedAt);
  if (!approvedAt || !restoreEvidenceAt || !operationalEvidenceAt) return false;
  const coordinatedRestoreAt = dateTime(
    applicationObjectRecovery?.latestCoordinatedRestore?.completedAt,
  );
  const latestEvidenceAt = Math.max(
    restoreEvidenceAt.getTime(),
    operationalEvidenceAt.getTime(),
    coordinatedRestoreAt?.getTime() ?? Number.NEGATIVE_INFINITY,
  );
  return latestEvidenceAt <= now.getTime() &&
    approvedAt.getTime() >= latestEvidenceAt &&
    approvedAt.getTime() <= now.getTime();
}

function evaluateRecoveryPolicy(policy, { now = new Date() } = {}) {
  const findings = [];

  if (policy.status !== "approved") {
    findings.push({
      code: "RECOVERY_POLICY_NOT_APPROVED",
      message: "RPO/RTO and backup-retention policy must be approved before Gate A launch.",
    });
  }

  if (!positiveNumber(policy.targets?.rpoMinutes) || !hasValue(policy.targets?.rpoBasis)) {
    findings.push({
      code: "RPO_TARGET_MISSING",
      message: "Recovery point objective must include an approved numeric minute target and basis.",
    });
  }

  if (!positiveNumber(policy.targets?.rtoMinutes) || !hasValue(policy.targets?.rtoBasis)) {
    findings.push({
      code: "RTO_TARGET_MISSING",
      message: "Recovery time objective must include an approved numeric minute target and basis.",
    });
  }

  if (!positiveNumber(policy.backupRetention?.days) || !hasValue(policy.backupRetention?.owner)) {
    findings.push({
      code: "BACKUP_RETENTION_MISSING",
      message: "Backup retention must include a numeric day window and owner.",
    });
  }

  if (!positiveNumber(policy.restoreDrillCadence?.days) || !hasValue(policy.restoreDrillCadence?.owner)) {
    findings.push({
      code: "RESTORE_CADENCE_MISSING",
      message: "Recurring restore-drill cadence must include a numeric day window and owner.",
    });
  }

  const nextRestoreDrillDueAt = dateTime(policy.restoreDrillCadence?.nextDueAt, { endOfDate: true });
  if (!nextRestoreDrillDueAt) {
    findings.push({
      code: "NEXT_RESTORE_DRILL_MISSING",
      message: "Next restore-drill due date must be recorded as a valid date.",
    });
  } else if (nextRestoreDrillDueAt.getTime() < now.getTime()) {
    findings.push({
      code: "NEXT_RESTORE_DRILL_OVERDUE",
      message: "The next restore-drill due date has passed.",
    });
  }

  const latestRestore = policy.latestNamedArtifactRestore;
  const recentRestoreEvidence = latestRestore?.status === "passed" &&
    withinDays(latestRestore.completedAt, maxEvidenceAgeDays, now);
  if (!recentRestoreEvidence) {
    findings.push({
      code: "RECENT_BACKUP_ARTIFACT_RESTORE_MISSING",
      message: "A passed named backup-artifact restore from the last 30 days is required.",
    });
  }

  if (!restrictedArtifactIdentityRecorded(latestRestore?.artifactIdentity)) {
    findings.push({
      code: "BACKUP_ARTIFACT_IDENTITY_MISSING",
      message: "The restored artifact must have a non-secret identity reference recorded in restricted evidence.",
    });
  }

  const restoreCountsValid = positiveInteger(latestRestore?.tableCount) &&
    nonNegativeInteger(latestRestore?.rowCount);
  if (!restoreCountsValid) {
    findings.push({
      code: "POSTGRESQL_RESTORE_COUNTS_INVALID",
      message: "The latest restore must record a positive table count and a non-negative row count.",
    });
  }

  const restoreMigrationsCurrent = latestRestore?.pendingMigrations === 0;
  if (!restoreMigrationsCurrent) {
    findings.push({
      code: "POSTGRESQL_RESTORE_PENDING_MIGRATIONS",
      message: "The latest restored database must have zero pending migrations.",
    });
  }

  const restoreCountParityVerified = latestRestore?.countDiffs === 0;
  if (!restoreCountParityVerified) {
    findings.push({
      code: "POSTGRESQL_RESTORE_COUNT_DIFFS_PRESENT",
      message: "The latest restore must have zero source-to-target row-count differences.",
    });
  }

  const restoreContentParityVerified = latestRestore?.contentDiffs === 0;
  if (!restoreContentParityVerified) {
    findings.push({
      code: "POSTGRESQL_RESTORE_CONTENT_DIFFS_PRESENT",
      message: "The latest restore must have zero source-to-target content differences.",
    });
  }

  const restoreDurationsValid = positiveNumber(latestRestore?.restoreDurationMs) &&
    positiveNumber(latestRestore?.verificationDurationMs) &&
    positiveNumber(latestRestore?.totalDurationMs);
  if (!restoreDurationsValid) {
    findings.push({
      code: "POSTGRESQL_RESTORE_DURATION_INVALID",
      message: "Restore, verification, and total recovery durations must all be positive numbers.",
    });
  }

  const restoreDurationMatches = restoreDurationsValid &&
    latestRestore.totalDurationMs ===
      latestRestore.restoreDurationMs + latestRestore.verificationDurationMs;
  if (restoreDurationsValid && !restoreDurationMatches) {
    findings.push({
      code: "POSTGRESQL_RESTORE_DURATION_MISMATCH",
      message: "Total recovery duration must equal restore duration plus verification duration.",
    });
  }

  const restoreWithinRto = restoreDurationsValid &&
    positiveNumber(policy.targets?.rtoMinutes) &&
    latestRestore.totalDurationMs <= policy.targets.rtoMinutes * 60_000;
  if (restoreDurationsValid && positiveNumber(policy.targets?.rtoMinutes) && !restoreWithinRto) {
    findings.push({
      code: "POSTGRESQL_RESTORE_RTO_EXCEEDED",
      message: "The latest total recovery duration exceeds the approved recovery time objective.",
    });
  }

  const activeKeyOnlyRestore = latestRestore?.activeKeyOnly === true;
  if (!activeKeyOnlyRestore) {
    findings.push({
      code: "ACTIVE_KEY_ONLY_RESTORE_MISSING",
      message: "The latest restore evidence must prove recovery with only the active backup-encryption key.",
    });
  }

  const backupKeyPredecessorRetired = latestRestore?.predecessorPresentAfterCloseout === false;
  if (!backupKeyPredecessorRetired) {
    findings.push({
      code: "BACKUP_KEY_PREDECESSOR_NOT_RETIRED",
      message: "The latest restore closeout must record that the predecessor backup-encryption key is absent.",
    });
  }

  const temporaryProviderCredentialsRetired =
    latestRestore?.temporaryProviderCredentialsActiveAfterCloseout === false;
  if (!temporaryProviderCredentialsRetired) {
    findings.push({
      code: "TEMPORARY_PROVIDER_CREDENTIALS_NOT_RETIRED",
      message: "Temporary provider credentials must be inactive after restore closeout.",
    });
  }

  const temporaryRailwayVaultCleared =
    latestRestore?.temporaryRailwayVaultSensitiveValuesPresent === false;
  if (!temporaryRailwayVaultCleared) {
    findings.push({
      code: "TEMPORARY_RAILWAY_VAULT_NOT_CLEARED",
      message: "Temporary Railway vault values must be absent after restore closeout.",
    });
  }

  const isolatedRestoreDatabaseDropped = latestRestore?.isolatedRestoreDatabaseDropped === true;
  if (!isolatedRestoreDatabaseDropped) {
    findings.push({
      code: "ISOLATED_RESTORE_DATABASE_NOT_DROPPED",
      message: "The isolated restore database must be dropped after verification.",
    });
  }

  const localRestoreProcessesStopped = latestRestore?.localRestoreProcessesStopped === true;
  if (!localRestoreProcessesStopped) {
    findings.push({
      code: "LOCAL_RESTORE_PROCESSES_NOT_STOPPED",
      message: "Local restore processes and tunnels must be stopped after verification.",
    });
  }

  const temporaryHelpersRemoved = latestRestore?.temporaryHelpersRemoved === true;
  if (!temporaryHelpersRemoved) {
    findings.push({
      code: "TEMPORARY_RESTORE_HELPERS_NOT_REMOVED",
      message: "Temporary restore helpers must be removed after verification.",
    });
  }

  const productionHealthVerified = latestRestore?.productionHealthVerified === true;
  if (!productionHealthVerified) {
    findings.push({
      code: "PRODUCTION_HEALTH_NOT_VERIFIED_AFTER_RESTORE",
      message: "Production health must be verified after restore closeout.",
    });
  }

  const productionMonitorPassed = latestRestore?.productionMonitorPassed === true;
  if (!productionMonitorPassed) {
    findings.push({
      code: "PRODUCTION_MONITOR_NOT_PASSED_AFTER_RESTORE",
      message: "The production synthetic monitor must pass after restore closeout.",
    });
  }

  const postgresqlRestoreEvidenceReady = recentRestoreEvidence &&
    restrictedArtifactIdentityRecorded(latestRestore?.artifactIdentity) &&
    restoreCountsValid &&
    restoreMigrationsCurrent &&
    restoreCountParityVerified &&
    restoreContentParityVerified &&
    restoreDurationsValid &&
    restoreDurationMatches &&
    restoreWithinRto &&
    activeKeyOnlyRestore &&
    backupKeyPredecessorRetired &&
    temporaryProviderCredentialsRetired &&
    temporaryRailwayVaultCleared &&
    isolatedRestoreDatabaseDropped &&
    localRestoreProcessesStopped &&
    temporaryHelpersRemoved &&
    productionHealthVerified &&
    productionMonitorPassed;

  const operationalReadiness = policy.operationalReadiness;
  const operationalEvidenceAt = dateTime(operationalReadiness?.evidenceUpdatedAt);
  const operationalEvidenceTimestampValid = Boolean(
    operationalEvidenceAt && operationalEvidenceAt.getTime() <= now.getTime()
  );
  if (!operationalEvidenceTimestampValid) {
    findings.push({
      code: "RECOVERY_OPERATIONAL_EVIDENCE_TIMESTAMP_MISSING_OR_INVALID",
      message: "Recovery operational evidence must record a valid, non-future update timestamp.",
    });
  }

  const postgresqlLogicalRecoveryDeclared =
    operationalReadiness?.postgresqlLogicalRecovery === "passed";
  const applicationObjectRecoveryDeclared =
    operationalReadiness?.applicationObjectByteRecovery === "passed";
  const applicationObjectRecoveryEvidenceReady = coordinatedApplicationObjectRestoreReady(
    policy.applicationObjectRecovery,
    policy.backupRetention,
    policy.targets,
    now,
  );
  const recoveryLeaves = {
    postgresqlLogicalRecovery: postgresqlLogicalRecoveryDeclared && postgresqlRestoreEvidenceReady,
    recurringBackup: operationalReadiness?.recurringBackup === "active",
    backupFreshnessMonitor: operationalReadiness?.backupFreshnessMonitor === "active",
    applicationObjectByteRecovery:
      applicationObjectRecoveryDeclared && applicationObjectRecoveryEvidenceReady,
  };

  if (!postgresqlLogicalRecoveryDeclared) {
    findings.push({
      code: "POSTGRESQL_LOGICAL_RECOVERY_MISSING",
      message: "A passed PostgreSQL logical backup restore is required before launch.",
    });
  }

  if (!recoveryLeaves.recurringBackup) {
    findings.push({
      code: "RECURRING_BACKUP_INACTIVE",
      message: "Recurring production backups must be active before launch.",
    });
  }

  if (!recoveryLeaves.backupFreshnessMonitor) {
    findings.push({
      code: "BACKUP_FRESHNESS_MONITOR_INACTIVE",
      message: "Independent backup-freshness monitoring must be active before launch.",
    });
  }

  if (!recoveryLeaves.applicationObjectByteRecovery) {
    findings.push({
      code: "APPLICATION_OBJECT_RECOVERY_MISSING",
      message: "Recovery of application photos, documents, and attachment bytes must be proven before launch.",
    });
  }

  if (applicationObjectRecoveryDeclared && !applicationObjectRecoveryEvidenceReady) {
    findings.push({
      code: "APPLICATION_OBJECT_RECOVERY_EVIDENCE_INVALID",
      message: "A declared application-object recovery pass requires a recent, complete, immutable, active-key-only coordinated restore receipt.",
    });
  }

  const operationalLeavesReady = Object.values(recoveryLeaves).every(Boolean) &&
    operationalEvidenceTimestampValid;
  const expectedOperationalStatus = operationalLeavesReady ? "ready" : "blocked";
  if (operationalReadiness?.status !== expectedOperationalStatus) {
    findings.push({
      code: "RECOVERY_OPERATIONAL_STATUS_INCONSISTENT",
      message: `Recovery operational status must be ${expectedOperationalStatus} based on its evidence leaves.`,
    });
  }

  for (const key of ["founder", "operations"]) {
    if (!approved(policy.approvals?.[key])) {
      findings.push({
        code: `RECOVERY_APPROVAL_${key.toUpperCase()}_MISSING`,
        message: `${key} recovery-policy approval must be recorded before Gate A launch.`,
      });
    }
  }

  const operationalApprovalCurrent = currentOperationalApproval(
    policy.operationalApproval,
    latestRestore,
    operationalReadiness,
    policy.applicationObjectRecovery,
    now,
  );
  if (!operationalApprovalCurrent) {
    findings.push({
      code: "RECOVERY_OPERATIONAL_APPROVAL_MISSING_OR_STALE",
      message: "Recovery operations require an explicit approval recorded at or after the latest recovery evidence/configuration.",
    });
  }

  return {
    ok: findings.length === 0,
    findings,
    summary: {
      status: policy.status,
      rpoMinutes: policy.targets?.rpoMinutes ?? null,
      rtoMinutes: policy.targets?.rtoMinutes ?? null,
      retentionDays: policy.backupRetention?.days ?? null,
      restoreDrillCadenceDays: policy.restoreDrillCadence?.days ?? null,
      nextRestoreDrillDueAt: policy.restoreDrillCadence?.nextDueAt ?? null,
      recentNamedArtifactRestore: Boolean(
        recentRestoreEvidence,
      ),
      artifactIdentityRecorded: restrictedArtifactIdentityRecorded(latestRestore?.artifactIdentity),
      postgresqlRestoreEvidenceReady,
      restoreCountsValid,
      restoreMigrationsCurrent,
      restoreCountParityVerified,
      restoreContentParityVerified,
      restoreDurationsValid,
      restoreDurationMatches,
      restoreWithinRto,
      activeKeyOnlyRestore,
      backupKeyPredecessorRetired,
      temporaryProviderCredentialsRetired,
      temporaryRailwayVaultCleared,
      isolatedRestoreDatabaseDropped,
      localRestoreProcessesStopped,
      temporaryHelpersRemoved,
      productionHealthVerified,
      productionMonitorPassed,
      operationalStatus: operationalReadiness?.status ?? null,
      operationalEvidenceUpdatedAt: operationalReadiness?.evidenceUpdatedAt ?? null,
      postgresqlLogicalRecovery: recoveryLeaves.postgresqlLogicalRecovery,
      recurringBackupActive: recoveryLeaves.recurringBackup,
      backupFreshnessMonitorActive: recoveryLeaves.backupFreshnessMonitor,
      applicationObjectByteRecoveryPassed: recoveryLeaves.applicationObjectByteRecovery,
      applicationObjectRecoveryEvidenceReady,
      operationalApprovalCurrent,
    },
  };
}

export function evaluateLaunchReadiness({ incidentConfig, recoveryPolicy }, { now = new Date() } = {}) {
  const incident = evaluateIncidentReadiness(incidentConfig, { now });
  const recovery = evaluateRecoveryPolicy(recoveryPolicy, { now });
  const findings = [
    ...(incidentConfig.launchHold?.active
      ? [{
          code: "ACTIVE_LAUNCH_HOLD",
          message:
            incidentConfig.launchHold.reason ||
            "An explicit operational launch hold must be cleared before launch.",
          source: "incident",
        }]
      : []),
    ...incident.findings.map((finding) => ({ ...finding, source: "incident" })),
    ...recovery.findings.map((finding) => ({ ...finding, source: "recovery" })),
  ];

  return {
    ok: findings.length === 0,
    status: findings.length === 0 ? "ready" : "blocked",
    findings,
    summary: {
      incident: incident.summary,
      recovery: recovery.summary,
      activeLaunchHold: Boolean(incidentConfig.launchHold?.active),
    },
  };
}

export function loadRecoveryPolicy(filePath = defaultRecoveryPath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function argValue(argv, name, fallback) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : fallback;
}

export async function main(argv = process.argv.slice(2)) {
  const requireReady = argv.includes("--require-ready");
  const jsonOnly = argv.includes("--json");
  const incidentPath = argValue(argv, "--incident-file", defaultIncidentPath);
  const recoveryPath = argValue(argv, "--recovery-file", defaultRecoveryPath);
  const result = evaluateLaunchReadiness({
    incidentConfig: loadIncidentRoutingConfig(incidentPath),
    recoveryPolicy: loadRecoveryPolicy(recoveryPath),
  });

  if (jsonOnly || !result.ok) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("Launch readiness passed.");
  }

  if (requireReady && !result.ok) {
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
