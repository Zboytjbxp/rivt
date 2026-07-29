import assert from "node:assert/strict";
import test from "node:test";
import {
  assertPublicContentSafe,
  publicContentRisks,
  publicDiscoveryInternals,
} from "../server/public-discovery.js";

test("public content safety catches direct contact and street-address details", () => {
  assert.deepEqual(
    publicContentRisks([
      "Text 904-555-0123 or email crew@example.com.",
      "Meet at 123 Main Street.",
    ]),
    ["email address", "phone number", "street address"],
  );
  assert.throws(
    () => assertPublicContentSafe(["Call 904.555.0123"]),
    (error) => error?.code === "PUBLIC_CONTENT_PRIVATE_DETAILS" && error?.status === 422,
  );
  assert.doesNotThrow(() => assertPublicContentSafe([
    "Jacksonville panel replacement",
    "Replace the damaged service equipment and leave the installation inspection-ready.",
  ]));
});

test("public job projection omits private address, contact, and account identifiers", () => {
  const job = publicDiscoveryInternals.publicJobProjection({
    id: "b2279c8c-58ee-4cf1-b2fa-20c4db1e6c52",
    title: "Commercial panel rough-in",
    organization_name: "RIVT Electric",
    trade_code: "electrical",
    trade_name: "Electrical",
    summary: "Rough in one commercial panel and feeders.",
    scope_description: "Install raceway and conductors to the approved drawings.",
    difficulty: "advanced",
    work_type: "multi_day",
    budget_cents: 240000,
    budget_unit: "fixed",
    compensation_type: "fixed",
    duration_hours: 24,
    preferred_start_date: "2026-08-01",
    application_deadline: "2026-07-31T17:00:00.000Z",
    insurance_required: true,
    public_city: "Jacksonville",
    public_region: "FL",
    public_country_code: "US",
    published_at: "2026-07-26T12:00:00.000Z",
    updated_at: "2026-07-26T12:00:00.000Z",
    address_line1: "123 Private Street",
    postal_code: "32211",
    created_by_account_id: "6a950248-1819-410a-b806-587b073f3534",
  }, [
    { kind: "tool", value: "Conduit bender" },
    { kind: "certification", value: "Journeyman license" },
  ]);

  assert.equal(job.location.city, "Jacksonville");
  assert.equal(job.organization, "RIVT Electric");
  assert.equal(job.requirements.tools[0], "Conduit bender");
  assert.equal("privateLocation" in job, false);
  assert.equal("addressLine1" in job, false);
  assert.equal("createdByAccountId" in job, false);
  assert.doesNotMatch(JSON.stringify(job), /123 Private|32211|6a950248/);
});

test("public Shop Talk projection only includes explicitly supplied public answers", () => {
  const post = publicDiscoveryInternals.publicPostProjection({
    id: "0d908c83-ae92-4a7a-bb67-f9a3956f620d",
    author_name: "Michael",
    trade: "Electrical",
    flair: "Question",
    post_type: "question",
    title: "Best way to verify this disconnect?",
    body: "What sequence would you use?",
    status: "Open",
    created_at: "2026-07-26T12:00:00.000Z",
    updated_at: "2026-07-26T12:00:00.000Z",
    community_slug: "electrical-talk",
    community_name: "Electrical Talk",
    answer_count: 1,
    article_url: "https://example.com/code-update",
    article_source: "Example Trade News",
  }, [{
    id: "6dcf145e-158a-4c22-b2b5-0a327b634d7a",
    author_name: "Alex",
    body: "Verify the meter and both load-side legs before opening the enclosure.",
    verified_fix: true,
    created_at: "2026-07-26T12:30:00.000Z",
  }]);

  assert.equal(post.author, "Michael");
  assert.equal(post.answers.length, 1);
  assert.equal(post.answers[0].verifiedFix, true);
  assert.equal(post.article.url, "https://example.com/code-update");
  assert.equal(post.article.source, "Example Trade News");
  assert.equal("authorAccountId" in post, false);
});

test("server-rendered pages include canonical, social, structured-data, and indexing controls", () => {
  assert.throws(
    () => publicDiscoveryInternals.pageShell({
      distDir: "missing",
      title: "Missing nonce",
      description: "Missing nonce",
      canonical: "https://rivt.pro/jobs/missing",
      body: "<h1>Missing nonce</h1>",
    }),
    /CSP nonce is required/,
  );

  const html = publicDiscoveryInternals.pageShell({
    distDir: "missing-dist-is-allowed-in-unit-tests",
    title: "Electrical work | RIVT",
    description: "Public skilled-trade work.",
    canonical: "https://rivt.pro/jobs/b2279c8c-58ee-4cf1-b2fa-20c4db1e6c52",
    body: "<h1>Electrical work</h1>",
    jsonLd: { "@context": "https://schema.org", "@type": "JobPosting" },
    nonce: "unit-test-nonce",
  });
  assert.match(html, /rel="canonical" href="https:\/\/rivt\.pro\/jobs\//);
  assert.match(html, /property="og:image" content="https:\/\/rivt\.pro\/rivt-social-card\.png"/);
  assert.match(html, /application\/ld\+json/);
  assert.equal((html.match(/nonce="unit-test-nonce"/g) ?? []).length, 2);
  assert.match(html, /name="robots" content="index,follow"/);
  assert.doesNotMatch(html, /theme-color/);

  const noIndex = publicDiscoveryInternals.pageShell({
    distDir: "missing",
    title: "Unavailable",
    description: "Unavailable",
    canonical: "https://rivt.pro/jobs/missing",
    body: "<h1>Unavailable</h1>",
    indexable: false,
    nonce: "unit-test-nonce",
  });
  assert.match(noIndex, /name="robots" content="noindex,nofollow"/);
});
