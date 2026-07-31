import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  activationPreflightExitCode,
  approvalBindingDigest,
  createRailwayStatusSnapshot,
  evaluateRailwayActivationPlan,
  gitStatusIsClean,
  validateActivationPreflightArguments,
} from "../scripts/railway-activation-preflight.js";

const commit = (character) => character.repeat(40);
const hash = (character) => character.repeat(64);

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => (
      `${JSON.stringify(key)}:${canonicalJson(value[key])}`
    )).join(",")}}`;
  }
  return JSON.stringify(value);
}

function digest(value) {
  return createHash("sha256").update(
    typeof value === "string" ? value : canonicalJson(value),
  ).digest("hex");
}

function readyConfigs() {
  return {
    webConfig: {
      build: { builder: "NIXPACKS", buildCommand: "npm run build" },
      deploy: {
        startCommand: "node server/runtime.js web",
        preDeployCommand: "node server/runtime.js migrate",
        healthcheckPath: "/api/health",
        drainingSeconds: 30,
      },
    },
    workerConfig: {
      build: { builder: "NIXPACKS", buildCommand: "npm run build" },
      deploy: {
        startCommand: "node server/runtime.js worker",
        preDeployCommand: "node server/runtime.js worker-check",
        drainingSeconds: 30,
      },
    },
  };
}

function readySnapshot() {
  return {
    schemaVersion: 1,
    source: "railway_cli_status_v1",
    observedAt: "2026-07-29T12:55:00.000Z",
    projectIdFingerprint: hash("1"),
    environmentName: "production",
    environmentIdFingerprint: hash("2"),
    services: [
      {
        serviceName: "RIVT",
        serviceKind: "current_web",
        serviceIdFingerprint: hash("3"),
        deploymentIdFingerprint: hash("4"),
        sourceCommit: commit("c"),
        configPath: "/railway.json",
        startCommand: "npm start",
        preDeployCommand: null,
        healthcheckPath: "/api/health",
        renderedReplicaCount: 1,
        region: "us-east4-eqdc4a",
        volumeAttached: false,
        serverlessDisabled: true,
        drainingSeconds: 30,
        deploymentStatus: "SUCCESS",
        rollbackAvailable: true,
        configurationHash: hash("5"),
      },
      {
        serviceName: "Postgres",
        serviceKind: "database_or_dependency",
        serviceIdFingerprint: hash("6"),
        deploymentIdFingerprint: hash("7"),
        sourceCommit: null,
        configPath: null,
        startCommand: null,
        preDeployCommand: null,
        healthcheckPath: null,
        renderedReplicaCount: 1,
        region: "us-east4-eqdc4a",
        volumeAttached: true,
        serverlessDisabled: true,
        drainingSeconds: null,
        deploymentStatus: "SUCCESS",
        rollbackAvailable: true,
        configurationHash: hash("8"),
      },
    ],
  };
}

function snapshotArtifact(snapshot) {
  const raw = JSON.stringify(snapshot);
  return {
    raw,
    sha256: digest(raw),
  };
}

function readyProviderControls(snapshot) {
  return {
    schemaVersion: 1,
    source: "operator_activation_control_review_v1",
    reviewedAt: snapshot.observedAt,
    reviewedBy: "Owner",
    environmentName: "production",
    environmentIdFingerprint: snapshot.environmentIdFingerprint,
    connectedBranch: "master",
    autodeployMode: "staged_manual_apply",
    effectiveConfigSource: "checked-in Railway configuration",
    serverlessDisabled: true,
    billingCycleStartsAt: "2026-07-09T00:00:00.000Z",
    billingCycleEndsAt: "2026-08-09T00:00:00.000Z",
    services: [
      {
        name: "web",
        configPath: "/railway.json",
        startCommand: "node server/runtime.js web",
        preDeployCommand: "node server/runtime.js migrate",
        healthcheckPath: "/api/health",
        renderedReplicaCount: 1,
        region: "us-east4-eqdc4a",
        volumeAttached: false,
        serverlessDisabled: true,
        pushRequired: true,
        drainingSeconds: 30,
        deploymentTrigger: "manual_staged",
      },
      {
        name: "worker",
        configPath: "/railway.worker.json",
        startCommand: "node server/runtime.js worker",
        preDeployCommand: "node server/runtime.js worker-check",
        healthcheckPath: null,
        renderedReplicaCount: 1,
        region: "us-east4-eqdc4a",
        volumeAttached: false,
        serverlessDisabled: true,
        pushRequired: true,
        drainingSeconds: 30,
        deploymentTrigger: "manual_staged",
      },
    ],
    database: {
      privateEndpointConfirmed: true,
      endpointMode: "direct",
      observedGlobalUsableConnections: 95,
      observedEffectiveConnections: 80,
      declaredMaxConnections: 80,
      webPoolMax: 4,
      workerPoolMax: 2,
      migratePoolMax: 1,
      reservedConnections: 3,
    },
    monitoring: {
      publicUptimeConfigured: true,
      workerHeartbeatConfigured: true,
      pushBacklogAlertConfigured: true,
      deadLetterAlertConfigured: true,
      resourceAlertsConfigured: true,
      alertReceiverTested: true,
      onCallOwner: "Owner",
    },
    cost: {
      currentMonthActualUsd: 2,
      currentMonthEstimateBeforeUsd: 4,
      agentUsageUsd: 0,
      providerHardLimitVerified: false,
      providerEnforcedHardLimitUsd: null,
      providerHardLimitScope: null,
      providerHardLimitCanStopWorkspace: null,
      agentMonthlyLimitUsd: 1,
    },
  };
}

function providerControlArtifact(providerControls) {
  const raw = JSON.stringify(providerControls);
  return {
    raw,
    sha256: digest(raw),
  };
}

function bindAuthorizedPlan(plan, providerControls) {
  const artifact = providerControlArtifact(providerControls);
  plan.operatorControlReviewBinding = {
    source: providerControls.source,
    artifactSha256: artifact.sha256,
    reviewedAt: providerControls.reviewedAt,
    reviewedBy: providerControls.reviewedBy,
  };
  plan.approval.approvedPlanSha256 = approvalBindingDigest(plan);
  return plan;
}

function readyLocalFacts() {
  const configs = readyConfigs();
  return {
    headCommit: commit("b"),
    workingTreeClean: true,
    commits: {
      preparedImplementationCommit: true,
      candidateCommit: true,
      liveCommitBefore: true,
      rollbackCommit: true,
    },
    preparedAncestorOfCandidate: true,
    liveAncestorOfCandidate: true,
    originMasterCommit: commit("b"),
    candidateMatchesOriginMaster: true,
    ...configs,
    webConfigHash: digest(configs.webConfig),
    workerConfigHash: digest(configs.workerConfig),
  };
}

function readyPlan(snapshot, providerControls = readyProviderControls(snapshot)) {
  const candidateTopology = {
    candidateWebReplicas: 1,
    webPoolMax: 4,
    candidateWorkerReplicas: 1,
    workerPoolMax: 2,
    reservedConnections: 3,
  };
  const localFacts = readyLocalFacts();
  const artifact = snapshotArtifact(snapshot);
  const service = (
    name,
    configPath,
    role,
    startCommand,
    preDeployCommand,
    healthcheckPath,
    configurationHash,
  ) => ({
    name,
    configPath,
    role,
    startCommand,
    preDeployCommand,
    healthcheckPath,
    renderedReplicaCount: 1,
    region: "us-east4-eqdc4a",
    volumeAttached: false,
    serverlessDisabled: true,
    pushRequired: true,
    drainingSeconds: 30,
    deploymentTrigger: "manual_staged",
    configurationHash,
  });
  const plan = {
    schemaVersion: 1,
    status: "authorized_preflight",
    activationStage: "split",
    approval: {
      approved: true,
      approvedBy: "Owner",
      approvedAt: "2026-07-29T12:00:00.000Z",
      expiresAt: "2026-07-30T12:00:00.000Z",
      approvedPlanSha256: null,
      oneTimeMaximumUsd: 1,
      incrementalMonthlyMaximumUsd: 10,
      totalMonthlyApprovedCeilingUsd: 30,
      testDurationMinutes: 60,
      maximumWorkerUnavailableMinutes: 10,
    },
    activationWindow: {
      plannedTestDurationMinutes: 30,
      plannedWorkerUnavailableMinutes: 5,
    },
    source: {
      preparedImplementationCommit: commit("a"),
      candidateCommit: commit("b"),
      liveCommitBefore: commit("c"),
      rollbackCommit: commit("c"),
    },
    railway: {
      environmentName: "production",
      region: "us-east4-eqdc4a",
      connectedBranch: "master",
      autodeployMode: "staged_manual_apply",
      effectiveConfigSource: "checked-in Railway configuration",
      serverlessDisabled: true,
      overlapSeconds: 0,
      billingCycleStartsAt: "2026-07-09T00:00:00.000Z",
      billingCycleEndsAt: "2026-08-09T00:00:00.000Z",
      services: [
        service(
          "web",
          "/railway.json",
          "web",
          "node server/runtime.js web",
          "node server/runtime.js migrate",
          "/api/health",
          localFacts.webConfigHash,
        ),
        service(
          "worker",
          "/railway.worker.json",
          "worker",
          "node server/runtime.js worker",
          "node server/runtime.js worker-check",
          null,
          localFacts.workerConfigHash,
        ),
      ],
    },
    database: {
      privateEndpointConfirmed: true,
      endpointMode: "direct",
      poolerClientLimit: null,
      observedGlobalUsableConnections: 95,
      observedEffectiveConnections: 80,
      declaredMaxConnections: 80,
      migrationOwner: "web",
      maximumConcurrentMigrationProcesses: 1,
      expandContractCompatibleWithRollback: true,
      steadyStateTopology: {
        ...candidateTopology,
        migrationProcesses: 0,
        migratePoolMax: 0,
        oldCombinedReplicas: 0,
        oldCombinedPoolMax: 0,
      },
      transitionTopology: {
        ...candidateTopology,
        migrationProcesses: 1,
        migratePoolMax: 1,
        oldCombinedReplicas: 1,
        oldCombinedPoolMax: 10,
      },
      plannedSteadyStateConnections: 9,
      plannedTransitionPeakConnections: 20,
    },
    push: {
      webPublicKeyFingerprint: hash("9"),
      workerPublicKeyFingerprint: hash("9"),
      webSubjectFingerprint: hash("a"),
      workerSubjectFingerprint: hash("a"),
    },
    recovery: {
      checkpointIdRedacted: "backup-redacted-1234",
      checkpointCreatedAt: "2026-07-29T11:00:00.000Z",
      maximumCheckpointAgeHours: 24,
      restoreProcedureReviewed: true,
      rollbackSchemaCompatible: true,
    },
    monitoring: {
      publicUptimeConfigured: true,
      workerHeartbeatConfigured: true,
      pushBacklogAlertConfigured: true,
      deadLetterAlertConfigured: true,
      resourceAlertsConfigured: true,
      alertReceiverTested: true,
      onCallOwner: "Owner",
    },
    cost: {
      oneTimeActivationEstimateUsd: 0.5,
      currentMonthActualUsd: 2,
      currentMonthEstimateBeforeUsd: 4,
      currentCycleIncrementalEstimateUsd: 7.5,
      stagedEstimateUsd: 12,
      stagedEstimateIncludesOneTimeActivation: true,
      retainedMonthlyCostUsd: 8,
      agentUsageUsd: 0,
      agentMonthlyLimitUsd: 1,
      providerHardLimitVerified: false,
      providerEnforcedHardLimitUsd: null,
      providerHardLimitScope: null,
      providerHardLimitCanStopWorkspace: null,
      fullWorkspaceOutageMechanismAccepted: null,
      agentLimitRecordedSeparately: true,
      residualCostRiskAccepted: true,
      manualStopAtUsd: 25,
    },
    rollback: {
      owner: "Owner",
      deploymentIdFingerprint: snapshot.services[0].deploymentIdFingerprint,
      deploymentActionVisible: true,
      rebuildFallbackReady: true,
    },
    providerSnapshotBinding: {
      source: "railway_cli_status_v1",
      artifactSha256: artifact.sha256,
      observedAt: snapshot.observedAt,
      projectIdFingerprint: snapshot.projectIdFingerprint,
      environmentIdFingerprint: snapshot.environmentIdFingerprint,
      currentWebServiceIdFingerprint: snapshot.services[0].serviceIdFingerprint,
      currentWebDeploymentIdFingerprint: snapshot.services[0].deploymentIdFingerprint,
      liveHealth: {
        checkedAt: "2026-07-29T12:58:00.000Z",
        statusCode: 200,
        sourceCommit: commit("c"),
        migrationVersion: "095_packet_94",
      },
    },
  };
  return bindAuthorizedPlan(plan, providerControls);
}

function evaluate(plan, snapshot, options = {}) {
  const providerControlEvidence = options.providerControlEvidence
    ?? readyProviderControls(snapshot);
  const independentApprovedPlanSha256 = options.independentApprovedPlanSha256
    ?? plan.approval.approvedPlanSha256;
  return evaluateRailwayActivationPlan(plan, {
    now: new Date("2026-07-29T13:00:00.000Z"),
    providerSnapshot: snapshot,
    providerSnapshotSha256: snapshotArtifact(snapshot).sha256,
    operatorControlReview: providerControlEvidence,
    operatorControlReviewSha256: options.providerControlEvidenceSha256
      ?? providerControlArtifact(providerControlEvidence).sha256,
    independentApprovedPlanSha256,
    localFacts: readyLocalFacts(),
    ...options,
  });
}

test("accepts a source-bound candidate and a fresh read-only current-state snapshot", () => {
  const snapshot = readySnapshot();
  const result = evaluate(readyPlan(snapshot), snapshot);
  assert.equal(result.ok, true);
  assert.equal(
    result.status,
    "plan_snapshot_and_operator_review_consistent_pending_owner_activation",
  );
  assert.equal(result.summary.steadyStateConnections, 9);
  assert.equal(result.summary.transitionPeakConnections, 20);
  assert.equal(result.summary.transitionHeadroomPercent, 75);
  assert.match(result.summary.providerSnapshotSha256, /^[a-f0-9]{64}$/);
  assert.match(result.summary.operatorControlReviewSha256, /^[a-f0-9]{64}$/);
  assert.equal(
    result.summary.approvedPlanSha256,
    readyPlan(snapshot).approval.approvedPlanSha256,
  );
});

test("rejects approval reuse after any reviewed authority or plan value is changed", () => {
  const snapshot = readySnapshot();
  const authorityTampered = readyPlan(snapshot);
  const approvedDigest = authorityTampered.approval.approvedPlanSha256;
  authorityTampered.approval.oneTimeMaximumUsd = 2;
  assert.equal(authorityTampered.approval.approvedPlanSha256, approvedDigest);
  assert.ok(
    evaluate(authorityTampered, snapshot).findings
      .some(({ code }) => code === "APPROVAL_PLAN_BINDING_INVALID"),
  );

  const planTampered = readyPlan(snapshot);
  planTampered.activationWindow.plannedTestDurationMinutes = 45;
  assert.ok(
    evaluate(planTampered, snapshot).findings
      .some(({ code }) => code === "APPROVAL_PLAN_BINDING_INVALID"),
  );

  const approvalMetadataTampered = readyPlan(snapshot);
  approvalMetadataTampered.approval.approvedBy = "Different operator";
  assert.ok(
    evaluate(approvalMetadataTampered, snapshot).findings
      .some(({ code }) => code === "APPROVAL_PLAN_BINDING_INVALID"),
  );

  const recomputedTampering = readyPlan(snapshot);
  const independentApprovedDigest = recomputedTampering.approval.approvedPlanSha256;
  recomputedTampering.approval.totalMonthlyApprovedCeilingUsd = 300;
  recomputedTampering.approval.approvedPlanSha256 = approvalBindingDigest(recomputedTampering);
  assert.ok(
    evaluate(recomputedTampering, snapshot, {
      independentApprovedPlanSha256: independentApprovedDigest,
    }).findings.some(({ code }) => code === "APPROVAL_PLAN_BINDING_INVALID"),
  );
});

test("one-time activation estimate cannot exceed the separately approved cap", () => {
  const snapshot = readySnapshot();
  const providerControls = readyProviderControls(snapshot);
  const plan = readyPlan(snapshot, providerControls);
  plan.cost.oneTimeActivationEstimateUsd = 1.01;
  bindAuthorizedPlan(plan, providerControls);

  const result = evaluate(plan, snapshot, { providerControlEvidence: providerControls });
  assert.ok(result.findings.some(({ code }) => code === "ONE_TIME_COST_EXCEEDS_APPROVAL"));
});

test("planned activation duration and worker downtime stay inside owner authority", () => {
  const snapshot = readySnapshot();
  const providerControls = readyProviderControls(snapshot);
  const plan = readyPlan(snapshot, providerControls);
  plan.activationWindow.plannedTestDurationMinutes = 61;
  plan.activationWindow.plannedWorkerUnavailableMinutes = 11;
  bindAuthorizedPlan(plan, providerControls);

  const codes = new Set(
    evaluate(plan, snapshot, { providerControlEvidence: providerControls })
      .findings.map(({ code }) => code),
  );
  assert.ok(codes.has("TEST_DURATION_EXCEEDS_APPROVAL"));
  assert.ok(codes.has("WORKER_UNAVAILABILITY_EXCEEDS_APPROVAL"));
});

test("operator control review must be hash-bound, fresh, and for the reviewed environment", () => {
  const snapshot = readySnapshot();

  const bindingControls = readyProviderControls(snapshot);
  const bindingPlan = readyPlan(snapshot, bindingControls);
  const bindingResult = evaluate(bindingPlan, snapshot, {
    providerControlEvidence: bindingControls,
    providerControlEvidenceSha256: hash("f"),
  });
  assert.ok(
    bindingResult.findings.some(
      ({ code }) => code === "OPERATOR_CONTROL_REVIEW_BINDING_INVALID",
    ),
  );

  const staleControls = readyProviderControls(snapshot);
  staleControls.reviewedAt = "2026-07-29T12:30:00.000Z";
  const stalePlan = readyPlan(snapshot, staleControls);
  const staleResult = evaluate(stalePlan, snapshot, {
    providerControlEvidence: staleControls,
  });
  assert.ok(
    staleResult.findings.some(({ code }) => code === "OPERATOR_CONTROL_REVIEW_STALE"),
  );

  const wrongScopeControls = readyProviderControls(snapshot);
  wrongScopeControls.environmentIdFingerprint = hash("f");
  const wrongScopePlan = readyPlan(snapshot, wrongScopeControls);
  const wrongScopeResult = evaluate(wrongScopePlan, snapshot, {
    providerControlEvidence: wrongScopeControls,
  });
  assert.ok(
    wrongScopeResult.findings.some(
      ({ code }) => code === "OPERATOR_CONTROL_REVIEW_SCOPE_MISMATCH",
    ),
  );

  const missingHashesPlan = readyPlan(snapshot);
  missingHashesPlan.providerSnapshotBinding.artifactSha256 = null;
  missingHashesPlan.operatorControlReviewBinding.artifactSha256 = null;
  missingHashesPlan.approval.approvedPlanSha256 = approvalBindingDigest(missingHashesPlan);
  const missingHashesResult = evaluateRailwayActivationPlan(missingHashesPlan, {
    now: new Date("2026-07-29T13:00:00.000Z"),
    providerSnapshot: snapshot,
    providerSnapshotSha256: null,
    operatorControlReview: readyProviderControls(snapshot),
    operatorControlReviewSha256: null,
    independentApprovedPlanSha256: missingHashesPlan.approval.approvedPlanSha256,
    localFacts: readyLocalFacts(),
  });
  const missingHashCodes = new Set(missingHashesResult.findings.map(({ code }) => code));
  assert.ok(missingHashCodes.has("PROVIDER_SNAPSHOT_BINDING_INVALID"));
  assert.ok(missingHashCodes.has("OPERATOR_CONTROL_REVIEW_BINDING_INVALID"));
});

test("billing cycle must be ordered, current, and match the operator control review", () => {
  const snapshot = readySnapshot();

  const reversedControls = readyProviderControls(snapshot);
  reversedControls.billingCycleStartsAt = "2026-08-09T00:00:00.000Z";
  reversedControls.billingCycleEndsAt = "2026-07-09T00:00:00.000Z";
  const reversedPlan = readyPlan(snapshot, reversedControls);
  reversedPlan.railway.billingCycleStartsAt = reversedControls.billingCycleStartsAt;
  reversedPlan.railway.billingCycleEndsAt = reversedControls.billingCycleEndsAt;
  bindAuthorizedPlan(reversedPlan, reversedControls);
  assert.ok(
    evaluate(reversedPlan, snapshot, { providerControlEvidence: reversedControls })
      .findings.some(({ code }) => code === "BILLING_CYCLE_INVALID"),
  );

  const mismatchControls = readyProviderControls(snapshot);
  mismatchControls.billingCycleEndsAt = "2026-08-10T00:00:00.000Z";
  const mismatchPlan = readyPlan(snapshot);
  const mismatchResult = evaluate(mismatchPlan, snapshot, {
    providerControlEvidence: mismatchControls,
  });
  assert.ok(
    mismatchResult.findings.some(
      ({ code }) => code === "OPERATOR_CONTROL_REVIEW_BINDING_INVALID",
    ),
  );
  assert.ok(
    mismatchResult.findings.some(
      ({ code }) => code === "OPERATOR_CONTROL_REVIEW_MISMATCH",
    ),
  );
});

test("Railway Agent limit must cover current usage and fit the approved combined ceiling", () => {
  const snapshot = readySnapshot();

  const belowUsageControls = readyProviderControls(snapshot);
  belowUsageControls.cost.agentMonthlyLimitUsd = 1;
  const belowUsagePlan = readyPlan(snapshot, belowUsageControls);
  belowUsagePlan.cost.agentUsageUsd = 2;
  bindAuthorizedPlan(belowUsagePlan, belowUsageControls);
  assert.ok(
    evaluate(belowUsagePlan, snapshot, { providerControlEvidence: belowUsageControls })
      .findings.some(({ code }) => code === "AGENT_LIMIT_INVALID"),
  );

  const combinedControls = readyProviderControls(snapshot);
  combinedControls.cost.agentMonthlyLimitUsd = 2;
  const combinedPlan = readyPlan(snapshot, combinedControls);
  combinedPlan.cost.agentMonthlyLimitUsd = 2;
  combinedPlan.cost.manualStopAtUsd = 12;
  combinedPlan.approval.totalMonthlyApprovedCeilingUsd = 13;
  bindAuthorizedPlan(combinedPlan, combinedControls);
  assert.ok(
    evaluate(combinedPlan, snapshot, { providerControlEvidence: combinedControls })
      .findings.some(({ code }) => code === "COMBINED_COST_CEILING_EXCEEDED"),
  );
});

test("cost estimates reconcile and enforcement thresholds include the separate Agent limit", () => {
  const snapshot = readySnapshot();

  const understated = readyPlan(snapshot);
  understated.cost.stagedEstimateUsd = 3;
  understated.approval.approvedPlanSha256 = approvalBindingDigest(understated);
  const understatedCodes = new Set(
    evaluate(understated, snapshot).findings.map(({ code }) => code),
  );
  assert.ok(understatedCodes.has("STAGED_ESTIMATE_UNDERSTATED"));
  assert.ok(understatedCodes.has("STAGED_ESTIMATE_NOT_RECONCILED"));

  const excessiveIncrement = readyPlan(snapshot);
  excessiveIncrement.cost.currentCycleIncrementalEstimateUsd = 11;
  excessiveIncrement.cost.stagedEstimateUsd = 15.5;
  excessiveIncrement.approval.approvedPlanSha256 = approvalBindingDigest(excessiveIncrement);
  assert.ok(
    evaluate(excessiveIncrement, snapshot).findings.some(
      ({ code }) => code === "CURRENT_CYCLE_INCREMENT_EXCEEDS_RECURRING_APPROVAL",
    ),
  );

  const manual = readyPlan(snapshot);
  manual.cost.manualStopAtUsd = 30;
  manual.approval.approvedPlanSha256 = approvalBindingDigest(manual);
  assert.ok(
    evaluate(manual, snapshot).findings
      .some(({ code }) => code === "COMBINED_ENFORCEMENT_CEILING_EXCEEDED"),
  );

  const manualBelowPlan = readyPlan(snapshot);
  manualBelowPlan.cost.manualStopAtUsd = 10;
  manualBelowPlan.approval.approvedPlanSha256 = approvalBindingDigest(manualBelowPlan);
  assert.ok(
    evaluate(manualBelowPlan, snapshot).findings
      .some(({ code }) => code === "MANUAL_STOP_BELOW_PLAN"),
  );

  const hardLimitControls = readyProviderControls(snapshot);
  Object.assign(hardLimitControls.cost, {
    providerHardLimitVerified: true,
    providerEnforcedHardLimitUsd: 30,
    providerHardLimitScope: "workspace_compute",
    providerHardLimitCanStopWorkspace: true,
  });
  const hardLimit = readyPlan(snapshot, hardLimitControls);
  Object.assign(hardLimit.cost, {
    providerHardLimitVerified: true,
    providerEnforcedHardLimitUsd: 30,
    providerHardLimitScope: "workspace_compute",
    providerHardLimitCanStopWorkspace: true,
    fullWorkspaceOutageMechanismAccepted: true,
    residualCostRiskAccepted: false,
    manualStopAtUsd: null,
  });
  bindAuthorizedPlan(hardLimit, hardLimitControls);
  assert.ok(
    evaluate(hardLimit, snapshot, { providerControlEvidence: hardLimitControls }).findings
      .some(({ code }) => code === "COMBINED_ENFORCEMENT_CEILING_EXCEEDED"),
  );

  hardLimitControls.cost.providerEnforcedHardLimitUsd = 10;
  const hardLimitBelowPlan = readyPlan(snapshot, hardLimitControls);
  Object.assign(hardLimitBelowPlan.cost, {
    providerHardLimitVerified: true,
    providerEnforcedHardLimitUsd: 10,
    providerHardLimitScope: "workspace_compute",
    providerHardLimitCanStopWorkspace: true,
    fullWorkspaceOutageMechanismAccepted: true,
    residualCostRiskAccepted: false,
    manualStopAtUsd: null,
  });
  bindAuthorizedPlan(hardLimitBelowPlan, hardLimitControls);
  assert.ok(
    evaluate(
      hardLimitBelowPlan,
      snapshot,
      { providerControlEvidence: hardLimitControls },
    ).findings.some(({ code }) => code === "PROVIDER_HARD_LIMIT_BELOW_PLAN"),
  );
});

test("strict recursive schemas reject unknown fields without echoing credential values", () => {
  const snapshot = readySnapshot();
  const plan = readyPlan(snapshot);
  plan.providerSnapshotBinding.liveHealth.unreviewed = "sk_live_do-not-print-credential";
  const result = evaluate(plan, snapshot);
  assert.equal(result.ok, false);
  assert.ok(result.findings.some(({ code }) => code === "PLAN_SCHEMA_INVALID"));
  assert.doesNotMatch(JSON.stringify(result), /do-not-print/);
});

test("bounded schemas reject oversized values and provider fields outside the allowlist", () => {
  const snapshot = readySnapshot();
  const plan = readyPlan(snapshot);
  plan.cost.stagedEstimateUsd = 1_000_000_001;
  snapshot.services[0].variables = { DATABASE_URL: "must-never-be-accepted" };
  const result = evaluate(plan, snapshot);
  const codes = new Set(result.findings.map(({ code }) => code));
  assert.ok(codes.has("PLAN_SCHEMA_INVALID"));
  assert.ok(codes.has("PROVIDER_SNAPSHOT_SCHEMA_INVALID"));
  assert.doesNotMatch(JSON.stringify(result), /DATABASE_URL|must-never-be-accepted/);
});

test("rejects credential-like values even when the strict schema otherwise accepts them", () => {
  const snapshot = readySnapshot();
  const plan = readyPlan(snapshot);
  plan.railway.effectiveConfigSource = "postgres://user:do-not-print@example/db";
  const result = evaluate(plan, snapshot);
  assert.equal(result.ok, false);
  assert.ok(result.findings.some(({ code }) => code === "SENSITIVE_VALUE_PRESENT"));
  assert.match(
    result.findings.find(({ code }) => code === "SENSITIVE_VALUE_PRESENT").message,
    /effectiveConfigSource/,
  );
  assert.doesNotMatch(JSON.stringify(result), /do-not-print/);
});

test("rejects unsafe deploy triggers, a pooler endpoint, and stale recovery evidence", () => {
  const snapshot = readySnapshot();
  const plan = readyPlan(snapshot);
  plan.railway.autodeployMode = "github_push";
  plan.railway.services[1].deploymentTrigger = "github_push";
  plan.railway.services[0].pushRequired = false;
  plan.database.endpointMode = "pgbouncer";
  plan.database.poolerClientLimit = 5;
  plan.recovery.checkpointCreatedAt = "2026-07-27T10:00:00.000Z";

  const result = evaluate(plan, snapshot);
  const codes = new Set(result.findings.map(({ code }) => code));
  for (const code of [
    "AUTODEPLOY_UNSAFE",
    "DEPLOYMENT_TRIGGER_UNSAFE",
    "PUSH_NOT_REQUIRED",
    "DATABASE_ENDPOINT_UNSUPPORTED",
    "RECOVERY_EVIDENCE_INCOMPLETE",
  ]) {
    assert.ok(codes.has(code), `missing ${code}`);
  }
});

test("rejects stale snapshot/live health, rollback mismatch, and local Git/config drift", () => {
  const snapshot = readySnapshot();
  const plan = readyPlan(snapshot);
  snapshot.observedAt = "2026-07-29T12:30:00.000Z";
  plan.providerSnapshotBinding.liveHealth.checkedAt = "2026-07-29T12:30:00.000Z";
  plan.source.rollbackCommit = commit("d");
  const localFacts = readyLocalFacts();
  localFacts.headCommit = commit("d");
  localFacts.preparedAncestorOfCandidate = false;
  localFacts.liveAncestorOfCandidate = false;
  localFacts.originMasterCommit = commit("d");
  localFacts.candidateMatchesOriginMaster = false;
  localFacts.commits.rollbackCommit = false;
  localFacts.workerConfig.deploy.preDeployCommand = "node server/runtime.js migrate";
  localFacts.workerConfigHash = digest(localFacts.workerConfig);

  const result = evaluate(plan, snapshot, { localFacts });
  const codes = new Set(result.findings.map(({ code }) => code));
  for (const code of [
    "CANDIDATE_NOT_HEAD",
    "SOURCE_ANCESTRY_INVALID",
    "LIVE_SOURCE_ANCESTRY_INVALID",
    "CANDIDATE_NOT_ORIGIN_MASTER",
    "LOCAL_CONFIG_MISMATCH",
    "LOCAL_CONFIG_HASH_MISMATCH",
    "PROVIDER_SNAPSHOT_BINDING_INVALID",
    "PROVIDER_SNAPSHOT_STALE",
    "LIVE_HEALTH_MISMATCH",
    "ROLLBACK_BINDING_INVALID",
  ]) {
    assert.ok(codes.has(code), `missing ${code}`);
  }
});

test("deploy branch and effective service controls must match the reviewed master plan", () => {
  const snapshot = readySnapshot();
  const controls = readyProviderControls(snapshot);
  const plan = readyPlan(snapshot, controls);
  plan.railway.connectedBranch = "feature-branch";
  plan.railway.effectiveConfigSource = "dashboard override";
  plan.railway.services[0].drainingSeconds = 29;
  bindAuthorizedPlan(plan, controls);

  const codes = new Set(
    evaluate(plan, snapshot, { providerControlEvidence: controls })
      .findings.map(({ code }) => code),
  );
  assert.ok(codes.has("DEPLOY_BRANCH_INVALID"));
  assert.ok(codes.has("EFFECTIVE_CONFIG_SOURCE_INVALID"));
  assert.ok(codes.has("OPERATOR_CONTROL_REVIEW_MISMATCH"));
  assert.ok(codes.has("OPERATOR_CONTROL_REVIEW_SERVICE_MISMATCH"));
});

test("rejects a future recovery checkpoint and an unbound current deployment", () => {
  const snapshot = readySnapshot();
  const plan = readyPlan(snapshot);
  plan.recovery.checkpointCreatedAt = "2026-07-29T13:01:00.000Z";
  plan.providerSnapshotBinding.currentWebDeploymentIdFingerprint = hash("f");
  const result = evaluate(plan, snapshot);
  const codes = new Set(result.findings.map(({ code }) => code));
  assert.ok(codes.has("RECOVERY_EVIDENCE_INCOMPLETE"));
  assert.ok(codes.has("CURRENT_WEB_BINDING_INVALID"));
});

test("rejects service, transition, and migration topology mismatches even when totals reconcile", () => {
  const snapshot = readySnapshot();
  const plan = readyPlan(snapshot);
  Object.assign(plan.database.steadyStateTopology, {
    candidateWebReplicas: 2,
    migrationProcesses: 1,
    migratePoolMax: 1,
  });
  plan.database.plannedSteadyStateConnections = 14;
  Object.assign(plan.database.transitionTopology, {
    candidateWorkerReplicas: 0,
    migrationProcesses: 0,
    migratePoolMax: 0,
    oldCombinedReplicas: 2,
  });
  plan.database.plannedTransitionPeakConnections = 27;

  const result = evaluate(plan, snapshot);
  const codes = new Set(result.findings.map(({ code }) => code));
  for (const code of [
    "TOPOLOGY_REPLICA_MISMATCH",
    "STEADY_TOPOLOGY_INVALID",
    "TRANSITION_MIGRATION_TOPOLOGY_INVALID",
    "TRANSITION_CURRENT_TOPOLOGY_MISMATCH",
  ]) {
    assert.ok(codes.has(code), `missing ${code}`);
  }
});

test("database ceilings and active pool bounds cannot be understated or drift from review", () => {
  const snapshot = readySnapshot();
  const controls = readyProviderControls(snapshot);
  const plan = readyPlan(snapshot, controls);
  plan.database.observedEffectiveConnections = 96;
  Object.assign(plan.database.steadyStateTopology, {
    webPoolMax: 0,
    workerPoolMax: 0,
    reservedConnections: 0,
  });
  plan.database.plannedSteadyStateConnections = 0;
  Object.assign(plan.database.transitionTopology, {
    webPoolMax: 0,
    workerPoolMax: 0,
    reservedConnections: 0,
  });
  plan.database.plannedTransitionPeakConnections = 11;
  bindAuthorizedPlan(plan, controls);

  const codes = new Set(
    evaluate(plan, snapshot, { providerControlEvidence: controls })
      .findings.map(({ code }) => code),
  );
  assert.ok(codes.has("DATABASE_EFFECTIVE_LIMIT_INVALID"));
  assert.ok(codes.has("TOPOLOGY_POOL_BOUND_INVALID"));
  assert.ok(codes.has("OPERATOR_CONTROL_REVIEW_DATABASE_MISMATCH"));
});

test("verified provider hard limit requires exact scope, outage acceptance, and separate Agent evidence", () => {
  const snapshot = readySnapshot();
  const incomplete = readyPlan(snapshot);
  Object.assign(incomplete.cost, {
    providerHardLimitVerified: true,
    residualCostRiskAccepted: false,
    manualStopAtUsd: null,
  });
  const blocked = evaluate(incomplete, snapshot);
  assert.ok(blocked.findings.some(({ code }) => code === "PROVIDER_HARD_LIMIT_INCOMPLETE"));

  const completeControls = readyProviderControls(snapshot);
  Object.assign(completeControls.cost, {
    providerHardLimitVerified: true,
    providerEnforcedHardLimitUsd: 29,
    providerHardLimitScope: "workspace_compute",
    providerHardLimitCanStopWorkspace: true,
  });
  const complete = readyPlan(snapshot, completeControls);
  Object.assign(complete.cost, {
    providerHardLimitVerified: true,
    providerEnforcedHardLimitUsd: 29,
    providerHardLimitScope: "workspace_compute",
    providerHardLimitCanStopWorkspace: true,
    fullWorkspaceOutageMechanismAccepted: true,
    agentLimitRecordedSeparately: true,
    residualCostRiskAccepted: false,
    manualStopAtUsd: null,
  });
  bindAuthorizedPlan(complete, completeControls);
  assert.equal(
    evaluate(complete, snapshot, { providerControlEvidence: completeControls }).ok,
    true,
  );

  const overApproval = readyPlan(snapshot);
  Object.assign(overApproval.cost, {
    providerHardLimitVerified: true,
    providerEnforcedHardLimitUsd: 31,
    providerHardLimitScope: "workspace_compute",
    providerHardLimitCanStopWorkspace: true,
    fullWorkspaceOutageMechanismAccepted: true,
    agentLimitRecordedSeparately: true,
    residualCostRiskAccepted: false,
    manualStopAtUsd: null,
  });
  assert.ok(
    evaluate(overApproval, snapshot).findings
      .some(({ code }) => code === "PROVIDER_HARD_LIMIT_EXCEEDS_APPROVAL"),
  );

  const missingAgentLimit = readyPlan(snapshot);
  missingAgentLimit.cost.agentLimitRecordedSeparately = false;
  assert.ok(
    evaluate(missingAgentLimit, snapshot).findings
      .some(({ code }) => code === "AGENT_LIMIT_UNVERIFIED"),
  );
});

test("manual cost stop and approval freshness cannot exceed their authority boundaries", () => {
  const snapshot = readySnapshot();
  const plan = readyPlan(snapshot);
  plan.approval.approvedAt = "2026-07-27T12:00:00.000Z";
  plan.approval.expiresAt = "2026-07-30T12:00:00.000Z";
  plan.cost.manualStopAtUsd = 31;
  plan.cost.retainedMonthlyCostUsd = 11;

  const result = evaluate(plan, snapshot);
  const codes = new Set(result.findings.map(({ code }) => code));
  for (const code of [
    "APPROVAL_STALE",
    "RETAINED_COST_CEILING_EXCEEDED",
    "MANUAL_STOP_EXCEEDS_APPROVAL",
  ]) {
    assert.ok(codes.has(code), `missing ${code}`);
  }

  const reached = readyPlan(snapshot);
  reached.cost.manualStopAtUsd = reached.cost.currentMonthActualUsd;
  assert.ok(
    evaluate(reached, snapshot).findings
      .some(({ code }) => code === "MANUAL_STOP_ALREADY_REACHED"),
  );
});

test("activation CLI rejects mixed modes, missing values, and unsupported flags", () => {
  assert.doesNotThrow(() => validateActivationPreflightArguments([
    "--capture-provider-snapshot",
    "C:\\temp\\railway-snapshot.json",
    "--environment",
    "production",
  ]));
  assert.doesNotThrow(() => validateActivationPreflightArguments([
    "--plan",
    "C:\\temp\\plan.json",
    "--print-approval-digest",
  ]));
  assert.doesNotThrow(() => validateActivationPreflightArguments([
    "--plan",
    "C:\\temp\\plan.json",
    "--provider-snapshot",
    "C:\\temp\\snapshot.json",
    "--operator-control-review",
    "C:\\temp\\controls.json",
    "--approved-plan-digest",
    hash("a"),
    "--require-ready",
  ]));
  assert.throws(
    () => validateActivationPreflightArguments([
      "--capture-provider-snapshot",
      "C:\\temp\\snapshot.json",
      "--require-ready",
    ]),
    /cannot be combined/i,
  );
  assert.throws(
    () => validateActivationPreflightArguments(["--plan"]),
    /requires a value/i,
  );
  assert.throws(
    () => validateActivationPreflightArguments(["--pretend-ready"]),
    /unsupported/i,
  );
  assert.throws(
    () => validateActivationPreflightArguments([
      "--plan",
      "C:\\temp\\plan.json",
      "--plan",
      "C:\\temp\\different-plan.json",
      "--print-approval-digest",
    ]),
    /only once/i,
  );
  assert.throws(
    () => validateActivationPreflightArguments([
      "--plan",
      "C:\\temp\\plan.json",
      "--provider-snapshot",
      "C:\\temp\\snapshot.json",
      "--operator-control-review",
      "C:\\temp\\controls.json",
    ]),
    /approved-plan-digest is required/i,
  );
  assert.throws(
    () => validateActivationPreflightArguments([
      "--plan",
      "C:\\temp\\plan.json",
      "--provider-snapshot",
      "C:\\temp\\snapshot.json",
      "--operator-control-review",
      "C:\\temp\\controls.json",
      "--approved-plan-digest",
      hash("a"),
      "--require-ready",
      "--report-only",
    ]),
    /cannot be combined/i,
  );
});

test("Git status failures block cleanliness and evaluation failures exit nonzero by default", () => {
  assert.equal(gitStatusIsClean({ ok: true, output: "" }), true);
  assert.equal(gitStatusIsClean({ ok: false, output: "" }), false);
  assert.equal(gitStatusIsClean({ ok: true, output: " M server/index.js" }), false);
  assert.equal(activationPreflightExitCode({ ok: false }), 1);
  assert.equal(activationPreflightExitCode({ ok: false }, { reportOnly: true }), 0);
  assert.equal(activationPreflightExitCode({ ok: true }), 0);
});

test("Railway CLI status is reduced to an allowlisted snapshot with only fingerprinted IDs", () => {
  const rawStatus = {
    id: "raw-project-id",
    environments: {
      edges: [{
        node: {
          id: "raw-environment-id",
          name: "production",
          volumeInstances: {
            edges: [{
              node: {
                serviceId: "raw-postgres-service-id",
                state: "ACTIVE",
                deletedAt: null,
              },
            }],
          },
          serviceInstances: {
            edges: [
              {
                node: {
                  serviceName: "RIVT",
                  serviceId: "raw-web-service-id",
                  numReplicas: null,
                  domains: [{ domain: "private.example.test" }],
                  source: { secret: "sk_live_do-not-print-credential" },
                  latestDeployment: {
                    id: "raw-web-deployment-id",
                    status: "SUCCESS",
                    canRedeploy: true,
                    meta: {
                      commitHash: commit("c"),
                      commitAuthor: "Private Person",
                      configFile: "/railway.json",
                      serviceManifest: {
                        deploy: {
                          startCommand: "npm start",
                          preDeployCommand: null,
                          healthcheckPath: "/api/health",
                          numReplicas: 1,
                          region: "us-east4-eqdc4a",
                          sleepApplication: false,
                          drainingSeconds: 30,
                        },
                      },
                    },
                  },
                },
              },
              {
                node: {
                  serviceName: "Postgres",
                  serviceId: "raw-postgres-service-id",
                  latestDeployment: {
                    id: "raw-postgres-deployment-id",
                    status: "SUCCESS",
                    canRedeploy: true,
                    meta: {
                      serviceManifest: {
                        deploy: {
                          numReplicas: 1,
                          region: "us-east4-eqdc4a",
                          sleepApplication: false,
                        },
                      },
                    },
                  },
                },
              },
            ],
          },
        },
      }],
    },
  };

  const snapshot = createRailwayStatusSnapshot(rawStatus, {
    observedAt: "2026-07-29T12:55:00.000Z",
  });
  assert.equal(snapshot.services.some(({ serviceKind }) => serviceKind === "worker"), false);
  assert.equal(snapshot.services[0].serviceIdFingerprint, digest("raw-web-service-id"));
  assert.equal(snapshot.services[0].deploymentIdFingerprint, digest("raw-web-deployment-id"));
  assert.equal(snapshot.services[1].volumeAttached, true);
  const serialized = JSON.stringify(snapshot);
  for (const forbidden of [
    "raw-project-id",
    "raw-environment-id",
    "raw-web-service-id",
    "raw-web-deployment-id",
    "private.example.test",
    "do-not-print",
    "Private Person",
  ]) {
    assert.doesNotMatch(serialized, new RegExp(forbidden));
  }

  rawStatus.environments.edges[0].node.serviceInstances.edges[0]
    .node.latestDeployment.meta.serviceManifest.deploy.startCommand
    = "postgres://user:do-not-print@example/db";
  assert.throws(
    () => createRailwayStatusSnapshot(rawStatus),
    (error) => (
      /contains a sensitive value/.test(error.message)
      && !/do-not-print/.test(error.message)
    ),
  );
});
