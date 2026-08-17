import { RecoveryError } from "./recovery-object-utils.js";

const CLIENTS = new WeakSet();
const RECORD_SCHEMA = "rivt-recovery-writer-retirement-record-v1";
const REGISTRATION_RECEIPT_SCHEMA =
  "rivt-recovery-writer-retirement-registration-receipt-v1";
const RETIREMENT_RECEIPT_SCHEMA = "rivt-recovery-writer-retirement-receipt-v1";
const RETIREMENT_PROOF_SCHEMA = "rivt-recovery-writer-retirement-proof-v1";
const RETIREMENT_OPERATION_SCHEMA = "rivt-recovery-writer-retirement-operation-v1";
const RETIREMENT_STATUS_SCHEMA = "rivt-recovery-writer-retirement-status-v1";
const RECONCILIATION_SWEEP_SCHEMA = "rivt-recovery-writer-retirement-sweep-v1";
const DEFAULT_ATTEMPT_TIMEOUT_MS = 30_000;
const MAX_RETIREMENT_DESCRIPTOR_REFERENCE_BYTES = 2_048;

export const RECOVERY_WRITER_CONTROL_EVIDENCE_LEVELS = Object.freeze({
  PROVIDERLESS_INJECTED_FAKE: "providerless-injected-fake",
  AWS_CONTROL_PLANE_READBACK_AND_SIMULATION:
    "aws-control-plane-readback-and-simulation",
  LIVE_AWS_CONTROL_AND_DATA_PLANE: "live-aws-control-and-data-plane",
});

const EVIDENCE_LEVELS = new Set(Object.values(RECOVERY_WRITER_CONTROL_EVIDENCE_LEVELS));
const SOURCE_ONLY_EVIDENCE_LEVEL =
  RECOVERY_WRITER_CONTROL_EVIDENCE_LEVELS.PROVIDERLESS_INJECTED_FAKE;
const RETIREMENT_TRIGGERS = new Set(["writer-requested", "write-window-expired"]);
const WRITER_OUTCOMES = new Set(["completed", "failed", "abandoned-or-unknown"]);
const RECORD_STATES = new Set([
  "registered",
  "retirement_requested",
  "retiring",
  "retirement_unverified",
  "quarantined",
  "retired",
]);
const DUE_STATES = Object.freeze([
  "registered",
  "retirement_requested",
  "retiring",
  "retirement_unverified",
  "quarantined",
]);

function controllerError(code, message, cause) {
  const error = new RecoveryError(code, message);
  if (cause !== undefined) error.cause = cause;
  return error;
}

function plainObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw controllerError(
      "RECOVERY_WRITER_RETIREMENT_CONTROLLER_INVALID",
      `${label} must be an object.`,
    );
  }
  return value;
}

function requiredFunction(value, label) {
  if (typeof value !== "function") {
    throw controllerError(
      "RECOVERY_WRITER_RETIREMENT_CONTROLLER_INVALID",
      `Writer-retirement control requires a ${label} operation.`,
    );
  }
  return value;
}

function runId(value) {
  if (typeof value !== "string" || !/^run-[a-f0-9]{48}$/u.test(value)) {
    throw controllerError(
      "RECOVERY_WRITER_RETIREMENT_CONTROLLER_INVALID",
      "Writer-retirement runId must use the canonical run identifier format.",
    );
  }
  return value;
}

function sha256(value, label) {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/u.test(value)) {
    throw controllerError(
      "RECOVERY_WRITER_RETIREMENT_CONTROLLER_INVALID",
      `${label} must be a lowercase SHA-256 digest.`,
    );
  }
  return value;
}

function runNonce(value) {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/u.test(value)) {
    throw controllerError(
      "RECOVERY_WRITER_RETIREMENT_CONTROLLER_INVALID",
      "Writer-retirement runNonce must be 64 lowercase hexadecimal characters.",
    );
  }
  return value;
}

function canonicalIso(value, label) {
  const candidate = value instanceof Date ? value.toISOString() : value;
  if (
    typeof candidate !== "string"
    || Number.isNaN(Date.parse(candidate))
    || new Date(candidate).toISOString() !== candidate
  ) {
    throw controllerError(
      "RECOVERY_WRITER_RETIREMENT_CONTROLLER_INVALID",
      `${label} must be a canonical UTC timestamp.`,
    );
  }
  return candidate;
}

function nullableIso(value, label) {
  return value === null ? null : canonicalIso(value, label);
}

function safeInteger(value, label, minimum = 0) {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw controllerError(
      "RECOVERY_WRITER_RETIREMENT_CONTROLLER_INVALID",
      `${label} must be a safe integer of at least ${minimum}.`,
    );
  }
  return value;
}

function nullableString(value, label) {
  if (value === null) return null;
  if (typeof value !== "string" || !value || value.length > 128) {
    throw controllerError(
      "RECOVERY_WRITER_RETIREMENT_CONTROLLER_INVALID",
      `${label} is invalid.`,
    );
  }
  return value;
}

function retirementDescriptorReference(value) {
  if (
    typeof value !== "string"
    || !value
    || /[\u0000-\u001f\u007f-\u009f]/u.test(value)
    || Buffer.byteLength(value, "utf8") > MAX_RETIREMENT_DESCRIPTOR_REFERENCE_BYTES
  ) {
    throw controllerError(
      "RECOVERY_WRITER_RETIREMENT_CONTROLLER_INVALID",
      "Writer-retirement descriptor reference must be a bounded, non-control string.",
    );
  }
  return value;
}

function evidenceLevel(value) {
  if (!EVIDENCE_LEVELS.has(value)) {
    throw controllerError(
      "RECOVERY_WRITER_RETIREMENT_EVIDENCE_LEVEL_INVALID",
      "Writer-control evidence level is invalid.",
    );
  }
  return value;
}

function retirementTrigger(value) {
  if (!RETIREMENT_TRIGGERS.has(value)) {
    throw controllerError(
      "RECOVERY_WRITER_RETIREMENT_CONTROLLER_INVALID",
      "Writer-retirement trigger is invalid.",
    );
  }
  return value;
}

function writerOutcome(value) {
  if (!WRITER_OUTCOMES.has(value)) {
    throw controllerError(
      "RECOVERY_WRITER_RETIREMENT_CONTROLLER_INVALID",
      "Writer outcome is invalid.",
    );
  }
  return value;
}

function normalizePublicBinding(value, label) {
  const candidate = plainObject(value, label);
  return Object.freeze({
    runId: runId(candidate.runId),
    runNonce: runNonce(candidate.runNonce),
    bindingDigestSha256: sha256(
      candidate.bindingDigestSha256,
      "Writer-retirement bindingDigestSha256",
    ),
    writerControlEvidenceLevel: evidenceLevel(candidate.writerControlEvidenceLevel),
    retirementDescriptorIdentitySha256: sha256(
      candidate.retirementDescriptorIdentitySha256,
      "Writer-retirement descriptor identity",
    ),
  });
}

function orderedDeadlines(value) {
  const candidate = plainObject(value, "Writer-retirement deadline contract");
  const retirementDeadlineAt = canonicalIso(
    candidate.retirementDeadlineAt,
    "Writer-retirement deadline",
  );
  const retirementProofDeadlineAt = canonicalIso(
    candidate.retirementProofDeadlineAt,
    "Writer-retirement proof deadline",
  );
  const writerSessionExpiresAt = canonicalIso(
    candidate.writerSessionExpiresAt,
    "Writer session expiration",
  );
  if (!(
    retirementDeadlineAt < retirementProofDeadlineAt
    && retirementProofDeadlineAt < writerSessionExpiresAt
  )) {
    throw controllerError(
      "RECOVERY_WRITER_RETIREMENT_CONTROLLER_INVALID",
      "Writer-retirement deadlines must precede proof deadline and session expiration.",
    );
  }
  return Object.freeze({
    retirementDeadlineAt,
    retirementProofDeadlineAt,
    writerSessionExpiresAt,
  });
}

function normalizeRegistration(value, { sourceOnly = false } = {}) {
  const candidate = plainObject(value, "Writer-retirement registration");
  const publicBinding = normalizePublicBinding(candidate, "Writer-retirement registration");
  const deadlines = orderedDeadlines(candidate);
  const normalized = Object.freeze({
    ...publicBinding,
    retirementDescriptorReference: retirementDescriptorReference(
      candidate.retirementDescriptorReference,
    ),
    ...deadlines,
  });
  if (sourceOnly && normalized.writerControlEvidenceLevel !== SOURCE_ONLY_EVIDENCE_LEVEL) {
    throw controllerError(
      "RECOVERY_WRITER_RETIREMENT_EVIDENCE_LEVEL_INVALID",
      "The provider-neutral source controller can emit only injected-fake evidence.",
    );
  }
  return normalized;
}

function normalizeRetirementRequest(value, binding) {
  const candidate = plainObject(value, "Writer-retirement request");
  const combined = binding ? { ...binding, ...candidate } : candidate;
  const publicBinding = normalizePublicBinding(combined, "Writer-retirement request");
  const normalized = Object.freeze({
    ...publicBinding,
    retirementTrigger: retirementTrigger(combined.retirementTrigger),
    writerOutcome: writerOutcome(combined.writerOutcome),
  });
  if (
    normalized.retirementTrigger === "write-window-expired"
    && normalized.writerOutcome !== "abandoned-or-unknown"
  ) {
    throw controllerError(
      "RECOVERY_WRITER_RETIREMENT_CONTROLLER_INVALID",
      "An expired write window can only record an abandoned-or-unknown outcome.",
    );
  }
  if (binding && !sameBinding(binding, normalized)) {
    throw controllerError(
      "RECOVERY_WRITER_RETIREMENT_BINDING_CONFLICT",
      "Writer-retirement request does not match its durable registration.",
    );
  }
  return normalized;
}

function sameBinding(left, right) {
  return (
    left.runId === right.runId
    && left.runNonce === right.runNonce
    && left.bindingDigestSha256 === right.bindingDigestSha256
    && left.writerControlEvidenceLevel === right.writerControlEvidenceLevel
    && left.retirementDescriptorIdentitySha256
      === right.retirementDescriptorIdentitySha256
  );
}

function sameRegistration(left, right) {
  return sameBinding(left, right)
    && left.retirementDescriptorReference === right.retirementDescriptorReference
    && left.retirementDeadlineAt === right.retirementDeadlineAt
    && left.retirementProofDeadlineAt === right.retirementProofDeadlineAt
    && left.writerSessionExpiresAt === right.writerSessionExpiresAt;
}

function sameRetirementRequest(left, right) {
  return sameBinding(left, right)
    && left.retirementTrigger === right.retirementTrigger
    && left.writerOutcome === right.writerOutcome;
}

function positiveRevisionFields(candidate) {
  return {
    revision: safeInteger(candidate.revision, "Writer-retirement revision", 1),
    fencingToken: safeInteger(
      candidate.fencingToken,
      "Writer-retirement fencingToken",
      1,
    ),
  };
}

function registrationReceipt(value, expected) {
  const candidate = plainObject(value, "Writer-retirement registration receipt");
  if (candidate.schema !== REGISTRATION_RECEIPT_SCHEMA) {
    throw controllerError(
      "RECOVERY_WRITER_RETIREMENT_CONTROLLER_INVALID",
      "Writer-retirement registration receipt schema is invalid.",
    );
  }
  const binding = normalizePublicBinding(
    candidate,
    "Writer-retirement registration receipt",
  );
  const deadlines = orderedDeadlines(candidate);
  if (
    !sameBinding(binding, expected)
    || deadlines.retirementDeadlineAt !== expected.retirementDeadlineAt
    || deadlines.retirementProofDeadlineAt !== expected.retirementProofDeadlineAt
    || deadlines.writerSessionExpiresAt !== expected.writerSessionExpiresAt
    || candidate.state !== "registered"
  ) {
    throw controllerError(
      "RECOVERY_WRITER_RETIREMENT_BINDING_CONFLICT",
      "Writer-retirement registration receipt does not match the requested binding.",
    );
  }
  const revisions = positiveRevisionFields(candidate);
  return Object.freeze({
    schema: REGISTRATION_RECEIPT_SCHEMA,
    ...binding,
    ...deadlines,
    state: "registered",
    ...revisions,
    registeredAt: canonicalIso(candidate.registeredAt, "Writer-retirement registration time"),
  });
}

function retirementReceipt(value, expected) {
  const candidate = plainObject(value, "Writer-retirement receipt");
  if (candidate.schema !== RETIREMENT_RECEIPT_SCHEMA || candidate.state !== "retired") {
    throw controllerError(
      "RECOVERY_WRITER_RETIREMENT_UNVERIFIED",
      "Writer-retirement operation did not return a terminal retirement receipt.",
    );
  }
  const request = normalizeRetirementRequest(candidate);
  if (!sameRetirementRequest(request, expected)) {
    throw controllerError(
      "RECOVERY_WRITER_RETIREMENT_BINDING_CONFLICT",
      "Writer-retirement receipt does not match the requested binding and outcome.",
    );
  }
  const expectedCompletionEligibility = request.writerOutcome === "completed";
  if (candidate.completionEligible !== expectedCompletionEligibility) {
    throw controllerError(
      "RECOVERY_WRITER_RETIREMENT_UNVERIFIED",
      "Writer-retirement completion eligibility is inconsistent with the writer outcome.",
    );
  }
  const revisions = positiveRevisionFields(candidate);
  return Object.freeze({
    schema: RETIREMENT_RECEIPT_SCHEMA,
    ...request,
    state: "retired",
    completionEligible: expectedCompletionEligibility,
    ...revisions,
    retiredAt: canonicalIso(candidate.retiredAt, "Writer-retirement verification time"),
    retirementVerificationSha256: sha256(
      candidate.retirementVerificationSha256,
      "Writer-retirement verification digest",
    ),
  });
}

/**
 * Creates a branded transport client without performing I/O. The injected
 * operations can later be backed by a genuinely independent controller.
 */
export function createRecoveryWriterRetirementControllerClient({
  register,
  requestRetirementAndWait,
} = {}) {
  const registerOperation = requiredFunction(register, "register");
  const retirementOperation = requiredFunction(
    requestRetirementAndWait,
    "requestRetirementAndWait",
  );
  let phase = "prepared";
  let binding;
  let durableRegistrationReceipt;
  let requestedRetirement;
  let retirementPromise;

  const client = Object.freeze({
    get phase() {
      return phase;
    },
    async register(context) {
      if (phase !== "prepared") {
        throw controllerError(
          "RECOVERY_WRITER_RETIREMENT_CONTROLLER_INVALID",
          "Writer-retirement control can be registered exactly once.",
        );
      }
      binding = normalizeRegistration(context);
      phase = "registering";
      try {
        durableRegistrationReceipt = registrationReceipt(
          await registerOperation(binding),
          binding,
        );
        phase = "registered";
        return durableRegistrationReceipt;
      } catch (error) {
        // A lost response can make registration durable even when this process
        // saw an error. Preserve the binding so retirement can still be asked
        // for before any writer adapter is opened.
        phase = "registration_ambiguous";
        throw controllerError(
          "RECOVERY_WRITER_RETIREMENT_REGISTRATION_FAILED",
          "Writer-retirement registration could not be proven durable.",
          error,
        );
      }
    },
    async requestRetirementAndWait(context) {
      if (!binding) {
        throw controllerError(
          "RECOVERY_WRITER_RETIREMENT_CONTROLLER_INVALID",
          "Writer-retirement cannot be requested before registration is attempted.",
        );
      }
      const request = normalizeRetirementRequest(context, binding);
      if (retirementPromise) {
        if (!sameRetirementRequest(request, requestedRetirement)) {
          throw controllerError(
            "RECOVERY_WRITER_RETIREMENT_BINDING_CONFLICT",
            "Writer-retirement was already requested with a different outcome.",
          );
        }
        return retirementPromise;
      }
      requestedRetirement = request;
      phase = "retirement_requested";
      retirementPromise = (async () => {
        try {
          const operationContext = durableRegistrationReceipt
            ? Object.freeze({ ...request, registrationReceipt: durableRegistrationReceipt })
            : request;
          const receipt = retirementReceipt(
            await retirementOperation(operationContext),
            request,
          );
          phase = "retired";
          return receipt;
        } catch (error) {
          phase = "retirement_unverified";
          throw controllerError(
            "RECOVERY_WRITER_RETIREMENT_UNVERIFIED",
            "Independent writer retirement could not be proven complete.",
            error,
          );
        }
      })();
      return retirementPromise;
    },
  });
  CLIENTS.add(client);
  return client;
}

export function assertRecoveryWriterRetirementControllerClient(value) {
  if (
    !value
    || !CLIENTS.has(value)
    || typeof value.register !== "function"
    || typeof value.requestRetirementAndWait !== "function"
  ) {
    throw controllerError(
      "RECOVERY_WRITER_RETIREMENT_CONTROLLER_INVALID",
      "Writer-retirement adapter did not return a branded controller client.",
    );
  }
  return value;
}

function normalizeRecord(value) {
  const candidate = plainObject(value, "Writer-retirement store record");
  if (candidate.schema !== RECORD_SCHEMA || !RECORD_STATES.has(candidate.state)) {
    throw controllerError(
      "RECOVERY_WRITER_RETIREMENT_CONTROLLER_INVALID",
      "Writer-retirement store record schema or state is invalid.",
    );
  }
  const publicBinding = normalizePublicBinding(
    candidate,
    "Writer-retirement store record",
  );
  const deadlines = orderedDeadlines(candidate);
  const record = {
    schema: RECORD_SCHEMA,
    ...publicBinding,
    retirementDescriptorReference: retirementDescriptorReference(
      candidate.retirementDescriptorReference,
    ),
    ...deadlines,
    state: candidate.state,
    ...positiveRevisionFields(candidate),
    registeredAt: canonicalIso(candidate.registeredAt, "Writer-retirement registration time"),
    retirementRequestedAt: nullableIso(
      candidate.retirementRequestedAt,
      "Writer-retirement request time",
    ),
    retirementTrigger: candidate.retirementTrigger === null
      ? null
      : retirementTrigger(candidate.retirementTrigger),
    writerOutcome: candidate.writerOutcome === null
      ? null
      : writerOutcome(candidate.writerOutcome),
    retiringAt: nullableIso(candidate.retiringAt, "Writer-retirement attempt time"),
    attemptLeaseExpiresAt: nullableIso(
      candidate.attemptLeaseExpiresAt,
      "Writer-retirement attempt lease",
    ),
    retirementAttempts: safeInteger(
      candidate.retirementAttempts,
      "Writer-retirement attempt count",
    ),
    retiredAt: nullableIso(candidate.retiredAt, "Writer-retirement verification time"),
    retirementVerificationSha256: candidate.retirementVerificationSha256 === null
      ? null
      : sha256(
        candidate.retirementVerificationSha256,
        "Writer-retirement verification digest",
      ),
    completionEligible: candidate.completionEligible,
    lastFailureCode: nullableString(
      candidate.lastFailureCode,
      "Writer-retirement failure code",
    ),
    quarantinedAt: nullableIso(candidate.quarantinedAt, "Writer-retirement quarantine time"),
    quarantineReason: nullableString(
      candidate.quarantineReason,
      "Writer-retirement quarantine reason",
    ),
  };
  if (record.writerControlEvidenceLevel !== SOURCE_ONLY_EVIDENCE_LEVEL) {
    throw controllerError(
      "RECOVERY_WRITER_RETIREMENT_EVIDENCE_LEVEL_INVALID",
      "The provider-neutral store cannot contain asserted AWS evidence.",
    );
  }
  if (typeof record.completionEligible !== "boolean") {
    throw controllerError(
      "RECOVERY_WRITER_RETIREMENT_CONTROLLER_INVALID",
      "Writer-retirement completion eligibility must be boolean.",
    );
  }
  assertRecordState(record);
  return Object.freeze(record);
}

function assertRecordState(record) {
  const hasRequest = (
    record.retirementRequestedAt !== null
    && record.retirementTrigger !== null
    && record.writerOutcome !== null
  );
  if (
    record.retirementTrigger === "write-window-expired"
    && record.writerOutcome !== "abandoned-or-unknown"
  ) {
    throw controllerError(
      "RECOVERY_WRITER_RETIREMENT_CONTROLLER_INVALID",
      "Expired writer windows must remain abandoned-or-unknown.",
    );
  }
  if (
    record.writerOutcome === "completed"
    && record.retirementRequestedAt !== null
    && record.retirementRequestedAt >= record.retirementDeadlineAt
  ) {
    throw controllerError(
      "RECOVERY_WRITER_RETIREMENT_CONTROLLER_INVALID",
      "A completed outcome cannot be recorded at or after the write-window deadline.",
    );
  }
  if (record.state === "registered" && (
    hasRequest
    || record.retirementAttempts !== 0
    || record.retiringAt !== null
    || record.attemptLeaseExpiresAt !== null
    || record.retiredAt !== null
    || record.retirementVerificationSha256 !== null
    || record.completionEligible
  )) {
    throw controllerError(
      "RECOVERY_WRITER_RETIREMENT_CONTROLLER_INVALID",
      "Registered writer-retirement record contains premature lifecycle evidence.",
    );
  }
  if (record.state !== "registered" && !hasRequest) {
    throw controllerError(
      "RECOVERY_WRITER_RETIREMENT_CONTROLLER_INVALID",
      "Writer-retirement record is missing its retirement request binding.",
    );
  }
  if (record.state === "retiring" && (
    record.retiringAt === null || record.attemptLeaseExpiresAt === null
  )) {
    throw controllerError(
      "RECOVERY_WRITER_RETIREMENT_CONTROLLER_INVALID",
      "Retiring record is missing its fenced attempt lease.",
    );
  }
  if (record.state === "retirement_unverified" && record.lastFailureCode === null) {
    throw controllerError(
      "RECOVERY_WRITER_RETIREMENT_CONTROLLER_INVALID",
      "Unverified retirement is missing its privacy-safe failure code.",
    );
  }
  if (record.state === "quarantined" && (
    record.quarantinedAt === null || record.quarantineReason === null
  )) {
    throw controllerError(
      "RECOVERY_WRITER_RETIREMENT_CONTROLLER_INVALID",
      "Quarantined retirement is missing its quarantine evidence.",
    );
  }
  if (record.state === "retired") {
    if (record.retiredAt === null || record.retirementVerificationSha256 === null) {
      throw controllerError(
        "RECOVERY_WRITER_RETIREMENT_CONTROLLER_INVALID",
        "Retired authority is missing verification evidence.",
      );
    }
    if (record.completionEligible !== (record.writerOutcome === "completed")) {
      throw controllerError(
        "RECOVERY_WRITER_RETIREMENT_CONTROLLER_INVALID",
        "Retired record has inconsistent completion eligibility.",
      );
    }
  } else if (record.completionEligible) {
    throw controllerError(
      "RECOVERY_WRITER_RETIREMENT_CONTROLLER_INVALID",
      "Only a verified retired record can become completion-eligible.",
    );
  }
}

function initialRecord(binding, registeredAt) {
  return normalizeRecord({
    schema: RECORD_SCHEMA,
    ...binding,
    state: "registered",
    revision: 1,
    fencingToken: 1,
    registeredAt,
    retirementRequestedAt: null,
    retirementTrigger: null,
    writerOutcome: null,
    retiringAt: null,
    attemptLeaseExpiresAt: null,
    retirementAttempts: 0,
    retiredAt: null,
    retirementVerificationSha256: null,
    completionEligible: false,
    lastFailureCode: null,
    quarantinedAt: null,
    quarantineReason: null,
  });
}

function nextRecord(record, patch) {
  return normalizeRecord({
    ...record,
    ...patch,
    revision: record.revision + 1,
    fencingToken: record.fencingToken + 1,
  });
}

function sameNormalizedRecord(left, right) {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  return leftKeys.length === rightKeys.length
    && rightKeys.every((key) => Object.hasOwn(left, key) && Object.is(left[key], right[key]));
}

function registrationReceiptFromRecord(record) {
  return Object.freeze({
    schema: REGISTRATION_RECEIPT_SCHEMA,
    runId: record.runId,
    runNonce: record.runNonce,
    bindingDigestSha256: record.bindingDigestSha256,
    writerControlEvidenceLevel: record.writerControlEvidenceLevel,
    retirementDescriptorIdentitySha256: record.retirementDescriptorIdentitySha256,
    retirementDeadlineAt: record.retirementDeadlineAt,
    retirementProofDeadlineAt: record.retirementProofDeadlineAt,
    writerSessionExpiresAt: record.writerSessionExpiresAt,
    state: record.state,
    revision: record.revision,
    fencingToken: record.fencingToken,
    registeredAt: record.registeredAt,
  });
}

function retirementReceiptFromRecord(record) {
  if (record.state !== "retired") {
    throw controllerError(
      "RECOVERY_WRITER_RETIREMENT_UNVERIFIED",
      "Writer authority is not yet proven retired.",
    );
  }
  return Object.freeze({
    schema: RETIREMENT_RECEIPT_SCHEMA,
    runId: record.runId,
    runNonce: record.runNonce,
    bindingDigestSha256: record.bindingDigestSha256,
    writerControlEvidenceLevel: record.writerControlEvidenceLevel,
    retirementDescriptorIdentitySha256: record.retirementDescriptorIdentitySha256,
    state: "retired",
    retirementTrigger: record.retirementTrigger,
    writerOutcome: record.writerOutcome,
    completionEligible: record.completionEligible,
    revision: record.revision,
    fencingToken: record.fencingToken,
    retiredAt: record.retiredAt,
    retirementVerificationSha256: record.retirementVerificationSha256,
  });
}

function operationalStatusFromRecord(record) {
  return Object.freeze({
    schema: RETIREMENT_STATUS_SCHEMA,
    runId: record.runId,
    writerControlEvidenceLevel: record.writerControlEvidenceLevel,
    retirementDescriptorIdentitySha256: record.retirementDescriptorIdentitySha256,
    retirementDeadlineAt: record.retirementDeadlineAt,
    retirementProofDeadlineAt: record.retirementProofDeadlineAt,
    writerSessionExpiresAt: record.writerSessionExpiresAt,
    state: record.state,
    revision: record.revision,
    fencingToken: record.fencingToken,
    registeredAt: record.registeredAt,
    retirementRequestedAt: record.retirementRequestedAt,
    retirementTrigger: record.retirementTrigger,
    writerOutcome: record.writerOutcome,
    retiringAt: record.retiringAt,
    attemptLeaseExpiresAt: record.attemptLeaseExpiresAt,
    retirementAttempts: record.retirementAttempts,
    retiredAt: record.retiredAt,
    completionEligible: record.completionEligible,
    lastFailureCode: record.lastFailureCode,
    quarantinedAt: record.quarantinedAt,
    quarantineReason: record.quarantineReason,
  });
}

function normalizeProof(value, operation) {
  const candidate = plainObject(value, "Writer-retirement proof");
  if (
    candidate.schema !== RETIREMENT_PROOF_SCHEMA
    || candidate.retired !== true
    || candidate.runId !== operation.runId
    || candidate.runNonce !== operation.runNonce
    || candidate.bindingDigestSha256 !== operation.bindingDigestSha256
    || candidate.writerControlEvidenceLevel !== SOURCE_ONLY_EVIDENCE_LEVEL
    || candidate.retirementDescriptorIdentitySha256
      !== operation.retirementDescriptorIdentitySha256
    || candidate.fencingToken !== operation.fencingToken
  ) {
    throw controllerError(
      "RECOVERY_WRITER_RETIREMENT_UNVERIFIED",
      "Writer-retirement proof does not match the fenced operation.",
    );
  }
  const verifiedAt = canonicalIso(candidate.verifiedAt, "Writer-retirement proof time");
  if (
    verifiedAt < operation.retiringAt
    || verifiedAt > operation.retirementProofDeadlineAt
  ) {
    throw controllerError(
      "RECOVERY_WRITER_RETIREMENT_UNVERIFIED",
      "Writer-retirement proof falls outside its fenced attempt window.",
    );
  }
  return Object.freeze({
    verifiedAt,
    retirementVerificationSha256: sha256(
      candidate.retirementVerificationSha256,
      "Writer-retirement verification digest",
    ),
  });
}

/**
 * Creates a deterministic reconciliation state machine over an injected
 * durable store. Construction and every exported assertion are I/O-free.
 *
 * Store contract:
 * - create(record): atomically create-if-absent and return created/existing record
 * - load(runId): return a record or null
 * - compareExchange({runId, expectedRevision, expectedFencingToken, next}):
 *   atomically return next on success or null on a stale revision/fence
 * - listDue({at, states}): return candidate records for reconciliation
 */
export function createRecoveryWriterRetirementController({
  store,
  retireAndVerify,
  now = () => new Date(),
  attemptTimeoutMs = DEFAULT_ATTEMPT_TIMEOUT_MS,
} = {}) {
  const storeObject = plainObject(store, "Writer-retirement store");
  const createOperation = requiredFunction(storeObject.create, "store.create").bind(storeObject);
  const loadOperation = requiredFunction(storeObject.load, "store.load").bind(storeObject);
  const compareExchangeOperation = requiredFunction(
    storeObject.compareExchange,
    "store.compareExchange",
  ).bind(storeObject);
  const listDueOperation = requiredFunction(storeObject.listDue, "store.listDue").bind(storeObject);
  const retirementOperation = requiredFunction(retireAndVerify, "retireAndVerify");
  const clock = requiredFunction(now, "now");
  safeInteger(attemptTimeoutMs, "Writer-retirement attempt timeout", 1);

  function clockIso() {
    return canonicalIso(clock(), "Writer-retirement controller clock");
  }

  async function loadRequired(identifier) {
    let value;
    try {
      value = await loadOperation(runId(identifier));
    } catch (error) {
      throw controllerError(
        "RECOVERY_WRITER_RETIREMENT_STORE_UNAVAILABLE",
        "Writer-retirement record could not be loaded.",
        error,
      );
    }
    if (value === null || value === undefined) {
      throw controllerError(
        "RECOVERY_WRITER_RETIREMENT_NOT_FOUND",
        "Writer-retirement registration was not found.",
      );
    }
    const record = normalizeRecord(value);
    if (record.runId !== identifier) {
      throw controllerError(
        "RECOVERY_WRITER_RETIREMENT_BINDING_CONFLICT",
        "Writer-retirement store returned a different run binding.",
      );
    }
    return record;
  }

  async function compareExchange(record, next) {
    let value;
    try {
      value = await compareExchangeOperation(Object.freeze({
        runId: record.runId,
        expectedRevision: record.revision,
        expectedFencingToken: record.fencingToken,
        next,
      }));
    } catch (error) {
      throw controllerError(
        "RECOVERY_WRITER_RETIREMENT_STORE_UNAVAILABLE",
        "Writer-retirement state could not be advanced atomically.",
        error,
      );
    }
    if (value === null || value === undefined) return null;
    const stored = normalizeRecord(value);
    if (!sameNormalizedRecord(stored, next)) {
      throw controllerError(
        "RECOVERY_WRITER_RETIREMENT_STALE_WRITE",
        "Writer-retirement store returned a mutated CAS result.",
      );
    }
    return stored;
  }

  async function quarantineBindingConflict(record, reason) {
    if (record.state === "retired") return record;
    if (record.state === "quarantined") return record;
    const quarantinedAt = clockIso();
    const quarantined = nextRecord(record, {
      state: "quarantined",
      retirementRequestedAt: quarantinedAt,
      retirementTrigger: "write-window-expired",
      writerOutcome: "abandoned-or-unknown",
      retiringAt: null,
      attemptLeaseExpiresAt: null,
      completionEligible: false,
      lastFailureCode: null,
      quarantinedAt,
      quarantineReason: reason,
    });
    const stored = await compareExchange(record, quarantined);
    if (!stored) {
      throw controllerError(
        "RECOVERY_WRITER_RETIREMENT_STALE_WRITE",
        "Writer-retirement quarantine lost its revision or fencing token.",
      );
    }
    return stored;
  }

  async function register(context) {
    const binding = normalizeRegistration(context, { sourceOnly: true });
    const candidate = initialRecord(binding, clockIso());
    let storedValue;
    try {
      storedValue = await createOperation(candidate);
    } catch (error) {
      throw controllerError(
        "RECOVERY_WRITER_RETIREMENT_REGISTRATION_FAILED",
        "Writer-retirement registration could not be made durable.",
        error,
      );
    }
    const stored = normalizeRecord(storedValue);
    if (!sameRegistration(stored, binding)) {
      await quarantineBindingConflict(stored, "conflicting-registration-binding");
      throw controllerError(
        "RECOVERY_WRITER_RETIREMENT_BINDING_CONFLICT",
        "Writer-retirement run identifier is already bound to different authority.",
      );
    }
    return registrationReceiptFromRecord(stored);
  }

  async function requestRetirementRecord(context) {
    const request = normalizeRetirementRequest(context);
    let record = await loadRequired(request.runId);
    if (!sameBinding(record, request)) {
      await quarantineBindingConflict(record, "conflicting-retirement-binding");
      throw controllerError(
        "RECOVERY_WRITER_RETIREMENT_BINDING_CONFLICT",
        "Writer-retirement request does not match the durable run binding.",
      );
    }
    if (record.state === "retired") {
      if (sameRetirementRequest(record, request)) return record;
      throw controllerError(
        "RECOVERY_WRITER_RETIREMENT_TERMINAL",
        "Verified retired authority cannot be finalized with a different outcome.",
      );
    }
    if (record.state === "quarantined") {
      throw controllerError(
        "RECOVERY_WRITER_RETIREMENT_TERMINAL",
        "A quarantined run cannot become writer-complete.",
      );
    }
    if (record.state !== "registered") {
      if (sameRetirementRequest(record, request)) return record;
      throw controllerError(
        "RECOVERY_WRITER_RETIREMENT_BINDING_CONFLICT",
        "Writer retirement is already pending with a different outcome.",
      );
    }
    const requestedAt = clockIso();
    const writeWindowExpired = requestedAt >= record.retirementDeadlineAt;
    const requested = nextRecord(record, {
      state: "retirement_requested",
      retirementRequestedAt: requestedAt,
      retirementTrigger: writeWindowExpired
        ? "write-window-expired"
        : request.retirementTrigger,
      writerOutcome: writeWindowExpired
        ? "abandoned-or-unknown"
        : request.writerOutcome,
      retiringAt: null,
      attemptLeaseExpiresAt: null,
      completionEligible: false,
      lastFailureCode: null,
    });
    record = await compareExchange(record, requested);
    if (!record) {
      throw controllerError(
        "RECOVERY_WRITER_RETIREMENT_STALE_WRITE",
        "Writer-retirement request lost its revision or fencing token.",
      );
    }
    return record;
  }

  async function markRetirementUnverified(claim, cause) {
    const unverified = nextRecord(claim, {
      state: "retirement_unverified",
      retiringAt: null,
      attemptLeaseExpiresAt: null,
      completionEligible: false,
      lastFailureCode: "RETIREMENT_VERIFICATION_FAILED",
    });
    let stored;
    try {
      stored = await compareExchange(claim, unverified);
    } catch (storeError) {
      throw controllerError(
        "RECOVERY_WRITER_RETIREMENT_UNVERIFIED",
        "Writer retirement and its retry state could not be verified.",
        storeError,
      );
    }
    if (!stored) {
      const latest = await loadRequired(claim.runId);
      if (latest.state === "retired" && sameRetirementRequest(latest, claim)) return latest;
    }
    throw controllerError(
      "RECOVERY_WRITER_RETIREMENT_UNVERIFIED",
      "Writer authority could not be proven inert after the retirement attempt.",
      cause,
    );
  }

  async function reconcileRecord(identifier) {
    let record = await loadRequired(runId(identifier));
    const reconciledAt = clockIso();
    if (record.state === "retired") return record;
    if (record.state === "registered") {
      if (record.retirementDeadlineAt > reconciledAt) return record;
      const expired = nextRecord(record, {
        state: "retirement_requested",
        retirementRequestedAt: reconciledAt,
        retirementTrigger: "write-window-expired",
        writerOutcome: "abandoned-or-unknown",
        completionEligible: false,
        lastFailureCode: null,
      });
      record = await compareExchange(record, expired);
      if (!record) {
        throw controllerError(
          "RECOVERY_WRITER_RETIREMENT_STALE_WRITE",
          "Expired writer window lost its revision or fencing token.",
        );
      }
    }
    if (
      record.state === "retiring"
      && record.attemptLeaseExpiresAt > reconciledAt
    ) {
      return record;
    }
    const leaseExpiresAt = new Date(
      Date.parse(reconciledAt) + attemptTimeoutMs,
    ).toISOString();
    const claim = nextRecord(record, {
      state: "retiring",
      retiringAt: reconciledAt,
      attemptLeaseExpiresAt: leaseExpiresAt,
      retirementAttempts: record.retirementAttempts + 1,
      completionEligible: false,
      lastFailureCode: null,
    });
    const claimed = await compareExchange(record, claim);
    if (!claimed) {
      throw controllerError(
        "RECOVERY_WRITER_RETIREMENT_STALE_WRITE",
        "Writer-retirement claim lost its revision or fencing token.",
      );
    }
    const operation = Object.freeze({
      schema: RETIREMENT_OPERATION_SCHEMA,
      runId: claimed.runId,
      runNonce: claimed.runNonce,
      bindingDigestSha256: claimed.bindingDigestSha256,
      writerControlEvidenceLevel: claimed.writerControlEvidenceLevel,
      retirementDescriptorReference: claimed.retirementDescriptorReference,
      retirementDescriptorIdentitySha256: claimed.retirementDescriptorIdentitySha256,
      retirementDeadlineAt: claimed.retirementDeadlineAt,
      retirementProofDeadlineAt: claimed.retirementProofDeadlineAt,
      writerSessionExpiresAt: claimed.writerSessionExpiresAt,
      retirementTrigger: claimed.retirementTrigger,
      writerOutcome: claimed.writerOutcome,
      retiringAt: claimed.retiringAt,
      fencingToken: claimed.fencingToken,
      retirementAttempt: claimed.retirementAttempts,
    });
    let proof;
    try {
      proof = normalizeProof(await retirementOperation(operation), operation);
    } catch (error) {
      return markRetirementUnverified(claimed, error);
    }
    const retired = nextRecord(claimed, {
      state: "retired",
      retiringAt: null,
      attemptLeaseExpiresAt: null,
      retiredAt: proof.verifiedAt,
      retirementVerificationSha256: proof.retirementVerificationSha256,
      completionEligible: claimed.writerOutcome === "completed",
      lastFailureCode: null,
    });
    let stored;
    try {
      stored = await compareExchange(claimed, retired);
    } catch (error) {
      return markRetirementUnverified(claimed, error);
    }
    if (!stored) {
      const latest = await loadRequired(claimed.runId);
      if (latest.state === "retired" && sameRetirementRequest(latest, claimed)) return latest;
      return markRetirementUnverified(
        claimed,
        controllerError(
          "RECOVERY_WRITER_RETIREMENT_STALE_WRITE",
          "Writer-retirement finalization lost its revision or fencing token.",
        ),
      );
    }
    return stored;
  }

  async function requestRetirement(context) {
    return operationalStatusFromRecord(await requestRetirementRecord(context));
  }

  async function reconcile(identifier) {
    return operationalStatusFromRecord(await reconcileRecord(identifier));
  }

  async function requestRetirementAndWait(context) {
    const requested = await requestRetirementRecord(context);
    if (requested.state === "retired") return retirementReceiptFromRecord(requested);
    const reconciled = await reconcileRecord(requested.runId);
    return retirementReceiptFromRecord(reconciled);
  }

  async function reconcileDue() {
    const checkedAt = clockIso();
    let candidates;
    try {
      candidates = await listDueOperation(Object.freeze({
        at: checkedAt,
        states: DUE_STATES,
      }));
    } catch (error) {
      throw controllerError(
        "RECOVERY_WRITER_RETIREMENT_STORE_UNAVAILABLE",
        "Due writer-retirement registrations could not be listed.",
        error,
      );
    }
    if (!Array.isArray(candidates)) {
      throw controllerError(
        "RECOVERY_WRITER_RETIREMENT_CONTROLLER_INVALID",
        "Writer-retirement store listDue operation must return an array.",
      );
    }
    const identifiers = [...new Set(candidates.map((candidate) => normalizeRecord(candidate).runId))];
    const results = [];
    const failures = [];
    for (const identifier of identifiers) {
      try {
        results.push(operationalStatusFromRecord(await reconcileRecord(identifier)));
      } catch (error) {
        failures.push(Object.freeze({
          runId: identifier,
          code: typeof error?.code === "string"
            ? error.code
            : "RECOVERY_WRITER_RETIREMENT_UNVERIFIED",
        }));
      }
    }
    return Object.freeze({
      schema: RECONCILIATION_SWEEP_SCHEMA,
      checkedAt,
      results: Object.freeze(results),
      failures: Object.freeze(failures),
    });
  }

  return Object.freeze({
    register,
    requestRetirement,
    requestRetirementAndWait,
    reconcile,
    reconcileDue,
  });
}
