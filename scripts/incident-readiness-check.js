import "dotenv/config";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import {
  canonicalRepositoryEvidence,
  isExternallyVerifiedEvidence,
  repositoryEvidenceSha256,
  resolveRegularRepositoryFile,
} from "./repository-evidence.js";

const defaultConfigPath = "docs/operations/incident-routing.json";
const privateRouteEvidenceType = "private-route-delivery-test";
const privateRouteEvidenceStatus = "delivered";
const evidenceFreshnessMs = 30 * 24 * 60 * 60 * 1000;
const alertEvidenceContracts = {
  synthetic_monitor: {
    type: "synthetic-monitor-delivery-test",
    status: "passed",
  },
  error_monitoring: {
    type: "error-monitoring-ingestion-test",
    status: "ingested",
  },
  paging: {
    type: "paging-delivery-test",
    status: "delivered",
  },
};
const rehearsalEvidenceType = "incident-rehearsal-test";

function hasValue(value) {
  return typeof value === "string" && value.trim() && value.trim().toUpperCase() !== "TBD";
}

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map((entry) => canonicalValue(entry));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .filter((key) => value[key] !== undefined)
        .map((key) => [key, canonicalValue(value[key])]),
    );
  }
  return value;
}

export function incidentRoutingConfigurationDigest(config = {}) {
  const reviewedConfiguration = {
    ...config,
    approvals: Object.fromEntries(
      Object.entries(config.approvals ?? {}).map(([key, approval]) => {
        const reviewedApproval = { ...(approval ?? {}) };
        delete reviewedApproval.configurationDigest;
        return [key, reviewedApproval];
      }),
    ),
  };
  return createHash("sha256")
    .update(JSON.stringify(canonicalValue(reviewedConfiguration)))
    .digest("hex");
}

function configuredContactRoute(config, routeId) {
  if (!hasValue(routeId)) return null;
  return (config.contactRoutes ?? []).find(
    (route) => route.id === routeId && route.status === "configured",
  ) ?? null;
}

function validPastTimestamp(value, now) {
  const timestamp = new Date(value ?? "");
  return Number.isFinite(timestamp.getTime()) && timestamp.getTime() <= now.getTime();
}

function parseEvidenceReceipt(value) {
  try {
    const receipt = JSON.parse(Buffer.isBuffer(value) ? value.toString("utf8") : String(value));
    return receipt && typeof receipt === "object" && !Array.isArray(receipt) ? receipt : null;
  } catch {
    return null;
  }
}

function strictReceiptMatch(receipt, expected) {
  if (!receipt || typeof receipt !== "object" || Array.isArray(receipt)) return false;
  const actualKeys = Object.keys(receipt).sort();
  const expectedKeys = Object.keys(expected).sort();
  return actualKeys.length === expectedKeys.length
    && actualKeys.every((key, index) => key === expectedKeys[index])
    && expectedKeys.every((key) => Object.is(receipt[key], expected[key]));
}

function unaliasedRelativeEvidencePath(value) {
  if (!hasValue(value)) return false;
  const segments = value.split(/[\\/]/);
  return segments.every((segment) => segment && segment !== "." && segment !== "..");
}

function createIncidentEvidenceVerifier({
  evidenceRoot,
  readEvidence,
  externallyVerifiedEvidence,
}) {
  const cachedResults = new Map();
  const canonicalPathOwners = new Map();
  const digestOwners = new Map();
  const verifiedTimestamps = [];

  function canonicalIdentity(filePath) {
    return process.platform === "win32" ? filePath.toLowerCase() : filePath;
  }

  return {
    verify(record, expectedReceipt) {
      const verificationKey = `${expectedReceipt.type}\u0000${expectedReceipt.controlId}`;
      if (cachedResults.has(verificationKey)) return cachedResults.get(verificationKey);

      let result = false;
      if (
        /^[a-f0-9]{64}$/.test(record?.evidenceSha256 ?? "")
        && unaliasedRelativeEvidencePath(record?.evidencePath)
        && /^[A-Za-z0-9][A-Za-z0-9._/-]{1,127}$/.test(record?.evidenceProvider ?? "")
      ) {
        const resolvedEvidence = resolveRegularRepositoryFile(record.evidencePath, {
          rootDir: evidenceRoot,
        });
        if (resolvedEvidence) {
          try {
            const evidence = canonicalRepositoryEvidence(
              readEvidence(resolvedEvidence.canonicalPath),
            );
            const digest = repositoryEvidenceSha256(evidence);
            const canonicalPath = canonicalIdentity(resolvedEvidence.canonicalPath);
            const pathOwner = canonicalPathOwners.get(canonicalPath);
            const digestOwner = digestOwners.get(digest);
            const receipt = parseEvidenceReceipt(evidence);
            result = digest === record.evidenceSha256
              && (!pathOwner || pathOwner === verificationKey)
              && (!digestOwner || digestOwner === verificationKey)
              && strictReceiptMatch(receipt, expectedReceipt)
              && isExternallyVerifiedEvidence(externallyVerifiedEvidence, {
                controlId: expectedReceipt.controlId,
                provider: record.evidenceProvider,
                sha256: digest,
              });
            if (result) {
              canonicalPathOwners.set(canonicalPath, verificationKey);
              digestOwners.set(digest, verificationKey);
              verifiedTimestamps.push(new Date(expectedReceipt.timestamp).getTime());
            }
          } catch {
            result = false;
          }
        }
      }
      cachedResults.set(verificationKey, result);
      return result;
    },
    latestVerifiedAt() {
      const validTimestamps = verifiedTimestamps.filter(Number.isFinite);
      return validTimestamps.length > 0 ? Math.max(...validTimestamps) : null;
    },
  };
}

function verifiedPrivateRoute(route, {
  now,
  evidenceVerifier,
}) {
  if (route?.kind !== "private-incident-roster") return true;
  if (!/^(?:github-actions-secret|provider-route|private-ops-record):[A-Za-z0-9][A-Za-z0-9._/-]{2,127}$/.test(route.routeRef ?? "")) {
    return false;
  }
  if (!validPastTimestamp(route.lastVerifiedAt, now)) return false;
  if (now.getTime() - new Date(route.lastVerifiedAt).getTime() > evidenceFreshnessMs) return false;
  return evidenceVerifier.verify(route, {
    schemaVersion: 1,
    controlId: route.id,
    type: privateRouteEvidenceType,
    provider: route.evidenceProvider,
    status: privateRouteEvidenceStatus,
    timestamp: route.lastVerifiedAt,
    routeRef: route.routeRef,
  });
}

function configuredOwner(config, ownerKey, options) {
  const owner = config[ownerKey];
  const route = configuredContactRoute(config, owner?.contactRouteId);
  if (ownerKey === "backupOwner" && route?.kind !== "private-incident-roster") return false;
  return hasValue(owner?.roleId) && Boolean(route) && verifiedPrivateRoute(route, options);
}

function verifiedAlertDestination(destination, category, { now, evidenceVerifier }) {
  const contract = alertEvidenceContracts[category];
  if (
    !contract
    || destination?.category !== category
    || destination?.status !== "configured"
    || !hasValue(destination.id)
    || !hasValue(destination.route)
    || !validPastTimestamp(destination.lastVerifiedAt, now)
    || now.getTime() - new Date(destination.lastVerifiedAt).getTime() > evidenceFreshnessMs
  ) return false;

  return evidenceVerifier.verify(destination, {
    schemaVersion: 1,
    controlId: destination.id,
    type: contract.type,
    provider: destination.evidenceProvider,
    status: contract.status,
    timestamp: destination.lastVerifiedAt,
    category,
    configuredProvider: destination.provider ?? null,
    route: destination.route,
    frequency: destination.frequency ?? null,
  });
}

function configuredDestination(config, category, options) {
  return (config.alertDestinations ?? []).find(
    (destination) => verifiedAlertDestination(destination, category, options),
  ) ?? null;
}

function recentPassedRehearsal(config, options) {
  const { now, evidenceVerifier } = options;
  const rehearsals = config.rehearsals ?? [];
  return rehearsals
    .filter((rehearsal) => {
      if (
        rehearsal.status !== "passed"
        || !hasValue(rehearsal.id)
        || !hasValue(rehearsal.scenario)
        || !hasValue(rehearsal.commanderRoleId)
        || !validPastTimestamp(rehearsal.completedAt, now)
      ) return false;
      const completedAt = new Date(rehearsal.completedAt);
      const age = now.getTime() - completedAt.getTime();
      return age >= 0 && age <= evidenceFreshnessMs && evidenceVerifier.verify(rehearsal, {
        schemaVersion: 1,
        controlId: rehearsal.id,
        type: rehearsalEvidenceType,
        provider: rehearsal.evidenceProvider,
        status: "passed",
        timestamp: rehearsal.completedAt,
        scenario: rehearsal.scenario,
        commanderRoleId: rehearsal.commanderRoleId,
      });
    })
    .sort((left, right) => (
      new Date(right.completedAt).getTime() - new Date(left.completedAt).getTime()
    ))[0];
}

function approvalFinding(config, key, { now, evidenceCutoff }) {
  const approval = config.approvals?.[key];
  const codeKey = key.toUpperCase();
  if (
    approval?.status !== "approved"
    || !hasValue(approval.approverRoleId)
    || !hasValue(approval.approvedAt)
  ) {
    return {
      code: `APPROVAL_${codeKey}_MISSING`,
      message: `${key} approval must be recorded before Gate A launch.`,
    };
  }

  const approvedAt = new Date(approval.approvedAt);
  if (!Number.isFinite(approvedAt.getTime()) || approvedAt.getTime() > now.getTime()) {
    return {
      code: `APPROVAL_${codeKey}_INVALID`,
      message: `${key} approval must have a parseable timestamp that is not in the future.`,
    };
  }

  if (evidenceCutoff !== null && approvedAt.getTime() <= evidenceCutoff) {
    return {
      code: `APPROVAL_${codeKey}_STALE`,
      message: `${key} approval must be recorded after the latest incident rehearsal and verified private backup-route test.`,
    };
  }

  if (approval.configurationDigest !== incidentRoutingConfigurationDigest(config)) {
    return {
      code: `APPROVAL_${codeKey}_CONFIGURATION_MISMATCH`,
      message: `${key} approval must match the exact incident-routing configuration and evidence.`,
    };
  }

  return null;
}

export function evaluateIncidentReadiness(config, {
  now = new Date(),
  evidenceRoot = process.cwd(),
  readEvidence = fs.readFileSync,
  externallyVerifiedEvidence = new Set(),
} = {}) {
  const findings = [];
  const ownerOptions = {
    now,
    evidenceVerifier: createIncidentEvidenceVerifier({
      evidenceRoot,
      readEvidence,
      externallyVerifiedEvidence,
    }),
  };
  const primaryOwnerConfigured = configuredOwner(config, "primaryOwner", ownerOptions);
  const backupOwnerConfigured = configuredOwner(config, "backupOwner", ownerOptions);

  if (config.status !== "approved") {
    findings.push({
      code: "INCIDENT_ROUTING_NOT_APPROVED",
      message: "Incident routing status must be approved before Gate A launch.",
    });
  }

  if (!primaryOwnerConfigured) {
    findings.push({
      code: "PRIMARY_OWNER_MISSING",
      message: "Primary incident owner must reference a configured private or organizational contact route.",
    });
  }

  if (!backupOwnerConfigured) {
    findings.push({
      code: "BACKUP_ROUTE_UNVERIFIED",
      message: "Backup incident owner must reference an access-controlled route with a successful test from the last 30 days and matching evidence.",
    });
  }

  if (!hasValue(config.supportHours?.coverage)) {
    findings.push({
      code: "SUPPORT_HOURS_MISSING",
      message: "Founder-approved support hours are required before named-cohort launch.",
    });
  }

  const syntheticMonitor = configuredDestination(config, "synthetic_monitor", ownerOptions);
  if (!syntheticMonitor) {
    findings.push({
      code: "SYNTHETIC_MONITOR_MISSING",
      message: "At least one external synthetic monitor destination must be configured.",
    });
  }

  const errorMonitoring = configuredDestination(config, "error_monitoring", ownerOptions);
  if (!errorMonitoring) {
    findings.push({
      code: "ERROR_MONITORING_MISSING",
      message: "Dedicated error monitoring must be configured before Gate A launch.",
    });
  }

  const paging = configuredDestination(config, "paging", ownerOptions);
  if (!paging) {
    findings.push({
      code: "PAGING_ROUTE_MISSING",
      message: "A paging/escalation destination must be configured before Gate A launch.",
    });
  }

  const recentRehearsal = recentPassedRehearsal(config, ownerOptions);
  if (!recentRehearsal) {
    findings.push({
      code: "INCIDENT_REHEARSAL_MISSING",
      message: "A passed incident rehearsal from the last 30 days is required.",
    });
  }

  const approvalEvidenceCutoff = ownerOptions.evidenceVerifier.latestVerifiedAt();
  for (const key of ["founder", "support", "legalSafety"]) {
    const finding = approvalFinding(config, key, {
      now,
      evidenceCutoff: approvalEvidenceCutoff,
    });
    if (finding) findings.push(finding);
  }

  return {
    ok: findings.length === 0,
    status: findings.length === 0 ? "ready" : "blocked",
    findings,
    summary: {
      primaryOwnerRole: primaryOwnerConfigured ? config.primaryOwner.roleId : null,
      primaryContactRoute: primaryOwnerConfigured ? config.primaryOwner.contactRouteId : null,
      backupOwnerRole: backupOwnerConfigured ? config.backupOwner.roleId : null,
      backupContactRoute: backupOwnerConfigured ? config.backupOwner.contactRouteId : null,
      syntheticMonitor: Boolean(syntheticMonitor),
      errorMonitoring: Boolean(errorMonitoring),
      paging: Boolean(paging),
      recentRehearsal: Boolean(recentRehearsal),
      requiredApprovalConfigurationDigest: incidentRoutingConfigurationDigest(config),
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
