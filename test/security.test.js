import assert from "node:assert/strict";
import test from "node:test";
import {
  createDurableRateLimiter,
  createOriginGuard,
  createRateLimiter,
  createRequireAuthenticatedUser,
  parseCookies,
  readSessionId,
} from "../server/security.js";

function responseDouble() {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    setHeader(name, value) { this.headers[name] = value; },
  };
}

test("cookie parsing and session validation fail closed", () => {
  const request = { headers: { cookie: "rivt_session=2d89c725-9409-4493-96ea-b369c0b28425; theme=dark" } };
  assert.deepEqual(parseCookies(request), {
    rivt_session: "2d89c725-9409-4493-96ea-b369c0b28425",
    theme: "dark",
  });
  assert.equal(readSessionId(request, "rivt_session"), "2d89c725-9409-4493-96ea-b369c0b28425");
  assert.equal(readSessionId({ headers: { cookie: "rivt_session=forged" } }, "rivt_session"), null);
});

test("malformed cookie encoding fails closed without throwing", () => {
  const request = { headers: { cookie: "rivt_session=%E0%A4%A" } };
  assert.doesNotThrow(() => parseCookies(request));
  assert.equal(readSessionId(request, "rivt_session"), null);
});

test("origin guard rejects unsafe cross-origin requests", () => {
  const guard = createOriginGuard(["https://rivt.pro"]);
  const response = responseDouble();
  let nextCalled = false;
  guard({ method: "POST", get: () => "https://attacker.example" }, response, () => { nextCalled = true; });
  assert.equal(nextCalled, false);
  assert.equal(response.statusCode, 403);

  guard({ method: "GET", get: () => "https://attacker.example" }, responseDouble(), () => { nextCalled = true; });
  assert.equal(nextCalled, true);
});

test("rate limiter blocks after configured request count", () => {
  const limiter = createRateLimiter({ windowMs: 60_000, max: 2, namespace: "test" });
  const request = { ip: "127.0.0.1", method: "POST", socket: {} };
  let calls = 0;
  limiter(request, responseDouble(), () => { calls += 1; });
  limiter(request, responseDouble(), () => { calls += 1; });
  const blocked = responseDouble();
  limiter(request, blocked, () => { calls += 1; });
  assert.equal(calls, 2);
  assert.equal(blocked.statusCode, 429);
});

test("durable rate limiter uses shared storage and headers", async () => {
  let count = 0;
  const database = {
    async query(_sql, params) {
      count += 1;
      assert.equal(params[0], "durable-test");
      assert.equal(typeof params[1], "string");
      assert.equal(params[1].length, 64);
      return { rows: [{ request_count: count, expires_at: new Date(Date.now() + 60_000) }] };
    },
  };
  const limiter = createDurableRateLimiter({
    database,
    databaseAvailable: () => true,
    windowMs: 60_000,
    max: 2,
    namespace: "durable-test",
  });
  const request = { ip: "127.0.0.1", method: "POST", socket: {}, headers: {} };
  let calls = 0;

  await limiter(request, responseDouble(), () => { calls += 1; });
  await limiter(request, responseDouble(), () => { calls += 1; });
  const blocked = responseDouble();
  await limiter(request, blocked, () => { calls += 1; });

  assert.equal(calls, 2);
  assert.equal(blocked.statusCode, 429);
  assert.equal(blocked.headers["RateLimit-Limit"], "2");
  assert.equal(blocked.headers["RateLimit-Remaining"], "0");
  assert.ok(Number(blocked.headers["Retry-After"]) >= 1);
});

test("authenticated-user middleware rejects missing and unknown sessions", async () => {
  const middleware = createRequireAuthenticatedUser({
    databaseAvailable: () => true,
    findUserBySessionId: async () => null,
    cookieName: "rivt_session",
  });

  const missing = responseDouble();
  await middleware({ headers: {} }, missing, () => assert.fail("missing session should not continue"));
  assert.equal(missing.statusCode, 401);

  const unknown = responseDouble();
  await middleware(
    { headers: { cookie: "rivt_session=2d89c725-9409-4493-96ea-b369c0b28425" } },
    unknown,
    () => assert.fail("unknown session should not continue"),
  );
  assert.equal(unknown.statusCode, 401);
});

test("authenticated-user middleware attaches verified actor", async () => {
  const user = { id: "user-1", role: "contractor" };
  const middleware = createRequireAuthenticatedUser({
    databaseAvailable: () => true,
    findUserBySessionId: async () => user,
    cookieName: "rivt_session",
  });
  const request = { headers: { cookie: "rivt_session=2d89c725-9409-4493-96ea-b369c0b28425" } };
  let called = false;
  await middleware(request, responseDouble(), () => { called = true; });
  assert.equal(called, true);
  assert.equal(request.authUser, user);
});
