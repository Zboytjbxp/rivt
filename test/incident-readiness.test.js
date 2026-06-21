import assert from "node:assert/strict";
import test from "node:test";
import { evaluateIncidentReadiness } from "../scripts/incident-readiness-check.js";

const baseConfig = {
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

test("incident readiness passes only when owners, alerts, rehearsal, and approvals exist", () => {
  const result = evaluateIncidentReadiness(baseConfig, { now: new Date("2026-06-21T12:00:00.000Z") });
  assert.equal(result.ok, true);
  assert.equal(result.findings.length, 0);
});

test("incident readiness reports launch blockers without pretending success", () => {
  const result = evaluateIncidentReadiness({
    ...baseConfig,
    status: "blocked",
    backupOwner: { name: "TBD", email: "TBD" },
    supportHours: { coverage: "TBD" },
    alertDestinations: [{ id: "synthetic", category: "synthetic_monitor", status: "configured" }],
    rehearsals: [],
    approvals: {},
  }, { now: new Date("2026-06-21T12:00:00.000Z") });

  assert.equal(result.ok, false);
  assert.deepEqual(result.findings.map((finding) => finding.code), [
    "INCIDENT_ROUTING_NOT_APPROVED",
    "BACKUP_OWNER_MISSING",
    "SUPPORT_HOURS_MISSING",
    "ERROR_MONITORING_MISSING",
    "PAGING_ROUTE_MISSING",
    "INCIDENT_REHEARSAL_MISSING",
    "APPROVAL_FOUNDER_MISSING",
    "APPROVAL_SUPPORT_MISSING",
    "APPROVAL_LEGALSAFETY_MISSING",
  ]);
});
