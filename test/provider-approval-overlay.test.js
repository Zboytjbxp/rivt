import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import {
  approvalManifestPath,
  parseProviderApprovalOverlayArguments,
  providerApprovalOverlayContract,
  providerEvidencePlanDigest,
  providerReadinessConfigurationDigest,
  sourcePolicyBundleDigest,
  validateProviderApprovalOverlay,
  validateProviderApprovalWorktree,
} from "../scripts/provider-approval-overlay.js";
import { validateProviderEvidenceOverlay } from "../scripts/provider-evidence-overlay.js";
import {
  launchHoldConfigurationDigest,
} from "../scripts/launch-readiness-check.js";

const fixedNow = new Date("2026-08-03T12:10:00.000Z");

function run(rootDir, args, { input } = {}) {
  const result = spawnSync("git", ["-C", rootDir, ...args], {
    encoding: "utf8",
    env: {
      ...process.env,
      GIT_AUTHOR_DATE: "2026-08-03T00:00:00.000Z",
      GIT_COMMITTER_DATE: "2026-08-03T00:00:00.000Z",
    },
    input,
    windowsHide: true,
  });
  assert.equal(
    result.status,
    0,
    `git ${args.join(" ")} failed: ${result.stderr || result.stdout}`,
  );
  return result.stdout.trim();
}

function write(rootDir, relativePath, value) {
  const absolutePath = path.join(rootDir, ...relativePath.split("/"));
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, value);
}

function commitAll(rootDir, message) {
  run(rootDir, ["add", "-A"]);
  run(rootDir, ["commit", "-m", message]);
  return run(rootDir, ["rev-parse", "HEAD"]);
}

function policyFixture() {
  return {
    incidentConfig: {
      alertDestinations: [],
      approvals: {},
      launchHold: {
        active: true,
        incident: "docs/operations/incidents/credential-exposure.md",
        reason: "Containment remains open.",
      },
      status: "approved",
      version: 1,
    },
    recoveryPolicy: {
      approvals: {},
      backupRetention: { days: 30 },
      status: "approved",
      targets: { rpoMinutes: 1440, rtoMinutes: 240 },
      version: 1,
    },
    paymentProviderPolicy: {
      approval: { status: "pending" },
      evidence: "provider-receipt.json",
      featureFlagVerifiedOff: true,
      mode: "disabled",
      signedDeliveryVerified: false,
      status: "approved",
      verifiedAt: "2026-08-03T12:00:00.000Z",
      verifiedProductionState: {
        configured: false,
        enabled: false,
        mode: "setup_required",
        webhookConfigured: true,
      },
      version: 1,
    },
  };
}

function planFixture(sourceCommit) {
  const evidencePath = [
    "docs/delivery/evidence/railway-stage1/provider",
    sourceCommit,
    "synthetic-monitor.json",
  ].join("/");
  return {
    claims: [{
      adapterId: "github-production-synthetic-v1",
      controlId: "synthetic-monitor",
      evidencePath,
      evidenceSha256: "1".repeat(64),
      expectedReceipt: {
        controlId: "synthetic-monitor",
        provider: "GitHub Actions",
        status: "passed",
        type: "synthetic-monitor-delivery-test",
      },
      provider: "GitHub Actions",
      scope: {
        account: "Zboytjbxp",
        environment: "production",
        project: "rivt",
        resource: "workflow:1:issue:2",
      },
      type: "synthetic-monitor-delivery-test",
    }],
    schemaVersion: 1,
  };
}

function approval(role, configurationDigest, approvedAt = "2026-08-03T12:01:00.000Z") {
  return {
    approvedAt,
    approverRoleId: role,
    configurationDigest,
    status: "approved",
  };
}

function createRepository(t) {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "rivt-approval-overlay-"));
  t.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  run(rootDir, ["init", "--quiet"]);
  run(rootDir, ["config", "user.email", "approval-tests@rivt.invalid"]);
  run(rootDir, ["config", "user.name", "RIVT Approval Tests"]);
  const policies = policyFixture();
  write(rootDir, "server/index.js", "export const runtime = true;\n");
  write(
    rootDir,
    "docs/operations/incident-routing.json",
    `${JSON.stringify(policies.incidentConfig, null, 2)}\n`,
  );
  write(
    rootDir,
    "docs/operations/recovery-policy.json",
    `${JSON.stringify(policies.recoveryPolicy, null, 2)}\n`,
  );
  write(
    rootDir,
    "docs/operations/payment-provider-readiness.json",
    `${JSON.stringify(policies.paymentProviderPolicy, null, 2)}\n`,
  );
  const sourceCommit = commitAll(rootDir, "source policy");
  const plan = planFixture(sourceCommit);
  write(
    rootDir,
    plan.claims[0].evidencePath,
    `${JSON.stringify(plan.claims[0].expectedReceipt, null, 2)}\n`,
  );
  const evidenceCommit = commitAll(rootDir, "protected provider evidence");
  return { evidenceCommit, plan, policies, rootDir, sourceCommit };
}

function expectedBindings(plan) {
  return plan.claims.map((claim) => ({
    adapterId: claim.adapterId,
    controlId: claim.controlId,
    evidencePath: claim.evidencePath,
    evidenceSha256: claim.evidenceSha256,
    provider: claim.provider,
    type: claim.type,
  }));
}

function canonicalSha256(value) {
  return createHash("sha256")
    .update(String(value).replace(/\r\n?/g, "\n"))
    .digest("hex");
}

function manifestFixture(fixture, overrides = {}) {
  const incidentDigest = "3".repeat(64);
  const recoveryDigest = "4".repeat(64);
  const paymentDigest = "5".repeat(64);
  return {
    approvals: {
      incident: {
        founder: approval("founder", incidentDigest),
        legalSafety: approval("legal-safety", incidentDigest),
        support: approval("support", incidentDigest),
      },
      payment: approval("operations", paymentDigest),
      recovery: {
        founder: approval("founder", recoveryDigest),
        operations: approval("operations", recoveryDigest),
      },
    },
    evidenceBindings: expectedBindings(fixture.plan),
    evidenceCommit: fixture.evidenceCommit,
    evidenceOverlayDigest: "2".repeat(64),
    evidencePlanDigest: providerEvidencePlanDigest(fixture.plan),
    hold: {
      configurationDigest: "6".repeat(64),
      decidedAt: "2026-08-03T12:02:00.000Z",
      decidedByRoleId: "founder",
      incident: "docs/operations/incidents/credential-exposure.md",
      reason: "All recorded containment exits are satisfied.",
      status: "cleared",
    },
    recordedAt: "2026-08-03T12:03:00.000Z",
    schemaVersion: 1,
    sourceCommit: fixture.sourceCommit,
    sourcePolicyDigest: sourcePolicyBundleDigest(fixture.policies),
    ...overrides,
  };
}

function createValidApprovalOverlay(t, mutateManifest) {
  const fixture = createRepository(t);
  const manifest = manifestFixture(fixture);
  mutateManifest?.(manifest, fixture);
  const manifestPath = approvalManifestPath(fixture.sourceCommit, fixture.evidenceCommit);
  write(fixture.rootDir, manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  const approvalCommit = commitAll(fixture.rootDir, "typed launch approval");
  return { ...fixture, approvalCommit, manifest, manifestPath };
}

function validate(fixture, overrides = {}) {
  return validateProviderApprovalOverlay({
    approvalCommit: fixture.approvalCommit,
    evidenceCommit: fixture.evidenceCommit,
    evidenceOverlayDigest: "2".repeat(64),
    now: fixedNow,
    plan: fixture.plan,
    rootDir: fixture.rootDir,
    sourceCommit: fixture.sourceCommit,
    ...fixture.policies,
    ...overrides,
  });
}

test("canonical plan and source-policy digests ignore object key insertion order", () => {
  const plan = planFixture("a".repeat(40));
  const reorderedPlan = { schemaVersion: 1, claims: plan.claims.map((claim) => ({
    type: claim.type,
    scope: claim.scope,
    provider: claim.provider,
    expectedReceipt: claim.expectedReceipt,
    evidenceSha256: claim.evidenceSha256,
    evidencePath: claim.evidencePath,
    controlId: claim.controlId,
    adapterId: claim.adapterId,
  })) };
  assert.equal(providerEvidencePlanDigest(plan), providerEvidencePlanDigest(reorderedPlan));

  const policies = policyFixture();
  assert.equal(
    sourcePolicyBundleDigest(policies),
    sourcePolicyBundleDigest({
      paymentProviderPolicy: policies.paymentProviderPolicy,
      incidentConfig: policies.incidentConfig,
      recoveryPolicy: policies.recoveryPolicy,
    }),
  );
  assert.equal(
    providerReadinessConfigurationDigest(policies),
    launchHoldConfigurationDigest(policies),
  );
});

test("a clean linear approval commit binds the exact source, evidence, plan, and policies", (t) => {
  const fixture = createValidApprovalOverlay(t);
  const result = validate(fixture);

  assert.equal(result.ok, true);
  assert.deepEqual(result.findingCodes, []);
  assert.deepEqual(result.manifest, fixture.manifest);
  assert.equal(result.report.sourceCommit, fixture.sourceCommit);
  assert.equal(result.report.evidenceCommit, fixture.evidenceCommit);
  assert.equal(result.report.approvalCommit, fixture.approvalCommit);
  assert.equal(result.report.manifestPath, fixture.manifestPath);
  assert.equal(result.report.evidenceBindingCount, 1);
  assert.equal(result.report.holdStatus, "cleared");
  assert.deepEqual(result.report.approvedRoles, [
    "incident:founder",
    "incident:legalSafety",
    "incident:support",
    "payment",
    "recovery:founder",
    "recovery:operations",
  ]);
  assert.equal("approverRoleId" in result.report, false);
  assert.equal("reason" in result.report, false);

  const worktree = validateProviderApprovalWorktree({
    approvalCommit: fixture.approvalCommit,
    approvalRoot: fixture.rootDir,
  });
  assert.equal(worktree.ok, true);
});

test("approval worktree must be a clean checkout pinned to the exact approval commit", (t) => {
  const fixture = createValidApprovalOverlay(t);
  write(fixture.rootDir, "untracked.txt", "dirty\n");
  assert.ok(validateProviderApprovalWorktree({
    approvalCommit: fixture.approvalCommit,
    approvalRoot: fixture.rootDir,
  }).findingCodes.includes("APPROVAL_WORKTREE_DIRTY"));

  fs.unlinkSync(path.join(fixture.rootDir, "untracked.txt"));
  assert.ok(validateProviderApprovalWorktree({
    approvalCommit: fixture.evidenceCommit,
    approvalRoot: fixture.rootDir,
  }).findingCodes.includes("APPROVAL_WORKTREE_COMMIT_MISMATCH"));
});

test("full commit IDs, ancestry, and a merge-free linear history are mandatory", async (t) => {
  await t.test("abbreviated source", () => {
    const fixture = createValidApprovalOverlay(t);
    const result = validate(fixture, { sourceCommit: fixture.sourceCommit.slice(0, 12) });
    assert.ok(result.findingCodes.includes("APPROVAL_OVERLAY_SOURCE_COMMIT_INVALID"));
  });

  await t.test("approval does not descend from evidence", () => {
    const fixture = createValidApprovalOverlay(t);
    run(fixture.rootDir, ["checkout", "--orphan", "unrelated"]);
    run(fixture.rootDir, ["rm", "-rf", "."]);
    write(fixture.rootDir, "unrelated.txt", "unrelated\n");
    const approvalCommit = commitAll(fixture.rootDir, "unrelated approval");
    const result = validate(fixture, { approvalCommit });
    assert.ok(result.findingCodes.includes("APPROVAL_OVERLAY_NOT_DESCENDANT"));
  });

  await t.test("merge commit", () => {
    const fixture = createRepository(t);
    const baseBranch = run(fixture.rootDir, ["branch", "--show-current"]);
    run(fixture.rootDir, ["checkout", "-b", "approval-side"]);
    const manifest = manifestFixture(fixture);
    write(
      fixture.rootDir,
      approvalManifestPath(fixture.sourceCommit, fixture.evidenceCommit),
      `${JSON.stringify(manifest, null, 2)}\n`,
    );
    commitAll(fixture.rootDir, "approval side");
    run(fixture.rootDir, ["checkout", baseBranch]);
    run(fixture.rootDir, ["commit", "--allow-empty", "-m", "empty main commit"]);
    run(fixture.rootDir, ["merge", "--no-ff", "approval-side", "-m", "merge approval"]);
    const approvalCommit = run(fixture.rootDir, ["rev-parse", "HEAD"]);
    const result = validate({ ...fixture, approvalCommit });
    assert.ok(result.findingCodes.includes("APPROVAL_OVERLAY_HISTORY_NOT_LINEAR"));
  });
});

test("the approval overlay permits only one newly added regular manifest", async (t) => {
  await t.test("extra path", () => {
    const fixture = createRepository(t);
    const manifest = manifestFixture(fixture);
    write(
      fixture.rootDir,
      approvalManifestPath(fixture.sourceCommit, fixture.evidenceCommit),
      `${JSON.stringify(manifest, null, 2)}\n`,
    );
    write(fixture.rootDir, "docs/delivery/BUILD_STATE.md", "approval changed build state\n");
    const approvalCommit = commitAll(fixture.rootDir, "approval plus unrelated change");
    const result = validate({ ...fixture, approvalCommit });
    assert.ok(result.findingCodes.includes("APPROVAL_OVERLAY_CHANGE_COUNT_INVALID"));
    assert.ok(result.findingCodes.includes("APPROVAL_OVERLAY_PATH_NOT_ALLOWED"));
  });

  await t.test("wrong manifest path", () => {
    const fixture = createRepository(t);
    write(
      fixture.rootDir,
      "docs/delivery/evidence/railway-stage1/approval/launch-readiness.json",
      `${JSON.stringify(manifestFixture(fixture), null, 2)}\n`,
    );
    const approvalCommit = commitAll(fixture.rootDir, "unbound approval path");
    const result = validate({ ...fixture, approvalCommit });
    assert.ok(result.findingCodes.includes("APPROVAL_OVERLAY_PATH_NOT_ALLOWED"));
  });

  await t.test("manifest rewritten in a later commit", () => {
    const fixture = createValidApprovalOverlay(t);
    const changed = structuredClone(fixture.manifest);
    changed.hold.status = "retained";
    write(fixture.rootDir, fixture.manifestPath, `${JSON.stringify(changed, null, 2)}\n`);
    const approvalCommit = commitAll(fixture.rootDir, "rewrite approval manifest");
    const result = validate(fixture, { approvalCommit });
    assert.ok(result.findingCodes.includes("APPROVAL_OVERLAY_STATUS_NOT_ALLOWED"));
  });

  await t.test("symlink manifest", () => {
    const fixture = createRepository(t);
    const manifestPath = approvalManifestPath(fixture.sourceCommit, fixture.evidenceCommit);
    const oid = run(fixture.rootDir, ["hash-object", "-w", "--stdin"], {
      input: "../../../../server/index.js",
    });
    run(fixture.rootDir, [
      "update-index",
      "--add",
      "--cacheinfo",
      `120000,${oid},${manifestPath}`,
    ]);
    run(fixture.rootDir, ["commit", "-m", "symlink approval manifest"]);
    const approvalCommit = run(fixture.rootDir, ["rev-parse", "HEAD"]);
    const result = validate({ ...fixture, approvalCommit });
    assert.ok(result.findingCodes.includes("APPROVAL_OVERLAY_MODE_NOT_ALLOWED"));
  });
});

test("the manifest schema is exact at every approval and hold boundary", async (t) => {
  const cases = [
    ["top-level key", (manifest) => { manifest.unexpected = true; }],
    ["incident role", (manifest) => { delete manifest.approvals.incident.legalSafety; }],
    ["approval field", (manifest) => { manifest.approvals.payment.note = "extra"; }],
    ["approval status", (manifest) => { manifest.approvals.recovery.founder.status = "pending"; }],
    ["hold field", (manifest) => { delete manifest.hold.incident; }],
    ["hold status", (manifest) => { manifest.hold.status = "waived"; }],
  ];
  for (const [label, mutate] of cases) {
    await t.test(label, () => {
      const fixture = createValidApprovalOverlay(t, mutate);
      assert.ok(validate(fixture).findingCodes.includes("APPROVAL_MANIFEST_SCHEMA_INVALID"));
    });
  }
});

test("the protected plan must be source-bound and free of reused evidence identities", async (t) => {
  await t.test("wrong source path", () => {
    const fixture = createValidApprovalOverlay(t);
    const plan = structuredClone(fixture.plan);
    plan.claims[0].evidencePath = plan.claims[0].evidencePath.replace(
      fixture.sourceCommit,
      "f".repeat(40),
    );
    assert.ok(validate(fixture, { plan }).findingCodes.includes("APPROVAL_OVERLAY_PLAN_INVALID"));
  });

  await t.test("reused receipt", () => {
    const fixture = createValidApprovalOverlay(t);
    const plan = structuredClone(fixture.plan);
    plan.claims.push({ ...plan.claims[0] });
    assert.ok(validate(fixture, { plan }).findingCodes.includes("APPROVAL_OVERLAY_PLAN_INVALID"));
  });
});

test("the manifest rejects every stale or substituted cryptographic binding", async (t) => {
  const cases = [
    ["source", (manifest) => { manifest.sourceCommit = "a".repeat(40); }, "APPROVAL_MANIFEST_SOURCE_MISMATCH"],
    ["evidence", (manifest) => { manifest.evidenceCommit = "b".repeat(40); }, "APPROVAL_MANIFEST_EVIDENCE_MISMATCH"],
    ["overlay", (manifest) => { manifest.evidenceOverlayDigest = "3".repeat(64); }, "APPROVAL_MANIFEST_OVERLAY_DIGEST_MISMATCH"],
    ["plan", (manifest) => { manifest.evidencePlanDigest = "4".repeat(64); }, "APPROVAL_MANIFEST_PLAN_DIGEST_MISMATCH"],
    ["policy", (manifest) => { manifest.sourcePolicyDigest = "5".repeat(64); }, "APPROVAL_MANIFEST_POLICY_DIGEST_MISMATCH"],
    ["receipt identity", (manifest) => { manifest.evidenceBindings[0].controlId = "other"; }, "APPROVAL_MANIFEST_EVIDENCE_BINDINGS_MISMATCH"],
    ["hold incident", (manifest) => { manifest.hold.incident = "docs/operations/incidents/unrelated.md"; }, "APPROVAL_MANIFEST_HOLD_INCIDENT_MISMATCH"],
  ];
  for (const [label, mutate, code] of cases) {
    await t.test(label, () => {
      const fixture = createValidApprovalOverlay(t, mutate);
      assert.ok(validate(fixture).findingCodes.includes(code));
    });
  }
});

test("post-materialization configuration digests remain the materializer's authority", (t) => {
  const fixture = createValidApprovalOverlay(t, (manifest) => {
    manifest.approvals.incident.founder.configurationDigest = "a".repeat(64);
    manifest.approvals.recovery.operations.configurationDigest = "b".repeat(64);
    manifest.approvals.payment.configurationDigest = "c".repeat(64);
    manifest.hold.configurationDigest = "d".repeat(64);
  });
  const result = validate(fixture);
  assert.equal(result.ok, true);
});

test("approval timestamps are parseable, nonfuture, and precede the manifest record", async (t) => {
  await t.test("approval at the evidence commit time", () => {
    const fixture = createValidApprovalOverlay(t, (manifest) => {
      manifest.approvals.incident.founder.approvedAt = "2026-08-03T00:00:00.000Z";
    });
    assert.ok(validate(fixture).findingCodes.includes("APPROVAL_MANIFEST_TIMESTAMP_STALE"));
  });

  await t.test("future nested approval", () => {
    const fixture = createValidApprovalOverlay(t, (manifest) => {
      manifest.approvals.incident.support.approvedAt = "2026-08-03T12:11:00.000Z";
      manifest.recordedAt = "2026-08-03T12:12:00.000Z";
    });
    assert.ok(validate(fixture).findingCodes.includes("APPROVAL_MANIFEST_TIMESTAMP_INVALID"));
  });

  await t.test("recorded before hold decision", () => {
    const fixture = createValidApprovalOverlay(t, (manifest) => {
      manifest.recordedAt = "2026-08-03T12:01:30.000Z";
    });
    assert.ok(validate(fixture).findingCodes.includes("APPROVAL_MANIFEST_RECORDED_AT_INVALID"));
  });

  await t.test("invalid timestamp", () => {
    const fixture = createValidApprovalOverlay(t, (manifest) => {
      manifest.approvals.payment.approvedAt = "not-a-date";
    });
    assert.ok(validate(fixture).findingCodes.includes("APPROVAL_MANIFEST_TIMESTAMP_INVALID"));
  });
});

test("manifest count and size limits are explicit and fail closed", (t) => {
  const fixture = createValidApprovalOverlay(t);
  assert.equal(providerApprovalOverlayContract.maximumChangedFileCount, 1);
  assert.ok(providerApprovalOverlayContract.maximumManifestBytes <= 64 * 1024);

  const oversized = structuredClone(fixture.manifest);
  oversized.hold.reason = "x".repeat(providerApprovalOverlayContract.maximumManifestBytes);
  write(fixture.rootDir, fixture.manifestPath, `${JSON.stringify(oversized)}\n`);
  const approvalCommit = commitAll(fixture.rootDir, "oversized manifest");
  const result = validate(fixture, { approvalCommit });
  assert.ok(result.findingCodes.includes("APPROVAL_MANIFEST_SIZE_INVALID"));
});

test("approval manifest paths reject abbreviated or unsafe commit values", () => {
  assert.throws(
    () => approvalManifestPath("a".repeat(12), "b".repeat(40)),
    /full lowercase Git commit/,
  );
  assert.throws(
    () => approvalManifestPath("../unsafe", "b".repeat(40)),
    /full lowercase Git commit/,
  );
});

test("the standalone CLI requires explicit pinned S, E, and A roots and commits", () => {
  const commit = "a".repeat(40);
  assert.equal(
    parseProviderApprovalOverlayArguments([]).reasonCode,
    "APPROVAL_ARGUMENT_REQUIRED",
  );
  assert.equal(parseProviderApprovalOverlayArguments([
    "--source-commit", commit,
    "--evidence-commit", commit,
    "--approval-commit", commit,
    "--policy-root", "policy",
    "--evidence-root", "evidence",
    "--approval-root", "approval",
    "--json",
  ]).ok, true);
  assert.equal(parseProviderApprovalOverlayArguments([
    "--source-commit", commit,
    "--source-commit", commit,
  ]).reasonCode, "APPROVAL_ARGUMENT_DUPLICATE");
});

test("the standalone CLI validates clean pinned S, E, and A worktrees without provider access", (t) => {
  const fixture = createRepository(t);
  const plan = structuredClone(fixture.plan);
  const serializedReceipt = `${JSON.stringify(plan.claims[0].expectedReceipt, null, 2)}\n`;
  plan.claims[0].evidenceSha256 = canonicalSha256(serializedReceipt);
  const evidenceResult = validateProviderEvidenceOverlay({
    evidenceCommit: fixture.evidenceCommit,
    plan,
    rootDir: fixture.rootDir,
    sourceCommit: fixture.sourceCommit,
  });
  assert.equal(evidenceResult.ok, true);

  const manifest = manifestFixture({ ...fixture, plan }, {
    evidenceOverlayDigest: evidenceResult.report.overlayDigest,
    evidencePlanDigest: providerEvidencePlanDigest(plan),
  });
  for (const nestedApproval of [
    ...Object.values(manifest.approvals.incident),
    ...Object.values(manifest.approvals.recovery),
    manifest.approvals.payment,
  ]) {
    nestedApproval.approvedAt = "2026-08-03T00:01:00.000Z";
  }
  manifest.hold.decidedAt = "2026-08-03T00:02:00.000Z";
  manifest.recordedAt = "2026-08-03T00:03:00.000Z";
  const manifestPath = approvalManifestPath(fixture.sourceCommit, fixture.evidenceCommit);
  write(fixture.rootDir, manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  const approvalCommit = commitAll(fixture.rootDir, "CLI approval overlay");

  const worktreeParent = fs.mkdtempSync(path.join(os.tmpdir(), "rivt-approval-cli-roots-"));
  const evidenceRoot = path.join(worktreeParent, "evidence");
  const policyRoot = path.join(worktreeParent, "policy");
  try {
    run(fixture.rootDir, ["worktree", "add", "--quiet", "--detach", evidenceRoot, fixture.evidenceCommit]);
    run(fixture.rootDir, ["worktree", "add", "--quiet", "--detach", policyRoot, fixture.sourceCommit]);
    const result = spawnSync(process.execPath, [
      path.resolve("scripts/provider-approval-overlay.js"),
      "--source-commit", fixture.sourceCommit,
      "--evidence-commit", fixture.evidenceCommit,
      "--approval-commit", approvalCommit,
      "--policy-root", policyRoot,
      "--evidence-root", evidenceRoot,
      "--approval-root", fixture.rootDir,
      "--json",
    ], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        RIVT_PROVIDER_EVIDENCE_PLAN_JSON: JSON.stringify(plan),
      },
      windowsHide: true,
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const output = JSON.parse(result.stdout);
    assert.equal(output.status, "verified");
    assert.deepEqual(output.findingCodes, []);
    assert.equal(output.report.approval.approvalCommit, approvalCommit);
    assert.equal("manifest" in output.report.approval, false);
  } finally {
    run(fixture.rootDir, ["worktree", "remove", "--force", evidenceRoot]);
    run(fixture.rootDir, ["worktree", "remove", "--force", policyRoot]);
    fs.rmSync(worktreeParent, { recursive: true, force: true });
  }
});

test("the preinstall approval validator loads without third-party dependencies", (t) => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "rivt-approval-preinstall-"));
  t.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(rootDir, "package.json"), '{"type":"module"}\n', "utf8");
  for (const fileName of [
    "provider-approval-overlay.js",
    "provider-evidence-overlay.js",
    "readiness-configuration-digests.js",
  ]) {
    fs.copyFileSync(
      path.resolve("scripts", fileName),
      path.join(rootDir, fileName),
    );
  }

  const result = spawnSync(process.execPath, [
    path.join(rootDir, "provider-approval-overlay.js"),
  ], {
    cwd: rootDir,
    encoding: "utf8",
    env: {},
    windowsHide: true,
  });
  assert.equal(result.status, 1, result.stderr || result.stdout);
  assert.doesNotMatch(result.stderr, /ERR_MODULE_NOT_FOUND|Cannot find package/);
  const output = JSON.parse(result.stdout);
  assert.equal(output.status, "blocked");
  assert.deepEqual(output.findingCodes, ["APPROVAL_ARGUMENT_REQUIRED"]);
});
