import { RecoveryError } from "./recovery-object-utils.js";

const RECOVERY_WRITER_AUTHORIZATION_LEASES = new WeakSet();

function lifecycleError(code, message, cause) {
  const error = new RecoveryError(code, message);
  if (cause !== undefined) error.cause = cause;
  return error;
}

function requiredFunction(value, name) {
  if (typeof value !== "function") {
    throw lifecycleError(
      "RECOVERY_WRITER_AUTHORIZATION_INVALID",
      `Protected-writer authorization requires a ${name} operation.`,
    );
  }
  return value;
}

/**
 * Creates a provider-neutral authorization lease without performing I/O.
 *
 * A future provider adapter supplies the two injected operations. Keeping the
 * revoker in the lease before activate() is called means an activation that
 * throws after an ambiguous provider mutation can still be retired safely.
 */
export function createRecoveryWriterAuthorizationLease({
  activate,
  revokeAndVerify,
} = {}) {
  const activateOperation = requiredFunction(activate, "activate");
  const revokeOperation = requiredFunction(revokeAndVerify, "revokeAndVerify");
  let phase = "prepared";
  let activationAttempted = false;
  let authorizationReceipt;
  let revocationPromise;

  const lease = Object.freeze({
    get phase() {
      return phase;
    },
    async activate(context) {
      if (phase !== "prepared") {
        throw lifecycleError(
          "RECOVERY_WRITER_AUTHORIZATION_INVALID",
          "Protected-writer authorization can be activated exactly once.",
        );
      }
      activationAttempted = true;
      phase = "activation_attempted";
      try {
        authorizationReceipt = await activateOperation(context);
        phase = "active";
        return authorizationReceipt;
      } catch (error) {
        phase = "activation_ambiguous";
        throw error;
      }
    },
    async revokeAndVerify(context) {
      if (!activationAttempted) {
        throw lifecycleError(
          "RECOVERY_WRITER_REVOCATION_UNVERIFIED",
          "Protected-writer revocation was requested before activation was attempted.",
        );
      }
      if (revocationPromise) return revocationPromise;
      const activationOutcome = phase;
      phase = "revoking";
      revocationPromise = (async () => {
        try {
          const receipt = await revokeOperation(Object.freeze({
            ...context,
            authorizationReceipt,
            activationOutcome,
          }));
          phase = "revoked";
          return receipt;
        } catch (error) {
          phase = "revocation_unverified";
          throw lifecycleError(
            "RECOVERY_WRITER_REVOCATION_UNVERIFIED",
            "Protected-writer authority could not be proven inert after the attempt.",
            error,
          );
        }
      })();
      return revocationPromise;
    },
  });
  RECOVERY_WRITER_AUTHORIZATION_LEASES.add(lease);
  return lease;
}

export function assertRecoveryWriterAuthorizationLease(value) {
  if (
    !value
    || !RECOVERY_WRITER_AUTHORIZATION_LEASES.has(value)
    || typeof value.activate !== "function"
    || typeof value.revokeAndVerify !== "function"
  ) {
    throw lifecycleError(
      "RECOVERY_WRITER_AUTHORIZATION_INVALID",
      "The protected-writer adapter did not return a revocable authorization lease.",
    );
  }
  return value;
}
