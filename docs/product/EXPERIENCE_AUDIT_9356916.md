# RIVT Experience Audit — master @ 9356916 (2026-07-10)

Production = origin/master = `9356916` (confirmed via /api/health). Founder ask:
improve the experience — visually, workflow, ease of use, QoL, engagement.
Method: two parallel code reviewers (visual system + PWA/resilience; engagement
mechanics) with file:line citations, plus a live drive: the NEW desktop
workspaces at 1280×800, the NEW guest demo at 390×664, mobile regressions.

## Confirmed improved in this deploy (verified, no action)

- **Desktop workspaces (be6a6d2) are token-consistent and genuinely good** —
  sidebar nav, Ctrl+K search, Home feed + right rail, Shop Talk 3-pane with
  sticky thread, crew workbench, 3-across Tools grid. 1280px is properly used
  now, not stretched mobile.
- **The guest demo (a764fd2) is the right cold-start answer** — an explicitly
  labeled "one-year sample account" (27 jobs, $68.4k invoiced) with a
  persistent sample-data banner + Switch role/Sign up/Exit. Honest, effective
  sales surface.
- Visual backlog closed: `--v2-radius-xl` defined (square-corner bug gone),
  `--v2-radius-pill` used 134× with zero 999px literals left, black/orange CTA
  systems converged (4b7c661, verified in diff), nav/topbar now opaque, FAB
  clearance fixed on phones, shared focus-ring token added.
- PWA shell solid: manifest complete (maskable icons), SW navigations
  network-first + no-store (stale-index trap closed), offline fallback page.
- security.txt + disclosure page: valid RFC 9116, honest scope, no
  overclaiming. Auth surface (prior pass): CTAs above fold, safe login error,
  password-manager autocomplete, forgot-password flow.
- Pro proof packet (0391165) is wired to REAL data (media count, log entries,
  completion submissions) — honest per-job progress meter.

---

## The two things that matter most

**1. Engagement ceiling: every signal dies inside an open tab.** Web push is
half-built — the client creates a subscription and stores it in localStorage,
never sends it to the server; no server push route, no web-push dep, empty
VAPID key (`usePushNotifications.ts:48`, `.env:44`). Email is used exactly
twice ever (verify + reset). And the two most motivating marketplace events
generate NO notification at all: **a new job matching your trade** (POST
/api/v1/jobs → zero fan-out) and **an application received on your job**
(`server/index.js:3316-3395` → silence). Day-2 return currently depends on the
user remembering the app exists.

**2. Field reliability: no fetch timeouts anywhere.** `makeRequest`
(`src/lib/api.ts:36-48`) has no AbortController; on 1-bar jobsite LTE any hung
request is an infinite spinner. Compounding it: a 500 on boot is treated as
logged-out (user lands on sign-in thinking their account is gone,
`App.tsx:815-830`); a failed photo upload loses the captured blob and aborts
the rest of the batch (`JobPhotosTool.tsx:230-283, 830-834`); the offline
banner promises "changes will sync when you're back online" but no sync queue
exists (`OfflineBanner.tsx:51`); 429s render a meaningless generic error; and
the SW auto-reloads the app on update — possibly mid-form
(`index.html:120-125`).

---

## Findings by dimension

### Visually
- **Raw status hexes still break dark mode** (~77 bare uses): worst
  profile-hub.css (33), work-workspace.css milestone pills with hardcoded
  amber/green text (:2064-2066), tools-studio.css pastel payment badges
  (:5141-5147) that glare on dark. Mechanical token swap, 1-2 hrs.
- **Dead CSS grew**: styles.css 9.9k → **11,712 lines (~53% dead)**;
  tools-studio.css 7.3k → **8,938 (~33% dead)**. New work now pays a
  specificity tax (duplicate workbench grids to "win" against legacy rules —
  network-hub.css:1574's own comment admits it). A purge pass would cut ~5-6k
  lines and real mobile payload.
- **FAB residuals** [live-observed]: overlaps "View sample profile" in the
  demo at 390px; overlaps the Communities heading on desktop Home; and the
  431-1180px non-compact band has no bottom-padding reserve at all.
- **Desktop Home right rail runs empty** for an established account
  (checklist dismissed, no nudge) — Communities orphaned at bottom-right with
  a large white void [live screenshot]. Give the rail persistent content
  (Trade News strip, recent tools, active-work summary).
- **Sidebar "Active job" card** shows the job title in ghosted low-contrast
  text with a green "Draft" status directly under the label "Active job" —
  contradictory and looks disabled [live].
- Demo banner truncates mid-word at 390px ("No live member act…") [live].
- "Run the job" floats unexplained top-right of Tools [live]. Duplicate
  black-CTA rule at styles.css:510-517 (raw hex twin of the tokenized rule).
- Purple/brown avatar circles still off-palette on community icons.

### Workflow / ease of use
- Fetch timeouts + bootstrap-500 + photo-retry (above) are the workflow
  killers in the field.
- SW update: gate the auto-reload on idle/visibility or show "New version —
  tap to refresh."
- Per-route `document.title` never changes (zero matches) — history and
  shared tabs indistinguishable; 15-line fix.
- Rate-limit UX: map 429 → "You're doing that too fast — try again in a
  minute" (honor Retry-After). One branch in makeRequest.

### QoL
- og:image is the square 512 app icon with `summary_large_image` — texted
  links render cropped/letterboxed. One 1200×630 banner fixes every shared
  link during launch. Also add og:url + robots.txt.
- `useNetworkStatus` has zero consumers (OfflineBanner reimplements inline) —
  minor dead code.
- Cache name is hand-edited (`'rivt-v5-2026-07-09-preview-recovery'`) —
  inject a build hash via Vite define and remove the human step.

### Engagement (ranked — from the mechanics review)
1. **Finish web push end-to-end** (table + POST route + web-push send inside
   `createInAppNotification`; client already subscribes, SW handler already
   exists). Turns the entire existing notification catalog into return
   triggers. M.
2. **Job-match notifications**: on job publish, fan out to accounts whose
   trade/service-area match (data already on profiles). With push = "new
   cabinet job 4 miles away" on a lockscreen — the #1 reason a tradesperson
   returns daily. S.
3. **Close the marketplace loop**: notify contractor on application received;
   notify applicant on shortlist/decline. Both sides currently act into
   silence. S.
4. **"Your question got its first answer" email** via the already-working
   Resend transport — the designed come-back-tomorrow moment; works before
   push adoption. S.
5. **Make reputation server-real**: aggregate net upvotes + verified fixes by
   author_account_id (tables exist); replace the client-side display-name-
   matching illusion (`ShopTalkView.tsx:1031-1053`) that resets on pagination.
   Then "Answer one to build your reputation" is true, and badge crossings can
   notify. M.
6. **Honest daily loop — "log today"**: active-work card reflects whether
   today has a daily-log entry; late-afternoon push when missing.
   Consecutive-days-logged is a work-anchored streak that feeds the proof
   packet Pro monetizes. M (needs the codebase's first scheduled job).
7. **Home heartbeat**: 2-3 headline "Today in the trades" strip from the
   already-live /api/news (real, fresh, currently buried in a tab), plus move
   the 3 founder prompts from hardcoded bundle constants to admin-postable
   server posts rotated weekly. S+S.
8. **Weekly recap email digest** (unread + new jobs in trade + top questions +
   your week's tool stats), preference-gated; catches everyone who never
   grants push. M.

## Recommended trains

**Train 1 — Field reliability (do first, mostly S):** fetch timeout + error
shape; bootstrap 500 ≠ logged out; photo retry + keep blob; offline-banner
copy honesty; 429 copy; SW reload gating + build-hash cache name; og:image
banner + og:url + robots.txt + per-route titles.

**Train 2 — Engagement engine:** push end-to-end → job-match + application
notifications → first-answer email → server-real rep → log-today loop → news
strip + rotating prompts → weekly digest. (Order matters: push first
multiplies everything after it.)

**Train 3 — Visual debt:** status-hex token sweep; dead-CSS purge (two
deletion-only PRs); FAB residuals (3 spots) + demo banner truncation; sidebar
active-job card contrast/label; desktop Home right-rail content; duplicate
black CTA rule; "Run the job" label.

Doc lives on `claude/new-session-2wxmgd` with the prior audits.
