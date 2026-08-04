import assert from "node:assert/strict";
import test from "node:test";
import {
  enforceOperatorCommandPolicy,
  isCommandCapableSurface,
  prohibitedOperatorCommands,
  trackedCommandSurfaceViolations,
} from "../scripts/operator-command-policy.js";

test("command policy identifies command-capable tracked surfaces", () => {
  assert.equal(isCommandCapableSurface("package.json"), true);
  assert.equal(isCommandCapableSurface("audit-full.mjs"), true);
  assert.equal(isCommandCapableSurface("verify-redesign.mjs"), true);
  assert.equal(isCommandCapableSurface(".github/workflows/gate-a.yml"), true);
  assert.equal(isCommandCapableSurface("scripts/release.ps1"), true);
  assert.equal(isCommandCapableSurface("railway.json"), true);
  assert.equal(isCommandCapableSurface("docs/operations/RUNBOOKS.md"), false);
  assert.equal(isCommandCapableSurface("test/operator-command-policy.test.js"), false);
  assert.equal(isCommandCapableSurface("scripts/operator-command-policy.js"), false);
});

test("command policy rejects both prohibited Railway command families", () => {
  assert.deepEqual(
    prohibitedOperatorCommands("railway environment config --environment production --json"),
    ["railway-environment-config"],
  );
  assert.deepEqual(
    prohibitedOperatorCommands("railway variables --service web"),
    ["railway-variable-command"],
  );
  assert.deepEqual(
    prohibitedOperatorCommands("spawn('railway', ['variable', 'list'])"),
    ["railway-variable-command"],
  );
});

test("command policy permits the sanitized activation snapshot path", () => {
  assert.deepEqual(
    prohibitedOperatorCommands(
      "npm run railway:activation:preflight -- --capture-provider-snapshot .runtime/provider.json",
    ),
    [],
  );
  assert.doesNotThrow(() => enforceOperatorCommandPolicy({
    rootDir: "C:/repo",
    trackedFiles: ["package.json", "docs/operations/RUNBOOKS.md"],
    readFile: (filePath) => filePath.endsWith("package.json")
      ? '{"scripts":{"snapshot":"npm run railway:activation:preflight"}}'
      : "prose may name a forbidden command without executing it",
  }));
});

test("tracked-surface scan reports files and rule ids without source text", () => {
  const violations = trackedCommandSurfaceViolations({
    rootDir: "C:/repo",
    trackedFiles: ["scripts/unsafe.mjs", "docs/operations/RUNBOOKS.md"],
    readFile: () => "railway environment config",
  });
  assert.deepEqual(violations, [{
    filePath: "scripts/unsafe.mjs",
    rules: ["railway-environment-config"],
  }]);
  assert.throws(
    () => enforceOperatorCommandPolicy({
      rootDir: "C:/repo",
      trackedFiles: ["scripts/unsafe.mjs"],
      readFile: () => "railway variables",
    }),
    /scripts\/unsafe\.mjs: railway-variable-command/,
  );
});
