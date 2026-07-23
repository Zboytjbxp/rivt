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
