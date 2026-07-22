import assert from "node:assert/strict";
import test from "node:test";
import { legacyIntegrationInternals } from "../server/legacy-integrations.js";
import { newsInternals } from "../server/news.js";
import {
  createDurableRateLimiter,
  createOriginGuard,
  createRateLimiter,
  createRequireAuthenticatedUser,
  isAllowedOrigin,
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
    },
    {
      headline: "Florida contractor permit project update",
      summary: "Duplicate title from another syndication URL.",
      source: "Source C",
      url: "https://source-c.example/duplicate",
      publishedAt,
    },
  ];
  const ranked = newsInternals._dedupeAndDiversify(items, 5);
  assert.equal(ranked.length, 5);
  assert.equal(ranked[0].source, "Source B");
  assert.ok(ranked.some((item) => item.source === "Source A"));
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

test("invoice send validation rejects bad recipients and throttles repeated sends", () => {
  const normalizePhoneNumber = (value) => String(value ?? "").replace(/[^\d+]/g, "");
  const base = {
    appName: "RIVT",
    channel: "email",
    recipient: "customer@example.com",
    subject: "Invoice",
    text: "Please see attached invoice.",
    normalizePhoneNumber,
  };

  assert.equal(legacyIntegrationInternals.validateInvoiceSendPayload(base).ok, true);
  assert.equal(legacyIntegrationInternals.validateInvoiceSendPayload({ ...base, recipient: "bad" }).ok, false);
  assert.equal(legacyIntegrationInternals.validateInvoiceSendPayload({ ...base, subject: "x".repeat(121) }).ok, false);
  assert.equal(legacyIntegrationInternals.validateInvoiceSendPayload({ ...base, text: "x".repeat(4001) }).ok, false);
  assert.equal(legacyIntegrationInternals.validateInvoiceSendPayload({
    ...base,
    channel: "sms",
    recipient: "(904) 555-0199",
  }).ok, true);

  legacyIntegrationInternals.invoiceSendWindows.clear();
  const now = Date.now();
  for (let i = 0; i < legacyIntegrationInternals.INVOICE_SEND_MAX_PER_RECIPIENT; i += 1) {
    assert.equal(legacyIntegrationInternals.recordInvoiceRecipientSend({
      accountId: "acct-1",
      channel: "email",
      recipient: "customer@example.com",
      now,
    }).ok, true);
  }
  assert.equal(legacyIntegrationInternals.recordInvoiceRecipientSend({
    accountId: "acct-1",
    channel: "email",
    recipient: "customer@example.com",
    now,
  }).ok, false);
  legacyIntegrationInternals.invoiceSendWindows.clear();
});
