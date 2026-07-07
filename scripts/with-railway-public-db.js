import { spawn, spawnSync } from "node:child_process";

const args = process.argv.slice(2);

if (args.length === 0) {
  console.error("Usage: npm run with:railway-public-db -- <command> [args...]");
  console.error("Example: npm run with:railway-public-db -- npm run smoke:projects:live");
  process.exit(1);
}

const railwayService = process.env.RIVT_RAILWAY_DATABASE_SERVICE?.trim() || "Postgres";
const railwayAppService = process.env.RIVT_RAILWAY_APP_SERVICE?.trim() || "RIVT";
const railwayEnvironment = process.env.RIVT_RAILWAY_ENVIRONMENT?.trim() || "production";
const includeStorage = process.env.RIVT_RAILWAY_INCLUDE_STORAGE === "true";
const storageVariableNames = [
  "S3_BUCKET",
  "S3_REGION",
  "S3_ENDPOINT",
  "S3_FORCE_PATH_STYLE",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
  "S3_SIGNED_URL_SECONDS",
];

function resolveCommand(value) {
  if (process.platform !== "win32") return value;
  if (value === "npm") return "npm.cmd";
  if (value === "npx") return "npx.cmd";
  return value;
}

function quoteForPowerShell(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function runRailwayVariableList(service) {
  const railwayArgs = ["variable", "list", "--service", railwayService, "--environment", railwayEnvironment, "--json"];
  railwayArgs[3] = service;
  const result = process.platform === "win32"
    ? spawnSync(
        "powershell",
        [
          "-NoProfile",
          "-Command",
          `railway variable list --service ${quoteForPowerShell(service)} --environment ${quoteForPowerShell(railwayEnvironment)} --json`,
        ],
        {
          encoding: "utf8",
          windowsHide: true,
        },
      )
    : spawnSync(resolveCommand("railway"), railwayArgs, {
        encoding: "utf8",
        windowsHide: true,
      });

  if (result.error) {
    throw new Error(`Could not run Railway CLI: ${result.error.message}`);
  }

  if (result.status !== 0) {
    const message = result.stderr?.trim() || result.stdout?.trim() || "Railway CLI returned a non-zero exit code.";
    throw new Error(message);
  }

  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(`Could not parse Railway variable JSON: ${error.message}`);
  }
}

function getVariable(variableList, name) {
  if (Array.isArray(variableList)) {
    const match = variableList.find((item) => item?.name === name || item?.key === name);
    return match?.value;
  }

  return variableList?.[name];
}

function assertPublicDatabaseUrl(value) {
  if (!value || typeof value !== "string") {
    throw new Error(
      `Railway service "${railwayService}" does not expose DATABASE_PUBLIC_URL in ${railwayEnvironment}.`,
    );
  }

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("Railway DATABASE_PUBLIC_URL is not a valid URL.");
  }

  if (parsed.hostname.endsWith(".internal") || parsed.hostname.includes("railway.internal")) {
    throw new Error(
      "Railway returned an internal database host. Use the Postgres service DATABASE_PUBLIC_URL for local live smokes.",
    );
  }

  return value;
}

let databaseUrl;
let storageEnv = {};

try {
  const variables = runRailwayVariableList(railwayService);
  databaseUrl = assertPublicDatabaseUrl(getVariable(variables, "DATABASE_PUBLIC_URL"));
  if (includeStorage) {
    const appVariables = runRailwayVariableList(railwayAppService);
    storageEnv = Object.fromEntries(
      storageVariableNames
        .map((name) => [name, getVariable(appVariables, name)])
        .filter(([, value]) => typeof value === "string" && value.trim() !== ""),
    );
    for (const required of ["S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"]) {
      if (!storageEnv[required]) {
        throw new Error(
          `RIVT_RAILWAY_INCLUDE_STORAGE=true but Railway service "${railwayAppService}" is missing ${required}.`,
        );
      }
    }
  }
} catch (error) {
  console.error(`Unable to resolve Railway live-smoke variables: ${error.message}`);
  console.error("Run `railway login` and confirm this repo is linked to the RIVT Railway project.");
  process.exit(1);
}

const [command, ...commandArgs] = args;

function quoteForWindowsShell(value) {
  if (/^[A-Za-z0-9_./:=@-]+$/.test(value)) return value;
  return `"${value.replace(/"/g, '\\"')}"`;
}

const childEnv = {
  ...process.env,
  ...storageEnv,
  DATABASE_URL: databaseUrl,
};

const child = process.platform === "win32" ? spawn(
  process.env.ComSpec || "cmd.exe",
  ["/d", "/s", "/c", [command, ...commandArgs].map(quoteForWindowsShell).join(" ")],
  {
    env: childEnv,
    stdio: "inherit",
    windowsHide: true,
  },
) : spawn(resolveCommand(command), commandArgs, {
  env: childEnv,
  stdio: "inherit",
  windowsHide: true,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
