import { createHash } from "node:crypto";

function sha256Json(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map((entry) => canonicalValue(entry));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .filter((key) => value[key] !== undefined)
        .map((key) => [key, canonicalValue(value[key])]),
    );
  }
  return value;
}

export function incidentRoutingConfigurationDigest(config = {}) {
  const reviewedConfiguration = {
    ...config,
    approvals: Object.fromEntries(
      Object.entries(config.approvals ?? {}).map(([key, approval]) => {
        const reviewedApproval = { ...(approval ?? {}) };
        delete reviewedApproval.configurationDigest;
        return [key, reviewedApproval];
      }),
    ),
  };
  return sha256Json(canonicalValue(reviewedConfiguration));
}

export function recoveryPolicyConfigurationDigest(policy = {}) {
  const reviewedConfiguration = {
    version: policy.version ?? null,
    status: policy.status ?? null,
    targets: policy.targets ?? null,
    backupSchedule: policy.backupSchedule ?? null,
    latestSuccessfulBackup: policy.latestSuccessfulBackup ?? null,
    missedBackupAlert: policy.missedBackupAlert ?? null,
    backupRetention: policy.backupRetention ?? null,
    failureDomain: policy.failureDomain ?? null,
    restoreDrillCadence: policy.restoreDrillCadence ?? null,
    latestNamedArtifactRestore: policy.latestNamedArtifactRestore ?? null,
    approvals: Object.fromEntries(
      ["founder", "operations"].map((key) => [key, {
        status: policy.approvals?.[key]?.status ?? null,
        approvedBy: policy.approvals?.[key]?.approvedBy ?? null,
        approvedAt: policy.approvals?.[key]?.approvedAt ?? null,
      }]),
    ),
  };
  return sha256Json(reviewedConfiguration);
}

export function paymentProviderConfigurationDigest(policy = {}) {
  const state = policy.verifiedProductionState ?? {};
  const approval = policy.approval ?? {};
  const reviewedConfiguration = {
    version: policy.version ?? null,
    status: policy.status ?? null,
    mode: policy.mode ?? null,
    featureFlagVerifiedOff: policy.featureFlagVerifiedOff === true,
    providerDestinationScope: policy.providerDestinationScope ?? null,
    runtimeScopeAttestation: policy.runtimeScopeAttestation ?? null,
    signedDeliveryVerified: policy.signedDeliveryVerified === true,
    verifiedAt: policy.verifiedAt ?? null,
    evidenceProvider: policy.evidenceProvider ?? null,
    evidence: policy.evidence ?? null,
    evidenceSha256: policy.evidenceSha256 ?? null,
    verifiedProductionState: {
      enabled: state.enabled ?? null,
      configured: state.configured ?? null,
      webhookConfigured: state.webhookConfigured ?? null,
      mode: state.mode ?? null,
    },
    approval: {
      status: approval.status ?? null,
      approvedBy: approval.approvedBy ?? null,
      approvedAt: approval.approvedAt ?? null,
    },
  };
  return sha256Json(reviewedConfiguration);
}

export function launchHoldConfigurationDigest({
  incidentConfig = {},
  recoveryPolicy = {},
  paymentProviderPolicy = {},
} = {}) {
  return sha256Json({
    incidentConfigurationDigest: incidentRoutingConfigurationDigest(incidentConfig),
    paymentProviderConfigurationDigest: paymentProviderConfigurationDigest(paymentProviderPolicy),
    recoveryConfigurationDigest: recoveryPolicyConfigurationDigest(recoveryPolicy),
  });
}
