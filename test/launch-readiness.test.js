import assert from "node:assert/strict";
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

test("launch readiness passes only when incident and recovery policy evidence are approved", () => {
  const result = evaluateLaunchReadiness({
    incidentConfig: readyIncidentConfig,
    recoveryPolicy: readyRecoveryPolicy,
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
  }, { now: new Date("2026-06-21T12:00:00.000Z") });

  assert.equal(result.ok, false);
  assert.deepEqual(result.findings.map((finding) => finding.code), ["RECENT_BACKUP_ARTIFACT_RESTORE_MISSING"]);
});
