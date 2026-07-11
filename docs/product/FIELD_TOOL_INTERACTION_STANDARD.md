# RIVT Field Tool Interaction Standard

**Status:** Active product rule
**Applies to:** Camera, Estimate, Invoice, and every tool added or materially redesigned after this document

## 1. A tool is useful without marketplace work

Every field tool must support these explicit contexts:

1. **Quick use** - no project required; the result remains a private draft until the user saves or attaches it.
2. **Standalone project** - private off-platform work owned by the signed-in account.
3. **RIVT workspace** - accepted RIVT work where the signed-in account is a participant.

The app must never infer context from the first job, first active-work record, most recent job, or a job that merely happens to be loaded. Context is chosen by the user or supplied by an exact deep link.

## 2. Context is visible and reversible

- Show the current save destination near the top of each contextual tool.
- Changing context requires one deliberate tap and presents all valid destinations.
- Quick-use and standalone records must never appear in a marketplace job feed.
- RIVT-work records must never silently fall back to a private album or unrelated project.
- Draft storage keys and server records must include the selected context so switching projects cannot overwrite another draft.

## 3. One-handed mobile operation

- Interactive targets are at least 48 CSS pixels high and wide where practical.
- The primary field action lives in the lower thumb zone on mobile.
- Persistent mobile actions clear the device safe area and never sit under the app navigation.
- Important actions do not exist only at the top of a long screen.
- Destructive and secondary actions do not compete visually with the primary action.
- A tool must remain usable at 375 x 553 and 390 x 664 without horizontal overflow.

## 4. Dedicated-app behavior

- A tool opens into its working surface, not a marketing explanation.
- The first viewport shows the current result, current context, and the action needed next.
- Camera prioritizes capture and the selected project feed.
- Estimate keeps the current total and Save / Invoice actions reachable while editing.
- Invoice keeps total, Save, Copy, and Print reachable while editing.
- Do not render generic albums, unrelated work, or duplicated actions while a specific project context is active.

## 5. Saving and failure truth

- Device autosave and account sync are different states and must be described accurately.
- Never display a server-saved success when only local state changed.
- A failed upload keeps the source file available for retry where the browser permits it.
- Server authorization owns project access. Hidden controls are not authorization.
- Standalone projects, their albums, and their tool records are account-private by default.

## 6. Verification checklist

For every contextual tool:

- Open from Tools with no deep link: context is **Quick use** and no unrelated job data appears.
- Select a standalone project: only that project's client, draft, photos, and records appear.
- Open from accepted work: the exact active-work ID is shown and persisted.
- Switch contexts and return: drafts remain isolated by context.
- Sign in as another account: standalone project IDs and album IDs are rejected server-side.
- At 375 x 553: context control and primary action are visible, reachable, and at least 48px.
- Browser Back returns to Tools unless the tool was opened from an exact job workspace.
