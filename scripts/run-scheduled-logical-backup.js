import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  BackupConfigurationError,
  backupJobTimeoutMsFromEnv,
  isDirectExecution,
  sanitizedFailure,
} from "./logical-backup-utils.js";

const backupScriptPath = fileURLToPath(new URL("./create-logical-backup-artifact.js", import.meta.url));
const DEFAULT_TERMINATION_GRACE_MS = 10_000;

function interruptedError(signal) {
  return new BackupConfigurationError(
    "BACKUP_JOB_INTERRUPTED",
    `The scheduled backup wrapper received ${signal}.`,
  );
}

export async function runScheduledLogicalBackup({
  env = process.env,
  spawnImpl = spawn,
  timeoutMs = backupJobTimeoutMsFromEnv(env),
  terminationGraceMs = DEFAULT_TERMINATION_GRACE_MS,
  signalSource = process,
} = {}) {
  const child = spawnImpl(process.execPath, [backupScriptPath], {
    env,
    stdio: "inherit",
    windowsHide: true,
  });

  return new Promise((resolve, reject) => {
    let timedOut = false;
    let settled = false;
    let interruptedSignal;
    let terminationRequested = false;
    let forceKillTimer;
    let finalFallbackTimer;
    let timeout;
    let onChildError;
    let onChildExit;

    const timeoutError = () => new BackupConfigurationError(
      "BACKUP_JOB_TIMEOUT",
      "The backup child process exceeded its deadline.",
    );

    const cleanup = () => {
      clearTimeout(timeout);
      clearTimeout(forceKillTimer);
      clearTimeout(finalFallbackTimer);
      signalSource.removeListener("SIGTERM", onSigterm);
      signalSource.removeListener("SIGINT", onSigint);
      child.removeListener("error", onChildError);
      child.removeListener("exit", onChildExit);
    };
    const settle = (callback) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback();
    };

    const tryKill = (signal) => {
      try {
        return child.kill(signal);
      } catch {
        return false;
      }
    };

    const requestTermination = (signal) => {
      if (settled || terminationRequested) return;
      terminationRequested = true;
      tryKill(signal);
      forceKillTimer = setTimeout(() => {
        tryKill("SIGKILL");
        finalFallbackTimer = setTimeout(() => {
          try {
            child.unref?.();
          } catch {
            // The wrapper must still fail closed even if detaching the stuck child fails.
          }
          settle(() => reject(timedOut ? timeoutError() : interruptedError(interruptedSignal ?? signal)));
        }, terminationGraceMs);
      }, terminationGraceMs);
    };

    const onSigterm = () => {
      interruptedSignal = "SIGTERM";
      clearTimeout(timeout);
      requestTermination("SIGTERM");
    };
    const onSigint = () => {
      interruptedSignal = "SIGINT";
      clearTimeout(timeout);
      requestTermination("SIGINT");
    };

    onChildError = (error) => {
      if (terminationRequested) return;
      settle(() => reject(error));
    };
    onChildExit = (code, signal) => {
      settle(() => {
        if (timedOut) {
          reject(timeoutError());
          return;
        }
        if (interruptedSignal) {
          reject(interruptedError(interruptedSignal));
          return;
        }
        if (code === 0) {
          resolve({ ok: true });
          return;
        }
        const error = new Error(`The backup child process exited unsuccessfully (${code ?? signal ?? "unknown"}).`);
        error.childReportedFailure = true;
        reject(error);
      });
    };

    child.on("error", onChildError);
    child.once("exit", onChildExit);
    timeout = setTimeout(() => {
      timedOut = true;
      requestTermination("SIGTERM");
    }, timeoutMs);

    signalSource.once("SIGTERM", onSigterm);
    signalSource.once("SIGINT", onSigint);
  });
}

async function main() {
  try {
    await runScheduledLogicalBackup();
  } catch (error) {
    if (!error?.childReportedFailure) {
      console.error(JSON.stringify(sanitizedFailure(error, "run-scheduled-logical-backup"), null, 2));
    }
    process.exitCode = 1;
  }
}

if (isDirectExecution(import.meta.url)) await main();
