import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import {
  validateProviderEvidenceOverlay,
  validateProviderEvidenceWorktree,
  validateProviderPolicyWorktree,
} from "./provider-evidence-overlay.js";
import {
  launchHoldConfigurationDigest,
} from "./readiness-configuration-digests.js";

const fullCommitPattern = /^[a-f0-9]{40}$/;
const sha256Pattern = /^[a-f0-9]{64}$/;
const blobOidPattern = /^[a-f0-9]{40,64}$/;
const roleIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;
const maximumChangedFileCount = 1;
const maximumHistoryCommitCount = 16;
const maximumManifestBytes = 64 * 1024;
const maximumEvidenceBindingCount = 64;
const maximumGitOutputBytes = 2 * 1024 * 1024;
const maximumPlanBytes = 32 * 1024;
const maximumPolicyBytes = 256 * 1024;
const policyPaths = Object.freeze({
  incidentConfig: "docs/operations/incident-routing.json",
  paymentProviderPolicy: "docs/operations/payment-provider-readiness.json",
  recoveryPolicy: "docs/operations/recovery-policy.json",
});

const planKeys = Object.freeze(["claims", "schemaVersion"]);
const claimKeys = Object.freeze([
  "adapterId",
  "controlId",
  "evidencePath",
  "evidenceSha256",
  "expectedReceipt",
  "provider",
  "scope",
  "type",
]);
const scopeKeys = Object.freeze(["account", "environment", "project", "resource"]);
const bindingKeys = Object.freeze([
  "adapterId",
  "controlId",
  "evidencePath",
  "evidenceSha256",
  "provider",
  "type",
]);
const approvalKeys = Object.freeze([
  "approvedAt",
  "approverRoleId",
  "configurationDigest",
  "status",
]);
const holdKeys = Object.freeze([
  "configurationDigest",
  "decidedAt",
  "decidedByRoleId",
  "incident",
  "reason",
  "status",
]);
const manifestKeys = Object.freeze([
  "approvals",
  "evidenceBindings",
  "evidenceCommit",
  "evidenceOverlayDigest",
  "evidencePlanDigest",
  "hold",
  "recordedAt",
  "schemaVersion",
  "sourceCommit",
  "sourcePolicyDigest",
]);

function uniqueSorted(values) {
  return [...new Set(values)].sort();
}

function plainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactKeys(value, expected) {
  if (!plainObject(value)) return false;
  const actual = Object.keys(value).sort();
  const required = [...expected].sort();
  return actual.length === required.length
    && actual.every((key, index) => key === required[index]);
}

function canonicalJsonValue(value, active = new Set()) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return Object.is(value, -0) ? 0 : value;
  if (typeof value !== "object") {
    throw new TypeError("Canonical JSON accepts only JSON-compatible values.");
  }
  if (active.has(value)) throw new TypeError("Canonical JSON cannot contain cycles.");
  active.add(value);
  try {
    if (Array.isArray(value)) {
      return value.map((entry) => canonicalJsonValue(entry, active));
    }
    if (!plainObject(value)) {
      throw new TypeError("Canonical JSON objects must have a plain prototype.");
    }
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => {
        if (value[key] === undefined) {
          throw new TypeError("Canonical JSON cannot contain undefined values.");
        }
        return [key, canonicalJsonValue(value[key], active)];
      }),
    );
  } finally {
    active.delete(value);
  }
}

function canonicalDigest(value) {
  return createHash("sha256")
    .update(JSON.stringify(canonicalJsonValue(value)))
    .digest("hex");
}

export function providerEvidencePlanDigest(plan) {
  return canonicalDigest(plan);
}

export function sourcePolicyBundleDigest({
  incidentConfig,
  paymentProviderPolicy,
  recoveryPolicy,
} = {}) {
  if (
    !plainObject(incidentConfig)
    || !plainObject(paymentProviderPolicy)
    || !plainObject(recoveryPolicy)
  ) {
    throw new TypeError("Source policy bundle requires incident, recovery, and payment policies.");
  }
  return canonicalDigest({
    incidentConfig,
    paymentProviderPolicy,
    recoveryPolicy,
    schemaVersion: 1,
  });
}

export function providerReadinessConfigurationDigest({
  incidentConfig,
  paymentProviderPolicy,
  recoveryPolicy,
}) {
  return launchHoldConfigurationDigest({
    incidentConfig,
    paymentProviderPolicy,
    recoveryPolicy,
  });
}

function safeRepositoryPath(value) {
  return typeof value === "string"
    && value.length > 0
    && value.length <= 512
    && !value.startsWith("/")
    && !value.includes("\\")
    && !/[\u0000-\u001f\u007f]/.test(value)
    && path.posix.normalize(value) === value
    && !value.split("/").includes("..");
}

export function approvalManifestPath(sourceCommit, evidenceCommit) {
  if (!fullCommitPattern.test(sourceCommit ?? "") || !fullCommitPattern.test(evidenceCommit ?? "")) {
    throw new TypeError("Approval manifest path requires each full lowercase Git commit SHA.");
  }
  return [
    "docs/delivery/evidence/railway-stage1/approval",
    sourceCommit,
    evidenceCommit,
    "launch-readiness.json",
  ].join("/");
}

function splitNul(buffer) {
  const values = [];
  let start = 0;
  for (let index = 0; index < buffer.length; index += 1) {
    if (buffer[index] !== 0) continue;
    values.push(buffer.subarray(start, index));
    start = index + 1;
  }
  if (start !== buffer.length) return null;
  return values;
}

function decodeUtf8(buffer) {
  const value = buffer.toString("utf8");
  return Buffer.from(value, "utf8").equals(buffer) ? value : null;
}

function defaultGitRunner(rootDir, args, { allowFailure = false } = {}) {
  const result = spawnSync("git", ["-C", rootDir, ...args], {
    encoding: null,
    maxBuffer: maximumGitOutputBytes,
    windowsHide: true,
  });
  const status = Number.isInteger(result.status) ? result.status : 1;
  if (!allowFailure && status !== 0) {
    return { ok: false, status, stdout: Buffer.alloc(0) };
  }
  return {
    ok: status === 0,
    status,
    stdout: Buffer.isBuffer(result.stdout) ? result.stdout : Buffer.alloc(0),
  };
}

function verifyCommit(rootDir, commit, gitRunner) {
  return gitRunner(rootDir, ["cat-file", "-e", `${commit}^{commit}`]).ok;
}

function validateRepositoryRoot(rootDir, findingCodes, code, gitRunner) {
  let canonicalRoot = null;
  try {
    const stat = fs.lstatSync(rootDir);
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
      findingCodes.push(code);
      return null;
    }
    canonicalRoot = fs.realpathSync(rootDir);
  } catch {
    findingCodes.push(code);
    return null;
  }
  const result = gitRunner(canonicalRoot, ["rev-parse", "--show-toplevel"]);
  const topLevel = result.ok ? decodeUtf8(result.stdout)?.trim() : null;
  try {
    if (!topLevel || fs.realpathSync(topLevel) !== canonicalRoot) {
      findingCodes.push(code);
      return null;
    }
  } catch {
    findingCodes.push(code);
    return null;
  }
  return canonicalRoot;
}

export function validateProviderApprovalWorktree({
  approvalCommit,
  approvalRoot,
  gitRunner = defaultGitRunner,
} = {}) {
  const findingCodes = [];
  const report = {
    approvalCommit: fullCommitPattern.test(approvalCommit ?? "") ? approvalCommit : null,
  };
  if (!fullCommitPattern.test(approvalCommit ?? "")) {
    findingCodes.push("APPROVAL_WORKTREE_COMMIT_INVALID");
  }
  const canonicalRoot = validateRepositoryRoot(
    approvalRoot,
    findingCodes,
    "APPROVAL_WORKTREE_INVALID",
    gitRunner,
  );
  if (canonicalRoot && fullCommitPattern.test(approvalCommit ?? "")) {
    const headResult = gitRunner(canonicalRoot, ["rev-parse", "HEAD"]);
    const statusResult = gitRunner(canonicalRoot, [
      "status",
      "--porcelain=v1",
      "-z",
      "--untracked-files=all",
    ]);
    const head = headResult.ok ? decodeUtf8(headResult.stdout)?.trim() : null;
    if (head !== approvalCommit) findingCodes.push("APPROVAL_WORKTREE_COMMIT_MISMATCH");
    if (!statusResult.ok || statusResult.stdout.length > 0) {
      findingCodes.push("APPROVAL_WORKTREE_DIRTY");
    }
  }
  return {
    findingCodes: uniqueSorted(findingCodes),
    ok: findingCodes.length === 0,
    report,
  };
}

function parseRawDiff(raw) {
  const tokens = splitNul(raw);
  if (!tokens || tokens.length % 2 !== 0) return null;
  const entries = [];
  for (let index = 0; index < tokens.length; index += 2) {
    const header = decodeUtf8(tokens[index]);
    const repositoryPath = decodeUtf8(tokens[index + 1]);
    const match = /^:(\d{6}) (\d{6}) ([a-f0-9]{40,64}) ([a-f0-9]{40,64}) ([A-Z][0-9]*)$/
      .exec(header ?? "");
    if (!match || repositoryPath === null) return null;
    entries.push({
      newMode: match[2],
      newOid: match[4],
      oldMode: match[1],
      oldOid: match[3],
      path: repositoryPath,
      status: match[5],
    });
  }
  return entries;
}

function validateHistory(rootDir, evidenceCommit, approvalCommit, manifestPath, gitRunner) {
  const findingCodes = [];
  const historyResult = gitRunner(rootDir, [
    "rev-list",
    "--reverse",
    "--topo-order",
    "--parents",
    `${evidenceCommit}..${approvalCommit}`,
  ]);
  const historyText = historyResult.ok ? decodeUtf8(historyResult.stdout) : null;
  if (historyText === null) {
    return {
      commitCount: 0,
      findingCodes: [historyResult.ok
        ? "APPROVAL_OVERLAY_HISTORY_INVALID"
        : "APPROVAL_OVERLAY_GIT_FAILURE"],
    };
  }
  const records = historyText.split(/\r?\n/).filter(Boolean).map((line) => line.split(" "));
  if (records.length === 0 || records.length > maximumHistoryCommitCount) {
    findingCodes.push(records.length === 0
      ? "APPROVAL_OVERLAY_HISTORY_INVALID"
      : "APPROVAL_OVERLAY_HISTORY_LIMIT_EXCEEDED");
  }
  let previousCommit = evidenceCommit;
  let manifestAddCount = 0;
  for (const record of records) {
    const [commit, ...parents] = record;
    if (
      !fullCommitPattern.test(commit ?? "")
      || parents.some((parent) => !fullCommitPattern.test(parent))
    ) {
      findingCodes.push("APPROVAL_OVERLAY_HISTORY_INVALID");
      continue;
    }
    if (parents.length !== 1 || parents[0] !== previousCommit) {
      findingCodes.push("APPROVAL_OVERLAY_HISTORY_NOT_LINEAR");
    }
    previousCommit = commit;
    for (const parent of parents) {
      const result = gitRunner(rootDir, [
        "diff",
        "--raw",
        "-z",
        "--no-renames",
        "--no-abbrev",
        parent,
        commit,
        "--",
      ]);
      const entries = result.ok ? parseRawDiff(result.stdout) : null;
      if (!entries) {
        findingCodes.push(result.ok
          ? "APPROVAL_OVERLAY_HISTORY_INVALID"
          : "APPROVAL_OVERLAY_GIT_FAILURE");
        continue;
      }
      for (const entry of entries) {
        if (!safeRepositoryPath(entry.path) || entry.path !== manifestPath) {
          findingCodes.push("APPROVAL_OVERLAY_PATH_NOT_ALLOWED");
        }
        if (entry.status !== "A") {
          findingCodes.push("APPROVAL_OVERLAY_STATUS_NOT_ALLOWED");
        } else if (entry.path === manifestPath) {
          manifestAddCount += 1;
        }
        if (entry.oldMode !== "000000" || entry.newMode !== "100644") {
          findingCodes.push("APPROVAL_OVERLAY_MODE_NOT_ALLOWED");
        }
      }
    }
  }
  if (records.at(-1)?.[0] !== approvalCommit) {
    findingCodes.push("APPROVAL_OVERLAY_HISTORY_INVALID");
  }
  if (manifestAddCount !== 1) {
    findingCodes.push("APPROVAL_OVERLAY_MANIFEST_ADD_COUNT_INVALID");
  }
  return { commitCount: records.length, findingCodes: uniqueSorted(findingCodes) };
}

function readBoundedBlob(rootDir, oid, gitRunner) {
  if (!blobOidPattern.test(oid)) return { code: "APPROVAL_MANIFEST_BLOB_INVALID" };
  const sizeResult = gitRunner(rootDir, ["cat-file", "-s", oid]);
  const sizeText = sizeResult.ok ? decodeUtf8(sizeResult.stdout)?.trim() : null;
  if (!/^(?:0|[1-9][0-9]*)$/.test(sizeText ?? "")) {
    return { code: "APPROVAL_MANIFEST_BLOB_INVALID" };
  }
  const size = Number(sizeText);
  if (!Number.isSafeInteger(size) || size === 0 || size > maximumManifestBytes) {
    return { code: "APPROVAL_MANIFEST_SIZE_INVALID" };
  }
  const bodyResult = gitRunner(rootDir, ["cat-file", "blob", oid]);
  if (!bodyResult.ok || bodyResult.stdout.length !== size) {
    return { code: "APPROVAL_MANIFEST_BLOB_INVALID" };
  }
  return { body: bodyResult.stdout, size };
}

function validText(value, maximumLength = 256) {
  return typeof value === "string"
    && value.length > 0
    && value.length <= maximumLength
    && value === value.trim()
    && !/[\u0000-\u001f\u007f]/.test(value);
}

function validApproval(value) {
  return exactKeys(value, approvalKeys)
    && value.status === "approved"
    && roleIdPattern.test(value.approverRoleId ?? "")
    && validText(value.approvedAt, 64)
    && sha256Pattern.test(value.configurationDigest ?? "");
}

function validBinding(value) {
  return exactKeys(value, bindingKeys)
    && validText(value.adapterId)
    && validText(value.controlId)
    && validText(value.provider)
    && validText(value.type)
    && safeRepositoryPath(value.evidencePath)
    && sha256Pattern.test(value.evidenceSha256 ?? "");
}

function validManifestSchema(manifest) {
  return exactKeys(manifest, manifestKeys)
    && manifest.schemaVersion === 1
    && fullCommitPattern.test(manifest.sourceCommit ?? "")
    && fullCommitPattern.test(manifest.evidenceCommit ?? "")
    && sha256Pattern.test(manifest.evidenceOverlayDigest ?? "")
    && sha256Pattern.test(manifest.evidencePlanDigest ?? "")
    && sha256Pattern.test(manifest.sourcePolicyDigest ?? "")
    && validText(manifest.recordedAt, 64)
    && Array.isArray(manifest.evidenceBindings)
    && manifest.evidenceBindings.length > 0
    && manifest.evidenceBindings.length <= maximumEvidenceBindingCount
    && manifest.evidenceBindings.every(validBinding)
    && exactKeys(manifest.approvals, ["incident", "payment", "recovery"])
    && exactKeys(manifest.approvals.incident, ["founder", "legalSafety", "support"])
    && Object.values(manifest.approvals.incident).every(validApproval)
    && exactKeys(manifest.approvals.recovery, ["founder", "operations"])
    && Object.values(manifest.approvals.recovery).every(validApproval)
    && validApproval(manifest.approvals.payment)
    && exactKeys(manifest.hold, holdKeys)
    && ["cleared", "retained"].includes(manifest.hold.status)
    && roleIdPattern.test(manifest.hold.decidedByRoleId ?? "")
    && validText(manifest.hold.decidedAt, 64)
    && safeRepositoryPath(manifest.hold.incident)
    && validText(manifest.hold.reason, 1_000)
    && sha256Pattern.test(manifest.hold.configurationDigest ?? "");
}

function sourceBoundEvidencePath(value, sourceCommit) {
  if (!safeRepositoryPath(value) || !fullCommitPattern.test(sourceCommit ?? "")) return false;
  const prefix = `docs/delivery/evidence/railway-stage1/provider/${sourceCommit}/`;
  if (!value.startsWith(prefix)) return false;
  const filename = value.slice(prefix.length);
  return filename.length > 5
    && filename.length <= 100
    && !filename.includes("/")
    && /^[A-Za-z0-9][A-Za-z0-9_-]*\.json$/.test(filename);
}

function validPlan(plan, sourceCommit) {
  const shapeValid = exactKeys(plan, planKeys)
    && plan.schemaVersion === 1
    && Array.isArray(plan.claims)
    && plan.claims.length > 0
    && plan.claims.length <= maximumEvidenceBindingCount
    && plan.claims.every((claim) => (
      exactKeys(claim, claimKeys)
      && validText(claim.adapterId)
      && validText(claim.controlId)
      && sourceBoundEvidencePath(claim.evidencePath, sourceCommit)
      && sha256Pattern.test(claim.evidenceSha256 ?? "")
      && plainObject(claim.expectedReceipt)
      && validText(claim.provider)
      && exactKeys(claim.scope, scopeKeys)
      && Object.values(claim.scope).every((value) => validText(value))
      && validText(claim.type)
    ));
  if (!shapeValid) return false;
  const controlIdentities = new Set();
  const evidencePaths = new Set();
  const evidenceDigests = new Set();
  for (const claim of plan.claims) {
    const controlIdentity = `${claim.controlId}\u0000${claim.type}`;
    const evidencePath = claim.evidencePath.toLowerCase();
    if (
      controlIdentities.has(controlIdentity)
      || evidencePaths.has(evidencePath)
      || evidenceDigests.has(claim.evidenceSha256)
    ) {
      return false;
    }
    controlIdentities.add(controlIdentity);
    evidencePaths.add(evidencePath);
    evidenceDigests.add(claim.evidenceSha256);
  }
  return true;
}

function canonicalEvidenceBindings(plan) {
  return plan.claims
    .map((claim) => Object.fromEntries(bindingKeys.map((key) => [key, claim[key]])))
    .sort((left, right) => (
      JSON.stringify(canonicalJsonValue(left)).localeCompare(
        JSON.stringify(canonicalJsonValue(right)),
      )
    ));
}

function sameCanonicalValue(left, right) {
  try {
    return JSON.stringify(canonicalJsonValue(left)) === JSON.stringify(canonicalJsonValue(right));
  } catch {
    return false;
  }
}

function timestampMillis(value) {
  const parsed = new Date(value ?? "").getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function validateManifestBindings({
  evidenceCommit,
  evidenceCommittedAt,
  evidenceOverlayDigest,
  incidentConfig,
  manifest,
  now,
  paymentProviderPolicy,
  plan,
  recoveryPolicy,
  sourceCommit,
}) {
  const findingCodes = [];
  if (manifest.sourceCommit !== sourceCommit) {
    findingCodes.push("APPROVAL_MANIFEST_SOURCE_MISMATCH");
  }
  if (manifest.evidenceCommit !== evidenceCommit) {
    findingCodes.push("APPROVAL_MANIFEST_EVIDENCE_MISMATCH");
  }
  if (manifest.evidenceOverlayDigest !== evidenceOverlayDigest) {
    findingCodes.push("APPROVAL_MANIFEST_OVERLAY_DIGEST_MISMATCH");
  }
  if (manifest.evidencePlanDigest !== providerEvidencePlanDigest(plan)) {
    findingCodes.push("APPROVAL_MANIFEST_PLAN_DIGEST_MISMATCH");
  }
  if (manifest.sourcePolicyDigest !== sourcePolicyBundleDigest({
    incidentConfig,
    paymentProviderPolicy,
    recoveryPolicy,
  })) {
    findingCodes.push("APPROVAL_MANIFEST_POLICY_DIGEST_MISMATCH");
  }
  if (!sameCanonicalValue(manifest.evidenceBindings, canonicalEvidenceBindings(plan))) {
    findingCodes.push("APPROVAL_MANIFEST_EVIDENCE_BINDINGS_MISMATCH");
  }
  if (manifest.hold.incident !== incidentConfig.launchHold?.incident) {
    findingCodes.push("APPROVAL_MANIFEST_HOLD_INCIDENT_MISMATCH");
  }

  const nowMillis = now.getTime();
  const nestedTimestamps = [
    ...Object.values(manifest.approvals.incident).map((approval) => approval.approvedAt),
    ...Object.values(manifest.approvals.recovery).map((approval) => approval.approvedAt),
    manifest.approvals.payment.approvedAt,
    manifest.hold.decidedAt,
  ];
  const nestedMillis = nestedTimestamps.map(timestampMillis);
  if (nestedMillis.some((value) => value === null || value > nowMillis)) {
    findingCodes.push("APPROVAL_MANIFEST_TIMESTAMP_INVALID");
  }
  if (nestedMillis.some((value) => value !== null && value <= evidenceCommittedAt)) {
    findingCodes.push("APPROVAL_MANIFEST_TIMESTAMP_STALE");
  }
  const recordedAt = timestampMillis(manifest.recordedAt);
  if (
    recordedAt === null
    || recordedAt > nowMillis
    || nestedMillis.some((value) => value !== null && recordedAt < value)
  ) {
    findingCodes.push("APPROVAL_MANIFEST_RECORDED_AT_INVALID");
  }
  return uniqueSorted(findingCodes);
}

function baseReport({ approvalCommit, evidenceCommit, sourceCommit }) {
  return {
    approvalCommit: fullCommitPattern.test(approvalCommit ?? "") ? approvalCommit : null,
    approvedRoles: [],
    evidenceBindingCount: 0,
    evidenceCommit: fullCommitPattern.test(evidenceCommit ?? "") ? evidenceCommit : null,
    evidenceOverlayDigest: null,
    evidencePlanDigest: null,
    historyCommitCount: 0,
    holdStatus: null,
    manifestPath: null,
    manifestSha256: null,
    recordedAt: null,
    sourceCommit: fullCommitPattern.test(sourceCommit ?? "") ? sourceCommit : null,
    sourcePolicyDigest: null,
  };
}

export function validateProviderApprovalOverlay({
  approvalCommit,
  evidenceCommit,
  evidenceOverlayDigest,
  gitRunner = defaultGitRunner,
  incidentConfig,
  now = new Date(),
  paymentProviderPolicy,
  plan,
  recoveryPolicy,
  rootDir = process.cwd(),
  sourceCommit,
} = {}) {
  const findingCodes = [];
  const report = baseReport({ approvalCommit, evidenceCommit, sourceCommit });
  if (!fullCommitPattern.test(sourceCommit ?? "")) {
    findingCodes.push("APPROVAL_OVERLAY_SOURCE_COMMIT_INVALID");
  }
  if (!fullCommitPattern.test(evidenceCommit ?? "")) {
    findingCodes.push("APPROVAL_OVERLAY_EVIDENCE_COMMIT_INVALID");
  }
  if (!fullCommitPattern.test(approvalCommit ?? "")) {
    findingCodes.push("APPROVAL_OVERLAY_APPROVAL_COMMIT_INVALID");
  }
  if (!sha256Pattern.test(evidenceOverlayDigest ?? "")) {
    findingCodes.push("APPROVAL_OVERLAY_EVIDENCE_DIGEST_INVALID");
  }
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
    findingCodes.push("APPROVAL_OVERLAY_NOW_INVALID");
  }
  if (!validPlan(plan, sourceCommit)) findingCodes.push("APPROVAL_OVERLAY_PLAN_INVALID");
  if (
    !plainObject(incidentConfig)
    || !plainObject(recoveryPolicy)
    || !plainObject(paymentProviderPolicy)
  ) {
    findingCodes.push("APPROVAL_OVERLAY_POLICY_INVALID");
  }
  if (findingCodes.length > 0) {
    return { findingCodes: uniqueSorted(findingCodes), manifest: null, ok: false, report };
  }

  const canonicalRoot = validateRepositoryRoot(
    rootDir,
    findingCodes,
    "APPROVAL_OVERLAY_REPOSITORY_INVALID",
    gitRunner,
  );
  if (!canonicalRoot) {
    return { findingCodes: uniqueSorted(findingCodes), manifest: null, ok: false, report };
  }
  for (const [commit, code] of [
    [sourceCommit, "APPROVAL_OVERLAY_SOURCE_COMMIT_NOT_FOUND"],
    [evidenceCommit, "APPROVAL_OVERLAY_EVIDENCE_COMMIT_NOT_FOUND"],
    [approvalCommit, "APPROVAL_OVERLAY_APPROVAL_COMMIT_NOT_FOUND"],
  ]) {
    if (!verifyCommit(canonicalRoot, commit, gitRunner)) findingCodes.push(code);
  }
  if (findingCodes.length > 0) {
    return { findingCodes: uniqueSorted(findingCodes), manifest: null, ok: false, report };
  }

  const sourceAncestry = gitRunner(
    canonicalRoot,
    ["merge-base", "--is-ancestor", sourceCommit, evidenceCommit],
    { allowFailure: true },
  );
  if (!sourceAncestry.ok) {
    findingCodes.push(sourceAncestry.status === 1
      ? "APPROVAL_OVERLAY_EVIDENCE_NOT_DESCENDANT"
      : "APPROVAL_OVERLAY_GIT_FAILURE");
  }
  const approvalAncestry = gitRunner(
    canonicalRoot,
    ["merge-base", "--is-ancestor", evidenceCommit, approvalCommit],
    { allowFailure: true },
  );
  if (!approvalAncestry.ok) {
    findingCodes.push(approvalAncestry.status === 1
      ? "APPROVAL_OVERLAY_NOT_DESCENDANT"
      : "APPROVAL_OVERLAY_GIT_FAILURE");
  }
  if (findingCodes.length > 0) {
    return { findingCodes: uniqueSorted(findingCodes), manifest: null, ok: false, report };
  }

  const manifestPath = approvalManifestPath(sourceCommit, evidenceCommit);
  report.manifestPath = manifestPath;
  const history = validateHistory(
    canonicalRoot,
    evidenceCommit,
    approvalCommit,
    manifestPath,
    gitRunner,
  );
  report.historyCommitCount = history.commitCount;
  findingCodes.push(...history.findingCodes);

  const timestampResult = gitRunner(canonicalRoot, [
    "show",
    "-s",
    "--format=%cI",
    evidenceCommit,
  ]);
  const evidenceCommittedAt = timestampResult.ok
    ? timestampMillis(decodeUtf8(timestampResult.stdout)?.trim())
    : null;
  if (evidenceCommittedAt === null) {
    findingCodes.push("APPROVAL_OVERLAY_EVIDENCE_TIMESTAMP_INVALID");
  }

  const diffResult = gitRunner(canonicalRoot, [
    "diff",
    "--raw",
    "-z",
    "--no-renames",
    "--no-abbrev",
    evidenceCommit,
    approvalCommit,
    "--",
  ]);
  const entries = diffResult.ok ? parseRawDiff(diffResult.stdout) : null;
  if (!entries) {
    findingCodes.push(diffResult.ok
      ? "APPROVAL_OVERLAY_DIFF_INVALID"
      : "APPROVAL_OVERLAY_GIT_FAILURE");
    return { findingCodes: uniqueSorted(findingCodes), manifest: null, ok: false, report };
  }
  if (entries.length !== maximumChangedFileCount) {
    findingCodes.push("APPROVAL_OVERLAY_CHANGE_COUNT_INVALID");
  }
  for (const entry of entries) {
    if (!safeRepositoryPath(entry.path) || entry.path !== manifestPath) {
      findingCodes.push("APPROVAL_OVERLAY_PATH_NOT_ALLOWED");
    }
    if (entry.status !== "A") findingCodes.push("APPROVAL_OVERLAY_STATUS_NOT_ALLOWED");
    if (entry.oldMode !== "000000" || entry.newMode !== "100644") {
      findingCodes.push("APPROVAL_OVERLAY_MODE_NOT_ALLOWED");
    }
  }

  const manifestEntry = entries.length === 1
    && entries[0].path === manifestPath
    && entries[0].status === "A"
    && entries[0].oldMode === "000000"
    && entries[0].newMode === "100644"
    ? entries[0]
    : null;
  if (!manifestEntry) {
    return { findingCodes: uniqueSorted(findingCodes), manifest: null, ok: false, report };
  }
  const blob = readBoundedBlob(canonicalRoot, manifestEntry.newOid, gitRunner);
  if (blob.code) {
    findingCodes.push(blob.code);
    return { findingCodes: uniqueSorted(findingCodes), manifest: null, ok: false, report };
  }
  const text = decodeUtf8(blob.body);
  let manifest;
  try {
    manifest = text === null ? null : JSON.parse(text);
  } catch {
    manifest = null;
  }
  if (!plainObject(manifest)) {
    findingCodes.push("APPROVAL_MANIFEST_JSON_INVALID");
    return { findingCodes: uniqueSorted(findingCodes), manifest: null, ok: false, report };
  }
  report.manifestSha256 = createHash("sha256")
    .update(blob.body.toString("utf8").replace(/\r\n?/g, "\n"))
    .digest("hex");
  if (!validManifestSchema(manifest)) {
    findingCodes.push("APPROVAL_MANIFEST_SCHEMA_INVALID");
    return { findingCodes: uniqueSorted(findingCodes), manifest, ok: false, report };
  }

  if (evidenceCommittedAt !== null) findingCodes.push(...validateManifestBindings({
    evidenceCommit,
    evidenceCommittedAt,
    evidenceOverlayDigest,
    incidentConfig,
    manifest,
    now,
    paymentProviderPolicy,
    plan,
    recoveryPolicy,
    sourceCommit,
  }));
  report.approvedRoles = [
    "incident:founder",
    "incident:legalSafety",
    "incident:support",
    "payment",
    "recovery:founder",
    "recovery:operations",
  ];
  report.evidenceBindingCount = manifest.evidenceBindings.length;
  report.evidenceOverlayDigest = manifest.evidenceOverlayDigest;
  report.evidencePlanDigest = manifest.evidencePlanDigest;
  report.holdStatus = manifest.hold.status;
  report.recordedAt = manifest.recordedAt;
  report.sourcePolicyDigest = manifest.sourcePolicyDigest;
  return {
    findingCodes: uniqueSorted(findingCodes),
    manifest,
    ok: findingCodes.length === 0,
    report,
  };
}

export function parseProviderApprovalOverlayArguments(argv) {
  const valueFlags = new Set([
    "--approval-commit",
    "--approval-root",
    "--evidence-commit",
    "--evidence-root",
    "--policy-root",
    "--source-commit",
  ]);
  const booleanFlags = new Set(["--json"]);
  const values = new Map();
  const flags = new Set();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (booleanFlags.has(token)) {
      if (flags.has(token)) {
        return { ok: false, reasonCode: "APPROVAL_ARGUMENT_DUPLICATE" };
      }
      flags.add(token);
      continue;
    }
    if (!valueFlags.has(token) || values.has(token)) {
      return {
        ok: false,
        reasonCode: values.has(token)
          ? "APPROVAL_ARGUMENT_DUPLICATE"
          : "APPROVAL_ARGUMENT_UNKNOWN",
      };
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      return { ok: false, reasonCode: "APPROVAL_ARGUMENT_VALUE_MISSING" };
    }
    values.set(token, value);
    index += 1;
  }
  for (const required of valueFlags) {
    if (!values.has(required)) {
      return { ok: false, reasonCode: "APPROVAL_ARGUMENT_REQUIRED" };
    }
  }
  return { flags, ok: true, values };
}

function parsePlanEnvironment(environment) {
  const serialized = environment?.RIVT_PROVIDER_EVIDENCE_PLAN_JSON;
  if (typeof serialized !== "string" || serialized.length === 0) {
    return { ok: false, reasonCode: "APPROVAL_PLAN_SECRET_REQUIRED" };
  }
  if (Buffer.byteLength(serialized, "utf8") > maximumPlanBytes) {
    return { ok: false, reasonCode: "APPROVAL_PLAN_SECRET_TOO_LARGE" };
  }
  try {
    const plan = JSON.parse(serialized);
    return plainObject(plan)
      ? { ok: true, plan }
      : { ok: false, reasonCode: "APPROVAL_PLAN_SECRET_INVALID" };
  } catch {
    return { ok: false, reasonCode: "APPROVAL_PLAN_SECRET_INVALID" };
  }
}

function readBoundedPolicy(policyRoot, repositoryPath) {
  const canonicalRoot = fs.realpathSync(policyRoot);
  const absolutePath = path.resolve(canonicalRoot, ...repositoryPath.split("/"));
  const relative = path.relative(canonicalRoot, absolutePath);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Policy path escaped its pinned root.");
  }
  const stat = fs.lstatSync(absolutePath);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size === 0 || stat.size > maximumPolicyBytes) {
    throw new Error("Policy file was not a bounded regular file.");
  }
  const canonicalPath = fs.realpathSync(absolutePath);
  const canonicalRelative = path.relative(canonicalRoot, canonicalPath);
  if (!canonicalRelative || canonicalRelative.startsWith("..") || path.isAbsolute(canonicalRelative)) {
    throw new Error("Policy file resolved outside its pinned root.");
  }
  const value = JSON.parse(fs.readFileSync(canonicalPath, "utf8"));
  if (!plainObject(value)) throw new Error("Policy file did not contain a JSON object.");
  return value;
}

function readPolicyBundle(policyRoot) {
  return Object.fromEntries(
    Object.entries(policyPaths).map(([key, repositoryPath]) => [
      key,
      readBoundedPolicy(policyRoot, repositoryPath),
    ]),
  );
}

function safeCliReport({ approvalResult, evidenceResult, revisions }) {
  return {
    approval: approvalResult?.report ?? null,
    evidence: evidenceResult?.report ? {
      addedReceiptPaths: evidenceResult.report.addedReceiptPaths,
      changedPaths: evidenceResult.report.changedPaths,
      evidenceCommit: evidenceResult.report.evidenceCommit,
      historyCommitCount: evidenceResult.report.historyCommitCount,
      overlayDigest: evidenceResult.report.overlayDigest,
      planValidated: evidenceResult.report.planValidated,
      sourceCommit: evidenceResult.report.sourceCommit,
    } : null,
    revisions,
  };
}

function emitCliResult({ findingCodes, report }) {
  const result = {
    findingCodes: uniqueSorted(findingCodes),
    report,
    status: findingCodes.length === 0 ? "verified" : "blocked",
  };
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = findingCodes.length === 0 ? 0 : 1;
}

export async function main(
  argv = process.argv.slice(2),
  { environment = process.env } = {},
) {
  const parsed = parseProviderApprovalOverlayArguments(argv);
  if (!parsed.ok) {
    emitCliResult({ findingCodes: [parsed.reasonCode], report: null });
    return;
  }
  const parsedPlan = parsePlanEnvironment(environment);
  if (!parsedPlan.ok) {
    emitCliResult({ findingCodes: [parsedPlan.reasonCode], report: null });
    return;
  }

  const revisions = {
    approvalCommit: parsed.values.get("--approval-commit"),
    evidenceCommit: parsed.values.get("--evidence-commit"),
    sourceCommit: parsed.values.get("--source-commit"),
  };
  const approvalRoot = parsed.values.get("--approval-root");
  const evidenceRoot = parsed.values.get("--evidence-root");
  const policyRoot = parsed.values.get("--policy-root");
  const approvalWorktree = validateProviderApprovalWorktree({
    approvalCommit: revisions.approvalCommit,
    approvalRoot,
  });
  const evidenceWorktree = validateProviderEvidenceWorktree({
    evidenceCommit: revisions.evidenceCommit,
    evidenceRoot,
  });
  const policyWorktree = validateProviderPolicyWorktree({
    policyRoot,
    sourceCommit: revisions.sourceCommit,
  });
  const worktreeFindings = uniqueSorted([
    ...approvalWorktree.findingCodes,
    ...evidenceWorktree.findingCodes,
    ...policyWorktree.findingCodes,
  ]);
  if (worktreeFindings.length > 0) {
    emitCliResult({
      findingCodes: worktreeFindings,
      report: safeCliReport({ approvalResult: null, evidenceResult: null, revisions }),
    });
    return;
  }

  let policies;
  try {
    policies = readPolicyBundle(policyRoot);
  } catch {
    emitCliResult({
      findingCodes: ["APPROVAL_POLICY_READ_FAILED"],
      report: safeCliReport({ approvalResult: null, evidenceResult: null, revisions }),
    });
    return;
  }
  const evidenceResult = validateProviderEvidenceOverlay({
    evidenceCommit: revisions.evidenceCommit,
    plan: parsedPlan.plan,
    rootDir: evidenceRoot,
    sourceCommit: revisions.sourceCommit,
  });
  if (!evidenceResult.ok) {
    emitCliResult({
      findingCodes: evidenceResult.findingCodes,
      report: safeCliReport({ approvalResult: null, evidenceResult, revisions }),
    });
    return;
  }
  const approvalResult = validateProviderApprovalOverlay({
    approvalCommit: revisions.approvalCommit,
    evidenceCommit: revisions.evidenceCommit,
    evidenceOverlayDigest: evidenceResult.report.overlayDigest,
    plan: parsedPlan.plan,
    rootDir: approvalRoot,
    sourceCommit: revisions.sourceCommit,
    ...policies,
  });
  emitCliResult({
    findingCodes: approvalResult.findingCodes,
    report: safeCliReport({ approvalResult, evidenceResult, revisions }),
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}

export const providerApprovalOverlayContract = Object.freeze({
  approvalKeys,
  bindingKeys,
  holdKeys,
  manifestKeys,
  maximumChangedFileCount,
  maximumEvidenceBindingCount,
  maximumHistoryCommitCount,
  maximumManifestBytes,
  maximumPlanBytes,
  maximumPolicyBytes,
});
