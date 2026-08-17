import { fileURLToPath } from "node:url";
import {
  createRecoveryWriterRetirementController,
} from "./recovery-writer-retirement-controller.js";
import { RecoveryError } from "./recovery-object-utils.js";

const SWEEP_RECEIPT_SCHEMA = "rivt-recovery-writer-retirement-sweep-receipt-v1";
const DEFAULT_OPERATION_TIMEOUT_MS = 30_000;
const MAXIMUM_OPERATION_TIMEOUT_MS = 60_000;

function runnerError(code, message, cause) {
  const error = new RecoveryError(code, message);
  if (cause !== undefined) error.cause = cause;
  return error;
}

function requiredFunction(value, label) {
  if (typeof value !== "function") {
    throw runnerError(
      "RECOVERY_WRITER_RETIREMENT_CONTROLLER_INVALID",
      `The retirement sweep requires ${label}.`,
    );
  }
  return value;
}

function timeoutMs(value) {
  if (
    !Number.isSafeInteger(value)
    || value < 1
    || value > MAXIMUM_OPERATION_TIMEOUT_MS
  ) {
    throw runnerError(
      "RECOVERY_WRITER_RETIREMENT_CONTROLLER_INVALID",
      "The retirement-operation timeout is outside the fixed source limit.",
    );
  }
  return value;
}

function aggregateReceipt(sweep) {
  const stateCounts = {};
  for (const result of sweep.results) {
    stateCounts[result.state] = (stateCounts[result.state] ?? 0) + 1;
  }
  return Object.freeze({
    schema: SWEEP_RECEIPT_SCHEMA,
    ok: sweep.failures.length === 0,
    checkedAt: sweep.checkedAt,
    reconciledCount: sweep.results.length,
    failureCount: sweep.failures.length,
    stateCounts: Object.freeze(stateCounts),
    failureCodes: Object.freeze([...new Set(
      sweep.failures.map(({ code }) => code),
    )].sort()),
  });
}

function boundedRetirementOperation(operation, operationTimeoutMs) {
  return async (context) => {
    const abortController = new AbortController();
    let timeout;
    const timeoutPromise = new Promise((resolve, reject) => {
      timeout = setTimeout(() => {
        abortController.abort();
        reject(runnerError(
          "RECOVERY_WRITER_RETIREMENT_UNVERIFIED",
          "The retirement operation exceeded its fixed source timeout.",
        ));
      }, operationTimeoutMs);
    });
    try {
      return await Promise.race([
        operation(context, Object.freeze({ signal: abortController.signal })),
        timeoutPromise,
      ]);
    } finally {
      clearTimeout(timeout);
      abortController.abort();
    }
  };
}

export async function runRecoveryWriterRetirementSweep({
  store,
  retireAndVerify,
  now = () => new Date(),
  attemptTimeoutMs = 30_000,
  operationTimeoutMs = DEFAULT_OPERATION_TIMEOUT_MS,
  writeReceipt = () => {},
} = {}) {
  const retirementOperation = requiredFunction(retireAndVerify, "retireAndVerify");
  const receiptWriter = requiredFunction(writeReceipt, "writeReceipt");
  const controller = createRecoveryWriterRetirementController({
    store,
    retireAndVerify: boundedRetirementOperation(
      retirementOperation,
      timeoutMs(operationTimeoutMs),
    ),
    now,
    attemptTimeoutMs,
  });
  const sweep = await controller.reconcileDue();
  const receipt = aggregateReceipt(sweep);
  await receiptWriter(receipt);
  if (!receipt.ok) {
    throw runnerError(
      "RECOVERY_WRITER_RETIREMENT_UNVERIFIED",
      "One or more due writer-retirement registrations remain unverified.",
    );
  }
  return receipt;
}

export function unavailableRecoveryWriterRetirementSweep() {
  throw runnerError(
    "RECOVERY_WRITER_RETIREMENT_CONTROLLER_REQUIRED",
    "A separately configured retirement controller is required.",
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    unavailableRecoveryWriterRetirementSweep();
  } catch (error) {
    process.stdout.write(`${JSON.stringify({
      ok: false,
      code: typeof error?.code === "string"
        ? error.code
        : "RECOVERY_WRITER_RETIREMENT_CONTROLLER_REQUIRED",
      message: "Writer-retirement sweep is unavailable without reviewed controller injection.",
    })}\n`);
    process.exitCode = 1;
  }
}

export const recoveryWriterRetirementSweepInternals = Object.freeze({
  receiptSchema: SWEEP_RECEIPT_SCHEMA,
  defaultOperationTimeoutMs: DEFAULT_OPERATION_TIMEOUT_MS,
  maximumOperationTimeoutMs: MAXIMUM_OPERATION_TIMEOUT_MS,
});
