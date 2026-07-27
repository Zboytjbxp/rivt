import { readFileSync } from "node:fs";
import path from "node:path";
import { ApiError, asyncRoute, validate, z } from "./api.js";

const PUBLIC_PAGE_LIMIT = 30;
const PUBLIC_SITEMAP_LIMIT = 500;
const publicListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(PUBLIC_PAGE_LIMIT).default(20),
});
const publicIdSchema = z.uuid();

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const PHONE_PATTERN = /(?:\+?1[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]\d{3}[\s.-]\d{4}\b/;
const STREET_PATTERN = /\b\d{1,6}\s+[A-Za-z0-9.'-]+(?:\s+[A-Za-z0-9.'-]+){0,4}\s+(?:street|st|avenue|ave|road|rd|drive|dr|lane|ln|boulevard|blvd|court|ct|place|pl|way|trail|trl|parkway|pkwy)\b/i;

export function publicContentRisks(values) {
  const text = values.filter(Boolean).join(" ");
  const risks = [];
  if (EMAIL_PATTERN.test(text)) risks.push("email address");
  if (PHONE_PATTERN.test(text)) risks.push("phone number");
  if (STREET_PATTERN.test(text)) risks.push("street address");
  return risks;
}

export function assertPublicContentSafe(values) {
  const risks = publicContentRisks(values);
  if (risks.length) {
    throw new ApiError(
      422,
      "PUBLIC_CONTENT_PRIVATE_DETAILS",
      "Remove private contact or address details before publishing this on the public web.",
      { risks },
    );
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeJson(value) {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

function cleanText(value, max = 500) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length <= max ? text : `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

function iso(value) {
  return value ? new Date(value).toISOString() : null;
}

function displayDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function money(amountCents, unit) {
  if (amountCents === null || amountCents === undefined) return null;
  const value = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(amountCents) / 100);
  return unit === "hourly" ? `${value}/hr` : value;
}

function compensationLabel(row) {
  if (row.compensation_type === "request_quotes") return "Requesting quotes";
  if (row.compensation_type === "open_to_offers") {
    const target = money(row.budget_cents, row.budget_unit);
    return target ? `Open to offers · target ${target}` : "Open to offers";
  }
  return money(row.budget_cents, row.budget_unit) ?? "Compensation discussed in RIVT";
}

function publicJobProjection(row, requirements = []) {
  return {
    id: row.id,
    title: row.title,
    organization: publicContentRisks([row.organization_name]).length ? "RIVT contractor" : row.organization_name,
    trade: { code: row.trade_code, name: row.trade_name },
    summary: row.summary,
    scopeDescription: row.scope_description,
    difficulty: row.difficulty,
    workType: row.work_type,
    compensation: compensationLabel(row),
    budget: row.budget_cents === null ? null : {
      amountCents: Number(row.budget_cents),
      currency: "USD",
      unit: row.budget_unit,
    },
    compensationType: row.compensation_type,
    durationHours: row.duration_hours === null ? null : Number(row.duration_hours),
    preferredStartDate: row.preferred_start_date ? String(row.preferred_start_date).slice(0, 10) : null,
    applicationDeadline: iso(row.application_deadline),
    insuranceRequired: Boolean(row.insurance_required),
    location: {
      city: row.public_city,
      region: row.public_region,
      countryCode: row.public_country_code,
    },
    requirements: {
      tools: requirements.filter((item) => item.kind === "tool").map((item) => item.value),
      materials: requirements.filter((item) => item.kind === "material").map((item) => item.value),
      deliverables: requirements.filter((item) => item.kind === "deliverable").map((item) => item.value),
      certifications: requirements.filter((item) => item.kind === "certification").map((item) => item.value),
    },
    publishedAt: iso(row.published_at),
    updatedAt: iso(row.updated_at),
    addressPrivacy: "Exact jobsite address and contact details are never shown on the public page.",
  };
}

async function loadRequirements(database, jobIds) {
  if (!jobIds.length) return new Map();
  const result = await database.query(
    `SELECT job_id, kind, value
     FROM job_requirements
     WHERE job_id = ANY($1::uuid[])
     ORDER BY job_id, sort_order, id`,
    [jobIds],
  );
  const grouped = new Map();
  for (const row of result.rows) {
    const values = grouped.get(row.job_id) ?? [];
    values.push(row);
    grouped.set(row.job_id, values);
  }
  return grouped;
}

const publicJobSelect = `
  SELECT job.id, job.title, job.trade_code, trade.name AS trade_name,
         job.summary, job.scope_description, job.difficulty, job.work_type,
         job.budget_cents, job.budget_unit, job.compensation_type,
         job.duration_hours, job.preferred_start_date, job.application_deadline,
         job.insurance_required, job.published_at, job.updated_at,
         organization.name AS organization_name,
         location.city AS public_city, location.region AS public_region,
         location.country_code AS public_country_code
  FROM jobs job
  JOIN organizations organization ON organization.id = job.organization_id
  JOIN trades trade ON trade.code = job.trade_code
  JOIN job_public_locations location ON location.job_id = job.id
  JOIN accounts author ON author.id = job.created_by_account_id
  WHERE job.status = 'open'
    AND job.published_at IS NOT NULL
    AND job.public_web_visibility = 'public'
    AND author.status = 'active'`;

async function loadPublicJobs(database, { id = null, limit = 20 } = {}) {
  const parameters = [];
  let where = "";
  if (id) {
    parameters.push(id);
    where = ` AND job.id = $1`;
  }
  parameters.push(limit);
  const result = await database.query(
    `${publicJobSelect}${where}
     ORDER BY job.published_at DESC, job.id DESC
     LIMIT $${parameters.length}`,
    parameters,
  );
  const requirements = await loadRequirements(database, result.rows.map((row) => row.id));
  return result.rows.map((row) => publicJobProjection(row, requirements.get(row.id) ?? []));
}

function parseArticleBody(body) {
  const normalized = String(body ?? "").replace(/\r\n?/g, "\n").trim();
  const urlMatch = normalized.match(/https?:\/\/[^\s<>"']+/i);
  if (!urlMatch) return { content: normalized, article: null };
  const url = urlMatch[0].replace(/[),.;]+$/, "");
  let domain = "Linked article";
  try {
    domain = new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return { content: normalized, article: null };
  }
  const lines = normalized.replace(urlMatch[0], "").split("\n").map((line) => line.trim());
  const viaIndex = lines.findIndex((line) => /^Via\s+/i.test(line));
  const source = viaIndex >= 0 ? lines[viaIndex].replace(/^Via\s+/i, "").split(/\s+[·•]\s+/)[0].trim() : domain;
  if (viaIndex >= 0) lines.splice(viaIndex, 1);
  return {
    content: lines.join("\n").replace(/\n{3,}/g, "\n\n").trim(),
    article: { url, domain, source },
  };
}

function publicPostProjection(row, answers = [], imageUrl = null) {
  const parsed = parseArticleBody(row.body);
  return {
    id: row.id,
    author: publicContentRisks([row.author_name]).length ? "RIVT member" : row.author_name,
    trade: row.trade,
    flair: row.flair,
    type: row.post_type,
    title: row.title,
    body: parsed.content,
    article: parsed.article,
    status: row.status,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    community: { slug: row.community_slug, name: row.community_name },
    answers: answers.map((answer) => ({
      id: answer.id,
      author: publicContentRisks([answer.author_name]).length ? "RIVT member" : answer.author_name,
      body: answer.body,
      verifiedFix: Boolean(answer.verified_fix),
      createdAt: iso(answer.created_at),
    })),
    answerCount: Number(row.answer_count ?? answers.length),
    imageUrl,
    imageAlt: row.image_alt_text || row.image_original_name || row.title,
  };
}

const publicPostSelect = `
  SELECT post.id, post.author_name, post.trade, post.flair, post.post_type,
         post.title, post.body, post.status, post.created_at, post.updated_at,
         community.slug AS community_slug, community.name AS community_name,
         COALESCE(answer_count.count, 0)::int AS answer_count,
         media.object_key AS image_object_key, media.alt_text AS image_alt_text,
         media.original_name AS image_original_name
  FROM shop_talk_posts post
  JOIN communities community ON community.id = post.community_id
  JOIN accounts author ON author.id = post.author_account_id
  LEFT JOIN LATERAL (
    SELECT count(*)::int AS count
    FROM shop_talk_answers answer
    JOIN accounts answer_author ON answer_author.id = answer.author_account_id
    WHERE answer.post_id = post.id
      AND answer.deleted_at IS NULL
      AND answer.moderation_status <> 'hidden'
      AND answer.public_web_consent_at IS NOT NULL
      AND answer_author.status = 'active'
  ) answer_count ON true
  LEFT JOIN LATERAL (
    SELECT upload.object_key, media.alt_text, media.original_name
    FROM shop_talk_post_media media
    JOIN uploads upload ON upload.id = media.upload_id
    WHERE media.post_id = post.id
      AND media.status = 'active'
      AND upload.upload_status = 'stored'
    ORDER BY media.created_at ASC, media.id ASC
    LIMIT 1
  ) media ON true
  WHERE post.public_web_visibility = 'public'
    AND post.moderation_status <> 'hidden'
    AND community.audience = 'public'
    AND community.archived_at IS NULL
    AND community.moderation_status <> 'hidden'
    AND author.status = 'active'`;

async function loadPublicPosts(database, signedObjectUrl, {
  id = null,
  limit = 20,
  includeAnswers = false,
  includeImages = true,
} = {}) {
  const parameters = [];
  let where = "";
  if (id) {
    parameters.push(id);
    where = ` AND post.id = $1`;
  }
  parameters.push(limit);
  const result = await database.query(
    `${publicPostSelect}${where}
     ORDER BY post.created_at DESC, post.id DESC
     LIMIT $${parameters.length}`,
    parameters,
  );
  return Promise.all(result.rows.map(async (row) => {
    let answers = [];
    if (includeAnswers) {
      const answerResult = await database.query(
        `SELECT answer.id, answer.author_name, answer.body, answer.verified_fix, answer.created_at
         FROM shop_talk_answers answer
         JOIN accounts author ON author.id = answer.author_account_id
         WHERE answer.post_id = $1
           AND answer.deleted_at IS NULL
           AND answer.moderation_status <> 'hidden'
           AND answer.public_web_consent_at IS NOT NULL
           AND author.status = 'active'
         ORDER BY answer.verified_fix DESC, answer.created_at ASC, answer.id ASC`,
        [row.id],
      );
      answers = answerResult.rows;
    }
    const imageUrl = includeImages && row.image_object_key
      ? await signedObjectUrl(row.image_object_key).catch(() => null)
      : null;
    return publicPostProjection(row, answers, imageUrl);
  }));
}

function stylesheetLinks(distDir) {
  try {
    const html = readFileSync(path.join(distDir, "index.html"), "utf8");
    return [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"[^>]*>/g)]
      .map((match) => `<link rel="stylesheet" href="${escapeHtml(match[1])}" />`)
      .join("\n");
  } catch {
    return "";
  }
}

function pageShell({
  distDir,
  title,
  description,
  canonical,
  body,
  jsonLd = null,
  image = "/rivt-social-card.png",
  type = "website",
  indexable = true,
}) {
  const safeTitle = cleanText(title, 120);
  const safeDescription = cleanText(description, 240);
  const socialImage = new URL(image, canonical).toString();
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="description" content="${escapeHtml(safeDescription)}" />
  <meta name="robots" content="${indexable ? "index,follow" : "noindex,nofollow"}" />
  <meta property="og:type" content="${escapeHtml(type)}" />
  <meta property="og:title" content="${escapeHtml(safeTitle)}" />
  <meta property="og:description" content="${escapeHtml(safeDescription)}" />
  <meta property="og:url" content="${escapeHtml(canonical)}" />
  <meta property="og:image" content="${escapeHtml(socialImage)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(safeTitle)}" />
  <meta name="twitter:description" content="${escapeHtml(safeDescription)}" />
  <meta name="twitter:image" content="${escapeHtml(socialImage)}" />
  <link rel="canonical" href="${escapeHtml(canonical)}" />
  <link rel="icon" type="image/png" sizes="32x32" href="/rivt-favicon-32.png" />
  ${stylesheetLinks(distDir)}
  <title>${escapeHtml(safeTitle)}</title>
  ${jsonLd ? `<script type="application/ld+json">${safeJson(jsonLd)}</script>` : ""}
  <script>document.documentElement.dataset.theme=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";</script>
</head>
<body>
  <main class="rivt-v2 public-discovery-page">${body}</main>
</body>
</html>`;
}

function publicHeader(active) {
  return `<header class="public-discovery-header">
    <a class="public-discovery-brand" href="/" aria-label="RIVT home">
      <picture>
        <source srcset="/brand/rivt-lockup-dark-transparent.png" media="(prefers-color-scheme: dark)" />
        <img src="/brand/rivt-lockup-light-transparent.png" alt="RIVT" width="640" height="188" />
      </picture>
    </a>
    <nav aria-label="Public RIVT">
      <a${active === "jobs" ? ' aria-current="page"' : ""} href="/jobs">Jobs</a>
      <a${active === "shop-talk" ? ' aria-current="page"' : ""} href="/shop-talk">Shop Talk</a>
      <a class="public-discovery-signin" href="/app">Sign in</a>
    </nav>
  </header>`;
}

function publicFooter() {
  return `<footer class="public-discovery-footer">
    <span>RIVT · Where skilled trades connect</span>
    <nav aria-label="Legal">
      <a href="/legal/privacy.html">Privacy</a>
      <a href="/legal/terms.html">Terms</a>
      <a href="/legal/security.html">Security</a>
    </nav>
  </footer>`;
}

function listEmpty(title, body, actionHref, actionLabel) {
  return `<section class="public-discovery-empty">
    <h2>${escapeHtml(title)}</h2><p>${escapeHtml(body)}</p>
    <a class="v2-primary-button" href="${escapeHtml(actionHref)}">${escapeHtml(actionLabel)}</a>
  </section>`;
}

function jobListMarkup(jobs) {
  if (!jobs.length) {
    return listEmpty(
      "No public jobs are open right now",
      "RIVT members may still have network-only work. Sign in to see opportunities available to your account.",
      "/app/work",
      "Open Work in RIVT",
    );
  }
  return `<div class="public-discovery-grid">${jobs.map((job) => `
    <article class="public-discovery-card">
      <span class="public-discovery-kicker">${escapeHtml(job.trade.name)} · ${escapeHtml(job.location.city)}, ${escapeHtml(job.location.region)}</span>
      <h2><a href="/jobs/${escapeHtml(job.id)}">${escapeHtml(job.title)}</a></h2>
      <p>${escapeHtml(cleanText(job.summary, 220))}</p>
      <div class="public-discovery-meta">
        <span>${escapeHtml(job.organization)}</span><strong>${escapeHtml(job.compensation)}</strong>
      </div>
    </article>`).join("")}</div>`;
}

function postListMarkup(posts) {
  if (!posts.length) {
    return listEmpty(
      "No public discussions yet",
      "Member conversations remain inside RIVT unless their authors intentionally publish them.",
      "/app/shop-talk",
      "Open Shop Talk",
    );
  }
  return `<div class="public-discovery-list">${posts.map((post) => `
    <article class="public-discovery-card public-discussion-card">
      <span class="public-discovery-kicker">${escapeHtml(post.community.name)} · ${escapeHtml(post.trade)}</span>
      <h2><a href="/shop-talk/${escapeHtml(post.id)}">${escapeHtml(post.title)}</a></h2>
      ${post.body ? `<p>${escapeHtml(cleanText(post.body, 240))}</p>` : ""}
      <div class="public-discovery-meta">
        <span>${escapeHtml(post.author)} · ${escapeHtml(displayDate(post.createdAt))}</span>
        <strong>${post.answerCount} ${post.answerCount === 1 ? "answer" : "answers"}</strong>
      </div>
    </article>`).join("")}</div>`;
}

function requirementMarkup(label, values) {
  if (!values.length) return "";
  return `<section class="public-discovery-section"><h2>${escapeHtml(label)}</h2><ul>${values.map((value) => `<li>${escapeHtml(value)}</li>`).join("")}</ul></section>`;
}

function jobDetailMarkup(job) {
  const applyHref = `/app/work?job=${encodeURIComponent(job.id)}`;
  return `${publicHeader("jobs")}
  <article class="public-discovery-detail">
    <a class="public-discovery-back" href="/jobs">← All public jobs</a>
    <span class="public-discovery-kicker">${escapeHtml(job.trade.name)} · ${escapeHtml(job.location.city)}, ${escapeHtml(job.location.region)}</span>
    <h1>${escapeHtml(job.title)}</h1>
    <p class="public-discovery-lede">${escapeHtml(job.summary)}</p>
    <div class="public-discovery-facts">
      <div><span>Posted by</span><strong>${escapeHtml(job.organization)}</strong></div>
      <div><span>Compensation</span><strong>${escapeHtml(job.compensation)}</strong></div>
      <div><span>Estimated time</span><strong>${job.durationHours ? `${escapeHtml(job.durationHours)} hours` : "Discuss in RIVT"}</strong></div>
      <div><span>Start</span><strong>${job.preferredStartDate ? escapeHtml(displayDate(job.preferredStartDate)) : "Flexible"}</strong></div>
    </div>
    <section class="public-discovery-section"><h2>Scope</h2><p>${escapeHtml(job.scopeDescription)}</p></section>
    ${requirementMarkup("Tools", job.requirements.tools)}
    ${requirementMarkup("Materials and site provisions", job.requirements.materials)}
    ${requirementMarkup("Completion deliverables", job.requirements.deliverables)}
    ${requirementMarkup("Certifications", job.requirements.certifications)}
    <aside class="public-discovery-privacy"><strong>Privacy protected</strong><p>${escapeHtml(job.addressPrivacy)}</p></aside>
    <div class="public-discovery-cta">
      <div><strong>Interested in this job?</strong><span>Sign in to review the complete RIVT listing and apply.</span></div>
      <a class="v2-primary-button" href="${escapeHtml(applyHref)}">View and apply in RIVT</a>
    </div>
  </article>${publicFooter()}`;
}

function postDetailMarkup(post) {
  const openHref = `/app/shop-talk?post=${encodeURIComponent(post.id)}`;
  return `${publicHeader("shop-talk")}
  <article class="public-discovery-detail public-thread-detail">
    <a class="public-discovery-back" href="/shop-talk">← Public Shop Talk</a>
    <span class="public-discovery-kicker">${escapeHtml(post.flair || "Shop Talk")} · ${escapeHtml(post.community.name)}</span>
    <h1>${escapeHtml(post.title)}</h1>
    <p class="public-discovery-byline">${escapeHtml(post.author)} · ${escapeHtml(post.trade)} · ${escapeHtml(displayDate(post.createdAt))}</p>
    ${post.body ? `<div class="public-discovery-post-body">${escapeHtml(post.body).replaceAll("\n", "<br />")}</div>` : ""}
    ${post.article ? `<a class="public-discovery-article" href="${escapeHtml(post.article.url)}" rel="noreferrer">Read linked article · ${escapeHtml(post.article.source)}</a>` : ""}
    ${post.imageUrl ? `<figure class="public-discovery-media"><img src="${escapeHtml(post.imageUrl)}" alt="${escapeHtml(post.imageAlt)}" width="1200" height="675" /></figure>` : ""}
    <section class="public-discovery-answers">
      <h2>Answers (${post.answers.length})</h2>
      ${post.answers.length ? post.answers.map((answer) => `<article>
        <header><strong>${escapeHtml(answer.author)}</strong>${answer.verifiedFix ? "<span>Verified Fix</span>" : ""}</header>
        <p>${escapeHtml(answer.body)}</p>
      </article>`).join("") : "<p>No answers yet. Join RIVT to contribute field-tested experience.</p>"}
    </section>
    <div class="public-discovery-cta">
      <div><strong>Continue the trade conversation</strong><span>Sign in to answer, vote, bookmark, or report this post.</span></div>
      <a class="v2-primary-button" href="${escapeHtml(openHref)}">Open in Shop Talk</a>
    </div>
  </article>${publicFooter()}`;
}

function notFoundMarkup(kind) {
  return `${publicHeader(kind === "job" ? "jobs" : "shop-talk")}
    ${listEmpty(
      kind === "job" ? "This job is no longer public" : "This discussion is no longer public",
      kind === "job"
        ? "It may have closed, paused, or returned to RIVT-member visibility."
        : "It may have been unpublished, deleted, moderated, or limited to RIVT members.",
      kind === "job" ? "/jobs" : "/shop-talk",
      kind === "job" ? "Browse public jobs" : "Browse public Shop Talk",
    )}
    ${publicFooter()}`;
}

function jobPostingJsonLd(job, canonical) {
  const data = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: `${job.summary}\n\n${job.scopeDescription}`,
    datePosted: job.publishedAt,
    employmentType: "CONTRACTOR",
    hiringOrganization: { "@type": "Organization", name: job.organization },
    jobLocation: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressLocality: job.location.city,
        addressRegion: job.location.region,
        addressCountry: job.location.countryCode,
      },
    },
    directApply: false,
    url: canonical,
  };
  if (job.applicationDeadline) data.validThrough = job.applicationDeadline;
  if (job.budget) {
    data.baseSalary = {
      "@type": "MonetaryAmount",
      currency: "USD",
      value: {
        "@type": "QuantitativeValue",
        value: job.budget.amountCents / 100,
        unitText: job.budget.unit === "hourly" ? "HOUR" : "JOB",
      },
    };
  }
  return data;
}

function discussionJsonLd(post, canonical) {
  return {
    "@context": "https://schema.org",
    "@type": "DiscussionForumPosting",
    headline: post.title,
    text: post.body,
    datePublished: post.createdAt,
    dateModified: post.updatedAt,
    author: { "@type": "Person", name: post.author },
    interactionStatistic: {
      "@type": "InteractionCounter",
      interactionType: "https://schema.org/CommentAction",
      userInteractionCount: post.answerCount,
    },
    url: canonical,
  };
}

export function registerPublicDiscoveryRoutes({
  app,
  database,
  ensureDatabaseReady,
  rateLimit,
  appOrigin,
  distDir,
  signedObjectUrl,
}) {
  app.use(["/api/public", "/jobs", "/shop-talk"], rateLimit);

  app.get("/api/public/jobs", asyncRoute(async (request, response) => {
    await ensureDatabaseReady();
    const input = validate(publicListQuerySchema, request.query);
    response.json({ data: { jobs: await loadPublicJobs(database, input) } });
  }));

  app.get("/api/public/jobs/:id", asyncRoute(async (request, response) => {
    await ensureDatabaseReady();
    const id = validate(publicIdSchema, request.params.id);
    const job = (await loadPublicJobs(database, { id, limit: 1 }))[0];
    if (!job) throw new ApiError(404, "PUBLIC_JOB_NOT_FOUND", "That public job is unavailable.");
    response.json({ data: { job } });
  }));

  app.get("/api/public/shop-talk", asyncRoute(async (request, response) => {
    await ensureDatabaseReady();
    const input = validate(publicListQuerySchema, request.query);
    response.json({ data: { posts: await loadPublicPosts(database, signedObjectUrl, input) } });
  }));

  app.get("/api/public/shop-talk/:id", asyncRoute(async (request, response) => {
    await ensureDatabaseReady();
    const id = validate(publicIdSchema, request.params.id);
    const post = (await loadPublicPosts(database, signedObjectUrl, { id, limit: 1, includeAnswers: true }))[0];
    if (!post) throw new ApiError(404, "PUBLIC_SHOP_TALK_NOT_FOUND", "That public Shop Talk post is unavailable.");
    response.json({ data: { post } });
  }));

  app.get("/jobs", asyncRoute(async (_request, response) => {
    await ensureDatabaseReady();
    const jobs = await loadPublicJobs(database, { limit: PUBLIC_PAGE_LIMIT });
    const canonical = `${appOrigin}/jobs`;
    response.type("html").send(pageShell({
      distDir,
      title: "Skilled trade jobs | RIVT",
      description: "Discover intentionally public skilled-trade jobs on RIVT. Exact jobsite addresses and contact details remain private.",
      canonical,
      body: `${publicHeader("jobs")}<section class="public-discovery-hero"><span>Public work</span><h1>Skilled trade jobs</h1><p>Real work published by RIVT contractors. Sign in to apply and see member-only opportunities.</p></section>${jobListMarkup(jobs)}${publicFooter()}`,
    }));
  }));

  app.get("/jobs/:id", asyncRoute(async (request, response) => {
    await ensureDatabaseReady();
    const parsedId = publicIdSchema.safeParse(request.params.id);
    const id = parsedId.success ? parsedId.data : null;
    const canonical = `${appOrigin}/jobs/${encodeURIComponent(request.params.id)}`;
    if (!id) {
      response.status(404).type("html").send(pageShell({
        distDir,
        title: "Job unavailable | RIVT",
        description: "This RIVT job is not available on the public web.",
        canonical,
        body: notFoundMarkup("job"),
        indexable: false,
      }));
      return;
    }
    const job = (await loadPublicJobs(database, { id, limit: 1 }))[0];
    if (!job) {
      response.status(404).type("html").send(pageShell({
        distDir,
        title: "Job unavailable | RIVT",
        description: "This RIVT job is no longer available on the public web.",
        canonical,
        body: notFoundMarkup("job"),
        indexable: false,
      }));
      return;
    }
    response.type("html").send(pageShell({
      distDir,
      title: `${job.title} | RIVT`,
      description: `${job.trade.name} work in ${job.location.city}, ${job.location.region}. ${job.summary}`,
      canonical,
      body: jobDetailMarkup(job),
      jsonLd: jobPostingJsonLd(job, canonical),
    }));
  }));

  app.get("/shop-talk", asyncRoute(async (_request, response) => {
    await ensureDatabaseReady();
    const posts = await loadPublicPosts(database, signedObjectUrl, { limit: PUBLIC_PAGE_LIMIT });
    const canonical = `${appOrigin}/shop-talk`;
    response.type("html").send(pageShell({
      distDir,
      title: "Shop Talk | RIVT",
      description: "Public skilled-trade questions, field techniques, safety discussions, and verified fixes shared intentionally by RIVT members.",
      canonical,
      body: `${publicHeader("shop-talk")}<section class="public-discovery-hero"><span>Public discussions</span><h1>Shop Talk</h1><p>Field-tested knowledge shared by skilled tradespeople. Sign in to answer, vote, and join communities.</p></section>${postListMarkup(posts)}${publicFooter()}`,
    }));
  }));

  app.get("/shop-talk/:id", asyncRoute(async (request, response) => {
    await ensureDatabaseReady();
    const parsedId = publicIdSchema.safeParse(request.params.id);
    const id = parsedId.success ? parsedId.data : null;
    const canonical = `${appOrigin}/shop-talk/${encodeURIComponent(request.params.id)}`;
    if (!id) {
      response.status(404).type("html").send(pageShell({
        distDir,
        title: "Discussion unavailable | RIVT",
        description: "This Shop Talk discussion is not available on the public web.",
        canonical,
        body: notFoundMarkup("post"),
        indexable: false,
      }));
      return;
    }
    const post = (await loadPublicPosts(database, signedObjectUrl, { id, limit: 1, includeAnswers: true }))[0];
    if (!post) {
      response.status(404).type("html").send(pageShell({
        distDir,
        title: "Discussion unavailable | RIVT",
        description: "This Shop Talk discussion is no longer available on the public web.",
        canonical,
        body: notFoundMarkup("post"),
        indexable: false,
      }));
      return;
    }
    response.type("html").send(pageShell({
      distDir,
      title: `${post.title} | RIVT Shop Talk`,
      description: post.body || `${post.trade} discussion in ${post.community.name}.`,
      canonical,
      body: postDetailMarkup(post),
      jsonLd: discussionJsonLd(post, canonical),
      image: post.imageUrl || `${appOrigin}/rivt-social-card.png`,
      type: "article",
    }));
  }));

  app.get("/sitemap.xml", asyncRoute(async (_request, response) => {
    await ensureDatabaseReady();
    const [jobs, posts] = await Promise.all([
      loadPublicJobs(database, { limit: PUBLIC_SITEMAP_LIMIT }),
      loadPublicPosts(database, signedObjectUrl, { limit: PUBLIC_SITEMAP_LIMIT, includeImages: false }),
    ]);
    const staticUrls = ["", "/jobs", "/shop-talk", "/legal/security.html", "/legal/privacy.html", "/legal/terms.html"];
    const urls = [
      ...staticUrls.map((pathname) => ({ loc: `${appOrigin}${pathname || "/"}`, lastmod: null })),
      ...jobs.map((job) => ({ loc: `${appOrigin}/jobs/${job.id}`, lastmod: job.updatedAt })),
      ...posts.map((post) => ({ loc: `${appOrigin}/shop-talk/${post.id}`, lastmod: post.updatedAt })),
    ];
    response.type("application/xml").send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((entry) => `  <url><loc>${escapeHtml(entry.loc)}</loc>${entry.lastmod ? `<lastmod>${escapeHtml(entry.lastmod.slice(0, 10))}</lastmod>` : ""}</url>`).join("\n")}
</urlset>`);
  }));
}

export const publicDiscoveryInternals = {
  publicContentRisks,
  publicJobProjection,
  publicPostProjection,
  pageShell,
};
