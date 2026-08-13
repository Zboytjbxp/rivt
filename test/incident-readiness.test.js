import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { after } from "node:test";
import {
  evaluateIncidentReadiness,
  incidentRoutingConfigurationDigest,
} from "../scripts/incident-readiness-check.js";
import {
  providerEvidenceIdentity,
  repositoryEvidenceSha256,
} from "../scripts/repository-evidence.js";

const privateRouteEvidenceRecord = {
  schemaVersion: 1,
  controlId: "private-backup-route",
  type: "private-route-delivery-test",
  provider: "github-actions",
  status: "delivered",
  timestamp: "2026-06-20T13:00:00.000Z",
  routeRef: "github-actions-secret:RIVT_BACKUP_ROUTE",
};
const privateRouteEvidence = Buffer.from(JSON.stringify(privateRouteEvidenceRecord));
const privateRouteEvidenceSha256 = createHash("sha256").update(privateRouteEvidence).digest("hex");
const evidenceRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rivt-incident-evidence-"));
const privateRouteEvidencePath = path.join("docs", "operations", "evidence", "private-backup-route-test.json");
const absolutePrivateRouteEvidencePath = path.join(evidenceRoot, privateRouteEvidencePath);
const incidentControlEvidence = {
  synthetic: {
    path: path.join("docs", "operations", "evidence", "synthetic-monitor-test.json"),
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
    path: path.join("docs", "operations", "evidence", "error-monitoring-test.json"),
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
    path: path.join("docs", "operations", "evidence", "paging-delivery-test.json"),
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
    path: path.join("docs", "operations", "evidence", "incident-rehearsal-test.json"),
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
  fixture.evidence = Buffer.from(JSON.stringify(fixture.receipt));
  fixture.sha256 = createHash("sha256").update(fixture.evidence).digest("hex");
}
fs.mkdirSync(path.dirname(absolutePrivateRouteEvidencePath), { recursive: true });
after(() => fs.rmSync(evidenceRoot, { recursive: true, force: true }));
const evaluationOptions = (
  now = "2026-06-21T12:00:00.000Z",
  evidence = privateRouteEvidence,
  {
    trustEvidence = true,
    rootDir = evidenceRoot,
    additionalEvidence = [],
    readEvidence = fs.readFileSync,
  } = {},
) => ({
  now: new Date(now),
  evidenceRoot: rootDir,
  readEvidence,
  externallyVerifiedEvidence: trustEvidence
    ? new Set([providerEvidenceIdentity({
        controlId: JSON.parse(evidence.toString("utf8")).controlId,
        provider: JSON.parse(evidence.toString("utf8")).provider,
        sha256: repositoryEvidenceSha256(evidence),
      }), ...Object.values(incidentControlEvidence).map((fixture) => providerEvidenceIdentity({
        controlId: fixture.receipt.controlId,
        provider: fixture.receipt.provider,
        sha256: fixture.sha256,
      })), ...additionalEvidence.map((entry) => providerEvidenceIdentity({
        controlId: entry.receipt.controlId,
        provider: entry.receipt.provider,
        sha256: entry.sha256,
      }))].filter(Boolean))
    : new Set(),
});

const baseIncidentConfiguration = {
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
    contactRouteId: "private-backup-route",
  },
  contactRoutes: [
    { id: "primary-support-route", status: "configured", kind: "organization-support-inbox" },
    {
      id: "private-backup-route",
      status: "configured",
      kind: "private-incident-roster",
      routeRef: "github-actions-secret:RIVT_BACKUP_ROUTE",
      evidenceProvider: "github-actions",
      lastVerifiedAt: "2026-06-20T13:00:00.000Z",
      evidencePath: privateRouteEvidencePath,
      evidenceSha256: privateRouteEvidenceSha256,
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

const baseConfig = withIncidentApprovalDigests(baseIncidentConfiguration);

function writeIncidentEvidence(evidence = privateRouteEvidence, rootDir = evidenceRoot, relativePath = privateRouteEvidencePath) {
  const absolutePath = path.join(rootDir, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, evidence);
}

writeIncidentEvidence();
for (const fixture of Object.values(incidentControlEvidence)) {
  writeIncidentEvidence(fixture.evidence, evidenceRoot, fixture.path);
}

test("incident readiness passes only when owners, alerts, rehearsal, and approvals exist", () => {
  const result = evaluateIncidentReadiness(baseConfig, evaluationOptions());
  assert.equal(result.ok, true);
  assert.equal(result.findings.length, 0);
});

test("incident readiness hashes typed receipts consistently across LF and CRLF checkouts", () => {
  const crlfEvidence = Buffer.from(
    `${JSON.stringify(privateRouteEvidenceRecord, null, 2).replace(/\n/g, "\r\n")}\r\n`,
  );
  const canonicalSha256 = repositoryEvidenceSha256(crlfEvidence);
  const configuration = withIncidentApprovalDigests({
    ...baseConfig,
    contactRoutes: baseConfig.contactRoutes.map((route) => (
      route.id === privateRouteEvidenceRecord.controlId
        ? { ...route, evidenceSha256: canonicalSha256 }
        : route
    )),
  });
  writeIncidentEvidence(crlfEvidence);
  try {
    const result = evaluateIncidentReadiness(
      configuration,
      evaluationOptions("2026-06-21T12:00:00.000Z", crlfEvidence),
    );
    assert.equal(result.ok, true);
  } finally {
    writeIncidentEvidence();
  }
});

test("incident readiness rejects self-authored monitor and rehearsal claims without provider evidence", () => {
  const result = evaluateIncidentReadiness(withIncidentApprovalDigests({
    ...baseConfig,
    alertDestinations: baseConfig.alertDestinations.map((destination) => ({
      id: destination.id,
      category: destination.category,
      status: destination.status,
      provider: destination.provider,
      route: destination.route,
      frequency: destination.frequency,
    })),
    rehearsals: baseConfig.rehearsals.map((rehearsal) => ({
      id: rehearsal.id,
      status: rehearsal.status,
      completedAt: rehearsal.completedAt,
      scenario: rehearsal.scenario,
      commanderRoleId: rehearsal.commanderRoleId,
    })),
  }), evaluationOptions());

  assert.equal(result.ok, false);
  assert.deepEqual(
    result.findings.map((finding) => finding.code),
    [
      "SYNTHETIC_MONITOR_MISSING",
      "ERROR_MONITORING_MISSING",
      "PAGING_ROUTE_MISSING",
      "INCIDENT_REHEARSAL_MISSING",
    ],
  );
});

test("incident controls require strict typed externally verified receipts", () => {
  const cases = [
    ["synthetic", "SYNTHETIC_MONITOR_MISSING"],
    ["errors", "ERROR_MONITORING_MISSING"],
    ["paging", "PAGING_ROUTE_MISSING"],
    ["rehearsal", "INCIDENT_REHEARSAL_MISSING"],
  ];

  for (const [fixtureKey, expectedCode] of cases) {
    const fixture = incidentControlEvidence[fixtureKey];
    const invalidReceipt = { ...fixture.receipt, selfAssertedVerified: true };
    const invalidEvidence = Buffer.from(JSON.stringify(invalidReceipt));
    const invalidSha256 = createHash("sha256").update(invalidEvidence).digest("hex");
    writeIncidentEvidence(invalidEvidence, evidenceRoot, fixture.path);
    try {
      const mutated = fixtureKey === "rehearsal"
        ? {
            ...baseConfig,
            rehearsals: baseConfig.rehearsals.map((rehearsal) => ({
              ...rehearsal,
              evidenceSha256: invalidSha256,
            })),
          }
        : {
            ...baseConfig,
            alertDestinations: baseConfig.alertDestinations.map((destination) => (
              destination.id === fixture.receipt.controlId
                ? { ...destination, evidenceSha256: invalidSha256 }
                : destination
            )),
          };
      const result = evaluateIncidentReadiness(
        withIncidentApprovalDigests(mutated),
        evaluationOptions("2026-06-21T12:00:00.000Z", privateRouteEvidence, {
          additionalEvidence: [{ receipt: invalidReceipt, sha256: invalidSha256 }],
        }),
      );

      assert.equal(
        result.findings.some((finding) => finding.code === expectedCode),
        true,
        fixtureKey,
      );
    } finally {
      writeIncidentEvidence(fixture.evidence, evidenceRoot, fixture.path);
    }
  }
});

test("incident readiness fails closed when provider verification is unavailable", () => {
  const result = evaluateIncidentReadiness(baseConfig, {
    now: new Date("2026-06-21T12:00:00.000Z"),
    evidenceRoot,
  });

  for (const code of [
    "BACKUP_ROUTE_UNVERIFIED",
    "SYNTHETIC_MONITOR_MISSING",
    "ERROR_MONITORING_MISSING",
    "PAGING_ROUTE_MISSING",
    "INCIDENT_REHEARSAL_MISSING",
  ]) {
    assert.equal(result.findings.some((finding) => finding.code === code), true, code);
  }
});

test("incident readiness rejects aliased incident evidence paths", () => {
  const result = evaluateIncidentReadiness(withIncidentApprovalDigests({
    ...baseConfig,
    alertDestinations: baseConfig.alertDestinations.map((destination) => (
      destination.id === "synthetic"
        ? {
            ...destination,
            evidencePath: "docs/operations/evidence/../evidence/synthetic-monitor-test.json",
          }
        : destination
    )),
  }), evaluationOptions());

  assert.equal(
    result.findings.some((finding) => finding.code === "SYNTHETIC_MONITOR_MISSING"),
    true,
  );
});

test("incident readiness rejects one canonical evidence file reused across controls", () => {
  const sharedAbsolutePath = path.resolve(evidenceRoot, incidentControlEvidence.synthetic.path);
  let sharedReads = 0;
  const readEvidence = (filePath) => {
    if (path.resolve(filePath) === sharedAbsolutePath) {
      sharedReads += 1;
      return sharedReads === 1
        ? incidentControlEvidence.synthetic.evidence
        : incidentControlEvidence.errors.evidence;
    }
    return fs.readFileSync(filePath);
  };
  const result = evaluateIncidentReadiness(withIncidentApprovalDigests({
    ...baseConfig,
    alertDestinations: baseConfig.alertDestinations.map((destination) => (
      destination.id === "errors"
        ? { ...destination, evidencePath: incidentControlEvidence.synthetic.path }
        : destination
    )),
  }), evaluationOptions("2026-06-21T12:00:00.000Z", privateRouteEvidence, { readEvidence }));

  assert.equal(
    result.findings.some((finding) => finding.code === "ERROR_MONITORING_MISSING"),
    true,
  );
});

test("verified newer incident evidence makes earlier approvals stale", () => {
  const fixture = incidentControlEvidence.paging;
  const newerReceipt = {
    ...fixture.receipt,
    timestamp: "2026-06-20T14:30:00.000Z",
  };
  const newerEvidence = Buffer.from(JSON.stringify(newerReceipt));
  const newerSha256 = createHash("sha256").update(newerEvidence).digest("hex");
  writeIncidentEvidence(newerEvidence, evidenceRoot, fixture.path);
  try {
    const result = evaluateIncidentReadiness(withIncidentApprovalDigests({
      ...baseConfig,
      alertDestinations: baseConfig.alertDestinations.map((destination) => (
        destination.id === "paging"
          ? {
              ...destination,
              lastVerifiedAt: newerReceipt.timestamp,
              evidenceSha256: newerSha256,
            }
          : destination
      )),
    }), evaluationOptions("2026-06-21T12:00:00.000Z", privateRouteEvidence, {
      additionalEvidence: [{ receipt: newerReceipt, sha256: newerSha256 }],
    }));

    assert.deepEqual(
      result.findings
        .map((finding) => finding.code)
        .filter((code) => code.startsWith("APPROVAL_")),
      [
        "APPROVAL_FOUNDER_STALE",
        "APPROVAL_SUPPORT_STALE",
        "APPROVAL_LEGALSAFETY_STALE",
      ],
    );
  } finally {
    writeIncidentEvidence(fixture.evidence, evidenceRoot, fixture.path);
  }
});

test("incident readiness reports launch blockers without pretending success", () => {
  const result = evaluateIncidentReadiness({
    ...baseConfig,
    status: "blocked",
    backupOwner: { roleId: "TBD", contactRouteId: "TBD" },
    supportHours: { coverage: "TBD" },
    alertDestinations: [{ id: "synthetic", category: "synthetic_monitor", status: "configured" }],
    rehearsals: [],
    approvals: {},
  }, evaluationOptions());

  assert.equal(result.ok, false);
  assert.deepEqual(result.findings.map((finding) => finding.code), [
    "INCIDENT_ROUTING_NOT_APPROVED",
    "BACKUP_ROUTE_UNVERIFIED",
    "SUPPORT_HOURS_MISSING",
    "SYNTHETIC_MONITOR_MISSING",
    "ERROR_MONITORING_MISSING",
    "PAGING_ROUTE_MISSING",
    "INCIDENT_REHEARSAL_MISSING",
    "APPROVAL_FOUNDER_MISSING",
    "APPROVAL_SUPPORT_MISSING",
    "APPROVAL_LEGALSAFETY_MISSING",
  ]);
});

test("incident readiness keeps personal contact fields out of its public summary", () => {
  const result = evaluateIncidentReadiness(baseConfig, evaluationOptions());

  assert.deepEqual(result.summary, {
    primaryOwnerRole: "incident-commander",
    primaryContactRoute: "primary-support-route",
    backupOwnerRole: "backup-incident-owner",
    backupContactRoute: "private-backup-route",
    syntheticMonitor: true,
    errorMonitoring: true,
    paging: true,
    recentRehearsal: true,
    requiredApprovalConfigurationDigest: incidentRoutingConfigurationDigest(baseConfig),
  });
  assert.equal(JSON.stringify(result).includes("@"), false);
});

test("incident readiness rejects owner roles whose private route is not configured", () => {
  const result = evaluateIncidentReadiness({
    ...baseConfig,
    contactRoutes: baseConfig.contactRoutes.filter((route) => route.id !== "private-backup-route"),
  }, evaluationOptions());

  assert.equal(result.ok, false);
  assert.equal(result.findings.some((finding) => finding.code === "BACKUP_ROUTE_UNVERIFIED"), true);
});

test("incident readiness rejects a backup owner routed through a non-private support inbox", () => {
  const result = evaluateIncidentReadiness({
    ...baseConfig,
    backupOwner: {
      ...baseConfig.backupOwner,
      contactRouteId: "primary-support-route",
    },
  }, evaluationOptions());

  assert.equal(result.ok, false);
  assert.equal(result.findings.some((finding) => finding.code === "BACKUP_ROUTE_UNVERIFIED"), true);
  assert.equal(result.summary.backupOwnerRole, null);
  assert.equal(result.summary.backupContactRoute, null);
});

test("incident readiness rejects stale, future, missing, and mismatched private route evidence", () => {
  const route = baseConfig.contactRoutes.find((entry) => entry.id === "private-backup-route");
  const cases = [
    { ...route, routeRef: null },
    { ...route, lastVerifiedAt: "2026-07-01T00:00:00.000Z" },
    { ...route, lastVerifiedAt: "2026-05-01T00:00:00.000Z" },
    { ...route, evidenceSha256: "0".repeat(64) },
  ];

  for (const invalidRoute of cases) {
    const result = evaluateIncidentReadiness(withIncidentApprovalDigests({
      ...baseConfig,
      contactRoutes: baseConfig.contactRoutes.map((entry) => (
        entry.id === "private-backup-route" ? invalidRoute : entry
      )),
    }), evaluationOptions());
    assert.equal(result.findings.some((finding) => finding.code === "BACKUP_ROUTE_UNVERIFIED"), true);
  }
});

test("incident readiness rejects an arbitrary repository file as private-route evidence", () => {
  const arbitraryEvidence = Buffer.from(JSON.stringify({ name: "rivt", private: true }));
  const arbitraryEvidenceSha256 = createHash("sha256").update(arbitraryEvidence).digest("hex");
  writeIncidentEvidence(arbitraryEvidence);
  const result = evaluateIncidentReadiness(withIncidentApprovalDigests({
    ...baseConfig,
    contactRoutes: baseConfig.contactRoutes.map((route) => (
      route.id === "private-backup-route"
        ? { ...route, evidenceSha256: arbitraryEvidenceSha256 }
        : route
    )),
  }), evaluationOptions("2026-06-21T12:00:00.000Z", arbitraryEvidence));
  writeIncidentEvidence();

  assert.equal(result.ok, false);
  assert.equal(result.findings.some((finding) => finding.code === "BACKUP_ROUTE_UNVERIFIED"), true);
});

test("incident readiness binds typed provider evidence to the configured private route", () => {
  const invalidReceipts = [
    { ...privateRouteEvidenceRecord, schemaVersion: 2 },
    { ...privateRouteEvidenceRecord, controlId: "another-route" },
    { ...privateRouteEvidenceRecord, type: "repository-file" },
    { ...privateRouteEvidenceRecord, provider: "another-provider" },
    { ...privateRouteEvidenceRecord, status: "queued" },
    { ...privateRouteEvidenceRecord, timestamp: "2026-06-20T12:59:59.000Z" },
    { ...privateRouteEvidenceRecord, routeRef: "provider-route:another-route" },
    { ...privateRouteEvidenceRecord, selfAssertedVerified: true },
  ];

  for (const receipt of invalidReceipts) {
    const evidence = Buffer.from(JSON.stringify(receipt));
    const evidenceSha256 = createHash("sha256").update(evidence).digest("hex");
    writeIncidentEvidence(evidence);
    const result = evaluateIncidentReadiness(withIncidentApprovalDigests({
      ...baseConfig,
      contactRoutes: baseConfig.contactRoutes.map((route) => (
        route.id === "private-backup-route"
          ? { ...route, evidenceSha256 }
          : route
      )),
    }), evaluationOptions("2026-06-21T12:00:00.000Z", evidence));

    assert.equal(
      result.findings.some((finding) => finding.code === "BACKUP_ROUTE_UNVERIFIED"),
      true,
      JSON.stringify(receipt),
    );
  }
  writeIncidentEvidence();
});

test("incident readiness rejects a repository-authored receipt without external verification", () => {
  const result = evaluateIncidentReadiness(
    baseConfig,
    evaluationOptions("2026-06-21T12:00:00.000Z", privateRouteEvidence, { trustEvidence: false }),
  );

  assert.equal(result.ok, false);
  assert.equal(result.findings.some((finding) => finding.code === "BACKUP_ROUTE_UNVERIFIED"), true);
});

test("incident readiness rejects evidence reached through a symlinked directory", (t) => {
  const symlinkRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rivt-incident-symlink-root-"));
  const outsideRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rivt-incident-symlink-outside-"));
  try {
    fs.writeFileSync(path.join(outsideRoot, "route.json"), privateRouteEvidence);
    const linkPath = path.join(symlinkRoot, "linked-evidence");
    try {
      fs.symlinkSync(outsideRoot, linkPath, process.platform === "win32" ? "junction" : "dir");
    } catch (error) {
      if (["EPERM", "EACCES", "ENOTSUP"].includes(error?.code)) {
        t.skip(`symlink creation unavailable: ${error.code}`);
        return;
      }
      throw error;
    }
    const routeEvidencePath = path.join("linked-evidence", "route.json");
    const config = withIncidentApprovalDigests({
      ...baseConfig,
      contactRoutes: baseConfig.contactRoutes.map((route) => (
        route.id === "private-backup-route"
          ? { ...route, evidencePath: routeEvidencePath }
          : route
      )),
    });
    const result = evaluateIncidentReadiness(config, evaluationOptions(
      "2026-06-21T12:00:00.000Z",
      privateRouteEvidence,
      { rootDir: symlinkRoot },
    ));

    assert.equal(result.findings.some((finding) => finding.code === "BACKUP_ROUTE_UNVERIFIED"), true);
  } finally {
    fs.rmSync(symlinkRoot, { recursive: true, force: true });
    fs.rmSync(outsideRoot, { recursive: true, force: true });
  }
});

test("incident readiness rejects rehearsals dated in the future", () => {
  const result = evaluateIncidentReadiness({
    ...baseConfig,
    rehearsals: [{ status: "passed", completedAt: "2026-06-22T12:00:00.000Z" }],
  }, evaluationOptions());

  assert.equal(result.findings.some((finding) => finding.code === "INCIDENT_REHEARSAL_MISSING"), true);
});

test("incident readiness rejects future-dated incident approvals", () => {
  for (const key of ["founder", "support", "legalSafety"]) {
    const result = evaluateIncidentReadiness(withIncidentApprovalDigests({
      ...baseConfig,
      approvals: {
        ...baseConfig.approvals,
        [key]: {
          ...baseConfig.approvals[key],
          approvedAt: "2026-06-22T12:00:00.000Z",
        },
      },
    }), evaluationOptions());

    assert.equal(
      result.findings.some((finding) => finding.code === `APPROVAL_${key.toUpperCase()}_INVALID`),
      true,
    );
  }
});

test("incident readiness rejects approvals with invalid timestamps", () => {
  for (const key of ["founder", "support", "legalSafety"]) {
    const result = evaluateIncidentReadiness(withIncidentApprovalDigests({
      ...baseConfig,
      approvals: {
        ...baseConfig.approvals,
        [key]: {
          ...baseConfig.approvals[key],
          approvedAt: "not-a-timestamp",
        },
      },
    }), evaluationOptions());

    assert.equal(
      result.findings.some((finding) => finding.code === `APPROVAL_${key.toUpperCase()}_INVALID`),
      true,
    );
  }
});

test("incident readiness rejects approvals recorded before the latest incident evidence", () => {
  for (const key of ["founder", "support", "legalSafety"]) {
    const result = evaluateIncidentReadiness(withIncidentApprovalDigests({
      ...baseConfig,
      approvals: {
        ...baseConfig.approvals,
        [key]: {
          ...baseConfig.approvals[key],
          approvedAt: "2026-06-20T12:30:00.000Z",
        },
      },
    }), evaluationOptions());

    assert.equal(
      result.findings.some((finding) => finding.code === `APPROVAL_${key.toUpperCase()}_STALE`),
      true,
    );
  }
});

test("incident approval digest is deterministic and excludes only approval digest fields", () => {
  const digest = incidentRoutingConfigurationDigest(baseConfig);
  const changedDigestFields = {
    ...baseConfig,
    approvals: Object.fromEntries(
      Object.entries(baseConfig.approvals).map(([key, approval]) => [key, {
        ...approval,
        configurationDigest: `${key}-ignored-digest-value`,
      }]),
    ),
  };

  assert.equal(incidentRoutingConfigurationDigest(changedDigestFields), digest);
});

test("incident readiness invalidates prior approvals after reviewed plan details change", () => {
  const mutations = [
    {
      name: "support coverage",
      apply: (config) => ({
        ...config,
        supportHours: { ...config.supportHours, coverage: "9am-5pm ET" },
      }),
    },
    {
      name: "primary route record",
      apply: (config) => ({
        ...config,
        contactRoutes: config.contactRoutes.map((route) => (
          route.id === "primary-support-route"
            ? { ...route, record: "replacement organizational support route" }
            : route
        )),
      }),
    },
    {
      name: "paging provider and route",
      apply: (config) => ({
        ...config,
        alertDestinations: config.alertDestinations.map((destination) => (
          destination.category === "paging"
            ? { ...destination, provider: "replacement-pager", route: "replacement escalation" }
            : destination
        )),
      }),
    },
    {
      name: "alert destination inventory",
      apply: (config) => ({
        ...config,
        alertDestinations: [
          ...config.alertDestinations,
          { id: "secondary-errors", category: "error_monitoring", status: "configured" },
        ],
      }),
    },
    {
      name: "route approval scope",
      apply: (config) => ({
        ...config,
        routeApproval: { ...config.routeApproval, scope: "Expanded routing plan" },
      }),
    },
    {
      name: "other incident plan detail",
      apply: (config) => ({ ...config, version: config.version + 1 }),
    },
  ];

  const expectedCodes = [
    "APPROVAL_FOUNDER_CONFIGURATION_MISMATCH",
    "APPROVAL_SUPPORT_CONFIGURATION_MISMATCH",
    "APPROVAL_LEGALSAFETY_CONFIGURATION_MISMATCH",
  ];
  for (const mutation of mutations) {
    const result = evaluateIncidentReadiness(mutation.apply(baseConfig), evaluationOptions());
    assert.deepEqual(
      result.findings
        .map((finding) => finding.code)
        .filter((code) => code.startsWith("APPROVAL_")),
      expectedCodes,
      mutation.name,
    );
  }
});
