import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const fullCommitPattern = /^[a-f0-9]{40}$/;
const blobOidPattern = /^[a-f0-9]{40,64}$/;
const safeReceiptNamePattern = /^[A-Za-z0-9](?:[A-Za-z0-9_-]{0,94}[A-Za-z0-9])?\.json$/;
const maximumChangedFileCount = 80;
const maximumHistoryCommitCount = 128;
const maximumReceiptCount = 64;
const maximumReceiptBytes = 64 * 1024;
const maximumAggregateBlobBytes = 4 * 1024 * 1024;
const maximumGitOutputBytes = 8 * 1024 * 1024;
const paymentProviderReadinessPath = "docs/operations/payment-provider-readiness.json";

const allowedModifiedPaths = new Set([
  "docs/delivery/BUILD_STATE.md",
  "docs/delivery/DEPLOYMENT_LEDGER.md",
  "docs/delivery/RISKS.md",
  "docs/delivery/packets/87_MONEY_INTEGRITY_CONTAINMENT.md",
  "docs/operations/incident-routing.json",
  "docs/operations/incidents/2026-07-29-production-credential-exposure.md",
  "docs/operations/payment-provider-readiness.json",
  "docs/operations/recovery-policy.json",
  "docs/product/REQUIREMENTS_TRACEABILITY.md",
]);

function uniqueSorted(values) {
  return [...new Set(values)].sort();
}

function plainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function canonicalJsonValue(value) {
  if (Array.isArray(value)) return value.map((entry) => canonicalJsonValue(entry));
  if (plainObject(value)) {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonicalJsonValue(value[key])]),
    );
  }
  return value;
}

function canonicalEvidenceSha256(value) {
  const text = Buffer.isBuffer(value) ? value.toString("utf8") : String(value);
  return createHash("sha256")
    .update(text.replace(/\r\n?/g, "\n"))
    .digest("hex");
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

function receiptPrefix(sourceCommit) {
  return `docs/delivery/evidence/railway-stage1/provider/${sourceCommit}/`;
}

function isSourceBoundReceiptPath(value, sourceCommit) {
  if (!safeRepositoryPath(value)) return false;
  const prefix = receiptPrefix(sourceCommit);
  if (!value.startsWith(prefix)) return false;
  const filename = value.slice(prefix.length);
  return !filename.includes("/") && safeReceiptNamePattern.test(filename);
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

export function validateProviderEvidenceWorktree({
  evidenceCommit,
  evidenceRoot,
  gitRunner = defaultGitRunner,
} = {}) {
  const findingCodes = [];
  let canonicalRoot = null;
  if (!fullCommitPattern.test(evidenceCommit ?? "")) {
    findingCodes.push("EVIDENCE_WORKTREE_COMMIT_INVALID");
  }
  try {
    const rootStat = fs.lstatSync(evidenceRoot);
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
      findingCodes.push("EVIDENCE_WORKTREE_INVALID");
    } else {
      canonicalRoot = fs.realpathSync(evidenceRoot);
    }
  } catch {
    findingCodes.push("EVIDENCE_WORKTREE_INVALID");
  }
  if (findingCodes.length === 0) {
    const topLevelResult = gitRunner(canonicalRoot, ["rev-parse", "--show-toplevel"]);
    const headResult = gitRunner(canonicalRoot, ["rev-parse", "HEAD"]);
    const statusResult = gitRunner(canonicalRoot, [
      "status",
      "--porcelain=v1",
      "-z",
      "--untracked-files=all",
    ]);
    const topLevel = topLevelResult.ok ? decodeUtf8(topLevelResult.stdout)?.trim() : null;
    const head = headResult.ok ? decodeUtf8(headResult.stdout)?.trim() : null;
    try {
      if (!topLevel || fs.realpathSync(topLevel) !== canonicalRoot) {
        findingCodes.push("EVIDENCE_WORKTREE_INVALID");
      }
    } catch {
      findingCodes.push("EVIDENCE_WORKTREE_INVALID");
    }
    if (head !== evidenceCommit) findingCodes.push("EVIDENCE_WORKTREE_COMMIT_MISMATCH");
    if (!statusResult.ok || statusResult.stdout.length > 0) {
      findingCodes.push("EVIDENCE_WORKTREE_DIRTY");
    }
  }
  return {
    ok: findingCodes.length === 0,
    findingCodes: uniqueSorted(findingCodes),
    report: {
      evidenceCommit: fullCommitPattern.test(evidenceCommit ?? "") ? evidenceCommit : null,
      evidenceRoot: canonicalRoot,
    },
  };
}

function verifyCommit(rootDir, commit, gitRunner) {
  return gitRunner(rootDir, ["cat-file", "-e", `${commit}^{commit}`]).ok;
}

function parseRawDiff(raw) {
  const tokens = splitNul(raw);
  if (!tokens) return null;
  if (tokens.length % 2 !== 0) return null;
  const entries = [];
  for (let index = 0; index < tokens.length; index += 2) {
    const header = decodeUtf8(tokens[index]);
    const repositoryPath = decodeUtf8(tokens[index + 1]);
    const match = /^:(\d{6}) (\d{6}) ([a-f0-9]{40,64}) ([a-f0-9]{40,64}) ([A-Z][0-9]*)$/.exec(
      header ?? "",
    );
    if (!match || repositoryPath === null) return null;
    entries.push({
      oldMode: match[1],
      newMode: match[2],
      oldOid: match[3],
      newOid: match[4],
      status: match[5],
      path: repositoryPath,
    });
  }
  return entries;
}

function overlayEntryPolicyFindings(entry, sourceCommit) {
  const findingCodes = [];
  if (!safeRepositoryPath(entry.path)) {
    findingCodes.push("OVERLAY_PATH_INVALID");
    return findingCodes;
  }
  const allowedModified = entry.status === "M"
    && allowedModifiedPaths.has(entry.path);
  const allowedReceipt = entry.status === "A"
    && isSourceBoundReceiptPath(entry.path, sourceCommit);
  if (!allowedModified && !allowedReceipt) {
    findingCodes.push(
      ["A", "M"].includes(entry.status)
        ? "OVERLAY_PATH_NOT_ALLOWED"
        : "OVERLAY_STATUS_NOT_ALLOWED",
    );
    return findingCodes;
  }
  if (
    (entry.status === "M" && (entry.oldMode !== "100644" || entry.newMode !== "100644"))
    || (entry.status === "A" && (entry.oldMode !== "000000" || entry.newMode !== "100644"))
  ) {
    findingCodes.push("OVERLAY_MODE_NOT_ALLOWED");
  }
  return findingCodes;
}

function validateOverlayHistory(rootDir, sourceCommit, evidenceCommit, gitRunner) {
  const findingCodes = [];
  const historyResult = gitRunner(rootDir, [
    "rev-list",
    "--reverse",
    "--topo-order",
    "--parents",
    `${sourceCommit}..${evidenceCommit}`,
  ]);
  const historyText = historyResult.ok ? decodeUtf8(historyResult.stdout) : null;
  if (historyText === null) {
    return {
      commitCount: 0,
      findingCodes: [historyResult.ok ? "OVERLAY_HISTORY_INVALID" : "OVERLAY_GIT_FAILURE"],
    };
  }
  const records = historyText.split(/\r?\n/).filter(Boolean).map((line) => line.split(" "));
  if (
    records.some((record) => record.length < 2 || record.some((value) => !fullCommitPattern.test(value)))
  ) {
    return { commitCount: records.length, findingCodes: ["OVERLAY_HISTORY_INVALID"] };
  }
  if (records.length > maximumHistoryCommitCount) {
    findingCodes.push("OVERLAY_HISTORY_COMMIT_LIMIT_EXCEEDED");
  }

  let previousCommit = sourceCommit;
  const touchedPaths = new Set();
  for (const [commit, ...parents] of records) {
    if (parents.length !== 1 || parents[0] !== previousCommit) {
      findingCodes.push("OVERLAY_HISTORY_NOT_LINEAR");
    }
    previousCommit = commit;
    for (const parent of parents) {
      const diffResult = gitRunner(rootDir, [
        "diff",
        "--raw",
        "-z",
        "--no-renames",
        "--no-abbrev",
        parent,
        commit,
        "--",
      ]);
      const entries = diffResult.ok ? parseRawDiff(diffResult.stdout) : null;
      if (!entries) {
        findingCodes.push(diffResult.ok ? "OVERLAY_HISTORY_INVALID" : "OVERLAY_GIT_FAILURE");
        continue;
      }
      for (const entry of entries) {
        if (safeRepositoryPath(entry.path)) touchedPaths.add(entry.path.toLowerCase());
        findingCodes.push(...overlayEntryPolicyFindings(entry, sourceCommit));
      }
    }
  }
  if (
    (sourceCommit !== evidenceCommit && records.at(-1)?.[0] !== evidenceCommit)
    || (sourceCommit === evidenceCommit && records.length !== 0)
  ) {
    findingCodes.push("OVERLAY_HISTORY_INVALID");
  }
  if (touchedPaths.size > maximumChangedFileCount) {
    findingCodes.push("OVERLAY_CHANGED_FILE_LIMIT_EXCEEDED");
  }
  return {
    commitCount: records.length,
    findingCodes: uniqueSorted(findingCodes),
  };
}

function readBlob(rootDir, oid, gitRunner) {
  if (!blobOidPattern.test(oid)) return null;
  const sizeResult = gitRunner(rootDir, ["cat-file", "-s", oid]);
  if (!sizeResult.ok) return null;
  const sizeText = decodeUtf8(sizeResult.stdout)?.trim();
  if (!/^(?:0|[1-9][0-9]*)$/.test(sizeText ?? "")) return null;
  const size = Number(sizeText);
  if (!Number.isSafeInteger(size)) return null;
  const bodyResult = gitRunner(rootDir, ["cat-file", "blob", oid]);
  if (!bodyResult.ok || bodyResult.stdout.length !== size) return null;
  return { body: bodyResult.stdout, size };
}

function readTreeFile(rootDir, commit, repositoryPath, gitRunner) {
  const objectSpec = `${commit}:${repositoryPath}`;
  const sizeResult = gitRunner(rootDir, ["cat-file", "-s", objectSpec]);
  if (!sizeResult.ok) return null;
  const sizeText = decodeUtf8(sizeResult.stdout)?.trim();
  if (!/^(?:0|[1-9][0-9]*)$/.test(sizeText ?? "")) return null;
  const size = Number(sizeText);
  if (!Number.isSafeInteger(size) || size > maximumReceiptBytes) return null;
  const bodyResult = gitRunner(rootDir, ["cat-file", "blob", objectSpec]);
  if (!bodyResult.ok || bodyResult.stdout.length !== size) return null;
  return bodyResult.stdout;
}

function paymentProviderRemainsDisabled(rootDir, evidenceCommit, gitRunner) {
  const raw = readTreeFile(
    rootDir,
    evidenceCommit,
    paymentProviderReadinessPath,
    gitRunner,
  );
  const text = raw ? decodeUtf8(raw) : null;
  let value;
  try {
    value = text === null ? null : JSON.parse(text);
  } catch {
    value = null;
  }
  return plainObject(value)
    && value.mode === "disabled"
    && value.featureFlagVerifiedOff === true
    && value.signedDeliveryVerified === false
    && plainObject(value.verifiedProductionState)
    && value.verifiedProductionState.enabled === false
    && value.verifiedProductionState.configured === false
    && value.verifiedProductionState.webhookConfigured === true
    && value.verifiedProductionState.mode === "setup_required";
}

function receiptHistoryIsAppendOnly(rootDir, sourceCommit, evidenceCommit, receiptPath, gitRunner) {
  const result = gitRunner(rootDir, [
    "log",
    "--format=%H",
    "--no-renames",
    `${sourceCommit}..${evidenceCommit}`,
    "--",
    receiptPath,
  ]);
  if (!result.ok) return false;
  const text = decodeUtf8(result.stdout);
  if (text === null) return false;
  const commits = text.split(/\r?\n/).filter(Boolean);
  return commits.length === 1 && fullCommitPattern.test(commits[0]);
}

function validatePlanReferences(plan, receipts, sourceCommit) {
  if (plan === undefined || plan === null) {
    return { findingCodes: [], planValidated: false };
  }
  if (
    !plainObject(plan)
    || !Array.isArray(plan.claims)
    || plan.claims.length === 0
    || plan.claims.length > maximumReceiptCount
  ) {
    return { findingCodes: ["OVERLAY_PLAN_INVALID"], planValidated: false };
  }

  const findingCodes = [];
  const pathCounts = new Map();
  const claimsByPath = new Map();
  for (const claim of plan.claims) {
    if (!plainObject(claim) || !safeRepositoryPath(claim.evidencePath)) {
      findingCodes.push("OVERLAY_PLAN_INVALID");
      continue;
    }
    const normalized = claim.evidencePath.toLowerCase();
    pathCounts.set(normalized, (pathCounts.get(normalized) ?? 0) + 1);
    claimsByPath.set(claim.evidencePath, claim);
    if (!isSourceBoundReceiptPath(claim.evidencePath, sourceCommit)) {
      findingCodes.push("OVERLAY_PLAN_RECEIPT_WRONG_SOURCE");
    }
  }
  if ([...pathCounts.values()].some((count) => count !== 1)) {
    findingCodes.push("OVERLAY_PLAN_EVIDENCE_PATH_REUSED");
  }

  for (const receipt of receipts) {
    const claim = claimsByPath.get(receipt.path);
    if (!claim) {
      findingCodes.push("OVERLAY_PLAN_RECEIPT_UNREFERENCED");
      continue;
    }
    if (
      typeof claim.evidenceSha256 !== "string"
      || !/^[a-f0-9]{64}$/.test(claim.evidenceSha256)
      || claim.evidenceSha256 !== receipt.canonicalSha256
    ) {
      findingCodes.push("OVERLAY_PLAN_RECEIPT_DIGEST_MISMATCH");
    }
    if (
      !plainObject(claim.expectedReceipt)
      || JSON.stringify(canonicalJsonValue(claim.expectedReceipt))
        !== JSON.stringify(canonicalJsonValue(receipt.value))
    ) {
      findingCodes.push("OVERLAY_PLAN_RECEIPT_VALUE_MISMATCH");
    }
  }

  for (const claim of claimsByPath.values()) {
    if (
      isSourceBoundReceiptPath(claim.evidencePath, sourceCommit)
      && !receipts.some((receipt) => receipt.path === claim.evidencePath)
    ) {
      findingCodes.push("OVERLAY_PLAN_RECEIPT_NOT_ADDED");
    }
  }
  return {
    findingCodes: uniqueSorted(findingCodes),
    planValidated: findingCodes.length === 0,
  };
}

function overlayDigest(sourceCommit, evidenceCommit, entries) {
  const canonical = entries
    .map((entry) => ({
      newMode: entry.newMode,
      newOid: entry.newOid,
      oldMode: entry.oldMode,
      oldOid: entry.oldOid,
      path: entry.path,
      status: entry.status,
    }))
    .sort((left, right) => left.path.localeCompare(right.path));
  return createHash("sha256").update(JSON.stringify({
    evidenceCommit,
    entries: canonical,
    schemaVersion: 1,
    sourceCommit,
  })).digest("hex");
}

export function validateProviderEvidenceOverlay({
  evidenceCommit,
  gitRunner = defaultGitRunner,
  plan,
  rootDir = process.cwd(),
  sourceCommit,
} = {}) {
  const findingCodes = [];
  const baseReport = {
    addedReceiptPaths: [],
    changedPaths: [],
    evidenceCommit: fullCommitPattern.test(evidenceCommit ?? "") ? evidenceCommit : null,
    historyCommitCount: 0,
    overlayDigest: null,
    planValidated: false,
    sourceCommit: fullCommitPattern.test(sourceCommit ?? "") ? sourceCommit : null,
  };
  if (!fullCommitPattern.test(sourceCommit ?? "")) {
    findingCodes.push("OVERLAY_SOURCE_COMMIT_INVALID");
  }
  if (!fullCommitPattern.test(evidenceCommit ?? "")) {
    findingCodes.push("OVERLAY_EVIDENCE_COMMIT_INVALID");
  }
  if (findingCodes.length > 0) {
    return { ok: false, findingCodes: uniqueSorted(findingCodes), report: baseReport };
  }

  let canonicalRoot;
  try {
    const rootStat = fs.lstatSync(rootDir);
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
      findingCodes.push("OVERLAY_REPOSITORY_INVALID");
    } else {
      canonicalRoot = fs.realpathSync(rootDir);
    }
  } catch {
    findingCodes.push("OVERLAY_REPOSITORY_INVALID");
  }
  if (findingCodes.length > 0) {
    return { ok: false, findingCodes: uniqueSorted(findingCodes), report: baseReport };
  }

  const topLevelResult = gitRunner(canonicalRoot, ["rev-parse", "--show-toplevel"]);
  const topLevel = topLevelResult.ok ? decodeUtf8(topLevelResult.stdout)?.trim() : null;
  try {
    if (!topLevel || fs.realpathSync(topLevel) !== canonicalRoot) {
      findingCodes.push("OVERLAY_REPOSITORY_INVALID");
    }
  } catch {
    findingCodes.push("OVERLAY_REPOSITORY_INVALID");
  }
  if (!verifyCommit(canonicalRoot, sourceCommit, gitRunner)) {
    findingCodes.push("OVERLAY_SOURCE_COMMIT_NOT_FOUND");
  }
  if (!verifyCommit(canonicalRoot, evidenceCommit, gitRunner)) {
    findingCodes.push("OVERLAY_EVIDENCE_COMMIT_NOT_FOUND");
  }
  if (findingCodes.length > 0) {
    return { ok: false, findingCodes: uniqueSorted(findingCodes), report: baseReport };
  }

  const ancestry = gitRunner(
    canonicalRoot,
    ["merge-base", "--is-ancestor", sourceCommit, evidenceCommit],
    { allowFailure: true },
  );
  if (!ancestry.ok) {
    findingCodes.push(
      ancestry.status === 1 ? "OVERLAY_EVIDENCE_NOT_DESCENDANT" : "OVERLAY_GIT_FAILURE",
    );
    return { ok: false, findingCodes: uniqueSorted(findingCodes), report: baseReport };
  }

  const historyValidation = validateOverlayHistory(
    canonicalRoot,
    sourceCommit,
    evidenceCommit,
    gitRunner,
  );
  findingCodes.push(...historyValidation.findingCodes);

  const diffResult = gitRunner(canonicalRoot, [
    "diff",
    "--raw",
    "-z",
    "--no-renames",
    "--no-abbrev",
    sourceCommit,
    evidenceCommit,
    "--",
  ]);
  const entries = diffResult.ok ? parseRawDiff(diffResult.stdout) : null;
  if (!entries) {
    findingCodes.push(diffResult.ok ? "OVERLAY_DIFF_INVALID" : "OVERLAY_GIT_FAILURE");
    return { ok: false, findingCodes: uniqueSorted(findingCodes), report: baseReport };
  }
  if (entries.length > maximumChangedFileCount) {
    findingCodes.push("OVERLAY_CHANGED_FILE_LIMIT_EXCEEDED");
  }
  if (!paymentProviderRemainsDisabled(canonicalRoot, evidenceCommit, gitRunner)) {
    findingCodes.push("OVERLAY_PAYMENT_DISABLED_INVARIANT_FAILED");
  }

  const seenPaths = new Set();
  const receipts = [];
  let aggregateBlobBytes = 0;
  for (const entry of entries) {
    const normalizedPath = entry.path.toLowerCase();
    if (!safeRepositoryPath(entry.path) || seenPaths.has(normalizedPath)) {
      findingCodes.push("OVERLAY_PATH_INVALID");
      continue;
    }
    seenPaths.add(normalizedPath);

    const allowedReceipt = entry.status === "A"
      && isSourceBoundReceiptPath(entry.path, sourceCommit);
    const entryPolicyFindings = overlayEntryPolicyFindings(entry, sourceCommit);
    findingCodes.push(...entryPolicyFindings);
    if (entryPolicyFindings.length > 0) {
      continue;
    }

    const blob = readBlob(canonicalRoot, entry.newOid, gitRunner);
    if (!blob) {
      findingCodes.push("OVERLAY_BLOB_INVALID");
      continue;
    }
    aggregateBlobBytes += blob.size;
    if (!allowedReceipt) continue;
    if (blob.size === 0 || blob.size > maximumReceiptBytes) {
      findingCodes.push("OVERLAY_RECEIPT_SIZE_INVALID");
      continue;
    }
    const receiptText = decodeUtf8(blob.body);
    let receiptValue;
    try {
      receiptValue = receiptText === null ? null : JSON.parse(receiptText);
    } catch {
      receiptValue = null;
    }
    if (!plainObject(receiptValue)) {
      findingCodes.push("OVERLAY_RECEIPT_JSON_INVALID");
      continue;
    }
    if (!receiptHistoryIsAppendOnly(
      canonicalRoot,
      sourceCommit,
      evidenceCommit,
      entry.path,
      gitRunner,
    )) {
      findingCodes.push("OVERLAY_RECEIPT_NOT_APPEND_ONLY");
      continue;
    }
    receipts.push({
      canonicalSha256: canonicalEvidenceSha256(blob.body),
      path: entry.path,
      value: receiptValue,
    });
  }
  if (aggregateBlobBytes > maximumAggregateBlobBytes) {
    findingCodes.push("OVERLAY_AGGREGATE_SIZE_EXCEEDED");
  }
  if (receipts.length > maximumReceiptCount) {
    findingCodes.push("OVERLAY_RECEIPT_COUNT_EXCEEDED");
  }

  const planValidation = validatePlanReferences(plan, receipts, sourceCommit);
  findingCodes.push(...planValidation.findingCodes);
  const report = {
    addedReceiptPaths: receipts.map((receipt) => receipt.path).sort(),
    changedPaths: entries.map((entry) => entry.path).sort(),
    evidenceCommit,
    historyCommitCount: historyValidation.commitCount,
    overlayDigest: overlayDigest(sourceCommit, evidenceCommit, entries),
    planValidated: planValidation.planValidated,
    sourceCommit,
  };
  return {
    ok: findingCodes.length === 0,
    findingCodes: uniqueSorted(findingCodes),
    report,
  };
}

export function parseProviderEvidenceOverlayArguments(argv) {
  const valueFlags = new Set(["--evidence-commit", "--root", "--source-commit"]);
  const booleanFlags = new Set(["--json", "--require-plan"]);
  const values = new Map();
  const flags = new Set();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (booleanFlags.has(token)) {
      if (flags.has(token)) return { ok: false, reasonCode: "OVERLAY_ARGUMENT_DUPLICATE" };
      flags.add(token);
      continue;
    }
    if (!valueFlags.has(token) || values.has(token)) {
      return {
        ok: false,
        reasonCode: values.has(token)
          ? "OVERLAY_ARGUMENT_DUPLICATE"
          : "OVERLAY_ARGUMENT_UNKNOWN",
      };
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      return { ok: false, reasonCode: "OVERLAY_ARGUMENT_VALUE_MISSING" };
    }
    values.set(token, value);
    index += 1;
  }
  for (const required of ["--source-commit", "--evidence-commit"]) {
    if (!values.has(required)) return { ok: false, reasonCode: "OVERLAY_ARGUMENT_REQUIRED" };
  }
  return { ok: true, flags, values };
}

function parsePlanEnvironment(environment) {
  const serialized = environment?.RIVT_PROVIDER_EVIDENCE_PLAN_JSON;
  if (typeof serialized !== "string" || serialized.length === 0) return null;
  if (Buffer.byteLength(serialized, "utf8") > 32 * 1024) return undefined;
  try {
    const value = JSON.parse(serialized);
    return plainObject(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

export async function main(
  argv = process.argv.slice(2),
  { environment = process.env } = {},
) {
  const parsed = parseProviderEvidenceOverlayArguments(argv);
  if (!parsed.ok) {
    console.log(JSON.stringify({
      findingCodes: [parsed.reasonCode],
      report: null,
      status: "blocked",
    }, null, 2));
    process.exitCode = 1;
    return;
  }
  const plan = parsePlanEnvironment(environment);
  if (plan === undefined || (parsed.flags.has("--require-plan") && plan === null)) {
    console.log(JSON.stringify({
      findingCodes: ["OVERLAY_PLAN_INVALID"],
      report: null,
      status: "blocked",
    }, null, 2));
    process.exitCode = 1;
    return;
  }
  const result = validateProviderEvidenceOverlay({
    evidenceCommit: parsed.values.get("--evidence-commit"),
    plan,
    rootDir: parsed.values.get("--root") ?? process.cwd(),
    sourceCommit: parsed.values.get("--source-commit"),
  });
  console.log(JSON.stringify({
    findingCodes: result.findingCodes,
    report: result.report,
    status: result.ok ? "verified" : "blocked",
  }, null, 2));
  process.exitCode = result.ok ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}

export const providerEvidenceOverlayContract = Object.freeze({
  allowedModifiedPaths: Object.freeze([...allowedModifiedPaths].sort()),
  maximumAggregateBlobBytes,
  maximumChangedFileCount,
  maximumHistoryCommitCount,
  maximumReceiptBytes,
  maximumReceiptCount,
});
