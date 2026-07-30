import { spawn } from "node:child_process";

const args = process.argv.slice(2);

if (args.length === 0) {
  console.error("Usage: npm run with:railway-public-db -- <command> [args...]");
  console.error("Example: npm run with:railway-public-db -- npm run smoke:projects:live");
  process.exit(1);
}

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

function assertPublicDatabaseUrl(value) {
  if (!value || typeof value !== "string") {
    throw new Error(
      "Set a temporary DATABASE_PUBLIC_URL or RIVT_DATABASE_PUBLIC_URL value before running this command.",
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
const storageEnv = {};

try {
  databaseUrl = assertPublicDatabaseUrl(
    process.env.RIVT_DATABASE_PUBLIC_URL?.trim()
      || process.env.DATABASE_PUBLIC_URL?.trim(),
  );
  if (includeStorage) {
    for (const name of storageVariableNames) {
      const value = process.env[name]?.trim();
      if (value) storageEnv[name] = value;
    }
    for (const required of ["S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"]) {
      if (!storageEnv[required]) {
        throw new Error(
          `RIVT_RAILWAY_INCLUDE_STORAGE=true but temporary ${required} is not set in this session.`,
        );
      }
    }
  }
} catch (error) {
  console.error(`Unable to prepare live-smoke variables: ${error.message}`);
  console.error("Copy only the named value needed from Railway, then clear it when the smoke finishes.");
  process.exit(1);
}

const [command, ...commandArgs] = args;

function quoteForWindowsShell(value) {
  if (/^[A-Za-z0-9_./:=@-]+$/.test(value)) return value;
  return `"${value.replace(/"/g, '\\"')}"`;
}

const childEnv = {
  ...process.env,
  DATABASE_URL: databaseUrl,
};
delete childEnv.DATABASE_PUBLIC_URL;
delete childEnv.RIVT_DATABASE_PUBLIC_URL;
delete childEnv.RIVT_RAILWAY_INCLUDE_STORAGE;
for (const name of storageVariableNames) delete childEnv[name];
Object.assign(childEnv, storageEnv);

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
