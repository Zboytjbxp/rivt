import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const templateDirectory = path.join(repositoryRoot, "docs", "operations", "templates");

const policyPaths = {
  writer: path.join(templateDirectory, "aws-backup-writer-policy.example.json"),
  monitor: path.join(templateDirectory, "aws-backup-monitor-policy.example.json"),
  restore: path.join(templateDirectory, "aws-backup-restore-policy.example.json"),
  bucket: path.join(templateDirectory, "aws-backup-bucket-policy.example.json"),
};

const approvedActions = {
  writer: new Set([
    "s3:GetBucketVersioning",
    "s3:GetBucketObjectLockConfiguration",
    "s3:PutObject",
    "s3:GetObjectRetention",
  ]),
  monitor: new Set([
    "s3:GetBucketVersioning",
    "s3:GetBucketObjectLockConfiguration",
    "s3:ListBucketVersions",
    "s3:GetObjectVersion",
    "s3:GetObjectRetention",
  ]),
  restore: new Set([
    "s3:GetBucketVersioning",
    "s3:GetBucketObjectLockConfiguration",
    "s3:GetObjectVersion",
    "s3:GetObjectRetention",
  ]),
};

const bucketResource = "arn:aws:s3:::<BUCKET>";
const objectResource = "arn:aws:s3:::<BUCKET>/<PREFIX>/*";
const oneShotObjectResource = "arn:aws:s3:::<BUCKET>/<OBJECT_KEY>";
const oneShotWindowCondition = {
  DateGreaterThanEquals: { "aws:CurrentTime": "<WINDOW_START_ISO8601>" },
  DateLessThan: { "aws:CurrentTime": "<WINDOW_END_ISO8601>" },
  Null: { "s3:if-none-match": "false" },
};
const expectedGrant = {
  writer: {
    "s3:GetBucketVersioning": { resource: bucketResource },
    "s3:GetBucketObjectLockConfiguration": { resource: bucketResource },
    "s3:PutObject": { resource: oneShotObjectResource, condition: oneShotWindowCondition },
    "s3:GetObjectRetention": { resource: oneShotObjectResource },
  },
  monitor: {
    "s3:GetBucketVersioning": { resource: bucketResource },
    "s3:GetBucketObjectLockConfiguration": { resource: bucketResource },
    "s3:ListBucketVersions": {
      resource: bucketResource,
      condition: {
        StringEquals: { "s3:prefix": "<PREFIX>/" },
        NumericLessThanEquals: { "s3:max-keys": "1000" },
      },
    },
    "s3:GetObjectVersion": { resource: objectResource },
    "s3:GetObjectRetention": { resource: objectResource },
  },
  restore: {
    "s3:GetBucketVersioning": { resource: bucketResource },
    "s3:GetBucketObjectLockConfiguration": { resource: bucketResource },
    "s3:GetObjectVersion": {
      resource: oneShotObjectResource,
      condition: { StringEquals: { "s3:VersionId": "<VERSION_ID>" } },
    },
    "s3:GetObjectRetention": { resource: oneShotObjectResource },
  },
};

function actionList(statement) {
  return Array.isArray(statement.Action) ? statement.Action : [statement.Action];
}

function clone(value) {
  return structuredClone(value);
}

async function loadPolicy(role) {
  return JSON.parse(await readFile(policyPaths[role], "utf8"));
}

function allowStatements(policy) {
  return policy.Statement.filter((statement) => statement.Effect === "Allow");
}

function validateIdentityPolicy(role, policy) {
  assert.equal(policy.Version, "2012-10-17");
  assert.ok(Array.isArray(policy.Statement));
  assert.ok(policy.Statement.length > 0);
  assert.equal(policy.Statement.every((statement) => statement.Effect === "Allow"), true);

  const observedActions = new Set();
  for (const statement of allowStatements(policy)) {
    assert.equal("NotAction" in statement, false, `${role} must not use NotAction`);
    assert.equal("NotResource" in statement, false, `${role} must not use NotResource`);
    assert.equal("Principal" in statement, false, `${role} is an identity policy`);
    for (const action of actionList(statement)) {
      assert.equal(
        approvedActions[role].has(action),
        true,
        `${role} contains a forbidden or unreviewed grant: ${action}`,
      );
      assert.equal(observedActions.has(action), false, `${role} grants ${action} more than once`);
      assert.equal(statement.Resource, expectedGrant[role][action].resource, `${role} ${action} has the wrong resource`);
      if (expectedGrant[role][action].condition) {
        assert.deepEqual(statement.Condition, expectedGrant[role][action].condition, `${role} ${action} has the wrong condition`);
      } else {
        assert.equal("Condition" in statement, false, `${role} ${action} has an unexpected condition`);
      }
      observedActions.add(action);
    }
  }

  assert.deepEqual(observedActions, approvedActions[role]);
}

function statementForAction(policy, action) {
  return policy.Statement.find((statement) => actionList(statement).includes(action));
}

function addGrant(policy, action) {
  const mutated = clone(policy);
  mutated.Statement.push({
    Sid: "InjectedForbiddenGrant",
    Effect: "Allow",
    Action: action,
    Resource: "*",
  });
  return mutated;
}

test("backup IAM templates contain placeholders only", async () => {
  for (const [role, filePath] of Object.entries(policyPaths)) {
    const source = await readFile(filePath, "utf8");
    assert.match(source, /<BUCKET>/, `${role} must retain the bucket placeholder`);
    if (role === "writer" || role === "restore") {
      assert.match(source, /<OBJECT_KEY>/, `${role} must bind one exact object key`);
      assert.doesNotMatch(source, /<PREFIX>\/\*/, `${role} must not grant the whole prefix`);
      if (role === "writer") {
        assert.match(source, /<WINDOW_START_ISO8601>/, "writer must bind the approved window start");
        assert.match(source, /<WINDOW_END_ISO8601>/, "writer must bind the approved window end");
      } else {
        assert.match(source, /<VERSION_ID>/, "restore must bind one exact object version");
      }
    } else {
      assert.match(source, /<PREFIX>/, `${role} must retain the prefix placeholder`);
    }
    assert.doesNotMatch(source, /arn:aws:iam::\d{12}/, `${role} must not name a real AWS account`);
    assert.doesNotMatch(source, /AKIA[0-9A-Z]{16}/, `${role} must not contain an access key`);
  }
});

test("one-shot writer is bound to one object and UTC window without read, list, delete, or retention administration", async () => {
  const policy = await loadPolicy("writer");
  validateIdentityPolicy("writer", policy);

  const bucketStatement = statementForAction(policy, "s3:GetBucketVersioning");
  assert.equal(bucketStatement.Resource, "arn:aws:s3:::<BUCKET>");

  const objectStatement = statementForAction(policy, "s3:PutObject");
  assert.equal(objectStatement.Resource, oneShotObjectResource);
  assert.deepEqual(objectStatement.Condition, oneShotWindowCondition);
  const retentionStatement = statementForAction(policy, "s3:GetObjectRetention");
  assert.equal(retentionStatement.Resource, oneShotObjectResource);
  assert.equal("Condition" in retentionStatement, false);
});

test("monitor listing is prefix-bounded and object reads are version-specific", async () => {
  const policy = await loadPolicy("monitor");
  validateIdentityPolicy("monitor", policy);

  const listStatement = statementForAction(policy, "s3:ListBucketVersions");
  assert.equal(listStatement.Resource, "arn:aws:s3:::<BUCKET>");
  assert.deepEqual(listStatement.Condition, {
    StringEquals: {
      "s3:prefix": "<PREFIX>/",
    },
    NumericLessThanEquals: {
      "s3:max-keys": "1000",
    },
  });

  const readStatement = statementForAction(policy, "s3:GetObjectVersion");
  assert.equal(readStatement.Resource, "arn:aws:s3:::<BUCKET>/<PREFIX>/*");
});

test("restore reads one exact version without bucket listing or broad prefix access", async () => {
  const policy = await loadPolicy("restore");
  validateIdentityPolicy("restore", policy);
  assert.equal(
    policy.Statement.flatMap(actionList).some((action) => action.startsWith("s3:List")),
    false,
  );

  const readStatement = statementForAction(policy, "s3:GetObjectVersion");
  assert.equal(readStatement.Resource, oneShotObjectResource);
  assert.deepEqual(readStatement.Condition, {
    StringEquals: { "s3:VersionId": "<VERSION_ID>" },
  });
  const retentionStatement = statementForAction(policy, "s3:GetObjectRetention");
  assert.equal(retentionStatement.Resource, oneShotObjectResource);
  assert.equal("Condition" in retentionStatement, false);
});

test("identity-policy validation rejects forbidden grant classes", async (t) => {
  const writer = await loadPolicy("writer");
  const restore = await loadPolicy("restore");
  const forbiddenCases = [
    ["content read", "writer", writer, "s3:GetObject"],
    ["bucket list", "restore", restore, "s3:ListBucket"],
    ["delete", "writer", writer, "s3:DeleteObject"],
    ["retention administration", "writer", writer, "s3:PutObjectRetention"],
    ["retention bypass", "writer", writer, "s3:BypassGovernanceRetention"],
    ["versioning mutation", "writer", writer, "s3:PutBucketVersioning"],
    ["lock mutation", "writer", writer, "s3:PutBucketObjectLockConfiguration"],
    ["lifecycle mutation", "writer", writer, "s3:PutLifecycleConfiguration"],
    ["wildcard", "writer", writer, "s3:*"],
  ];

  for (const [label, role, policy, action] of forbiddenCases) {
    await t.test(label, () => {
      assert.throws(
        () => validateIdentityPolicy(role, addGrant(policy, action)),
        new RegExp(`forbidden or unreviewed grant: ${action.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`),
      );
    });
  }
});

test("identity-policy validation rejects duplicate broad grants of approved actions", async () => {
  const writer = await loadPolicy("writer");
  assert.throws(
    () => validateIdentityPolicy("writer", addGrant(writer, "s3:PutObject")),
    /grants s3:PutObject more than once|wrong resource/,
  );
});

test("bucket guardrail policy denies insecure transport, unguarded creates, and multipart initiation or parts", async () => {
  const policy = await loadPolicy("bucket");
  assert.equal(policy.Version, "2012-10-17");
  assert.equal(policy.Statement.length, 3);
  assert.equal(policy.Statement.every((statement) => statement.Effect === "Deny"), true);

  const transport = policy.Statement.find((statement) => statement.Sid === "DenyInsecureTransport");
  assert.equal(transport.Principal, "*");
  assert.equal(transport.Action, "s3:*");
  assert.deepEqual(transport.Resource, [
    "arn:aws:s3:::<BUCKET>",
    "arn:aws:s3:::<BUCKET>/*",
  ]);
  assert.deepEqual(transport.Condition, {
    Bool: {
      "aws:SecureTransport": "false",
      "aws:PrincipalIsAWSService": "false",
    },
  });

  const createOnly = policy.Statement.find(
    (statement) => statement.Sid === "DenyPutWithoutCreateOnlyPrecondition",
  );
  assert.equal(createOnly.Principal, "*");
  assert.equal(createOnly.Action, "s3:PutObject");
  assert.equal(createOnly.Resource, "arn:aws:s3:::<BUCKET>/<PREFIX>/*");
  assert.deepEqual(createOnly.Condition, {
    Null: { "s3:if-none-match": "true" },
    Bool: { "s3:ObjectCreationOperation": "true" },
  });

  const multipart = policy.Statement.find(
    (statement) => statement.Sid === "DenyMultipartInitiationAndParts",
  );
  assert.equal(multipart.Principal, "*");
  assert.equal(multipart.Action, "s3:PutObject");
  assert.equal(multipart.Resource, "arn:aws:s3:::<BUCKET>/<PREFIX>/*");
  assert.deepEqual(multipart.Condition, {
    Bool: { "s3:ObjectCreationOperation": "false" },
  });
});
