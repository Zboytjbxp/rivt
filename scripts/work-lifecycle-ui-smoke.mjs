import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";

const port = 5199;
const baseUrl = `http://127.0.0.1:${port}`;
const projectRoot = process.cwd();
const viteBin = path.join(projectRoot, "node_modules", "vite", "bin", "vite.js");
const screenshotDir = path.join(os.tmpdir(), "rivt-work-lifecycle-pass");

const DAY_MS = 24 * 60 * 60 * 1000;
function futureIso(days) {
  return new Date(Date.now() + days * DAY_MS).toISOString();
}
function futureDate(days) {
  return futureIso(days).slice(0, 10);
}

const contractorId = "8f681cb1-8244-4855-a392-a62a679d5a60";
const tradespersonId = "4ddf5f60-4db8-43dd-9fc4-4239d2a0b4d5";
const orgId = "753bb8d1-e46d-4921-89c2-ee80f1fc8db1";
const openJobId = "3579d98a-2e88-469e-a843-5fdd406794bd";
const draftJobId = "2fb7ba55-d01c-4b83-a58d-f6fcf0cef49b";
const applicationId = "6732973b-7378-46fb-9a1c-b693e1d350dc";
const offerId = "011ab327-f24d-49f7-9791-bf9247800c26";
const activeWorkId = "8a68c4fc-8401-4403-a865-fdbde5d3ea58";
const projectId = "d4af9856-a962-4533-8813-91064b4b18a4";

const vite = spawn(process.execPath, [viteBin, "--host", "127.0.0.1", "--port", String(port)], {
  cwd: projectRoot,
  env: { ...process.env, VITE_ENABLE_GUEST_DEMO: "false" },
  stdio: ["ignore", "pipe", "pipe"],
});

const contractorAccount = {
  id: contractorId,
  status: "active",
  primaryRole: "contractor",
  email: "contractor-work-smoke@rivt.pro",
  provider: "email",
  emailVerified: true,
  profile: {
    displayName: "Michael Test",
    headline: "Electrical contractor",
    bio: "",
    locationText: "Jacksonville, FL",
    visibility: "network",
    onboardingStatus: "complete",
    serviceArea: { city: "Jacksonville", region: "FL", countryCode: "US", radiusMiles: 35 },
    availabilityStatus: "available",
    contactEmailVisibility: "private",
    phoneE164: null,
    phoneVisibility: "private",
    avatarUploadId: null,
    trades: [{ code: "electrical", name: "Electrical", primary: true }],
    rateCards: [],
  },
  organizations: [{ id: orgId, name: "RIVT Test Electric", role: "owner" }],
  capabilities: { canCompleteOnboarding: false, canPostWork: true, canApplyToWork: false, canPublishProfile: true },
};

const tradespersonAccount = {
  id: tradespersonId,
  status: "active",
  primaryRole: "tradesperson",
  email: "tradesperson-work-smoke@rivt.pro",
  provider: "email",
  emailVerified: true,
  profile: {
    displayName: "Riley Harper",
    headline: "Commercial electrician",
    bio: "",
    locationText: "Jacksonville, FL",
    visibility: "network",
    onboardingStatus: "complete",
    serviceArea: { city: "Jacksonville", region: "FL", countryCode: "US", radiusMiles: 35 },
    availabilityStatus: "available",
    contactEmailVisibility: "private",
    phoneE164: null,
    phoneVisibility: "private",
    avatarUploadId: null,
    trades: [{ code: "electrical", name: "Electrical", primary: true }],
    rateCards: [{
      tradeCode: "electrical",
      tradeName: "Electrical",
      hourlyRateCents: 6500,
      dayRateCents: null,
      minimumChargeCents: 15000,
      visibility: "applications",
    }],
  },
  organizations: [],
  capabilities: { canCompleteOnboarding: false, canPostWork: false, canApplyToWork: true, canPublishProfile: true },
};

function makeJob(overrides = {}) {
  const status = overrides.status ?? "open";
  const timestamp = "2026-06-28T14:00:00.000Z";
  return {
    id: overrides.id ?? openJobId,
    organization: { id: orgId, name: "RIVT Test Electric" },
    createdByAccountId: contractorId,
    title: overrides.title ?? "Warehouse panel assist",
    trade: { code: "electrical", name: "Electrical" },
    summary: "Need a reliable electrician to help finish panel labeling and branch circuit punch list.",
    scopeDescription: "Assist with panel trim, labeling, device verification, and final punch list before inspection.",
    status,
    difficulty: "moderate",
    workType: "side_work",
    compensationType: "fixed",
    budget: { amountCents: 85000, currency: "USD", unit: "fixed" },
    durationHours: 8,
    preferredStartDate: overrides.preferredStartDate ?? futureDate(7),
    applicationDeadline: overrides.applicationDeadline ?? futureIso(4),
    insuranceRequired: true,
    publicLocation: { city: "Jacksonville", region: "FL", countryCode: "US", postalPrefix: "322" },
    privateLocation: {
      addressLine1: "1200 River Yard",
      addressLine2: "",
      city: "Jacksonville",
      region: "FL",
      postalCode: "32202",
      countryCode: "US",
      accessNotes: "Meet at the south gate.",
    },
    requirements: {
      tools: ["Voltage tester", "Label maker"],
      materials: ["Materials onsite"],
      deliverables: ["Labeled panel", "Punch list photos"],
      certificationCodes: [],
    },
    addressPrivacy: "Exact address is shared only after acceptance.",
    matchScore: 86,
    version: overrides.version ?? 1,
    publishedAt: status === "open" ? timestamp : null,
    pausedAt: null,
    closedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    events: overrides.events ?? [],
  };
}

function makeApplication(status = "submitted", message = "I can bring tester, hand tools, and be onsite Wednesday morning.") {
  return {
    id: applicationId,
    jobId: openJobId,
    applicantAccountId: tradespersonId,
    status,
    message,
    proposedStartDate: null,
    proposal: null,
    submittedAt: status === "draft" ? null : "2026-06-28T15:00:00.000Z",
    withdrawnAt: null,
    decidedAt: ["shortlisted", "declined", "offered"].includes(status) ? "2026-06-28T15:10:00.000Z" : null,
    createdAt: "2026-06-28T15:00:00.000Z",
    updatedAt: "2026-06-28T15:00:00.000Z",
    applicant: {
      accountId: tradespersonId,
      displayName: "Riley Harper",
      headline: "Commercial electrician",
      serviceArea: { city: "Jacksonville", region: "FL" },
      rates: [{
        tradeCode: "electrical",
        tradeName: "Electrical",
        hourlyRateCents: 6500,
        dayRateCents: null,
        minimumChargeCents: 15000,
        visibility: "applications",
      }],
    },
    events: [],
  };
}

function makeOffer(status = "pending") {
  return {
    id: offerId,
    jobId: openJobId,
    applicationId,
    contractorAccountId: contractorId,
    recipientAccountId: tradespersonId,
    status,
    startDate: "2026-07-01",
    scopeSummary: "Panel trim, labeling, and punch list support.",
    message: "Offer for Warehouse panel assist. Accept to unlock the jobsite and active work record.",
    agreedCompensation: { amountCents: 82500, unit: "fixed" },
    expiresAt: null,
    acceptedAt: status === "accepted" ? "2026-06-28T15:30:00.000Z" : null,
    declinedAt: null,
    cancelledAt: null,
    createdAt: "2026-06-28T15:20:00.000Z",
    updatedAt: "2026-06-28T15:20:00.000Z",
    recipient: {
      accountId: tradespersonId,
      displayName: "Riley Harper",
      headline: "Commercial electrician",
      serviceArea: { city: "Jacksonville", region: "FL" },
    },
    events: [],
  };
}

function makeActiveWork(events = []) {
  return {
    id: activeWorkId,
    jobId: openJobId,
    offerId,
    organizationId: orgId,
    contractorAccountId: contractorId,
    tradespersonAccountId: tradespersonId,
    status: "active",
    startedAt: "2026-06-28T15:30:00.000Z",
    completedAt: null,
    cancelledAt: null,
    createdAt: "2026-06-28T15:30:00.000Z",
    updatedAt: "2026-06-28T15:30:00.000Z",
    job: {
      id: openJobId,
      title: "Warehouse panel assist",
      status: "closed",
      organization: { id: orgId, name: "RIVT Test Electric" },
      trade: { code: "electrical", name: "Electrical" },
      durationHours: 8,
      compensationType: "fixed",
      budget: { amountCents: 85000, currency: "USD", unit: "fixed" },
      publicLocation: { city: "Jacksonville", region: "FL", countryCode: "US" },
      privateLocation: {
        addressLine1: "404 Acceptance Way",
        addressLine2: "Suite 16",
        city: "Jacksonville",
        region: "FL",
        postalCode: "32202",
        countryCode: "US",
        accessNotes: "Use the east service entrance.",
      },
    },
    events,
  };
}

function makeNotification(overrides = {}) {
  return {
    id: overrides.id ?? "f0171b86-7444-4358-a412-7c2ab75088d6",
    accountId: overrides.accountId ?? contractorId,
    type: overrides.type ?? "work",
    title: overrides.title ?? "Offer accepted",
    body: overrides.body ?? "Warehouse panel assist - Jacksonville, FL",
    actionHref: overrides.actionHref ?? `/app/work?activeWork=${activeWorkId}&job=${openJobId}`,
    sourceType: overrides.sourceType ?? "active_work",
    sourceId: overrides.sourceId ?? activeWorkId,
    priority: overrides.priority ?? "high",
    metadata: overrides.metadata ?? { activeWorkId, jobId: openJobId, offerId },
    readAt: overrides.readAt ?? null,
    createdAt: overrides.createdAt ?? "2026-06-28T15:31:00.000Z",
  };
}

function makeConversation(overrides = {}) {
  return {
    id: overrides.id ?? "f4e20a5f-0df0-40d0-bdc0-2bfac97ca41e",
    activeWorkId: overrides.activeWorkId ?? activeWorkId,
    jobId: overrides.jobId ?? openJobId,
    organizationId: overrides.organizationId ?? orgId,
    status: "open",
    activeWorkStatus: "active",
    createdByAccountId: overrides.createdByAccountId ?? contractorId,
    createdAt: "2026-06-28T15:31:00.000Z",
    updatedAt: "2026-06-28T15:31:00.000Z",
    job: {
      id: overrides.jobId ?? openJobId,
      title: "Warehouse panel assist",
      status: "closed",
      organization: { id: orgId, name: "RIVT Test Electric" },
      publicLocation: { city: "Jacksonville", region: "FL", countryCode: "US" },
    },
    participants: [
      {
        accountId: contractorId,
        role: "contractor",
        mutedUntil: null,
        lastReadAt: null,
        displayName: "RIVT Test Electric",
        headline: "Electrical contractor",
        serviceArea: { city: "Jacksonville", region: "FL" },
      },
      {
        accountId: tradespersonId,
        role: "tradesperson",
        mutedUntil: null,
        lastReadAt: null,
        displayName: "Riley Harper",
        headline: "Commercial electrician",
        serviceArea: { city: "Jacksonville", region: "FL" },
      },
    ],
    lastMessage: null,
    unreadCount: 1,
  };
}

function makeProject() {
  return {
    id: projectId,
    activeWorkId,
    jobId: openJobId,
    organizationId: orgId,
    status: "open",
    contractorAccountId: contractorId,
    tradespersonAccountId: tradespersonId,
    job: {
      title: "Warehouse panel assist",
      status: "closed",
      publicLocation: { city: "Jacksonville", region: "FL", countryCode: "US" },
    },
    entries: [],
    media: [],
    invoices: [],
    completionSubmissions: [],
    updatedAt: "2026-06-28T15:30:00.000Z",
  };
}

function makeState({ jobs = [makeJob()], applications = [], offers = [], activeWork = [], notifications = [], conversations = [] } = {}) {
  return {
    jobs: structuredClone(jobs),
    applications: structuredClone(applications),
    offers: structuredClone(offers),
    activeWork: structuredClone(activeWork),
    notifications: structuredClone(notifications),
    conversations: structuredClone(conversations),
    project: makeProject(),
  };
}

async function waitForServer() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch {
      // Vite is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Timed out waiting for Vite.");
}

function json(data, status = 200) {
  return { status, contentType: "application/json", body: JSON.stringify(data) };
}

function jobById(state, jobId) {
  const job = state.jobs.find((item) => item.id === jobId);
  if (!job) throw new Error(`Missing mocked job ${jobId}`);
  return job;
}

async function configurePage(page, account, state) {
  await page.addInitScript(() => {
    window.localStorage.setItem("rivt.localSetupDone.v1", "true");
  });

  await page.route("https://fonts.googleapis.com/**", (route) => route.fulfill({ status: 200, contentType: "text/css", body: "" }));
  await page.route("https://api.open-meteo.com/**", (route) => route.fulfill(json({ current_weather: { temperature: 76, weathercode: 1 } })));
  await page.route("**/*", (route) => {
    if (route.request().resourceType() === "image") return route.fulfill({ status: 204, body: "" });
    return route.fallback();
  });

  await page.route("**/api/v1/me", (route) => route.fulfill(json({ data: account })));
  await page.route("**/api/auth/providers", (route) => route.fulfill(json({ providers: {} })));
  await page.route("**/api/v1/push/config", (route) => route.fulfill(json({ data: { enabled: false, publicKey: null } })));
  await page.route("**/api/v1/sessions", (route) => route.fulfill(json({ data: { sessions: [] } })));
  await page.route("**/api/v1/profiles**", (route) => route.fulfill(json({ data: { profiles: [] } })));
  await page.route("**/api/v1/conversations", (route) => route.fulfill(json({ data: { conversations: state.conversations } })));
  await page.route(/\/api\/v1\/active-work\/[0-9a-f-]{36}\/conversation$/, (route) => {
    const id = new URL(route.request().url()).pathname.split("/").at(-2);
    const active = state.activeWork.find((item) => item.id === id);
    assert.ok(active, `Missing active work ${id}`);
    let conversation = state.conversations.find((item) => item.activeWorkId === id);
    if (!conversation) {
      conversation = makeConversation({ activeWorkId: id, jobId: active.jobId });
      state.conversations.unshift(conversation);
    }
    return route.fulfill(json({ data: { conversation } }));
  });
  await page.route(/\/api\/v1\/conversations\/[0-9a-f-]{36}\/messages$/, (route) => route.fulfill(json({ data: { messages: [] } })));
  await page.route("**/api/v1/notifications", (route) => {
    const notifications = state.notifications.filter((item) => item.accountId === account.id);
    const unreadCount = notifications.filter((item) => !item.readAt).length;
    return route.fulfill(json({ data: { notifications, unreadCount } }));
  });
  await page.route("**/api/v1/notifications/read", async (route) => {
    const body = route.request().postDataJSON();
    const now = new Date().toISOString();
    if (body.all) {
      state.notifications = state.notifications.map((item) => item.accountId === account.id ? { ...item, readAt: item.readAt ?? now } : item);
    } else if (Array.isArray(body.ids)) {
      state.notifications = state.notifications.map((item) => (
        item.accountId === account.id && body.ids.includes(item.id)
          ? { ...item, readAt: item.readAt ?? now }
          : item
      ));
    }
    const unreadCount = state.notifications.filter((item) => item.accountId === account.id && !item.readAt).length;
    return route.fulfill(json({ data: { unreadCount } }));
  });
  await page.route("**/api/v1/notification-preferences", (route) => route.fulfill(json({ data: { preferences: [] } })));
  await page.route("**/api/v1/tool-records**", (route) => route.fulfill(json({ data: { records: [] } })));
  await page.route("**/api/v1/standalone-projects**", (route) => route.fulfill(json({ data: { projects: [] } })));
  await page.route("**/api/storage", (route) => route.fulfill(json({ usedBytes: 0, objectCount: 0, plan: {} })));
  await page.route("**/api/v1/albums", (route) => route.fulfill(json({ data: { albums: [] } })));
  await page.route(/\/api\/v1\/albums\/[0-9a-f-]+$/, (route) => route.fulfill(json({ data: { album: { id: "album-empty", name: "Smoke album", photoCount: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), photos: [] } } })));
  await page.route("**/api/v1/shop-talk/posts**", (route) => route.fulfill(json({ data: { posts: [] } })));
  await page.route("**/api/v1/communities**", (route) => route.fulfill(json({ data: { communities: [] } })));
  await page.route("**/api/v1/shop-talk/reactions/batch", (route) => route.fulfill(json({
    data: {
      reactions: [],
      reputation: { reactionsGiven: 0, upvotesGiven: 0, downvotesGiven: 0, targetsReacted: 0, lastReactedAt: null },
    },
  })));

  await page.route(/\/api\/v1\/jobs\/[0-9a-f-]{36}\/application-draft$/, async (route) => {
    const jobId = new URL(route.request().url()).pathname.split("/").at(-2);
    const body = route.request().postDataJSON();
    const existing = state.applications.find((item) => item.jobId === jobId && item.applicantAccountId === account.id);
    const next = existing ?? makeApplication("draft", body.message);
    next.status = "draft";
    next.message = body.message;
    next.proposal = body.proposedAmountCents && body.proposedUnit
      ? { amountCents: body.proposedAmountCents, unit: body.proposedUnit }
      : null;
    next.jobId = jobId;
    next.applicantAccountId = account.id;
    if (!existing) state.applications.unshift(next);
    return route.fulfill(json({ data: { application: next } }));
  });

  await page.route(/\/api\/v1\/jobs\/[0-9a-f-]{36}\/applications$/, async (route) => {
    const jobId = new URL(route.request().url()).pathname.split("/").at(-2);
    if (route.request().method() === "GET") {
      return route.fulfill(json({ data: { applications: state.applications.filter((item) => item.jobId === jobId && item.status !== "draft") } }));
    }
    const body = route.request().postDataJSON();
    const existing = state.applications.find((item) => item.jobId === jobId && item.applicantAccountId === account.id);
    const next = existing ?? makeApplication("submitted", body.message);
    next.status = "submitted";
    next.message = body.message;
    next.proposal = body.proposedAmountCents && body.proposedUnit
      ? { amountCents: body.proposedAmountCents, unit: body.proposedUnit }
      : null;
    next.jobId = jobId;
    next.applicantAccountId = account.id;
    next.submittedAt = new Date().toISOString();
    if (!existing) state.applications.unshift(next);
    return route.fulfill(json({ data: { application: next } }));
  });

  await page.route(/\/api\/v1\/jobs\/[0-9a-f-]{36}\/(publish|pause|resume|close)$/, async (route) => {
    const parts = new URL(route.request().url()).pathname.split("/");
    const action = parts.at(-1);
    const jobId = parts.at(-2);
    const job = jobById(state, jobId);
    const nextStatus = { publish: "open", pause: "paused", resume: "open", close: "closed" }[action];
    job.status = nextStatus;
    job.version += 1;
    job.updatedAt = new Date().toISOString();
    if (action === "publish") job.publishedAt = job.updatedAt;
    if (action === "pause") job.pausedAt = job.updatedAt;
    if (action === "close") job.closedAt = job.updatedAt;
    job.events.push({
      id: `event-${action}-${job.version}`,
      type: action,
      fromStatus: null,
      toStatus: nextStatus,
      reason: "UI smoke action",
      occurredAt: job.updatedAt,
    });
    return route.fulfill(json({ data: { job } }));
  });

  await page.route(/\/api\/v1\/jobs\/[0-9a-f-]{36}$/, (route) => {
    const jobId = new URL(route.request().url()).pathname.split("/").at(-1);
    const job = jobById(state, jobId);
    if (route.request().method() === "PATCH") {
      const body = route.request().postDataJSON();
      assert.notEqual(body.preferredStartDate, "", "job editor must not send an empty preferredStartDate string");
      if (body.preferredStartDate !== null && body.preferredStartDate !== undefined) {
        assert.match(body.preferredStartDate, /^\d{4}-\d{2}-\d{2}$/, "job editor must send preferredStartDate as YYYY-MM-DD");
      }
      if (body.applicationDeadline !== null && body.applicationDeadline !== undefined) {
        assert.match(body.applicationDeadline, /^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/, "job editor must send applicationDeadline as an offset datetime");
      }
      Object.assign(job, {
        title: body.title ?? job.title,
        summary: body.summary ?? job.summary,
        scopeDescription: body.scopeDescription ?? job.scopeDescription,
        difficulty: body.difficulty ?? job.difficulty,
        workType: body.workType ?? job.workType,
        preferredStartDate: body.preferredStartDate ?? null,
        applicationDeadline: body.applicationDeadline ?? null,
        insuranceRequired: body.insuranceRequired ?? job.insuranceRequired,
        version: job.version + 1,
        updatedAt: new Date().toISOString(),
      });
    }
    return route.fulfill(json({ data: { job } }));
  });

  await page.route(/\/api\/v1\/applications\/[0-9a-f-]{36}\/(shortlist|decline|withdraw)$/, async (route) => {
    const parts = new URL(route.request().url()).pathname.split("/");
    const action = parts.at(-1);
    const id = parts.at(-2);
    const application = state.applications.find((item) => item.id === id);
    assert.ok(application, `Missing application ${id}`);
    application.status = { shortlist: "shortlisted", decline: "declined", withdraw: "withdrawn" }[action];
    application.updatedAt = new Date().toISOString();
    return route.fulfill(json({ data: { application } }));
  });

  await page.route(/\/api\/v1\/applications\/[0-9a-f-]{36}\/offer$/, async (route) => {
    const id = new URL(route.request().url()).pathname.split("/").at(-2);
    const application = state.applications.find((item) => item.id === id);
    assert.ok(application, `Missing application ${id}`);
    application.status = "offered";
    const body = route.request().postDataJSON();
    const offer = makeOffer("pending");
    offer.agreedCompensation = { amountCents: body.agreedAmountCents, unit: body.agreedUnit };
    state.offers = [offer];
    return route.fulfill(json({ data: { offer, application } }));
  });

  await page.route("**/api/v1/applications", (route) =>
    route.fulfill(json({ data: { applications: state.applications.filter((item) => item.applicantAccountId === account.id) } })),
  );

  await page.route(/\/api\/v1\/offers\/[0-9a-f-]{36}\/(accept|decline)$/, async (route) => {
    const parts = new URL(route.request().url()).pathname.split("/");
    const action = parts.at(-1);
    const id = parts.at(-2);
    const offer = state.offers.find((item) => item.id === id);
    assert.ok(offer, `Missing offer ${id}`);
    offer.status = action === "accept" ? "accepted" : "declined";
    offer.updatedAt = new Date().toISOString();
    if (action === "accept") {
      const active = makeActiveWork();
      state.activeWork = [active];
      return route.fulfill(json({ data: { offer, activeWork: active } }));
    }
    return route.fulfill(json({ data: { offer } }));
  });

  await page.route("**/api/v1/offers", (route) =>
    route.fulfill(json({ data: { offers: state.offers.filter((item) => item.recipientAccountId === account.id || item.contractorAccountId === account.id) } })),
  );

  await page.route(/\/api\/v1\/active-work\/[0-9a-f-]{36}\/(reschedule|cancel)$/, async (route) => {
    const parts = new URL(route.request().url()).pathname.split("/");
    const action = parts.at(-1);
    const id = parts.at(-2);
    const active = state.activeWork.find((item) => item.id === id);
    assert.ok(active, `Missing active work ${id}`);
    active.events.unshift({
      id: `active-${action}`,
      type: action === "reschedule" ? "reschedule_requested" : "cancel_requested",
      fromStatus: "active",
      toStatus: active.status,
      reason: route.request().postDataJSON().reason,
      occurredAt: new Date().toISOString(),
    });
    return route.fulfill(json({ data: { activeWork: active } }));
  });

  await page.route(/\/api\/v1\/active-work\/[0-9a-f-]{36}\/project$/, (route) =>
    route.fulfill(json({ data: { project: state.project } })),
  );

  await page.route(/\/api\/v1\/projects\/[0-9a-f-]{36}$/, (route) =>
    route.fulfill(json({ data: { project: state.project } })),
  );

  await page.route(/\/api\/v1\/projects\/[0-9a-f-]{36}\/entries$/, async (route) => {
    const body = route.request().postDataJSON();
    const entry = {
      id: `entry-${state.project.entries.length + 1}`,
      projectId: state.project.id,
      actorAccountId: account.id,
      entryType: "note",
      body: body.body ?? "",
      checklist: {},
      metadata: {},
      createdAt: new Date().toISOString(),
    };
    state.project.entries.unshift(entry);
    state.project.updatedAt = entry.createdAt;
    return route.fulfill(json({ data: { entry } }));
  });

  await page.route(/\/api\/v1\/active-work\/?(?:\?.*)?$/, (route) =>
    route.fulfill(json({ data: { activeWork: state.activeWork.filter((item) => item.contractorAccountId === account.id || item.tradespersonAccountId === account.id) } })),
  );

  await page.route(/\/api\/v1\/jobs(?:\?.*)?$/, (route) => {
    const jobs = account.primaryRole === "tradesperson"
      ? state.jobs.filter((item) => item.status === "open")
      : state.jobs;
    return route.fulfill(json({ data: { jobs }, meta: { nextCursor: null } }));
  });
}

async function assertNoHorizontalOverflow(page, label) {
  const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  assert.equal(hasOverflow, false, `${label} has horizontal overflow`);
}

async function assertInViewport(locator, label) {
  const box = await locator.boundingBox();
  assert.ok(box, `${label} must have a layout box`);
  const viewport = locator.page().viewportSize();
  assert.ok(viewport, "Expected a configured viewport");
  assert.ok(box.y >= 0 && box.y < viewport.height, `${label} must be visible without another scroll`);
}

async function clickJob(page, title) {
  const jobRow = page.locator(".v2-job-row-inner").filter({ hasText: title });
  await jobRow.first().waitFor({ state: "visible", timeout: 15_000 });
  assert.equal(await jobRow.count(), 1, `Expected one job row for ${title}`);
  await jobRow.click();
}

async function clickWorkStage(page, label) {
  const stage = page.locator(".v2-work-stage-switcher button").filter({ hasText: label });
  assert.equal(await stage.count(), 1, `Expected one Work stage for ${label}`);
  await stage.click();
}

async function clickStatusTab(page, label) {
  const stageForLabel = {
    Open: "Browse",
    Drafts: "Hiring",
    Pipeline: "Hiring",
    Calendar: "Hiring",
    Templates: "Hiring",
    Paused: "Archive",
    Closed: "Archive",
  }[label];
  if (stageForLabel) await clickWorkStage(page, stageForLabel);
  if (label === "Open") return;

  const mobileSelect = page.locator(".v2-mobile-work-select select").first();
  if (await mobileSelect.isVisible()) {
    const values = { Open: "open", Drafts: "draft", Paused: "paused", Closed: "closed", Pipeline: "pipeline", Calendar: "calendar", Templates: "templates" };
    const value = values[label];
    assert.ok(value, `Expected a mobile status value for ${label}`);
    await mobileSelect.selectOption(value);
    return;
  }
  const tab = page.locator(".v2-section-tabs button").filter({ hasText: label });
  assert.equal(await tab.count(), 1, `Expected one status tab for ${label}`);
  await tab.click();
}

async function runContractorFlow(page) {
  const draft = makeJob({ id: draftJobId, title: "Electrical service punch list", status: "draft", preferredStartDate: futureDate(7) });
  const open = makeJob();
  const state = makeState({ jobs: [open, draft], applications: [makeApplication("submitted")] });
  await configurePage(page, contractorAccount, state);

  await page.goto(`${baseUrl}/app/work`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Work", exact: true }).waitFor({ timeout: 15_000 });
  await assertNoHorizontalOverflow(page, "Contractor Work");

  await clickStatusTab(page, "Drafts");
  await clickJob(page, "Electrical service punch list");
  await page.getByRole("button", { name: "Edit" }).first().click();
  await page.getByRole("dialog", { name: "Edit job" }).waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: "Save draft" }).click();
  assert.equal(await page.getByText(/Request validation failed/i).count(), 0, "draft edit should save without preferredStartDate validation failure");
  await page.getByRole("button", { name: "Publish" }).waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: "Publish" }).click();
  assert.equal(await page.getByText(/Request validation failed/i).count(), 0, "ready draft should publish without validation failure");

  await clickWorkStage(page, "Browse");
  await clickJob(page, "Electrical service punch list");
  await page.getByText("Exact address stays private", { exact: true }).waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: "All work" }).click();
  await clickJob(page, "Warehouse panel assist");
  await page.getByText("Riley Harper", { exact: true }).waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: "Shortlist" }).click();
  await page.getByText("shortlisted", { exact: true }).waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: "Prepare offer" }).click();
  await page.getByLabel("Amount").fill("825");
  await page.getByRole("button", { name: "Send offer" }).click();
  await page.getByText("Offer sent", { exact: true }).waitFor({ timeout: 15_000 });
  await assertNoHorizontalOverflow(page, "Contractor applicant workflow");
  await page.screenshot({ path: path.join(screenshotDir, "contractor-work-lifecycle.png"), fullPage: true });
}

async function runTradespersonApplicationFlow(page) {
  const state = makeState({ jobs: [makeJob()] });
  await configurePage(page, tradespersonAccount, state);

  await page.goto(`${baseUrl}/app/work`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Work", exact: true }).waitFor({ timeout: 15_000 });
  await clickJob(page, "Warehouse panel assist");
  await page.getByLabel("Message to contractor").fill("I can start Wednesday and bring tester, labels, and basic hand tools.");
  await page.getByRole("button", { name: "Save draft" }).click();
  await page.getByText("Draft saved", { exact: true }).waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: "Submit" }).click();
  await page.getByText("Application submitted", { exact: true }).waitFor({ timeout: 15_000 });
  await assertNoHorizontalOverflow(page, "Tradesperson application workflow");
  await page.screenshot({ path: path.join(screenshotDir, "tradesperson-apply-workflow.png"), fullPage: true });
}

async function runTradespersonOfferFlow(page) {
  const offeredApplication = makeApplication("offered");
  const state = makeState({ jobs: [makeJob()], applications: [offeredApplication], offers: [makeOffer("pending")] });
  await configurePage(page, tradespersonAccount, state);

  await page.goto(`${baseUrl}/app/work`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Work", exact: true }).waitFor({ timeout: 15_000 });
  await clickJob(page, "Warehouse panel assist");
  await page.getByText("You have an offer", { exact: true }).waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: "Accept work" }).click();
  await page.getByLabel("Active work workflow").getByText("Tradesperson workspace", { exact: true }).waitFor({ timeout: 15_000 });

  await page.goto(`${baseUrl}/app/work`, { waitUntil: "networkidle" });
  const activeShortcut = page.locator(".v2-active-work-shortcut");
  await activeShortcut.getByText("Active now", { exact: true }).waitFor({ timeout: 15_000 });
  const activeStripBox = await activeShortcut.boundingBox();
  const workToolbarBox = await page.locator(".v2-work-toolbar").boundingBox();
  assert.ok(activeStripBox && workToolbarBox && activeStripBox.y < workToolbarBox.y, "Active work must appear before work browsing controls");
  await assertInViewport(activeShortcut, "Active-work shortcut");
  await clickWorkStage(page, "Active");
  await page.getByLabel("Active work workflow").getByText("Active", { exact: true }).waitFor({ timeout: 15_000 });
  await page.screenshot({ path: path.join(screenshotDir, "active-work-priority.png"), fullPage: true });

  await page.goto(`${baseUrl}/app/home`, { waitUntil: "networkidle" });
  const homeActiveWork = page.getByLabel("Active work");
  await homeActiveWork.getByText("You're active now", { exact: true }).waitFor({ timeout: 15_000 });
  await homeActiveWork.getByRole("button", { name: "Open workspace" }).click();
  await page.waitForURL(new RegExp(`/app/work\\?activeWork=${activeWorkId}`), { timeout: 15_000 });
  await page.getByLabel("Active work workflow").getByText("Active", { exact: true }).waitFor({ timeout: 15_000 });
  const workspaceHeading = page.getByRole("heading", { name: "Warehouse panel assist", exact: true });
  await assertInViewport(workspaceHeading, "Active-work workspace heading");
  assert.equal(await workspaceHeading.evaluate((element) => document.activeElement === element), true, "Active-work workspace heading should receive focus after opening");
  const activeWorkspace = page.getByLabel("Active work workflow");
  await activeWorkspace.getByText("Document the job and submit closeout", { exact: true }).waitFor({ timeout: 15_000 });
  await page.getByLabel("Exact jobsite").getByText("404 Acceptance Way, Suite 16, Jacksonville, FL 32202", { exact: true }).waitFor({ timeout: 15_000 });
  await page.getByLabel("Exact jobsite").getByText("Use the east service entrance.", { exact: true }).waitFor({ timeout: 15_000 });
  const activeWorkspaceBox = await activeWorkspace.boundingBox();
  const jobSummaryBox = await page.locator(".v2-job-description").boundingBox();
  assert.ok(activeWorkspaceBox && jobSummaryBox && activeWorkspaceBox.y < jobSummaryBox.y, "Today must put active-work actions before the job summary");
  await activeWorkspace.getByRole("button", { name: "Messages" }).waitFor({ timeout: 15_000 });
  await activeWorkspace.getByRole("button", { name: "Add photos" }).waitFor({ timeout: 15_000 });
  await activeWorkspace.getByRole("button", { name: "Daily log" }).waitFor({ timeout: 15_000 });
  await activeWorkspace.getByRole("button", { name: "Submit completion" }).waitFor({ timeout: 15_000 });
  await activeWorkspace.getByText("Job controls", { exact: true }).waitFor({ timeout: 15_000 });
  assert.equal(await activeWorkspace.locator("details.v2-active-work-controls").evaluate((element) => !element.open), true, "Rare job controls should start collapsed");
  await activeWorkspace.getByRole("button", { name: "Add photos" }).click();
  await page.waitForURL(new RegExp(`/app/camera\\?activeWork=${activeWorkId}`), { timeout: 15_000 });
  await page.getByText("Live project feed", { exact: true }).waitFor({ timeout: 15_000 });
  await page.getByLabel("Camera").locator(".v2-job-photos-job-name").getByText("Warehouse panel assist", { exact: true }).waitFor({ timeout: 15_000 });

  await page.goto(`${baseUrl}/app/work`, { waitUntil: "networkidle" });
  await clickWorkStage(page, "Active");
  await page.getByLabel("Active work workflow").getByText("Active", { exact: true }).waitFor({ timeout: 15_000 });
  await page.getByLabel("Active work workflow").getByRole("button", { name: "Daily log" }).click();
  await page.getByRole("heading", { name: "Jobsite", exact: true }).waitFor({ timeout: 15_000 });
  await page.getByLabel("Jobsite sections").getByRole("button", { name: "Log", exact: true }).waitFor({ timeout: 15_000 });
  await page.getByLabel("Site / job").waitFor({ timeout: 15_000 });

  await page.goto(`${baseUrl}/app/work`, { waitUntil: "networkidle" });
  await clickWorkStage(page, "Active");
  await page.getByLabel("Active work workflow").getByText("Active", { exact: true }).waitFor({ timeout: 15_000 });
  await page.getByLabel("Active work workflow").getByRole("button", { name: "Add photos" }).click();
  await page.waitForURL(new RegExp(`/app/camera\\?activeWork=${activeWorkId}`), { timeout: 15_000 });
  await page.getByText("Live project feed", { exact: true }).waitFor({ timeout: 15_000 });
  await page.getByLabel("Camera").locator(".v2-job-photos-job-name").getByText("Warehouse panel assist", { exact: true }).waitFor({ timeout: 15_000 });

  await page.goto(`${baseUrl}/app/work`, { waitUntil: "networkidle" });
  await clickWorkStage(page, "Active");
  await page.getByRole("button", { name: "Create invoice" }).click();
  await page.getByRole("heading", { name: "Invoice", exact: true }).first().waitFor({ timeout: 15_000 });
  await assertNoHorizontalOverflow(page, "Active work tool bridge");
  await page.screenshot({ path: path.join(screenshotDir, "active-work-tool-bridge.png"), fullPage: true });
}

async function runNotificationActiveWorkFlow(page) {
  const active = makeActiveWork();
  const closedJob = makeJob({ status: "closed" });
  const state = makeState({
    jobs: [closedJob],
    activeWork: [active],
    notifications: [makeNotification()],
    conversations: [makeConversation()],
  });
  await configurePage(page, contractorAccount, state);

  await page.goto(`${baseUrl}/app/home`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Notifications" }).click();
  const notificationsDialog = page.getByRole("dialog", { name: "Notifications" });
  await notificationsDialog.waitFor({ timeout: 15_000 });
  await notificationsDialog.getByRole("button", { name: /Open work: Offer accepted/i }).click();
  const contractorWorkflow = page.getByLabel("Active work workflow");
  await contractorWorkflow.getByText("Contractor workspace", { exact: true }).waitFor({ timeout: 15_000 });
  await contractorWorkflow.getByText("Track progress and approve closeout", { exact: true }).waitFor({ timeout: 15_000 });
  await contractorWorkflow.getByRole("button", { name: "Open closeout record" }).waitFor({ timeout: 15_000 });
  await assertNoHorizontalOverflow(page, "Notification active work route");
  await page.screenshot({ path: path.join(screenshotDir, "notification-active-work-route.png"), fullPage: true });
}

async function runColdStartActiveWorkLink(page) {
  const active = makeActiveWork();
  const closedJob = makeJob({ status: "closed" });
  const state = makeState({ jobs: [closedJob], activeWork: [active] });
  await configurePage(page, contractorAccount, state);

  await page.goto(`${baseUrl}/app/work?activeWork=${activeWorkId}&job=${openJobId}`, { waitUntil: "networkidle" });
  await page.getByLabel("Active work workflow").getByText("Contractor workspace", { exact: true }).waitFor({ timeout: 15_000 });
  await assertNoHorizontalOverflow(page, "Cold-start active work deep link");
}

async function runScopedToolContextFlow(page) {
  const active = makeActiveWork();
  const unrelatedJob = makeJob({ id: draftJobId, title: "Unrelated service call", status: "open" });
  const closedJob = makeJob({ status: "closed" });
  const state = makeState({ jobs: [unrelatedJob, closedJob], activeWork: [active] });
  await configurePage(page, contractorAccount, state);

  await page.goto(`${baseUrl}/app/tools?tool=invoice&activeWork=${activeWorkId}`, { waitUntil: "networkidle" });
  await page.getByLabel("Current job: Warehouse panel assist").waitFor({ timeout: 15_000 });
  await page.getByRole("heading", { name: "Invoice", exact: true }).first().waitFor({ timeout: 15_000 });
  await assertNoHorizontalOverflow(page, "Scoped invoice tool route");

  await page.goto(`${baseUrl}/app/tools?tool=daily-log&activeWork=${activeWorkId}`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Jobsite", exact: true }).waitFor({ timeout: 15_000 });
  await page.getByLabel("Jobsite sections").getByRole("button", { name: "Log", exact: true }).waitFor({ timeout: 15_000 });
  await page.getByLabel("Current job: Warehouse panel assist").waitFor({ timeout: 15_000 });
  await page.getByLabel("Site / job").waitFor({ timeout: 15_000 });
  const dailyLogSite = await page.getByLabel("Site / job").inputValue();
  assert.match(dailyLogSite, /Warehouse panel assist/);
  assert.equal(dailyLogSite.includes("Unrelated service call"), false);
  await assertNoHorizontalOverflow(page, "Scoped daily log route");
  await page.screenshot({ path: path.join(screenshotDir, "scoped-job-tools.png"), fullPage: true });
}

async function runNotificationProjectPhotoFlow(page) {
  const active = makeActiveWork();
  const closedJob = makeJob({ status: "closed" });
  const state = makeState({
    jobs: [closedJob],
    activeWork: [active],
    notifications: [makeNotification({
      id: "dd13a602-febe-421e-9b26-8da6131634f3",
      title: "Photo uploaded",
      body: "Warehouse panel assist - progress photo saved",
      actionHref: `/app/camera?activeWork=${activeWorkId}`,
      sourceType: "project",
      sourceId: projectId,
      metadata: { activeWorkId, projectId, jobId: openJobId },
    })],
  });
  await configurePage(page, contractorAccount, state);

  await page.goto(`${baseUrl}/app/home`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Notifications" }).click();
  const notificationsDialog = page.getByRole("dialog", { name: "Notifications" });
  await notificationsDialog.waitFor({ timeout: 15_000 });
  await notificationsDialog.getByRole("button", { name: /Open photos: Photo uploaded/i }).click();
  await page.waitForURL(new RegExp(`/app/camera\\?activeWork=${activeWorkId}`), { timeout: 15_000 });
  await page.getByText("Live project feed", { exact: true }).waitFor({ timeout: 15_000 });
  await page.getByLabel("Camera").locator(".v2-job-photos-job-name").getByText("Warehouse panel assist", { exact: true }).waitFor({ timeout: 15_000 });
  await assertNoHorizontalOverflow(page, "Notification project photo route");
  await page.screenshot({ path: path.join(screenshotDir, "notification-project-photo-route.png"), fullPage: true });
}

async function runNotificationProjectRecordFlow(page) {
  const active = makeActiveWork();
  const closedJob = makeJob({ status: "closed" });
  const state = makeState({
    jobs: [closedJob],
    activeWork: [active],
    notifications: [makeNotification({
      id: "a953efc2-f1c8-4a63-918b-8be0b3ebcb54",
      title: "Completion submitted",
      body: "Warehouse panel assist - review the closeout record",
      actionHref: `/app/tools/records?activeWork=${activeWorkId}&project=${projectId}`,
      sourceType: "project",
      sourceId: projectId,
      metadata: { activeWorkId, projectId, jobId: openJobId },
    })],
  });
  await configurePage(page, contractorAccount, state);

  await page.goto(`${baseUrl}/app/home`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Notifications" }).click();
  const notificationsDialog = page.getByRole("dialog", { name: "Notifications" });
  await notificationsDialog.waitFor({ timeout: 15_000 });
  await notificationsDialog.getByRole("button", { name: /Open closeout: Completion submitted/i }).click();
  await page.waitForURL(/\/app\/tools\/records\?/, { timeout: 15_000 });
  await page.getByLabel("Job proof packet").waitFor({ timeout: 15_000 });
  await assertNoHorizontalOverflow(page, "Notification project record route");
}

let browser;

try {
  await waitForServer();
  await fs.rm(screenshotDir, { recursive: true, force: true });
  await fs.mkdir(screenshotDir, { recursive: true });
  browser = await chromium.launch({ headless: true });

  for (const [name, flow] of [
    ["contractor", runContractorFlow],
    ["tradesperson-apply", runTradespersonApplicationFlow],
    ["tradesperson-offer", runTradespersonOfferFlow],
    ["notification-active-work", runNotificationActiveWorkFlow],
    ["cold-start-active-work", runColdStartActiveWorkLink],
    ["scoped-tool-context", runScopedToolContextFlow],
    ["notification-project-photo", runNotificationProjectPhotoFlow],
    ["notification-project-record", runNotificationProjectRecordFlow],
  ]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
    const page = await context.newPage();
    const errors = [];
    const failedRequests = [];
    page.on("console", (message) => {
      if (message.type() === "error" && message.text() !== "Failed to load resource: net::ERR_FAILED") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("requestfailed", (request) => failedRequests.push(`${request.failure()?.errorText ?? "request failed"}: ${request.url()}`));
    try {
      await flow(page);
    } catch (error) {
      const failurePath = path.join(screenshotDir, `${name}-failure.png`);
      await page.screenshot({ path: failurePath, fullPage: true }).catch(() => undefined);
      const bodyText = await page.locator("body").innerText().catch(() => "<body unavailable>");
      console.error(`${name} failed at ${page.url()}\n${bodyText.slice(0, 2_000)}\nScreenshot: ${failurePath}`);
      throw error;
    }
    assert.deepEqual(errors, [], `${name} console/page errors\n${failedRequests.join("\n")}`);
    await context.close();
  }

  console.log(`Work lifecycle UI smoke passed. Screenshots: ${screenshotDir}`);
} finally {
  await browser?.close();
  vite.kill();
}
