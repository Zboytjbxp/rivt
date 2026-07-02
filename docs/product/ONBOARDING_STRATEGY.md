# RIVT Onboarding Strategy

Last updated: 2026-07-01

## Why this matters

RIVT is a broad product: work marketplace, crew network, Trade Talk, profiles, proof, messages, records, and field tools. New users need to understand what is possible without being forced through a long feature tour.

The onboarding goal is not to explain every feature. The goal is to get each user to one first useful action, then progressively reveal the rest of the product as they need it.

## Research principles

Research-backed patterns to follow:

- Progressive disclosure: show only the most important options first; defer advanced or less frequent features until users ask for them. Source: Nielsen Norman Group, "Progressive Disclosure" (`https://www.nngroup.com/articles/progressive-disclosure/`).
- Activation first: onboarding should guide people to core value quickly, not show everything at once. Source: Pendo, "How to build user onboarding that boosts retention" (`https://www.pendo.io/resources/how-to-build-user-onboarding-that-boosts-retention/`).
- First action is the product: strong onboarding puts users inside the real behavior they will repeat later. Source: Appcues, "26 Best User Onboarding Examples by Tactic" (`https://www.appcues.com/blog/best-user-onboarding-examples`).
- Mobile onboarding should be short, skippable, personalized, and value-led. Source: Appcues, "The essential guide to mobile user onboarding" (`https://www.appcues.com/blog/essential-guide-mobile-user-onboarding-ui-ux`).
- Time to value is the organizing metric: every required step should either move the user toward value or be deferred. Source: Appcues, "User onboarding strategies" (`https://www.appcues.com/blog/8-user-onboarding-strategies`).

## RIVT activation definition

RIVT has two role-specific aha moments.

Contractor activation:

- "I can find and evaluate real trade help faster than texting around."
- First success event: contractor posts or drafts a real job, or invites/saves a relevant tradesperson/crew.

Tradesperson activation:

- "I can find work, prove myself, and build reputation here."
- First success event: tradesperson follows trade communities, views a matching job, or posts/answers a Trade Talk question tied to their trade.

Secondary activation for both:

- "This is useful even when I am not hiring or looking."
- First daily-use event: ask/answer in Trade Talk, save a useful post, open a tool, upload a work photo, or update availability.

## Current state

Relevant current implementation:

- Signup/entry lives in `src/features/auth/AuthScreens.tsx`.
- Post-signup setup is `OnboardingFlow` in `src/features/auth/AuthScreens.tsx`.
- Current setup collects role, service area, specialties, and consent.
- Current left rail already previews Trade Talk, trust, pricing, and address privacy.
- Current authenticated profile has a separate local onboarding overlay in `src/features/profile/ProfileHub.tsx`.

Main gap:

- The app asks users to complete setup, but it does not yet intentionally show role-based possibilities or route each user to a first useful action.

## Product decision

Build a two-layer onboarding system:

1. Entry education before signup
2. Role-based activation after signup

Do not build a long generic product tour. Do not teach all features at once.

## Layer 1: Entry education

Purpose:

- Let users understand RIVT before committing.
- Show that RIVT is a trades-only professional network, not a homeowner lead marketplace.
- Make the product feel bigger than jobs without making it feel complicated.

Entry screens should communicate four pillars:

- Trade Talk: ask questions, answer, vote, save, build reputation.
- Work: find jobs, post jobs, apply, invite, message.
- Crew: follow tradespeople, connect, keep a trusted network.
- Tools and records: calculator, invoice, daily log, job photos, closeout records.

Recommended entry sequence:

1. Landing/auth screen:
   - Headline: `Trade talk, built for the trades.`
   - Subtext: `Ask questions, find work, show your craft, and connect with real tradespeople.`
   - Primary actions: `Create account`, `Log in`, `Browse first`.

2. Short swipeable preview, optional/skippable:
   - `Ask the trades`
   - `Find work or build a crew`
   - `Show proof and build reputation`
   - `Run the job from your phone`

3. Browse-first preview:
   - Show real app shell with guest restrictions.
   - Allow users to view Trade Talk, Work, Crew, and Tools examples.
   - Gate writes behind signup.

Acceptance:

- A user should understand the product in under 60 seconds.
- They should not need an account to see what RIVT is.
- No fake production claims. Guest/demo states must remain visibly preview-only.

## Layer 2: Role-based setup

Purpose:

- Collect only the minimum needed to personalize the first session.
- Make the user's selected role feel meaningful immediately.
- Route the user to their first useful action.

Current required fields should remain:

- Role
- Display name
- Service area
- Trade specialties
- Consent
- Email verification

But the flow should be redesigned into three focused steps:

Step 1: "What are you here to do?"

- Contractor choices:
  - `Find help for a job`
  - `Build a bench of subs`
  - `Stay connected with local trades`
  - `Use tools and records`
- Tradesperson choices:
  - `Find side work`
  - `Build my profile`
  - `Answer and learn in Trade Talk`
  - `Connect with contractors`

This is not a new role toggle. It is a goal selector that personalizes the next screen.

Step 2: "Shape your feed"

- Select trades and topics.
- Split the picker into two groups:
  - Trades: Carpentry, Electrical, Plumbing, HVAC, Tile, Cabinetry, Framing, Roofing, Concrete, Painting, etc.
  - Topics: Local jobs, Code questions, Tools, Business/pricing, Safety, Project photos.
- Show a live preview line such as:
  - Contractor: `You will see carpenters, electricians, and local Jacksonville trades first.`
  - Tradesperson: `Your Work feed will start with carpentry and side work near Jacksonville.`

Step 3: "Enter RIVT"

- Collect/confirm minimum profile details and consent.
- Explain one practical privacy/trust rule:
  - `Exact job addresses stay private until both sides confirm.`
  - `ID verification is required before posting or accepting real work.`
- Button changes by role/goal:
  - Contractor finding help: `Post your first job`
  - Contractor building crew: `Find your crew`
  - Tradesperson finding work: `See matching work`
  - Tradesperson building reputation: `Join Trade Talk`

Acceptance:

- The user reaches the app with a personalized destination.
- Required compliance/trust copy stays concise.
- The flow feels like setup, not paperwork.

## First-session checklist

After setup, show a small role-specific checklist on Home. It should be dismissible and reachable later from Profile.

Contractor checklist:

- Post a job or save a draft
- Add service area
- Invite or save one trade profile
- Send one message or question
- Open Invoice or Daily Log tool

Tradesperson checklist:

- Select trade interests
- Add profile headline/bio
- View one matching job
- Join one Trade Talk community
- Add one portfolio/photo or certification

Rules:

- Keep it to 3-5 steps.
- Each step opens the exact destination.
- Completion should update automatically from real server/app state where available.
- Do not mark steps complete from frontend-only fake state.

## Contextual onboarding after first session

Use short prompts where users naturally encounter features:

- Work empty state: `Post your first job` or `See matching work`.
- Trade Talk empty state: `Ask your trade` or `Follow communities`.
- Crew empty state: `Find your crew`.
- Tools hub: `Start with Calculator`, `Create invoice`, `Log today's work`.
- Profile: `Add proof that helps people trust you`.

Avoid:

- Long modal tours.
- Tooltips stacked on top of each other.
- Popups that appear before the user has context.
- Explaining obvious navigation.

## Recommended IA changes

Add an onboarding state object in frontend state:

```ts
type OnboardingGoal =
  | "contractor_find_help"
  | "contractor_build_crew"
  | "contractor_network"
  | "contractor_tools"
  | "tradesperson_find_work"
  | "tradesperson_build_profile"
  | "tradesperson_trade_talk"
  | "tradesperson_connect";

interface OnboardingPreferences {
  goal: OnboardingGoal;
  tradeInterests: string[];
  topicInterests: string[];
  preferredStartRoute: "home" | "work" | "crew" | "shop-talk" | "tools";
}
```

For Gate A, this can be frontend-only only if it is used solely for UI routing/preferences. Anything that affects permissions, profile visibility, billing, identity, or work actions must be server-owned.

Longer term, persist preferences on the account/profile record.

## Metrics to instrument

Track these as internal events:

- `onboarding.started`
- `onboarding.goal_selected`
- `onboarding.trade_interests_selected`
- `onboarding.completed`
- `onboarding.skipped_preview`
- `activation.first_job_draft`
- `activation.first_application_started`
- `activation.first_trade_talk_post`
- `activation.first_community_join`
- `activation.first_tool_opened`
- `activation.first_profile_proof_added`

Core onboarding metrics:

- Completion rate
- Time to completed onboarding
- Time to first useful action
- First-session return within 24 hours
- Drop-off by step
- Role-specific activation rate

## Build phases

Phase 1: Plan and copy

- Replace generic setup framing with role-specific value copy.
- Add goal selector to `OnboardingFlow`.
- Add trade/topic grouping and live preview.
- Route users to the relevant first destination after onboarding.
- Keep existing server onboarding payload unchanged unless preferences are intentionally added later.

Phase 2: First-session checklist

- Add a small role-specific `Getting started` card on Home.
- Wire checklist steps to existing routes/actions.
- Use real state where already available; use honest incomplete states where not available.

Phase 3: Contextual guidance

- Improve empty states on Work, Crew, Trade Talk, Tools, and Profile.
- Add one contextual prompt per surface.
- Avoid modal spam.

Phase 4: Persistence and analytics

- Add server persistence for onboarding preferences.
- Add event logging for the metrics above.
- Add admin/internal activation view later if needed.

## What not to build yet

- Do not add homeowner onboarding.
- Do not add a long slideshow before users can use the app.
- Do not require all profile proof, insurance, ID, payment, portfolio, and certifications before users can enter.
- Do not claim they are verified unless verification is actually complete.
- Do not use fake jobs or fake people as if they are real.

## Recommended next implementation slice

Build Phase 1 only:

- Update `OnboardingFlow` in `src/features/auth/AuthScreens.tsx`.
- Add a role-aware goal selector.
- Split specialties into trades and topics visually.
- Add a right/left rail preview that changes by selected role and goal.
- Route the user after completion:
  - contractor/find help -> Work
  - contractor/build crew -> Crew
  - contractor/tools -> Tools
  - tradesperson/find work -> Work
  - tradesperson/build profile -> Profile
  - tradesperson/trade talk -> Shop Talk
- Keep all existing server validation and compliance gates intact.

This gives users a clear sense of what is possible without delaying Gate A with a large onboarding platform.
