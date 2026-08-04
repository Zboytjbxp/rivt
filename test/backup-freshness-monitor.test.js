import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  BACKUP_INCIDENT_LABEL,
  BACKUP_INCIDENT_MARKER,
  BACKUP_INCIDENT_TITLE,
  backupIncidentAction,
  buildBackupIncidentBody,
  isOwnedBackupIncident,
  selectOwnedBackupIncident,
} from "../scripts/backup-freshness-incident.js";
import {
  safeBackupMonitorReceipt,
  validateBackupMonitorReceipt,
} from "../scripts/backup-freshness-receipt.js";
import {
  backupMonitorOptions,
  runBackupFreshnessMonitor,
} from "../scripts/backup-freshness-monitor.js";

const sourceCommit = "a".repeat(40);
const now = Date.parse("2026-08-04T12:00:00.000Z");

function validSuccessReceipt(overrides = {}) {
  return {
    ok: true,
    mode: "backup-freshness-monitor",
    createdAt: "2026-08-04T11:00:00.000Z",
    uploadedAt: "2026-08-04T11:00:01.000Z",
    sourceCommit,
    retentionDays: 30,
    retentionUntil: "2026-09-03T11:05:01.000Z",
    ageHours: 1,
    durationMs: 125,
    encryptionKeyMode: "active-only",
    destinationIdentitySha256: "b".repeat(64),
    artifactIdentitySha256: "c".repeat(64),
    ...overrides,
  };
}

function ownedIssue(overrides = {}) {
  return {
    number: 42,
    title: BACKUP_INCIDENT_TITLE,
    body: `${BACKUP_INCIDENT_MARKER}\nOwned automation incident.`,
    labels: [{ name: BACKUP_INCIDENT_LABEL }],
    user: { login: "github-actions[bot]", type: "Bot" },
    ...overrides,
  };
}

test("receipt validator emits only the strict safe success schema", () => {
  const validated = validateBackupMonitorReceipt(validSuccessReceipt(), {
    expectedSourceCommit: sourceCommit.toUpperCase(),
    now,
  });
  assert.deepEqual(validated, {
    ok: true,
    mode: "backup-freshness-monitor",
    sourceCommit,
    createdAt: "2026-08-04T11:00:00.000Z",
    uploadedAt: "2026-08-04T11:00:01.000Z",
    ageHours: 1,
    retentionDays: 30,
    retentionUntil: "2026-09-03T11:05:01.000Z",
    encryptionKeyMode: "active-only",
    destinationIdentitySha256: "b".repeat(64),
    artifactIdentitySha256: "c".repeat(64),
    durationMs: 125,
  });
});

test("receipt validator fails closed on source, key, freshness, retention, identity, and extra fields", () => {
  const invalidReceipts = [
    validSuccessReceipt({ sourceCommit: "d".repeat(40) }),
    validSuccessReceipt({ encryptionKeyMode: "active-or-previous" }),
    validSuccessReceipt({ ageHours: 14.001 }),
    validSuccessReceipt({ createdAt: "2026-08-03T20:00:00.000Z", uploadedAt: "2026-08-03T20:00:01.000Z", ageHours: 16 }),
    validSuccessReceipt({ retentionDays: 29 }),
    validSuccessReceipt({ retentionUntil: "2026-08-20T11:00:01.000Z" }),
    validSuccessReceipt({ artifactIdentitySha256: "not-a-digest" }),
    { ...validSuccessReceipt(), secretAccessKey: "must-not-pass" },
  ];
  for (const receipt of invalidReceipts) {
    assert.deepEqual(
      safeBackupMonitorReceipt(receipt, { expectedSourceCommit: sourceCommit, now }),
      { ok: false, errorCode: "BACKUP_OPERATION_FAILED" },
    );
  }
});

test("failure receipt ignores messages and unknown codes map to a generic failure", () => {
  const secret = "secret-key ```\n# injected heading";
  const safe = safeBackupMonitorReceipt({
    ok: false,
    mode: "backup-freshness-monitor",
    errorCode: "BACKUP_NOT_FRESH",
    message: secret,
  });
  assert.deepEqual(safe, { ok: false, errorCode: "BACKUP_NOT_FRESH" });
  assert.equal(JSON.stringify(safe).includes(secret), false);

  assert.deepEqual(safeBackupMonitorReceipt({
    ok: false,
    mode: "backup-freshness-monitor",
    errorCode: "ATTACKER_CONTROLLED",
    message: secret,
  }), { ok: false, errorCode: "BACKUP_OPERATION_FAILED" });
});

test("receipt CLI never echoes malformed or secret-bearing input", () => {
  const script = fileURLToPath(new URL("../scripts/backup-freshness-receipt.js", import.meta.url));
  const secret = "super-secret-provider-value";
  const malformed = spawnSync(process.execPath, [script], {
    encoding: "utf8",
    env: { ...process.env, BACKUP_EXPECTED_SOURCE_COMMIT: sourceCommit },
    input: `{\"ok\":false,\"message\":\"${secret}\"`,
  });
  assert.equal(malformed.status, 1);
  assert.equal(malformed.stderr, "");
  assert.equal(malformed.stdout, '{"ok":false,"errorCode":"BACKUP_OPERATION_FAILED"}\n');
  assert.equal(`${malformed.stdout}${malformed.stderr}`.includes(secret), false);

  const cliNow = Date.now();
  const cliUploadedAt = new Date(cliNow - 3_600_000);
  const cliCreatedAt = new Date(cliUploadedAt.getTime() - 1000);
  const cliReceipt = validSuccessReceipt({
    createdAt: cliCreatedAt.toISOString(),
    uploadedAt: cliUploadedAt.toISOString(),
    retentionUntil: new Date(cliUploadedAt.getTime() + 30 * 86_400_000 + 300_000).toISOString(),
  });
  const valid = spawnSync(process.execPath, [script], {
    encoding: "utf8",
    env: { ...process.env, BACKUP_EXPECTED_SOURCE_COMMIT: sourceCommit },
    input: JSON.stringify(cliReceipt),
  });
  assert.equal(valid.status, 0);
  assert.equal(valid.stderr, "");
  const cliOutput = JSON.parse(valid.stdout);
  assert.equal(cliOutput.ok, true);
  assert.equal(cliOutput.sourceCommit, sourceCommit);
  assert.equal(cliOutput.encryptionKeyMode, "active-only");
  assert.deepEqual(cliOutput, validateBackupMonitorReceipt(cliReceipt, {
    expectedSourceCommit: sourceCommit,
    now: cliNow,
  }));
});

test("alert-test parsing is strict and never invokes backup verification", async () => {
  assert.deepEqual(backupMonitorOptions([]), { alertTest: false });
  assert.deepEqual(backupMonitorOptions(["--alert-test"]), { alertTest: true });
  assert.throws(() => backupMonitorOptions(["--alert-test", "--alert-test"]), /unknown or duplicate/);
  assert.throws(() => backupMonitorOptions(["--read-provider"]), /unknown or duplicate/);

  let verifyCalls = 0;
  await assert.rejects(
    () => runBackupFreshnessMonitor({
      alertTest: true,
      verify: async () => {
        verifyCalls += 1;
      },
    }),
    (error) => error.code === "BACKUP_ALERT_TEST",
  );
  assert.equal(verifyCalls, 0);

  const result = await runBackupFreshnessMonitor({
    verify: async () => ({ ok: true, mode: "verify-logical-backup" }),
  });
  assert.deepEqual(result, { ok: true, mode: "backup-freshness-monitor" });
});

test("incident ownership requires the exact non-PR bot issue contract", () => {
  assert.equal(isOwnedBackupIncident(ownedIssue()), true);
  const impostors = [
    ownedIssue({ title: "Similar backup issue" }),
    ownedIssue({ body: "marker removed" }),
    ownedIssue({ labels: [] }),
    ownedIssue({ user: { login: "human", type: "User" } }),
    ownedIssue({ user: { login: "github-actions[bot]", type: "User" } }),
    ownedIssue({ pull_request: { url: "https://api.github.com/repos/rivt/rivt/pulls/42" } }),
  ];
  assert.ok(impostors.every((issue) => !isOwnedBackupIncident(issue)));
  assert.equal(selectOwnedBackupIncident([...impostors, ownedIssue()]).number, 42);
  assert.throws(
    () => selectOwnedBackupIncident([ownedIssue(), ownedIssue({ number: 43 })]),
    (error) => error.code === "BACKUP_INCIDENT_OWNERSHIP_AMBIGUOUS",
  );
});

test("incident actions never close alert tests and close only exact owned recovery issues", () => {
  const incident = ownedIssue();
  assert.equal(backupIncidentAction({ issues: [incident], alertTest: true, monitorSucceeded: true }).action, "update");
  assert.equal(backupIncidentAction({ issues: [], alertTest: true, monitorSucceeded: true }).action, "create");
  assert.equal(backupIncidentAction({ issues: [incident], monitorSucceeded: true }).action, "close");
  assert.equal(backupIncidentAction({ issues: [], monitorSucceeded: true }).action, "none");
  assert.equal(backupIncidentAction({ issues: [incident], monitorSucceeded: false }).action, "update");
  assert.equal(backupIncidentAction({ issues: [], monitorSucceeded: false }).action, "create");
  assert.throws(
    () => backupIncidentAction({ issues: [], monitorSucceeded: "false" }),
    (error) => error.code === "BACKUP_INCIDENT_OWNERSHIP_AMBIGUOUS",
  );
});

test("incident body uses only static text, validated URLs, and allowlisted codes", () => {
  const injected = "https://evil.example/run\n```\nsecret";
  const body = buildBackupIncidentBody({
    runUrl: injected,
    errorCode: "ATTACKER_CONTROLLED\n# heading",
  });
  assert.equal(body.includes("evil.example"), false);
  assert.equal(body.includes("secret"), false);
  assert.equal(body.includes("ATTACKER_CONTROLLED"), false);
  assert.match(body, /Monitor code: BACKUP_OPERATION_FAILED/);

  const alertBody = buildBackupIncidentBody({
    runUrl: "https://github.com/rivt/rivt/actions/runs/12345",
    errorCode: "BACKUP_ALERT_TEST",
    alertTest: true,
  });
  assert.match(alertBody, /explicit backup freshness alert test/);
  assert.match(alertBody, /https:\/\/github\.com\/rivt\/rivt\/actions\/runs\/12345/);
});

test("workflow keeps verification, alert testing, and issue mutation separated and fail closed", () => {
  const workflowPath = fileURLToPath(new URL("../.github/workflows/backup-freshness.yml", import.meta.url));
  const workflow = fs.readFileSync(workflowPath, "utf8").replaceAll("\r\n", "\n");
  assert.match(workflow, /cron: "37 \* \* \* \*"/);
  assert.match(workflow, /queue: max/);
  assert.match(workflow, /environment: production-backup-monitor/);
  assert.match(workflow, /ref: refs\/heads\/master/);
  assert.match(workflow, /git merge-base --is-ancestor "\$EXPECTED_SOURCE_COMMIT" "\$protected_master_commit"/);
  assert.match(workflow, /test "\$\(git rev-parse HEAD\)" = "\$protected_master_commit"/);
  assert.doesNotMatch(workflow, /ref: \$\{\{ vars\.BACKUP_EXPECTED_SOURCE_COMMIT \}\}/);
  assert.match(workflow, /BACKUP_MONITOR_S3_ACCESS_KEY_ID/);
  assert.match(workflow, /BACKUP_MONITOR_S3_SECRET_ACCESS_KEY/);
  assert.match(workflow, /unset BACKUP_DESTINATION_S3_ENDPOINT[\s\S]*BACKUP_ENCRYPTION_KEY/);
  assert.match(workflow, /backup-freshness-receipt\.js <"\$receipt" >"\$safe" 2>"\$receipt_error"/);
  assert.match(workflow, /permissions:\n\s+issues: write/);
  assert.match(workflow, /issue\.title === title/);
  assert.match(workflow, /issue\.user\?\.login === bot/);
  assert.match(workflow, /issue\.user\?\.type === "Bot"/);
  assert.match(workflow, /issue\.labels\?\.some/);
  assert.match(workflow, /if \(owned\.length > 1\)/);
  assert.equal(workflow.includes("BACKUP_ENCRYPTION_KEY_PREVIOUS"), false);
  assert.equal(workflow.includes("BACKUP_DATABASE_URL"), false);
  assert.equal(workflow.includes("RESTORE_DATABASE_URL"), false);
  assert.equal(workflow.includes("upload-artifact"), false);
  assert.equal(workflow.includes("tee "), false);

  const alertJob = workflow
    .split("  alert_test:\n    name: Exercise alert route")[1]
    .split("  reconcile_incident:")[0];
  assert.doesNotMatch(alertJob, /^\s+environment:/m);
  for (const forbidden of ["uses: actions/checkout", "npm ", "secrets.", "BACKUP_ENCRYPTION_KEY"]) {
    assert.equal(alertJob.includes(forbidden), false, `alert-test contains ${forbidden}`);
  }
});

test("dedicated Railway backup config runs only the bounded scheduled backup job", () => {
  const configPath = fileURLToPath(new URL("../railway.backup.json", import.meta.url));
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

  assert.equal(config.build.builder, "NIXPACKS");
  assert.equal(config.build.buildCommand, "npm run build");
  assert.equal(config.deploy.startCommand, "npm run backup:scheduled");
  assert.equal(config.deploy.startCommand.includes("backup:logical-artifact"), false);
  assert.equal(config.deploy.numReplicas, 1);
  assert.equal(config.deploy.restartPolicyType, "NEVER");
  assert.equal(config.deploy.restartPolicyMaxRetries, null);
  assert.equal(config.deploy.cronSchedule, "7 */12 * * *");
  assert.equal(config.deploy.overlapSeconds, 0);
  assert.equal(config.deploy.drainingSeconds, 0);
  assert.equal(config.deploy.startCommand.includes("npm start"), false);
  assert.equal(config.deploy.healthcheckPath, undefined);
  assert.equal(config.deploy.preDeployCommand, undefined);
});
