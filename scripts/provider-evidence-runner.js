import "dotenv/config";
import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  loadIncidentRoutingConfig,
} from "./incident-readiness-check.js";
import {
  evaluateLaunchReadiness,
  loadPaymentProviderPolicy,
  loadRecoveryPolicy,
  readPaymentProviderEvidence,
  readRecoveryPolicyEvidence,
} from "./launch-readiness-check.js";
import {
  canonicalRepositoryEvidence,
  providerEvidenceIdentity,
  repositoryEvidenceSha256,
  resolveRegularRepositoryFile,
} from "./repository-evidence.js";
import {
  validateProviderEvidenceOverlay,
  validateProviderEvidenceWorktree,
} from "./provider-evidence-overlay.js";
import { stripeConnectRuntimeProof } from "../server/stripe-connect.js";

const defaultIncidentPath = "docs/operations/incident-routing.json";
const defaultRecoveryPath = "docs/operations/recovery-policy.json";
const defaultPaymentProviderPath = "docs/operations/payment-provider-readiness.json";
const fullSourceCommitPattern = /^[a-f0-9]{40}$/;
const sha256Pattern = /^[a-f0-9]{64}$/;
const boundedIdentifierPattern = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/;
const reasonCodePattern = /^[A-Z][A-Z0-9_]{2,95}$/;
const maximumClaimCount = 64;
const maximumEvidencePlanBytes = 32 * 1024;
const maximumEvidenceAgeMs = 30 * 24 * 60 * 60 * 1000;
const maximumObservationAgeMs = 5 * 60 * 1000;
const maximumProviderProofAgeMs = 45 * 60 * 1000;
const maximumProviderResponseBytes = 2 * 1024 * 1024;
const providerRequestTimeoutMs = 10_000;
const githubApiOrigin = "https://api.github.com";
const sentryApiOrigin = "https://sentry.io";
const railwayApiOrigin = "https://backboard.railway.com";
const stripeApiOrigin = "https://api.stripe.com";
const stripeApiVersion = "2026-02-25.clover";
const stripeAccountsV2ApiVersion = "2026-06-24.preview";
const stripeEventDestinationsV2ApiVersion = "2026-06-24.dahlia";
const stripeConnectWebhookUrl = "https://rivt.pro/api/stripe/connect/webhook";
const rivtProductionOrigin = "https://rivt.pro";
const githubSyntheticWorkflowName = "Production Synthetic Check";
const githubSyntheticWorkflowPath = ".github/workflows/production-synthetic.yml";
const githubSyntheticIncidentMarker = "<!-- rivt-production-synthetic-incident -->";
const githubSyntheticIncidentTitle = "Production synthetic check failing";
const githubSyntheticResourcePattern = /^workflow:([1-9][0-9]{0,19}):issue:([1-9][0-9]{0,19})$/;
const railwayStripeResourcePattern = /^service:([A-Za-z0-9_-]{1,128}):event-destination:([A-Za-z0-9_-]{1,128})$/;
const stripeConnectSnapshotEvents = Object.freeze([
  "charge.dispute.created",
  "charge.refunded",
  "checkout.session.async_payment_failed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.completed",
  "checkout.session.expired",
  "payment_intent.payment_failed",
  "payment_intent.processing",
  "payment_intent.succeeded",
]);
const sentryEventIdPattern = /^[a-f0-9]{32}$/;
const scopeKeys = Object.freeze(["account", "environment", "project", "resource"]);
const planKeys = Object.freeze(["claims", "schemaVersion"]);
const claimKeys = Object.freeze([
  "adapterId",
  "controlId",
  "evidencePath",
  "evidenceSha256",
  "expectedReceipt",
  "provider",
  "scope",
  "type",
]);

function freezeAdapterDefinition(definition) {
  return Object.freeze({
    ...definition,
    allowedProviders: Object.freeze([...definition.allowedProviders]),
    allowedReceiptTypes: Object.freeze([...definition.allowedReceiptTypes]),
    requiredCredentials: Object.freeze([...definition.requiredCredentials]),
  });
}

async function unsupportedProviderAdapter() {
  return { status: "unsupported", reasonCode: "ADAPTER_NOT_IMPLEMENTED" };
}

function failedProviderResult(reasonCode, status = "failed") {
  return { status, reasonCode };
}

function canonicalProofValue(value) {
  if (Array.isArray(value)) return value.map((entry) => canonicalProofValue(entry));
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonicalProofValue(value[key])]),
    );
  }
  return value;
}

function providerProofId(value) {
  return createHash("sha256")
    .update(JSON.stringify(canonicalProofValue(value)))
    .digest("hex");
}

function verifiedProviderResult(context, proof) {
  return {
    observedAt: context.now.toISOString(),
    proofId: providerProofId(proof),
    provider: context.claim.provider,
    receiptSha256: context.claim.evidenceSha256,
    scope: { ...context.claim.scope },
    status: "verified",
  };
}

function sameTimestamp(left, right) {
  const leftTime = new Date(left ?? "").getTime();
  const rightTime = new Date(right ?? "").getTime();
  return Number.isFinite(leftTime) && leftTime === rightTime;
}

function exactStringSet(actual, required) {
  return Array.isArray(actual)
    && actual.length === required.length
    && new Set(actual).size === actual.length
    && new Set(required).size === required.length
    && required.every((entry) => actual.includes(entry));
}

async function providerJsonRequest({
  body,
  fetchFunction,
  headers = {},
  method = "GET",
  origin,
  pathname,
}) {
  if (typeof fetchFunction !== "function") {
    return { ok: false, reasonCode: "PROVIDER_CLIENT_UNAVAILABLE" };
  }
  let url;
  try {
    url = new URL(pathname, origin);
  } catch {
    return { ok: false, reasonCode: "PROVIDER_REQUEST_INVALID" };
  }
  if (url.origin !== origin) {
    return { ok: false, reasonCode: "PROVIDER_REQUEST_INVALID" };
  }
  let response;
  try {
    response = await fetchFunction(url, {
      body,
      headers: {
        Accept: "application/json",
        ...headers,
      },
      method,
      redirect: "error",
      signal: AbortSignal.timeout(providerRequestTimeoutMs),
    });
  } catch {
    return { ok: false, reasonCode: "PROVIDER_REQUEST_FAILED" };
  }
  if (response?.ok !== true) {
    return { ok: false, reasonCode: "PROVIDER_REQUEST_FAILED" };
  }
  const declaredLength = Number(response.headers?.get?.("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > maximumProviderResponseBytes) {
    return { ok: false, reasonCode: "PROVIDER_RESPONSE_TOO_LARGE" };
  }
  try {
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > maximumProviderResponseBytes) {
      return { ok: false, reasonCode: "PROVIDER_RESPONSE_TOO_LARGE" };
    }
    const payload = JSON.parse(raw);
    if (!isPlainObject(payload) && !Array.isArray(payload)) {
      return { ok: false, reasonCode: "PROVIDER_RESPONSE_INVALID" };
    }
    return { ok: true, payload };
  } catch {
    return { ok: false, reasonCode: "PROVIDER_RESPONSE_INVALID" };
  }
}

async function githubJson(context, pathname, fetchFunction) {
  return providerJsonRequest({
    fetchFunction,
    headers: {
      Authorization: `Bearer ${context.credentials.RIVT_EVIDENCE_GITHUB_TOKEN}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
    origin: githubApiOrigin,
    pathname,
  });
}

function validGitHubSyntheticReceipt(receipt) {
  return receipt?.schemaVersion === 1
    && receipt.type === "synthetic-monitor-delivery-test"
    && receipt.status === "passed"
    && receipt.category === "synthetic_monitor"
    && receipt.configuredProvider === "GitHub Actions"
    && receipt.route === "GitHub issue: Production synthetic check failing"
    && receipt.frequency === "30 minutes";
}

export async function verifyGitHubProductionSyntheticEvidence(
  context,
  { fetchFunction = globalThis.fetch } = {},
) {
  if (!validGitHubSyntheticReceipt(context?.receipt)) {
    return failedProviderResult("PROVIDER_RECEIPT_UNSUPPORTED");
  }
  const resource = githubSyntheticResourcePattern.exec(context.claim.scope.resource);
  if (!resource) return failedProviderResult("PROVIDER_SCOPE_INVALID");
  const [, workflowId, issueNumber] = resource;
  const owner = encodeURIComponent(context.claim.scope.account);
  const repoName = encodeURIComponent(context.claim.scope.project);
  const branchName = encodeURIComponent(context.claim.scope.environment);
  const repoBase = `/repos/${owner}/${repoName}`;
  const [
    repositoryResult,
    branchResult,
    workflowResult,
    runsResult,
    issueResult,
    commentsResult,
    openIssuesResult,
  ] = await Promise.all([
    githubJson(context, repoBase, fetchFunction),
    githubJson(context, `${repoBase}/branches/${branchName}`, fetchFunction),
    githubJson(context, `${repoBase}/actions/workflows/${workflowId}`, fetchFunction),
    githubJson(
      context,
      `${repoBase}/actions/workflows/${workflowId}/runs?branch=${branchName}&head_sha=${context.sourceCommit}&per_page=100`,
      fetchFunction,
    ),
    githubJson(context, `${repoBase}/issues/${issueNumber}`, fetchFunction),
    githubJson(context, `${repoBase}/issues/${issueNumber}/comments?per_page=100`, fetchFunction),
    githubJson(
      context,
      `${repoBase}/issues?state=open&sort=updated&direction=desc&per_page=100`,
      fetchFunction,
    ),
  ]);
  const requests = [
    repositoryResult,
    branchResult,
    workflowResult,
    runsResult,
    issueResult,
    commentsResult,
    openIssuesResult,
  ];
  const failedRequest = requests.find((result) => !result.ok);
  if (failedRequest) return failedProviderResult(failedRequest.reasonCode);

  const repository = repositoryResult.payload;
  const branch = branchResult.payload;
  const workflow = workflowResult.payload;
  const runs = runsResult.payload.workflow_runs;
  const issue = issueResult.payload;
  const comments = commentsResult.payload;
  const openIssues = openIssuesResult.payload;
  if (
    repository.full_name?.toLowerCase()
      !== `${context.claim.scope.account}/${context.claim.scope.project}`.toLowerCase()
    || repository.default_branch !== context.claim.scope.environment
    || branch.name !== context.claim.scope.environment
    || branch.protected !== true
    || String(workflow.id) !== workflowId
    || workflow.name !== githubSyntheticWorkflowName
    || workflow.path !== githubSyntheticWorkflowPath
    || workflow.state !== "active"
    || !Array.isArray(runs)
    || !Array.isArray(comments)
    || !Array.isArray(openIssues)
    || String(issue.number) !== issueNumber
    || issue.title !== githubSyntheticIncidentTitle
    || issue.state !== "closed"
    || issue.state_reason !== "completed"
    || issue.user?.login !== "github-actions[bot]"
    || issue.user?.type !== "Bot"
    || String(issue.body ?? "").split(/\r?\n/, 1)[0] !== githubSyntheticIncidentMarker
  ) {
    return failedProviderResult("PROVIDER_BINDING_MISMATCH");
  }

  const applicableRuns = runs.filter((run) => (
    run.head_sha === context.sourceCommit
    && run.head_branch === context.claim.scope.environment
    && String(run.workflow_id) === workflowId
    && ["schedule", "workflow_dispatch"].includes(run.event)
    && run.head_repository?.full_name?.toLowerCase() === repository.full_name.toLowerCase()
  )).sort((left, right) => (
    new Date(right.created_at ?? right.updated_at ?? "").getTime()
      - new Date(left.created_at ?? left.updated_at ?? "").getTime()
  ));
  const latestRun = applicableRuns[0];
  if (
    !latestRun
    || latestRun.status !== "completed"
    || latestRun.conclusion !== "success"
    || !validTimestamp(latestRun.updated_at, context.now, maximumProviderProofAgeMs)
  ) {
    return failedProviderResult("PROVIDER_OBSERVATION_MISMATCH");
  }

  const ownedOpenIncident = openIssues.find((candidate) => (
    !candidate?.pull_request
    && candidate.title === githubSyntheticIncidentTitle
    && candidate.user?.login === "github-actions[bot]"
    && candidate.user?.type === "Bot"
    && String(candidate.body ?? "").split(/\r?\n/, 1)[0] === githubSyntheticIncidentMarker
  ));
  if (ownedOpenIncident) {
    return failedProviderResult("PROVIDER_OBSERVATION_MISMATCH");
  }

  const matchingDeliveries = [];
  for (const run of applicableRuns) {
    const runUrl = `https://github.com/${context.claim.scope.account}/${context.claim.scope.project}/actions/runs/${run.id}`;
    const expectedComment = `Synthetic check recovered and passed: ${runUrl}`;
    const comment = comments.find((entry) => (
      entry?.body === expectedComment
      && entry.user?.login === "github-actions[bot]"
      && entry.user?.type === "Bot"
      && sameTimestamp(entry.created_at, context.receipt.timestamp)
    ));
    if (
      comment
      && run.conclusion === "success"
      && run.status === "completed"
      && new Date(run.created_at ?? "").getTime() <= new Date(comment.created_at).getTime()
      && new Date(comment.created_at).getTime() <= new Date(run.updated_at ?? "").getTime()
      && new Date(comment.created_at).getTime() <= new Date(latestRun.updated_at).getTime()
    ) {
      matchingDeliveries.push({ run, comment });
    }
  }
  if (matchingDeliveries.length !== 1) {
    return failedProviderResult("PROVIDER_OBSERVATION_MISMATCH");
  }
  const [{ run, comment }] = matchingDeliveries;
  return verifiedProviderResult(context, {
    adapter: "github-production-synthetic-v1",
    branch: branch.name,
    commentId: comment.id,
    issueNumber: issue.number,
    latestRunId: latestRun.id,
    recoveryRunId: run.id,
    sourceCommit: latestRun.head_sha,
    workflowId: workflow.id,
  });
}

async function sentryJson(context, pathname, fetchFunction) {
  return providerJsonRequest({
    fetchFunction,
    headers: {
      Authorization: `Bearer ${context.credentials.RIVT_EVIDENCE_SENTRY_TOKEN}`,
    },
    origin: sentryApiOrigin,
    pathname,
  });
}

function sentryTag(event, key) {
  return Array.isArray(event?.tags)
    ? event.tags.find((tag) => tag?.key === key)?.value ?? null
    : null;
}

function sentryRelease(event) {
  if (typeof event?.release === "string") return event.release;
  return event?.release?.version ?? null;
}

function validSentryIngestionReceipt(receipt) {
  return receipt?.schemaVersion === 1
    && receipt.type === "error-monitoring-ingestion-test"
    && receipt.status === "ingested"
    && receipt.category === "error_monitoring"
    && typeof receipt.configuredProvider === "string"
    && receipt.configuredProvider.startsWith("Sentry")
    && typeof receipt.route === "string"
    && receipt.route.length > 0
    && receipt.frequency === null;
}

export async function verifySentryErrorIngestionEvidence(
  context,
  { fetchFunction = globalThis.fetch } = {},
) {
  if (
    !validSentryIngestionReceipt(context?.receipt)
    || !sentryEventIdPattern.test(context.claim.scope.resource)
  ) {
    return failedProviderResult("PROVIDER_RECEIPT_UNSUPPORTED");
  }
  const organization = encodeURIComponent(context.claim.scope.account);
  const projectName = encodeURIComponent(context.claim.scope.project);
  const eventId = encodeURIComponent(context.claim.scope.resource);
  const environment = encodeURIComponent(context.claim.scope.environment);
  const projectPath = `/api/0/projects/${organization}/${projectName}/`;
  const [projectResult, eventResult] = await Promise.all([
    sentryJson(context, projectPath, fetchFunction),
    sentryJson(
      context,
      `${projectPath}events/${eventId}/?environment=${environment}`,
      fetchFunction,
    ),
  ]);
  const failedRequest = [projectResult, eventResult].find((result) => !result.ok);
  if (failedRequest) return failedProviderResult(failedRequest.reasonCode);
  const project = projectResult.payload;
  const event = eventResult.payload;
  if (
    project.slug !== context.claim.scope.project
    || project.organization?.slug !== context.claim.scope.account
    || String(event.projectID) !== String(project.id)
    || String(event.eventID ?? event.id).toLowerCase() !== context.claim.scope.resource
    || sentryTag(event, "environment") !== context.claim.scope.environment
    || sentryTag(event, "service") !== "rivt-api"
    || sentryRelease(event) !== context.sourceCommit
    || event.platform !== "node"
    || event.type !== "error"
    || !sameTimestamp(event.dateReceived, context.receipt.timestamp)
    || !validTimestamp(event.dateReceived, context.now, maximumProviderProofAgeMs)
  ) {
    return failedProviderResult("PROVIDER_BINDING_MISMATCH");
  }
  return verifiedProviderResult(context, {
    adapter: "sentry-error-ingestion-v1",
    eventId: event.eventID ?? event.id,
    projectId: project.id,
    receivedAt: event.dateReceived,
    release: sentryRelease(event),
  });
}

async function railwayRuntimeState(context, serviceId, fetchFunction) {
  const query = `query ProviderEvidenceRuntime($projectId: String!, $environmentId: String!, $serviceId: String!, $deploymentInput: DeploymentListInput!) {
    variablesForServiceDeployment(projectId: $projectId, environmentId: $environmentId, serviceId: $serviceId)
    deployments(input: $deploymentInput, first: 1) {
      edges {
        node {
          id
          status
          createdAt
          meta
        }
      }
    }
  }`;
  return providerJsonRequest({
    body: JSON.stringify({
      operationName: "ProviderEvidenceRuntime",
      query,
      variables: {
        deploymentInput: {
          environmentId: context.claim.scope.environment,
          projectId: context.claim.scope.project,
          serviceId,
          status: { successfulOnly: true },
        },
        environmentId: context.claim.scope.environment,
        projectId: context.claim.scope.project,
        serviceId,
      },
    }),
    fetchFunction,
    headers: {
      Authorization: `Bearer ${context.credentials.RIVT_EVIDENCE_RAILWAY_TOKEN}`,
      "Content-Type": "application/json",
    },
    method: "POST",
    origin: railwayApiOrigin,
    pathname: "/graphql/v2",
  });
}

async function stripeJson(
  token,
  pathname,
  fetchFunction,
  { version = stripeApiVersion } = {},
) {
  return providerJsonRequest({
    fetchFunction,
    headers: {
      Authorization: `Bearer ${token}`,
      "Stripe-Version": version,
    },
    origin: stripeApiOrigin,
    pathname,
  });
}

async function rivtProductionHealth(fetchFunction) {
  return providerJsonRequest({
    fetchFunction,
    origin: rivtProductionOrigin,
    pathname: "/api/health",
  });
}

async function rivtProductionRuntimeProof({
  enabled,
  fetchFunction,
  nonce,
  secretKey,
  sourceCommit,
  timestamp,
  webhookScope,
  webhookSecret,
}) {
  const proof = stripeConnectRuntimeProof({
    secretKey,
    webhookSecret,
    enabled,
    webhookScope,
    sourceCommit,
    timestamp,
    nonce,
  });
  return providerJsonRequest({
    fetchFunction,
    headers: {
      Authorization: `RIVT-HMAC ${proof}`,
      "X-RIVT-Evidence-Nonce": nonce,
      "X-RIVT-Evidence-Timestamp": timestamp,
    },
    method: "POST",
    origin: rivtProductionOrigin,
    pathname: "/api/provider-evidence/stripe-connect/runtime",
  });
}

function presentProviderVariable(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function validDisabledPaymentReceipt(receipt) {
  return receipt?.schemaVersion === 1
    && receipt.type === "provider-payment-state-verification"
    && receipt.status === "verified"
    && receipt.mode === "disabled"
    && receipt.featureFlagVerifiedOff === true
    && receipt.providerDestinationScope === "connected_accounts"
    && ["unset", "connected_accounts"].includes(receipt.runtimeScopeAttestation)
    && receipt.signedDeliveryVerified === false
    && receipt.enabled === false
    && receipt.configured === false
    && receipt.webhookConfigured === true
    && receipt.providerMode === "setup_required";
}

export async function verifyRailwayStripeDisabledPaymentEvidence(
  context,
  { fetchFunction = globalThis.fetch, randomBytesFunction = randomBytes } = {},
) {
  if (!validDisabledPaymentReceipt(context?.receipt)) {
    return failedProviderResult("PROVIDER_RECEIPT_UNSUPPORTED");
  }
  const resource = railwayStripeResourcePattern.exec(context.claim.scope.resource);
  if (!resource) return failedProviderResult("PROVIDER_SCOPE_INVALID");
  const [, serviceId, eventDestinationId] = resource;
  const railwayResult = await railwayRuntimeState(context, serviceId, fetchFunction);
  if (!railwayResult.ok) return failedProviderResult(railwayResult.reasonCode);

  const railwayPayload = railwayResult.payload;
  const variables = railwayPayload.data?.variablesForServiceDeployment;
  const deploymentEdges = railwayPayload.data?.deployments?.edges;
  const deployment = Array.isArray(deploymentEdges) && deploymentEdges.length === 1
    ? deploymentEdges[0]?.node
    : null;
  const deploymentCreatedAt = new Date(deployment?.createdAt ?? "").getTime();
  const scopeVariable = variables?.STRIPE_CONNECT_WEBHOOK_SCOPE;
  const runtimeScopeMatches = context.receipt.runtimeScopeAttestation === "unset"
    ? !presentProviderVariable(scopeVariable)
    : scopeVariable === "connected_accounts";
  if (
    !isPlainObject(variables)
    || (railwayPayload.errors !== undefined && (
      !Array.isArray(railwayPayload.errors) || railwayPayload.errors.length > 0
    ))
    || variables.RAILWAY_PROJECT_ID !== context.claim.scope.project
    || variables.RAILWAY_ENVIRONMENT_ID !== context.claim.scope.environment
    || variables.RAILWAY_SERVICE_ID !== serviceId
    || variables.RAILWAY_ENVIRONMENT_NAME !== "production"
    || variables.RAILWAY_GIT_COMMIT_SHA !== context.sourceCommit
    || !isPlainObject(deployment)
    || !validIdentifier(deployment.id)
    || deployment.status !== "SUCCESS"
    || deployment.meta?.commitHash !== context.sourceCommit
    || !Number.isFinite(deploymentCreatedAt)
    || deploymentCreatedAt > context.now.getTime()
    || ![undefined, "", "false"].includes(variables.STRIPE_CONNECT_ACH_ENABLED)
    || !presentProviderVariable(variables.STRIPE_SECRET_KEY)
    || !presentProviderVariable(variables.STRIPE_CONNECT_WEBHOOK_SECRET)
    || !runtimeScopeMatches
  ) {
    return failedProviderResult("PROVIDER_BINDING_MISMATCH");
  }

  // The production Stripe credential is fetched from Railway at runtime and is
  // used only in memory for bounded, read-only requests. A short-lived,
  // nonce-bound HMAC proves that the running RIVT process loaded the same
  // values without publishing a reusable credential fingerprint.
  const runtimeStripeKey = variables.STRIPE_SECRET_KEY;
  const runtimeProofTimestamp = String(Math.floor(context.now.getTime() / 1000));
  const runtimeProofNonce = randomBytesFunction(32).toString("base64url");
  const [
    healthResult,
    runtimeProofResult,
    stripeAccountResult,
    stripeEventDestinationResult,
    v1AccountsResult,
    v2AccountsResult,
  ] = await Promise.all([
    rivtProductionHealth(fetchFunction),
    rivtProductionRuntimeProof({
      enabled: variables.STRIPE_CONNECT_ACH_ENABLED === "true",
      fetchFunction,
      nonce: runtimeProofNonce,
      secretKey: variables.STRIPE_SECRET_KEY,
      sourceCommit: context.sourceCommit,
      timestamp: runtimeProofTimestamp,
      webhookScope: presentProviderVariable(scopeVariable) ? scopeVariable : undefined,
      webhookSecret: variables.STRIPE_CONNECT_WEBHOOK_SECRET,
    }),
    stripeJson(runtimeStripeKey, "/v1/account", fetchFunction),
    stripeJson(
      runtimeStripeKey,
      `/v2/core/event_destinations/${encodeURIComponent(eventDestinationId)}`
        + "?include%5B0%5D=webhook_endpoint.url",
      fetchFunction,
      { version: stripeEventDestinationsV2ApiVersion },
    ),
    stripeJson(runtimeStripeKey, "/v1/accounts?limit=1", fetchFunction),
    stripeJson(
      runtimeStripeKey,
      "/v2/core/accounts?limit=1&applied_configurations%5B0%5D=merchant",
      fetchFunction,
      { version: stripeAccountsV2ApiVersion },
    ),
  ]);
  const requests = [
    healthResult,
    runtimeProofResult,
    stripeAccountResult,
    stripeEventDestinationResult,
    v1AccountsResult,
    v2AccountsResult,
  ];
  const failedRequest = requests.find((result) => !result.ok);
  if (failedRequest) return failedProviderResult(failedRequest.reasonCode);

  const health = healthResult.payload;
  const runtimeProof = runtimeProofResult.payload;
  const healthBankPayments = health.observability?.invoiceBankPayments;
  const stripeAccount = stripeAccountResult.payload;
  const stripeEventDestination = stripeEventDestinationResult.payload;
  const v1Accounts = v1AccountsResult.payload;
  const v2Accounts = v2AccountsResult.payload;
  if (
    health.ok !== true
    || health.build?.commit !== context.sourceCommit
    || healthBankPayments?.provider !== "stripe_connect"
    || healthBankPayments?.accountsApi !== "v2"
    || healthBankPayments?.enabled !== false
    || healthBankPayments?.configured !== false
    || healthBankPayments?.webhookConfigured !== true
    || healthBankPayments?.webhookScopeConfigured
      !== (context.receipt.runtimeScopeAttestation === "connected_accounts")
    || healthBankPayments?.mode !== "setup_required"
    || runtimeProof?.data?.provider !== "stripe_connect"
    || runtimeProof?.data?.sourceCommit !== context.sourceCommit
    || stripeAccount.id !== context.claim.scope.account
    || stripeEventDestination.id !== eventDestinationId
    || stripeEventDestination.object !== "v2.core.event_destination"
    || stripeEventDestination.type !== "webhook_endpoint"
    || stripeEventDestination.status !== "enabled"
    || stripeEventDestination.livemode !== true
    || stripeEventDestination.event_payload !== "snapshot"
    || stripeEventDestination.snapshot_api_version !== stripeEventDestinationsV2ApiVersion
    || stripeEventDestination.webhook_endpoint?.url !== stripeConnectWebhookUrl
    || !exactStringSet(stripeEventDestination.events_from, ["@accounts"])
    || !exactStringSet(stripeEventDestination.enabled_events, stripeConnectSnapshotEvents)
    || v1Accounts.object !== "list"
    || v1Accounts.has_more !== false
    || !Array.isArray(v1Accounts.data)
    || v1Accounts.data.length !== 0
    || !Array.isArray(v2Accounts.data)
    || v2Accounts.data.length !== 0
    || v2Accounts.next_page_url !== null
  ) {
    return failedProviderResult("PROVIDER_BINDING_MISMATCH");
  }
  return verifiedProviderResult(context, {
    adapter: "railway-stripe-disabled-payment-v1",
    connectedAccountsV1: 0,
    connectedMerchantAccountsV2: 0,
    deploymentId: deployment.id,
    featureEnabled: false,
    sourceCommit: health.build.commit,
    eventDestinationId,
    eventDestinationScope: "connected_accounts",
  });
}

async function compiledGitHubProductionSyntheticAdapter(context) {
  return verifyGitHubProductionSyntheticEvidence(context);
}

async function compiledSentryErrorIngestionAdapter(context) {
  return verifySentryErrorIngestionEvidence(context);
}

async function compiledRailwayStripeDisabledPaymentAdapter(context) {
  return verifyRailwayStripeDisabledPaymentEvidence(context);
}

export const compiledProviderAdapters = Object.freeze({
  "github-production-synthetic": freezeAdapterDefinition({
    allowedProviders: ["github-actions"],
    allowedReceiptTypes: ["synthetic-monitor-delivery-test"],
    requiredCredentials: ["RIVT_EVIDENCE_GITHUB_TOKEN"],
    verify: compiledGitHubProductionSyntheticAdapter,
  }),
  "sentry-error-ingestion": freezeAdapterDefinition({
    allowedProviders: ["sentry"],
    allowedReceiptTypes: ["error-monitoring-ingestion-test"],
    requiredCredentials: ["RIVT_EVIDENCE_SENTRY_TOKEN"],
    verify: compiledSentryErrorIngestionAdapter,
  }),
  "sentry-paging-delivery": freezeAdapterDefinition({
    allowedProviders: ["sentry"],
    allowedReceiptTypes: ["paging-delivery-test"],
    requiredCredentials: ["RIVT_EVIDENCE_SENTRY_TOKEN"],
    verify: unsupportedProviderAdapter,
  }),
  "private-route-delivery": freezeAdapterDefinition({
    allowedProviders: ["private-route-provider"],
    allowedReceiptTypes: ["private-route-delivery-test"],
    requiredCredentials: ["RIVT_EVIDENCE_PRIVATE_ROUTE_TOKEN"],
    verify: unsupportedProviderAdapter,
  }),
  "incident-rehearsal": freezeAdapterDefinition({
    allowedProviders: ["incident-rehearsal"],
    allowedReceiptTypes: ["incident-rehearsal-test"],
    requiredCredentials: [],
    verify: unsupportedProviderAdapter,
  }),
  "backup-schedule": freezeAdapterDefinition({
    allowedProviders: ["backup-provider"],
    allowedReceiptTypes: ["provider-backup-schedule"],
    requiredCredentials: ["RIVT_EVIDENCE_BACKUP_TOKEN"],
    verify: unsupportedProviderAdapter,
  }),
  "backup-completion": freezeAdapterDefinition({
    allowedProviders: ["backup-provider"],
    allowedReceiptTypes: ["provider-backup-completion"],
    requiredCredentials: ["RIVT_EVIDENCE_BACKUP_TOKEN"],
    verify: unsupportedProviderAdapter,
  }),
  "backup-alert-delivery": freezeAdapterDefinition({
    allowedProviders: ["backup-provider"],
    allowedReceiptTypes: ["provider-alert-delivery-test"],
    requiredCredentials: ["RIVT_EVIDENCE_BACKUP_TOKEN"],
    verify: unsupportedProviderAdapter,
  }),
  "backup-retention": freezeAdapterDefinition({
    allowedProviders: ["backup-provider"],
    allowedReceiptTypes: ["provider-retention-policy"],
    requiredCredentials: ["RIVT_EVIDENCE_BACKUP_TOKEN"],
    verify: unsupportedProviderAdapter,
  }),
  "backup-failure-domain": freezeAdapterDefinition({
    allowedProviders: ["failure-domain-review"],
    allowedReceiptTypes: ["provider-failure-domain-verification"],
    requiredCredentials: [],
    verify: unsupportedProviderAdapter,
  }),
  "backup-restore": freezeAdapterDefinition({
    allowedProviders: ["restore-provider"],
    allowedReceiptTypes: ["provider-restore-verification"],
    requiredCredentials: ["RIVT_EVIDENCE_BACKUP_TOKEN"],
    verify: unsupportedProviderAdapter,
  }),
  "railway-stripe-disabled-payment": freezeAdapterDefinition({
    allowedProviders: ["railway-stripe"],
    allowedReceiptTypes: ["provider-payment-state-verification"],
    requiredCredentials: ["RIVT_EVIDENCE_RAILWAY_TOKEN"],
    verify: compiledRailwayStripeDisabledPaymentAdapter,
  }),
});

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value, keys) {
  if (!isPlainObject(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length
    && actual.every((key, index) => key === expected[index]);
}

function validIdentifier(value) {
  return typeof value === "string"
    && boundedIdentifierPattern.test(value)
    && !["tbd", "unknown", "unset"].includes(value.toLowerCase());
}

function validScope(scope) {
  return exactKeys(scope, scopeKeys)
    && scopeKeys.every((key) => validIdentifier(scope[key]));
}

function sameScope(left, right) {
  return validScope(left)
    && validScope(right)
    && scopeKeys.every((key) => left[key] === right[key]);
}

function validTimestamp(value, now, maximumAgeMs) {
  const timestamp = new Date(value ?? "");
  return Number.isFinite(timestamp.getTime())
    && timestamp.getTime() <= now.getTime()
    && now.getTime() - timestamp.getTime() <= maximumAgeMs;
}

function sameJsonValue(left, right) {
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left)
      && Array.isArray(right)
      && left.length === right.length
      && left.every((entry, index) => sameJsonValue(entry, right[index]));
  }
  if (isPlainObject(left) || isPlainObject(right)) {
    if (!isPlainObject(left) || !isPlainObject(right)) return false;
    const leftKeys = Object.keys(left).sort();
    const rightKeys = Object.keys(right).sort();
    return leftKeys.length === rightKeys.length
      && leftKeys.every((key, index) => (
        key === rightKeys[index] && sameJsonValue(left[key], right[key])
      ));
  }
  return Object.is(left, right);
}

function invalidControl(controlId, provider, sha256, reasonCode, status = "failed") {
  return {
    controlId: validIdentifier(controlId) ? controlId : "invalid-control",
    provider: validIdentifier(provider) ? provider : "invalid-provider",
    reasonCode,
    sha256: sha256Pattern.test(sha256 ?? "") ? sha256 : null,
    status,
  };
}

function readReceipt(rootDir, claim) {
  const resolved = resolveRegularRepositoryFile(claim.evidencePath, { rootDir });
  if (!resolved) return { ok: false, reasonCode: "EVIDENCE_PATH_INVALID" };
  try {
    const canonicalEvidence = canonicalRepositoryEvidence(
      fs.readFileSync(resolved.canonicalPath),
    );
    const receipt = JSON.parse(canonicalEvidence);
    if (!isPlainObject(receipt)) {
      return { ok: false, reasonCode: "EVIDENCE_RECEIPT_INVALID" };
    }
    return {
      ok: true,
      canonicalPath: resolved.canonicalPath,
      receipt,
      sha256: repositoryEvidenceSha256(canonicalEvidence),
    };
  } catch {
    return { ok: false, reasonCode: "EVIDENCE_RECEIPT_INVALID" };
  }
}

function validateClaimShape(claim) {
  return exactKeys(claim, claimKeys)
    && validIdentifier(claim.adapterId)
    && validIdentifier(claim.controlId)
    && validIdentifier(claim.provider)
    && validIdentifier(claim.type)
    && typeof claim.evidencePath === "string"
    && claim.evidencePath.length > 0
    && !path.isAbsolute(claim.evidencePath)
    && sha256Pattern.test(claim.evidenceSha256)
    && validScope(claim.scope)
    && isPlainObject(claim.expectedReceipt)
    && claim.expectedReceipt.controlId === claim.controlId
    && claim.expectedReceipt.provider === claim.provider
    && claim.expectedReceipt.type === claim.type;
}

export function validateEvidencePlan(plan) {
  const findings = [];
  if (!exactKeys(plan, planKeys) || plan.schemaVersion !== 1) {
    return { ok: false, findings: ["PLAN_SCHEMA_INVALID"] };
  }
  if (
    !Array.isArray(plan.claims)
    || plan.claims.length === 0
    || plan.claims.length > maximumClaimCount
  ) {
    findings.push("PLAN_CLAIMS_INVALID");
  } else if (plan.claims.some((claim) => !validateClaimShape(claim))) {
    findings.push("PLAN_CLAIM_INVALID");
  }
  if (findings.length > 0) return { ok: false, findings };

  const controlIdentities = new Set();
  const evidencePaths = new Set();
  const evidenceDigests = new Set();
  for (const claim of plan.claims) {
    const controlIdentity = `${claim.controlId}\u0000${claim.type}`;
    const normalizedPath = process.platform === "win32"
      ? claim.evidencePath.toLowerCase()
      : claim.evidencePath;
    if (controlIdentities.has(controlIdentity)) findings.push("PLAN_CONTROL_REUSED");
    if (evidencePaths.has(normalizedPath)) findings.push("PLAN_EVIDENCE_PATH_REUSED");
    if (evidenceDigests.has(claim.evidenceSha256)) findings.push("PLAN_EVIDENCE_DIGEST_REUSED");
    controlIdentities.add(controlIdentity);
    evidencePaths.add(normalizedPath);
    evidenceDigests.add(claim.evidenceSha256);
  }
  return { ok: findings.length === 0, findings: [...new Set(findings)] };
}

function validateAdapterResult(result, claim, now) {
  if (!isPlainObject(result)) return { ok: false, reasonCode: "ADAPTER_RESULT_INVALID" };
  if (result.status !== "verified") {
    if (
      !exactKeys(result, ["reasonCode", "status"])
      || !["failed", "unsupported"].includes(result.status)
      || !reasonCodePattern.test(result.reasonCode ?? "")
    ) {
      return { ok: false, reasonCode: "ADAPTER_RESULT_INVALID" };
    }
    return { ok: false, reasonCode: result.reasonCode, status: result.status };
  }
  if (!exactKeys(result, [
    "observedAt",
    "proofId",
    "provider",
    "receiptSha256",
    "scope",
    "status",
  ])) {
    return { ok: false, reasonCode: "ADAPTER_RESULT_INVALID" };
  }
  if (
    result.provider !== claim.provider
    || result.receiptSha256 !== claim.evidenceSha256
    || !sameScope(result.scope, claim.scope)
    || !sha256Pattern.test(result.proofId ?? "")
    || !validTimestamp(result.observedAt, now, maximumObservationAgeMs)
  ) {
    return { ok: false, reasonCode: "ADAPTER_BINDING_MISMATCH" };
  }
  return { ok: true, proofId: result.proofId };
}

function credentialsForAdapter(adapter, credentials) {
  const selected = {};
  for (const name of adapter.requiredCredentials) {
    if (typeof credentials?.[name] !== "string" || credentials[name].length === 0) {
      return { ok: false, values: null };
    }
    selected[name] = credentials[name];
  }
  return { ok: true, values: Object.freeze(selected) };
}

function adapterRegistryEntry(registry, adapterId) {
  if (!Object.prototype.hasOwnProperty.call(registry, adapterId)) return null;
  const adapter = registry[adapterId];
  return isPlainObject(adapter) && typeof adapter.verify === "function" ? adapter : null;
}

export async function runEvidenceVerification({
  adapters = compiledProviderAdapters,
  credentials = {},
  evidenceCommit,
  now = new Date(),
  overlayValidator = validateProviderEvidenceOverlay,
  plan,
  rootDir = process.cwd(),
  evidenceRoot = rootDir,
  sourceCommit,
  expectedLiveCommit,
  worktreeValidator = validateProviderEvidenceWorktree,
} = {}) {
  const externallyVerifiedEvidence = new Set();
  const controls = [];
  const proofIds = new Set();
  let overlayReport = null;
  const planValidation = validateEvidencePlan(plan);
  if (!planValidation.ok) {
    return {
      ok: false,
      externallyVerifiedEvidence,
      report: {
        controls,
        evidenceCommit: fullSourceCommitPattern.test(evidenceCommit ?? "")
          ? evidenceCommit
          : null,
        findingCodes: planValidation.findings,
        overlayDigest: null,
        overlayValidated: false,
        sourceCommit: fullSourceCommitPattern.test(sourceCommit ?? "") ? sourceCommit : null,
        status: "blocked",
      },
    };
  }
  if (
    !fullSourceCommitPattern.test(sourceCommit ?? "")
    || !fullSourceCommitPattern.test(expectedLiveCommit ?? "")
    || sourceCommit !== expectedLiveCommit
  ) {
    return {
      ok: false,
      externallyVerifiedEvidence,
      report: {
        controls,
        evidenceCommit: fullSourceCommitPattern.test(evidenceCommit ?? "")
          ? evidenceCommit
          : null,
        findingCodes: ["SOURCE_COMMIT_MISMATCH"],
        overlayDigest: null,
        overlayValidated: false,
        sourceCommit: fullSourceCommitPattern.test(sourceCommit ?? "") ? sourceCommit : null,
        status: "blocked",
      },
    };
  }
  if (evidenceCommit !== undefined) {
    const overlay = overlayValidator({
      evidenceCommit,
      plan,
      rootDir,
      sourceCommit,
    });
    const evidenceWorktree = worktreeValidator({
      evidenceCommit,
      evidenceRoot,
    });
    if (!overlay.ok || !evidenceWorktree.ok) {
      return {
        ok: false,
        externallyVerifiedEvidence,
        report: {
          controls,
          evidenceCommit: fullSourceCommitPattern.test(evidenceCommit ?? "")
            ? evidenceCommit
            : null,
          findingCodes: [...new Set([
            ...(Array.isArray(overlay.findingCodes) ? overlay.findingCodes : []),
            ...(Array.isArray(evidenceWorktree.findingCodes)
              ? evidenceWorktree.findingCodes
              : []),
          ])].sort(),
          overlayDigest: overlay.report?.overlayDigest ?? null,
          overlayValidated: false,
          sourceCommit,
          status: "blocked",
        },
      };
    }
    overlayReport = overlay.report;
  }

  for (const claim of [...plan.claims].sort((left, right) => (
    left.controlId.localeCompare(right.controlId)
  ))) {
    const adapter = adapterRegistryEntry(adapters, claim.adapterId);
    if (!adapter) {
      controls.push(invalidControl(
        claim.controlId,
        claim.provider,
        claim.evidenceSha256,
        "ADAPTER_NOT_COMPILED",
      ));
      continue;
    }
    if (!adapter.allowedProviders?.includes(claim.provider)) {
      controls.push(invalidControl(
        claim.controlId,
        claim.provider,
        claim.evidenceSha256,
        "PROVIDER_NOT_ALLOWED",
      ));
      continue;
    }
    if (!adapter.allowedReceiptTypes?.includes(claim.type)) {
      controls.push(invalidControl(
        claim.controlId,
        claim.provider,
        claim.evidenceSha256,
        "RECEIPT_TYPE_NOT_ALLOWED",
      ));
      continue;
    }
    const adapterCredentials = credentialsForAdapter(adapter, credentials);
    if (!adapterCredentials.ok) {
      controls.push(invalidControl(
        claim.controlId,
        claim.provider,
        claim.evidenceSha256,
        "PROVIDER_CREDENTIAL_MISSING",
      ));
      continue;
    }

    const evidence = readReceipt(evidenceRoot, claim);
    if (!evidence.ok) {
      controls.push(invalidControl(
        claim.controlId,
        claim.provider,
        claim.evidenceSha256,
        evidence.reasonCode,
      ));
      continue;
    }
    if (
      evidence.sha256 !== claim.evidenceSha256
      || !sameJsonValue(evidence.receipt, claim.expectedReceipt)
    ) {
      controls.push(invalidControl(
        claim.controlId,
        claim.provider,
        claim.evidenceSha256,
        "EVIDENCE_BINDING_MISMATCH",
      ));
      continue;
    }
    if (!validTimestamp(evidence.receipt.timestamp, now, maximumEvidenceAgeMs)) {
      controls.push(invalidControl(
        claim.controlId,
        claim.provider,
        claim.evidenceSha256,
        "EVIDENCE_STALE_OR_FUTURE",
      ));
      continue;
    }

    let providerResult;
    try {
      providerResult = await adapter.verify(Object.freeze({
        claim: Object.freeze(structuredClone(claim)),
        credentials: adapterCredentials.values,
        now: new Date(now),
        receipt: Object.freeze(structuredClone(evidence.receipt)),
        sourceCommit,
      }));
    } catch {
      controls.push(invalidControl(
        claim.controlId,
        claim.provider,
        claim.evidenceSha256,
        "ADAPTER_EXECUTION_FAILED",
      ));
      continue;
    }
    const validation = validateAdapterResult(providerResult, claim, now);
    if (!validation.ok) {
      controls.push(invalidControl(
        claim.controlId,
        claim.provider,
        claim.evidenceSha256,
        validation.reasonCode,
        validation.status,
      ));
      continue;
    }
    if (proofIds.has(validation.proofId)) {
      controls.push(invalidControl(
        claim.controlId,
        claim.provider,
        claim.evidenceSha256,
        "PROVIDER_PROOF_REUSED",
      ));
      continue;
    }
    proofIds.add(validation.proofId);
    const identity = providerEvidenceIdentity({
      controlId: claim.controlId,
      provider: claim.provider,
      sha256: claim.evidenceSha256,
    });
    if (!identity) {
      controls.push(invalidControl(
        claim.controlId,
        claim.provider,
        claim.evidenceSha256,
        "EVIDENCE_IDENTITY_INVALID",
      ));
      continue;
    }
    externallyVerifiedEvidence.add(identity);
    controls.push({
      controlId: claim.controlId,
      provider: claim.provider,
      reasonCode: "PROVIDER_EVIDENCE_VERIFIED",
      sha256: claim.evidenceSha256,
      status: "verified",
    });
  }

  const ok = controls.length === plan.claims.length
    && controls.every((control) => control.status === "verified");
  return {
    ok,
    externallyVerifiedEvidence,
    report: {
      controls,
      evidenceCommit: overlayReport?.evidenceCommit ?? null,
      findingCodes: ok ? [] : ["PROVIDER_EVIDENCE_INCOMPLETE"],
      overlayDigest: overlayReport?.overlayDigest ?? null,
      overlayValidated: evidenceCommit === undefined ? null : true,
      sourceCommit,
      status: ok ? "verified" : "blocked",
    },
  };
}

function resolveRepositoryConfig(rootDir, relativePath) {
  const resolved = resolveRegularRepositoryFile(relativePath, { rootDir });
  if (!resolved) throw new Error("Repository configuration path is invalid.");
  return resolved.canonicalPath;
}

export function evaluateRepositoryReadiness({
  externallyVerifiedEvidence,
  incidentPath = defaultIncidentPath,
  now = new Date(),
  paymentProviderPath = defaultPaymentProviderPath,
  recoveryPath = defaultRecoveryPath,
  rootDir = process.cwd(),
} = {}) {
  const incidentConfigPath = resolveRepositoryConfig(rootDir, incidentPath);
  const recoveryConfigPath = resolveRepositoryConfig(rootDir, recoveryPath);
  const paymentConfigPath = resolveRepositoryConfig(rootDir, paymentProviderPath);
  const recoveryPolicy = loadRecoveryPolicy(recoveryConfigPath);
  const paymentProviderPolicy = loadPaymentProviderPolicy(paymentConfigPath);
  const recoveryEvidenceByPath = readRecoveryPolicyEvidence(recoveryPolicy, { rootDir });
  const paymentProviderEvidence = readPaymentProviderEvidence(paymentProviderPolicy, { rootDir });
  return evaluateLaunchReadiness({
    incidentConfig: loadIncidentRoutingConfig(incidentConfigPath),
    recoveryPolicy,
    paymentProviderPolicy,
  }, {
    externallyVerifiedEvidence,
    incidentEvidenceRoot: rootDir,
    now,
    paymentProviderEvidence,
    recoveryEvidenceByPath,
    recoveryEvidenceSha256ByPath: Object.fromEntries(
      Object.entries(recoveryEvidenceByPath)
        .map(([evidencePath, evidence]) => [evidencePath, evidence?.sha256 ?? null]),
    ),
  });
}

function readinessSummary(readiness) {
  return {
    findingCodes: Array.isArray(readiness?.findings)
      ? readiness.findings.map((finding) => ({
        code: validIdentifier(finding?.code) ? finding.code : "READINESS_FINDING",
        source: validIdentifier(finding?.source) ? finding.source : "readiness",
      }))
      : [{ code: "READINESS_RESULT_INVALID", source: "readiness" }],
    status: readiness?.ok === true ? "ready" : "blocked",
  };
}

export async function runProviderEvidenceGate(options = {}) {
  const verification = await runEvidenceVerification(options);
  let readiness;
  if (options.evidenceCommit !== undefined && verification.report.overlayValidated !== true) {
    readiness = {
      ok: false,
      findings: [{ code: "EVIDENCE_OVERLAY_UNTRUSTED", source: "readiness" }],
    };
  } else {
    try {
      const evaluateReadiness = options.evaluateReadiness ?? evaluateRepositoryReadiness;
      readiness = await evaluateReadiness({
        externallyVerifiedEvidence: verification.externallyVerifiedEvidence,
        incidentPath: options.incidentPath,
        now: options.now,
        paymentProviderPath: options.paymentProviderPath,
        recoveryPath: options.recoveryPath,
        rootDir: options.evidenceRoot ?? options.rootDir,
      });
    } catch {
      readiness = {
        ok: false,
        findings: [{ code: "READINESS_EVALUATION_FAILED", source: "readiness" }],
      };
    }
  }
  const summarizedReadiness = readinessSummary(readiness);
  const ok = verification.ok && readiness?.ok === true;
  return {
    ok,
    externallyVerifiedEvidence: verification.externallyVerifiedEvidence,
    report: {
      controls: verification.report.controls,
      evidenceCommit: verification.report.evidenceCommit,
      findingCodes: verification.report.findingCodes,
      overlayDigest: verification.report.overlayDigest,
      overlayValidated: verification.report.overlayValidated,
      providerEvidence: {
        status: verification.ok ? "verified" : "blocked",
      },
      readiness: summarizedReadiness,
      schemaVersion: 1,
      sourceCommit: verification.report.sourceCommit,
      status: ok ? "ready" : "blocked",
    },
  };
}

export function validateEvidenceRunnerArguments(argv) {
  const valueFlags = new Set([
    "--evidence-commit",
    "--evidence-root",
    "--expected-live-commit",
    "--incident-file",
    "--payment-provider-file",
    "--recovery-file",
    "--source-commit",
  ]);
  const booleanFlags = new Set([
    "--json",
    "--read-only",
    "--require-ready",
    "--verify-providers-only",
  ]);
  const values = new Map();
  const flags = new Set();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (booleanFlags.has(token)) {
      if (flags.has(token)) return { ok: false, reasonCode: "ARGUMENT_DUPLICATE" };
      flags.add(token);
      continue;
    }
    if (!valueFlags.has(token)) return { ok: false, reasonCode: "ARGUMENT_UNKNOWN" };
    if (values.has(token)) return { ok: false, reasonCode: "ARGUMENT_DUPLICATE" };
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      return { ok: false, reasonCode: "ARGUMENT_VALUE_MISSING" };
    }
    values.set(token, value);
    index += 1;
  }
  if (!flags.has("--read-only")) return { ok: false, reasonCode: "READ_ONLY_FLAG_REQUIRED" };
  const requireReady = flags.has("--require-ready");
  const providersOnly = flags.has("--verify-providers-only");
  if (requireReady === providersOnly) {
    return {
      ok: false,
      reasonCode: requireReady ? "VERIFICATION_MODE_CONFLICT" : "VERIFICATION_MODE_REQUIRED",
    };
  }
  for (const required of [
    "--evidence-commit",
    "--evidence-root",
    "--source-commit",
    "--expected-live-commit",
  ]) {
    if (!values.has(required)) return { ok: false, reasonCode: "ARGUMENT_REQUIRED" };
  }
  return { ok: true, flags, values };
}

export function parseEvidencePlanSecret(environment = process.env) {
  const serialized = environment?.RIVT_PROVIDER_EVIDENCE_PLAN_JSON;
  if (typeof serialized !== "string" || serialized.length === 0) {
    return { ok: false, reasonCode: "PLAN_SECRET_MISSING" };
  }
  if (Buffer.byteLength(serialized, "utf8") > maximumEvidencePlanBytes) {
    return { ok: false, reasonCode: "PLAN_SECRET_TOO_LARGE" };
  }
  try {
    const plan = JSON.parse(serialized);
    if (!isPlainObject(plan)) return { ok: false, reasonCode: "PLAN_SECRET_INVALID" };
    return { ok: true, plan };
  } catch {
    return { ok: false, reasonCode: "PLAN_SECRET_INVALID" };
  }
}

function environmentCredentials(environment = process.env) {
  const names = new Set(
    Object.values(compiledProviderAdapters)
      .flatMap((adapter) => adapter.requiredCredentials),
  );
  return Object.fromEntries(
    [...names]
      .filter((name) => typeof environment[name] === "string" && environment[name].length > 0)
      .map((name) => [name, environment[name]]),
  );
}

export function evidenceRunnerExitCode(result, { providersOnly = false } = {}) {
  if (providersOnly) {
    const launchHoldRemainsActive = result?.report?.readiness?.status === "blocked"
      && result.report.readiness.findingCodes?.some(
        (finding) => finding?.code === "ACTIVE_LAUNCH_HOLD",
      );
    return result?.report?.providerEvidence?.status === "verified"
      && launchHoldRemainsActive
      ? 0
      : 1;
  }
  return result?.ok === true ? 0 : 1;
}

export async function main(argv = process.argv.slice(2), { environment = process.env } = {}) {
  const parsed = validateEvidenceRunnerArguments(argv);
  if (!parsed.ok) {
    console.log(JSON.stringify({
      controls: [],
      findingCodes: [parsed.reasonCode],
      providerEvidence: { status: "blocked" },
      readiness: { findingCodes: [], status: "blocked" },
      schemaVersion: 1,
      sourceCommit: null,
      status: "blocked",
    }, null, 2));
    process.exitCode = 1;
    return;
  }
  const parsedPlan = parseEvidencePlanSecret(environment);
  if (!parsedPlan.ok) {
    console.log(JSON.stringify({
      controls: [],
      findingCodes: [parsedPlan.reasonCode],
      providerEvidence: { status: "blocked" },
      readiness: { findingCodes: [], status: "blocked" },
      schemaVersion: 1,
      sourceCommit: null,
      status: "blocked",
    }, null, 2));
    process.exitCode = 1;
    return;
  }
  const result = await runProviderEvidenceGate({
    credentials: environmentCredentials(environment),
    evidenceCommit: parsed.values.get("--evidence-commit"),
    evidenceRoot: parsed.values.get("--evidence-root"),
    expectedLiveCommit: parsed.values.get("--expected-live-commit"),
    incidentPath: parsed.values.get("--incident-file") ?? defaultIncidentPath,
    paymentProviderPath:
      parsed.values.get("--payment-provider-file") ?? defaultPaymentProviderPath,
    plan: parsedPlan.plan,
    recoveryPath: parsed.values.get("--recovery-file") ?? defaultRecoveryPath,
    rootDir: process.cwd(),
    sourceCommit: parsed.values.get("--source-commit"),
  });
  console.log(JSON.stringify(result.report, null, 2));
  process.exitCode = evidenceRunnerExitCode(result, {
    providersOnly: parsed.flags.has("--verify-providers-only"),
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
