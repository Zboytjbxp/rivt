import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";

const port = 5195;
const baseUrl = `http://127.0.0.1:${port}`;
const projectRoot = process.cwd();
const viteBin = path.join(projectRoot, "node_modules", "vite", "bin", "vite.js");
const screenshotDir = path.join(os.tmpdir(), "rivt-tools-pass");
const quickEntryHoldMs = 380;

const vite = spawn(process.execPath, [viteBin, "--host", "127.0.0.1", "--port", String(port)], {
  cwd: projectRoot,
  env: { ...process.env, VITE_ENABLE_GUEST_DEMO: "false" },
  stdio: ["ignore", "ignore", "inherit"],
});

const account = {
  id: "tools-ui-account",
  status: "active",
  primaryRole: "contractor",
  email: "rivttesting@gmail.com",
  provider: "email",
  emailVerified: true,
  profile: {
    displayName: "Michael Test",
    headline: "Contractor",
    bio: "",
    locationText: "Jacksonville, FL",
    visibility: "network",
    onboardingStatus: "complete",
    serviceArea: { city: "Jacksonville", region: "FL", countryCode: "US", radiusMiles: 25 },
    availabilityStatus: "available",
    contactEmailVisibility: "private",
    phoneE164: null,
    phoneVisibility: "private",
    avatarUploadId: null,
    trades: [{ code: "electrical", name: "Electrical", primary: true }],
  },
  organizations: [{ id: "org-tools-ui", name: "RIVT Test Crew", role: "owner" }],
  capabilities: {
    canCompleteOnboarding: false,
    canPostWork: true,
    canApplyToWork: false,
    canPublishProfile: true,
  },
};

const activeWorkItem = {
  id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
  jobId: "tools-job-1",
  offerId: "tools-offer-1",
  organizationId: "org-tools-ui",
  contractorAccountId: account.id,
  tradespersonAccountId: "tools-tradesperson-1",
  status: "active",
  startedAt: "2026-06-21T12:00:00.000Z",
  completedAt: null,
  cancelledAt: null,
  createdAt: "2026-06-21T12:00:00.000Z",
  updatedAt: "2026-06-21T12:00:00.000Z",
  job: {
    id: "tools-job-1",
    title: "Tenant Build-Out",
    status: "accepted",
    organization: { id: "org-tools-ui", name: "RIVT Test Crew" },
    publicLocation: { city: "Jacksonville", region: "FL", countryCode: "US" },
  },
  events: [],
};

const projectRecord = {
  id: "tools-project-1",
  activeWorkId: activeWorkItem.id,
  jobId: activeWorkItem.jobId,
  organizationId: activeWorkItem.organizationId,
  status: "open",
  contractorAccountId: account.id,
  tradespersonAccountId: activeWorkItem.tradespersonAccountId,
  job: {
    title: activeWorkItem.job.title,
    status: "accepted",
    publicLocation: activeWorkItem.job.publicLocation,
  },
  entries: [],
  media: [],
  invoices: [],
  completionSubmissions: [],
  updatedAt: "2026-06-21T12:05:00.000Z",
};

const defaultPrivateAlbum = {
  id: "dddddddd-dddd-dddd-dddd-dddddddddddd",
  accountId: account.id,
  name: "Private photos",
  standaloneProjectId: null,
  isDefault: true,
  photoCount: 0,
  coverPhoto: null,
  createdAt: "2026-06-21T12:00:00.000Z",
  updatedAt: "2026-06-21T12:00:00.000Z",
};

const continuityInvoiceRecord = {
  id: "tool-record-continuity-invoice",
  recordType: "invoice_draft",
  localId: "invoice:quick:continuity",
  title: "Continuity invoice",
  status: "draft",
  recordDate: "2026-07-26",
  amountCents: 18750,
  standaloneProjectId: null,
  activeWorkId: null,
  customerId: null,
  payload: {
    invoiceNumber: "RIVT-CONTINUE",
    issueDate: "2026-07-26",
    dueDate: "2026-08-02",
    billTo: "Continuity Customer",
    payTo: "RIVT Test Contractor",
    terms: "Net 7",
    paymentMethod: "Pay by check.",
    taxPct: 0,
    recipientEmail: "continuity@example.com",
    recipientPhone: "",
    customerNote: "",
    templateName: "Standard",
    lines: [{ description: "Continuity work", qty: 1.5, rate: 125, kind: "labor" }],
  },
  createdAt: "2026-07-26T12:00:00.000Z",
  updatedAt: "2026-07-26T12:00:00.000Z",
};

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

async function configurePage(page) {
  await page.addInitScript(() => {
    localStorage.setItem("rivt.priceBook.v1", JSON.stringify([{
      id: "saved-price-1",
      name: "3/4 plywood",
      unit: "sheet",
      price: 52.75,
      supplier: "Local yard",
      notes: "Birch",
      updatedAt: "2026-07-14T12:00:00.000Z",
    }]));
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => {
          const canvas = document.createElement("canvas");
          canvas.width = 640;
          canvas.height = 480;
          const context = canvas.getContext("2d");
          if (context) {
            context.fillStyle = "#101820";
            context.fillRect(0, 0, canvas.width, canvas.height);
            context.fillStyle = "#ff4b00";
            context.fillRect(48, 48, 220, 120);
            context.fillStyle = "#ffffff";
            context.font = "42px sans-serif";
            context.fillText("RIVT", 72, 124);
          }
          return canvas.captureStream(5);
        },
      },
    });
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: (success) => success({
          coords: {
            latitude: 30.36078,
            longitude: -81.5697,
            accuracy: 8,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
            toJSON: () => ({}),
          },
          timestamp: Date.now(),
        }),
      },
    });
  });
  await page.route("https://api.open-meteo.com/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        latitude: 30.36078,
        longitude: -81.5697,
        current_weather: { temperature: 82, weathercode: 0, windspeed: 4 },
      }),
    }),
  );
  let mediaCounter = 0;
  let rejectNextMediaUpload = true;
  const pageProjectRecord = {
    ...projectRecord,
    entries: [...projectRecord.entries],
    media: [],
    invoices: [],
    completionSubmissions: [...projectRecord.completionSubmissions],
  };
  let savedProjectInvoice = null;
  await page.route(`**/api/v1/active-work/${activeWorkItem.id}/project`, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { project: pageProjectRecord } }) }),
  );
  await page.route(`**/api/v1/active-work/${activeWorkItem.id}/invoices`, (route) => {
    const input = route.request().postDataJSON();
    savedProjectInvoice = {
      id: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",
      projectId: projectRecord.id,
      activeWorkId: activeWorkItem.id,
      createdByAccountId: account.id,
      invoiceNumber: input.invoiceNumber,
      billTo: input.billTo,
      payTo: input.payTo,
      terms: input.terms,
      paymentMethod: input.paymentMethod,
      recipientEmail: input.recipientEmail,
      recipientPhone: input.recipientPhone,
      status: "draft",
      lineItems: input.lineItems,
      sourceEstimate: input.sourceEstimate,
      subtotalCents: input.lineItems.reduce((sum, line) => sum + Math.round(line.quantity * line.rateCents), 0),
      taxCents: input.taxCents,
      totalCents: input.lineItems.reduce((sum, line) => sum + Math.round(line.quantity * line.rateCents), 0) + input.taxCents,
      paidCents: 0,
      balanceCents: input.lineItems.reduce((sum, line) => sum + Math.round(line.quantity * line.rateCents), 0) + input.taxCents,
      sentAt: null,
      paidAt: null,
      voidedAt: null,
      createdAt: "2026-07-25T12:00:00.000Z",
      updatedAt: "2026-07-25T12:00:00.000Z",
      payments: [],
      onlinePayments: [],
    };
    pageProjectRecord.invoices = [savedProjectInvoice];
    return route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ data: { invoice: savedProjectInvoice } }),
    });
  });
  await page.route("**/api/v1/payments/connect/status", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          connect: {
            provider: "stripe_connect",
            providerConfigured: true,
            webhookConfigured: true,
            missing: [],
            connected: true,
            onboardingStatus: "ready",
            achPaymentsStatus: "active",
            chargesEnabled: true,
            payoutsEnabled: true,
            detailsSubmitted: true,
            ready: true,
            lastSyncedAt: "2026-07-25T12:00:00.000Z",
          },
        },
      }),
    }),
  );
  await page.route("**/api/v1/project-invoices/*/bank-payment-link", (route) => {
    const paymentRequest = {
      id: "ffffffff-ffff-ffff-ffff-ffffffffffff",
      invoiceId: savedProjectInvoice?.id ?? "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",
      amountCents: savedProjectInvoice?.balanceCents ?? 10000,
      refundedCents: 0,
      currency: "usd",
      status: "open",
      paymentMethodType: null,
      checkoutUrl: "https://checkout.stripe.test/rivt-ach",
      paymentUrl: "https://rivt.example/pay/ffffffff-ffff-ffff-ffff-ffffffffffff",
      expiresAt: "2026-07-26T12:00:00.000Z",
      paidAt: null,
      failedAt: null,
      disputedAt: null,
      refundedAt: null,
      createdAt: "2026-07-25T12:00:00.000Z",
      updatedAt: "2026-07-25T12:00:00.000Z",
    };
    return route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ data: { paymentRequest } }),
    });
  });
  let toolInvoicePaymentRequest = null;
  await page.route("**/api/v1/tool-invoices/*/bank-payment-link", (route) => {
    toolInvoicePaymentRequest = {
      id: "abababab-abab-4bab-8bab-abababababab",
      invoiceId: null,
      toolRecordId: "cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd",
      amountCents: 277000,
      refundedCents: 0,
      currency: "usd",
      status: "open",
      paymentMethodType: null,
      checkoutUrl: "https://checkout.stripe.test/rivt-quick-use-ach",
      paymentUrl: "https://rivt.example/pay/abababab-abab-4bab-8bab-abababababab",
      expiresAt: "2026-07-26T12:00:00.000Z",
      paidAt: null,
      failedAt: null,
      disputedAt: null,
      refundedAt: null,
      createdAt: "2026-07-25T12:00:00.000Z",
      updatedAt: "2026-07-25T12:00:00.000Z",
    };
    return route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ data: { paymentRequest: toolInvoicePaymentRequest } }),
    });
  });
  await page.route("**/api/v1/tool-invoices/*/bank-payment", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { paymentRequest: toolInvoicePaymentRequest } }),
    }),
  );
  await page.route("**/api/v1/invoice-payments/cs_test_rivt_ach_status", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          payment: {
            invoiceNumber: "CLOSEOUT-001",
            payTo: "Project Electrician",
            amountCents: 69700,
            refundedCents: 0,
            currency: "usd",
            status: "processing",
            updatedAt: "2026-07-25T12:00:00.000Z",
          },
        },
      }),
    }),
  );
  await page.route(`**/api/v1/projects/${projectRecord.id}`, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { project: pageProjectRecord } }) }),
  );
  await page.route(`**/api/v1/projects/${projectRecord.id}/entries`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          entry: {
            id: "tools-daily-log-entry",
            projectId: projectRecord.id,
            actorAccountId: account.id,
            entryType: "note",
            body: JSON.parse(route.request().postData() || "{}").body ?? "Daily log",
            checklist: {},
            metadata: {},
            createdAt: "2026-06-21T13:00:00.000Z",
          },
        },
      }),
    }),
  );
  await page.route(`**/api/v1/projects/${projectRecord.id}/media`, (route) => {
    if (rejectNextMediaUpload) {
      rejectNextMediaUpload = false;
      return route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "UPLOAD_TEMPORARILY_UNAVAILABLE", message: "Photo upload was interrupted." } }),
      });
    }
    mediaCounter += 1;
    const uploadId = `tools-media-upload-${mediaCounter}`;
    const createdAt = `2026-06-21T13:0${mediaCounter}:00.000Z`;
    const media = {
      id: `tools-media-${mediaCounter}`,
      projectId: projectRecord.id,
      uploadId,
      originalName: `photo-${mediaCounter}.jpg`,
      mimeType: "image/jpeg",
      sizeBytes: 2048,
      contentSha256: `tools-hash-${mediaCounter}`,
      mediaKind: "photo",
      status: "stored",
      reviewStatus: "accepted",
      failureReason: "",
      createdAt,
      signedUrl: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='220' viewBox='0 0 320 220'%3E%3Crect width='320' height='220' fill='%23101820'/%3E%3Crect x='36' y='42' width='248' height='136' rx='14' fill='%23ff4b00'/%3E%3Ctext x='160' y='124' text-anchor='middle' font-family='Arial' font-size='42' font-weight='700' fill='white'%3ERIVT%3C/text%3E%3C/svg%3E",
    };
    const entry = {
      id: `tools-media-entry-${mediaCounter}`,
      projectId: projectRecord.id,
      actorAccountId: account.id,
      entryType: "media",
      body: "Progress photo",
      checklist: {},
      metadata: { uploadId },
      createdAt,
    };
    pageProjectRecord.media = [media, ...pageProjectRecord.media];
    pageProjectRecord.entries = [entry, ...pageProjectRecord.entries];
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { media, entry } }),
    });
  });
  await page.route("**/api/v1/me", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: account }) }),
  );
  await page.route("**/api/auth/providers", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ providers: {} }) }),
  );
  await page.route("**/api/v1/push/config", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { enabled: false } }) }),
  );
  await page.route("**/api/v1/sessions", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { sessions: [] } }) }),
  );
  await page.route("**/api/v1/conversations", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { conversations: [] } }) }),
  );
  await page.route("**/api/v1/notifications", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { notifications: [], unreadCount: 0 } }) }),
  );
  await page.route("**/api/v1/notification-preferences", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { preferences: [] } }) }),
  );
  await page.route("**/api/v1/billing/status", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          plan: "free",
          active: false,
          status: "inactive",
          cancelAtPeriodEnd: false,
          provider: { checkoutConfigured: false, webhookConfigured: false, portalConfigured: false },
        },
      }),
    }),
  );
  await page.route("**/api/v1/shop-talk/posts", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { posts: [] } }) }),
  );
  await page.route("**/api/v1/communities", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { communities: [] } }) }),
  );
  await page.route("**/api/v1/albums", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { albums: [defaultPrivateAlbum] } }) }),
  );
  await page.route("**/api/v1/standalone-projects", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { projects: [] } }) }),
  );
  let customers = [{
    id: "abababab-abab-abab-abab-abababababab",
    legacyLocalId: "customer-miller",
    name: "Jamie Miller",
    company: "Miller Property Group",
    email: "jamie@miller.example",
    phone: "+19045550188",
    billingAddress: "100 Billing Lane, Jacksonville, FL",
    serviceAddress: "200 Kitchen Way, Jacksonville, FL",
    notes: "Prefers email.",
    preferredContactMethod: "email",
    defaultTerms: "Due on completion",
    favorite: true,
    status: "active",
    threadMessages: [],
    lastUsedAt: "2026-07-25T12:00:00.000Z",
    createdAt: "2026-07-20T12:00:00.000Z",
    updatedAt: "2026-07-25T12:00:00.000Z",
  }];
  await page.route(/\/api\/v1\/customers(?:\/[^/?]+(?:\/activity|\/used)?|\?.*)?$/, (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    const activityMatch = url.pathname.match(/\/api\/v1\/customers\/([^/]+)\/activity$/);
    if (method === "GET" && activityMatch) {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { activity: [] } }) });
    }
    if (method === "GET") {
      const status = url.searchParams.get("status") ?? "active";
      const listed = status === "all" ? customers : customers.filter((customer) => customer.status === status);
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { customers: listed } }) });
    }
    const idMatch = url.pathname.match(/\/api\/v1\/customers\/([^/]+)(?:\/used)?$/);
    if (method === "POST" && url.pathname.endsWith("/used") && idMatch) {
      let customer = customers.find((candidate) => candidate.id === idMatch[1]);
      if (customer) customer = { ...customer, lastUsedAt: new Date().toISOString() };
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { customer } }) });
    }
    if (method === "POST") {
      const input = route.request().postDataJSON();
      const customer = {
        ...customers[0],
        ...input,
        id: "cdcdcdcd-cdcd-cdcd-cdcd-cdcdcdcdcdcd",
        legacyLocalId: input.localId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      customers = [customer, ...customers];
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { customer } }) });
    }
    if (method === "PUT" && idMatch) {
      const input = route.request().postDataJSON();
      let updated = null;
      customers = customers.map((customer) => {
        if (customer.id !== idMatch[1]) return customer;
        updated = { ...customer, ...input, updatedAt: new Date().toISOString() };
        return updated;
      });
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { customer: updated } }) });
    }
    return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: { code: "NOT_FOUND" } }) });
  });
  let documentBrand = {
    businessName: "RIVT Test Crew",
    businessEmail: "office@rivttest.example",
    businessPhone: "(904) 555-0188",
    businessAddress: "Jacksonville, FL",
    website: "https://rivttest.example",
    licenseNumber: "EC-TEST-01",
    estimateStyle: "classic",
    invoiceStyle: "classic",
    showContact: true,
    showAddress: true,
    showLicense: true,
    logoUploadId: null,
    logoUrl: null,
    updatedAt: "2026-07-26T12:00:00.000Z",
  };
  await page.route("**/api/v1/document-brand", (route) => {
    if (route.request().method() === "PUT") {
      documentBrand = {
        ...documentBrand,
        ...route.request().postDataJSON(),
        updatedAt: new Date().toISOString(),
      };
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { brand: documentBrand } }),
    });
  });
  await page.route(/\/api\/v1\/tool-records(?:\/.*|\?.*)?$/, (route) => {
    const method = route.request().method();
    if (method === "GET") {
      const requestUrl = new URL(route.request().url());
      const records = requestUrl.searchParams.get("type") === "invoice_draft"
        ? [continuityInvoiceRecord]
        : [];
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { records } }) });
    }
    if (method === "POST") {
      const input = route.request().postDataJSON();
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            record: {
              id: `tool-record-${input?.localId ?? "saved"}`,
              recordType: input?.recordType ?? "daily_report",
              localId: input?.localId ?? "saved",
              title: input?.title ?? "Saved record",
              status: input?.status ?? "active",
              recordDate: input?.recordDate ?? null,
              amountCents: input?.amountCents ?? null,
              payload: input?.payload ?? {},
              createdAt: "2026-07-04T12:00:00.000Z",
              updatedAt: "2026-07-04T12:00:00.000Z",
            },
          },
        }),
      });
    }
    return route.fulfill({ status: 204, body: "" });
  });
  await page.route("**/api/storage", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ usedBytes: 0, objectCount: 0, plan: {} }) }),
  );
  await page.route("**/api/v1/shop-talk/reactions/batch", async (route) => {
    const body = route.request().postDataJSON();
    const targets = Array.isArray(body?.targets) ? body.targets : [];
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          reactions: targets.map((target) => ({
            targetType: target.targetType,
            targetKey: target.targetKey,
            upvotes: 0,
            downvotes: 0,
            score: 0,
            viewerReaction: null,
          })),
          reputation: {
            reactionsGiven: 0,
            upvotesGiven: 0,
            downvotesGiven: 0,
            targetsReacted: 0,
            lastReactedAt: null,
          },
        },
      }),
    });
  });
  await page.route(/\/api\/v1\/active-work\/?(?:\?.*)?$/, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { activeWork: [activeWorkItem] } }) }),
  );
  await page.route("**/api/v1/jobs?**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { jobs: [] }, meta: { nextCursor: null } }) }),
  );
}

async function assertNoHorizontalOverflow(page) {
  const hasOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  assert.equal(hasOverflow, false, "page has horizontal overflow");
}

async function assertCalculatorNoVerticalOverflow(page) {
  const metrics = await page.locator(".fraction-calc-workbench").evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }));
  assert.ok(
    metrics.scrollHeight <= metrics.clientHeight + 2,
    `calculator workbench has vertical overflow: ${metrics.scrollHeight}px content in ${metrics.clientHeight}px viewport`,
  );
}

async function assertCalculatorOwnsHandsetWidth(page) {
  const metrics = await page.locator(".fraction-calc-workbench").evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      width: rect.width,
      left: rect.left,
      right: rect.right,
      viewportWidth: window.innerWidth,
    };
  });
  assert.ok(
    metrics.width >= metrics.viewportWidth * 0.9,
    `calculator should fill the handset width; got ${metrics.width}px inside ${metrics.viewportWidth}px viewport`,
  );
  assert.ok(
    metrics.left <= 12 && metrics.right >= metrics.viewportWidth - 12,
    `calculator should sit edge-to-edge on handset; got bounds ${JSON.stringify(metrics)}`,
  );
  assert.equal(
    await page.locator(".v2-mobile-nav").isVisible(),
    false,
    "immersive calculator should hide the app mobile nav",
  );
}

async function assertCalculatorKeyRowsBalanced(page, viewportName) {
  const metrics = await page.evaluate(() => {
    const fractionKey = Array.from(document.querySelectorAll(".fraction-strip button"))
      .find((element) => element.textContent?.trim() === "1/2");
    const wholeNumberKey = Array.from(document.querySelectorAll(".fraction-pad button"))
      .find((element) => element.textContent?.trim() === "8");
    if (!(fractionKey instanceof HTMLElement) || !(wholeNumberKey instanceof HTMLElement)) return null;
    return {
      fractionHeight: fractionKey.getBoundingClientRect().height,
      wholeNumberHeight: wholeNumberKey.getBoundingClientRect().height,
    };
  });
  assert.ok(metrics, `calculator keys should render in the ${viewportName} viewport`);
  const ratio = metrics.fractionHeight / metrics.wholeNumberHeight;
  assert.ok(
    ratio >= 0.82 && ratio <= 1.18,
    `fraction and whole-number keys should have a balanced height in ${viewportName}; got ${JSON.stringify(metrics)}`,
  );
}

async function assertFractionTapeHierarchy(page, viewportName) {
  const hierarchy = await page.evaluate(() => {
    const findFraction = (label) => Array.from(document.querySelectorAll(".fraction-strip button"))
      .find((element) => element.textContent?.trim() === label);
    const describe = (label) => {
      const element = findFraction(label);
      if (!(element instanceof HTMLButtonElement)) return null;
      const styles = window.getComputedStyle(element, "::before");
      return {
        family: element.dataset.fractionFamily,
        tickHeight: Number.parseFloat(styles.height),
        tickWidth: Number.parseFloat(styles.width),
      };
    };
    return {
      quarter: describe("1/4"),
      eighth: describe("1/8"),
      sixteenth: describe("1/16"),
    };
  });
  assert.deepEqual(
    [hierarchy.quarter?.family, hierarchy.eighth?.family, hierarchy.sixteenth?.family],
    ["quarter", "eighth", "sixteenth"],
    `fraction keys should expose their tape families in ${viewportName}; got ${JSON.stringify(hierarchy)}`,
  );
  assert.ok(
    hierarchy.quarter.tickHeight > hierarchy.eighth.tickHeight
      && hierarchy.eighth.tickHeight > hierarchy.sixteenth.tickHeight,
    `quarter, eighth, and sixteenth marks should have distinct tick heights in ${viewportName}; got ${JSON.stringify(hierarchy)}`,
  );
  assert.ok(
    hierarchy.quarter.tickWidth > hierarchy.eighth.tickWidth
      && hierarchy.eighth.tickWidth > hierarchy.sixteenth.tickWidth,
    `quarter, eighth, and sixteenth marks should have distinct tick widths in ${viewportName}; got ${JSON.stringify(hierarchy)}`,
  );
}

async function assertImmersiveToolChromeHidden(page, toolName) {
  assert.equal(
    await page.locator(".v2-mobile-nav").isVisible(),
    false,
    `${toolName} should hide the app mobile nav while open`,
  );
}

async function clickVisibleFraction(page, label, viewportName) {
  const selector = ".fraction-strip button";
  const result = await page.evaluate(
    ({ selector, label }) => {
      const isVisible = (element) => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none"
          && style.visibility !== "hidden"
          && rect.width > 0
          && rect.height > 0;
      };
      const visibleLabels = Array.from(document.querySelectorAll(selector))
        .filter((element) => isVisible(element))
        .map((element) => element.textContent?.trim() ?? "");
      const target = Array.from(document.querySelectorAll(selector)).find(
        (element) => element.textContent?.trim() === label && isVisible(element),
      );
      if (!(target instanceof HTMLElement)) return { clicked: false, visibleLabels };
      target.click();
      return { clicked: true, visibleLabels };
    },
    { selector, label },
  );
  assert.equal(
    result.clicked,
    true,
    `expected visible fraction control ${label} in ${viewportName} viewport; visible: ${result.visibleLabels.join(", ")}`,
  );
}

async function swipeQuickWheel(page, trigger, optionName, viewportName, menuName, triggerName) {
  const box = await trigger.boundingBox();
  assert.ok(box, `expected quick-wheel trigger ${triggerName} to be visible in ${viewportName}`);
  assert.equal(
    await trigger.evaluate((element) => getComputedStyle(element).userSelect),
    "none",
    `quick-wheel trigger ${triggerName} must not trigger browser text selection in ${viewportName}`,
  );

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(quickEntryHoldMs + 80);

  const menu = page.getByRole("menu", { name: menuName });
  await menu.waitFor({ state: "visible", timeout: 5_000 });
  const viewport = page.viewportSize();
  const choiceBoxes = await menu.getByRole("menuitem").evaluateAll((elements) => elements.map((element) => {
    const rect = element.getBoundingClientRect();
    return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
  }));
  assert.ok(choiceBoxes.length >= 2 && choiceBoxes.length <= 6, `quick wheel ${menuName} should expose 2-6 useful choices`);
  assert.ok(
    viewport && choiceBoxes.every((choice) => choice.left >= 8 && choice.right <= viewport.width - 8 && choice.top >= 8),
    `quick wheel ${menuName} choices must remain within the visible phone width`,
  );
  const [titleBox, contextBox] = await Promise.all([
    menu.locator(".calc-quick-wheel-title").boundingBox(),
    menu.locator(".calc-quick-wheel-context").boundingBox(),
  ]);
  const highestChoiceTop = Math.min(...choiceBoxes.map((choice) => choice.top));
  const headerToChoiceGap = contextBox
    ? highestChoiceTop - (contextBox.y + contextBox.height)
    : Number.POSITIVE_INFINITY;
  assert.ok(titleBox && contextBox, `quick wheel ${menuName} should reserve a measurable header band`);
  assert.ok(
    titleBox.y >= 8
      && titleBox.y + titleBox.height <= contextBox.y - 2
      && headerToChoiceGap >= 8
      && headerToChoiceGap <= 60,
    `quick wheel ${menuName} heading, context, and choices must not overlap: ${JSON.stringify({ titleBox, contextBox, highestChoiceTop })}`,
  );
  const option = menu.getByRole("menuitem", { name: optionName });
  const optionBox = await option.boundingBox();
  assert.ok(optionBox, `expected quick-wheel option ${optionName} to have a layout box in ${viewportName}`);
  if (viewportName === "mobile" && (menuName === "Eighths" || menuName === "Fractions built from 7")) {
    const screenshotStem = menuName === "Fractions built from 7"
      ? "mobile-calculator-two-choice-wheel"
      : "mobile-calculator-quick-wheel";
    await page.screenshot({ path: path.join(screenshotDir, `${screenshotStem}-light.png`) });
    const previousTheme = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
    await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
    await page.waitForTimeout(150);
    const darkWheelColors = await option.evaluate((element) => {
      const styles = getComputedStyle(element);
      return {
        background: styles.backgroundColor,
        color: styles.color,
        theme: document.documentElement.dataset.theme,
      };
    });
    assert.notEqual(
      darkWheelColors.background,
      "rgb(255, 255, 255)",
      `dark quick-wheel choices should inherit dark surfaces; got ${JSON.stringify(darkWheelColors)}`,
    );
    await page.screenshot({ path: path.join(screenshotDir, `${screenshotStem}-dark.png`) });
    await page.evaluate((theme) => {
      if (theme) document.documentElement.setAttribute("data-theme", theme);
      else document.documentElement.removeAttribute("data-theme");
    }, previousTheme);
  }
  assert.ok(
    optionBox.y + optionBox.height / 2 <= box.y + box.height / 2 + 1,
    `quick wheel ${triggerName} should keep ${optionName} above or beside the blocked thumb area in ${viewportName}`,
  );
  await page.mouse.move(optionBox.x + optionBox.width / 2, optionBox.y + optionBox.height / 2, { steps: 8 });
  assert.match(
    await option.getAttribute("class") ?? "",
    /\bis-selected\b/,
    `quick wheel ${triggerName} should highlight ${optionName} before release in ${viewportName}`,
  );
  const preview = (await menu.locator(".calc-quick-wheel-title").textContent())?.trim() ?? "";
  assert.notEqual(preview, menuName, `quick wheel ${triggerName} should preview the resulting measurement before release`);
  await page.mouse.up();
  await menu.waitFor({ state: "hidden", timeout: 5_000 });
}

async function chooseQuickEntry(page, digit, optionLabel, viewportName, menuName = `Quick fractions for ${digit}`) {
  const key = page.getByLabel("Fraction calculator keypad").getByRole("button", {
    name: `${digit}. Hold and slide for quick choices.`,
  });
  await swipeQuickWheel(page, key, `Enter ${optionLabel}`, viewportName, menuName, digit);
}

async function runToolsFlow(page, viewportName) {
  const isHandsetViewport = viewportName !== "desktop";
  await page.goto(`${baseUrl}/app/tools?tool=contracts`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Tools", exact: true }).waitFor({ timeout: 15_000 });
  assert.equal(
    await page.getByRole("heading", { name: "Contract templates", exact: true }).count(),
    0,
    "contained tool URLs should fall back to the public Tools hub",
  );

  await page.goto(`${baseUrl}/app/tools`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Tools", exact: true }).waitFor({ timeout: 15_000 });
  const allTools = page.getByRole("group", { name: "All tools", exact: true });
  const toolTile = (name) => allTools.getByRole("button", { name: `Open ${name}`, exact: true });
  const primaryTool = toolTile;
  await allTools.waitFor({ timeout: 15_000 });
  for (const toolName of ["Heavy 16th", "Jobsite", "Camera", "Estimate", "Invoice", "Materials", "Time & costs"]) {
    await toolTile(toolName).waitFor({ timeout: 15_000 });
    assert.equal(await toolTile(toolName).count(), 1, `${toolName} should appear exactly once in the unified launcher`);
  }
  assert.equal(await page.locator(".v2-tool-launch-card").count(), 7, "Tools hub should expose all seven tool groups without a hidden drawer");
  assert.equal(await page.locator(".v2-field-tools-tray, .v2-tool-group").count(), 0, "Tools hub should not repeat launchers in a fixed tray or More tools drawer");
  if (isHandsetViewport) {
    await page.getByRole("button", { name: "Customize", exact: true }).click();
    await page.getByRole("button", { name: "Unpin Camera", exact: true }).click();
    await page.getByRole("button", { name: "Pin Materials", exact: true }).click();
    await page.getByRole("button", { name: "Done", exact: true }).click();
    const launcherNames = await allTools.locator(".v2-tool-launch-card").evaluateAll((buttons) =>
      buttons.map((button) => button.getAttribute("aria-label")),
    );
    assert.ok(launcherNames.slice(0, 3).includes("Open Materials"), "customized pinned tools should reorder within the single launcher");
  }
  assert.equal(await page.getByRole("button", { name: /Safety/i }).count(), 0, "Safety should live inside Jobsite instead of appearing as a separate launcher");
  assert.equal(await page.getByRole("button", { name: /Punch list/i }).count(), 0, "Punch should live inside Jobsite instead of appearing as a separate launcher");
  assert.equal(
    await page.getByRole("button", { name: /Receivables/i }).count(),
    0,
    "Receivables should live inside Invoice instead of appearing as a separate launcher",
  );
  assert.equal(
    await page.getByRole("button", { name: /Price book/i }).count(),
    0,
    "Price Book should be consolidated into Materials instead of appearing as a second launcher",
  );
  for (const oldLauncher of ["Time", "Expenses", "Mileage", "Tax summary"]) {
    assert.equal(
      await page.getByRole("button", { name: oldLauncher, exact: true }).count(),
      0,
      `${oldLauncher} should live inside Time & costs instead of appearing as a separate launcher`,
    );
  }
  await assertNoHorizontalOverflow(page);
  await page.screenshot({ path: path.join(screenshotDir, `${viewportName}-tools-hub.png`), fullPage: true });

  await toolTile("Time & costs").click();
  await page.getByRole("heading", { name: "Time & costs", exact: true }).waitFor({ timeout: 15_000 });
  const timeCostsTabs = page.getByRole("navigation", { name: "Time and costs sections" });
  for (const tab of ["Time", "Expenses", "Mileage", "Summary"]) {
    await timeCostsTabs.getByRole("button", { name: tab, exact: true }).click();
    assert.equal(
      await timeCostsTabs.getByRole("button", { name: tab, exact: true }).getAttribute("aria-current"),
      "page",
      `${tab} should be selected inside Time & costs`,
    );
  }
  await timeCostsTabs.getByRole("button", { name: "Expenses", exact: true }).click();
  const expenseAmount = page.locator(".v2-expense-amount-input");
  await expenseAmount.fill("12.49");
  await page.getByRole("button", { name: "Log Materials — $12.49", exact: true }).click();
  await page.getByText("$12.49", { exact: true }).first().waitFor({ timeout: 15_000 });
  assert.equal(await page.getByText("$12", { exact: true }).count(), 0, "expense displays must not round cents to whole dollars");
  await assertNoHorizontalOverflow(page);
  await page.screenshot({ path: path.join(screenshotDir, `${viewportName}-time-costs.png`), fullPage: true });
  await page.getByLabel("Time & costs").getByRole("button", { name: "All tools" }).click();

  for (const [legacyMode, expectedTab] of [["time-tracker", "Time"], ["expense-logger", "Expenses"], ["mileage", "Mileage"], ["tax-summary", "Summary"]]) {
    await page.goto(`${baseUrl}/app/tools?tool=${legacyMode}`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "Time & costs", exact: true }).waitFor({ timeout: 15_000 });
    assert.equal(
      await page.getByRole("navigation", { name: "Time and costs sections" }).getByRole("button", { name: expectedTab, exact: true }).getAttribute("aria-current"),
      "page",
      `Legacy ${legacyMode} links should open the ${expectedTab} tab`,
    );
  }
  await page.getByLabel("Time & costs").getByRole("button", { name: "All tools" }).click();

  await toolTile("Materials").click();
  await page.getByRole("heading", { name: "Materials", exact: true }).waitFor({ timeout: 15_000 });
  const materialsViews = page.getByRole("navigation", { name: "Materials views" });
  await materialsViews.getByRole("button", { name: "Takeoff", exact: true }).waitFor({ timeout: 15_000 });
  await page.getByText("RIVT does not guess supplier pricing.", { exact: false }).waitFor({ timeout: 15_000 });
  await materialsViews.getByRole("button", { name: "Sheets", exact: true }).click();
  await page.getByRole("heading", { name: "Quick sheet count", exact: true }).waitFor({ timeout: 15_000 });
  await materialsViews.getByRole("button", { name: "Price library", exact: true }).click();
  await page.getByRole("heading", { name: "Price library", exact: true }).waitFor({ timeout: 15_000 });
  await page.getByText("3/4 plywood", { exact: true }).waitFor({ timeout: 15_000 });
  await page.getByText("Local yard", { exact: true }).waitFor({ timeout: 15_000 });
  await assertNoHorizontalOverflow(page);
  await page.screenshot({ path: path.join(screenshotDir, `${viewportName}-materials.png`), fullPage: true });
  await page.getByLabel("Materials").getByRole("button", { name: "Tools" }).click();

  await page.goto(`${baseUrl}/app/tools?tool=price-book`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Materials", exact: true }).waitFor({ timeout: 15_000 });
  assert.equal(
    await page.getByRole("navigation", { name: "Materials views" }).getByRole("button", { name: "Price library", exact: true }).getAttribute("aria-pressed"),
    "true",
    "Legacy Price Book links should open the consolidated Materials library",
  );
  await page.getByText("3/4 plywood", { exact: true }).waitFor({ timeout: 15_000 });
  await page.getByLabel("Materials").getByRole("button", { name: "Tools" }).click();

  await toolTile("Heavy 16th").click();
  await page.getByRole("heading", { name: "Heavy 16th field calculator" }).waitFor({ timeout: 15_000 });
  if (viewportName === "se") {
    await page.evaluate(() => {
      document.documentElement.setAttribute("data-rivt-compact-device", "true");
    });
  }
  await page.getByLabel("Length calculator").getByText("Decimal", { exact: true }).waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: "Copy" }).waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: "Calculator settings", exact: true }).click();
  const calculatorSettings = page.getByRole("dialog", { name: "Calculator settings" });
  await calculatorSettings.getByText("Tape precision", { exact: true }).waitFor({ timeout: 15_000 });
  await calculatorSettings.getByText(/resolve to 1\/32 inch/i).waitFor({ timeout: 15_000 });
  const wheelReach = calculatorSettings.getByRole("group", { name: "Quick-wheel reach" });
  await wheelReach.getByRole("button", { name: "Left hand" }).click();
  assert.equal(await wheelReach.getByRole("button", { name: "Left hand" }).getAttribute("class"), "active");
  await wheelReach.getByRole("button", { name: "Auto" }).click();
  assert.equal(
    await calculatorSettings.getByRole("button", { name: "32nd precision", exact: true }).count(),
    0,
    "imperial calculator should not expose a 32nd-precision mode",
  );
  await calculatorSettings.getByRole("button", { name: "Metric" }).click();
  await calculatorSettings.getByText("Metric entry", { exact: true }).waitFor({ timeout: 15_000 });
  await calculatorSettings.getByText("Metric precision", { exact: true }).waitFor({ timeout: 15_000 });
  await calculatorSettings.getByText("Decimal shortcut visibility", { exact: true }).waitFor({ timeout: 15_000 });
  assert.equal(
    await calculatorSettings.getByText("Imperial notation", { exact: true }).count(),
    0,
    "metric settings should not expose imperial notation",
  );
  await calculatorSettings.getByRole("button", { name: "Close calculator settings" }).click();
  await page.getByLabel("Length calculator").getByText("Meters", { exact: true }).waitFor({ timeout: 15_000 });
  await page.getByLabel("Measurement shortcuts").getByRole("button", { name: "Heavy plus half millimetre" }).waitFor({ timeout: 15_000 });
  await page.getByLabel("Measurement shortcuts").getByRole("button", { name: "Light minus half millimetre" }).waitFor({ timeout: 15_000 });
  await page.getByLabel("Measurement shortcuts").getByRole("button", { name: "Multiply measurement by two. Hold and slide for quick choices." }).waitFor({ timeout: 15_000 });
  await page.getByLabel("Measurement shortcuts").getByRole("button", { name: "Divide measurement by two. Hold and slide for quick choices." }).waitFor({ timeout: 15_000 });
  const allMetricDecimals = page.getByRole("button", { name: "Open all metric decimals" });
  await allMetricDecimals.click();
  const metricMarkPicker = page.getByRole("dialog", { name: "Choose a decimal" });
  await metricMarkPicker.waitFor({ state: "visible", timeout: 5_000 });
  assert.equal(
    await metricMarkPicker.getByRole("group", { name: "All metric decimals" }).getByRole("button").count(),
    9,
    "metric mark picker should expose all nine decimal tenths",
  );
  if (viewportName === "mobile") {
    await page.screenshot({ path: path.join(screenshotDir, "mobile-calculator-all-decimals.png") });
  }
  await metricMarkPicker.getByRole("button", { name: "Enter point 7 millimeters" }).click();
  await page.locator(".calc-primary-value", { hasText: "0.7 mm" }).waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: "Clear calculator" }).click();
  await page.getByRole("button", { name: "Calculator settings", exact: true }).click();
  await calculatorSettings.getByRole("group", { name: "Decimal shortcut visibility" }).getByRole("button", { name: "Hidden" }).click();
  await calculatorSettings.getByRole("button", { name: "Close calculator settings" }).click();
  assert.equal(await page.getByLabel("Metric decimal tenths").count(), 0, "hidden metric shortcuts should reclaim the decimal strip");
  await page.getByRole("region", { name: "Tape List" }).waitFor({ state: "visible", timeout: 5_000 });
  await allMetricDecimals.waitFor({ state: "visible", timeout: 5_000 });
  await page.getByRole("button", { name: "Calculator settings", exact: true }).click();
  await calculatorSettings.getByRole("group", { name: "Decimal shortcut visibility" }).getByRole("button", { name: "Shown" }).click();
  await calculatorSettings.getByRole("button", { name: "Close calculator settings" }).click();
  await page.getByLabel("Metric calculator keypad").getByRole("button", { name: "2" }).click();
  await page.getByLabel("Metric calculator keypad").getByRole("button", { name: "4" }).click();
  await page.getByLabel("Metric calculator keypad").getByRole("button", { name: "0" }).click();
  await page.locator(".calc-primary-value", { hasText: "240 mm" }).waitFor({ timeout: 15_000 });
  await page.getByLabel("Measurement shortcuts").getByRole("button", { name: "Heavy plus half millimetre" }).click();
  await page.locator(".calc-primary-value", { hasText: "240.5 mm" }).waitFor({ timeout: 15_000 });
  await page.getByLabel("Measurement shortcuts").getByRole("button", { name: "Light minus half millimetre" }).click();
  await page.locator(".calc-primary-value", { hasText: "240 mm" }).waitFor({ timeout: 15_000 });
  await page.getByLabel("Measurement shortcuts").getByRole("button", { name: "Divide measurement by two. Hold and slide for quick choices." }).click();
  await page.locator(".calc-primary-value", { hasText: "120 mm" }).waitFor({ timeout: 15_000 });
  await page.getByLabel("Measurement shortcuts").getByRole("button", { name: "Multiply measurement by two. Hold and slide for quick choices." }).click();
  await page.locator(".calc-primary-value", { hasText: "240 mm" }).waitFor({ timeout: 15_000 });
  await page.getByLabel("Metric decimal tenths").getByRole("button", { name: ".5" }).click();
  await page.locator(".calc-primary-value", { hasText: "240.5 mm" }).waitFor({ timeout: 15_000 });
  await page.getByLabel("Metric calculator keypad").getByRole("button", { name: "Delete last digit. Hold to clear current problem." }).click();
  await page.locator(".calc-primary-value", { hasText: "240 mm" }).waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: "Calculator settings", exact: true }).click();
  await calculatorSettings.getByRole("button", { name: "Imperial" }).click();
  await calculatorSettings.getByRole("button", { name: "Feet + inches" }).click();
  await calculatorSettings.getByRole("button", { name: "Close calculator settings" }).click();
  await page.getByLabel("Length calculator").getByText("Decimal", { exact: true }).waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: "Clear calculator" }).click();
  await page.locator(".calc-primary-value", { hasText: '0"' }).waitFor({ timeout: 15_000 });
  await page.getByLabel("Fraction calculator keypad").getByRole("button", { name: "6" }).click();
  await chooseQuickEntry(page, "7", "7/8", viewportName, "Fractions built from 7");
  await page.waitForTimeout(350);
  assert.equal(
    await page.locator(".calc-primary-value").count(),
    1,
    `calculator display should remain mounted after the quick-wheel gesture in ${viewportName}; URL ${page.url()}`,
  );
  assert.equal(
    await page.locator(".calc-primary-value").textContent(),
    '6 7/8"',
    "holding 7 should offer the fast 7/8 entry without changing ordinary digit taps",
  );
  await page.getByRole("button", { name: "Clear calculator" }).click();
  await page.getByLabel("Fraction calculator keypad").getByRole("button", { name: "2", exact: true }).click();
  await swipeQuickWheel(
    page,
    page.getByLabel("Fraction calculator keypad").getByRole("button", { name: "Multiply. Hold and slide for quick choices." }),
    "Multiply measurement by 3",
    viewportName,
    "Quick multiply",
    "multiply",
  );
  await page.locator(".calc-primary-value", { hasText: '6"' }).waitFor({ timeout: 15_000 });
  await page.getByLabel("Fraction calculator keypad").getByRole("button", { name: "9", exact: true }).click();
  const deleteKey = page.getByLabel("Fraction calculator keypad").getByRole("button", { name: "Delete last digit. Hold to clear current problem." });
  const deleteBox = await deleteKey.boundingBox();
  assert.ok(deleteBox, `delete key should be visible in ${viewportName}`);
  await page.mouse.move(deleteBox.x + deleteBox.width / 2, deleteBox.y + deleteBox.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(quickEntryHoldMs + 180);
  await page.mouse.up();
  await page.locator(".calc-primary-value", { hasText: '0"' }).waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: "Clear calculator" }).click();
  await page.getByLabel("Fraction calculator keypad").getByRole("button", { name: "5" }).click();
  await clickVisibleFraction(page, "5/8", viewportName);
  await page.getByLabel("Fraction calculator keypad").getByRole("button", { name: "+" }).click();
  await page.getByLabel("Measurement shortcuts").getByRole("button", { name: "Mark measurement heavy" }).click();
  await page.getByLabel("Fraction calculator keypad").getByRole("button", { name: "Calculate result" }).click();
  await page.locator(".calc-primary-value", { hasText: '5 5/8" H' }).waitFor({ timeout: 15_000 });
  assert.equal(
    await page.locator(".calc-primary-value").textContent(),
    '5 5/8" H',
    "one thirty-second above a sixteenth mark should render as Heavy",
  );
  await page.getByRole("button", { name: "Clear calculator" }).click();
  await page.getByLabel("Fraction calculator keypad").getByRole("button", { name: "5" }).click();
  await clickVisibleFraction(page, "5/8", viewportName);
  await page.getByLabel("Fraction calculator keypad").getByRole("button", { name: "-" }).click();
  await page.getByLabel("Measurement shortcuts").getByRole("button", { name: "Mark measurement heavy" }).click();
  await page.getByLabel("Fraction calculator keypad").getByRole("button", { name: "Calculate result" }).click();
  await page.locator(".calc-primary-value", { hasText: '5 5/8" L' }).waitFor({ timeout: 15_000 });
  assert.equal(
    await page.locator(".calc-primary-value").textContent(),
    '5 5/8" L',
    "one thirty-second below an intentional mark should preserve the Light reference",
  );
  await page.getByRole("button", { name: "Clear calculator" }).click();
  await clickVisibleFraction(page, "1/16", viewportName);
  await page.getByLabel("Measurement shortcuts").getByRole("button", { name: "Divide measurement by two. Hold and slide for quick choices." }).click();
  await page.locator(".calc-primary-value", { hasText: '0" H' }).waitFor({ timeout: 15_000 });
  assert.equal(
    await page.locator(".calc-primary-value").textContent(),
    '0" H',
    "an otherwise ambiguous thirty-second should default to the lower mark Heavy",
  );
  await page.getByLabel("Measurement shortcuts").getByRole("button", { name: "Divide measurement by two. Hold and slide for quick choices." }).click();
  await page.locator(".calc-primary-value", { hasText: '≈ 0" H' }).waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: "Clear calculator" }).click();
  await page.getByRole("button", { name: "Open all tape fractions" }).click();
  const imperialMarkPicker = page.getByRole("dialog", { name: "Choose a fraction" });
  await imperialMarkPicker.waitFor({ state: "visible", timeout: 5_000 });
  assert.equal(
    await imperialMarkPicker.getByRole("group", { name: "All tape fractions" }).getByRole("button").count(),
    15,
    "imperial mark picker should expose every sixteenth-inch tape mark",
  );
  const imperialMarkRows = await imperialMarkPicker.getByRole("group", { name: "All tape fractions" }).getByRole("button").evaluateAll(
    (buttons) => [...new Set(buttons.map((button) => Math.round(button.getBoundingClientRect().top)))],
  );
  assert.equal(imperialMarkRows.length, 2, "ALL should present the fifteen imperial marks in a compact two-row palette");
  if (viewportName === "mobile") {
    await page.screenshot({ path: path.join(screenshotDir, "mobile-calculator-all-fractions.png") });
  }
  await imperialMarkPicker.getByRole("button", { name: "Enter 11/16" }).click();
  await page.locator(".calc-primary-value", { hasText: '11/16"' }).waitFor({ timeout: 15_000 });
  assert.equal(
    await page.getByRole("button", { name: "Undo calculator clear" }).count(),
    0,
    "ordinary calculator entry should not keep a redundant persistent Undo control",
  );
  const enterKey = page.locator(".calc-enter-key");
  assert.equal((await enterKey.textContent())?.trim(), "=", "the primary Enter key should display only the equals symbol");
  assert.equal(await enterKey.locator("small").count(), 0, "the equals key should not include Add or Solve helper copy");
  await page.getByRole("button", { name: "Clear calculator" }).click();
  await page.locator(".calc-primary-value", { hasText: '0"' }).waitFor({ timeout: 15_000 });
  const undoButton = page.getByRole("button", { name: "Undo calculator clear" });
  await undoButton.waitFor({ state: "visible", timeout: 5_000 });
  const [undoBox, primaryValueBox] = await Promise.all([
    undoButton.boundingBox(),
    page.locator(".calc-primary-value").boundingBox(),
  ]);
  assert.ok(undoBox && primaryValueBox, "Undo and primary measurement should both have layout boxes");
  assert.ok(
    undoBox.y >= primaryValueBox.y + primaryValueBox.height,
    `Undo must sit below the primary measurement instead of covering it: ${JSON.stringify({ undoBox, primaryValueBox })}`,
  );
  assert.match(
    await undoButton.locator("xpath=..").getAttribute("class") ?? "",
    /\bcalc-secondary-row\b/,
    "temporary clear recovery should live in the display utility row",
  );
  await undoButton.click();
  await page.locator(".calc-primary-value", { hasText: '11/16"' }).waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: "Clear calculator" }).click();
  await page.locator(".calc-primary-value", { hasText: '0"' }).waitFor({ timeout: 15_000 });
  await page.getByLabel("Fraction calculator keypad").getByRole("button", { name: "6" }).click();
  assert.equal(
    await page.getByRole("button", { name: "Undo calculator clear" }).count(),
    0,
    "starting a new entry should dismiss the temporary clear recovery",
  );
  const cancelWheelTrigger = page.getByLabel("Fraction calculator keypad").getByRole("button", { name: "8. Hold and slide for quick choices." });
  const cancelWheelBox = await cancelWheelTrigger.boundingBox();
  assert.ok(cancelWheelBox, `cancel-wheel trigger should have a layout box in ${viewportName}`);
  await page.mouse.move(cancelWheelBox.x + cancelWheelBox.width / 2, cancelWheelBox.y + cancelWheelBox.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(quickEntryHoldMs + 80);
  await page.getByRole("menu", { name: "Eighths" }).waitFor({ state: "visible", timeout: 5_000 });
  await page.mouse.up();
  await page.getByRole("menu", { name: "Eighths" }).waitFor({ state: "hidden", timeout: 5_000 });
  assert.equal(await page.locator(".calc-primary-value").textContent(), '6"', "releasing in the wheel dead zone should cancel without changing the measurement");
  await chooseQuickEntry(page, "8", "1/8", viewportName, "Eighths");
  await page.locator(".calc-primary-value", { hasText: '6 1/8"' }).waitFor({ timeout: 15_000 });
  assert.equal(
    await page.locator(".calc-primary-value").textContent(),
    '6 1/8"',
    "holding 8 should expose the eighths family and enter 1/8",
  );
  await page.getByRole("button", { name: "Clear calculator" }).click();
  const keyboardEighthsTrigger = page.getByLabel("Fraction calculator keypad").getByRole("button", { name: "8. Hold and slide for quick choices." });
  await keyboardEighthsTrigger.focus();
  await keyboardEighthsTrigger.press("ArrowUp");
  const keyboardEighthsMenu = page.getByRole("menu", { name: "Eighths" });
  await keyboardEighthsMenu.waitFor({ state: "visible", timeout: 5_000 });
  assert.equal(
    await page.locator(":focus").getAttribute("aria-label"),
    "Enter 1/8",
    `keyboard quick-wheel entry should focus its first choice in ${viewportName}`,
  );
  await page.keyboard.press("Enter");
  await page.locator(".calc-primary-value", { hasText: '1/8"' }).waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: "Clear calculator" }).click();
  await page.getByLabel("Fraction calculator keypad").getByRole("button", { name: "2" }).click();
  await page.getByLabel("Fraction calculator keypad").getByRole("button", { name: "7" }).click();
  await clickVisibleFraction(page, "5/16", viewportName);
  await page.locator(".calc-primary-value", { hasText: '27 5/16"' }).waitFor({ timeout: 15_000 });
  assert.equal(
    await page.locator(".calc-primary-value").textContent(),
    '27 5/16"',
    "inches mode should keep measurements above 12 inches instead of normalizing to feet",
  );
  await page.getByLabel("Input unit").getByRole("button", { name: "Feet input" }).click();
  await page.locator(".calc-primary-value", { hasText: `2' 3 5/16"` }).waitFor({ timeout: 15_000 });
  await page.getByLabel("Input unit").getByRole("button", { name: "Inches input" }).click();
  await page.locator(".calc-primary-value", { hasText: '27 5/16"' }).waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: "Clear calculator" }).click();
  await page.getByLabel("Fraction calculator keypad").getByRole("button", { name: "9" }).click();
  await clickVisibleFraction(page, "5/16", viewportName);
  await page.getByLabel("Measurement shortcuts").getByRole("button", { name: "Mark measurement heavy" }).click();
  await page.locator(".calc-primary-value", { hasText: '9 5/16" H' }).waitFor({ timeout: 15_000 });
  await page.getByLabel("Fraction calculator keypad").getByRole("button", { name: "+" }).click();
  await clickVisibleFraction(page, "1/4", viewportName);
  await page.getByLabel("Measurement shortcuts").getByRole("button", { name: "Mark measurement heavy" }).click();
  await page.getByLabel("Fraction calculator keypad").getByRole("button", { name: "Calculate result" }).click();
  await page.locator(".calc-primary-value", { hasText: '9 5/8"' }).waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: "Clear calculator" }).click();
  await clickVisibleFraction(page, "1/2", viewportName);
  await page.getByLabel("Fraction calculator keypad").getByRole("button", { name: "+" }).click();
  await page.getByLabel("Fraction calculator keypad").getByRole("button", { name: "2" }).click();
  await clickVisibleFraction(page, "1/4", viewportName);
  await page.getByLabel("Fraction calculator keypad").getByRole("button", { name: "Calculate result" }).click();
  await page.locator(".calc-primary-value", { hasText: '2 3/4"' }).waitFor({ timeout: 15_000 });

  for (const measurement of [
    { whole: "1", fraction: "1/2", expected: '1 1/2"' },
    { whole: "1", fraction: "5/16", expected: '1 5/16"' },
    { whole: "1", fraction: "5/8", expected: '1 5/8"' },
  ]) {
    await page.getByRole("button", { name: "Clear calculator" }).click();
    await page.getByLabel("Fraction calculator keypad").getByRole("button", { name: measurement.whole }).click();
    await clickVisibleFraction(page, measurement.fraction, viewportName);
    await page.getByLabel("Fraction calculator keypad").getByRole("button", { name: "Add measurement to Tape List" }).click();
    await page.locator(".fraction-history", { hasText: `Added ${measurement.expected} to Tape List` }).waitFor({ timeout: 15_000 });
  }

  await page.getByRole("button", { name: "Calculator settings", exact: true }).click();
  await calculatorSettings.getByRole("button", { name: "Hidden", exact: true }).click();
  await calculatorSettings.getByRole("button", { name: "Close calculator settings" }).click();
  const tapeListRegion = page.getByRole("region", { name: "Tape List" });
  await tapeListRegion.waitFor({ timeout: 15_000 });
  assert.equal(await page.getByLabel("Sixteenth fractions").count(), 0, "hidden fraction keys should release their workspace");
  assert.equal(await tapeListRegion.locator(".calc-tape-row").count(), 3, "direct Enter measurements should populate the Tape List");
  for (const digit of ["2", "6", "9"]) {
    const key = page.getByLabel("Fraction calculator keypad").getByRole("button", { name: digit, exact: true });
    assert.equal(await key.getAttribute("aria-haspopup"), null, `digit ${digit} should not advertise a useless or oversized hold menu`);
  }

  await page.getByRole("button", { name: "Clear calculator" }).click();
  await page.getByLabel("Fraction calculator keypad").getByRole("button", { name: "1" }).click();
  await page.getByRole("button", { name: "Open all tape fractions" }).click();
  await page.getByRole("dialog", { name: "Choose a fraction" }).getByRole("button", { name: "Enter 15/16" }).click();
  assert.equal(
    await page.getByRole("menu", { name: "Tape fractions" }).count(),
    0,
    "the complete hidden-key fraction palette should close after selection",
  );
  await page.getByLabel("Fraction calculator keypad").getByRole("button", { name: "Add measurement to Tape List" }).click();
  await page.getByRole("button", { name: "Clear calculator" }).click();
  await page.getByLabel("Fraction calculator keypad").getByRole("button", { name: "2" }).click();
  await page.getByRole("button", { name: "Open all tape fractions" }).click();
  await page.getByRole("dialog", { name: "Choose a fraction" }).getByRole("button", { name: "Enter 13/16" }).click();
  await page.getByLabel("Fraction calculator keypad").getByRole("button", { name: "Add measurement to Tape List" }).click();
  assert.equal(
    await tapeListRegion.locator(".calc-tape-row").count(),
    5,
    "hidden fraction keys should expose five recent measurements in the reclaimed workspace",
  );
  const compactTapeRows = await tapeListRegion.locator(".calc-tape-row").evaluateAll((rows) => rows.map((row) => {
    const value = row.querySelector(".calc-tape-value");
    const strong = row.querySelector("strong");
    return {
      rowHeight: row.getBoundingClientRect().height,
      valueClientHeight: value?.clientHeight ?? 0,
      valueScrollHeight: value?.scrollHeight ?? 0,
      strongHeight: strong?.getBoundingClientRect().height ?? 0,
    };
  }));
  assert.ok(
    compactTapeRows.every((row) => row.rowHeight >= 40 && row.valueScrollHeight <= row.valueClientHeight + 1 && row.strongHeight > 14),
    `Tape List values should remain fully visible instead of clipping: ${JSON.stringify(compactTapeRows)}`,
  );
  if (isHandsetViewport) {
    const keypadBox = await page.getByLabel("Fraction calculator keypad").boundingBox();
    const viewport = page.viewportSize();
    assert.ok(keypadBox && viewport, "hidden-key calculator keypad should remain measurable");
    assert.ok(
      keypadBox.y + keypadBox.height <= viewport.height + 1,
      `hidden-key calculator keypad should remain fully reachable; bottom ${keypadBox.y + keypadBox.height}px in ${viewport.height}px viewport`,
    );
  }
  await page.screenshot({ path: path.join(screenshotDir, `${viewportName}-calculator-tape-list.png`), fullPage: true });
  await page.getByRole("button", { name: 'Mark 1 1/2" used' }).click();
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Heavy 16th field calculator" }).waitFor({ timeout: 15_000 });
  await page.getByRole("region", { name: "Tape List" }).waitFor({ timeout: 15_000 });
  assert.equal(
    await page.getByRole("button", { name: 'Mark 1 1/2" unused' }).count(),
    1,
    "used Tape List state should persist after refresh",
  );
  await page.getByRole("button", { name: 'Load measurement 1 5/8"' }).click();
  await page.locator(".calc-primary-value", { hasText: '1 5/8"' }).waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: "Calculator settings", exact: true }).click();
  await calculatorSettings.getByRole("button", { name: "Shown", exact: true }).click();
  await calculatorSettings.getByRole("button", { name: "Close calculator settings" }).click();
  await page.getByLabel("Sixteenth fractions").waitFor({ timeout: 15_000 });

  await page.getByRole("button", { name: "Tape history" }).click();
  const calculationHistory = page.getByRole("dialog", { name: "Tape history" });
  await calculationHistory.waitFor({ timeout: 15_000 });
  await calculationHistory.getByRole("heading", { name: "Tape List", exact: true }).waitFor({ timeout: 15_000 });
  assert.equal(
    await calculationHistory.getByRole("button", { name: 'Mark 1 1/2" unused' }).count(),
    1,
    "Tape history should expose the persisted used state",
  );
  await calculationHistory.getByRole("button", { name: "Add a short label" }).first().click();
  await calculationHistory.getByRole("textbox", { name: 'Label for measurement 1 1/2"' }).fill("Door RO");
  await calculationHistory.getByRole("button", { name: "Save", exact: true }).click();
  await calculationHistory.getByText("Edit label · Door RO", { exact: true }).waitFor({ timeout: 5_000 });
  const completedEquation = calculationHistory.getByRole("button").filter({ hasText: '1/2" + 2 1/4"' }).first();
  await completedEquation.getByText('2 3/4"', { exact: true }).waitFor({ timeout: 15_000 });
  await completedEquation.click();
  await calculationHistory.waitFor({ state: "hidden", timeout: 15_000 });
  await page.locator(".calc-primary-value", { hasText: '2 3/4"' }).waitFor({ timeout: 15_000 });
  if (isHandsetViewport) {
    await assertCalculatorNoVerticalOverflow(page);
    await assertCalculatorOwnsHandsetWidth(page);
    await assertCalculatorKeyRowsBalanced(page, viewportName);
    await assertFractionTapeHierarchy(page, viewportName);
    assert.equal(
      await page.locator(".heavy-calc-ruler").isVisible(),
      false,
      "Handset calculator should use the visible fraction strip instead of the ruler rail",
    );
    if (viewportName === "se") {
      assert.equal(
        await page.locator(".fraction-action-row button small").first().isVisible(),
        false,
        "compact calculator helper labels should collapse on SE-sized screens",
      );
    }
  }
  await assertNoHorizontalOverflow(page);
  await page.screenshot({ path: path.join(screenshotDir, `${viewportName}-calculator.png`), fullPage: true });
  await page.getByLabel("Heavy 16th field calculator").getByRole("button", { name: "Back to tools" }).click();

  await primaryTool("Estimate").click();
  await page.getByRole("heading", { name: "Estimate builder" }).waitFor({ timeout: 15_000 });
  const estimateSteps = page.getByRole("navigation", { name: "Estimate steps" });
  assert.equal(await estimateSteps.getByRole("button", { name: "1 Price" }).getAttribute("aria-current"), "step");
  await page.getByText("Enter real job costs", { exact: true }).waitFor({ timeout: 15_000 });
  await page.getByText("RIVT will not assume labor or material prices.", { exact: true }).waitFor({ timeout: 15_000 });
  assert.equal(await page.getByLabel("Materials").inputValue(), "0", "a new estimate must not invent material costs");
  await page.getByLabel("Labor hours").fill("8");
  await page.getByLabel("Hourly rate").fill("85.50");
  await page.getByLabel("Materials").fill("245.25");
  await page.getByLabel("Estimate templates").getByText("Templates", { exact: true }).click();
  await page.getByLabel("Template name").fill(`${viewportName} estimate template`);
  await page.getByRole("button", { name: "Save template" }).click();
  await page.getByText("Template saved without customer identity or estimate number.", { exact: true }).waitFor({ timeout: 15_000 });
  assert.equal(await page.getByLabel("Customer email").count(), 0, "Customer fields should stay out of the pricing step");
  await estimateSteps.getByRole("button", { name: "2 Customer" }).click();
  const estimateCustomerPicker = page.getByLabel("Customer selection");
  await estimateCustomerPicker.getByRole("button", { name: /Select a saved customer/ }).click();
  await estimateCustomerPicker.getByRole("button", { name: /Miller Property Group/ }).click();
  assert.equal(await page.getByLabel("Customer name").inputValue(), "Miller Property Group", "saved customer should fill the estimate recipient");
  assert.equal(await page.getByLabel("Customer email").inputValue(), "jamie@miller.example", "saved customer email should fill the estimate");
  await page.getByLabel("Scope").fill("Install and test the agreed field work.");
  await page.getByRole("radio", { name: /Compact/ }).first().click();
  await page.getByText("Compact style saved for future estimates.", { exact: false }).waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: "Review", exact: true }).click();
  await page.waitForTimeout(100);
  const estimateValidationError = await page.locator(".v2-record-error").filter({ visible: true }).allTextContents();
  assert.equal(estimateValidationError.join(" "), "", `estimate should be review-ready: ${estimateValidationError.join(" ")}`);
  await page.getByLabel("Printable estimate preview").waitFor({ timeout: 15_000 });
  await page.getByLabel("Printable estimate preview").getByText("RIVT Test Crew", { exact: true }).waitFor({ timeout: 15_000 });
  assert.equal(await page.getByLabel("Printable estimate preview").evaluate((node) => node.classList.contains("is-template-compact")), true);
  await page.getByText(/labor load/i).waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: "Send email", exact: true }).waitFor({ timeout: 15_000 });
  await assertNoHorizontalOverflow(page);
  await page.screenshot({ path: path.join(screenshotDir, `${viewportName}-estimate.png`), fullPage: true });
  await page.getByLabel("Estimate builder").getByRole("button", { name: "Tools" }).click();

  await primaryTool("Invoice").click();
  await page.getByRole("heading", { name: "Invoice", exact: true }).first().waitFor({ timeout: 15_000 });
  const invoiceTabs = page.getByRole("navigation", { name: "Invoice sections" });
  assert.equal(
    await invoiceTabs.getByRole("button", { name: "Draft", exact: true }).getAttribute("aria-current"),
    "page",
    "Invoice should open on the Draft section",
  );
  const invoiceDraftSteps = page.getByRole("navigation", { name: "Invoice draft steps" });
  assert.equal(await invoiceDraftSteps.getByRole("button", { name: "1 Items" }).getAttribute("aria-current"), "step");
  assert.equal(await page.getByLabel(/rate$/i).first().inputValue(), "0", "a new invoice must not invent a billable amount");
  assert.equal(
    await page.getByLabel("Invoice actions").getByRole("button", { name: "Save draft", exact: true }).isEnabled(),
    true,
    "a zero-value invoice must still be savable as a draft",
  );
  await page.getByRole("button", { name: "Add item", exact: true }).click();
  await page.getByRole("button", { name: "Remove line item", exact: true }).last().click();
  await page.getByText("Line item removed.", { exact: true }).waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  assert.equal(await page.getByLabel("Line description").count(), 2, "removed invoice lines should be recoverable");
  await page.getByLabel(/rate$/i).first().fill("125.75");
  await page.getByLabel("Invoice templates").getByText("Templates", { exact: true }).click();
  await page.getByLabel("Template name").fill(`${viewportName} invoice template`);
  await page.getByRole("button", { name: "Save template" }).click();
  await page.getByText("Template saved.", { exact: true }).waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: "Load" }).first().waitFor({ timeout: 15_000 });
  await invoiceDraftSteps.getByRole("button", { name: "2 Customer" }).click();
  const invoiceCustomerPicker = page.getByLabel("Customer selection");
  await invoiceCustomerPicker.getByRole("button", { name: /Select a saved customer/ }).click();
  await invoiceCustomerPicker.getByRole("button", { name: /Miller Property Group/ }).click();
  assert.equal(await page.getByLabel("Bill to").inputValue(), "Miller Property Group", "saved customer should fill the invoice recipient");
  assert.equal(await page.getByLabel("Recipient email").inputValue(), "jamie@miller.example", "saved customer email should fill the invoice");
  assert.equal(await page.getByLabel("Terms").inputValue(), "Due on completion", "saved customer defaults should fill invoice terms");
  await page.getByLabel("Pay to").fill("RIVT Test Contractor");
  await page.getByLabel("Recipient phone").fill("+19045550123");
  await page.getByRole("radio", { name: /Field/ }).last().click();
  await page.getByText("Field style saved for future invoices.", { exact: false }).waitFor({ timeout: 15_000 });
  await invoiceDraftSteps.getByRole("button", { name: "1 Items" }).click();
  await page.getByLabel("Invoice templates").getByText("Templates", { exact: true }).click();
  await page.getByRole("button", { name: "Load" }).first().click();
  await invoiceDraftSteps.getByRole("button", { name: "2 Customer" }).click();
  assert.equal(await page.getByLabel("Bill to").inputValue(), "Miller Property Group", "templates must not replace the current customer");
  assert.equal(await page.getByLabel("Pay to").inputValue(), "RIVT Test Contractor", "a blank template field must not erase the current payee");
  assert.equal(await page.getByLabel("Recipient email").inputValue(), "jamie@miller.example", "templates must not carry a stale recipient");
  await page.getByRole("button", { name: "Review", exact: true }).click();
  await page.getByRole("button", { name: "Email invoice", exact: true }).waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: "Email invoice", exact: true }).click();
  await page.getByText("Add clear payment instructions so the customer knows how and where to pay.", { exact: true }).waitFor({ timeout: 15_000 });
  assert.equal(await invoiceDraftSteps.getByRole("button", { name: "3 Review" }).getAttribute("aria-current"), "step", "missing payment instructions should keep the user beside the field that needs attention");
  await page.getByLabel("Payment instructions").fill("Pay by check to RIVT Test Contractor.");
  assert.equal(await page.getByRole("button", { name: /Email/i }).count(), 1, "invoice review should expose one email action");
  assert.equal(await page.getByRole("button", { name: "Save draft", exact: true }).getAttribute("class"), "v2-secondary-button", "Save draft should remain secondary to delivery");
  await page.getByRole("link", { name: "Text summary" }).waitFor({ timeout: 15_000 });
  await page.getByRole("heading", { name: "Preview before delivery" }).waitFor({ timeout: 15_000 });
  await page.getByLabel("Printable invoice preview").getByText("Total due", { exact: true }).waitFor({ timeout: 15_000 });
  await page.getByLabel("Printable invoice preview").getByText("RIVT Test Crew", { exact: true }).waitFor({ timeout: 15_000 });
  assert.equal(await page.getByLabel("Printable invoice preview").evaluate((node) => node.classList.contains("is-template-field")), true);
  await page.getByRole("heading", { name: "How should the customer pay?" }).waitFor({ timeout: 15_000 });
  await page.getByRole("radio", { name: /Pay securely by bank/ }).click();
  await page.getByRole("button", { name: "Create secure pay link" }).click();
  await page.getByText("Pay link ready", { exact: true }).waitFor({ timeout: 15_000 });
  await page.getByLabel("Printable invoice preview").getByRole("link", { name: "Pay securely by bank" }).waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: "Send link", exact: true }).waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: "Print / save as PDF" }).waitFor({ timeout: 15_000 });
  if (isHandsetViewport) {
    await assertImmersiveToolChromeHidden(page, "invoice draft");
  }
  await assertNoHorizontalOverflow(page);
  await page.screenshot({ path: path.join(screenshotDir, `${viewportName}-invoice.png`), fullPage: true });
  await page.getByRole("button", { name: "New invoice", exact: true }).click();
  await invoiceDraftSteps.getByRole("button", { name: "2 Customer" }).click();
  assert.equal(await page.getByLabel("Bill to").inputValue(), "", "a new invoice must not retain the prior customer");
  assert.equal(await page.getByLabel("Recipient email").inputValue(), "", "a new invoice must not retain the prior recipient email");
  assert.equal(await page.getByLabel("Recipient phone").inputValue(), "", "a new invoice must not retain the prior recipient phone");
  await page.goto(`${baseUrl}/app/tools?tool=invoice&record=${encodeURIComponent(continuityInvoiceRecord.localId)}`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Invoice", exact: true }).first().waitFor({ timeout: 15_000 });
  await page.getByText("Loaded from your RIVT account.", { exact: true }).waitFor({ timeout: 15_000 });
  const linkedInvoiceSteps = page.getByRole("navigation", { name: "Invoice draft steps" });
  await linkedInvoiceSteps.getByRole("button", { name: "2 Customer" }).click();
  assert.equal(await page.getByLabel("Bill to").inputValue(), "Continuity Customer", "a linked invoice URL should restore the selected account record");
  assert.equal(new URL(page.url()).searchParams.get("record"), continuityInvoiceRecord.localId, "the invoice URL should retain its document identity");
  await page.getByLabel("Bill to").fill("Continuity Customer Updated");
  await page.getByText("Saved on this device. Save to sync these changes to your RIVT account.", { exact: true }).waitFor({ timeout: 15_000 });
  await page.getByLabel("Invoice actions").getByRole("button", { name: "Save draft", exact: true }).click();
  await page.getByText("Draft saved to your RIVT account.", { exact: true }).waitFor({ timeout: 15_000 });
  await page.waitForLoadState("networkidle");
  if (viewportName !== "se") {
    await page.goto(`${baseUrl}/app/tools?tool=invoice&activeWork=${activeWorkItem.id}`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "Invoice", exact: true }).first().waitFor({ timeout: 15_000 });
    const focusedInvoiceSteps = page.getByRole("navigation", { name: "Invoice draft steps" });
    await page.getByLabel(/rate$/i).first().fill("200");
    await focusedInvoiceSteps.getByRole("button", { name: "2 Customer" }).click();
    await page.getByLabel("Bill to").fill("Job Customer");
    await page.getByLabel("Pay to").fill("RIVT Test Contractor");
    await page.getByLabel("Recipient email").fill("job-billing@example.com");
    await focusedInvoiceSteps.getByRole("button", { name: "3 Review" }).click();
    await page.getByRole("button", { name: "Save to job", exact: true }).click();
    await page.getByRole("heading", { name: "How should the customer pay?" }).waitFor({ timeout: 15_000 });
    await page.getByRole("radio", { name: /Pay securely by bank/ }).click();
    const createPayLink = page.getByRole("button", { name: "Create secure pay link" });
    if (await createPayLink.count()) await createPayLink.click();
    await page.getByText("Pay link ready", { exact: true }).waitFor({ timeout: 15_000 });
    await page.getByText("Record payment received outside RIVT", { exact: true }).waitFor({ timeout: 15_000 });
    await assertNoHorizontalOverflow(page);
    await page.screenshot({ path: path.join(screenshotDir, `${viewportName}-invoice-ach.png`), fullPage: true });
    await page.goto(`${baseUrl}/app/tools?tool=invoice`, { waitUntil: "networkidle" });
  }
  await invoiceTabs.getByRole("button", { name: "Receivables", exact: true }).click();
  assert.equal(
    await invoiceTabs.getByRole("button", { name: "Receivables", exact: true }).getAttribute("aria-current"),
    "page",
    "Receivables should be reachable inside Invoice",
  );
  await page.screenshot({ path: path.join(screenshotDir, `${viewportName}-invoice-receivables.png`), fullPage: true });
  await page.getByLabel("Invoice", { exact: true }).getByRole("button", { name: "Tools" }).click();

  await page.goto(`${baseUrl}/app/tools?tool=payments`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Invoice", exact: true }).first().waitFor({ timeout: 15_000 });
  assert.equal(
    await page.getByRole("navigation", { name: "Invoice sections" }).getByRole("button", { name: "Receivables", exact: true }).getAttribute("aria-current"),
    "page",
    "Legacy payments links should open Invoice on the Receivables section",
  );
  await page.getByLabel("Invoice", { exact: true }).getByRole("button", { name: "Tools" }).click();

  await toolTile("Jobsite").click();
  await page.getByRole("heading", { name: "Jobsite", exact: true }).waitFor({ timeout: 15_000 });
  await page.getByLabel("Jobsite sections").getByRole("button", { name: "Log", exact: true }).waitFor({ timeout: 15_000 });
  await page.getByRole("heading", { name: "Today's jobsite", exact: true }).waitFor({ timeout: 15_000 });
  await page.getByLabel("Site / job").waitFor({ timeout: 15_000 });
  await page.getByLabel("Daily log steps").getByRole("button", { name: /Work/ }).click();
  await page.getByLabel("Work completed").fill("Installed devices, labeled panel schedule, and cleaned up the work area.");
  await page.getByText("Blockers, materials, and safety", { exact: true }).click();
  await page.getByLabel("Blockers / changes").fill("Waiting on final fixture selections before trim-out can close.");
  await page.getByLabel("Safety note").fill("Verified ladder setup and kept panel covered while working.");
  await page.getByLabel("Daily log steps").getByRole("button", { name: /Review/ }).click();
  await page.getByText("Records-ready", { exact: true }).waitFor({ timeout: 15_000 });
  await page.getByText("Tenant Build-Out", { exact: true }).waitFor({ timeout: 15_000 });
  await page.getByLabel("Daily log checklist").getByText("Checklist", { exact: true }).click();
  await page.getByRole("button", { name: "Photos captured" }).click();
  await page.getByRole("button", { name: "Safety condition checked" }).click();
  await page.getByLabel("Daily log text preview").getByText("Open text preview", { exact: true }).click();
  await page.locator(".v2-daily-log-preview").waitFor({ timeout: 15_000 });
  await page.locator(".v2-daily-log-preview").getByText("Installed devices", { exact: false }).waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: "Save to Records" }).click();
  await page.getByText("Daily log saved to the server-backed Records timeline.", { exact: true }).waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: "Save draft" }).click();
  await page.getByText("Daily log draft saved.", { exact: true }).waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: "Copy daily log" }).waitFor({ timeout: 15_000 });
  await assertNoHorizontalOverflow(page);
  await page.screenshot({ path: path.join(screenshotDir, `${viewportName}-daily-log.png`), fullPage: true });
  await page.getByLabel("Jobsite").getByRole("button", { name: "Tools" }).click();

  await page.goto(`${baseUrl}/app/tools?tool=punch-list`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Jobsite", exact: true }).waitFor({ timeout: 15_000 });
  await page.getByLabel("Jobsite sections").getByRole("button", { name: "Punch", exact: true }).waitFor({ timeout: 15_000 });
  await page.getByRole("heading", { name: "Punch list", exact: true }).waitFor({ timeout: 15_000 });
  await page.getByLabel("Punch list sections").getByRole("button", { name: /Add item/ }).click();
  await page.getByRole("heading", { name: "What needs fixing?", exact: true }).waitFor({ timeout: 15_000 });
  await page.getByLabel("Punch list sections").getByRole("button", { name: /Open/ }).click();
  await page.getByLabel("Jobsite sections").getByRole("button", { name: "Safety", exact: true }).click();
  await page.getByLabel("Safety check steps").getByRole("button", { name: /Check/ }).waitFor({ timeout: 15_000 });
  await page.getByRole("heading", { name: "PPE", exact: true }).waitFor({ timeout: 15_000 });
  await page.getByLabel("Safety check steps").getByRole("button", { name: /Details/ }).click();
  await page.getByRole("heading", { name: "Site details", exact: true }).waitFor({ timeout: 15_000 });
  await page.getByLabel("Safety check steps").getByRole("button", { name: /Sign off/ }).click();
  await page.getByRole("heading", { name: "Review and sign off", exact: true }).waitFor({ timeout: 15_000 });
  await assertNoHorizontalOverflow(page);
  await page.screenshot({ path: path.join(screenshotDir, `${viewportName}-jobsite.png`), fullPage: true });
  await page.getByLabel("Jobsite").getByRole("button", { name: "Tools" }).click();

  await toolTile("Camera").click();
  await page.getByRole("heading", { name: "Private photos", exact: true }).waitFor({ timeout: 15_000 });
  await page.getByLabel("Camera actions").getByRole("button", { name: "Destination", exact: true }).click();
  const destinationDialog = page.getByRole("dialog", { name: "Choose work context" });
  await destinationDialog.getByText("Private albums", { exact: true }).waitFor({ timeout: 15_000 });
  await destinationDialog.getByRole("button", { name: /Private photos/i }).waitFor({ timeout: 15_000 });
  await destinationDialog.getByRole("button", { name: /Tenant Build-Out/i }).click();
  await page.getByRole("heading", { name: "Tenant Build-Out", exact: true }).waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: "Capture", exact: true }).waitFor({ timeout: 15_000 });
  assert.equal(await page.locator(".v2-camera-home").getByText("Private albums", { exact: true }).count(), 0, "RIVT job context should not mix in private albums");
  assert.equal(await page.locator(".v2-camera-home .v2-camera-album-card").count(), 0, "The selected job should not repeat as a destination card");
  await assertNoHorizontalOverflow(page);
  await page.screenshot({ path: path.join(screenshotDir, `${viewportName}-camera-home.png`), fullPage: true });
  await page.getByRole("button", { name: "Capture", exact: true }).click();
  await page.getByLabel("Take photo").waitFor({ timeout: 15_000 });
  await page.getByLabel("Photos saving to Tenant Build-Out").waitFor({ timeout: 15_000 });
  const controlDock = page.locator(".v2-camera-bottom-controls");
  const controlDockBox = await controlDock.boundingBox();
  const viewport = page.viewportSize();
  assert.ok(controlDockBox && viewport && controlDockBox.height <= 170, `Camera controls should leave the live view dominant: ${JSON.stringify(controlDockBox)}`);
  await page.getByRole("button", { name: "Camera settings" }).click();
  const settings = page.getByRole("dialog", { name: "Camera settings" });
  await settings.getByRole("radio", { name: /Standard/ }).check();
  await settings.getByRole("button", { name: "16:9", exact: true }).click();
  await settings.getByRole("checkbox", { name: /Composition grid/ }).check();
  await settings.getByRole("checkbox", { name: /Stamp capture location/ }).check();
  await settings.getByText(/device GPS coordinates/i).waitFor({ timeout: 15_000 });
  assert.equal(await settings.getByText(/verified GPS/i).count(), 0, "camera copy must not claim device GPS is verified");
  await settings.getByText("Jacksonville, FL and capture GPS will be stamped on new photos.", { exact: true }).waitFor();
  await page.screenshot({ path: path.join(screenshotDir, `${viewportName}-camera-settings.png`) });
  await settings.getByRole("button", { name: "Close camera settings" }).click();
  await page.locator(".v2-camera-composition-grid").waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: "Progress", exact: true }).click();
  const captureTypes = page.getByRole("group", { name: "Choose capture type" });
  await captureTypes.getByRole("button", { name: "Issue" }).click();
  await assert.equal(await page.getByRole("button", { name: "Issue", exact: true }).getAttribute("aria-expanded"), "false");
  await page.getByRole("button", { name: "Switch camera" }).click();
  await page.waitForFunction(() => {
    const shutter = document.querySelector(".v2-camera-shutter");
    return shutter instanceof HTMLButtonElement && !shutter.disabled;
  }, null, { timeout: 15_000 });
  await page.getByLabel("Take photo").click();
  await page.locator(".v2-camera-save-status", { hasText: "1 of 1 didn't upload - retry the failed photo." }).waitFor({ timeout: 15_000 });
  await page.locator(".v2-camera-retry").click();
  await page.getByText("Saved to Tenant Build-Out.", { exact: true }).waitFor({ timeout: 15_000 });
  await page.getByLabel("1 photos saved in this camera session").waitFor({ timeout: 15_000 });
  await assertNoHorizontalOverflow(page);
  await page.screenshot({ path: path.join(screenshotDir, `${viewportName}-camera.png`) });
  await page.getByRole("button", { name: "Back" }).click();
  await page.locator(".v2-job-photos-stats strong", { hasText: "1" }).waitFor({ timeout: 15_000 });
  await page.locator(".v2-job-photo-timeline-row").first().waitFor({ timeout: 15_000 });
  await assertNoHorizontalOverflow(page);
  await page.screenshot({ path: path.join(screenshotDir, `${viewportName}-job-photos.png`), fullPage: true });
  if (viewportName !== "se") {
    await page.goto(`${baseUrl}/payment/complete?session_id=cs_test_rivt_ach_status`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "Bank payment processing" }).waitFor({ timeout: 15_000 });
    await page.getByText("This invoice is not marked paid until Stripe confirms settlement.", { exact: false }).waitFor({ timeout: 15_000 });
    await page.getByText("RIVT does not hold job funds.", { exact: false }).waitFor({ timeout: 15_000 });
    await assertNoHorizontalOverflow(page);
    await page.screenshot({ path: path.join(screenshotDir, `${viewportName}-invoice-ach-return.png`), fullPage: true });
  }
}

let browser;

try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });
  await fs.rm(screenshotDir, { recursive: true, force: true });
  await fs.mkdir(screenshotDir, { recursive: true });

  for (const viewport of [
    { name: "desktop", width: 1440, height: 900 },
    { name: "mobile", width: 390, height: 844 },
    { name: "se", width: 320, height: 568 },
  ]) {
    const context = await browser.newContext({ viewport, serviceWorkers: "block" });
    const page = await context.newPage();
    const errors = [];
    page.on("console", (message) => {
      if (message.type() === "error" && !/status of 503 \(Service Unavailable\)/i.test(message.text())) {
        errors.push(message.text());
      }
    });
    page.on("requestfailed", (request) => {
      const errorText = request.failure()?.errorText ?? "request failed";
      if (errorText === "net::ERR_ABORTED" && request.frame() === page.mainFrame()) return;
      errors.push(`${request.url()} :: ${errorText}`);
    });
    page.on("pageerror", (error) => errors.push(error.message));

    await configurePage(page);
    await runToolsFlow(page, viewport.name);
    assert.equal(errors.length, 0, `${viewport.name} console errors: ${errors.join("\n")}`);
    await context.close();
  }

  console.log(`Tools rendered QA passed. Screenshots: ${screenshotDir}`);
} finally {
  await browser?.close();
  vite.kill();
}


