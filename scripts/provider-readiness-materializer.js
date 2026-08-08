import {
  incidentRoutingConfigurationDigest,
} from "./incident-readiness-check.js";
import {
  paymentProviderConfigurationDigest,
  recoveryPolicyConfigurationDigest,
} from "./launch-readiness-check.js";
import {
  providerEvidencePlanDigest,
  providerReadinessConfigurationDigest,
  sourcePolicyBundleDigest,
} from "./provider-approval-overlay.js";

const commitPattern = /^[a-f0-9]{40}$/;
const sha256Pattern = /^[a-f0-9]{64}$/;

// These are the only stable source-policy controls this materializer understands.
// S declares intent plus the exact compiled adapter/provider binding. E supplies only
// the listed observed fields. A supplies only approvals and the launch-hold decision.
// Adding or substituting a control requires an explicit source-policy change instead
// of silently accepting a new adapter, provider, or receipt shape from the evidence plan.
export const providerReadinessMaterializerContract = Object.freeze({
  incident: Object.freeze({
    backupRoute: Object.freeze({
      sourceKeys: Object.freeze(["adapterId", "controlId", "provider", "routeId"]),
      type: "private-route-delivery-test",
    }),
    syntheticMonitor: Object.freeze({
      sourceKeys: Object.freeze(["adapterId", "controlId", "destinationId", "provider"]),
      type: "synthetic-monitor-delivery-test",
    }),
    errorMonitoring: Object.freeze({
      sourceKeys: Object.freeze(["adapterId", "controlId", "destinationId", "provider"]),
      type: "error-monitoring-ingestion-test",
    }),
    paging: Object.freeze({
      sourceKeys: Object.freeze(["adapterId", "controlId", "destinationId", "provider"]),
      type: "paging-delivery-test",
    }),
    rehearsal: Object.freeze({
      sourceKeys: Object.freeze([
        "adapterId", "commanderRoleId", "controlId", "provider", "scenario",
      ]),
      type: "incident-rehearsal-test",
    }),
  }),
  payment: Object.freeze({
    sourceKeys: Object.freeze(["adapterId", "controlId", "provider"]),
    type: "provider-payment-state-verification",
  }),
  recovery: Object.freeze({
    backupSchedule: Object.freeze({
      sourceKeys: Object.freeze(["adapterId", "controlId", "provider"]),
      type: "provider-backup-schedule",
    }),
    latestSuccessfulBackup: Object.freeze({
      sourceKeys: Object.freeze(["adapterId", "controlId", "provider"]),
      type: "provider-backup-completion",
    }),
    missedBackupAlert: Object.freeze({
      sourceKeys: Object.freeze(["adapterId", "controlId", "provider"]),
      type: "provider-alert-delivery-test",
    }),
    backupRetention: Object.freeze({
      sourceKeys: Object.freeze(["adapterId", "controlId", "provider"]),
      type: "provider-retention-policy",
    }),
    failureDomain: Object.freeze({
      sourceKeys: Object.freeze(["adapterId", "controlId", "provider"]),
      type: "provider-failure-domain-verification",
    }),
    latestNamedArtifactRestore: Object.freeze({
      sourceKeys: Object.freeze(["adapterId", "controlId", "provider"]),
      type: "provider-restore-verification",
    }),
  }),
});

const receiptKeys = Object.freeze({
  "private-route-delivery-test": Object.freeze([
    "controlId", "provider", "routeRef", "schemaVersion", "status", "timestamp", "type",
  ]),
  "synthetic-monitor-delivery-test": Object.freeze([
    "category", "configuredProvider", "controlId", "frequency", "provider", "route",
    "schemaVersion", "status", "timestamp", "type",
  ]),
  "error-monitoring-ingestion-test": Object.freeze([
    "category", "configuredProvider", "controlId", "frequency", "provider", "route",
    "schemaVersion", "status", "timestamp", "type",
  ]),
  "paging-delivery-test": Object.freeze([
    "category", "configuredProvider", "controlId", "frequency", "provider", "route",
    "schemaVersion", "status", "timestamp", "type",
  ]),
  "incident-rehearsal-test": Object.freeze([
    "commanderRoleId", "controlId", "provider", "scenario", "schemaVersion", "status",
    "timestamp", "type",
  ]),
  "provider-backup-schedule": Object.freeze([
    "cadenceMinutes", "controlId", "owner", "provider", "schemaVersion", "status",
    "timestamp", "type",
  ]),
  "provider-backup-completion": Object.freeze([
    "artifactIdentitySha256", "controlId", "provider", "rowCount", "schemaVersion",
    "status", "tableCount", "timestamp", "type",
  ]),
  "provider-alert-delivery-test": Object.freeze([
    "controlId", "destination", "provider", "retryAllowanceMinutes", "schemaVersion",
    "status", "timestamp", "type",
  ]),
  "provider-retention-policy": Object.freeze([
    "controlId", "mode", "owner", "provider", "retentionDays", "schemaVersion", "status",
    "timestamp", "type",
  ]),
  "provider-failure-domain-verification": Object.freeze([
    "backupProvider", "controlId", "primaryProvider", "provider", "schemaVersion", "status",
    "timestamp", "type",
  ]),
  "provider-restore-verification": Object.freeze([
    "artifactIdentitySha256", "controlId", "provider", "restoreDurationMs", "rowCount",
    "schemaVersion", "status", "tableCount", "timestamp", "type", "verificationDurationMs",
  ]),
  "provider-payment-state-verification": Object.freeze([
    "configured", "controlId", "enabled", "featureFlagVerifiedOff", "mode", "provider",
    "providerDestinationScope", "providerMode", "runtimeScopeAttestation", "schemaVersion",
    "signedDeliveryVerified", "status", "timestamp", "type", "webhookConfigured",
  ]),
});

function plainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactKeys(value, keys) {
  if (!plainObject(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length
    && actual.every((key, index) => key === expected[index]);
}

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map((entry) => canonicalValue(entry));
  if (plainObject(value)) {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonicalValue(value[key])]),
    );
  }
  return value;
}

function sameValue(left, right) {
  try {
    return JSON.stringify(canonicalValue(left)) === JSON.stringify(canonicalValue(right));
  } catch {
    return false;
  }
}

function text(value) {
  return typeof value === "string" && value.length > 0 && value === value.trim();
}

function validTimestamp(value) {
  return text(value) && Number.isFinite(new Date(value).getTime());
}

function positive(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function positiveSafeInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function addDaysTimestamp(value, days) {
  const timestamp = Date.parse(value);
  const nextTimestamp = timestamp + days * 24 * 60 * 60 * 1000;
  if (!Number.isFinite(timestamp) || !Number.isFinite(nextTimestamp)) return null;
  const nextDate = new Date(nextTimestamp);
  return Number.isFinite(nextDate.getTime()) ? nextDate.toISOString() : null;
}

function fail(...codes) {
  return { ok: false, findingCodes: [...new Set(codes)].sort() };
}

function validApproval(value) {
  return exactKeys(value, ["approvedAt", "approverRoleId", "configurationDigest", "status"])
    && value.status === "approved"
    && text(value.approverRoleId)
    && validTimestamp(value.approvedAt)
    && sha256Pattern.test(value.configurationDigest ?? "");
}

function validAuthority(manifest) {
  return plainObject(manifest)
    && exactKeys(manifest.approvals, ["incident", "payment", "recovery"])
    && exactKeys(manifest.approvals.incident, ["founder", "legalSafety", "support"])
    && Object.values(manifest.approvals.incident).every(validApproval)
    && exactKeys(manifest.approvals.recovery, ["founder", "operations"])
    && Object.values(manifest.approvals.recovery).every(validApproval)
    && validApproval(manifest.approvals.payment)
    && exactKeys(manifest.hold, [
      "configurationDigest", "decidedAt", "decidedByRoleId", "incident", "reason", "status",
    ])
    && ["cleared", "retained"].includes(manifest.hold.status)
    && text(manifest.hold.decidedByRoleId)
    && validTimestamp(manifest.hold.decidedAt)
    && text(manifest.hold.incident)
    && text(manifest.hold.reason)
    && sha256Pattern.test(manifest.hold.configurationDigest ?? "");
}

function canonicalEvidenceBindings(plan) {
  return plan.claims
    .map(({ adapterId, controlId, evidencePath, evidenceSha256, provider, type }) => ({
      adapterId,
      controlId,
      evidencePath,
      evidenceSha256,
      provider,
      type,
    }))
    .sort((left, right) => (
      JSON.stringify(canonicalValue(left)).localeCompare(JSON.stringify(canonicalValue(right)))
    ));
}

function collectControlDefinitions(incidentConfig, recoveryPolicy, paymentProviderPolicy) {
  const findingCodes = [];
  const definitions = [];
  const incidentControls = incidentConfig.evidenceControls;
  if (!exactKeys(incidentControls, Object.keys(providerReadinessMaterializerContract.incident))) {
    findingCodes.push("MATERIALIZER_INCIDENT_CONTROL_SCHEMA_INVALID");
  } else {
    for (const [slot, contract] of Object.entries(providerReadinessMaterializerContract.incident)) {
      const control = incidentControls[slot];
      if (
        !exactKeys(control, contract.sourceKeys)
        || !text(control.adapterId)
        || !text(control.controlId)
        || !text(control.provider)
      ) {
        findingCodes.push("MATERIALIZER_INCIDENT_CONTROL_SCHEMA_INVALID");
      } else {
        definitions.push({ area: "incident", slot, type: contract.type, ...control });
      }
    }
  }

  const recoveryControls = recoveryPolicy.evidenceControls;
  if (!exactKeys(recoveryControls, Object.keys(providerReadinessMaterializerContract.recovery))) {
    findingCodes.push("MATERIALIZER_RECOVERY_CONTROL_SCHEMA_INVALID");
  } else {
    for (const [slot, contract] of Object.entries(providerReadinessMaterializerContract.recovery)) {
      const control = recoveryControls[slot];
      if (
        !exactKeys(control, contract.sourceKeys)
        || !text(control.adapterId)
        || !text(control.controlId)
        || !text(control.provider)
      ) {
        findingCodes.push("MATERIALIZER_RECOVERY_CONTROL_SCHEMA_INVALID");
      } else {
        definitions.push({ area: "recovery", slot, type: contract.type, ...control });
      }
    }
  }

  const paymentControl = paymentProviderPolicy.evidenceControl;
  if (
    !exactKeys(paymentControl, providerReadinessMaterializerContract.payment.sourceKeys)
    || !text(paymentControl.adapterId)
    || !text(paymentControl.controlId)
    || !text(paymentControl.provider)
  ) {
    findingCodes.push("MATERIALIZER_PAYMENT_CONTROL_SCHEMA_INVALID");
  } else {
    definitions.push({
      area: "payment",
      slot: "providerState",
      type: providerReadinessMaterializerContract.payment.type,
      ...paymentControl,
    });
  }
  const counts = new Map();
  for (const definition of definitions) {
    counts.set(definition.controlId, (counts.get(definition.controlId) ?? 0) + 1);
  }
  if ([...counts.values()].some((count) => count !== 1)) {
    findingCodes.push("MATERIALIZER_CONTROL_DUPLICATE");
  }
  return { definitions, findingCodes };
}

function bindEvidence(definitions, plan, evidenceRecords) {
  const findingCodes = [];
  if (!plainObject(plan) || plan.schemaVersion !== 1 || !Array.isArray(plan.claims)) {
    return { findingCodes: ["MATERIALIZER_PLAN_INVALID"], bound: new Map() };
  }
  if (!Array.isArray(evidenceRecords)) {
    return { findingCodes: ["MATERIALIZER_EVIDENCE_RECORDS_INVALID"], bound: new Map() };
  }
  const definitionsByControl = new Map(definitions.map((definition) => [definition.controlId, definition]));
  const claimsByControl = new Map();
  for (const claim of plan.claims) {
    if (!plainObject(claim) || !text(claim.controlId)) {
      findingCodes.push("MATERIALIZER_PLAN_INVALID");
      continue;
    }
    if (!definitionsByControl.has(claim.controlId)) findingCodes.push("MATERIALIZER_CONTROL_UNKNOWN");
    if (claimsByControl.has(claim.controlId)) findingCodes.push("MATERIALIZER_CONTROL_DUPLICATE");
    claimsByControl.set(claim.controlId, claim);
  }
  if (definitions.some((definition) => !claimsByControl.has(definition.controlId))) {
    findingCodes.push("MATERIALIZER_CONTROL_MISSING");
  }

  const recordsByPath = new Map();
  for (const record of evidenceRecords) {
    if (!plainObject(record) || !text(record.path)) {
      findingCodes.push("MATERIALIZER_EVIDENCE_RECORDS_INVALID");
      continue;
    }
    if (recordsByPath.has(record.path)) findingCodes.push("MATERIALIZER_EVIDENCE_RECORD_DUPLICATE");
    recordsByPath.set(record.path, record);
  }
  if (evidenceRecords.length !== plan.claims.length) {
    findingCodes.push("MATERIALIZER_EVIDENCE_RECORD_COUNT_MISMATCH");
  }

  const bound = new Map();
  for (const definition of definitions) {
    const claim = claimsByControl.get(definition.controlId);
    if (!claim) continue;
    if (
      claim.adapterId !== definition.adapterId
      || claim.provider !== definition.provider
      || claim.type !== definition.type
      || claim.controlId !== definition.controlId
    ) {
      findingCodes.push("MATERIALIZER_PLAN_SOURCE_BINDING_MISMATCH");
      continue;
    }
    const record = recordsByPath.get(claim.evidencePath);
    if (!record) {
      findingCodes.push("MATERIALIZER_RECEIPT_MISSING");
      continue;
    }
    const expectedKeys = receiptKeys[definition.type];
    const receipt = record.receipt;
    if (
      claim.type !== definition.type
      || claim.provider !== receipt?.provider
      || claim.controlId !== receipt?.controlId
      || claim.evidenceSha256 !== record.sha256
      || !sha256Pattern.test(record.sha256 ?? "")
      || !sameValue(claim.expectedReceipt, receipt)
      || !exactKeys(receipt, expectedKeys ?? [])
      || receipt.schemaVersion !== 1
      || receipt.type !== definition.type
      || !text(receipt.provider)
      || !validTimestamp(receipt.timestamp)
    ) {
      findingCodes.push("MATERIALIZER_RECEIPT_MISMATCH");
      continue;
    }
    bound.set(definition.controlId, { claim, definition, record, receipt });
  }
  return { bound, findingCodes };
}

function staticIncidentMatch(config, definition, receipt) {
  if (definition.slot === "backupRoute") {
    const route = (config.contactRoutes ?? []).filter((item) => item.id === definition.routeId);
    return route.length === 1
      && route[0].kind === "private-incident-roster"
      && receipt.status === "delivered"
      && receipt.routeRef === route[0].routeRef;
  }
  if (definition.slot === "rehearsal") {
    const existing = (config.rehearsals ?? [])
      .filter((rehearsal) => rehearsal.id === definition.controlId);
    return existing.length <= 1
      && (existing.length === 0
        || (
          existing[0].scenario === definition.scenario
          && existing[0].commanderRoleId === definition.commanderRoleId
        ))
      && receipt.status === "passed"
      && receipt.scenario === definition.scenario
      && receipt.commanderRoleId === definition.commanderRoleId;
  }
  const destination = (config.alertDestinations ?? [])
    .filter((item) => item.id === definition.destinationId);
  const expectedStatus = definition.slot === "errorMonitoring" ? "ingested" : "delivered";
  const actualExpectedStatus = definition.slot === "syntheticMonitor" ? "passed" : expectedStatus;
  const expectedCategory = {
    errorMonitoring: "error_monitoring",
    paging: "paging",
    syntheticMonitor: "synthetic_monitor",
  }[definition.slot];
  return destination.length === 1
    && destination[0].status === "configured"
    && receipt.status === actualExpectedStatus
    && destination[0].category === expectedCategory
    && receipt.category === destination[0].category
    && receipt.configuredProvider === (destination[0].provider ?? null)
    && receipt.route === destination[0].route
    && receipt.frequency === (destination[0].frequency ?? null);
}

function staticRecoveryMatch(policy, definition, receipt) {
  if (definition.slot === "backupSchedule") {
    return receipt.status === "configured"
      && receipt.cadenceMinutes === policy.backupSchedule?.cadenceMinutes
      && receipt.owner === policy.backupSchedule?.owner;
  }
  if (definition.slot === "latestSuccessfulBackup") {
    return receipt.status === "passed"
      && sha256Pattern.test(receipt.artifactIdentitySha256 ?? "")
      && positiveSafeInteger(receipt.tableCount)
      && positiveSafeInteger(receipt.rowCount);
  }
  if (definition.slot === "missedBackupAlert") {
    return receipt.status === "tested"
      && receipt.retryAllowanceMinutes === policy.missedBackupAlert?.retryAllowanceMinutes
      && receipt.destination === policy.missedBackupAlert?.destination;
  }
  if (definition.slot === "backupRetention") {
    return receipt.status === "verified"
      && receipt.retentionDays === policy.backupRetention?.days
      && receipt.owner === policy.backupRetention?.owner
      && receipt.mode === policy.backupRetention?.enforcement?.mode;
  }
  if (definition.slot === "failureDomain") {
    return receipt.status === "independent"
      && receipt.primaryProvider === policy.failureDomain?.primaryProvider
      && receipt.backupProvider === policy.failureDomain?.backupProvider
      && receipt.primaryProvider !== receipt.backupProvider;
  }
  return definition.slot === "latestNamedArtifactRestore"
    && receipt.status === "passed"
    && sha256Pattern.test(receipt.artifactIdentitySha256 ?? "")
    && positiveSafeInteger(receipt.tableCount)
    && positiveSafeInteger(receipt.rowCount)
    && positive(receipt.restoreDurationMs)
    && positive(receipt.verificationDurationMs);
}

function staticPaymentMatch(policy, receipt) {
  const desired = policy.desiredProviderState;
  return exactKeys(desired, [
    "configured", "enabled", "featureFlagVerifiedOff", "providerDestinationScope",
    "providerMode", "runtimeScopeAttestation", "signedDeliveryVerified", "webhookConfigured",
  ])
    && ["disabled", "enabled"].includes(policy.mode)
    && receipt.status === "verified"
    && receipt.mode === policy.mode
    && receipt.featureFlagVerifiedOff === desired.featureFlagVerifiedOff
    && receipt.providerDestinationScope === desired.providerDestinationScope
    && receipt.runtimeScopeAttestation === desired.runtimeScopeAttestation
    && receipt.signedDeliveryVerified === desired.signedDeliveryVerified
    && receipt.enabled === desired.enabled
    && receipt.configured === desired.configured
    && receipt.webhookConfigured === desired.webhookConfigured
    && receipt.providerMode === desired.providerMode;
}

function evidenceFields(entry, timestampField) {
  return {
    [timestampField]: entry.receipt.timestamp,
    evidenceProvider: entry.receipt.provider,
    evidencePath: entry.claim.evidencePath,
    evidenceSha256: entry.claim.evidenceSha256,
  };
}

function recoveryEvidenceFields(entry, timestampField) {
  const fields = evidenceFields(entry, timestampField);
  return {
    [timestampField]: fields[timestampField],
    evidenceProvider: fields.evidenceProvider,
    evidence: fields.evidencePath,
    evidenceSha256: fields.evidenceSha256,
  };
}

function materializeEvidence(policies, definitions, bound) {
  const incidentConfig = structuredClone(policies.incidentConfig);
  const recoveryPolicy = structuredClone(policies.recoveryPolicy);
  const paymentProviderPolicy = structuredClone(policies.paymentProviderPolicy);
  const readinessEvidence = {
    incidentEvidenceByPath: {},
    paymentProviderEvidence: null,
    recoveryEvidenceByPath: {},
    recoveryEvidenceSha256ByPath: {},
  };
  const findingCodes = [];

  for (const definition of definitions) {
    const entry = bound.get(definition.controlId);
    if (!entry) continue;
    const { claim, record, receipt } = entry;
    if (definition.area === "incident") {
      if (!staticIncidentMatch(incidentConfig, definition, receipt)) {
        findingCodes.push("MATERIALIZER_POLICY_OVERRIDE_ATTEMPT");
        continue;
      }
      if (definition.slot === "backupRoute") {
        const index = incidentConfig.contactRoutes.findIndex(({ id }) => id === definition.routeId);
        incidentConfig.contactRoutes[index] = {
          ...incidentConfig.contactRoutes[index],
          ...evidenceFields(entry, "lastVerifiedAt"),
        };
      } else if (definition.slot === "rehearsal") {
        const existing = incidentConfig.rehearsals.filter(({ id }) => id !== definition.controlId);
        incidentConfig.rehearsals = [...existing, {
          id: definition.controlId,
          status: receipt.status,
          completedAt: receipt.timestamp,
          scenario: receipt.scenario,
          commanderRoleId: receipt.commanderRoleId,
          evidenceProvider: receipt.provider,
          evidencePath: claim.evidencePath,
          evidenceSha256: claim.evidenceSha256,
        }];
      } else {
        const index = incidentConfig.alertDestinations
          .findIndex(({ id }) => id === definition.destinationId);
        incidentConfig.alertDestinations[index] = {
          ...incidentConfig.alertDestinations[index],
          ...evidenceFields(entry, "lastVerifiedAt"),
        };
      }
      readinessEvidence.incidentEvidenceByPath[claim.evidencePath] = structuredClone(record);
      continue;
    }

    if (definition.area === "recovery") {
      if (!staticRecoveryMatch(recoveryPolicy, definition, receipt)) {
        findingCodes.push("MATERIALIZER_POLICY_OVERRIDE_ATTEMPT");
        continue;
      }
      if (definition.slot === "backupSchedule") {
        Object.assign(recoveryPolicy.backupSchedule, {
          status: receipt.status,
          ...recoveryEvidenceFields(entry, "verifiedAt"),
        });
      } else if (definition.slot === "latestSuccessfulBackup") {
        recoveryPolicy.latestSuccessfulBackup = {
          status: receipt.status,
          completedAt: receipt.timestamp,
          artifactIdentitySha256: receipt.artifactIdentitySha256,
          tableCount: receipt.tableCount,
          rowCount: receipt.rowCount,
          ...recoveryEvidenceFields(entry, "completedAt"),
        };
      } else if (definition.slot === "missedBackupAlert") {
        Object.assign(
          recoveryPolicy.missedBackupAlert,
          { status: receipt.status },
          recoveryEvidenceFields(entry, "lastTestedAt"),
        );
      } else if (definition.slot === "backupRetention") {
        Object.assign(
          recoveryPolicy.backupRetention.enforcement,
          { status: receipt.status },
          recoveryEvidenceFields(entry, "verifiedAt"),
        );
      } else if (definition.slot === "failureDomain") {
        Object.assign(recoveryPolicy.failureDomain, {
          status: receipt.status,
          ...recoveryEvidenceFields(entry, "verifiedAt"),
        });
      } else {
        recoveryPolicy.latestNamedArtifactRestore = {
          status: receipt.status,
          completedAt: receipt.timestamp,
          artifactIdentitySha256: receipt.artifactIdentitySha256,
          tableCount: receipt.tableCount,
          rowCount: receipt.rowCount,
          restoreDurationMs: receipt.restoreDurationMs,
          verificationDurationMs: receipt.verificationDurationMs,
          ...recoveryEvidenceFields(entry, "completedAt"),
        };
        const cadenceDays = recoveryPolicy.restoreDrillCadence?.days;
        if (positive(cadenceDays)) {
          const nextDueAt = addDaysTimestamp(receipt.timestamp, cadenceDays);
          if (!nextDueAt) {
            findingCodes.push("MATERIALIZER_DERIVED_TIMESTAMP_INVALID");
          } else {
            recoveryPolicy.restoreDrillCadence.nextDueAt = nextDueAt;
          }
        }
      }
      readinessEvidence.recoveryEvidenceByPath[claim.evidencePath] = structuredClone(record);
      readinessEvidence.recoveryEvidenceSha256ByPath[claim.evidencePath] = claim.evidenceSha256;
      continue;
    }

    if (!staticPaymentMatch(paymentProviderPolicy, receipt)) {
      findingCodes.push("MATERIALIZER_POLICY_OVERRIDE_ATTEMPT");
      continue;
    }
    Object.assign(paymentProviderPolicy, {
      featureFlagVerifiedOff: receipt.featureFlagVerifiedOff,
      providerDestinationScope: receipt.providerDestinationScope,
      runtimeScopeAttestation: receipt.runtimeScopeAttestation,
      signedDeliveryVerified: receipt.signedDeliveryVerified,
      verifiedAt: receipt.timestamp,
      evidenceProvider: receipt.provider,
      evidence: claim.evidencePath,
      evidenceSha256: claim.evidenceSha256,
      verifiedProductionState: {
        enabled: receipt.enabled,
        configured: receipt.configured,
        webhookConfigured: receipt.webhookConfigured,
        mode: receipt.providerMode,
      },
    });
    readinessEvidence.paymentProviderEvidence = structuredClone(record);
  }
  return {
    findingCodes,
    incidentConfig,
    paymentProviderPolicy,
    readinessEvidence,
    recoveryPolicy,
  };
}

function applyApprovals(materialized, manifest) {
  const incidentConfig = structuredClone(materialized.incidentConfig);
  const recoveryPolicy = structuredClone(materialized.recoveryPolicy);
  const paymentProviderPolicy = structuredClone(materialized.paymentProviderPolicy);
  incidentConfig.approvals = Object.fromEntries(
    Object.entries(manifest.approvals.incident).map(([key, approval]) => [key, {
      status: approval.status,
      approverRoleId: approval.approverRoleId,
      approvedAt: approval.approvedAt,
      configurationDigest: approval.configurationDigest,
    }]),
  );
  recoveryPolicy.approvals = Object.fromEntries(
    Object.entries(manifest.approvals.recovery).map(([key, approval]) => [key, {
      status: approval.status,
      approvedBy: approval.approverRoleId,
      approvedAt: approval.approvedAt,
      configurationDigest: approval.configurationDigest,
    }]),
  );
  const paymentApproval = manifest.approvals.payment;
  paymentProviderPolicy.approval = {
    status: paymentApproval.status,
    approvedBy: paymentApproval.approverRoleId,
    approvedAt: paymentApproval.approvedAt,
    configurationDigest: paymentApproval.configurationDigest,
  };
  return { incidentConfig, recoveryPolicy, paymentProviderPolicy };
}

function approvalDigestFindings(policies, manifest) {
  const findingCodes = [];
  const incidentDigest = incidentRoutingConfigurationDigest(policies.incidentConfig);
  const recoveryDigest = recoveryPolicyConfigurationDigest(policies.recoveryPolicy);
  const paymentDigest = paymentProviderConfigurationDigest(policies.paymentProviderPolicy);
  if (Object.values(manifest.approvals.incident).some(
    ({ configurationDigest }) => configurationDigest !== incidentDigest,
  )) findingCodes.push("MATERIALIZER_APPROVAL_DIGEST_MISMATCH");
  if (Object.values(manifest.approvals.recovery).some(
    ({ configurationDigest }) => configurationDigest !== recoveryDigest,
  )) findingCodes.push("MATERIALIZER_APPROVAL_DIGEST_MISMATCH");
  if (manifest.approvals.payment.configurationDigest !== paymentDigest) {
    findingCodes.push("MATERIALIZER_APPROVAL_DIGEST_MISMATCH");
  }
  if (manifest.hold.configurationDigest !== providerReadinessConfigurationDigest(policies)) {
    findingCodes.push("MATERIALIZER_HOLD_DIGEST_MISMATCH");
  }
  if (manifest.hold.incident !== policies.incidentConfig.launchHold?.incident) {
    findingCodes.push("MATERIALIZER_HOLD_INCIDENT_MISMATCH");
  }
  return findingCodes;
}

/**
 * Builds the exact in-memory view consumed by readiness checks. This function
 * never reads or writes the filesystem and never treats E or A as policy.
 */
export function materializeProviderReadiness({
  approvalManifest,
  evidenceCommit,
  evidenceOverlayDigest,
  evidenceRecords,
  incidentConfig: directIncidentConfig,
  paymentProviderPolicy: directPaymentProviderPolicy,
  plan,
  policies: policyBundle,
  recoveryPolicy: directRecoveryPolicy,
  sourceCommit,
} = {}) {
  const policies = policyBundle ?? {
    incidentConfig: directIncidentConfig,
    paymentProviderPolicy: directPaymentProviderPolicy,
    recoveryPolicy: directRecoveryPolicy,
  };
  if (
    !commitPattern.test(sourceCommit ?? "")
    || !commitPattern.test(evidenceCommit ?? "")
    || !sha256Pattern.test(evidenceOverlayDigest ?? "")
    || !plainObject(policies)
    || !plainObject(policies.incidentConfig)
    || !plainObject(policies.recoveryPolicy)
    || !plainObject(policies.paymentProviderPolicy)
    || !plainObject(approvalManifest)
    || !plainObject(plan)
    || plan.schemaVersion !== 1
    || !Array.isArray(plan.claims)
  ) return fail("MATERIALIZER_INPUT_INVALID");

  const bindingFindings = [];
  if (approvalManifest.sourceCommit !== sourceCommit) {
    bindingFindings.push("MATERIALIZER_SOURCE_BINDING_MISMATCH");
  }
  if (approvalManifest.evidenceCommit !== evidenceCommit) {
    bindingFindings.push("MATERIALIZER_EVIDENCE_BINDING_MISMATCH");
  }
  if (approvalManifest.evidenceOverlayDigest !== evidenceOverlayDigest) {
    bindingFindings.push("MATERIALIZER_OVERLAY_BINDING_MISMATCH");
  }
  try {
    if (approvalManifest.evidencePlanDigest !== providerEvidencePlanDigest(plan)) {
      bindingFindings.push("MATERIALIZER_PLAN_BINDING_MISMATCH");
    }
    if (approvalManifest.sourcePolicyDigest !== sourcePolicyBundleDigest(policies)) {
      bindingFindings.push("MATERIALIZER_POLICY_BINDING_MISMATCH");
    }
  } catch {
    bindingFindings.push("MATERIALIZER_INPUT_INVALID");
  }
  if (
    !Array.isArray(approvalManifest.evidenceBindings)
    || !sameValue(approvalManifest.evidenceBindings, canonicalEvidenceBindings(plan ?? { claims: [] }))
  ) bindingFindings.push("MATERIALIZER_PLAN_BINDING_MISMATCH");
  if (bindingFindings.length > 0) return fail(...bindingFindings);

  const controls = collectControlDefinitions(
    policies.incidentConfig,
    policies.recoveryPolicy,
    policies.paymentProviderPolicy,
  );
  if (controls.findingCodes.length > 0) return fail(...controls.findingCodes);
  const evidence = bindEvidence(controls.definitions, plan, evidenceRecords);
  if (evidence.findingCodes.length > 0) return fail(...evidence.findingCodes);
  const materialized = materializeEvidence(policies, controls.definitions, evidence.bound);
  if (materialized.findingCodes.length > 0) return fail(...materialized.findingCodes);

  if (!validAuthority(approvalManifest)) return fail("MATERIALIZER_APPROVAL_SCHEMA_INVALID");
  const approvedPolicies = applyApprovals(materialized, approvalManifest);
  const digestFindings = approvalDigestFindings(approvedPolicies, approvalManifest);
  if (digestFindings.length > 0) return fail(...digestFindings);

  return {
    ok: true,
    findingCodes: [],
    incidentConfig: approvedPolicies.incidentConfig,
    paymentProviderPolicy: approvedPolicies.paymentProviderPolicy,
    readinessEvidence: structuredClone(materialized.readinessEvidence),
    recoveryPolicy: approvedPolicies.recoveryPolicy,
    holdContext: structuredClone(approvalManifest.hold),
  };
}
