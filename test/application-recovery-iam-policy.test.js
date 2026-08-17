import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const templateDirectory = path.join(repositoryRoot, "docs", "operations", "templates");

const policyPaths = {
  source: path.join(
    templateDirectory,
    "aws-application-recovery-source-reader-policy.example.json",
  ),
  writer: path.join(
    templateDirectory,
    "aws-application-recovery-set-writer-policy.example.json",
  ),
  reader: path.join(
    templateDirectory,
    "aws-application-recovery-exact-version-reader-monitor-policy.example.json",
  ),
  restore: path.join(
    templateDirectory,
    "aws-application-recovery-isolated-restore-policy.example.json",
  ),
};

const sourceBucket = "arn:aws:s3:::<APPLICATION_SOURCE_BUCKET>";
const sourceObjects = `${sourceBucket}/*`;
const recoveryBucket = "arn:aws:s3:::<RECOVERY_DESTINATION_BUCKET>";
const exactWriterObjects = [
  `${recoveryBucket}/<EXACT_DATABASE_OBJECT_KEY>`,
  `${recoveryBucket}/<EXACT_ARCHIVE_OBJECT_KEY>`,
  `${recoveryBucket}/<EXACT_COMPLETION_OBJECT_KEY>`,
];
const exactReaderObjects = [
  `${recoveryBucket}/<EXACT_COMPLETION_OBJECT_KEY>`,
  `${recoveryBucket}/<EXACT_DATABASE_OBJECT_KEY>`,
  `${recoveryBucket}/<EXACT_ARCHIVE_OBJECT_KEY>`,
];
const exactReaderVersions = [
  "<EXACT_COMPLETION_VERSION_ID>",
  "<EXACT_DATABASE_VERSION_ID>",
  "<EXACT_ARCHIVE_VERSION_ID>",
];
const restoreBucket = "arn:aws:s3:::<NONPRODUCTION_RESTORE_BUCKET>";
const restoreObjects = `${restoreBucket}/<ISOLATED_NONPRODUCTION_RESTORE_PREFIX>/*`;

const approvedAllowActions = {
  source: new Set(["s3:ListBucket", "s3:GetObject"]),
  writer: new Set(["s3:PutObject", "s3:GetObjectRetention"]),
  reader: new Set([
    "s3:ListBucketVersions",
    "s3:GetObjectVersion",
    "s3:GetObjectRetention",
  ]),
  restore: new Set([
    "s3:GetBucketVersioning",
    "s3:ListBucket",
    "s3:PutObject",
    "s3:GetObject",
    "s3:DeleteObject",
    "s3:DeleteObjectVersion",
  ]),
};

function actionList(statement) {
  return Array.isArray(statement.Action) ? statement.Action : [statement.Action];
}

async function loadPolicy(role) {
  return JSON.parse(await readFile(policyPaths[role], "utf8"));
}

function statementFor(policy, effect, action) {
  return policy.Statement.find(
    (statement) => statement.Effect === effect && actionList(statement).includes(action),
  );
}

function clone(value) {
  return structuredClone(value);
}

function injectAllow(policy, action, resource = "arn:aws:s3:::<INJECTED_BUCKET>") {
  const mutated = clone(policy);
  mutated.Statement.push({
    Sid: "InjectedPrivilegeDrift",
    Effect: "Allow",
    Action: action,
    Resource: resource,
  });
  return mutated;
}

function validateIdentityPolicy(role, policy) {
  assert.equal(policy.Version, "2012-10-17");
  assert.ok(Array.isArray(policy.Statement));
  assert.ok(policy.Statement.length > 0);

  const observedAllowActions = new Set();
  for (const statement of policy.Statement) {
    assert.equal(["Allow", "Deny"].includes(statement.Effect), true);
    assert.equal("Principal" in statement, false, `${role} must be an identity policy`);
    assert.equal("NotAction" in statement, false, `${role} must not use NotAction`);
    assert.equal("NotResource" in statement, false, `${role} must not use NotResource`);
    const resources = Array.isArray(statement.Resource)
      ? statement.Resource
      : [statement.Resource];
    assert.ok(resources.every((resource) => typeof resource === "string" && resource !== "*"));

    for (const action of actionList(statement)) {
      assert.equal(action.includes("*"), false, `${role} must not grant wildcard actions`);
      assert.match(action, /^s3:[A-Za-z]+$/u);
      if (statement.Effect === "Allow") {
        assert.equal(
          approvedAllowActions[role].has(action),
          true,
          `${role} contains a forbidden or unreviewed grant: ${action}`,
        );
        if (!(role === "reader" && action === "s3:GetObjectVersion")) {
          assert.equal(
            observedAllowActions.has(action),
            false,
            `${role} grants ${action} more than once`,
          );
        }
        observedAllowActions.add(action);
      }
    }
  }

  assert.deepEqual(observedAllowActions, approvedAllowActions[role]);
}

test("application recovery IAM examples contain placeholders and no credentials", async () => {
  for (const [role, filePath] of Object.entries(policyPaths)) {
    const source = await readFile(filePath, "utf8");
    assert.match(source, /<[A-Z0-9_]+>/u, `${role} must remain an example`);
    assert.doesNotMatch(source, /arn:aws:iam::\d{12}/u, `${role} must not name an account`);
    assert.doesNotMatch(source, /AKIA[0-9A-Z]{16}/u, `${role} must not contain a key`);
    assert.doesNotMatch(source, /(?:secret|token|password)\s*[=:]\s*["']?[^<\s]/iu);
  }

  assert.match(await readFile(policyPaths.source, "utf8"), /<APPLICATION_SOURCE_BUCKET>/u);
  const writerSource = await readFile(policyPaths.writer, "utf8");
  assert.match(writerSource, /<RECOVERY_DESTINATION_BUCKET>/u);
  assert.match(writerSource, /<EXACT_DATABASE_OBJECT_KEY>/u);
  assert.match(writerSource, /<EXACT_ARCHIVE_OBJECT_KEY>/u);
  assert.match(writerSource, /<EXACT_COMPLETION_OBJECT_KEY>/u);
  assert.doesNotMatch(writerSource, /<RECOVERY_SET_PREFIX>/u);
  const readerSource = await readFile(policyPaths.reader, "utf8");
  for (const placeholder of [
    "<EXACT_COMPLETION_VERSION_ID>",
    "<EXACT_DATABASE_VERSION_ID>",
    "<EXACT_ARCHIVE_VERSION_ID>",
  ]) assert.ok(readerSource.includes(placeholder));
  assert.match(
    await readFile(policyPaths.restore, "utf8"),
    /<ISOLATED_NONPRODUCTION_RESTORE_PREFIX>/u,
  );
});

test("all four identity examples reject wildcard actions and unreviewed allow grants", async (t) => {
  for (const role of Object.keys(policyPaths)) {
    await t.test(role, async () => {
      const policy = await loadPolicy(role);
      validateIdentityPolicy(role, policy);
      assert.throws(
        () => validateIdentityPolicy(role, injectAllow(policy, "s3:*")),
        /wildcard actions|forbidden or unreviewed grant/u,
      );
      assert.throws(
        () => validateIdentityPolicy(role, injectAllow(policy, "s3:PutBucketPolicy")),
        /forbidden or unreviewed grant/u,
      );
    });
  }
});

test("resource wildcards are limited to source reads and isolated restore", async () => {
  const approvedWildcardResources = new Set([
    sourceObjects,
    restoreObjects,
  ]);

  for (const [role] of Object.entries(policyPaths)) {
    const policy = await loadPolicy(role);
    for (const statement of policy.Statement) {
      const resources = Array.isArray(statement.Resource)
        ? statement.Resource
        : [statement.Resource];
      for (const resource of resources) {
        if (!resource.includes("*")) continue;
        assert.equal(
          approvedWildcardResources.has(resource),
          true,
          `${role} has wildcard resource drift: ${resource}`,
        );
        assert.equal((resource.match(/\*/gu) ?? []).length, 1);
        assert.equal(resource.endsWith("/*"), true);
        assert.equal(resource.includes("?"), false);
      }
    }
  }
});

test("source reader inventories and reads the exact application bucket without mutation", async () => {
  const policy = await loadPolicy("source");
  validateIdentityPolicy("source", policy);
  assert.equal(policy.Statement.every((statement) => statement.Effect === "Allow"), true);

  const list = statementFor(policy, "Allow", "s3:ListBucket");
  assert.equal(list.Resource, sourceBucket);
  assert.deepEqual(list.Condition, {
    NumericLessThanEquals: { "s3:max-keys": "1000" },
  });
  assert.equal("StringLike" in list.Condition, false);
  assert.equal("StringEquals" in list.Condition, false);

  const read = statementFor(policy, "Allow", "s3:GetObject");
  assert.equal(read.Resource, sourceObjects);
  assert.equal("Condition" in read, false);
  assert.equal(
    policy.Statement.flatMap(actionList).some((action) => action.startsWith("s3:Put") || action.startsWith("s3:Delete")),
    false,
  );
});

test("protected writer allows only the exact aggregate-set keys, is time bounded, and denies multipart", async () => {
  const policy = await loadPolicy("writer");
  validateIdentityPolicy("writer", policy);

  const put = statementFor(policy, "Allow", "s3:PutObject");
  assert.deepEqual(put.Resource, exactWriterObjects);
  assert.deepEqual(put.Condition, {
    DateGreaterThanEquals: { "aws:CurrentTime": "<WINDOW_START_ISO8601>" },
    DateLessThan: { "aws:CurrentTime": "<WINDOW_END_ISO8601>" },
    StringEquals: { "s3:if-none-match": "*" },
  });

  const multipartDeny = statementFor(policy, "Deny", "s3:PutObject");
  assert.deepEqual(multipartDeny.Resource, exactWriterObjects);
  assert.deepEqual(multipartDeny.Condition, {
    Bool: { "s3:ObjectCreationOperation": "false" },
  });

  const retention = statementFor(policy, "Allow", "s3:GetObjectRetention");
  assert.deepEqual(retention.Resource, exactWriterObjects);
  assert.equal("Condition" in retention, false);

  for (const statement of policy.Statement) {
    const resources = Array.isArray(statement.Resource)
      ? statement.Resource
      : [statement.Resource];
    assert.equal(resources.some((resource) => /[*?]/u.test(resource)), false);
    assert.equal(resources.some((resource) => resource.includes("${")), false);
  }

  const actions = policy.Statement.flatMap(actionList);
  assert.equal(actions.some((action) => action.startsWith("s3:List")), false);
  assert.equal(actions.includes("s3:GetObject"), false);
  assert.equal(actions.some((action) => action.startsWith("s3:Delete")), false);
});

test("protected writer regression rejects a prefix-wide direct-create grant", async () => {
  const policy = await loadPolicy("writer");
  const mutated = clone(policy);
  const put = statementFor(mutated, "Allow", "s3:PutObject");
  put.Resource = `${recoveryBucket}/<RECOVERY_SET_PREFIX>/*`;

  assert.throws(() => {
    validateIdentityPolicy("writer", mutated);
    assert.deepEqual(put.Resource, exactWriterObjects, "writer create resources must be exact");
  }, /writer create resources must be exact/u);
});

test("recovery reader lists one prefix and content reads all three exact immutable versions", async () => {
  const policy = await loadPolicy("reader");
  validateIdentityPolicy("reader", policy);

  const list = statementFor(policy, "Allow", "s3:ListBucketVersions");
  assert.equal(list.Resource, recoveryBucket);
  assert.deepEqual(list.Condition, {
    StringEquals: { "s3:prefix": "<RECOVERY_SET_PREFIX>/" },
    NumericLessThanEquals: { "s3:max-keys": "1000" },
  });

  const reads = policy.Statement.filter((statement) => (
    statement.Effect === "Allow" && actionList(statement).includes("s3:GetObjectVersion")
  ));
  assert.equal(reads.length, 3);
  assert.deepEqual(reads.map((statement) => statement.Resource).sort(), [...exactReaderObjects].sort());
  assert.deepEqual(
    reads.map((statement) => statement.Condition.StringEquals["s3:VersionId"]).sort(),
    [...exactReaderVersions].sort(),
  );

  const retention = statementFor(policy, "Allow", "s3:GetObjectRetention");
  assert.deepEqual([...retention.Resource].sort(), [...exactReaderObjects].sort());
  assert.equal("Condition" in retention, false);
  assert.equal(exactReaderObjects.some((resource) => resource.includes("*")), false);
  assert.equal(
    policy.Statement.flatMap(actionList).some((action) => action.startsWith("s3:Put") || action.startsWith("s3:Delete")),
    false,
  );
});

test("isolated restore authority cannot escape its nonproduction namespace", async () => {
  const policy = await loadPolicy("restore");
  validateIdentityPolicy("restore", policy);

  const versioning = statementFor(policy, "Allow", "s3:GetBucketVersioning");
  assert.equal(versioning.Resource, restoreBucket);
  assert.equal("Condition" in versioning, false);

  const list = statementFor(policy, "Allow", "s3:ListBucket");
  assert.equal(list.Resource, restoreBucket);
  assert.deepEqual(list.Condition, {
    StringEquals: { "s3:prefix": "<ISOLATED_NONPRODUCTION_RESTORE_PREFIX>/" },
    NumericLessThanEquals: { "s3:max-keys": "1000" },
  });

  const put = statementFor(policy, "Allow", "s3:PutObject");
  assert.equal(put.Resource, restoreObjects);
  assert.deepEqual(put.Condition, {
    Null: { "s3:if-none-match": "false" },
  });
  const multipartDeny = statementFor(policy, "Deny", "s3:PutObject");
  assert.equal(multipartDeny.Resource, restoreObjects);
  assert.deepEqual(multipartDeny.Condition, {
    Bool: { "s3:ObjectCreationOperation": "false" },
  });

  assert.equal(statementFor(policy, "Allow", "s3:GetObject").Resource, restoreObjects);
  assert.equal(statementFor(policy, "Allow", "s3:DeleteObject").Resource, restoreObjects);
  assert.equal(
    statementFor(policy, "Allow", "s3:DeleteObjectVersion").Resource,
    restoreObjects,
  );
  assert.equal(policy.Statement.flatMap(actionList).includes("s3:ListBucketVersions"), false);
  assert.equal(policy.Statement.flatMap(actionList).includes("s3:DeleteBucket"), false);
});

test("a broad resource mutation is rejected even when the action is otherwise approved", async () => {
  const source = await loadPolicy("source");
  assert.throws(
    () => validateIdentityPolicy("source", injectAllow(source, "s3:GetObject", "*")),
    /resource|grants s3:GetObject more than once/u,
  );
});
