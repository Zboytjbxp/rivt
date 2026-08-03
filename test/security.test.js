import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { extname, join, relative } from "node:path";
import test from "node:test";
import {
  configureHttpServer,
  createDependencyHealthProbe,
  createGracefulShutdown,
  serviceHealthReady,
} from "../server/http-server-safety.js";
import {
  pruneExpiredIdempotencyKeys,
  runLeasedDatabaseMaintenance,
  startDatabaseMaintenance,
} from "../server/database-maintenance.js";
import { newsInternals } from "../server/news.js";
import { newsContinuityInternals } from "../server/news-continuity.js";
import {
  createMultipartUploadLimits,
  DEFAULT_MULTIPART_LIMITS,
} from "../server/upload-safety.js";
import {
  DEFAULT_PROVIDER_TIMEOUT_MS,
  MAX_PROVIDER_TIMEOUT_MS,
  MIN_PROVIDER_TIMEOUT_MS,
  providerAbortSignal,
  providerTimeoutMs,
} from "../server/provider-safety.js";
import {
  createDurableRateLimiter,
  createOriginGuard,
  createRateLimiter,
  createRequireAuthenticatedUser,
  isAllowedOrigin,
  loginEmailRateLimitSubject,
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

function executableOperationsFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) return executableOperationsFiles(fullPath);
    return [fullPath];
  });
}

test("operator tooling cannot enumerate an entire Railway service environment", () => {
  const repositoryRoot = process.cwd();
  const roots = [
    join(repositoryRoot, "scripts"),
    join(repositoryRoot, ".github", "workflows"),
  ];
  const executableExtensions = new Set([".js", ".mjs", ".cjs", ".yml", ".yaml"]);
  const forbiddenEnumeration = /\brailway(?:\.exe)?\s+(?:variable|variables|var)\s+(?:list|ls)\b/i;
  const offenders = roots
    .flatMap((root) => executableOperationsFiles(root))
    .filter((file) => executableExtensions.has(extname(file)))
    .filter((file) => forbiddenEnumeration.test(readFileSync(file, "utf8")))
    .map((file) => relative(repositoryRoot, file));

  assert.deepEqual(
    offenders,
    [],
    `Executable tooling must request named Railway values instead of enumerating a full environment: ${offenders.join(", ")}`,
  );
});

test("Gate A does not duplicate pull-request verification on codex branch pushes", () => {
  const workflow = readFileSync(
    join(process.cwd(), ".github", "workflows", "gate-a.yml"),
    "utf8",
  );

  assert.doesNotMatch(workflow, /^\s*-\s*["']?codex\/\*\*["']?\s*$/m);
});

function flushAsyncWork() {
  return new Promise((resolve) => setImmediate(resolve));
}

test("multipart uploads bound files, fields, headers, and aggregate parts", () => {
  const limits = createMultipartUploadLimits(10 * 1024 * 1024);

  assert.deepEqual(limits, {
    ...DEFAULT_MULTIPART_LIMITS,
    fileSize: 10 * 1024 * 1024,
  });
  assert.equal(limits.files, 1);
  assert.ok(limits.fields <= 8);
  assert.ok(limits.parts <= 10);
  assert.throws(() => createMultipartUploadLimits(0), /positive safe integer/);
});

test("outbound provider calls use a bounded timeout", () => {
  assert.equal(providerTimeoutMs(""), DEFAULT_PROVIDER_TIMEOUT_MS);
  assert.equal(providerTimeoutMs(String(MIN_PROVIDER_TIMEOUT_MS)), MIN_PROVIDER_TIMEOUT_MS);
  assert.equal(providerTimeoutMs(String(MAX_PROVIDER_TIMEOUT_MS)), MAX_PROVIDER_TIMEOUT_MS);
  assert.equal(providerTimeoutMs("999"), DEFAULT_PROVIDER_TIMEOUT_MS);
  assert.equal(providerTimeoutMs("30001"), DEFAULT_PROVIDER_TIMEOUT_MS);
  assert.equal(providerTimeoutMs("not-a-number"), DEFAULT_PROVIDER_TIMEOUT_MS);
  assert.ok(providerAbortSignal("1500") instanceof AbortSignal);
});

test("database maintenance prunes expired idempotency rows in bounded batches", async () => {
  const calls = [];
  const database = {
    async query(sql, params) {
      calls.push({ sql, params });
      return { rowCount: 3, rows: [{ id: "1" }, { id: "2" }, { id: "3" }] };
    },
  };

  assert.equal(await pruneExpiredIdempotencyKeys(database, 50_000), 3);
  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /expires_at <= now\(\)/);
  assert.match(calls[0].sql, /LIMIT \$1/);
  assert.deepEqual(calls[0].params, [1_000]);
});

test("database maintenance starts once and can be stopped", async () => {
  let calls = 0;
  const client = {
    async query(sql) {
      if (sql === "BEGIN" || sql === "COMMIT") return { rows: [] };
      if (/pg_try_advisory_xact_lock/i.test(sql)) return { rows: [{ acquired: true }] };
      calls += 1;
      return { rowCount: 0, rows: [] };
    },
    release() {},
  };
  const database = {
    async connect() {
      return client;
    },
  };

  const stop = startDatabaseMaintenance(database, { intervalMs: 60_000 });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls, 1);
  await stop();
});

test("database maintenance uses one cross-process advisory lease per overlapping cycle", async () => {
  let lockHeld = false;
  let releasePrune;
  let firstPruneStarted;
  const firstPruneReady = new Promise((resolve) => {
    firstPruneStarted = resolve;
  });
  const pruneGate = new Promise((resolve) => {
    releasePrune = resolve;
  });
  const clients = [];
  const database = {
    async connect() {
      const client = {
        released: false,
        async query(sql) {
          if (sql === "BEGIN") return { rows: [] };
          if (/pg_try_advisory_xact_lock/i.test(sql)) {
            if (lockHeld) return { rows: [{ acquired: false }] };
            lockHeld = true;
            return { rows: [{ acquired: true }] };
          }
          if (sql === "COMMIT" || sql === "ROLLBACK") {
            lockHeld = false;
            return { rows: [] };
          }
          throw new Error(`Unexpected SQL: ${sql}`);
        },
        release() {
          this.released = true;
        },
      };
      clients.push(client);
      return client;
    },
  };

  const first = runLeasedDatabaseMaintenance(database, {
    prune: async () => {
      firstPruneStarted();
      await pruneGate;
      return 3;
    },
  });
  await firstPruneReady;
  const second = await runLeasedDatabaseMaintenance(database, {
    prune: async () => {
      throw new Error("The second contender must not run maintenance.");
    },
  });
  assert.equal(second.acquired, false);
  assert.equal(second.pruned, 0);
  assert.ok(second.durationMs >= 0);
  releasePrune();
  const winner = await first;
  assert.equal(winner.acquired, true);
  assert.equal(winner.pruned, 3);
  assert.ok(winner.durationMs >= 0);
  assert.ok(clients.every((client) => client.released));
});

test("database maintenance shutdown waits for the active leased cycle", async () => {
  let resolveCycle;
  let cycleStarted;
  const started = new Promise((resolve) => {
    cycleStarted = resolve;
  });
  const cycle = new Promise((resolve) => {
    resolveCycle = resolve;
  });
  const stop = startDatabaseMaintenance({ query() {} }, {
    intervalMs: 60_000,
    runCycle: async () => {
      cycleStarted();
      return cycle;
    },
  });
  await started;
  let stopped = false;
  const stopping = stop().then(() => {
    stopped = true;
  });
  await flushAsyncWork();
  assert.equal(stopped, false);
  resolveCycle({ acquired: true, pruned: 0, durationMs: 1 });
  await stopping;
  assert.equal(stopped, true);
});

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
  guard({ method: "POST", get: (name) => name === "origin" ? "https://attacker.example" : null }, response, () => { nextCalled = true; });
  assert.equal(nextCalled, false);
  assert.equal(response.statusCode, 403);

  guard({ method: "GET", get: (name) => name === "origin" ? "https://attacker.example" : null }, responseDouble(), () => { nextCalled = true; });
  assert.equal(nextCalled, true);
});

test("origin guard uses Fetch Metadata and Referer while preserving exact callback exemptions", () => {
  const guard = createOriginGuard(["https://rivt.pro"], {
    exemptPaths: ["/api/auth/apple/callback"],
  });
  const crossSite = responseDouble();
  guard({
    method: "POST",
    originalUrl: "/api/v1/profile",
    get: (name) => name === "sec-fetch-site" ? "cross-site" : null,
  }, crossSite, () => assert.fail("cross-site request should not continue"));
  assert.equal(crossSite.statusCode, 403);

  let referred = false;
  guard({
    method: "PATCH",
    originalUrl: "/api/v1/profile",
    get: (name) => name === "referer" ? "https://rivt.pro/app/settings" : null,
  }, responseDouble(), () => { referred = true; });
  assert.equal(referred, true);

  const badReferer = responseDouble();
  guard({
    method: "PATCH",
    originalUrl: "/api/v1/profile",
    get: (name) => name === "referer" ? "https://rivt.pro.attacker.example/app" : null,
  }, badReferer, () => assert.fail("foreign Referer should not continue"));
  assert.equal(badReferer.statusCode, 403);

  let callbackReached = false;
  guard({
    method: "POST",
    originalUrl: "/api/auth/apple/callback",
    get: (name) => name === "sec-fetch-site" ? "cross-site" : null,
  }, responseDouble(), () => { callbackReached = true; });
  assert.equal(callbackReached, true);
});

test("dev origin matcher allows localhost ports but still rejects arbitrary origins", () => {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "test";
  try {
    assert.equal(isAllowedOrigin("http://127.0.0.1:5188", ["https://rivt.pro"]), true);
    assert.equal(isAllowedOrigin("http://localhost:4174", ["https://rivt.pro"]), true);
    assert.equal(isAllowedOrigin("https://attacker.example", ["https://rivt.pro"]), false);
  } finally {
    process.env.NODE_ENV = previousNodeEnv;
  }
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

test("in-memory rate limiter validates configuration and bounds actor cardinality", () => {
  assert.throws(
    () => createRateLimiter({ windowMs: 0, max: 1 }),
    /windowMs must be a positive safe integer/,
  );
  assert.throws(
    () => createRateLimiter({ windowMs: 60_000, max: Number.NaN }),
    /max must be a positive safe integer/,
  );

  let now = 1_000;
  const limiter = createRateLimiter({
    windowMs: 60_000,
    max: 1,
    maxEntries: 2,
    clock: () => now,
    namespace: "bounded-test",
  });
  const hit = (ip) => {
    const response = responseDouble();
    let continued = false;
    limiter({ ip, method: "GET", socket: {} }, response, () => { continued = true; });
    return { continued, response };
  };

  assert.equal(hit("198.51.100.1").continued, true);
  assert.equal(hit("198.51.100.1").response.statusCode, 429);
  assert.equal(hit("198.51.100.2").continued, true);
  assert.equal(hit("198.51.100.3").continued, true);
  assert.equal(hit("198.51.100.1").continued, true);

  now += 60_001;
  assert.equal(hit("198.51.100.2").continued, true);
});

test("durable rate limiter uses shared storage and headers", async () => {
  let requestCount = 0;
  const database = {
    async query(sql, params) {
      if (sql.includes("DELETE FROM rate_limit_windows")) {
        assert.deepEqual(params, [250]);
        return { rows: [] };
      }
      requestCount += 1;
      assert.equal(params[0], "durable-test");
      assert.equal(typeof params[1], "string");
      assert.equal(params[1].length, 64);
      return { rows: [{ request_count: requestCount, expires_at: new Date(Date.now() + 60_000) }] };
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

test("durable rate limiter fails closed on invalid configuration", () => {
  const database = { query: async () => ({ rows: [] }) };
  const base = {
    database,
    databaseAvailable: () => true,
    windowMs: 60_000,
    max: 2,
  };

  assert.throws(() => createDurableRateLimiter({ ...base, windowMs: 0 }), /windowMs/);
  assert.throws(() => createDurableRateLimiter({ ...base, max: Number.NaN }), /max/);
  assert.throws(() => createDurableRateLimiter({ ...base, clock: "now" }), /clock/);
  assert.throws(() => createDurableRateLimiter({ ...base, cleanupMaxBatches: 0 }), /cleanupMaxBatches/);
  assert.throws(() => createDurableRateLimiter({ ...base, cleanupTimeBudgetMs: 0 }), /cleanupTimeBudgetMs/);
  assert.throws(() => createDurableRateLimiter({ ...base, cleanupClock: "now" }), /cleanupClock/);
});

test("login email limiter normalizes and hashes the targeted account without exposing email", async () => {
  const subjectHashes = [];
  const database = {
    async query(sql, params) {
      if (sql.includes("DELETE FROM rate_limit_windows")) return { rows: [] };
      subjectHashes.push(params[1]);
      return { rows: [{ request_count: 1, expires_at: new Date(Date.now() + 60_000) }] };
    },
  };
  const limiter = createDurableRateLimiter({
    database,
    databaseAvailable: () => true,
    windowMs: 60_000,
    max: 10,
    namespace: "auth-login-account-test",
    subject: loginEmailRateLimitSubject,
  });

  assert.equal(
    loginEmailRateLimitSubject({ body: { email: "  Crew.Lead@Example.TEST " } }),
    "login-email:crew.lead@example.test",
  );
  assert.equal(loginEmailRateLimitSubject({ body: {} }), "login-email:missing");

  for (const email of [" Crew.Lead@Example.TEST ", "crew.lead@example.test", "other@example.test"]) {
    await limiter({ body: { email }, headers: {}, socket: {} }, responseDouble(), () => {});
  }

  assert.equal(subjectHashes.length, 3);
  assert.equal(subjectHashes[0], subjectHashes[1]);
  assert.notEqual(subjectHashes[1], subjectHashes[2]);
  for (const value of subjectHashes) {
    assert.match(value, /^[0-9a-f]{64}$/);
    assert.doesNotMatch(value, /example|crew|other/i);
  }
});

test("durable limiter performs shared, infrequent, bounded expired-window cleanup", async () => {
  let now = 1_000;
  const cleanupQueries = [];
  const database = {
    async query(sql, params) {
      if (sql.includes("DELETE FROM rate_limit_windows")) {
        cleanupQueries.push({ sql, params });
        return { rows: [] };
      }
      return { rows: [{ request_count: 1, expires_at: new Date(now + 60_000) }] };
    },
  };
  const options = {
    database,
    databaseAvailable: () => true,
    windowMs: 60_000,
    max: 10,
    cleanupIntervalMs: 60_000,
    cleanupBatchSize: 3,
    clock: () => now,
  };
  const firstLimiter = createDurableRateLimiter({ ...options, namespace: "cleanup-a" });
  const secondLimiter = createDurableRateLimiter({ ...options, namespace: "cleanup-b" });
  const request = { ip: "127.0.0.1", headers: {}, socket: {} };

  await firstLimiter(request, responseDouble(), () => {});
  await secondLimiter(request, responseDouble(), () => {});
  assert.equal(cleanupQueries.length, 1);

  now += 59_999;
  await firstLimiter(request, responseDouble(), () => {});
  assert.equal(cleanupQueries.length, 1);

  now += 2;
  await secondLimiter(request, responseDouble(), () => {});
  assert.equal(cleanupQueries.length, 2);
  for (const cleanup of cleanupQueries) {
    assert.deepEqual(cleanup.params, [3]);
    assert.match(cleanup.sql, /LIMIT \$1/);
    assert.match(cleanup.sql, /target\.expires_at <= now\(\)/);
  }
});

test("durable limiter drains multiple cleanup batches but caps work and retries backlog early", async () => {
  let now = 1_000;
  const cleanupQueries = [];
  const database = {
    async query(sql, params) {
      if (sql.includes("DELETE FROM rate_limit_windows")) {
        cleanupQueries.push({ sql, params });
        return { rowCount: 3, rows: [] };
      }
      return { rows: [{ request_count: 1, expires_at: new Date(now + 60_000) }] };
    },
  };
  const limiter = createDurableRateLimiter({
    database,
    databaseAvailable: () => true,
    windowMs: 60_000,
    max: 10,
    cleanupIntervalMs: 15 * 60_000,
    cleanupBatchSize: 3,
    cleanupMaxBatches: 2,
    cleanupTimeBudgetMs: 1_000,
    cleanupClock: () => now,
    clock: () => now,
  });
  const request = { ip: "127.0.0.1", headers: {}, socket: {} };

  await limiter(request, responseDouble(), () => {});
  await flushAsyncWork();
  assert.equal(cleanupQueries.length, 2);

  now += 59_999;
  await limiter(request, responseDouble(), () => {});
  assert.equal(cleanupQueries.length, 2);

  now += 2;
  await limiter(request, responseDouble(), () => {});
  await flushAsyncWork();
  assert.equal(cleanupQueries.length, 4);
  for (const cleanup of cleanupQueries) {
    assert.deepEqual(cleanup.params, [3]);
    assert.match(cleanup.sql, /LIMIT \$1/);
  }
});

test("durable limiter stops cleanup draining when its elapsed-time budget is spent", async () => {
  let now = 1_000;
  let cleanupNow = 0;
  let cleanupQueries = 0;
  const database = {
    async query(sql) {
      if (sql.includes("DELETE FROM rate_limit_windows")) {
        cleanupQueries += 1;
        cleanupNow += 6;
        return { rowCount: 2, rows: [] };
      }
      return { rows: [{ request_count: 1, expires_at: new Date(now + 60_000) }] };
    },
  };
  const limiter = createDurableRateLimiter({
    database,
    databaseAvailable: () => true,
    windowMs: 60_000,
    max: 10,
    cleanupBatchSize: 2,
    cleanupMaxBatches: 8,
    cleanupTimeBudgetMs: 10,
    cleanupClock: () => cleanupNow,
    clock: () => now,
  });

  await limiter({ ip: "127.0.0.1", headers: {}, socket: {} }, responseDouble(), () => {});
  await flushAsyncWork();

  assert.equal(cleanupQueries, 2);
});

test("durable limiter cleanup stays off the request path and shares one in-flight drain", async () => {
  let now = 1_000;
  let cleanupQueries = 0;
  let releaseCleanup;
  const blockedCleanup = new Promise((resolve) => {
    releaseCleanup = resolve;
  });
  const database = {
    async query(sql) {
      if (sql.includes("DELETE FROM rate_limit_windows")) {
        cleanupQueries += 1;
        return blockedCleanup;
      }
      return { rows: [{ request_count: 1, expires_at: new Date(now + 60_000) }] };
    },
  };
  const limiter = createDurableRateLimiter({
    database,
    databaseAvailable: () => true,
    windowMs: 60_000,
    max: 10,
    cleanupIntervalMs: 60_000,
    cleanupBatchSize: 2,
    cleanupMaxBatches: 2,
    cleanupTimeBudgetMs: 1_000,
    cleanupClock: () => now,
    clock: () => now,
  });
  const request = { ip: "127.0.0.1", headers: {}, socket: {} };
  let firstContinued = false;

  const firstRequest = limiter(request, responseDouble(), () => {
    firstContinued = true;
  });
  await flushAsyncWork();
  const firstContinuedBeforeCleanup = firstContinued;
  const cleanupQueriesAfterFirstRequest = cleanupQueries;

  now += 60_001;
  let secondContinued = false;
  const secondRequest = limiter(request, responseDouble(), () => {
    secondContinued = true;
  });
  await flushAsyncWork();
  const secondContinuedWhileCleanupInFlight = secondContinued;
  const cleanupQueriesWhileInFlight = cleanupQueries;

  releaseCleanup({ rowCount: 0, rows: [] });
  await Promise.all([firstRequest, secondRequest]);
  await flushAsyncWork();

  assert.equal(firstContinuedBeforeCleanup, true);
  assert.equal(cleanupQueriesAfterFirstRequest, 1);
  assert.equal(secondContinuedWhileCleanupInFlight, true);
  assert.equal(cleanupQueriesWhileInFlight, 1);
});

test("account-targeted limiter preserves the generic throttling response", async () => {
  let requestCount = 0;
  const database = {
    async query(sql) {
      if (sql.includes("DELETE FROM rate_limit_windows")) return { rows: [] };
      requestCount += 1;
      return { rows: [{ request_count: requestCount, expires_at: new Date(Date.now() + 60_000) }] };
    },
  };
  const limiter = createDurableRateLimiter({
    database,
    databaseAvailable: () => true,
    windowMs: 60_000,
    max: 1,
    namespace: "auth-login-account-generic-test",
    subject: loginEmailRateLimitSubject,
  });
  const request = { body: { email: "target@example.test" }, headers: {}, socket: {} };

  await limiter(request, responseDouble(), () => {});
  const blocked = responseDouble();
  await limiter(request, blocked, () => assert.fail("limited account should not continue"));

  assert.equal(blocked.statusCode, 429);
  assert.deepEqual(blocked.body, {
    ok: false,
    error: "Too many requests. Try again shortly.",
  });
  assert.doesNotMatch(JSON.stringify(blocked.body), /target@example\.test/);
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

test("news query validation and cache pruning bound anonymous amplification", () => {
  const normalized = newsInternals._normalizeNewsLocation("  Jacksonville,   FL  ");
  assert.equal(normalized.ok, true);
  assert.equal(normalized.cacheKey, "jacksonville, fl");

  assert.equal(newsInternals._normalizeNewsLocation("x".repeat(newsInternals.NEWS_LOCATION_MAX_LENGTH + 1)).ok, false);
  assert.equal(newsInternals._normalizeNewsLocation("Jacksonville<script>").ok, false);

  newsInternals.newsCache.clear();
  const now = Date.now();
  for (let i = 0; i < newsInternals.NEWS_CACHE_MAX_ENTRIES + 7; i += 1) {
    newsInternals.newsCache.set(`location-${i}`, { items: [], fetchedAt: now + i });
  }
  newsInternals._pruneNewsCache(now + 10);
  assert.equal(newsInternals.newsCache.size, newsInternals.NEWS_CACHE_MAX_ENTRIES);
  assert.equal(newsInternals.newsCache.has("location-0"), false);
  newsInternals.newsCache.clear();
});

test("Trade News continuity validates preferences and loss-safe legacy saves", () => {
  const preference = newsContinuityInternals.preferenceSchema.parse({
    scope: "local",
    location: "Jacksonville, FL",
    category: "Safety",
    trade: "Electrical",
    followedTrades: ["Electrical"],
    followedTopics: ["Safety & OSHA"],
    expectedVersion: 0,
  });
  assert.equal(preference.expectedVersion, 0);
  assert.deepEqual(
    newsContinuityInternals.uniqueStrings(["Electrical", " Electrical ", "HVAC"]),
    ["Electrical", "HVAC"],
  );
  const legacySave = newsContinuityInternals.savedArticleSchema.parse({
    url: "https://example.com/news",
    headline: "",
    source: "",
  });
  assert.equal(legacySave.headline, "");
  assert.equal(legacySave.source, "");
});

test("trade news canonicalizes URLs, deduplicates titles, and diversifies sources", () => {
  assert.equal(
    newsInternals._canonicalArticleUrl("https://www.example.com/story/?utm_source=rivt&fbclid=123#details"),
    "https://example.com/story",
  );

  const publishedAt = new Date().toISOString();
  const items = [
    ...Array.from({ length: 5 }, (_, index) => ({
      headline: `Construction safety update number ${index}`,
      summary: "Contractor construction safety and jobsite work.",
      source: "Source A",
      url: `https://source-a.example/story-${index}?utm_source=test`,
      publishedAt,
    })),
    {
      headline: "Florida contractor permit project update",
      summary: "Jacksonville construction permit and contractor project.",
      source: "Source B",
      url: "https://source-b.example/local",
      publishedAt,
      isLocal: true,
      category: "Construction",
    },
    {
      headline: "Florida contractor permit project update",
      summary: "Duplicate title from another syndication URL.",
      source: "Source C",
      url: "https://source-c.example/duplicate",
      publishedAt,
      category: "Construction",
    },
    {
      headline: "New apprenticeship and workforce wage report",
      summary: "Construction labor and skilled trades apprenticeship report.",
      source: "Source D",
      url: "https://source-d.example/labor",
      publishedAt,
      category: "Labor",
    },
  ];
  const ranked = newsInternals._dedupeAndDiversify(items, 6);
  assert.equal(ranked.length, 6);
  assert.ok(ranked.some((item) => item.source === "Source A"));
  assert.ok(ranked.some((item) => item.category === "Labor"));
  assert.equal(ranked.filter((item) => item.headline === "Florida contractor permit project update").length, 1);
  assert.ok(ranked.every((item) => item.canonicalUrl && !item.canonicalUrl.includes("utm_source")));
});

test("trade news images accept public RSS media and reject local or decorative URLs", () => {
  assert.equal(
    newsInternals._rssThumbnailUrl({ "media:content": { "@_url": "https://cdn.example.com/jobsite.jpg" } }, "https://example.com/story"),
    "https://cdn.example.com/jobsite.jpg",
  );
  assert.equal(newsInternals._resolvePublicImageUrl("http://127.0.0.1/private.jpg"), null);
  assert.equal(newsInternals._resolvePublicImageUrl("https://example.com/favicon.ico"), null);
});

test("trade news article enrichment rejects hostnames resolving to private networks", async () => {
  assert.equal(newsInternals._isPublicNetworkAddress("8.8.8.8"), true);
  assert.equal(newsInternals._isPublicNetworkAddress("127.0.0.1"), false);
  assert.equal(newsInternals._isPublicNetworkAddress("169.254.169.254"), false);
  assert.equal(newsInternals._isPublicNetworkAddress("::1"), false);

  const blocked = await newsInternals._resolvePublicNetworkUrl(
    "https://article.example/story",
    undefined,
    async () => [{ address: "127.0.0.1", family: 4 }],
  );
  assert.equal(blocked, null);

  let fetched = false;
  const image = await newsInternals._fetchArticleImage("https://article.example/story", {
    lookup: async () => [{ address: "169.254.169.254", family: 4 }],
    fetchImpl: async () => {
      fetched = true;
      throw new Error("must not fetch");
    },
  });
  assert.equal(image, null);
  assert.equal(fetched, false);
});

test("trade news assigns useful trade filters without inventing a specialty", () => {
  assert.deepEqual(
    newsInternals._trades({
      headline: "Electrical and HVAC contractors prepare for code changes",
      summary: "New NEC and refrigerant requirements affect field work.",
    }),
    ["Electrical", "HVAC"],
  );
  assert.deepEqual(
    newsInternals._trades({
      headline: "Construction employment report",
      summary: "Skilled trade businesses added jobs this month.",
    }),
    ["General construction"],
  );
});

test("trade news distinguishes concrete permitted projects from permit policy", () => {
  const civicCenter = {
    headline: "Miami secures $193M permit to build civic center at Freedom Park",
    summary: "The project will construct a new public complex.",
  };
  const permitPolicy = {
    headline: "Florida HB 803 drops permitting for small building projects",
    summary: "The reform eliminates a permit requirement below the new threshold.",
  };
  const licensing = {
    headline: "DBPR opens contractor license renewal window",
    summary: "Licensed contractors can submit renewal forms.",
  };
  const droppingPermitPolicy = {
    headline: "Florida Governor Signs Bill Dropping Building Permits for Work Valued at $7,500 or Less",
    summary: "The law changes when a permit is required.",
  };
  assert.equal(newsInternals._category(civicCenter), "Projects");
  assert.equal(newsInternals._category(permitPolicy), "Codes");
  assert.equal(newsInternals._category(licensing), "Codes");
  assert.equal(newsInternals._category(droppingPermitPolicy), "Codes");
  assert.equal(newsInternals._topics(civicCenter)[0], "Projects & development");
  assert.equal(newsInternals._topics(civicCenter).includes("Permits & inspections"), false);
  assert.ok(newsInternals._topics(permitPolicy).includes("Permits & inspections"));
  assert.ok(newsInternals._topics(licensing).includes("Licensing & regulation"));
});

test("trade news exposes transparent topics, impact, and related-source clusters", () => {
  assert.deepEqual(
    newsInternals._topics({
      headline: "OSHA updates electrical inspection rule",
      summary: "Contractors face a new permit inspection requirement.",
    }),
    ["Safety & OSHA", "Permits & inspections", "Licensing & regulation"],
  );
  assert.equal(newsInternals._impact({
    headline: "Equipment recall requires immediate stop work",
    summary: "A safety recall affects jobsites.",
    publishedAt: new Date().toISOString(),
  }).level, "critical");
  const clustered = newsInternals._clusterStories([
    { headline: "OSHA heat enforcement changes afternoon jobsite planning", summary: "", source: "OSHA", url: "https://osha.gov/a" },
    { headline: "OSHA heat enforcement changes jobsite planning nationwide", summary: "", source: "Trade Desk", url: "https://example.com/b" },
  ]);
  assert.equal(clustered.length, 1);
  assert.equal(clustered[0].relatedSourceCount, 2);
});

test("trade news cleans Google publisher suffixes and collapses the HB 803 story family", () => {
  assert.equal(
    newsInternals._cleanHeadline(
      "Florida Law Removes Permits for Small Home Construction Projects - Construction Owners",
      "Construction Owners",
    ),
    "Florida Law Removes Permits for Small Home Construction Projects",
  );
  assert.equal(
    newsInternals._cleanHeadline("Contractor costs rise - What builders need to know", "Trade Desk"),
    "Contractor costs rise - What builders need to know",
  );
  assert.equal(
    newsInternals._cleanSummary(
      "Jax Inspector General finds Duval Schools&#8217; kitchen construction violated code &nbsp;&nbsp; Florida Politics",
      "Jax Inspector General finds Duval Schools’ kitchen construction violated code",
      "Florida Politics",
    ),
    "",
  );
  assert.equal(
    newsInternals._decodeHtmlEntities("&ldquo;Safer jobsites&rdquo; &amp; better records"),
    "“Safer jobsites” & better records",
  );

  const publishedAt = "2026-05-10T12:00:00.000Z";
  const base = {
    summary: "Florida HB 803 changes permit requirements for small construction projects.",
    publishedAt,
    category: "Codes",
    geography: "local",
    isLocal: true,
    sourceKind: "publisher",
  };
  const rawItems = [
    ["Florida Law Removes Permits for Small Home Construction Projects - Construction Owners", "Construction Owners", "https://constructionowners.com/hb-803"],
    ["Florida Law Removes Permits for Small Home Construction Projects - constructionowners.com", "constructionowners.com", "https://constructionowners.com/news/hb-803-copy"],
    ["Florida HB 803 drops permitting for small residential projects - ENR", "ENR", "https://enr.com/florida-hb-803"],
    ["New Florida law cuts permit fees for minor home construction - NBC 6 South Florida", "NBC 6 South Florida", "https://nbcmiami.com/news/hb803"],
    ["Florida contractors can drop building permits under HB 803 - Insurance Journal", "Insurance Journal", "https://insurancejournal.com/hb-803"],
    ["Goodbye to these Florida permits as HB 803 takes effect - Florida Politics", "Florida Politics", "https://floridapolitics.com/hb803"],
    ["CS/HB 803 removes select building permits across Florida - Florida House", "Florida House", "https://myfloridahouse.gov/hb803"],
  ].map(([rawHeadline, source, url], index) => ({
    ...base,
    summary: index < 2
      ? "Florida permit law coverage for small home construction projects."
      : base.summary,
    headline: newsInternals._cleanHeadline(rawHeadline, source),
    source,
    url,
    sourceKind: source === "Florida House" ? "official" : "publisher",
  }));
  rawItems.push(
    {
      ...base,
      summary: "",
      headline: "Florida Governor Signs Bill Dropping Building Permit Requirements for Work Valued at $7,500 or Less",
      source: "Insurance Journal",
      url: "https://insurancejournal.com/florida-permit-threshold",
    },
    {
      ...base,
      summary: "",
      headline: "Florida Enacts New Law Affecting Building Permits and Inspections",
      source: "Program Business",
      url: "https://programbusiness.com/florida-permit-law",
    },
  );

  const deduped = newsInternals._dedupeAndDiversify(rawItems, 30);
  assert.equal(new Set(deduped.map((item) => newsInternals._normalizedTitle(item.headline))).size, deduped.length);
  const clustered = newsInternals._clusterStories(deduped);
  assert.equal(clustered.length, 1);
  assert.ok(clustered[0].relatedSourceCount >= 5);
  assert.equal(clustered[0].source, "Florida House");
});

test("trade news category fill caps one category while alternatives remain", () => {
  const publishedAt = new Date().toISOString();
  const items = [
    ...Array.from({ length: 8 }, (_, index) => ({
      headline: `Florida permit rule item ${index} has distinct details`,
      summary: "Construction permits and inspections.",
      source: `Codes Source ${index}`,
      url: `https://codes-${index}.example/story`,
      category: "Codes",
      publishedAt,
    })),
    ...["Safety", "Labor", "Projects", "Business"].map((category, index) => ({
      headline: `${category} construction briefing has distinct field signal`,
      summary: "Current skilled trade coverage.",
      source: `${category} Source`,
      url: `https://${category.toLowerCase()}.example/story-${index}`,
      category,
      publishedAt,
    })),
  ];
  const selected = newsInternals._dedupeAndDiversify(items, 10);
  assert.ok(selected.filter((item) => item.category === "Codes").length <= 4);
  assert.ok(new Set(selected.map((item) => item.category)).size >= 4);
});

test("trade news priority requires current dated action signals and stays scarce", () => {
  const now = Date.parse("2026-07-23T12:00:00.000Z");
  assert.deepEqual(newsInternals._impact({
    headline: "Florida contractor license search",
    summary: "Find a license or review general permit information.",
    publishedAt: "",
  }, now), {
    level: "routine",
    reason: "No confirmed publication date; RIVT does not rank it as urgent.",
  });
  assert.equal(newsInternals._impact({
    headline: "Board adopts new electrical rule effective March 1",
    summary: "The requirement applies to permit applications.",
    publishedAt: "2026-07-20T12:00:00.000Z",
  }, now).level, "high");
  assert.equal(newsInternals._impact({
    headline: "Board adopts new electrical rule effective March 1",
    summary: "The requirement applies to permit applications.",
    publishedAt: "2026-03-01T12:00:00.000Z",
  }, now).level, "medium");
  assert.equal(newsInternals._impact({
    headline: "Equipment recall requires immediate stop work",
    summary: "A safety recall affects jobsites.",
    publishedAt: "2026-06-10T12:00:00.000Z",
  }, now).level, "high");

  const capped = newsInternals._applyPriorityScarcity(
    Array.from({ length: 8 }, (_, index) => ({
      headline: `Current enforcement action ${index}`,
      summary: "Construction safety enforcement.",
      url: `https://example.com/${index}`,
      source: `Source ${index}`,
      publishedAt: new Date(now - index * 60_000).toISOString(),
      impactLevel: index % 2 ? "high" : "critical",
    })),
  );
  assert.equal(capped.filter((item) => item.impactLevel === "critical" || item.impactLevel === "high").length, 2);
});

test("trade news separates stale official resources and drops stale publisher news", () => {
  const now = Date.parse("2026-07-23T12:00:00.000Z");
  const partitioned = newsInternals._partitionNewsAndResources([
    {
      headline: "Florida contractor license search",
      source: "myfloridalicense.com",
      url: "https://myfloridalicense.com/license-search",
      publishedAt: "2014-10-08T12:00:00.000Z",
      resourceCandidate: true,
    },
    {
      headline: "Undated Florida building code portal",
      source: "Florida Building Commission",
      url: "https://floridabuilding.org/code",
      publishedAt: "",
      resourceCandidate: true,
    },
    {
      headline: "Old publisher construction story",
      source: "Publisher",
      url: "https://example.com/old",
      publishedAt: "2025-01-01T12:00:00.000Z",
    },
    {
      headline: "Current construction story",
      source: "Publisher",
      url: "https://example.com/current",
      publishedAt: "2026-07-20T12:00:00.000Z",
    },
    {
      headline: "Four-month-old construction project story",
      source: "Publisher",
      url: "https://example.com/120-days-old",
      publishedAt: "2026-03-25T12:00:00.000Z",
    },
  ], now);
  assert.equal(partitioned.news.length, 1);
  assert.equal(partitioned.news[0].headline, "Current construction story");
  assert.equal(partitioned.news.some((item) => item.url.includes("120-days-old")), false);
  assert.equal(partitioned.resources.length, 2);
  assert.ok(partitioned.resources.every((resource) => !("impactLevel" in resource) && !("date" in resource)));
});

test("trade news composes local-first depth with national backfill and no cross-tier duplicates", () => {
  const now = Date.parse("2026-07-23T12:00:00.000Z");
  const makeItem = (id, overrides = {}) => ({
    headline: `Current construction update ${id}`,
    summary: "Current contractor and construction field news.",
    source: `Source ${id}`,
    url: `https://example.com/news/${id}`,
    publishedAt: new Date(now - id * 60_000).toISOString(),
    category: ["Safety", "Codes", "Labor", "Tools", "Business", "Projects"][id % 6],
    impactLevel: "routine",
    sourceKind: "publisher",
    geography: "national",
    isLocal: false,
    ...overrides,
  });
  const local = [
    makeItem(1, { headline: "Jacksonville bridge construction milestone", isLocal: true, geography: "local" }),
    makeItem(2, { headline: "Duval electrical apprenticeship expansion", isLocal: true, geography: "local" }),
    makeItem(3, { headline: "Jacksonville jobsite safety briefing", isLocal: true, geography: "local" }),
  ];
  const national = [
    makeItem(4),
    makeItem(5),
    makeItem(6),
    makeItem(7),
    makeItem(8, {
      headline: local[0].headline,
      url: "https://another.example.com/duplicate-local-story",
    }),
  ];

  const composed = newsInternals._composeTieredNews([...local, ...national], {
    location: "Jacksonville, FL",
    now,
  });

  assert.deepEqual(composed.items.slice(0, 3).map((item) => item.tier), ["local", "local", "local"]);
  assert.ok(composed.items.slice(3).every((item) => item.tier === "national"));
  assert.equal(composed.items.length, 7);
  assert.equal(composed.items.filter((item) => item.headline === local[0].headline).length, 1);
});

test("trade news assigns the national tier when no location is requested", () => {
  const now = Date.parse("2026-07-23T12:00:00.000Z");
  const composed = newsInternals._composeTieredNews([{
    headline: "National construction workforce outlook",
    summary: "Current national skilled trades workforce news.",
    source: "National trade desk",
    url: "https://example.com/national-workforce",
    publishedAt: "2026-07-22T12:00:00.000Z",
    category: "Labor",
    impactLevel: "routine",
  }], { now });
  assert.equal(composed.items.length, 1);
  assert.equal(composed.items[0].tier, "national");
});

test("trade news promotes content-confirmed location matches into the local tier", () => {
  const now = Date.parse("2026-07-23T12:00:00.000Z");
  const signals = newsInternals._locationSignals("Jacksonville, FL");
  assert.deepEqual(signals, {
    city: "jacksonville",
    stateFull: "florida",
    stateAbbr: "fl",
  });
  assert.deepEqual(newsInternals._locationSignals("Jacksonville, Florida"), signals);

  const duvalStory = {
    headline: "Jax Inspector General finds Duval Schools' kitchen construction violates code",
    summary: "The inspector reviewed construction work at district kitchens.",
    source: "Florida Politics",
    url: "https://example.com/duval-schools-kitchen-code",
    publishedAt: "2026-07-23T02:00:00.000Z",
    category: "Codes",
    impactLevel: "routine",
    sourceKind: "publisher",
    geography: "national",
    isLocal: false,
  };
  const unrelatedStory = {
    headline: "BlackRock, Carhartt launch national Skilled-Trades Alliance",
    summary: "The national program supports construction workforce development.",
    source: "National workforce desk",
    url: "https://example.com/national-skilled-trades-alliance",
    publishedAt: "2026-07-22T12:00:00.000Z",
    category: "Labor",
    impactLevel: "routine",
    sourceKind: "publisher",
    geography: "national",
    isLocal: false,
  };

  assert.equal(newsInternals._matchesLocation(duvalStory, signals), true);
  assert.equal(newsInternals._matchesLocation(unrelatedStory, signals), false);
  const composed = newsInternals._composeTieredNews([duvalStory, unrelatedStory], {
    location: "Jacksonville, FL",
    now,
  });
  const promoted = composed.items.find((item) => item.url === duvalStory.url);
  assert.equal(promoted?.tier, "local");
  assert.equal(promoted?.isLocal, true);
  assert.equal(promoted?.geography, "local");
  assert.equal(composed.items.find((item) => item.url === unrelatedStory.url)?.tier, "national");
});

test("trade news does not treat common city words as location matches without their state", () => {
  const signals = newsInternals._locationSignals("Reading, PA");
  const unrelatedReadingStory = {
    headline: "Reading the skilled-trades labor market",
    summary: "A national workforce analysis for construction employers.",
    source: "National trade desk",
  };
  assert.deepEqual(signals, {
    city: "reading",
    stateFull: "pennsylvania",
    stateAbbr: "pa",
  });
  assert.equal(newsInternals._matchesLocation(unrelatedReadingStory, signals), false);
  assert.equal(newsInternals._matchesLocation({
    ...unrelatedReadingStory,
    headline: "Reading, PA contractors prepare for code adoption",
  }, signals), true);
});

test("trade news tidies official resource titles", () => {
  assert.equal(newsInternals._tidyResourceTitle("Product_Approval"), "Product Approval");
  assert.equal(
    newsInternals._tidyResourceTitle("FLORIDA BUILDING CONSTRUCTION STANDARDS"),
    "Florida Building Construction Standards",
  );
  assert.equal(
    newsInternals._tidyResourceTitle("Florida Building Code Residential Advanced Course"),
    "Florida Building Code Residential Advanced Course",
  );
  assert.equal(newsInternals._tidyResourceTitle("OSHA HVAC AND GFCI REQUIREMENTS"), "OSHA HVAC And GFCI Requirements");
});

test("service health requires live dependencies, session security, and completed migrations", () => {
  assert.equal(serviceHealthReady({
    dependenciesOk: true,
    authSecurityOk: true,
    migrationState: "ready",
    requiredProviderOk: false,
  }), false);
  assert.equal(serviceHealthReady({
    dependenciesOk: true,
    authSecurityOk: true,
    migrationState: "ready",
  }), true);
  assert.equal(serviceHealthReady({
    dependenciesOk: false,
    authSecurityOk: true,
    migrationState: "ready",
  }), false);
  assert.equal(serviceHealthReady({
    dependenciesOk: true,
    authSecurityOk: false,
    migrationState: "ready",
  }), false);
  assert.equal(serviceHealthReady({
    dependenciesOk: true,
    authSecurityOk: true,
    migrationState: "pending",
  }), false);
});

test("dependency health uses bounded live probes, coalesces traffic, and redacts failures", async () => {
  let databaseCalls = 0;
  let objectStorageCalls = 0;
  let clock = 1_000;
  const probeResults = [];
  const probe = createDependencyHealthProbe({
    databaseConfigured: true,
    objectStorageConfigured: true,
    probeDatabase: async () => {
      databaseCalls += 1;
    },
    probeObjectStorage: async () => {
      objectStorageCalls += 1;
    },
    timeoutMs: 50,
    successCacheTtlMs: 1_000,
    failureCacheTtlMs: 100,
    now: () => clock,
    onProbe: (result) => probeResults.push(result),
  });

  const [first, concurrent] = await Promise.all([probe(), probe()]);
  assert.deepEqual(first, {
    ok: true,
    live: true,
    database: "postgres",
    objectStorage: "s3-compatible",
  });
  assert.deepEqual(concurrent, first);
  assert.deepEqual(await probe(), first);
  assert.equal(databaseCalls, 1);
  assert.equal(objectStorageCalls, 1);

  clock += 1_001;
  await probe();
  assert.equal(databaseCalls, 2);
  assert.equal(objectStorageCalls, 2);
  assert.deepEqual(probeResults, [
    { databaseOk: true, objectStorageOk: true, durationMs: 0 },
    { databaseOk: true, objectStorageOk: true, durationMs: 0 },
  ]);

  const failedProbe = createDependencyHealthProbe({
    databaseConfigured: true,
    objectStorageConfigured: true,
    probeDatabase: async () => {
      throw new Error("postgresql://user:secret@internal-db/rivt");
    },
    probeObjectStorage: async () => {
      throw new Error("private-bucket-name");
    },
    timeoutMs: 50,
    successCacheTtlMs: 1_000,
    failureCacheTtlMs: 100,
  });
  const failed = await failedProbe();
  assert.deepEqual(failed, {
    ok: false,
    live: true,
    database: "unavailable",
    objectStorage: "unavailable",
  });
  assert.doesNotMatch(JSON.stringify(failed), /secret|bucket|internal-db/);
});

test("dependency health reports missing configuration without provider requests", async () => {
  let calls = 0;
  const probe = createDependencyHealthProbe({
    databaseConfigured: false,
    objectStorageConfigured: false,
    probeDatabase: async () => { calls += 1; },
    probeObjectStorage: async () => { calls += 1; },
    timeoutMs: 50,
    successCacheTtlMs: 1_000,
    failureCacheTtlMs: 100,
  });
  assert.deepEqual(await probe(), {
    ok: false,
    live: true,
    database: "missing",
    objectStorage: "missing",
  });
  assert.equal(calls, 0);
});

test("dependency health returns within its bound when a provider stalls", async () => {
  let storageAbortObserved = false;
  const probe = createDependencyHealthProbe({
    databaseConfigured: true,
    objectStorageConfigured: true,
    probeDatabase: async () => {},
    probeObjectStorage: (signal) => new Promise((resolve) => {
      signal.addEventListener("abort", () => {
        storageAbortObserved = true;
        resolve();
      }, { once: true });
    }),
    timeoutMs: 10,
    successCacheTtlMs: 1_000,
    failureCacheTtlMs: 100,
  });

  const startedAt = Date.now();
  assert.deepEqual(await probe(), {
    ok: false,
    live: true,
    database: "postgres",
    objectStorage: "unavailable",
  });
  assert.equal(storageAbortObserved, true);
  assert.ok(Date.now() - startedAt < 500);
});

test("HTTP server safety applies explicit bounded timeouts", () => {
  const server = {};
  assert.equal(configureHttpServer(server, {
    requestTimeoutMs: 90_000,
    headersTimeoutMs: 12_000,
    keepAliveTimeoutMs: 4_000,
    maxHeadersCount: 80,
    maxRequestsPerSocket: 500,
  }), server);
  assert.equal(server.requestTimeout, 90_000);
  assert.equal(server.headersTimeout, 12_000);
  assert.equal(server.keepAliveTimeout, 4_000);
  assert.equal(server.maxHeadersCount, 80);
  assert.equal(server.maxRequestsPerSocket, 500);
  assert.throws(
    () => configureHttpServer({}, {
      requestTimeoutMs: 5_000,
      headersTimeoutMs: 6_000,
      keepAliveTimeoutMs: 1_000,
    }),
    /cannot exceed/,
  );
});

test("graceful shutdown is idempotent and closes resources once after draining", async () => {
  let closeCallback;
  let closeCalls = 0;
  let idleCloseCalls = 0;
  let resourceCloseCalls = 0;
  const server = {
    listening: true,
    close(callback) {
      closeCalls += 1;
      closeCallback = callback;
    },
    closeIdleConnections() {
      idleCloseCalls += 1;
    },
  };
  const shutdown = createGracefulShutdown({
    getServer: () => server,
    closeResources: async () => {
      resourceCloseCalls += 1;
    },
    timeoutMs: 100,
  });

  const first = shutdown("SIGTERM");
  const second = shutdown("SIGINT");
  assert.equal(first, second);
  assert.equal(closeCalls, 1);
  assert.equal(idleCloseCalls, 1);

  closeCallback();
  assert.deepEqual(await first, { forced: false, signal: "SIGTERM" });
  assert.equal(resourceCloseCalls, 1);
});

test("graceful shutdown force-closes remaining sockets after its deadline", async () => {
  let forceCloseCalls = 0;
  let resourceCloseCalls = 0;
  const server = {
    listening: true,
    close() {},
    closeIdleConnections() {},
    closeAllConnections() {
      forceCloseCalls += 1;
    },
  };
  const shutdown = createGracefulShutdown({
    getServer: () => server,
    closeResources: async () => {
      resourceCloseCalls += 1;
    },
    timeoutMs: 5,
  });

  assert.deepEqual(await shutdown("SIGTERM"), { forced: true, signal: "SIGTERM" });
  assert.equal(forceCloseCalls, 1);
  assert.equal(resourceCloseCalls, 1);
});
