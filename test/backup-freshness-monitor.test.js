import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const helperPath = join(repositoryRoot, ".github", "scripts", "backup-freshness-issue.cjs");
const workflowPath = join(repositoryRoot, ".github", "workflows", "backup-freshness.yml");
const verifierPath = join(repositoryRoot, "scripts", "verify-logical-backup.js");
const helperModule = await import(pathToFileURL(helperPath).href);
const helper = helperModule.default ?? helperModule;

const FIXED_NOW = new Date("2026-08-01T12:00:00.000Z");
const SOURCE_COMMIT = "0123456789abcdef0123456789abcdef01234567";
const SECRET = "BACKUP_SECRET_MUST_NOT_LEAK";

function validRawSummary(overrides = {}) {
  return {
    ok: true,
    mode: "verify-logical-backup",
    bucket: `private-${SECRET}`,
    prefix: `logical/${SECRET}`,
    key: `logical/${SECRET}/artifact.bin`,
    versionId: SECRET,
    sha256: "a".repeat(64),
    createdAt: "2026-08-01T11:00:00.000Z",
    uploadedAt: "2026-08-01T11:00:00.000Z",
    sourceCommit: SOURCE_COMMIT,
    ageHours: 1,
    retentionUntil: "2026-09-01T11:00:00.000Z",
    retentionDays: 30,
    lifecycleRuleId: SECRET,
    durationMs: 400,
    ...overrides,
  };
}

test("sanitized receipt keeps policy evidence and drops provider identifiers and arbitrary text", () => {
  const summary = helper.sanitizeBackupFreshnessSummary(validRawSummary({
    message: SECRET,
    endpoint: `https://${SECRET}.invalid`,
  }), FIXED_NOW);
  const rendered = JSON.stringify(summary);

  assert.deepEqual(summary, {
    ok: true,
    mode: "verify-logical-backup",
    checkedAt: FIXED_NOW.toISOString(),
    ageHours: 1,
    createdAt: "2026-08-01T11:00:00.000Z",
    uploadedAt: "2026-08-01T11:00:00.000Z",
    retentionUntil: "2026-09-01T11:00:00.000Z",
    retentionDays: 30,
    sourceCommit: SOURCE_COMMIT,
  });
  assert.doesNotMatch(rendered, new RegExp(SECRET));
  assert.doesNotMatch(rendered, /bucket|prefix|key|versionId|sha256|endpoint|message/);
});

test("sanitizer fails closed for stale, future, under-retained, and malformed success claims", () => {
  const cases = [
    validRawSummary({ ageHours: 14.001 }),
    validRawSummary({
      ageHours: 1,
      createdAt: "2026-07-31T20:00:00.000Z",
      retentionUntil: "2026-09-01T20:00:00.000Z",
    }),
    validRawSummary({ createdAt: "2026-08-01T12:06:00.000Z", ageHours: 0 }),
    validRawSummary({ uploadedAt: "2026-08-01T12:06:00.000Z", ageHours: 0 }),
    validRawSummary({ createdAt: "2026-08-01T10:40:00.000Z", ageHours: 1.333 }),
    validRawSummary({ retentionUntil: "2026-08-20T11:00:00.000Z" }),
    validRawSummary({ retentionDays: 29 }),
    validRawSummary({ sourceCommit: SOURCE_COMMIT.slice(0, 12) }),
    validRawSummary({ createdAt: "not-a-date" }),
  ];

  for (const raw of cases) {
    const summary = helper.sanitizeBackupFreshnessSummary(raw, FIXED_NOW);
    assert.equal(summary.ok, false);
    assert.match(summary.errorCode, /^SUMMARY_/);
  }

  assert.deepEqual(helper.parseAndSanitizeBackupFreshnessSummary(`{"message":"${SECRET}"}`, FIXED_NOW), {
    ok: false,
    mode: "verify-logical-backup",
    errorCode: "SUMMARY_INVALID",
  });
});

test("failure sanitization allows only a bounded code and never copies a provider message", () => {
  const safe = helper.sanitizeBackupFreshnessSummary({
    ok: false,
    mode: "verify-logical-backup",
    errorCode: "LATEST_BACKUP_STALE",
    message: SECRET,
  }, FIXED_NOW);
  const unsafe = helper.sanitizeBackupFreshnessSummary({
    ok: false,
    mode: "verify-logical-backup",
    errorCode: `BROKEN_${SECRET.toLowerCase()}!`,
    message: SECRET,
  }, FIXED_NOW);

  assert.deepEqual(safe, {
    ok: false,
    mode: "verify-logical-backup",
    errorCode: "LATEST_BACKUP_STALE",
  });
  assert.equal(unsafe.errorCode, "SUMMARY_INVALID");
  assert.doesNotMatch(JSON.stringify([safe, unsafe]), new RegExp(SECRET));
});

test("incident lookup reuses only the exact production-repository issue owned by GitHub Actions", () => {
  const owned = {
    number: 21,
    title: helper.BACKUP_FRESHNESS_INCIDENT_TITLE,
    body: `${helper.BACKUP_FRESHNESS_INCIDENT_MARKER}\n\nManaged by backup automation.`,
    repository_url: "https://api.github.com/repos/Zboytjbxp/rivt",
    user: { login: "github-actions[bot]", type: "Bot" },
  };
  const variants = [
    { ...owned, number: 22, pull_request: { url: "https://example.invalid/pull/22" } },
    { ...owned, number: 23, title: `${owned.title} copy` },
    { ...owned, number: 24, body: `text\n${helper.BACKUP_FRESHNESS_INCIDENT_MARKER}` },
    { ...owned, number: 25, repository_url: "https://api.github.com/repos/attacker/rivt" },
    { ...owned, number: 26, user: { login: "attacker", type: "User" } },
    { ...owned, number: 27, user: { login: "github-actions[bot]", type: "User" } },
  ];

  assert.equal(helper.findOwnedBackupFreshnessIncident(variants), undefined);
  assert.equal(helper.findOwnedBackupFreshnessIncident([variants[4], owned]), owned);
  assert.equal(helper.findOwnedBackupFreshnessIncident([owned], "attacker/rivt"), undefined);
});

test("alert-test CLI emits a bounded receipt without reading a verifier result", async () => {
  const directory = await mkdtemp(join(tmpdir(), "rivt-backup-alert-test-"));
  const outputPath = join(directory, "summary.json");
  try {
    await execFileAsync(process.execPath, [helperPath, "alert-test", outputPath], {
      cwd: repositoryRoot,
      encoding: "utf8",
      timeout: 5_000,
    });
    const summary = JSON.parse(await readFile(outputPath, "utf8"));
    assert.equal(summary.ok, false);
    assert.equal(summary.mode, "backup-freshness-alert-test");
    assert.equal(summary.errorCode, "ALERT_TEST_REQUESTED");
    assert.match(summary.checkedAt, /^\d{4}-\d{2}-\d{2}T/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("sanitize CLI replaces malformed or secret-bearing verifier output with a safe artifact", async () => {
  const directory = await mkdtemp(join(tmpdir(), "rivt-backup-sanitize-test-"));
  const inputPath = join(directory, "raw.json");
  const outputPath = join(directory, "safe.json");
  try {
    await writeFile(inputPath, `not-json-${SECRET}`, "utf8");
    await execFileAsync(process.execPath, [helperPath, "sanitize", inputPath, outputPath], {
      cwd: repositoryRoot,
      encoding: "utf8",
      timeout: 5_000,
    });
    const rendered = await readFile(outputPath, "utf8");
    assert.deepEqual(JSON.parse(rendered), {
      ok: false,
      mode: "verify-logical-backup",
      errorCode: "SUMMARY_INVALID",
    });
    assert.doesNotMatch(rendered, new RegExp(SECRET));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("workflow is hourly, read-only against backups, protected, and publishes only sanitized evidence", async () => {
  const workflow = await readFile(workflowPath, "utf8");
  const verifier = await readFile(verifierPath, "utf8");

  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /alert_test:/);
  assert.match(workflow, /cron: "17 \* \* \* \*"/);
  assert.match(workflow, /EXPECTED_REPOSITORY: Zboytjbxp\/rivt/);
  assert.match(workflow, /EXPECTED_REF: refs\/heads\/master/);
  assert.match(workflow, /REF_IS_PROTECTED: \$\{\{ github\.ref_protected \}\}/);
  assert.match(workflow, /test "\$REF_IS_PROTECTED" = "true"/);
  assert.doesNotMatch(workflow, /execution-context:\s*\n\s+if:/);
  assert.match(workflow, /environment: production/);
  assert.match(workflow, /ref: \$\{\{ github\.sha \}\}/);
  assert.match(workflow, /git rev-parse HEAD/);
  assert.match(workflow, /persist-credentials: false/);
  assert.match(workflow, /id: dependencies[\s\S]{0,180}continue-on-error: true[\s\S]{0,80}npm ci --ignore-scripts/);
  assert.match(workflow, /permissions:\s*\n\s+contents: read\s*\n\s+issues: write/);
  assert.doesNotMatch(workflow, /contents: write|actions: write|id-token: write|packages: write/);

  assert.match(workflow, /node scripts\/verify-logical-backup\.js --json/);
  assert.match(workflow, /BACKUP_DESTINATION_S3_ENDPOINT: \$\{\{ vars\.RIVT_BACKUP_S3_ENDPOINT \}\}/);
  assert.match(workflow, /BACKUP_DESTINATION_S3_BUCKET: \$\{\{ vars\.RIVT_BACKUP_S3_BUCKET \}\}/);
  assert.match(workflow, /BACKUP_DESTINATION_S3_PREFIX: \$\{\{ vars\.RIVT_BACKUP_S3_PREFIX \}\}/);
  assert.match(workflow, /BACKUP_DESTINATION_S3_ACCESS_KEY_ID: \$\{\{ secrets\.RIVT_BACKUP_MONITOR_ACCESS_KEY_ID \}\}/);
  assert.match(workflow, /BACKUP_DESTINATION_S3_SECRET_ACCESS_KEY: \$\{\{ secrets\.RIVT_BACKUP_MONITOR_SECRET_ACCESS_KEY \}\}/);
  assert.match(workflow, /BACKUP_ENCRYPTION_KEY: \$\{\{ secrets\.RIVT_BACKUP_ENCRYPTION_KEY \}\}/);
  assert.match(workflow, /BACKUP_ENCRYPTION_KEY_PREVIOUS: \$\{\{ secrets\.RIVT_BACKUP_ENCRYPTION_KEY_PREVIOUS \}\}/);
  assert.doesNotMatch(workflow, /BACKUP_EXPECTED_KEY_ID|RIVT_BACKUP_EXPECTED_KEY_ID/);
  assert.match(workflow, /BACKUP_RETENTION_DAYS: "30"/);
  assert.match(workflow, /BACKUP_MAX_AGE_HOURS: "14"/);
  assert.match(workflow, /if \(value\.ok !== true\) process\.exit\(1\)/);
  assert.match(workflow, /steps\.dependencies\.outcome == 'failure'/);

  assert.doesNotMatch(workflow, /DATABASE_URL|BACKUP_DATABASE_URL|PutObject|DeleteObject|restore-logical-backup/);
  assert.match(workflow, /alert-test backup-freshness-summary\.json/);
  assert.match(workflow, /No backup object was read, created, changed, or deleted/);
  assert.match(workflow, /Backup alert delivery test requested/);
  assert.match(workflow, /path: backup-freshness-summary\.json/);
  assert.doesNotMatch(workflow, /path: backup-freshness-(?:stdout|stderr)\.json|upload-artifact[\s\S]{0,300}backup-freshness-(?:stdout|stderr)/);
  assert.equal(workflow.match(/findOwnedBackupFreshnessIncident\(issues, repository\)/g)?.length, 2);
  assert.doesNotMatch(workflow, /issues\.find\(|body\?\.includes\(marker\)/);
  assert.match(verifier, /verifyBucketProtection/);
  assert.match(verifier, /newestBackupVersion/);
  assert.match(verifier, /verifyProtectedBackupObject/);
  assert.match(verifier, /strictRestoreEncryptionSecrets/);
  assert.match(verifier, /decryptSnapshot/);
  assert.match(verifier, /assertRestoreUsableSnapshot/);
  assert.doesNotMatch(verifier, /expectedBackupKeyIdFromEnv|PutObject|DeleteObject|CreateBucket|PutBucket|DATABASE_URL/);
});
