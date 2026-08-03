import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import {
  parseProviderEvidenceOverlayArguments,
  providerEvidenceOverlayContract,
  validateProviderEvidenceOverlay,
  validateProviderEvidenceWorktree,
  validateProviderPolicyWorktree,
} from "../scripts/provider-evidence-overlay.js";

function run(rootDir, args, { input } = {}) {
  const result = spawnSync("git", ["-C", rootDir, ...args], {
    encoding: "utf8",
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

function disabledPaymentProviderConfig(overrides = {}) {
  return {
    featureFlagVerifiedOff: true,
    mode: "disabled",
    signedDeliveryVerified: false,
    status: "approved",
    verifiedProductionState: {
      configured: false,
      enabled: false,
      mode: "setup_required",
      webhookConfigured: true,
    },
    version: 1,
    ...overrides,
  };
}

function createRepository(t) {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "rivt-evidence-overlay-"));
  t.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  run(rootDir, ["init", "--quiet"]);
  run(rootDir, ["config", "user.email", "overlay-tests@rivt.invalid"]);
  run(rootDir, ["config", "user.name", "RIVT Overlay Tests"]);
  write(rootDir, "server/index.js", "export const runtime = true;\n");
  write(rootDir, "docs/operations/incident-routing.json", "{\"version\":4}\n");
  write(rootDir, "docs/operations/recovery-policy.json", "{\"version\":3}\n");
  write(
    rootDir,
    "docs/operations/payment-provider-readiness.json",
    `${JSON.stringify(disabledPaymentProviderConfig(), null, 2)}\n`,
  );
  write(rootDir, "docs/delivery/BUILD_STATE.md", "# Build state\n");
  const sourceCommit = commitAll(rootDir, "source");
  return { rootDir, sourceCommit };
}

function canonicalSha256(value) {
  return createHash("sha256")
    .update(String(value).replace(/\r\n?/g, "\n"))
    .digest("hex");
}

function receiptFixture(sourceCommit, suffix = "synthetic-monitor") {
  const value = {
    category: "synthetic_monitor",
    controlId: suffix,
    provider: "GitHub Actions",
    schemaVersion: 1,
    status: "passed",
    timestamp: "2026-08-02T12:00:00.000Z",
    type: "synthetic-monitor-delivery-test",
  };
  const serialized = `${JSON.stringify(value, null, 2)}\n`;
  const evidencePath = [
    "docs/delivery/evidence/railway-stage1/provider",
    sourceCommit,
    `${suffix}.json`,
  ].join("/");
  const claim = {
    adapterId: "github-production-synthetic-v1",
    controlId: suffix,
    evidencePath,
    evidenceSha256: canonicalSha256(serialized),
    expectedReceipt: value,
    provider: value.provider,
    scope: {
      account: "Zboytjbxp",
      environment: "master",
      project: "rivt",
      resource: "workflow:1:issue:2",
    },
    type: value.type,
  };
  return { claim, evidencePath, serialized, value };
}

function createValidOverlay(t) {
  const fixture = createRepository(t);
  const receipt = receiptFixture(fixture.sourceCommit);
  write(
    fixture.rootDir,
    "docs/operations/payment-provider-readiness.json",
    `${JSON.stringify(disabledPaymentProviderConfig({ verifiedAt: "2026-08-02T12:00:00.000Z" }), null, 2)}\n`,
  );
  write(fixture.rootDir, receipt.evidencePath, receipt.serialized);
  const evidenceCommit = commitAll(fixture.rootDir, "evidence overlay");
  return {
    ...fixture,
    evidenceCommit,
    plan: { claims: [receipt.claim], schemaVersion: 1 },
    receipt,
  };
}

test("an evidence commit may follow a deployed source without pretending it was deployed", (t) => {
  const fixture = createValidOverlay(t);
  const first = validateProviderEvidenceOverlay(fixture);
  const second = validateProviderEvidenceOverlay(fixture);

  assert.equal(first.ok, true);
  assert.deepEqual(first.findingCodes, []);
  assert.equal(first.report.sourceCommit, fixture.sourceCommit);
  assert.equal(first.report.evidenceCommit, fixture.evidenceCommit);
  assert.equal(first.report.historyCommitCount, 1);
  assert.equal(first.report.planValidated, true);
  assert.deepEqual(first.report.addedReceiptPaths, [fixture.receipt.evidencePath]);
  assert.match(first.report.overlayDigest, /^[a-f0-9]{64}$/);
  assert.equal(second.report.overlayDigest, first.report.overlayDigest);
});

test("the filesystem evidence root must be a clean checkout of the exact evidence commit", (t) => {
  const fixture = createValidOverlay(t);
  const exact = validateProviderEvidenceWorktree({
    evidenceCommit: fixture.evidenceCommit,
    evidenceRoot: fixture.rootDir,
  });
  assert.equal(exact.ok, true);

  write(fixture.rootDir, "untracked.txt", "not evidence\n");
  const dirty = validateProviderEvidenceWorktree({
    evidenceCommit: fixture.evidenceCommit,
    evidenceRoot: fixture.rootDir,
  });
  assert.ok(dirty.findingCodes.includes("EVIDENCE_WORKTREE_DIRTY"));

  fs.unlinkSync(path.join(fixture.rootDir, "untracked.txt"));
  const mismatch = validateProviderEvidenceWorktree({
    evidenceCommit: fixture.sourceCommit,
    evidenceRoot: fixture.rootDir,
  });
  assert.ok(mismatch.findingCodes.includes("EVIDENCE_WORKTREE_COMMIT_MISMATCH"));
});

test("the policy root must be a clean checkout of the exact deployed source commit", (t) => {
  const fixture = createRepository(t);
  const exact = validateProviderPolicyWorktree({
    policyRoot: fixture.rootDir,
    sourceCommit: fixture.sourceCommit,
  });
  assert.equal(exact.ok, true);
  assert.equal(exact.report.policyRevision, fixture.sourceCommit);

  write(fixture.rootDir, "untracked.txt", "not policy\n");
  const dirty = validateProviderPolicyWorktree({
    policyRoot: fixture.rootDir,
    sourceCommit: fixture.sourceCommit,
  });
  assert.ok(dirty.findingCodes.includes("POLICY_WORKTREE_DIRTY"));

  fs.unlinkSync(path.join(fixture.rootDir, "untracked.txt"));
  const mismatch = validateProviderPolicyWorktree({
    policyRoot: fixture.rootDir,
    sourceCommit: "f".repeat(40),
  });
  assert.ok(mismatch.findingCodes.includes("POLICY_WORKTREE_COMMIT_MISMATCH"));
});

test("full commit IDs and source ancestry are mandatory", (t) => {
  const fixture = createValidOverlay(t);
  const abbreviated = validateProviderEvidenceOverlay({
    ...fixture,
    sourceCommit: fixture.sourceCommit.slice(0, 12),
  });
  assert.deepEqual(abbreviated.findingCodes, ["OVERLAY_SOURCE_COMMIT_INVALID"]);

  run(fixture.rootDir, ["checkout", "--orphan", "unrelated"]);
  run(fixture.rootDir, ["rm", "-rf", "."]);
  write(fixture.rootDir, "unrelated.txt", "unrelated\n");
  const unrelatedCommit = commitAll(fixture.rootDir, "unrelated");
  const unrelated = validateProviderEvidenceOverlay({
    evidenceCommit: unrelatedCommit,
    rootDir: fixture.rootDir,
    sourceCommit: fixture.sourceCommit,
  });
  assert.deepEqual(unrelated.findingCodes, ["OVERLAY_EVIDENCE_NOT_DESCENDANT"]);
});

test("runtime, workflow, and arbitrary documentation paths are outside the overlay", (t) => {
  const fixture = createRepository(t);
  write(fixture.rootDir, "server/index.js", "export const runtime = false;\n");
  write(fixture.rootDir, "docs/operations/LAUNCH_OPS_CHECKLIST.md", "weakened\n");
  const evidenceCommit = commitAll(fixture.rootDir, "unsafe paths");
  const result = validateProviderEvidenceOverlay({ ...fixture, evidenceCommit });
  assert.equal(result.ok, false);
  assert.deepEqual(result.findingCodes, ["OVERLAY_PATH_NOT_ALLOWED"]);
});

test("incident and recovery launch policy are immutable in the evidence overlay", async (t) => {
  await t.test("incident launch hold", () => {
    const fixture = createRepository(t);
    write(
      fixture.rootDir,
      "docs/operations/incident-routing.json",
      '{"launchHold":{"active":false},"version":4}\n',
    );
    const evidenceCommit = commitAll(fixture.rootDir, "clear launch hold");
    const result = validateProviderEvidenceOverlay({ ...fixture, evidenceCommit });

    assert.equal(result.ok, false);
    assert.ok(result.findingCodes.includes("OVERLAY_PATH_NOT_ALLOWED"));
    assert.deepEqual(result.report.changedPaths, [
      "docs/operations/incident-routing.json",
    ]);
  });

  await t.test("recovery targets", () => {
    const fixture = createRepository(t);
    write(
      fixture.rootDir,
      "docs/operations/recovery-policy.json",
      '{"targets":{"rpoMinutes":525600,"rtoMinutes":525600},"version":3}\n',
    );
    const evidenceCommit = commitAll(fixture.rootDir, "weaken recovery targets");
    const result = validateProviderEvidenceOverlay({ ...fixture, evidenceCommit });

    assert.equal(result.ok, false);
    assert.ok(result.findingCodes.includes("OVERLAY_PATH_NOT_ALLOWED"));
    assert.deepEqual(result.report.changedPaths, [
      "docs/operations/recovery-policy.json",
    ]);
  });
});

test("an intermediate forbidden change cannot be hidden by reverting it before evidence HEAD", (t) => {
  const fixture = createRepository(t);
  write(fixture.rootDir, "server/index.js", "export const runtime = false;\n");
  commitAll(fixture.rootDir, "temporarily change runtime");
  write(fixture.rootDir, "server/index.js", "export const runtime = true;\n");
  const evidenceCommit = commitAll(fixture.rootDir, "revert runtime before evidence HEAD");

  assert.equal(run(fixture.rootDir, [
    "diff",
    "--name-only",
    fixture.sourceCommit,
    evidenceCommit,
  ]), "");
  const result = validateProviderEvidenceOverlay({ ...fixture, evidenceCommit });
  assert.equal(result.ok, false);
  assert.ok(result.findingCodes.includes("OVERLAY_PATH_NOT_ALLOWED"));
});

test("evidence history must be one linear chain with no merge side history", (t) => {
  const fixture = createRepository(t);
  const originalBranch = run(fixture.rootDir, ["branch", "--show-current"]);
  run(fixture.rootDir, ["checkout", "-b", "evidence-side"]);
  write(fixture.rootDir, "docs/delivery/BUILD_STATE.md", "# Build state\n\nSide evidence.\n");
  commitAll(fixture.rootDir, "side evidence");

  run(fixture.rootDir, ["checkout", originalBranch]);
  write(
    fixture.rootDir,
    "docs/operations/payment-provider-readiness.json",
    `${JSON.stringify(disabledPaymentProviderConfig({ verifiedAt: "2026-08-02T12:00:00.000Z" }), null, 2)}\n`,
  );
  commitAll(fixture.rootDir, "main evidence");
  run(fixture.rootDir, ["merge", "--no-ff", "evidence-side", "-m", "merge evidence history"]);
  const evidenceCommit = run(fixture.rootDir, ["rev-parse", "HEAD"]);

  const result = validateProviderEvidenceOverlay({ ...fixture, evidenceCommit });
  assert.equal(result.ok, false);
  assert.ok(result.findingCodes.includes("OVERLAY_HISTORY_NOT_LINEAR"));
});

test("an evidence overlay can never enable ACH or weaken disabled setup-required state", async (t) => {
  const cases = [
    ["mode", { mode: "enabled" }],
    ["feature flag", { featureFlagVerifiedOff: false }],
    ["signed delivery", { signedDeliveryVerified: true }],
    ["runtime enabled", {
      verifiedProductionState: {
        configured: false,
        enabled: true,
        mode: "setup_required",
        webhookConfigured: true,
      },
    }],
    ["runtime configured", {
      verifiedProductionState: {
        configured: true,
        enabled: false,
        mode: "setup_required",
        webhookConfigured: true,
      },
    }],
    ["webhook missing", {
      verifiedProductionState: {
        configured: false,
        enabled: false,
        mode: "setup_required",
        webhookConfigured: false,
      },
    }],
    ["runtime mode", {
      verifiedProductionState: {
        configured: false,
        enabled: false,
        mode: "ready",
        webhookConfigured: true,
      },
    }],
  ];

  for (const [label, overrides] of cases) {
    await t.test(label, () => {
      const fixture = createRepository(t);
      write(
        fixture.rootDir,
        "docs/operations/payment-provider-readiness.json",
        `${JSON.stringify(disabledPaymentProviderConfig(overrides), null, 2)}\n`,
      );
      const evidenceCommit = commitAll(fixture.rootDir, `unsafe payment ${label}`);
      const result = validateProviderEvidenceOverlay({ ...fixture, evidenceCommit });
      assert.ok(result.findingCodes.includes("OVERLAY_PAYMENT_DISABLED_INVARIANT_FAILED"));
    });
  }
});

test("deletions and executable-mode changes are denied on otherwise allowlisted paths", async (t) => {
  await t.test("deletion", () => {
    const fixture = createRepository(t);
    fs.unlinkSync(path.join(fixture.rootDir, "docs", "operations", "incident-routing.json"));
    const evidenceCommit = commitAll(fixture.rootDir, "delete policy");
    const result = validateProviderEvidenceOverlay({ ...fixture, evidenceCommit });
    assert.ok(result.findingCodes.includes("OVERLAY_STATUS_NOT_ALLOWED"));
  });

  await t.test("executable mode", () => {
    const fixture = createRepository(t);
    run(fixture.rootDir, [
      "update-index",
      "--chmod=+x",
      "docs/operations/payment-provider-readiness.json",
    ]);
    const evidenceCommit = run(fixture.rootDir, ["commit", "-m", "unsafe mode"])
      && run(fixture.rootDir, ["rev-parse", "HEAD"]);
    const result = validateProviderEvidenceOverlay({ ...fixture, evidenceCommit });
    assert.ok(result.findingCodes.includes("OVERLAY_MODE_NOT_ALLOWED"));
  });
});

test("symlinks and submodules cannot masquerade as readiness documents", async (t) => {
  for (const [label, mode, blob] of [
    ["symlink", "120000", "../../server/index.js"],
    ["submodule", "160000", null],
  ]) {
    await t.test(label, () => {
      const fixture = createRepository(t);
      const oid = mode === "160000"
        ? fixture.sourceCommit
        : run(fixture.rootDir, ["hash-object", "-w", "--stdin"], { input: blob });
      run(fixture.rootDir, [
        "update-index",
        "--add",
        "--cacheinfo",
        `${mode},${oid},docs/operations/recovery-policy.json`,
      ]);
      run(fixture.rootDir, ["commit", "-m", `unsafe ${label}`]);
      const evidenceCommit = run(fixture.rootDir, ["rev-parse", "HEAD"]);
      const result = validateProviderEvidenceOverlay({ ...fixture, evidenceCommit });
      assert.equal(result.ok, false);
      assert.ok(
        result.findingCodes.includes("OVERLAY_STATUS_NOT_ALLOWED")
          || result.findingCodes.includes("OVERLAY_MODE_NOT_ALLOWED"),
      );
    });
  }
});

test("receipts are source-bound, JSON-only, size-bounded, and append-only", async (t) => {
  await t.test("wrong source directory", () => {
    const fixture = createRepository(t);
    const receipt = receiptFixture("b".repeat(40));
    write(fixture.rootDir, receipt.evidencePath, receipt.serialized);
    const evidenceCommit = commitAll(fixture.rootDir, "wrong source receipt");
    const result = validateProviderEvidenceOverlay({ ...fixture, evidenceCommit });
    assert.ok(result.findingCodes.includes("OVERLAY_PATH_NOT_ALLOWED"));
  });

  await t.test("invalid JSON", () => {
    const fixture = createRepository(t);
    const receipt = receiptFixture(fixture.sourceCommit);
    write(fixture.rootDir, receipt.evidencePath, "not-json\n");
    const evidenceCommit = commitAll(fixture.rootDir, "invalid receipt");
    const result = validateProviderEvidenceOverlay({ ...fixture, evidenceCommit });
    assert.ok(result.findingCodes.includes("OVERLAY_RECEIPT_JSON_INVALID"));
  });

  await t.test("oversized receipt", () => {
    const fixture = createRepository(t);
    const receipt = receiptFixture(fixture.sourceCommit);
    write(
      fixture.rootDir,
      receipt.evidencePath,
      JSON.stringify({ payload: "x".repeat(providerEvidenceOverlayContract.maximumReceiptBytes) }),
    );
    const evidenceCommit = commitAll(fixture.rootDir, "oversized receipt");
    const result = validateProviderEvidenceOverlay({ ...fixture, evidenceCommit });
    assert.ok(result.findingCodes.includes("OVERLAY_RECEIPT_SIZE_INVALID"));
  });

  await t.test("receipt rewritten later in the overlay history", () => {
    const fixture = createRepository(t);
    const receipt = receiptFixture(fixture.sourceCommit);
    write(fixture.rootDir, receipt.evidencePath, receipt.serialized);
    commitAll(fixture.rootDir, "add receipt");
    const rewrittenValue = { ...receipt.value, status: "rewritten" };
    const rewritten = `${JSON.stringify(rewrittenValue, null, 2)}\n`;
    write(fixture.rootDir, receipt.evidencePath, rewritten);
    const evidenceCommit = commitAll(fixture.rootDir, "rewrite receipt");
    const plan = {
      claims: [{
        ...receipt.claim,
        evidenceSha256: canonicalSha256(rewritten),
        expectedReceipt: rewrittenValue,
      }],
      schemaVersion: 1,
    };
    const result = validateProviderEvidenceOverlay({ ...fixture, evidenceCommit, plan });
    assert.ok(result.findingCodes.includes("OVERLAY_RECEIPT_NOT_APPEND_ONLY"));
  });
});

test("every new receipt is referenced exactly once with matching bytes and JSON", async (t) => {
  await t.test("unreferenced receipt", () => {
    const fixture = createValidOverlay(t);
    const result = validateProviderEvidenceOverlay({
      ...fixture,
      plan: {
        claims: [{
          ...fixture.receipt.claim,
          evidencePath: "docs/delivery/evidence/railway-stage1/historical.json",
        }],
        schemaVersion: 1,
      },
    });
    assert.ok(result.findingCodes.includes("OVERLAY_PLAN_RECEIPT_WRONG_SOURCE"));
    assert.ok(result.findingCodes.includes("OVERLAY_PLAN_RECEIPT_UNREFERENCED"));
  });

  await t.test("case-alias receipt path", () => {
    const fixture = createValidOverlay(t);
    const aliasedPath = fixture.receipt.evidencePath.replace(
      "synthetic-monitor.json",
      "Synthetic-Monitor.json",
    );
    const result = validateProviderEvidenceOverlay({
      ...fixture,
      plan: {
        claims: [{ ...fixture.receipt.claim, evidencePath: aliasedPath }],
        schemaVersion: 1,
      },
    });
    assert.ok(result.findingCodes.includes("OVERLAY_PLAN_RECEIPT_UNREFERENCED"));
    assert.ok(result.findingCodes.includes("OVERLAY_PLAN_RECEIPT_NOT_ADDED"));
  });

  await t.test("reused path", () => {
    const fixture = createValidOverlay(t);
    const result = validateProviderEvidenceOverlay({
      ...fixture,
      plan: {
        claims: [fixture.receipt.claim, { ...fixture.receipt.claim, controlId: "second" }],
        schemaVersion: 1,
      },
    });
    assert.ok(result.findingCodes.includes("OVERLAY_PLAN_EVIDENCE_PATH_REUSED"));
  });

  await t.test("digest and expected value mismatch", () => {
    const fixture = createValidOverlay(t);
    const result = validateProviderEvidenceOverlay({
      ...fixture,
      plan: {
        claims: [{
          ...fixture.receipt.claim,
          evidenceSha256: "0".repeat(64),
          expectedReceipt: { ...fixture.receipt.value, status: "failed" },
        }],
        schemaVersion: 1,
      },
    });
    assert.ok(result.findingCodes.includes("OVERLAY_PLAN_RECEIPT_DIGEST_MISMATCH"));
    assert.ok(result.findingCodes.includes("OVERLAY_PLAN_RECEIPT_VALUE_MISMATCH"));
  });
});

test("receipt count and aggregate blob limits fail closed", async (t) => {
  await t.test("receipt count", () => {
    const fixture = createRepository(t);
    for (let index = 0; index <= providerEvidenceOverlayContract.maximumReceiptCount; index += 1) {
      const receipt = receiptFixture(fixture.sourceCommit, `control-${index}`);
      write(fixture.rootDir, receipt.evidencePath, receipt.serialized);
    }
    const evidenceCommit = commitAll(fixture.rootDir, "too many receipts");
    const result = validateProviderEvidenceOverlay({ ...fixture, evidenceCommit });
    assert.ok(result.findingCodes.includes("OVERLAY_RECEIPT_COUNT_EXCEEDED"));
  });

  await t.test("aggregate blob bytes", () => {
    const fixture = createRepository(t);
    write(
      fixture.rootDir,
      "docs/delivery/BUILD_STATE.md",
      "x".repeat(providerEvidenceOverlayContract.maximumAggregateBlobBytes + 1),
    );
    const evidenceCommit = commitAll(fixture.rootDir, "oversized overlay");
    const result = validateProviderEvidenceOverlay({ ...fixture, evidenceCommit });
    assert.ok(result.findingCodes.includes("OVERLAY_AGGREGATE_SIZE_EXCEEDED"));
  });
});

test("the standalone CLI accepts only explicit source/evidence commits and an optional secret plan", () => {
  const commit = "a".repeat(40);
  assert.equal(
    parseProviderEvidenceOverlayArguments([]).reasonCode,
    "OVERLAY_ARGUMENT_REQUIRED",
  );
  assert.equal(parseProviderEvidenceOverlayArguments([
    "--source-commit", commit,
    "--evidence-commit", commit,
    "--json",
  ]).ok, true);
  assert.equal(parseProviderEvidenceOverlayArguments([
    "--source-commit", commit,
    "--evidence-commit", commit,
    "--plan", "secret",
  ]).reasonCode, "OVERLAY_ARGUMENT_UNKNOWN");
});
