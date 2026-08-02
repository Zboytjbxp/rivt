import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { createRequestLogger, logError, logInfo } from "../server/logger.js";

function captureRecord(method, callback) {
  const original = console[method];
  let line = null;
  console[method] = (value) => {
    line = value;
  };
  try {
    callback();
  } finally {
    console[method] = original;
  }
  assert.equal(typeof line, "string");
  return {
    line,
    record: JSON.parse(line),
  };
}

test("structured logging recursively redacts secrets and customer PII", () => {
  const error = new Error(
    "Provider rejected owner@example.com with Bearer secret-bearer-token "
      + "password=hunter2 at postgres://dbuser:dbpass@db.example/rivt",
  );
  error.code = "PROVIDER_REJECTED";
  error.status = 502;

  const { line, record } = captureRecord("error", () => {
    logError("provider.failure", {
      requestId: "req-safe",
      authorization: "Bearer top-level-secret",
      nested: {
        accessToken: "nested-secret",
        profile: {
          email: "owner@example.com",
          phoneNumber: "+1 904 555 0110",
          streetAddress: "123 Main St",
        },
        customerEmail: "customer@example.com",
        recipientPhone: "+1 904 555 0199",
        billingAddress: "456 Oak St",
      },
      providerMessage:
        "callback?access_token=query-secret&x-amz-signature=signed-secret "
        + "uses sk_live_1234567890 and AIza123456789012345678901234567890",
      error,
    });
  });

  assert.equal(record.authorization, "[REDACTED]");
  assert.equal(record.nested.accessToken, "[REDACTED]");
  assert.equal(record.nested.profile.email, "[REDACTED]");
  assert.equal(record.nested.profile.phoneNumber, "[REDACTED]");
  assert.equal(record.nested.profile.streetAddress, "[REDACTED]");
  assert.equal(record.nested.customerEmail, "[REDACTED]");
  assert.equal(record.nested.recipientPhone, "[REDACTED]");
  assert.equal(record.nested.billingAddress, "[REDACTED]");
  assert.equal(record.error.name, "Error");
  assert.equal(record.error.code, "PROVIDER_REJECTED");
  assert.equal(record.error.status, 502);
  assert.equal(record.requestId, "req-safe");

  for (const unsafeValue of [
    "owner@example.com",
    "secret-bearer-token",
    "hunter2",
    "dbuser",
    "dbpass",
    "top-level-secret",
    "nested-secret",
    "904 555 0110",
    "904 555 0199",
    "123 Main St",
    "456 Oak St",
    "query-secret",
    "signed-secret",
    "sk_live_1234567890",
    "AIza123456789012345678901234567890",
  ]) {
    assert.equal(line.includes(unsafeValue), false, `log contained ${unsafeValue}`);
  }
});

test("structured logging preserves operational fields and reserved record metadata", () => {
  const { record } = captureRecord("log", () => {
    logInfo("billing.checkout_reconciled", {
      level: "forged",
      event: "forged",
      service: "forged",
      timestamp: "forged",
      requestId: "req-123",
      accountId: "account-123",
      stripeCheckoutSessionId: "cs_test_123",
      result: {
        status: "complete",
        duplicate: false,
        relatedCount: 2,
      },
    });
  });

  assert.equal(record.level, "info");
  assert.equal(record.event, "billing.checkout_reconciled");
  assert.equal(record.service, "rivt-api");
  assert.match(record.timestamp, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(record.requestId, "req-123");
  assert.equal(record.accountId, "account-123");
  assert.equal(record.stripeCheckoutSessionId, "cs_test_123");
  assert.deepEqual(record.result, {
    status: "complete",
    duplicate: false,
    relatedCount: 2,
  });
});

test("structured logging remains usable for circular diagnostic context", () => {
  const context = {
    requestId: "req-circular",
    status: "retrying",
  };
  context.self = context;

  const { record } = captureRecord("log", () => {
    logInfo("worker.retry", { context });
  });

  assert.equal(record.context.requestId, "req-circular");
  assert.equal(record.context.status, "retrying");
  assert.equal(record.context.self, "[Circular]");
});

test("request logging completes once and exposes safe optional telemetry hooks", () => {
  const response = new EventEmitter();
  response.statusCode = 201;
  response.writableEnded = true;
  const started = [];
  const completed = [];
  const request = {
    method: "POST",
    path: "/api/v1/uploads",
    headers: { "content-type": "multipart/form-data; boundary=test" },
    requestId: "req-upload",
    authUser: { id: "account-123" },
    file: { size: 42 },
  };
  let nextCalls = 0;
  const { record } = captureRecord("log", () => {
    createRequestLogger({
      onStart: (start) => {
        started.push(start);
        return (finish) => completed.push(finish);
      },
      onComplete: () => assert.fail("A start completion callback takes precedence."),
    })(request, response, () => {
      nextCalls += 1;
    });
    response.emit("finish");
    response.emit("close");
  });

  assert.equal(nextCalls, 1);
  assert.deepEqual(started, [{ multipart: true }]);
  assert.equal(completed.length, 1);
  const { durationMs, ...completion } = completed[0];
  assert.deepEqual(completion, {
    method: "POST",
    path: "/api/v1/uploads",
    statusCode: 201,
    actorId: "account-123",
    aborted: false,
    multipart: true,
    uploadBytes: 42,
  });
  assert.equal(typeof durationMs, "number");
  assert.equal(record.event, "http.request");
  assert.equal(record.multipart, true);
  assert.equal(record.aborted, false);
  assert.equal(record.uploadBytes, 42);
});

test("request logging marks an unfinished close as aborted", () => {
  const response = new EventEmitter();
  response.statusCode = 499;
  response.writableEnded = false;
  const completed = [];
  const request = {
    method: "GET",
    path: "/api/v1/jobs",
    headers: {},
  };

  captureRecord("log", () => {
    createRequestLogger({ onComplete: (record) => completed.push(record) })(request, response, () => {});
    response.emit("close");
  });

  assert.equal(completed.length, 1);
  assert.equal(completed[0].aborted, true);
  assert.equal(completed[0].multipart, false);
  assert.equal(completed[0].uploadBytes, 0);
});
