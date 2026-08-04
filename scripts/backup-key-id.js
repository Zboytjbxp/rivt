import "dotenv/config";
import {
  encryptionKeyIdFromSecret,
  isDirectExecution,
  requireStrictActiveBackupEncryptionSecret,
  sanitizedFailure,
} from "./logical-backup-utils.js";

export function backupKeyIdReceipt(env = process.env) {
  const secret = requireStrictActiveBackupEncryptionSecret(env);
  return {
    ok: true,
    mode: "backup-key-id",
    keyId: encryptionKeyIdFromSecret(secret),
  };
}

async function main() {
  try {
    console.log(JSON.stringify(backupKeyIdReceipt(), null, 2));
  } catch (error) {
    console.error(JSON.stringify(sanitizedFailure(error, "backup-key-id"), null, 2));
    process.exitCode = 1;
  }
}

if (isDirectExecution(import.meta.url)) await main();
