import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function containedPath(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export function resolveRegularRepositoryFile(
  evidencePath,
  {
    rootDir = process.cwd(),
    lstat = fs.lstatSync,
    realpath = fs.realpathSync,
  } = {},
) {
  if (!hasText(evidencePath) || path.isAbsolute(evidencePath)) return null;

  const lexicalRoot = path.resolve(rootDir);
  const lexicalEvidence = path.resolve(lexicalRoot, evidencePath);
  if (!containedPath(lexicalRoot, lexicalEvidence) || lexicalEvidence === lexicalRoot) return null;

  try {
    const rootStat = lstat(lexicalRoot);
    if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) return null;

    const relativeSegments = path.relative(lexicalRoot, lexicalEvidence).split(path.sep);
    let currentPath = lexicalRoot;
    for (const [index, segment] of relativeSegments.entries()) {
      currentPath = path.join(currentPath, segment);
      const currentStat = lstat(currentPath);
      const isFinalSegment = index === relativeSegments.length - 1;
      if (currentStat.isSymbolicLink()) return null;
      if (isFinalSegment ? !currentStat.isFile() : !currentStat.isDirectory()) return null;
    }

    const canonicalRoot = realpath(lexicalRoot);
    const canonicalPath = realpath(lexicalEvidence);
    if (!containedPath(canonicalRoot, canonicalPath) || canonicalPath === canonicalRoot) return null;

    return { canonicalPath, resolvedPath: lexicalEvidence };
  } catch {
    return null;
  }
}

export function providerEvidenceIdentity({ controlId, provider, sha256 } = {}) {
  if (
    !hasText(controlId)
    || !hasText(provider)
    || typeof sha256 !== "string"
    || !/^[a-f0-9]{64}$/i.test(sha256)
  ) return null;
  return `${controlId}\u0000${provider}\u0000${sha256.toLowerCase()}`;
}

export function canonicalRepositoryEvidence(value) {
  const text = Buffer.isBuffer(value) ? value.toString("utf8") : String(value);
  return text.replace(/\r\n?/g, "\n");
}

export function repositoryEvidenceSha256(value) {
  return createHash("sha256")
    .update(canonicalRepositoryEvidence(value))
    .digest("hex");
}

export function isExternallyVerifiedEvidence(externallyVerifiedEvidence, evidence) {
  const identity = providerEvidenceIdentity(evidence);
  return identity !== null
    && externallyVerifiedEvidence instanceof Set
    && externallyVerifiedEvidence.has(identity);
}
