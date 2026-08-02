import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const workflowsRoot = path.resolve(".github", "workflows");
const workflowFiles = readdirSync(workflowsRoot)
  .filter((name) => /\.ya?ml$/i.test(name))
  .map((name) => path.join(workflowsRoot, name));

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

test("production workflows are bound to the protected production repository and branch", () => {
  for (const name of [
    "production-provider-evidence.yml",
    "production-synthetic.yml",
    "backup-freshness.yml",
  ]) {
    const workflow = readFileSync(path.join(workflowsRoot, name), "utf8");
    if (name === "backup-freshness.yml") {
      assert.match(workflow, /EXPECTED_REPOSITORY: Zboytjbxp\/rivt/);
      assert.match(workflow, /EXPECTED_REF: refs\/heads\/master/);
      assert.match(workflow, /test "\$REF_IS_PROTECTED" = "true"/);
      assert.doesNotMatch(workflow, /execution-context:\s*\n\s+if:/);
    } else {
      assert.match(workflow, /github\.repository\s*==\s*'Zboytjbxp\/rivt'/);
      assert.match(workflow, /github\.ref_protected\s*==\s*true/);
      assert.match(
        workflow,
        /refs\/heads\/master|github\.ref_name\s*==\s*github\.event\.repository\.default_branch/,
      );
      if (name === "production-provider-evidence.yml") {
        assert.match(workflow, /github\.ref\s*==\s*'refs\/heads\/master'/);
        assert.match(workflow, /github\.event\.repository\.default_branch\s*==\s*'master'/);
      }
    }
  }
});

test("Railway backup contract runs only the dedicated one-shot backup command", () => {
  const config = JSON.parse(readFileSync(path.resolve("railway.backup.json"), "utf8"));
  assert.equal(config.build?.buildCommand, "node --check scripts/create-logical-backup-artifact.js");
  assert.equal(config.deploy?.startCommand, "npm run backup:logical-artifact");
  assert.equal(config.deploy?.preDeployCommand, undefined);
  assert.equal(config.deploy?.healthcheckPath, undefined);
  assert.equal(config.deploy?.restartPolicyType, "ON_FAILURE");
  assert.equal(config.deploy?.restartPolicyMaxRetries, 2);
});

test("the legacy direct database copy restore path is retired", () => {
  const packageJson = JSON.parse(readFileSync(path.resolve("package.json"), "utf8"));
  assert.equal(packageJson.scripts?.["restore:logical-copy"], undefined);
  assert.equal(existsSync(path.resolve("scripts", "restore-logical-copy.js")), false);
});
