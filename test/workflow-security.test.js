import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const workflowsRoot = path.resolve(".github", "workflows");
const workflowFiles = readdirSync(workflowsRoot)
  .filter((name) => /\.ya?ml$/i.test(name))
  .map((name) => path.join(workflowsRoot, name));

function readWorkflow(name) {
  return readFileSync(path.join(workflowsRoot, name), "utf8").replace(/\r\n/g, "\n");
}

function jobBlock(workflow, name, nextName = null) {
  const startMarker = `  ${name}:\n`;
  const start = workflow.indexOf(startMarker);
  assert.notEqual(start, -1, `workflow must define the ${name} job`);
  const end = nextName === null ? workflow.length : workflow.indexOf(`  ${nextName}:\n`, start + startMarker.length);
  assert.notEqual(end, -1, `workflow must define the ${nextName} job after ${name}`);
  return workflow.slice(start, end);
}

test("GitHub workflows pin remote actions and container images", () => {
  assert.ok(workflowFiles.length > 0);
  for (const workflowPath of workflowFiles) {
    const workflow = readFileSync(workflowPath, "utf8");
    for (const match of workflow.matchAll(/^\s*uses:\s*([^\s#]+)/gm)) {
      const reference = match[1];
      if (reference.startsWith("./")) continue;
      assert.match(
        reference,
        /@[0-9a-f]{40}$/i,
        `${path.basename(workflowPath)} must pin ${reference} to a full commit SHA`,
      );
    }
    for (const match of workflow.matchAll(/^\s*image:\s*([^\s#]+)/gm)) {
      assert.match(
        match[1],
        /@sha256:[0-9a-f]{64}$/i,
        `${path.basename(workflowPath)} must pin ${match[1]} to an immutable digest`,
      );
    }
  }
});

test("GitHub workflows disable install scripts and persisted checkout credentials", () => {
  for (const workflowPath of workflowFiles) {
    const workflow = readFileSync(workflowPath, "utf8");
    for (const match of workflow.matchAll(/^\s*run:\s*npm ci([^\r\n]*)$/gm)) {
      assert.match(
        match[1],
        /--ignore-scripts(?:\s|$)/,
        `${path.basename(workflowPath)} npm ci must disable lifecycle scripts`,
      );
    }
    const lines = workflow.split(/\r?\n/);
    for (const [index, line] of lines.entries()) {
      if (!/uses:\s*actions\/checkout@[0-9a-f]{40}/i.test(line)) continue;
      const checkoutBlock = lines.slice(index, index + 7).join("\n");
      assert.match(
        checkoutBlock,
        /persist-credentials:\s*false/,
        `${path.basename(workflowPath)} checkout must not persist credentials`,
      );
    }
  }
});

test("production workflows require the canonical repository and protected refs", () => {
  const synthetic = readWorkflow("production-synthetic.yml");
  assert.match(synthetic, /github\.repository\s*==\s*'Zboytjbxp\/rivt'/);
  assert.match(synthetic, /github\.ref\s*==\s*'refs\/heads\/master'/);
  assert.match(synthetic, /EVENT_REPOSITORY:\s*\$\{\{ github\.repository \}\}/);
  assert.match(synthetic, /EVENT_REF:\s*\$\{\{ github\.ref \}\}/);
  assert.match(synthetic, /REF_IS_PROTECTED:\s*\$\{\{ github\.ref_protected \}\}/);
  assert.match(synthetic, /"\$EVENT_REPOSITORY" == "Zboytjbxp\/rivt"/);
  assert.match(synthetic, /"\$EVENT_REF" == "refs\/heads\/master"/);
  assert.match(synthetic, /"\$REF_IS_PROTECTED" == "true"/);
  assert.match(synthetic, /errorCode:\s*"INVALID_CONFIGURATION"/);
  assert.match(synthetic, /check:\s*"workflow-context"/);

  const provider = readFileSync(path.join(workflowsRoot, "production-provider-evidence.yml"), "utf8");
  assert.match(provider, /github\.repository\s*==\s*'Zboytjbxp\/rivt'/);
  assert.match(provider, /github\.ref\s*==\s*'refs\/heads\/production-evidence-source'/);
  assert.match(provider, /github\.event\.repository\.default_branch\s*==\s*'master'/);
  assert.match(provider, /github\.ref_protected\s*==\s*true/);

  const backup = readWorkflow("backup-freshness.yml");
  assert.match(backup, /test "\$EVENT_REPOSITORY" = "Zboytjbxp\/rivt"/);
  assert.match(backup, /test "\$EVENT_REF" = "refs\/heads\/master"/);
  assert.match(backup, /REF_IS_PROTECTED: \$\{\{ github\.ref_protected \}\}/);
  assert.match(backup, /ref_protected: \$\{\{ steps\.protection\.outputs\.ref_protected \}\}/);
  assert.match(backup, /BACKUP_REF_UNPROTECTED/);
  assert.match(
    jobBlock(backup, "verify", "alert_test"),
    /needs\.validate_invocation\.outputs\.ref_protected == 'true'/,
  );
  assert.match(
    jobBlock(backup, "alert_test", "reconcile_incident"),
    /needs\.validate_invocation\.outputs\.ref_protected == 'true'/,
  );
  const reconcile = jobBlock(backup, "reconcile_incident");
  assert.match(
    reconcile,
    /if: always\(\) && needs\.validate_invocation\.result == 'success'/,
  );
  assert.match(reconcile, /REF_IS_PROTECTED: \$\{\{ needs\.validate_invocation\.outputs\.ref_protected \}\}/);
  assert.match(reconcile, /const requestedCode = !refProtected\s*\? "BACKUP_REF_UNPROTECTED"/);
});

test("backup source code is proven to be protected-master history before privileged execution", () => {
  const backup = readWorkflow("backup-freshness.yml");
  assert.match(backup, /ref: refs\/heads\/master/);
  assert.match(backup, /fetch-depth: 0/);
  assert.match(backup, /\[\[ "\$EXPECTED_SOURCE_COMMIT" =~ \^\[a-f0-9\]\{40\}\$ \]\]/);
  assert.match(backup, /git cat-file -e "\$EXPECTED_SOURCE_COMMIT\^\{commit\}"/);
  assert.match(
    backup,
    /git merge-base --is-ancestor "\$EXPECTED_SOURCE_COMMIT" "\$protected_master_commit"/,
  );
  assert.doesNotMatch(backup, /git checkout --detach "\$EXPECTED_SOURCE_COMMIT"/);
  assert.match(backup, /test "\$\(git rev-parse HEAD\)" = "\$protected_master_commit"/);

  const ancestryGuard = backup.indexOf("git merge-base --is-ancestor");
  const dependencyInstall = backup.indexOf("npm ci --omit=dev --ignore-scripts");
  const backupSecret = backup.indexOf("BACKUP_MONITOR_S3_ACCESS_KEY_ID");
  assert.ok(ancestryGuard >= 0 && ancestryGuard < dependencyInstall);
  assert.ok(ancestryGuard < backupSecret);
});

test("production synthetic isolates monitor execution from issue reconciliation", () => {
  const workflow = readWorkflow("production-synthetic.yml");
  const monitor = jobBlock(workflow, "monitor", "reconcile-incident");
  const reconcile = jobBlock(workflow, "reconcile-incident");

  assert.match(workflow, /on:\n  workflow_dispatch:\n  schedule:\n    - cron: "7,37 \* \* \* \*"/);
  assert.doesNotMatch(workflow, /cron: "\*\/30 \* \* \* \*"/);
  assert.match(workflow, /^permissions:\n  contents: read\n$/m);
  assert.doesNotMatch(workflow.slice(0, workflow.indexOf("jobs:\n")), /issues:\s*write/);

  assert.match(monitor, /permissions:\n      contents: read\n/);
  assert.doesNotMatch(monitor, /issues:\s*write|actions:\s*write/);
  assert.match(monitor, /environment:\s*production/);
  assert.match(monitor, /EXPECTED_SOURCE_COMMIT:\s*\$\{\{ vars\.RIVT_PRODUCTION_SOURCE_COMMIT \}\}/);
  assert.match(monitor, /- name: Validate protected production context/);
  assert.match(monitor, /- name: Upload sanitized monitor evidence\n        if: always\(\)/);
  assert.doesNotMatch(monitor.slice(0, monitor.indexOf("    steps:\n")), /\n    if:/);

  assert.match(reconcile, /needs:\s*monitor/);
  assert.match(reconcile, /if:\s*>-\n      always\(\)/);
  assert.match(reconcile, /github\.repository == 'Zboytjbxp\/rivt'/);
  assert.match(reconcile, /github\.ref == 'refs\/heads\/master'/);
  assert.doesNotMatch(reconcile.slice(0, reconcile.indexOf("    steps:\n")), /ref_protected/);
  assert.match(reconcile, /permissions:\n      actions: read\n      issues: write\n/);
  assert.doesNotMatch(reconcile, /contents:\s*(?:read|write)|actions:\s*write/);
  assert.match(reconcile, /actions\/download-artifact@[0-9a-f]{40}/);
  assert.match(reconcile, /continue-on-error:\s*true/);
  assert.doesNotMatch(reconcile, /actions\/checkout|npm ci|npm run/);
  assert.match(reconcile, /RIVT_MONITOR_SUMMARY_PATH:\s*monitor-evidence\/production-monitor-summary\.json/);
  assert.match(reconcile, /const defaultSummary = \(\) =>/);
  assert.match(reconcile, /const recovered = monitorResult === "success" && monitor\.ok === true/);
  assert.doesNotMatch(reconcile, /docs\/operations|process\.env\.(?!MONITOR_RESULT|RIVT_MONITOR_SUMMARY_PATH)/);
});
