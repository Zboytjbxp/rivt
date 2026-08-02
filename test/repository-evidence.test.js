import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  canonicalRepositoryEvidence,
  isExternallyVerifiedEvidence,
  providerEvidenceIdentity,
  repositoryEvidenceSha256,
  resolveRegularRepositoryFile,
} from "../scripts/repository-evidence.js";

test("provider evidence identities are exact except for SHA-256 case", () => {
  const lower = providerEvidenceIdentity({
    controlId: "control-A",
    provider: "Provider-A",
    sha256: "a".repeat(64),
  });
  const upperDigest = providerEvidenceIdentity({
    controlId: "control-A",
    provider: "Provider-A",
    sha256: "A".repeat(64),
  });
  assert.equal(lower, upperDigest);
  assert.notEqual(lower, providerEvidenceIdentity({
    controlId: "control-a",
    provider: "Provider-A",
    sha256: "a".repeat(64),
  }));
  assert.notEqual(lower, providerEvidenceIdentity({
    controlId: "control-A",
    provider: "provider-a",
    sha256: "a".repeat(64),
  }));
});

test("provider evidence identities reject incomplete and malformed input", () => {
  assert.equal(providerEvidenceIdentity(), null);
  assert.equal(providerEvidenceIdentity({
    controlId: "control",
    provider: "provider",
    sha256: "short",
  }), null);
  assert.equal(providerEvidenceIdentity({
    controlId: " ",
    provider: "provider",
    sha256: "a".repeat(64),
  }), null);
});

test("externally verified evidence requires the exact identity in a Set", () => {
  const evidence = {
    controlId: "control",
    provider: "provider",
    sha256: "b".repeat(64),
  };
  const identity = providerEvidenceIdentity(evidence);
  assert.equal(isExternallyVerifiedEvidence(new Set([identity]), evidence), true);
  assert.equal(isExternallyVerifiedEvidence([identity], evidence), false);
  assert.equal(isExternallyVerifiedEvidence(new Set(), evidence), false);
  assert.equal(isExternallyVerifiedEvidence(new Set([identity]), {
    ...evidence,
    provider: "other-provider",
  }), false);
});

test("repository evidence canonicalization makes LF and CRLF hashes identical", () => {
  assert.equal(canonicalRepositoryEvidence("a\r\nb\rc\n"), "a\nb\nc\n");
  assert.equal(
    repositoryEvidenceSha256("{\r\n\"ok\":true\r\n}"),
    repositoryEvidenceSha256("{\n\"ok\":true\n}"),
  );
});

test("repository evidence resolution accepts only regular contained files", () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "rivt-repository-evidence-"));
  const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), "rivt-outside-evidence-"));
  try {
    fs.mkdirSync(path.join(rootDir, "evidence"));
    fs.writeFileSync(path.join(rootDir, "evidence", "receipt.json"), "{}", "utf8");
    fs.writeFileSync(path.join(outsideDir, "outside.json"), "{}", "utf8");
    assert.ok(resolveRegularRepositoryFile("evidence/receipt.json", { rootDir }));
    assert.equal(resolveRegularRepositoryFile(".", { rootDir }), null);
    assert.equal(resolveRegularRepositoryFile("evidence", { rootDir }), null);
    assert.equal(resolveRegularRepositoryFile("missing.json", { rootDir }), null);
    assert.equal(resolveRegularRepositoryFile("../outside.json", { rootDir }), null);
    assert.equal(resolveRegularRepositoryFile(path.join(outsideDir, "outside.json"), { rootDir }), null);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
    fs.rmSync(outsideDir, { recursive: true, force: true });
  }
});

test("repository evidence resolution rejects symlinked path segments", (context) => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "rivt-repository-evidence-link-"));
  const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), "rivt-outside-evidence-link-"));
  try {
    fs.writeFileSync(path.join(outsideDir, "receipt.json"), "{}", "utf8");
    try {
      fs.symlinkSync(outsideDir, path.join(rootDir, "linked"), "junction");
    } catch (error) {
      if (["EPERM", "EACCES", "ENOTSUP"].includes(error?.code)) {
        context.skip(`Symlink creation is unavailable: ${error.code}`);
        return;
      }
      throw error;
    }
    assert.equal(resolveRegularRepositoryFile("linked/receipt.json", { rootDir }), null);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
    fs.rmSync(outsideDir, { recursive: true, force: true });
  }
});
