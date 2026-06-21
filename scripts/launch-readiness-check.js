import "dotenv/config";
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { evaluateIncidentReadiness, loadIncidentRoutingConfig } from "./incident-readiness-check.js";

const defaultIncidentPath = "docs/operations/incident-routing.json";
const defaultRecoveryPath = "docs/operations/recovery-policy.json";
const maxEvidenceAgeDays = 30;

function hasValue(value) {
  return typeof value === "string" && value.trim() && value.trim().toUpperCase() !== "TBD";
}

function approved(record) {
  return record?.status === "approved" && hasValue(record.approvedBy) && Boolean(record.approvedAt);
}

function positiveNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function withinDays(value, days, now = new Date()) {
  if (!value) return false;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return false;
  const ageMs = now.getTime() - date.getTime();
  return ageMs >= 0 && ageMs <= days * 24 * 60 * 60 * 1000;
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

  if (!policy.restoreDrillCadence?.nextDueAt) {
    findings.push({
      code: "NEXT_RESTORE_DRILL_MISSING",
      message: "Next restore-drill due date must be recorded.",
    });
  }

  const latestRestore = policy.latestNamedArtifactRestore;
  if (
    latestRestore?.status !== "passed" ||
    !hasValue(latestRestore.artifactKey) ||
    !positiveNumber(latestRestore.restoreDurationMs) ||
    !positiveNumber(latestRestore.verificationDurationMs) ||
    !withinDays(latestRestore.completedAt, maxEvidenceAgeDays, now)
  ) {
    findings.push({
      code: "RECENT_BACKUP_ARTIFACT_RESTORE_MISSING",
      message: "A passed named backup-artifact restore from the last 30 days is required.",
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

  return {
    ok: findings.length === 0,
    findings,
    summary: {
      status: policy.status,
      rpoMinutes: policy.targets?.rpoMinutes ?? null,
      rtoMinutes: policy.targets?.rtoMinutes ?? null,
      retentionDays: policy.backupRetention?.days ?? null,
      restoreDrillCadenceDays: policy.restoreDrillCadence?.days ?? null,
      recentNamedArtifactRestore: Boolean(
        latestRestore?.status === "passed" &&
          withinDays(latestRestore.completedAt, maxEvidenceAgeDays, now),
      ),
    },
  };
}

export function evaluateLaunchReadiness({ incidentConfig, recoveryPolicy }, { now = new Date() } = {}) {
  const incident = evaluateIncidentReadiness(incidentConfig, { now });
  const recovery = evaluateRecoveryPolicy(recoveryPolicy, { now });
  const findings = [
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
