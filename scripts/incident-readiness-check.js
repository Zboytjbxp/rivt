import "dotenv/config";
import fs from "node:fs";
import { pathToFileURL } from "node:url";

const defaultConfigPath = "docs/operations/incident-routing.json";

function hasValue(value) {
  return typeof value === "string" && value.trim() && value.trim().toUpperCase() !== "TBD";
}

function hasEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value ?? "");
}

function configuredDestination(config, category) {
  return (config.alertDestinations ?? []).find(
    (destination) => destination.category === category && destination.status === "configured",
  );
}

function recentPassedRehearsal(config, now = new Date()) {
  const rehearsals = config.rehearsals ?? [];
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  return rehearsals.find((rehearsal) => {
    if (rehearsal.status !== "passed" || !rehearsal.completedAt) return false;
    const completedAt = new Date(rehearsal.completedAt);
    return Number.isFinite(completedAt.getTime()) && now.getTime() - completedAt.getTime() <= thirtyDaysMs;
  });
}

function approved(config, key) {
  const approval = config.approvals?.[key];
  return approval?.status === "approved" && hasValue(approval.approvedBy) && Boolean(approval.approvedAt);
}

export function evaluateIncidentReadiness(config, { now = new Date() } = {}) {
  const findings = [];

  if (config.status !== "approved") {
    findings.push({
      code: "INCIDENT_ROUTING_NOT_APPROVED",
      message: "Incident routing status must be approved before Gate A launch.",
    });
  }

  if (!hasValue(config.primaryOwner?.name) || !hasEmail(config.primaryOwner?.email)) {
    findings.push({
      code: "PRIMARY_OWNER_MISSING",
      message: "Primary incident owner must have a real name and email.",
    });
  }

  if (!hasValue(config.backupOwner?.name) || !hasEmail(config.backupOwner?.email)) {
    findings.push({
      code: "BACKUP_OWNER_MISSING",
      message: "Backup incident owner must have a real name and email.",
    });
  }

  if (!hasValue(config.supportHours?.coverage)) {
    findings.push({
      code: "SUPPORT_HOURS_MISSING",
      message: "Founder-approved support hours are required before named-cohort launch.",
    });
  }

  if (!configuredDestination(config, "synthetic_monitor")) {
    findings.push({
      code: "SYNTHETIC_MONITOR_MISSING",
      message: "At least one external synthetic monitor destination must be configured.",
    });
  }

  if (!configuredDestination(config, "error_monitoring")) {
    findings.push({
      code: "ERROR_MONITORING_MISSING",
      message: "Dedicated error monitoring must be configured before Gate A launch.",
    });
  }

  if (!configuredDestination(config, "paging")) {
    findings.push({
      code: "PAGING_ROUTE_MISSING",
      message: "A paging/escalation destination must be configured before Gate A launch.",
    });
  }

  if (!recentPassedRehearsal(config, now)) {
    findings.push({
      code: "INCIDENT_REHEARSAL_MISSING",
      message: "A passed incident rehearsal from the last 30 days is required.",
    });
  }

  for (const key of ["founder", "support", "legalSafety"]) {
    if (!approved(config, key)) {
      findings.push({
        code: `APPROVAL_${key.toUpperCase()}_MISSING`,
        message: `${key} approval must be recorded before Gate A launch.`,
      });
    }
  }

  return {
    ok: findings.length === 0,
    status: findings.length === 0 ? "ready" : "blocked",
    findings,
    summary: {
      primaryOwner: config.primaryOwner?.name ?? null,
      primaryEmail: config.primaryOwner?.email ?? null,
      backupOwner: hasValue(config.backupOwner?.name) ? config.backupOwner.name : null,
      syntheticMonitor: Boolean(configuredDestination(config, "synthetic_monitor")),
      errorMonitoring: Boolean(configuredDestination(config, "error_monitoring")),
      paging: Boolean(configuredDestination(config, "paging")),
      recentRehearsal: Boolean(recentPassedRehearsal(config, now)),
    },
  };
}

export function loadIncidentRoutingConfig(filePath = defaultConfigPath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export async function main(argv = process.argv.slice(2)) {
  const requireReady = argv.includes("--require-ready");
  const jsonOnly = argv.includes("--json");
  const fileArgIndex = argv.indexOf("--file");
  const filePath = fileArgIndex >= 0 ? argv[fileArgIndex + 1] : defaultConfigPath;
  const result = evaluateIncidentReadiness(loadIncidentRoutingConfig(filePath));
  const output = JSON.stringify(result, null, 2);
  if (jsonOnly || !result.ok) {
    console.log(output);
  } else {
    console.log("Incident readiness passed.");
  }
  if (requireReady && !result.ok) {
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
