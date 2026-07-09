import type { AccountProfile, ShoutOut } from "../app-shell/app-state-types";
import { brandConfig } from "../brandConfig";
import type { InboxConversation, InboxMessage, InboxNotification } from "../features/inbox/inbox-api";
import type { CommunityPost } from "../features/shop-talk/ShopTalkView";
import {
  fallbackCommunities,
  formatMemberCount,
  type CommunityDisplay,
} from "../features/shop-talk/community-directory";
import { communitySlug } from "../features/shop-talk/communities-api";
import type { CanonicalActiveWork } from "../features/work/job-api";
import type { Job, Role, Trade } from "../types";

export interface GuestPreviewInput {
  role: Role;
  trade: Trade;
  location: string;
}

export interface GuestPreviewWorkspace {
  profile: AccountProfile;
  jobs: Job[];
  activeWork: CanonicalActiveWork[];
  posts: CommunityPost[];
  communities: CommunityDisplay[];
  shoutOuts: ShoutOut[];
  conversations: InboxConversation[];
  messages: InboxMessage[];
  notifications: InboxNotification[];
  recordIds: string[];
}

const DEMO_ACCOUNT_ID = "guest-preview";
const DEMO_CONTRACTOR_ID = "demo-contractor";
const DEMO_TRADESPERSON_ID = "demo-tradesperson";
const DEMO_ORG_ID = "demo-harborline-builders";
const DEMO_ACTIVE_WORK_ID = "demo-active-work-1";
const DEMO_JOB_ID = "demo-job-1";
const DEMO_OFFER_ID = "demo-offer-1";
const DEMO_CONVERSATION_ID = "demo-conversation-1";

const tradeJobTitles: Partial<Record<Trade, string>> = {
  Carpentry: "Built-in cabinet install",
  Cabinetry: "Cabinet installation and scribe",
  Electrical: "Panel trim-out and punch list",
  Plumbing: "Rough-in repairs and fixture set",
  HVAC: "Mini-split line set finish",
  Tile: "Large-format tile bathroom",
  Roofing: "Roof flashing repair",
  Framing: "Interior wall framing package",
  "Painting/Finishing": "Punch-out paint and finish",
  Flooring: "LVP install and transitions",
};

const tradeQuestionTitles: Partial<Record<Trade, string>> = {
  Carpentry: "Best way to scribe cabinets to stone?",
  Cabinetry: "How are you pricing built-in scribe work?",
  Electrical: "What are you charging for punch-out work?",
  Plumbing: "Do I need separate insurance for side jobs?",
  HVAC: "How do you document refrigerant line photos?",
  Tile: "Best thinset for large-format tile on slab?",
  Roofing: "How do you document flashing before it gets covered?",
  Framing: "How are you handling layout changes after inspection?",
};

function uniqueTrades(primary: Trade) {
  return [primary, "Carpentry", "Electrical", "Plumbing"].filter(
    (trade, index, list) => list.indexOf(trade) === index,
  ) as Trade[];
}

function splitLocation(location: string) {
  const [city = "Jacksonville", region = "FL"] = location.split(",").map((part) => part.trim()).filter(Boolean);
  return { city, region };
}

function demoJob(input: GuestPreviewInput, overrides: Partial<Job> = {}): Job {
  const { city, region } = splitLocation(input.location);
  const trade = overrides.trade ?? input.trade;
  const title = overrides.title ?? tradeJobTitles[trade] ?? `${trade} project help`;
  const id = overrides.id ?? 7101;
  const canonicalId = id === 7101 ? DEMO_JOB_ID : `demo-job-${id}`;
  const createdAt = "2026-07-01T13:30:00.000Z";
  return {
    id,
    title,
    contractor: "Harborline Builders",
    trade,
    location: city,
    state: region,
    distance: 4.8,
    pay: overrides.pay ?? 1100,
    durationHours: overrides.durationHours ?? 12,
    workType: overrides.workType ?? "Multi-day",
    difficulty: overrides.difficulty ?? "Advanced",
    insuranceRequired: overrides.insuranceRequired ?? true,
    tools: overrides.tools ?? ["Finish nailer", "Track saw", "Level", "Vacuum"],
    trustRequirement: "Completion photos required",
    addressPolicy: "Exact address is shared after accepted work.",
    posted: overrides.posted ?? "Sample preview",
    match: overrides.match ?? 94,
    rating: 4.9,
    reviewCount: 38,
    applicants: overrides.applicants ?? 7,
    status: overrides.status ?? "Scheduled",
    summary: overrides.summary ?? "Sample job showing how active work, messages, records, and invoices connect in RIVT.",
    guidance: overrides.guidance ?? [
      "Demo data only: this shows the full product experience without exposing real work.",
      "Private address, job photos, and messages stay tied to the accepted job.",
    ],
    risks: overrides.risks ?? ["Confirm site access", "Document before/after photos"],
    deliverables: overrides.deliverables ?? ["Install complete", "Closeout photos", "Invoice draft"],
    matchFactors: overrides.matchFactors ?? ["Same trade", "Near service area", "Insurance ready"],
    canonical: {
      id: canonicalId,
      organizationId: DEMO_ORG_ID,
      tradeCode: trade.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
      version: 1,
      scopeDescription: "Demo accepted-work scope used for the guest preview.",
      materials: ["Fasteners", "Caulk", "Touch-up supplies"],
      publicLocation: {
        city,
        region,
        countryCode: "US",
        postalPrefix: "322",
      },
      privateLocation: {
        addressLine1: "Demo jobsite",
        addressLine2: "",
        city,
        region,
        postalCode: "32207",
        countryCode: "US",
        accessNotes: "Sample address shown only in preview mode.",
      },
      preferredStartDate: "2026-07-13",
      applicationDeadline: "2026-07-10",
      budgetUnit: "fixed",
      createdAt,
      updatedAt: createdAt,
      events: [
        {
          id: "demo-job-event-1",
          type: "status_changed",
          fromStatus: "open",
          toStatus: "scheduled",
          reason: "Demo offer accepted",
          occurredAt: createdAt,
        },
      ],
    },
    ...overrides,
  };
}

function demoActiveWork(input: GuestPreviewInput, job: Job): CanonicalActiveWork {
  const { city, region } = splitLocation(input.location);
  return {
    id: DEMO_ACTIVE_WORK_ID,
    jobId: job.canonical?.id ?? DEMO_JOB_ID,
    offerId: DEMO_OFFER_ID,
    organizationId: DEMO_ORG_ID,
    contractorAccountId: input.role === "contractor" ? DEMO_ACCOUNT_ID : DEMO_CONTRACTOR_ID,
    tradespersonAccountId: input.role === "tradesperson" ? DEMO_ACCOUNT_ID : DEMO_TRADESPERSON_ID,
    status: "active",
    startedAt: "2026-07-08T13:00:00.000Z",
    completedAt: null,
    cancelledAt: null,
    createdAt: "2026-07-08T13:00:00.000Z",
    updatedAt: "2026-07-08T13:15:00.000Z",
    job: {
      id: job.canonical?.id ?? DEMO_JOB_ID,
      title: job.title,
      status: "active",
      organization: { id: DEMO_ORG_ID, name: "Harborline Builders" },
      publicLocation: { city, region, countryCode: "US" },
    },
    events: [
      {
        id: "demo-active-event-1",
        type: "offer_accepted",
        fromStatus: "offered",
        toStatus: "active",
        reason: "Demo accepted-work preview",
        occurredAt: "2026-07-08T13:00:00.000Z",
      },
    ],
  };
}

function demoCommunities(input: GuestPreviewInput): CommunityDisplay[] {
  const selectedSlugs = new Set([
    communitySlug(`${input.trade} Talk`),
    communitySlug("Jacksonville Trades"),
    communitySlug("Side Work"),
  ]);
  return fallbackCommunities.map((community, index) => {
    const boostedCount = [1860, 1420, 910, 640, 780, 520, 690, 430][index] ?? 250;
    const joined = selectedSlugs.has(community.slug);
    return {
      ...community,
      memberCount: boostedCount,
      count: formatMemberCount(boostedCount),
      joined,
      serverOwned: false,
      meta: joined ? `${community.meta} (demo)` : community.meta,
    };
  });
}

function demoPosts(input: GuestPreviewInput): CommunityPost[] {
  const selectedQuestion = tradeQuestionTitles[input.trade] ?? "How are you pricing small punch-out work?";
  const primaryCommunity = `${input.trade} Talk`;
  return [
    {
      id: "demo-post-1",
      title: selectedQuestion,
      trade: input.trade,
      author: "RIVT demo member",
      badge: "Community Prompt",
      flair: "Question",
      body: "Sample thread showing what Shop Talk looks like once local trades are answering real field questions.",
      upvotes: 24,
      downvotes: 1,
      helpfulVotes: 11,
      commentCount: 8,
      replies: [
        {
          id: "demo-answer-1",
          author: "Demo finish carpenter",
          body: "I template the wall first, leave a light reveal, then photo the final fit for the job record.",
          upvotes: 13,
          downvotes: 0,
          verifiedFix: true,
        },
      ],
      createdAt: "Demo preview",
      sortOrder: 1,
      status: "Verified Fix",
      type: "question",
      communitySlug: communitySlug(primaryCommunity),
      communityName: primaryCommunity,
      communityAudience: "public",
    },
    {
      id: "demo-post-2",
      title: "Who is free for a two-day punch list next week?",
      trade: "Carpentry",
      author: "RIVT demo contractor",
      flair: "Discussion",
      body: "Sample local coordination thread for finding reliable help without exposing private jobsite details early.",
      upvotes: 17,
      downvotes: 0,
      helpfulVotes: 5,
      commentCount: 6,
      replies: [],
      createdAt: "Demo preview",
      sortOrder: 2,
      status: "Open",
      type: "sub-request",
      subTrade: input.trade,
      subLocation: input.location,
      subRate: "$45-$95/hr",
      communitySlug: communitySlug("Jacksonville Trades"),
      communityName: "Jacksonville Trades",
      communityAudience: "public",
    },
    {
      id: "demo-post-3",
      title: "What photos do you keep before closing walls?",
      trade: "Electrical",
      author: "RIVT demo member",
      flair: "Tip",
      body: "Sample workflow thread showing how community advice connects to records and closeout proof.",
      upvotes: 19,
      downvotes: 0,
      helpfulVotes: 7,
      commentCount: 4,
      replies: [],
      createdAt: "Demo preview",
      sortOrder: 3,
      status: "Open",
      type: "general",
      communitySlug: communitySlug("Side Work"),
      communityName: "Side Work",
      communityAudience: "public",
    },
  ];
}

function demoInbox(input: GuestPreviewInput, job: Job) {
  const { city, region } = splitLocation(input.location);
  const otherParty = input.role === "contractor"
    ? {
        accountId: DEMO_TRADESPERSON_ID,
        role: "tradesperson" as const,
        displayName: "Demo subcontractor",
        headline: `${input.trade} specialist`,
      }
    : {
        accountId: DEMO_CONTRACTOR_ID,
        role: "contractor" as const,
        displayName: "Demo contractor",
        headline: "General contractor",
      };
  const currentParty = {
    accountId: DEMO_ACCOUNT_ID,
    role: input.role,
    displayName: input.role === "contractor" ? "Demo contractor account" : "Demo subcontractor account",
    headline: input.role === "contractor" ? "Contractor preview" : `${input.trade} preview`,
  };
  const conversation: InboxConversation = {
    id: DEMO_CONVERSATION_ID,
    activeWorkId: DEMO_ACTIVE_WORK_ID,
    jobId: job.canonical?.id ?? DEMO_JOB_ID,
    organizationId: DEMO_ORG_ID,
    status: "open",
    activeWorkStatus: "active",
    createdByAccountId: DEMO_CONTRACTOR_ID,
    createdAt: "2026-07-08T13:00:00.000Z",
    updatedAt: "2026-07-08T13:25:00.000Z",
    job: {
      id: job.canonical?.id ?? DEMO_JOB_ID,
      title: job.title,
      status: "active",
      organization: { id: DEMO_ORG_ID, name: "Harborline Builders" },
      publicLocation: { city, region, countryCode: "US" },
    },
    participants: [currentParty, otherParty].map((participant) => ({
      ...participant,
      mutedUntil: null,
      lastReadAt: participant.accountId === DEMO_ACCOUNT_ID ? "2026-07-08T13:30:00.000Z" : null,
      serviceArea: { city, region },
    })),
    lastMessage: null,
    unreadCount: 1,
  };
  const messages: InboxMessage[] = [
    {
      id: "demo-message-1",
      conversationId: DEMO_CONVERSATION_ID,
      senderAccountId: otherParty.accountId,
      body: "Demo message: once work is active, job messages, photos, logs, and invoices stay connected here.",
      kind: "user",
      createdAt: "2026-07-08T13:25:00.000Z",
      editedAt: null,
      deletedAt: null,
      sender: {
        accountId: otherParty.accountId,
        displayName: otherParty.displayName,
        headline: otherParty.headline,
      },
      receipts: [],
      attachments: [],
    },
  ];
  const notifications: InboxNotification[] = [
    {
      id: "demo-notification-1",
      accountId: DEMO_ACCOUNT_ID,
      type: "work",
      title: "Demo active work ready",
      body: `${job.title} is active. Open the workspace to see messages, photos, logs, and invoices together.`,
      actionHref: `/work?activeWork=${DEMO_ACTIVE_WORK_ID}`,
      sourceType: "active_work",
      sourceId: DEMO_ACTIVE_WORK_ID,
      priority: "normal",
      metadata: { demo: true, activeWorkId: DEMO_ACTIVE_WORK_ID },
      readAt: null,
      createdAt: "2026-07-08T13:25:00.000Z",
    },
  ];
  conversation.lastMessage = messages[0] ?? null;
  return { conversations: [conversation], messages, notifications };
}

export function createGuestPreviewWorkspace(input: GuestPreviewInput): GuestPreviewWorkspace {
  const specialties = uniqueTrades(input.trade);
  const profile: AccountProfile = {
    email: "",
    displayName: input.role === "contractor" ? "Demo contractor account" : "Demo subcontractor account",
    organization: input.role === "contractor" ? "Harborline Builders" : "",
    location: input.location,
    specialties,
    plan: brandConfig.pricing.betaPlan.label,
    authMethod: "Email",
  };
  const activeJob = demoJob(input);
  const secondaryJob = demoJob(input, {
    id: 7102,
    title: input.role === "contractor" ? "Two-day punch list help" : `${input.trade} weekend opening`,
    status: "Open",
    pay: 720,
    durationHours: 8,
    difficulty: "Moderate",
    applicants: input.role === "contractor" ? 5 : 2,
    match: 88,
    posted: "Demo preview",
  });
  const completedJob = demoJob(input, {
    id: 7103,
    title: "Completed closeout record",
    status: "Paid / Closed",
    pay: 940,
    durationHours: 10,
    applicants: 3,
    match: 91,
    posted: "Demo preview",
    summary: "Sample completed job showing the history a mature RIVT account can build.",
  });
  const activeWork = [demoActiveWork(input, activeJob)];
  const inbox = demoInbox(input, activeJob);
  return {
    profile,
    jobs: [activeJob, secondaryJob, completedJob],
    activeWork,
    posts: demoPosts(input),
    communities: demoCommunities(input),
    shoutOuts: [
      {
        id: 1,
        from: input.role === "contractor" ? "Demo subcontractor" : "Demo contractor",
        to: profile.displayName,
        trade: input.trade,
        message: "Demo shout-out: clean communication, complete records, and strong closeout photos.",
        createdAt: "Demo preview",
      },
    ],
    conversations: inbox.conversations,
    messages: inbox.messages,
    notifications: inbox.notifications,
    recordIds: ["demo-photo-1", "demo-log-1", "demo-invoice-1", "demo-expense-1", "demo-closeout-1"],
  };
}
