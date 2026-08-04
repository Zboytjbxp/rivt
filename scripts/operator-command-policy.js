import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const SELF_PATH = "scripts/operator-command-policy.js";

function normalizedRepositoryPath(value) {
  return String(value ?? "").replaceAll("\\", "/");
}

export function isCommandCapableSurface(filePath) {
  const normalized = normalizedRepositoryPath(filePath);
  if (!normalized || normalized === SELF_PATH) return false;
  if (normalized === "package.json") return true;
  if (/^\.github\/(?:workflows|actions)\//.test(normalized)) return true;
  if (/^[^/]+\.(?:c?js|mjs|ps1|sh|cmd|bat)$/.test(normalized)) return true;
  if (/^scripts\/.+\.(?:c?js|mjs|ps1|sh|cmd|bat)$/.test(normalized)) return true;
  if (/(?:^|\/)(?:Dockerfile[^/]*|railway[^/]*\.(?:json|toml))$/i.test(normalized)) return true;
  return false;
}

const forbiddenCommands = [
  {
    id: "railway-environment-config",
    pattern: /\brailway\b[\s\S]{0,120}?\benvironment\b[\s\S]{0,80}?\bconfig\b/i,
  },
  {
    id: "railway-variable-command",
    pattern: /\brailway\b[\s\S]{0,120}?\bvariables?\b/i,
  },
];

export function prohibitedOperatorCommands(source) {
  const text = String(source ?? "");
  return forbiddenCommands
    .filter(({ pattern }) => pattern.test(text))
    .map(({ id }) => id);
}

export function trackedCommandSurfaceViolations({
  rootDir = process.cwd(),
  trackedFiles,
  readFile = readFileSync,
} = {}) {
  const files = trackedFiles ?? execFileSync("git", ["ls-files", "-z"], {
    cwd: rootDir,
    encoding: "utf8",
    windowsHide: true,
  }).split("\0").filter(Boolean);

  const violations = [];
  for (const filePath of files) {
    if (!isCommandCapableSurface(filePath)) continue;
    const absolutePath = path.resolve(rootDir, filePath);
    const matches = prohibitedOperatorCommands(readFile(absolutePath, "utf8"));
    if (matches.length > 0) {
      violations.push({ filePath: normalizedRepositoryPath(filePath), rules: matches });
    }
  }
  return violations;
}

export function enforceOperatorCommandPolicy(options) {
  const violations = trackedCommandSurfaceViolations(options);
  if (violations.length === 0) return { ok: true, violations: [] };

  const summary = violations
    .map(({ filePath, rules }) => `${filePath}: ${rules.join(", ")}`)
    .join("\n");
  throw new Error(
    `Prohibited production provider-enumeration command found in a command-capable surface:\n${summary}`,
  );
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (import.meta.url === invokedPath) {
  try {
    enforceOperatorCommandPolicy();
    console.log("Operator command policy passed.");
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
