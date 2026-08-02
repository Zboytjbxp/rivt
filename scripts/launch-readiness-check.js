import "dotenv/config";
import crypto from "node:crypto";
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { evaluateIncidentReadiness, loadIncidentRoutingConfig } from "./incident-readiness-check.js";
import {
  canonicalRepositoryEvidence,
  isExternallyVerifiedEvidence,
  repositoryEvidenceSha256,
  resolveRegularRepositoryFile,
} from "./repository-evidence.js";

const defaultIncidentPath = "docs/operations/incident-routing.json";
const defaultRecoveryPath = "docs/operations/recovery-policy.json";
const defaultPaymentProviderPath = "docs/operations/payment-provider-readiness.json";
const maxEvidenceAgeDays = 30;
const paymentProviderEvidenceControlId = "bank-payment-provider-state";
const paymentProviderEvidenceType = "provider-payment-state-verification";
const paymentProviderEvidenceStatus = "verified";

function hasValue(value) {
  return typeof value === "string" && value.trim() && value.trim().toUpperCase() !== "TBD";
}

function approved(record) {
  return record?.status === "approved" && hasValue(record.approvedBy) && Boolean(record.approvedAt);
}

function dateValue(value) {
  const date = new Date(value ?? "");
  return Number.isFinite(date.getTime()) ? date : null;
}

function sha256Value(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/i.test(value);
}

function providerIdValue(value) {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._/-]{1,127}$/.test(value);
}

function strictReceiptMatch(receipt, expected) {
  if (!receipt || typeof receipt !== "object" || Array.isArray(receipt)) return false;
  const actualKeys = Object.keys(receipt).sort();
  const expectedKeys = Object.keys(expected).sort();
  return actualKeys.length === expectedKeys.length
    && actualKeys.every((key, index) => key === expectedKeys[index])
    && expectedKeys.every((key) => Object.is(receipt[key], expected[key]));
}

function evidenceRecord(
  record,
  dateField,
  {
    now = new Date(),
    evidenceByPath = {},
    evidencePathUseCount = new Map(),
    evidenceSha256ByPath = {},
    externallyVerifiedEvidence = new Set(),
    controlId,
    type,
    receiptStatus = record?.status,
    substantiveFields = {},
  } = {},
) {
  const evidencePath = record?.evidence;
  const evidence = evidenceByPath[evidencePath];
  const receipt = evidence?.receipt;
  const canonicalPath = evidence?.canonicalPath;
  const expectedReceipt = {
    schemaVersion: 1,
    controlId,
    type,
    provider: record?.evidenceProvider,
    status: receiptStatus,
    timestamp: record?.[dateField],
    ...substantiveFields,
  };
  return (
    hasValue(evidencePath)
    && hasValue(canonicalPath)
    && evidencePathUseCount.get(canonicalPath) === 1
    && providerIdValue(record?.evidenceProvider)
    && sha256Value(record?.evidenceSha256)
    && evidence?.sha256 === record.evidenceSha256
    && evidenceSha256ByPath[evidencePath] === record.evidenceSha256
    && withinDays(record?.[dateField], maxEvidenceAgeDays, now)
    && strictReceiptMatch(receipt, expectedReceipt)
    && isExternallyVerifiedEvidence(externallyVerifiedEvidence, {
      controlId,
      provider: record.evidenceProvider,
      sha256: record.evidenceSha256,
    })
  );
}

export function recoveryPolicyConfigurationDigest(policy = {}) {
  const reviewedConfiguration = {
    version: policy.version ?? null,
    status: policy.status ?? null,
    targets: policy.targets ?? null,
    backupSchedule: policy.backupSchedule ?? null,
    latestSuccessfulBackup: policy.latestSuccessfulBackup ?? null,
    missedBackupAlert: policy.missedBackupAlert ?? null,
    backupRetention: policy.backupRetention ?? null,
    failureDomain: policy.failureDomain ?? null,
    restoreDrillCadence: policy.restoreDrillCadence ?? null,
    latestNamedArtifactRestore: policy.latestNamedArtifactRestore ?? null,
    approvals: Object.fromEntries(
      ["founder", "operations"].map((key) => [key, {
        status: policy.approvals?.[key]?.status ?? null,
        approvedBy: policy.approvals?.[key]?.approvedBy ?? null,
        approvedAt: policy.approvals?.[key]?.approvedAt ?? null,
      }]),
    ),
  };
  return crypto.createHash("sha256").update(JSON.stringify(reviewedConfiguration)).digest("hex");
}

export function paymentProviderConfigurationDigest(policy = {}) {
  const state = policy.verifiedProductionState ?? {};
  const approval = policy.approval ?? {};
  const reviewedConfiguration = {
    version: policy.version ?? null,
    status: policy.status ?? null,
    mode: policy.mode ?? null,
    featureFlagVerifiedOff: policy.featureFlagVerifiedOff === true,
    providerDestinationScope: policy.providerDestinationScope ?? null,
    runtimeScopeAttestation: policy.runtimeScopeAttestation ?? null,
    signedDeliveryVerified: policy.signedDeliveryVerified === true,
    verifiedAt: policy.verifiedAt ?? null,
    evidenceProvider: policy.evidenceProvider ?? null,
    evidence: policy.evidence ?? null,
    evidenceSha256: policy.evidenceSha256 ?? null,
    verifiedProductionState: {
      enabled: state.enabled ?? null,
      configured: state.configured ?? null,
      webhookConfigured: state.webhookConfigured ?? null,
      mode: state.mode ?? null,
    },
    approval: {
      status: approval.status ?? null,
      approvedBy: approval.approvedBy ?? null,
      approvedAt: approval.approvedAt ?? null,
    },
  };
  return crypto.createHash("sha256").update(JSON.stringify(reviewedConfiguration)).digest("hex");
}

function readRepositoryEvidence(evidence, { rootDir = process.cwd() } = {}) {
  const resolvedEvidence = resolveRegularRepositoryFile(evidence, { rootDir });
  if (!resolvedEvidence) return null;
  try {
    const canonicalEvidence = canonicalRepositoryEvidence(
      fs.readFileSync(resolvedEvidence.canonicalPath, "utf8"),
    );
    let receipt = null;
    try {
      const parsed = JSON.parse(canonicalEvidence);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) receipt = parsed;
    } catch {
      // Non-JSON evidence remains hashable for controls that do not require a typed receipt.
    }
    return {
      canonicalPath: resolvedEvidence.canonicalPath,
      receipt,
      sha256: repositoryEvidenceSha256(canonicalEvidence),
    };
  } catch {
    return null;
  }
}

function readRepositoryEvidenceSha256(evidence, options = {}) {
  return readRepositoryEvidence(evidence, options)?.sha256 ?? null;
}

export function readPaymentProviderEvidenceSha256(policy = {}, options = {}) {
  return readRepositoryEvidenceSha256(policy.evidence, options);
}

export function readPaymentProviderEvidence(policy = {}, options = {}) {
  return readRepositoryEvidence(policy.evidence, options);
}

function recoveryEvidenceRecords(policy = {}) {
  return [
    policy.backupSchedule,
    policy.latestSuccessfulBackup,
    policy.missedBackupAlert,
    policy.backupRetention?.enforcement,
    policy.failureDomain,
    policy.latestNamedArtifactRestore,
  ];
}

export function readRecoveryPolicyEvidence(policy = {}, options = {}) {
  return Object.fromEntries(
    recoveryEvidenceRecords(policy)
      .filter((record) => hasValue(record?.evidence))
      .map((record) => [
        record.evidence,
        readRepositoryEvidence(record.evidence, options),
      ]),
  );
}

export function readRecoveryPolicyEvidenceSha256(policy = {}, options = {}) {
  const evidenceByPath = readRecoveryPolicyEvidence(policy, options);
  return Object.fromEntries(
    Object.entries(evidenceByPath)
      .map(([evidencePath, evidence]) => [evidencePath, evidence?.sha256 ?? null]),
  );
}

function evidencePathUseCounts(policy = {}, evidenceByPath = {}) {
  const counts = new Map();
  for (const record of recoveryEvidenceRecords(policy)) {
    if (!hasValue(record?.evidence)) continue;
    const canonicalPath = evidenceByPath[record.evidence]?.canonicalPath;
    if (!hasValue(canonicalPath)) continue;
    counts.set(canonicalPath, (counts.get(canonicalPath) ?? 0) + 1);
  }
  return counts;
}

function allEvidencePathUseCounts({
  recoveryPolicy,
  recoveryEvidenceByPath,
  paymentProviderPolicy,
  paymentProviderEvidence,
}) {
  const counts = evidencePathUseCounts(recoveryPolicy, recoveryEvidenceByPath);
  if (
    hasValue(paymentProviderPolicy?.evidence)
    && hasValue(paymentProviderEvidence?.canonicalPath)
  ) {
    const canonicalPath = paymentProviderEvidence.canonicalPath;
    counts.set(canonicalPath, (counts.get(canonicalPath) ?? 0) + 1);
  }
  return counts;
}

function positiveNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function safeMillisecondsFromMinutes(value) {
  if (!positiveNumber(value)) return null;
  const milliseconds = value * 60 * 1000;
  return Number.isSafeInteger(milliseconds) && milliseconds > 0 ? milliseconds : null;
}

function safeDurationTotal(...durations) {
  if (!durations.every((duration) => Number.isSafeInteger(duration) && duration > 0)) return null;
  const total = durations.reduce((sum, duration) => sum + duration, 0);
  return Number.isSafeInteger(total) ? total : null;
}

function withinDays(value, days, now = new Date()) {
  if (!value) return false;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return false;
  const ageMs = now.getTime() - date.getTime();
  return ageMs >= 0 && ageMs <= days * 24 * 60 * 60 * 1000;
}

function evaluateRecoveryPolicy(
  policy,
  {
    now = new Date(),
    recoveryEvidenceByPath = {},
    recoveryEvidenceSha256ByPath = {},
    externallyVerifiedEvidence = new Set(),
    evidenceCanonicalUseCount = null,
  } = {},
) {
  const findings = [];
  const recoveryEvidenceOptions = {
    now,
    evidenceByPath: recoveryEvidenceByPath,
    evidencePathUseCount: evidenceCanonicalUseCount
      ?? evidencePathUseCounts(policy, recoveryEvidenceByPath),
    evidenceSha256ByPath: recoveryEvidenceSha256ByPath,
    externallyVerifiedEvidence,
  };

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

  const rtoLimitMs = safeMillisecondsFromMinutes(policy.targets?.rtoMinutes);
  if (rtoLimitMs === null || !hasValue(policy.targets?.rtoBasis)) {
    findings.push({
      code: "RTO_TARGET_MISSING",
      message: "Recovery time objective must include an approved numeric minute target and basis.",
    });
  }

  const rpoMinutes = policy.targets?.rpoMinutes;
  const backupSchedule = policy.backupSchedule;
  if (
    backupSchedule?.status !== "configured"
    || !positiveNumber(backupSchedule.cadenceMinutes)
    || !hasValue(backupSchedule.owner)
    || !evidenceRecord(backupSchedule, "verifiedAt", {
      ...recoveryEvidenceOptions,
      controlId: "backup-schedule",
      type: "provider-backup-schedule",
      substantiveFields: {
        cadenceMinutes: backupSchedule?.cadenceMinutes,
        owner: backupSchedule?.owner,
      },
    })
  ) {
    findings.push({
      code: "BACKUP_SCHEDULE_UNVERIFIED",
      message: "A recently verified recurring backup schedule with bound evidence is required.",
    });
  }

  const latestBackup = policy.latestSuccessfulBackup;
  if (
    latestBackup?.status !== "passed"
    || !hasValue(latestBackup.artifactKey)
    || !positiveNumber(latestBackup.tableCount)
    || !positiveNumber(latestBackup.rowCount)
    || !evidenceRecord(latestBackup, "completedAt", {
      ...recoveryEvidenceOptions,
      controlId: "latest-successful-backup",
      type: "provider-backup-completion",
      substantiveFields: {
        artifactKey: latestBackup?.artifactKey,
        tableCount: latestBackup?.tableCount,
        rowCount: latestBackup?.rowCount,
      },
    })
    || !positiveNumber(rpoMinutes)
    || !withinDays(latestBackup.completedAt, rpoMinutes / (24 * 60), now)
  ) {
    findings.push({
      code: "RECENT_BACKUP_CHECKPOINT_MISSING",
      message: "The latest successful named backup must be current within the approved RPO and bound to evidence.",
    });
  }

  const missedBackupAlert = policy.missedBackupAlert;
  if (
    missedBackupAlert?.status !== "tested"
    || !positiveNumber(missedBackupAlert.retryAllowanceMinutes)
    || !hasValue(missedBackupAlert.destination)
    || !evidenceRecord(missedBackupAlert, "lastTestedAt", {
      ...recoveryEvidenceOptions,
      controlId: "missed-backup-alert",
      type: "provider-alert-delivery-test",
      substantiveFields: {
        retryAllowanceMinutes: missedBackupAlert?.retryAllowanceMinutes,
        destination: missedBackupAlert?.destination,
      },
    })
  ) {
    findings.push({
      code: "MISSED_BACKUP_ALERT_UNVERIFIED",
      message: "A recently tested missed-backup alert and retry allowance with bound evidence are required.",
    });
  }

  if (
    positiveNumber(rpoMinutes)
    && positiveNumber(backupSchedule?.cadenceMinutes)
    && positiveNumber(missedBackupAlert?.retryAllowanceMinutes)
    && backupSchedule.cadenceMinutes + missedBackupAlert.retryAllowanceMinutes > rpoMinutes
  ) {
    findings.push({
      code: "BACKUP_RPO_WINDOW_EXCEEDED",
      message: "Backup cadence plus the missed-run alert and retry allowance must fit inside the approved RPO.",
    });
  }

  if (!positiveNumber(policy.backupRetention?.days) || !hasValue(policy.backupRetention?.owner)) {
    findings.push({
      code: "BACKUP_RETENTION_MISSING",
      message: "Backup retention must include a numeric day window and owner.",
    });
  }

  if (
    policy.backupRetention?.enforcement?.status !== "verified"
    || !hasValue(policy.backupRetention?.enforcement?.mode)
    || !evidenceRecord(policy.backupRetention?.enforcement, "verifiedAt", {
      ...recoveryEvidenceOptions,
      controlId: "backup-retention-enforcement",
      type: "provider-retention-policy",
      substantiveFields: {
        retentionDays: policy.backupRetention?.days,
        owner: policy.backupRetention?.owner,
        mode: policy.backupRetention?.enforcement?.mode,
      },
    })
  ) {
    findings.push({
      code: "BACKUP_RETENTION_UNENFORCED",
      message: "Backup retention requires recently verified provider or automated enforcement with bound evidence.",
    });
  }

  const failureDomain = policy.failureDomain;
  if (
    failureDomain?.status !== "independent"
    || !hasValue(failureDomain.primaryProvider)
    || !hasValue(failureDomain.backupProvider)
    || failureDomain.primaryProvider.trim().toLowerCase() === failureDomain.backupProvider.trim().toLowerCase()
    || !evidenceRecord(failureDomain, "verifiedAt", {
      ...recoveryEvidenceOptions,
      controlId: "backup-failure-domain",
      type: "provider-failure-domain-verification",
      substantiveFields: {
        primaryProvider: failureDomain?.primaryProvider,
        backupProvider: failureDomain?.backupProvider,
      },
    })
  ) {
    findings.push({
      code: "BACKUP_FAILURE_DOMAIN_NOT_INDEPENDENT",
      message: "The backup copy must have recently verified evidence of a provider-independent failure domain.",
    });
  }

  if (!positiveNumber(policy.restoreDrillCadence?.days) || !hasValue(policy.restoreDrillCadence?.owner)) {
    findings.push({
      code: "RESTORE_CADENCE_MISSING",
      message: "Recurring restore-drill cadence must include a numeric day window and owner.",
    });
  }

  const restoreCadenceDays = policy.restoreDrillCadence?.days;
  const latestRestore = policy.latestNamedArtifactRestore;
  const measuredRecoveryDurationMs = safeDurationTotal(
    latestRestore?.restoreDurationMs,
    latestRestore?.verificationDurationMs,
  );
  const latestRestoreCompletedAt = dateValue(latestRestore?.completedAt);
  const nextRestoreDueAt = dateValue(policy.restoreDrillCadence?.nextDueAt);
  if (!nextRestoreDueAt) {
    findings.push({
      code: "NEXT_RESTORE_DRILL_MISSING",
      message: "Next restore-drill due date must be recorded.",
    });
  } else {
    if (nextRestoreDueAt.getTime() < now.getTime()) {
      findings.push({
        code: "RESTORE_DRILL_OVERDUE",
        message: "The next restore-drill due date has passed.",
      });
    }
    if (
      latestRestoreCompletedAt
      && positiveNumber(restoreCadenceDays)
      && (
        nextRestoreDueAt.getTime() <= latestRestoreCompletedAt.getTime()
        || nextRestoreDueAt.getTime()
          > latestRestoreCompletedAt.getTime() + restoreCadenceDays * 24 * 60 * 60 * 1000
      )
    ) {
      findings.push({
        code: "NEXT_RESTORE_DRILL_INCONSISTENT",
        message: "The next restore drill must fall after the latest restore and no later than its approved cadence deadline.",
      });
    }
  }

  const latestRestoreReady = (
    latestRestore?.status === "passed"
    && hasValue(latestRestore?.artifactKey)
    && positiveNumber(latestRestore?.tableCount)
    && positiveNumber(latestRestore?.rowCount)
    && measuredRecoveryDurationMs !== null
    && positiveNumber(restoreCadenceDays)
    && evidenceRecord(latestRestore, "completedAt", {
      ...recoveryEvidenceOptions,
      controlId: "named-artifact-restore",
      type: "provider-restore-verification",
      substantiveFields: {
        artifactKey: latestRestore?.artifactKey,
        tableCount: latestRestore?.tableCount,
        rowCount: latestRestore?.rowCount,
        restoreDurationMs: latestRestore?.restoreDurationMs,
        verificationDurationMs: latestRestore?.verificationDurationMs,
      },
    })
    && withinDays(latestRestore?.completedAt, restoreCadenceDays, now)
  );
  if (!latestRestoreReady) {
    findings.push({
      code: "RECENT_BACKUP_ARTIFACT_RESTORE_MISSING",
      message: "A current named backup-artifact restore with matched repository evidence and positive table/row counts is required.",
    });
  } else if (rtoLimitMs !== null && measuredRecoveryDurationMs > rtoLimitMs) {
    findings.push({
      code: "RECOVERY_RTO_EXCEEDED",
      message: "Measured restore plus verification time must not exceed the approved recovery time objective.",
    });
  }

  const boundEvidenceDates = [
    policy.backupSchedule?.verifiedAt,
    policy.latestSuccessfulBackup?.completedAt,
    policy.missedBackupAlert?.lastTestedAt,
    policy.backupRetention?.enforcement?.verifiedAt,
    policy.failureDomain?.verifiedAt,
    latestRestore?.completedAt,
  ].map(dateValue).filter(Boolean);

  for (const key of ["founder", "operations"]) {
    const approval = policy.approvals?.[key];
    if (!approved(approval)) {
      findings.push({
        code: `RECOVERY_APPROVAL_${key.toUpperCase()}_MISSING`,
        message: `${key} recovery-policy approval must be recorded before Gate A launch.`,
      });
    } else {
      const approvedAt = dateValue(approval.approvedAt);
      if (
        !approvedAt
        || !withinDays(approval.approvedAt, maxEvidenceAgeDays, now)
        || boundEvidenceDates.some((evidenceAt) => approvedAt.getTime() <= evidenceAt.getTime())
      ) {
        findings.push({
          code: `RECOVERY_APPROVAL_${key.toUpperCase()}_STALE`,
          message: `${key} recovery approval must be current, non-future, and recorded after every bound evidence timestamp.`,
        });
      }
      if (approval.configurationDigest !== recoveryPolicyConfigurationDigest(policy)) {
        findings.push({
          code: `RECOVERY_APPROVAL_${key.toUpperCase()}_EVIDENCE_MISMATCH`,
          message: `${key} recovery-policy approval must match the exact recovery configuration and evidence.`,
        });
      }
    }
  }

  return {
    ok: findings.length === 0,
    findings,
    summary: {
      status: policy.status,
      rpoMinutes: policy.targets?.rpoMinutes ?? null,
      rtoMinutes: policy.targets?.rtoMinutes ?? null,
      retentionDays: policy.backupRetention?.days ?? null,
      backupCadenceMinutes: backupSchedule?.cadenceMinutes ?? null,
      latestSuccessfulBackupAt: latestBackup?.completedAt ?? null,
      missedBackupAlertTested: missedBackupAlert?.status === "tested",
      retentionEnforced: policy.backupRetention?.enforcement?.status === "verified",
      independentFailureDomain: failureDomain?.status === "independent",
      restoreDrillCadenceDays: policy.restoreDrillCadence?.days ?? null,
      recentNamedArtifactRestore: latestRestoreReady,
    },
  };
}

function evaluatePaymentProviderPolicy(
  policy,
  {
    now = new Date(),
    paymentProviderEvidence = null,
    externallyVerifiedEvidence = new Set(),
    evidenceCanonicalUseCount = new Map(),
  } = {},
) {
  if (policy?.status !== "approved") {
    return {
      ok: false,
      findings: [{
        code: "PAYMENT_PROVIDER_NOT_APPROVED",
        message: "Bank-payment configuration requires a current named approval; enabled mode also requires verified Connected accounts signed delivery.",
      }],
      summary: { status: policy?.status ?? "missing", mode: policy?.mode ?? "unknown" },
    };
  }

  const findings = [];
  const verifiedState = policy.verifiedProductionState ?? {};
  const paymentEvidenceReady = evidenceRecord(policy, "verifiedAt", {
    now,
    evidenceByPath: { [policy.evidence]: paymentProviderEvidence },
    evidencePathUseCount: evidenceCanonicalUseCount,
    evidenceSha256ByPath: { [policy.evidence]: paymentProviderEvidence?.sha256 ?? null },
    externallyVerifiedEvidence,
    controlId: paymentProviderEvidenceControlId,
    type: paymentProviderEvidenceType,
    receiptStatus: paymentProviderEvidenceStatus,
    substantiveFields: {
      mode: policy.mode,
      featureFlagVerifiedOff: policy.featureFlagVerifiedOff,
      providerDestinationScope: policy.providerDestinationScope,
      runtimeScopeAttestation: policy.runtimeScopeAttestation,
      signedDeliveryVerified: policy.signedDeliveryVerified,
      enabled: verifiedState.enabled,
      configured: verifiedState.configured,
      webhookConfigured: verifiedState.webhookConfigured,
      providerMode: verifiedState.mode,
    },
  });
  if (!paymentEvidenceReady) {
    findings.push({
      code: "PAYMENT_PROVIDER_EVIDENCE_UNVERIFIED",
      message: "Bank-payment state requires a strict, externally verified provider receipt bound to the exact reviewed configuration.",
    });
  }

  if (policy.mode === "disabled") {
    if (
      policy.featureFlagVerifiedOff !== true
      || !withinDays(policy.verifiedAt, maxEvidenceAgeDays, now)
      || !hasValue(policy.evidence)
      || verifiedState.enabled !== false
      || verifiedState.configured !== false
      || verifiedState.webhookConfigured !== true
      || verifiedState.mode !== "setup_required"
      || !["unset", "connected_accounts"].includes(policy.runtimeScopeAttestation)
    ) {
      findings.push({
        code: "BANK_PAYMENTS_DISABLEMENT_UNVERIFIED",
        message: "Disabled bank payments require recent bound evidence of the exact fail-closed production state.",
      });
    }
  } else if (policy.mode === "enabled") {
    if (
      policy.featureFlagVerifiedOff !== false
      || policy.providerDestinationScope !== "connected_accounts"
      || policy.runtimeScopeAttestation !== "connected_accounts"
      || policy.signedDeliveryVerified !== true
      || !withinDays(policy.verifiedAt, maxEvidenceAgeDays, now)
      || !hasValue(policy.evidence)
      || verifiedState.enabled !== true
      || verifiedState.configured !== true
      || verifiedState.webhookConfigured !== true
      || verifiedState.mode !== "configured"
    ) {
      findings.push({
        code: "CONNECTED_ACCOUNT_WEBHOOK_UNVERIFIED",
        message: "Enabled bank payments require recent signed-delivery proof from a Connected accounts Stripe destination.",
      });
    }
  } else {
    findings.push({
      code: "PAYMENT_PROVIDER_MODE_INVALID",
      message: "Bank-payment launch mode must be exactly disabled or enabled.",
    });
  }

  const approval = policy.approval;
  if (!approved(approval)) {
    findings.push({
      code: "PAYMENT_PROVIDER_APPROVAL_MISSING",
      message: "The verified bank-payment launch mode requires named operations approval.",
    });
  } else {
    const approvedAt = dateValue(approval.approvedAt);
    const verifiedAt = dateValue(policy.verifiedAt);
    if (
      !approvedAt
      || !verifiedAt
      || approvedAt.getTime() <= verifiedAt.getTime()
      || !withinDays(approval.approvedAt, maxEvidenceAgeDays, now)
    ) {
      findings.push({
        code: "PAYMENT_PROVIDER_APPROVAL_STALE",
        message: "Bank-payment approval must be current, non-future, and recorded after the provider evidence was verified.",
      });
    }
    if (approval.configurationDigest !== paymentProviderConfigurationDigest(policy)) {
      findings.push({
        code: "PAYMENT_PROVIDER_APPROVAL_EVIDENCE_MISMATCH",
        message: "Bank-payment approval must match the exact reviewed provider mode and evidence.",
      });
    }
  }

  return {
    ok: findings.length === 0,
    findings,
    summary: {
      status: policy.status,
      mode: policy.mode,
      verifiedAt: policy.verifiedAt ?? null,
    },
  };
}

export function evaluateLaunchReadiness(
  { incidentConfig, recoveryPolicy, paymentProviderPolicy },
  {
    now = new Date(),
    paymentProviderEvidence = null,
    recoveryEvidenceByPath = {},
    recoveryEvidenceSha256ByPath = {},
    externallyVerifiedEvidence = new Set(),
    incidentEvidenceRoot = process.cwd(),
  } = {},
) {
  const evidenceCanonicalUseCount = allEvidencePathUseCounts({
    recoveryPolicy,
    recoveryEvidenceByPath,
    paymentProviderPolicy,
    paymentProviderEvidence,
  });
  const incident = evaluateIncidentReadiness(incidentConfig, {
    now,
    evidenceRoot: incidentEvidenceRoot,
    externallyVerifiedEvidence,
  });
  const recovery = evaluateRecoveryPolicy(recoveryPolicy, {
    now,
    recoveryEvidenceByPath,
    recoveryEvidenceSha256ByPath,
    externallyVerifiedEvidence,
    evidenceCanonicalUseCount,
  });
  const paymentProvider = evaluatePaymentProviderPolicy(paymentProviderPolicy, {
    now,
    paymentProviderEvidence,
    externallyVerifiedEvidence,
    evidenceCanonicalUseCount,
  });
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
    ...paymentProvider.findings.map((finding) => ({ ...finding, source: "payment_provider" })),
  ];

  return {
    ok: findings.length === 0,
    status: findings.length === 0 ? "ready" : "blocked",
    findings,
    summary: {
      incident: incident.summary,
      recovery: recovery.summary,
      paymentProvider: paymentProvider.summary,
      activeLaunchHold: Boolean(incidentConfig.launchHold?.active),
    },
  };
}

export function loadRecoveryPolicy(filePath = defaultRecoveryPath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function loadPaymentProviderPolicy(filePath = defaultPaymentProviderPath) {
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
  const paymentProviderPath = argValue(argv, "--payment-provider-file", defaultPaymentProviderPath);
  const recoveryPolicy = loadRecoveryPolicy(recoveryPath);
  const recoveryEvidenceByPath = readRecoveryPolicyEvidence(recoveryPolicy);
  const paymentProviderPolicy = loadPaymentProviderPolicy(paymentProviderPath);
  const paymentProviderEvidence = readPaymentProviderEvidence(paymentProviderPolicy);
  const result = evaluateLaunchReadiness({
    incidentConfig: loadIncidentRoutingConfig(incidentPath),
    recoveryPolicy,
    paymentProviderPolicy,
  }, {
    paymentProviderEvidence,
    recoveryEvidenceByPath,
    recoveryEvidenceSha256ByPath: Object.fromEntries(
      Object.entries(recoveryEvidenceByPath)
        .map(([evidencePath, evidence]) => [evidencePath, evidence?.sha256 ?? null]),
    ),
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
