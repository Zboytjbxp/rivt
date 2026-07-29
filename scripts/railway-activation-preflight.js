import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { z } from "zod";

const SHA_256 = /^[a-f0-9]{64}$/i;
const GIT_SHA = /^[a-f0-9]{40}$/i;
const MAX_SNAPSHOT_AGE_MS = 15 * 60 * 1_000;
const MAX_APPROVAL_AGE_MS = 24 * 60 * 60 * 1_000;
const MAX_RECOVERY_AGE_HOURS = 24;
const EXPECTED_AUTODEPLOY_MODE = "staged_manual_apply";
const EXPECTED_DEPLOYMENT_TRIGGER = "manual_staged";

const text = (maximum = 256) => z.string().trim().min(1).max(maximum);
const nullableText = (maximum = 256) => text(maximum).nullable();
const nullableNumber = z.number().finite().nonnegative().max(1_000_000_000).nullable();
const nullableBoolean = z.boolean().nullable();
const nullableInteger = z.number().int().nonnegative().max(1_000_000).nullable();
const nullableCommit = z.string().regex(GIT_SHA).nullable();
const nullableHash = z.string().regex(SHA_256).nullable();

const approvalSchema = z.object({
  approved: z.boolean(),
  approvedBy: nullableText(128),
  approvedAt: nullableText(64),
  expiresAt: nullableText(64),
  oneTimeMaximumUsd: nullableNumber,
  incrementalMonthlyMaximumUsd: nullableNumber,
  totalMonthlyApprovedCeilingUsd: nullableNumber,
  testDurationMinutes: nullableNumber,
  maximumWorkerUnavailableMinutes: nullableNumber,
}).strict();

const sourceSchema = z.object({
  preparedImplementationCommit: nullableCommit,
  candidateCommit: nullableCommit,
  liveCommitBefore: nullableCommit,
  rollbackCommit: nullableCommit,
}).strict();

const serviceSchema = z.object({
  name: z.enum(["web", "worker"]),
  configPath: nullableText(128),
  role: z.enum(["web", "worker"]).nullable(),
  startCommand: nullableText(128),
  preDeployCommand: nullableText(128),
  healthcheckPath: nullableText(128),
  renderedReplicaCount: nullableInteger,
  region: nullableText(128),
  volumeAttached: nullableBoolean,
  serverlessDisabled: nullableBoolean,
  drainingSeconds: nullableInteger,
  deploymentTrigger: nullableText(64),
  configurationHash: nullableHash,
}).strict();

const railwaySchema = z.object({
  environmentName: nullableText(128),
  region: nullableText(128),
  connectedBranch: nullableText(128),
  autodeployMode: nullableText(64),
  effectiveConfigSource: nullableText(256),
  serverlessDisabled: nullableBoolean,
  overlapSeconds: nullableInteger,
  billingCycleStartsAt: nullableText(64),
  billingCycleEndsAt: nullableText(64),
  services: z.array(serviceSchema).length(2),
}).strict();

const topologySchema = z.object({
  candidateWebReplicas: nullableInteger,
  webPoolMax: nullableInteger,
  candidateWorkerReplicas: nullableInteger,
  workerPoolMax: nullableInteger,
  migrationProcesses: nullableInteger,
  migratePoolMax: nullableInteger,
  reservedConnections: nullableInteger,
  oldCombinedReplicas: nullableInteger,
  oldCombinedPoolMax: nullableInteger,
}).strict();

const databaseSchema = z.object({
  privateEndpointConfirmed: nullableBoolean,
  endpointMode: z.enum(["direct", "pgbouncer", "ha"]).nullable(),
  poolerClientLimit: nullableNumber,
  observedGlobalUsableConnections: nullableNumber,
  observedEffectiveConnections: nullableNumber,
  declaredMaxConnections: nullableNumber,
  migrationOwner: z.enum(["web", "worker"]).nullable(),
  maximumConcurrentMigrationProcesses: nullableInteger,
  expandContractCompatibleWithRollback: nullableBoolean,
  steadyStateTopology: topologySchema,
  transitionTopology: topologySchema,
  plannedSteadyStateConnections: nullableNumber,
  plannedTransitionPeakConnections: nullableNumber,
}).strict();

const pushSchema = z.object({
  webPublicKeyFingerprint: nullableHash,
  workerPublicKeyFingerprint: nullableHash,
  webSubjectFingerprint: nullableHash,
  workerSubjectFingerprint: nullableHash,
}).strict();

const recoverySchema = z.object({
  checkpointIdRedacted: nullableText(128),
  checkpointCreatedAt: nullableText(64),
  maximumCheckpointAgeHours: nullableNumber,
  restoreProcedureReviewed: nullableBoolean,
  rollbackSchemaCompatible: nullableBoolean,
}).strict();

const monitoringSchema = z.object({
  publicUptimeConfigured: nullableBoolean,
  workerHeartbeatConfigured: nullableBoolean,
  pushBacklogAlertConfigured: nullableBoolean,
  deadLetterAlertConfigured: nullableBoolean,
  resourceAlertsConfigured: nullableBoolean,
  alertReceiverTested: nullableBoolean,
  onCallOwner: nullableText(128),
}).strict();

const costSchema = z.object({
  currentMonthActualUsd: nullableNumber,
  currentMonthEstimateBeforeUsd: nullableNumber,
  stagedEstimateUsd: nullableNumber,
  retainedMonthlyCostUsd: nullableNumber,
  agentUsageUsd: nullableNumber,
  providerHardLimitVerified: nullableBoolean,
  providerEnforcedHardLimitUsd: nullableNumber,
  providerHardLimitScope: z.enum(["workspace_compute"]).nullable(),
  providerHardLimitCanStopWorkspace: nullableBoolean,
  fullWorkspaceOutageMechanismAccepted: nullableBoolean,
  agentLimitRecordedSeparately: nullableBoolean,
  residualCostRiskAccepted: nullableBoolean,
  manualStopAtUsd: nullableNumber,
}).strict();

const rollbackSchema = z.object({
  owner: nullableText(128),
  deploymentIdFingerprint: nullableHash,
  deploymentActionVisible: nullableBoolean,
  rebuildFallbackReady: nullableBoolean,
}).strict();

const snapshotBindingSchema = z.object({
  source: z.literal("railway_cli_status_v1"),
  artifactSha256: nullableHash,
  observedAt: nullableText(64),
  projectIdFingerprint: nullableHash,
  environmentIdFingerprint: nullableHash,
  currentWebServiceIdFingerprint: nullableHash,
  currentWebDeploymentIdFingerprint: nullableHash,
  liveHealth: z.object({
    checkedAt: nullableText(64),
    statusCode: z.number().int().min(100).max(599).nullable(),
    sourceCommit: nullableCommit,
    migrationVersion: nullableText(128),
  }).strict(),
}).strict();

const activationPlanSchema = z.object({
  schemaVersion: z.literal(1),
  status: z.enum(["draft", "authorized_preflight"]),
  activationStage: z.enum(["split", "redundancy"]),
  approval: approvalSchema,
  source: sourceSchema,
  railway: railwaySchema,
  database: databaseSchema,
  push: pushSchema,
  recovery: recoverySchema,
  monitoring: monitoringSchema,
  cost: costSchema,
  rollback: rollbackSchema,
  providerSnapshotBinding: snapshotBindingSchema,
}).strict();

const snapshotServiceSchema = z.object({
  serviceName: text(128),
  serviceKind: z.enum(["current_web", "worker", "database_or_dependency"]),
  serviceIdFingerprint: z.string().regex(SHA_256),
  deploymentIdFingerprint: z.string().regex(SHA_256),
  sourceCommit: nullableCommit,
  configPath: nullableText(128),
  startCommand: nullableText(128),
  preDeployCommand: nullableText(128),
  healthcheckPath: nullableText(128),
  renderedReplicaCount: z.number().int().positive().max(1_000),
  region: nullableText(128),
  volumeAttached: z.boolean(),
  serverlessDisabled: nullableBoolean,
  drainingSeconds: nullableInteger,
  deploymentStatus: text(64),
  rollbackAvailable: z.boolean(),
  configurationHash: z.string().regex(SHA_256),
}).strict();

const providerSnapshotSchema = z.object({
  schemaVersion: z.literal(1),
  source: z.literal("railway_cli_status_v1"),
  observedAt: text(64),
  projectIdFingerprint: z.string().regex(SHA_256),
  environmentName: text(128),
  environmentIdFingerprint: z.string().regex(SHA_256),
  services: z.array(snapshotServiceSchema).min(1).max(32),
}).strict();

const SECRET_VALUE_PATTERNS = Object.freeze([
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i,
  /\b(?:postgres(?:ql)?|mysql|redis):\/\/[^@\s]+@/i,
  /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9_-]{12,}\b/,
  /\bwhsec_[A-Za-z0-9_-]{12,}\b/,
  /\bBearer\s+[A-Za-z0-9._~+/-]{16,}\b/i,
  /\b(?:DATABASE_URL|PASSWORD|PRIVATE_KEY|ACCESS_TOKEN)\s*=/i,
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/,
]);

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function finiteNonNegative(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function positive(value) {
  return finiteNonNegative(value) && value > 0;
}

function integerAtLeast(value, minimum) {
  return Number.isSafeInteger(value) && value >= minimum;
}

function validDate(value) {
  return hasText(value) && Number.isFinite(new Date(value).getTime());
}

function sensitiveValuePaths(value, pathName = "$", found = []) {
  if (typeof value === "string") {
    if (SECRET_VALUE_PATTERNS.some((pattern) => pattern.test(value))) found.push(pathName);
    return found;
  }
  if (!value || typeof value !== "object") return found;
  for (const [key, child] of Object.entries(value)) {
    sensitiveValuePaths(child, `${pathName}.${key}`, found);
  }
  return found;
}

function serviceByName(record, name) {
  return record?.services?.find((service) => service.name === name);
}

function topologyTotal(topology, { transition }) {
  if (!topology) return null;
  const values = [
    topology.candidateWebReplicas,
    topology.webPoolMax,
    topology.candidateWorkerReplicas,
    topology.workerPoolMax,
    topology.migrationProcesses,
    topology.migratePoolMax,
    topology.reservedConnections,
  ];
  if (transition) values.push(topology.oldCombinedReplicas, topology.oldCombinedPoolMax);
  if (!values.every((value) => integerAtLeast(value, 0))) return null;
  return (
    topology.candidateWebReplicas * topology.webPoolMax
    + topology.candidateWorkerReplicas * topology.workerPoolMax
    + topology.migrationProcesses * topology.migratePoolMax
    + topology.reservedConnections
    + (transition ? topology.oldCombinedReplicas * topology.oldCombinedPoolMax : 0)
  );
}

function headroomPercent(ceiling, planned) {
  if (!positive(ceiling) || !finiteNonNegative(planned)) return null;
  return Math.round(((ceiling - planned) / ceiling) * 10_000) / 100;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => (
      `${JSON.stringify(key)}:${canonicalJson(value[key])}`
    )).join(",")}}`;
  }
  return JSON.stringify(value);
}

function configurationDigest(value) {
  return sha256(canonicalJson(value));
}

function fingerprint(value) {
  return hasText(value) ? sha256(String(value)) : null;
}

function graphNodes(connection) {
  return Array.isArray(connection?.edges)
    ? connection.edges.map((edge) => edge?.node).filter(Boolean)
    : [];
}

function normalizedRegion(deploy) {
  if (hasText(deploy?.region)) return deploy.region;
  const regions = Object.keys(deploy?.multiRegionConfig ?? {});
  return regions.length === 1 ? regions[0] : null;
}

function allowlistedServiceSnapshot(service, volumeInstances, webServiceName) {
  const deployment = service.latestDeployment ?? {};
  const metadata = deployment.meta ?? {};
  const deploy = metadata.serviceManifest?.deploy ?? {};
  const serviceId = String(service.serviceId ?? "");
  const startCommand = (
    hasText(service.startCommand)
      ? service.startCommand
      : hasText(deploy.startCommand)
        ? deploy.startCommand
        : null
  );
  const serviceKind = service.serviceName === webServiceName
    ? "current_web"
    : startCommand === "node server/runtime.js worker"
      ? "worker"
      : "database_or_dependency";
  const allowlistedConfiguration = {
    configPath: hasText(metadata.configFile) ? metadata.configFile : null,
    startCommand,
    preDeployCommand: hasText(deploy.preDeployCommand) ? deploy.preDeployCommand : null,
    healthcheckPath: hasText(deploy.healthcheckPath) ? deploy.healthcheckPath : null,
    renderedReplicaCount: Number(service.numReplicas ?? deploy.numReplicas ?? 1),
    region: normalizedRegion(deploy),
    serverlessDisabled: typeof deploy.sleepApplication === "boolean"
      ? !deploy.sleepApplication
      : null,
    drainingSeconds: Number.isSafeInteger(Number(deploy.drainingSeconds))
      ? Number(deploy.drainingSeconds)
      : null,
  };
  return {
    serviceName: String(service.serviceName ?? "").slice(0, 128),
    serviceKind,
    serviceIdFingerprint: fingerprint(serviceId),
    deploymentIdFingerprint: fingerprint(deployment.id),
    sourceCommit: GIT_SHA.test(String(metadata.commitHash ?? "")) ? metadata.commitHash : null,
    ...allowlistedConfiguration,
    volumeAttached: volumeInstances.some((volume) => (
      String(volume.serviceId ?? "") === serviceId
      && !volume.deletedAt
      && volume.state !== "DELETED"
    )),
    deploymentStatus: String(deployment.status ?? "unknown").slice(0, 64),
    rollbackAvailable: deployment.canRedeploy === true,
    configurationHash: sha256(JSON.stringify(allowlistedConfiguration)),
  };
}

export function createRailwayStatusSnapshot(
  status,
  {
    environmentName = "production",
    webServiceName = "RIVT",
    observedAt = new Date().toISOString(),
  } = {},
) {
  if (!status || typeof status !== "object") {
    throw new Error("Railway status must be one parsed JSON object.");
  }
  const environment = graphNodes(status.environments)
    .find((candidate) => candidate?.name === environmentName);
  if (!environment) throw new Error(`Railway environment ${environmentName} was not found.`);
  const volumeInstances = graphNodes(environment.volumeInstances);
  const services = graphNodes(environment.serviceInstances)
    .map((service) => allowlistedServiceSnapshot(service, volumeInstances, webServiceName));
  if (!services.some((service) => service.serviceKind === "current_web")) {
    throw new Error(`Railway service ${webServiceName} was not found in ${environmentName}.`);
  }
  const snapshot = {
    schemaVersion: 1,
    source: "railway_cli_status_v1",
    observedAt,
    projectIdFingerprint: fingerprint(status.id),
    environmentName,
    environmentIdFingerprint: fingerprint(environment.id),
    services,
  };
  const parsed = providerSnapshotSchema.safeParse(snapshot);
  if (!parsed.success) {
    throw new Error(`Allowlisted Railway status snapshot is invalid: ${parsed.error.issues[0]?.message ?? "unknown error"}`);
  }
  const sensitivePaths = sensitiveValuePaths(parsed.data);
  if (sensitivePaths.length > 0) {
    throw new Error(`Allowlisted Railway status contains a sensitive value at ${sensitivePaths.join(", ")}.`);
  }
  return parsed.data;
}

function runGit(repositoryRoot, args) {
  const result = spawnSync("git", args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    windowsHide: true,
  });
  return {
    ok: result.status === 0,
    output: String(result.stdout ?? "").trim(),
  };
}

function readDeploymentConfig(repositoryRoot, name) {
  return JSON.parse(fs.readFileSync(path.join(repositoryRoot, name), "utf8"));
}

export function deriveLocalRepositoryFacts(repositoryRoot, source) {
  const commits = {};
  for (const name of [
    "preparedImplementationCommit",
    "candidateCommit",
    "liveCommitBefore",
    "rollbackCommit",
  ]) {
    const commit = source?.[name];
    commits[name] = GIT_SHA.test(String(commit ?? ""))
      && runGit(repositoryRoot, ["cat-file", "-e", `${commit}^{commit}`]).ok;
  }
  const webConfig = readDeploymentConfig(repositoryRoot, "railway.json");
  const workerConfig = readDeploymentConfig(repositoryRoot, "railway.worker.json");
  return {
    headCommit: runGit(repositoryRoot, ["rev-parse", "HEAD"]).output,
    workingTreeClean: runGit(repositoryRoot, ["status", "--porcelain"]).output === "",
    commits,
    preparedAncestorOfCandidate: (
      commits.preparedImplementationCommit
      && commits.candidateCommit
      && runGit(repositoryRoot, [
        "merge-base",
        "--is-ancestor",
        source.preparedImplementationCommit,
        source.candidateCommit,
      ]).ok
    ),
    webConfig,
    webConfigHash: configurationDigest(webConfig),
    workerConfig,
    workerConfigHash: configurationDigest(workerConfig),
  };
}

function schemaFindings(prefix, result) {
  if (result.success) return [];
  return result.error.issues.map((issue) => ({
    code: `${prefix}_SCHEMA_INVALID`,
    message: `${issue.path.length ? issue.path.join(".") : "$"}: ${issue.message}`,
  }));
}

function recentNotFuture(value, now, maximumAgeMs) {
  if (!validDate(value)) return false;
  const timestamp = new Date(value).getTime();
  const nowMs = now.getTime();
  return timestamp <= nowMs && nowMs - timestamp <= maximumAgeMs;
}

function localConfigMatches(localFacts, expected) {
  const local = expected.name === "web" ? localFacts?.webConfig : localFacts?.workerConfig;
  if (!local) return false;
  const deploy = local.deploy ?? {};
  return (
    deploy.startCommand === expected.startCommand
    && (deploy.preDeployCommand ?? null) === expected.preDeployCommand
    && (deploy.healthcheckPath ?? null) === expected.healthcheckPath
    && deploy.drainingSeconds === 30
  );
}

export function evaluateRailwayActivationPlan(
  rawPlan,
  {
    now = new Date(),
    providerSnapshot: rawProviderSnapshot = null,
    providerSnapshotSha256 = null,
    localFacts = null,
  } = {},
) {
  const planResult = activationPlanSchema.safeParse(rawPlan);
  const snapshotResult = providerSnapshotSchema.safeParse(rawProviderSnapshot);
  const findings = [
    ...schemaFindings("PLAN", planResult),
    ...schemaFindings("PROVIDER_SNAPSHOT", snapshotResult),
  ];
  if (!planResult.success || !snapshotResult.success) {
    return {
      ok: false,
      status: "blocked",
      findings,
      summary: {
        activationStage: null,
        candidateCommit: null,
        steadyStateConnections: null,
        transitionPeakConnections: null,
        steadyStateHeadroomPercent: null,
        transitionHeadroomPercent: null,
      },
    };
  }

  const plan = planResult.data;
  const providerSnapshot = snapshotResult.data;
  const add = (code, message) => findings.push({ code, message });

  const sensitivePaths = [
    ...sensitiveValuePaths(plan),
    ...sensitiveValuePaths(providerSnapshot, "$providerSnapshot"),
  ];
  if (sensitivePaths.length > 0) {
    add("SENSITIVE_VALUE_PRESENT", `Remove sensitive values at: ${sensitivePaths.join(", ")}.`);
  }

  if (plan.status !== "authorized_preflight") {
    add("PLAN_NOT_AUTHORIZED", "Plan status must be authorized_preflight.");
  }

  const approval = plan.approval;
  if (
    approval.approved !== true
    || !hasText(approval.approvedBy)
    || !validDate(approval.approvedAt)
    || !validDate(approval.expiresAt)
  ) {
    add("APPROVAL_INCOMPLETE", "Approval must name its owner, approval time, and expiry.");
  } else {
    const approvedAt = new Date(approval.approvedAt).getTime();
    const expiresAt = new Date(approval.expiresAt).getTime();
    if (approvedAt > now.getTime() || expiresAt <= approvedAt) {
      add("APPROVAL_TIMELINE_INVALID", "Approval time must not be future and expiry must follow approval.");
    }
    if (now.getTime() - approvedAt > MAX_APPROVAL_AGE_MS) {
      add("APPROVAL_STALE", "Activation approval must be no more than 24 hours old.");
    }
    if (expiresAt <= now.getTime()) add("APPROVAL_EXPIRED", "Activation approval has expired.");
  }
  for (const name of [
    "oneTimeMaximumUsd",
    "incrementalMonthlyMaximumUsd",
    "totalMonthlyApprovedCeilingUsd",
    "testDurationMinutes",
    "maximumWorkerUnavailableMinutes",
  ]) {
    if (!positive(approval[name])) add("APPROVAL_LIMIT_MISSING", `${name} must be a positive number.`);
  }

  const source = plan.source;
  if (source.candidateCommit === source.liveCommitBefore) {
    add("SOURCE_NOT_CHANGED", "Candidate and live-before commits must not be identical.");
  }
  if (!localFacts) {
    add("LOCAL_FACTS_MISSING", "Local Git and Railway config facts are required.");
  } else {
    if (localFacts.headCommit !== source.candidateCommit) {
      add("CANDIDATE_NOT_HEAD", "Candidate commit must equal the local repository HEAD.");
    }
    if (localFacts.workingTreeClean !== true) {
      add("WORKTREE_DIRTY", "The activation source worktree must be clean.");
    }
    for (const [name, exists] of Object.entries(localFacts.commits ?? {})) {
      if (exists !== true) add("SOURCE_COMMIT_MISSING", `${name} does not resolve to a local commit.`);
    }
    if (localFacts.preparedAncestorOfCandidate !== true) {
      add("SOURCE_ANCESTRY_INVALID", "Prepared implementation commit must be an ancestor of candidate commit.");
    }
  }

  const railway = plan.railway;
  for (const name of [
    "environmentName",
    "region",
    "connectedBranch",
    "effectiveConfigSource",
  ]) {
    if (!hasText(railway[name])) add("RAILWAY_FACT_MISSING", `${name} is required.`);
  }
  if (railway.autodeployMode !== EXPECTED_AUTODEPLOY_MODE) {
    add("AUTODEPLOY_UNSAFE", `Autodeploy mode must be ${EXPECTED_AUTODEPLOY_MODE}.`);
  }
  if (railway.serverlessDisabled !== true) {
    add("APP_SLEEP_NOT_DISABLED", "Serverless/app sleep must be disabled for web and worker.");
  }
  if (!integerAtLeast(railway.overlapSeconds, 0)) {
    add("OVERLAP_INVALID", "Deployment overlap must be recorded as a non-negative integer.");
  }
  if (!validDate(railway.billingCycleStartsAt) || !validDate(railway.billingCycleEndsAt)) {
    add("BILLING_CYCLE_MISSING", "Current Railway billing-cycle dates are required.");
  }

  const web = serviceByName(railway, "web");
  const worker = serviceByName(railway, "worker");
  if (!web || !worker) {
    add("SERVICE_SET_INVALID", "Plan must contain exactly one web and one worker record.");
  } else {
    const expectedWebReplicas = plan.activationStage === "redundancy" ? 2 : 1;
    const expectations = [
      [web, "web", "/railway.json", "node server/runtime.js web", "node server/runtime.js migrate", "/api/health", expectedWebReplicas],
      [worker, "worker", "/railway.worker.json", "node server/runtime.js worker", "node server/runtime.js worker-check", null, 1],
    ];
    for (const [
      service,
      role,
      configPath,
      startCommand,
      preDeployCommand,
      healthcheckPath,
      replicas,
    ] of expectations) {
      if (service.role !== role) add("SERVICE_ROLE_MISMATCH", `${role} service role is wrong.`);
      if (service.configPath !== configPath) add("CONFIG_PATH_MISMATCH", `${role} config path is wrong.`);
      if (service.startCommand !== startCommand) add("START_COMMAND_MISMATCH", `${role} start command is wrong.`);
      if ((service.preDeployCommand ?? null) !== preDeployCommand) {
        add("PREDEPLOY_MISMATCH", `${role} pre-deploy command is wrong.`);
      }
      if ((service.healthcheckPath ?? null) !== healthcheckPath) {
        add("HEALTHCHECK_MISMATCH", `${role} healthcheck path is wrong.`);
      }
      if (service.renderedReplicaCount !== replicas) {
        add("REPLICA_COUNT_MISMATCH", `${role} rendered replica count must be ${replicas}.`);
      }
      if (service.region !== railway.region) add("REGION_MISMATCH", `${role} must share the reviewed region.`);
      if (service.volumeAttached !== false) add("SERVICE_VOLUME_ATTACHED", `${role} must not have a volume.`);
      if (service.serverlessDisabled !== true) add("SERVICE_APP_SLEEP_ENABLED", `${role} app sleep must be disabled.`);
      if (service.drainingSeconds !== 30) add("DRAIN_MISMATCH", `${role} drain must be 30 seconds.`);
      if (service.deploymentTrigger !== EXPECTED_DEPLOYMENT_TRIGGER) {
        add("DEPLOYMENT_TRIGGER_UNSAFE", `${role} must use the reviewed manual staged trigger.`);
      }
      if (!SHA_256.test(String(service.configurationHash ?? ""))) {
        add("CONFIG_HASH_INVALID", `${role} needs a redacted SHA-256 configuration hash.`);
      }
      if (!localConfigMatches(localFacts, { name: role, startCommand, preDeployCommand, healthcheckPath })) {
        add("LOCAL_CONFIG_MISMATCH", `${role} local Railway config does not match the activation contract.`);
      }
      const localHash = role === "web" ? localFacts?.webConfigHash : localFacts?.workerConfigHash;
      if (service.configurationHash !== localHash) {
        add("LOCAL_CONFIG_HASH_MISMATCH", `${role} configuration hash does not match the checked-in config.`);
      }
    }
  }

  const binding = plan.providerSnapshotBinding;
  if (
    binding.artifactSha256 !== providerSnapshotSha256
    || binding.source !== providerSnapshot.source
    || binding.observedAt !== providerSnapshot.observedAt
  ) {
    add("PROVIDER_SNAPSHOT_BINDING_INVALID", "Plan is not bound to the supplied provider snapshot artifact.");
  }
  if (!recentNotFuture(providerSnapshot.observedAt, now, MAX_SNAPSHOT_AGE_MS)) {
    add("PROVIDER_SNAPSHOT_STALE", "Provider snapshot must be no more than 15 minutes old and not future.");
  }

  const currentWebServices = providerSnapshot.services
    .filter((service) => service.serviceKind === "current_web");
  const currentWeb = currentWebServices.length === 1 ? currentWebServices[0] : null;
  if (
    binding.projectIdFingerprint !== providerSnapshot.projectIdFingerprint
    || binding.environmentIdFingerprint !== providerSnapshot.environmentIdFingerprint
    || providerSnapshot.environmentName !== railway.environmentName
  ) {
    add("PROVIDER_SCOPE_MISMATCH", "Provider snapshot project/environment scope differs from the plan binding.");
  }
  if (
    binding.liveHealth.statusCode !== 200
    || binding.liveHealth.sourceCommit !== source.liveCommitBefore
    || !hasText(binding.liveHealth.migrationVersion)
    || !recentNotFuture(binding.liveHealth.checkedAt, now, MAX_SNAPSHOT_AGE_MS)
  ) {
    add("LIVE_HEALTH_MISMATCH", "Fresh live health must return 200 for the recorded live-before commit.");
  }
  if (!currentWeb) {
    add("CURRENT_WEB_SNAPSHOT_INVALID", "Provider snapshot must contain exactly one current web service.");
  } else {
    if (
      binding.currentWebServiceIdFingerprint !== currentWeb.serviceIdFingerprint
      || binding.currentWebDeploymentIdFingerprint !== currentWeb.deploymentIdFingerprint
    ) {
      add("CURRENT_WEB_BINDING_INVALID", "Plan binding must identify the current web service and deployment.");
    }
    if (
      currentWeb.sourceCommit !== source.liveCommitBefore
      || currentWeb.sourceCommit !== source.rollbackCommit
      || currentWeb.deploymentStatus !== "SUCCESS"
      || currentWeb.rollbackAvailable !== true
      || plan.rollback.deploymentIdFingerprint !== currentWeb.deploymentIdFingerprint
    ) {
      add("ROLLBACK_BINDING_INVALID", "Rollback must bind to the successful, redeployable current web deployment and source.");
    }
  }

  const database = plan.database;
  if (database.privateEndpointConfirmed !== true) {
    add("DATABASE_NOT_PRIVATE", "Database endpoint must be confirmed private.");
  }
  if (database.endpointMode !== "direct" || database.poolerClientLimit !== null) {
    add("DATABASE_ENDPOINT_UNSUPPORTED", "Current activation requires a direct private PostgreSQL endpoint.");
  }
  for (const name of [
    "observedGlobalUsableConnections",
    "observedEffectiveConnections",
    "declaredMaxConnections",
  ]) {
    if (!positive(database[name])) add("DATABASE_LIMIT_MISSING", `${name} must be positive.`);
  }
  if (
    positive(database.observedEffectiveConnections)
    && positive(database.declaredMaxConnections)
    && database.declaredMaxConnections > database.observedEffectiveConnections
  ) {
    add("DATABASE_CEILING_OVERSTATED", "Declared ceiling exceeds the observed effective ceiling.");
  }
  if (database.migrationOwner !== "web" || database.maximumConcurrentMigrationProcesses !== 1) {
    add("MIGRATION_CONCURRENCY_INVALID", "Web must be the sole migration owner with concurrency one.");
  }
  if (database.expandContractCompatibleWithRollback !== true) {
    add("MIGRATION_COMPATIBILITY_UNPROVED", "Old source compatibility or reviewed forward repair is required.");
  }

  const steadyTotal = topologyTotal(database.steadyStateTopology, { transition: false });
  const transitionTotal = topologyTotal(database.transitionTopology, { transition: true });
  const steadyTopology = database.steadyStateTopology;
  const transitionTopology = database.transitionTopology;
  const expectedWebReplicas = plan.activationStage === "redundancy" ? 2 : 1;
  const expectedWorkerReplicas = 1;
  for (const [name, topology] of [
    ["steady", steadyTopology],
    ["transition", transitionTopology],
  ]) {
    if (
      topology.candidateWebReplicas !== expectedWebReplicas
      || topology.candidateWorkerReplicas !== expectedWorkerReplicas
    ) {
      add(
        "TOPOLOGY_REPLICA_MISMATCH",
        `${name} topology candidate replicas must match the validated web and worker services.`,
      );
    }
  }
  if (
    steadyTopology.migrationProcesses !== 0
    || steadyTopology.migratePoolMax !== 0
    || steadyTopology.oldCombinedReplicas !== 0
    || steadyTopology.oldCombinedPoolMax !== 0
  ) {
    add(
      "STEADY_TOPOLOGY_INVALID",
      "Steady topology cannot retain migration or replaced-service connections.",
    );
  }
  if (
    transitionTopology.migrationProcesses !== 1
    || !positive(transitionTopology.migratePoolMax)
  ) {
    add(
      "TRANSITION_MIGRATION_TOPOLOGY_INVALID",
      "Transition topology must include exactly one bounded migration process.",
    );
  }
  if (
    currentWeb
    && (
      transitionTopology.oldCombinedReplicas !== currentWeb.renderedReplicaCount
      || (
        transitionTopology.oldCombinedReplicas > 0
        && !positive(transitionTopology.oldCombinedPoolMax)
      )
    )
  ) {
    add(
      "TRANSITION_CURRENT_TOPOLOGY_MISMATCH",
      "Transition replaced-service replicas must match the current provider snapshot and use a positive pool bound.",
    );
  }
  if (steadyTotal === null || steadyTotal !== database.plannedSteadyStateConnections) {
    add("STEADY_TOPOLOGY_INVALID", "Steady-state connection total does not match its components.");
  }
  if (transitionTotal === null || transitionTotal !== database.plannedTransitionPeakConnections) {
    add("TRANSITION_TOPOLOGY_INVALID", "Transition connection total does not match its components.");
  }
  for (const [name, total] of [["steady", steadyTotal], ["transition", transitionTotal]]) {
    const percent = headroomPercent(database.declaredMaxConnections, total);
    if (percent === null || percent < 30) {
      add("DATABASE_HEADROOM_INSUFFICIENT", `${name} topology must retain at least 30% headroom.`);
    }
  }

  const push = plan.push;
  for (const name of [
    "webPublicKeyFingerprint",
    "workerPublicKeyFingerprint",
    "webSubjectFingerprint",
    "workerSubjectFingerprint",
  ]) {
    if (!SHA_256.test(String(push[name] ?? ""))) {
      add("PUSH_FINGERPRINT_INVALID", `${name} must be a SHA-256 fingerprint.`);
    }
  }
  if (push.webPublicKeyFingerprint !== push.workerPublicKeyFingerprint) {
    add("PUSH_KEY_MISMATCH", "Web and worker VAPID public-key fingerprints differ.");
  }
  if (push.webSubjectFingerprint !== push.workerSubjectFingerprint) {
    add("PUSH_SUBJECT_MISMATCH", "Web and worker VAPID subject fingerprints differ.");
  }

  const recovery = plan.recovery;
  const maximumCheckpointAgeHours = recovery.maximumCheckpointAgeHours;
  if (
    !hasText(recovery.checkpointIdRedacted)
    || !positive(maximumCheckpointAgeHours)
    || maximumCheckpointAgeHours > MAX_RECOVERY_AGE_HOURS
    || !recentNotFuture(
      recovery.checkpointCreatedAt,
      now,
      Number(maximumCheckpointAgeHours) * 60 * 60 * 1_000,
    )
    || recovery.restoreProcedureReviewed !== true
    || recovery.rollbackSchemaCompatible !== true
  ) {
    add("RECOVERY_EVIDENCE_INCOMPLETE", "Recovery checkpoint must be current, not future, and inside the approved 24-hour RPO.");
  }

  const monitoring = plan.monitoring;
  for (const name of [
    "publicUptimeConfigured",
    "workerHeartbeatConfigured",
    "pushBacklogAlertConfigured",
    "deadLetterAlertConfigured",
    "resourceAlertsConfigured",
    "alertReceiverTested",
  ]) {
    if (monitoring[name] !== true) add("MONITORING_INCOMPLETE", `${name} must be true.`);
  }
  if (!hasText(monitoring.onCallOwner)) add("ON_CALL_OWNER_MISSING", "Monitoring requires an on-call owner.");

  const cost = plan.cost;
  for (const name of [
    "currentMonthActualUsd",
    "currentMonthEstimateBeforeUsd",
    "stagedEstimateUsd",
    "retainedMonthlyCostUsd",
    "agentUsageUsd",
  ]) {
    if (!finiteNonNegative(cost[name])) add("COST_FACT_MISSING", `${name} must be recorded.`);
  }
  if (
    finiteNonNegative(cost.stagedEstimateUsd)
    && positive(approval.totalMonthlyApprovedCeilingUsd)
    && cost.stagedEstimateUsd > approval.totalMonthlyApprovedCeilingUsd
  ) {
    add("COST_CEILING_EXCEEDED", "Staged estimate exceeds the approved monthly ceiling.");
  }
  if (
    finiteNonNegative(cost.retainedMonthlyCostUsd)
    && positive(approval.incrementalMonthlyMaximumUsd)
    && cost.retainedMonthlyCostUsd > approval.incrementalMonthlyMaximumUsd
  ) {
    add("RETAINED_COST_CEILING_EXCEEDED", "Retained monthly cost exceeds the approved incremental ceiling.");
  }
  if (cost.providerHardLimitVerified === true) {
    if (
      !positive(cost.providerEnforcedHardLimitUsd)
      || cost.providerHardLimitScope !== "workspace_compute"
      || cost.providerHardLimitCanStopWorkspace !== true
      || cost.fullWorkspaceOutageMechanismAccepted !== true
    ) {
      add(
        "PROVIDER_HARD_LIMIT_INCOMPLETE",
        "A verified Railway hard limit requires its amount, workspace Compute scope, and explicit outage-behavior acceptance.",
      );
    }
    if (
      positive(cost.providerEnforcedHardLimitUsd)
      && positive(approval.totalMonthlyApprovedCeilingUsd)
      && cost.providerEnforcedHardLimitUsd > approval.totalMonthlyApprovedCeilingUsd
    ) {
      add(
        "PROVIDER_HARD_LIMIT_EXCEEDS_APPROVAL",
        "The provider hard limit cannot exceed the approved total monthly ceiling.",
      );
    }
  } else {
    if (cost.residualCostRiskAccepted !== true || !positive(cost.manualStopAtUsd)) {
      add(
        "COST_ENFORCEMENT_UNRESOLVED",
        "Without a verified provider hard limit, approval must accept residual risk and set a manual stop.",
      );
    }
    if (
      positive(cost.manualStopAtUsd)
      && positive(approval.totalMonthlyApprovedCeilingUsd)
      && cost.manualStopAtUsd > approval.totalMonthlyApprovedCeilingUsd
    ) {
      add("MANUAL_STOP_EXCEEDS_APPROVAL", "Manual stop cannot exceed the approved total monthly ceiling.");
    }
    if (
      positive(cost.manualStopAtUsd)
      && finiteNonNegative(cost.currentMonthActualUsd)
      && cost.currentMonthActualUsd >= cost.manualStopAtUsd
    ) {
      add("MANUAL_STOP_ALREADY_REACHED", "Current usage has already reached the approved manual stop.");
    }
  }
  if (cost.agentLimitRecordedSeparately !== true) {
    add(
      "AGENT_LIMIT_UNVERIFIED",
      "Railway Agent usage needs its own recorded limit because the Compute limit does not cover it.",
    );
  }

  const rollback = plan.rollback;
  if (
    rollback.deploymentActionVisible !== true
    && rollback.rebuildFallbackReady !== true
  ) {
    add("ROLLBACK_IMAGE_UNAVAILABLE", "A visible rollback action or exact rebuild fallback is required.");
  }
  if (!hasText(rollback.owner) || !SHA_256.test(String(rollback.deploymentIdFingerprint ?? ""))) {
    add("ROLLBACK_IDENTITY_MISSING", "Rollback owner and prior deployment ID are required.");
  }

  return {
    ok: findings.length === 0,
    status: findings.length === 0
      ? "plan_and_read_only_snapshot_consistent_pending_owner_activation"
      : "blocked",
    findings,
    summary: {
      activationStage: plan.activationStage,
      candidateCommit: source.candidateCommit,
      providerSnapshotSha256: providerSnapshotSha256 && SHA_256.test(providerSnapshotSha256)
        ? providerSnapshotSha256
        : null,
      steadyStateConnections: steadyTotal,
      transitionPeakConnections: transitionTotal,
      steadyStateHeadroomPercent: headroomPercent(database.declaredMaxConnections, steadyTotal),
      transitionHeadroomPercent: headroomPercent(database.declaredMaxConnections, transitionTotal),
    },
  };
}

function argValue(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : null;
}

function railwayStatusJson() {
  const windowsCli = process.env.APPDATA
    ? path.join(
      process.env.APPDATA,
      "npm",
      "node_modules",
      "@railway",
      "cli",
      "bin",
      "railway.js",
    )
    : null;
  const command = process.platform === "win32" ? process.execPath : "railway";
  const args = process.platform === "win32"
    ? [windowsCli, "status", "--json"]
    : ["status", "--json"];
  if (process.platform === "win32" && (!windowsCli || !fs.existsSync(windowsCli))) {
    throw new Error("Railway CLI installation was not found.");
  }
  const result = spawnSync(command, args, {
    encoding: "utf8",
    windowsHide: true,
    timeout: 20_000,
    maxBuffer: 5 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error("Read-only `railway status --json` failed.");
  }
  return JSON.parse(String(result.stdout ?? ""));
}

export async function main(argv = process.argv.slice(2)) {
  const capturePath = argValue(argv, "--capture-provider-snapshot");
  if (capturePath) {
    const environmentName = argValue(argv, "--environment") ?? "production";
    const webServiceName = argValue(argv, "--web-service") ?? "RIVT";
    if (!text(128).safeParse(environmentName).success || !text(128).safeParse(webServiceName).success) {
      throw new Error("Environment and web-service names must be 1-128 characters.");
    }
    const snapshot = createRailwayStatusSnapshot(railwayStatusJson(), {
      environmentName,
      webServiceName,
    });
    const snapshotRaw = `${JSON.stringify(snapshot, null, 2)}\n`;
    fs.writeFileSync(path.resolve(capturePath), snapshotRaw, {
      encoding: "utf8",
      flag: "wx",
    });
    console.log(JSON.stringify({
      written: true,
      source: snapshot.source,
      observedAt: snapshot.observedAt,
      serviceCount: snapshot.services.length,
      sha256: sha256(snapshotRaw),
    }, null, 2));
    return;
  }

  const planPath = argValue(argv, "--plan");
  const providerSnapshotPath = argValue(argv, "--provider-snapshot");
  if (!planPath) throw new Error("--plan is required.");
  if (!providerSnapshotPath) throw new Error("--provider-snapshot is required.");

  const planRaw = fs.readFileSync(planPath, "utf8");
  const snapshotRaw = fs.readFileSync(providerSnapshotPath, "utf8");
  const plan = JSON.parse(planRaw);
  const providerSnapshot = JSON.parse(snapshotRaw);
  const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const planSource = activationPlanSchema.safeParse(plan);
  const localFacts = planSource.success
    ? deriveLocalRepositoryFacts(repositoryRoot, planSource.data.source)
    : null;
  const result = evaluateRailwayActivationPlan(plan, {
    providerSnapshot,
    providerSnapshotSha256: sha256(snapshotRaw),
    localFacts,
  });
  console.log(JSON.stringify(result, null, 2));
  if (argv.includes("--require-ready") && !result.ok) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
