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
      if (name === "production-provider-evidence.yml") {
        assert.match(
          workflow,
          /github\.ref\s*==\s*'refs\/heads\/production-evidence-source'/,
        );
        assert.match(workflow, /github\.ref_name\s*==\s*'production-evidence-source'/);
        assert.match(workflow, /github\.event\.repository\.default_branch\s*==\s*'master'/);
      } else {
        assert.match(
          workflow,
          /refs\/heads\/master|github\.ref_name\s*==\s*github\.event\.repository\.default_branch/,
        );
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

test("provider runtime evidence cannot write the durable rate-limit ledger", () => {
  const indexSource = readFileSync(path.resolve("server", "index.js"), "utf8");
  const stripeSource = readFileSync(path.resolve("server", "stripe-connect.js"), "utf8");

  assert.match(indexSource, /const providerEvidenceRateLimit = createRateLimiter\(\{/);
  assert.match(indexSource, /max: 5,/);
  assert.match(indexSource, /namespace: "provider-evidence"/);
  assert.match(stripeSource, /const requireProviderEvidenceProof = \(request, _response, next\) => \{/);
  assert.match(
    stripeSource,
    /app\.post\("\/api\/provider-evidence\/stripe-connect\/runtime", requireProviderEvidenceProof, providerEvidenceRateLimit,/,
  );
  assert.doesNotMatch(
    stripeSource,
    /app\.post\("\/api\/provider-evidence\/stripe-connect\/runtime", publicPaymentRateLimit,/,
  );
});

test("provider evidence separates deployed source from a protected evidence-only overlay", () => {
  const workflow = readFileSync(
    path.join(workflowsRoot, "production-provider-evidence.yml"),
    "utf8",
  );
  const overlayValidation = workflow.indexOf("provider-evidence-overlay.js");
  const nodeSetup = workflow.indexOf("uses: actions/setup-node@");
  const dependencyInstall = workflow.indexOf("npm ci --ignore-scripts");
  const providerPlanSecret = workflow.indexOf("RIVT_PROVIDER_EVIDENCE_PLAN_JSON:");

  assert.match(workflow, /evidence_commit:/);
  assert.equal((workflow.match(/fetch-depth:\s*0/g) ?? []).length, 2);
  assert.match(workflow, /path:\s*source/);
  assert.match(workflow, /path:\s*evidence/);
  assert.match(workflow, /ref:\s*\$\{\{ vars\.RIVT_PRODUCTION_SOURCE_COMMIT \}\}/);
  assert.match(workflow, /ref:\s*refs\/heads\/production-evidence-overlay/);
  assert.match(workflow, /--evidence-commit "\$RIVT_EVIDENCE_COMMIT"/);
  assert.match(workflow, /--evidence-root "\$RIVT_EVIDENCE_ROOT"/);
  assert.match(workflow, /--source-commit "\$RIVT_PRODUCTION_SOURCE_COMMIT"/);
  assert.doesNotMatch(workflow, /--source-commit "\$GITHUB_SHA"/);
  assert.match(workflow, /"\$RIVT_PRODUCTION_SOURCE_COMMIT" != "\$GITHUB_SHA"/);
  assert.match(workflow, /git -C "\$evidence_root" rev-parse HEAD/);
  assert.match(
    workflow,
    /show-ref --verify --quiet "\$overlay_branch_ref"/,
  );
  assert.match(
    workflow,
    /refs\/remotes\/origin\/production-evidence-overlay/,
  );
  assert.match(
    workflow,
    /git -C "\$evidence_root" rev-parse "\$overlay_branch_ref"/,
  );
  assert.match(workflow, /current production-evidence-overlay head/);
  assert.equal((workflow.match(/working-directory:\s*source/g) ?? []).length, 2);
  assert.doesNotMatch(workflow, /refs\/remotes\/origin\/master/);
  assert.doesNotMatch(workflow, /git worktree add/);
  assert.ok(nodeSetup >= 0 && nodeSetup < overlayValidation);
  assert.ok(overlayValidation >= 0 && overlayValidation < dependencyInstall);
  assert.ok(overlayValidation < providerPlanSecret);
  assert.doesNotMatch(workflow, /^\s*(?:contents|actions|issues):\s*write\s*$/m);
});

test("Gate A completes independent checks before enforcing the launch hold", () => {
  const workflow = readFileSync(path.join(workflowsRoot, "gate-a.yml"), "utf8");
  const readiness = workflow.indexOf("id: launch_readiness");
  const browser = workflow.indexOf("Run fail-closed authentication browser test");
  const audit = workflow.indexOf("Audit production dependencies");
  const enforcement = workflow.indexOf("Enforce launch-readiness result after verification");

  assert.ok(readiness >= 0 && readiness < browser);
  assert.ok(browser < audit && audit < enforcement);
  assert.match(workflow, /id:\s*launch_readiness\s*\n\s*continue-on-error:\s*true/);
  assert.match(workflow, /RIVT_LAUNCH_READINESS_OUTCOME:\s*\$\{\{ steps\.launch_readiness\.outcome \}\}/);
  assert.match(workflow, /if:\s*always\(\)/);
});
