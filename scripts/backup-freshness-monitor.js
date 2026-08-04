import "dotenv/config";
import {
  BackupConfigurationError,
  isDirectExecution,
  sanitizedFailure,
  sanitizedSuccess,
} from "./logical-backup-utils.js";
import { verifyLogicalBackup } from "./verify-logical-backup.js";

export function backupMonitorOptions(argv = process.argv.slice(2)) {
  const allowed = new Set(["--alert-test"]);
  const unknown = argv.filter((argument) => !allowed.has(argument));
  if (unknown.length > 0 || new Set(argv).size !== argv.length) {
    throw new BackupConfigurationError(
      "BACKUP_CONFIG_INVALID",
      "The backup monitor received an unknown or duplicate argument.",
    );
  }
  return { alertTest: argv.includes("--alert-test") };
}

export async function runBackupFreshnessMonitor({
  alertTest = false,
  verify = verifyLogicalBackup,
} = {}) {
  if (alertTest) {
    throw new BackupConfigurationError(
      "BACKUP_ALERT_TEST",
      "The backup freshness alert test was requested.",
    );
  }
  const result = await verify();
  return { ...result, mode: "backup-freshness-monitor" };
}

async function main() {
  try {
    const options = backupMonitorOptions();
    const result = await runBackupFreshnessMonitor(options);
    console.log(JSON.stringify(sanitizedSuccess(result), null, 2));
  } catch (error) {
    console.error(JSON.stringify(sanitizedFailure(error, "backup-freshness-monitor"), null, 2));
    process.exitCode = 1;
  }
}

if (isDirectExecution(import.meta.url)) await main();
