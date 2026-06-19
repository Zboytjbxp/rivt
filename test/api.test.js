import assert from "node:assert/strict";
import test from "node:test";
import {
  ApiError,
  createRequestContext,
  decodeCursor,
  encodeCursor,
  paginationQuerySchema,
  validate,
  z,
} from "../server/api.js";

test("request context preserves valid request IDs and replaces invalid values", () => {
  for (const [incoming, expected] of [
    ["08db31b6-ed9f-44c8-ac3b-786652eb5f29", "08db31b6-ed9f-44c8-ac3b-786652eb5f29"],
    ["not-a-request-id", null],
  ]) {
    const request = { headers: { "x-request-id": incoming } };
    const headers = new Map();
    createRequestContext(request, { setHeader: (key, value) => headers.set(key, value) }, () => {});
    assert.match(request.requestId, /^[0-9a-f-]{36}$/);
    if (expected) assert.equal(request.requestId, expected);
    else assert.notEqual(request.requestId, incoming);
    assert.equal(headers.get("X-Request-Id"), request.requestId);
  }
});

test("validation produces stable API errors", () => {
  assert.deepEqual(validate(paginationQuerySchema, { limit: "50" }), { limit: 50 });
  assert.throws(
    () => validate(z.object({ role: z.enum(["contractor", "tradesperson"]) }), { role: "homeowner" }),
    (error) => error instanceof ApiError
      && error.status === 422
      && error.code === "VALIDATION_FAILED"
      && error.details.issues[0].path === "role",
  );
});

test("pagination cursors round trip and fail closed", () => {
  const value = { createdAt: "2026-06-18T00:00:00.000Z", id: "item-1" };
  assert.deepEqual(decodeCursor(encodeCursor(value)), value);
  assert.throws(
    () => decodeCursor("invalid"),
    (error) => error instanceof ApiError && error.code === "INVALID_CURSOR",
  );
});
