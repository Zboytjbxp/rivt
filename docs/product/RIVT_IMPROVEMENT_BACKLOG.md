# RIVT Improvement Backlog

Status: working backlog generated from the current repository audit on 2026-06-27.

Scope rule: RIVT remains trades-only. Do not add homeowner accounts, homeowner lead buying, escrow, payroll, tax filing, or fake marketplace density.

## Current Audit Snapshot

- `server/index.js` is still too large at roughly 263 KB. It should keep shrinking into domain routers.
- `src/styles.css` is still too large at roughly 253 KB. Legacy/global CSS continues to compete with feature CSS.
- `src/features/tools/ToolsStudio.tsx` is too large at roughly 216 KB. Tools need to become individual app modules.
- `src/features/tools/tools-studio.css` is too large at roughly 112 KB. Tool styling needs per-tool ownership.
- `src/features/work/WorkWorkspace.tsx` is large at roughly 98 KB. Work can be split after Tools and server routes.
- `src/features/shop-talk/ShopTalkView.tsx` is large at roughly 60 KB. Shop Talk can be split into feed, news, composer, detail, and reputation components.
- `src/App.tsx` is much smaller than earlier but still owns too much cross-feature orchestration.
- Production health is good, but source/build-state documentation needs to stay aligned after each deploy.

## Phase 0 - Gate A Safety And Truthfulness

1. Keep all paid feature access fail-closed until server-owned billing entitlements exist.
2. Remove every remaining frontend-only success path that can imply a server action completed.
3. Ensure local-only drafts are labeled as local drafts everywhere.
4. Ensure local-only jobs cannot receive fake applications.
5. Ensure invoice email/SMS actions are device drafts only until server delivery is implemented.
6. Keep `/api/storage` private; use `/api/health` for public dependency proof.
7. Keep object storage fail-closed when S3-compatible config is missing.
8. Keep email verification/password recovery fail-closed when Resend is missing.
9. Keep all fake/demo/seed marketplace content out of authenticated user experience.
10. Re-run live seed/demo smoke after each deployment touching data hydration.
11. Keep support, incident, recovery, and deployment evidence current.
12. Keep backup-owner contact details out of repo content.
13. Add a short operator-facing "what changed in this build" deployment note for each release.
14. Add a quick production rollback command reference near the deployment ledger.
15. Add a "known deferred production capability" section for billing, SMS delivery, and identity verification.

## Phase 1 - Architecture And Maintainability

16. Split `server/index.js` into routers: auth, sessions, onboarding, jobs, applications, offers, projects, uploads, messages, shop-talk, news, billing, admin, support.
17. Keep `server/index.js` to app boot, middleware registration, router mounting, and health/readiness.
18. Split `ToolsStudio.tsx` into one component per tool.
19. Split `tools-studio.css` into one CSS file per tool or a shared tools primitives file plus per-tool files.
20. Split `WorkWorkspace.tsx` into list, detail, application, contractor controls, records bridge, filters, and local draft modules.
21. Split `ShopTalkView.tsx` into community feed, post composer, answer detail, trade news, and reputation modules.
22. Split global `src/styles.css` until it contains only reset, font loading, and legacy quarantine rules.
23. Add file-size guardrails to CI for known monolith files.
24. Add import-boundary documentation for app shell versus feature modules.
25. Move remaining view-routing metadata out of runtime components.
26. Add server route inventory docs generated from registered routers.
27. Add API response shape tests for high-value routes.
28. Add test fixtures that are explicitly test-only and cannot ship to production UI.
29. Make feature module ownership visible in docs.
30. Add a "do not add here" comment to monolith files during strangler migration.

## Phase 2 - Design System And Visual Polish

31. Finish reducing font weights to the token scale.
32. Finish replacing hardcoded border radii with `--v2-radius-*` tokens.
33. Finish replacing one-off shadows with tokenized shadows.
34. Standardize all panel, sheet, modal, and popover z-index values.
35. Standardize modal close buttons and mobile bottom safe-area spacing.
36. Standardize card affordances: static cards look static; interactive cards show action/chevron.
37. Standardize empty states with icon, direct copy, and one action.
38. Standardize skeleton loaders across Work, Crew, Shop Talk, Messages, Tools, and Profile.
39. Standardize toast language and severity styling.
40. Standardize avatar component usage across shell, messages, crew, profile, reviews, and Shop Talk.
41. Make all small mobile controls at least 44 px high.
42. Remove unnecessary card nesting from mobile screens.
43. Tighten page headers so mobile content starts higher.
44. Audit every screen at 390 px, 430 px, 768 px, 1024 px, and 1440 px.
45. Add screenshot diff evidence for Home, Work, Crew, Shop Talk, Tools, Messages, Profile, Records.

## Phase 3 - Navigation And Information Architecture

46. Preserve the five primary concepts: Home, Work, Crew, Shop Talk, Tools.
47. Keep Messages, notifications, search, and profile in the top bar.
48. Make every hidden secondary view reachable from a predictable parent.
49. Add a complete route-to-entry-point inventory.
50. Add breadcrumbs/back behavior for detail screens.
51. Keep a single role-specific primary action per tab.
52. Remove duplicate actions where top and bottom controls do the same thing.
53. Make global search the fastest route to people, jobs, tools, and Shop Talk.
54. Add recent searches and saved searches.
55. Add keyboard shortcuts only on desktop, never as required mobile knowledge.

## Phase 4 - Home Daily Engagement

56. Turn Home into a morning command center, not a marketing page.
57. Show active work or next best action first.
58. Show "since last visit" with jobs, replies, messages, and records needing attention.
59. Add one-tap "available today" status.
60. Add "questions in your trade" as a contributor prompt.
61. Add "crew activity" for new connections and invites.
62. Add "records due" for closeout/photos/invoices.
63. Add "news worth knowing" without crowding.
64. Add dismissible daily brief cards so repeated users are not forced through static copy.
65. Avoid fake momentum metrics for new accounts.

## Phase 5 - Work Marketplace

66. Keep contractors and subcontractors as the only marketplace sides.
67. Improve job posting into a stepper: basics, site/details, requirements, review.
68. Add job templates and quick repost.
69. Add saved recurring job templates without auto-posting by default.
70. Add application drafts that persist server-side after auth is complete.
71. Add accepted-work handshake clarity: contractor offer, tradesperson accept, active work created.
72. Show exact address only after acceptance.
73. Show proof requirements on the job detail, not buried in legal copy.
74. Add work cancellation/reschedule flows with reason and audit trail.
75. Add job status chips consistently everywhere.
76. Add applicant comparison for contractors.
77. Add "invite from saved crew" from a job.
78. Add "share my profile for this job" for tradespeople.
79. Add match explanations that are transparent and non-absolute.
80. Add soft compliance/location reminders without pretending to provide legal advice.

## Phase 6 - Crew And Professional Network

81. Make Crew a real network, not a contact list.
82. Add profile search by trade, location, availability, badges, and relationship.
83. Add saved crew lists per contractor.
84. Add "worked together" relationship state.
85. Add profile share links.
86. Add contractor-to-contractor messaging and connection requests.
87. Add tradesperson-to-contractor outreach with profile card.
88. Add "available for side work" profile status.
89. Add endorsements separated from formal reviews.
90. Add blocked/muted users.
91. Add report user flow everywhere a profile appears.
92. Add network activity that is useful, not social noise.

## Phase 7 - Shop Talk And Social Hub

93. Keep Shop Talk as trade-focused Q&A plus news, not a generic social feed.
94. Add server-owned posts and answers as the canonical reputation source.
95. Add one reaction per user per post/answer, already partly implemented.
96. Add verified fix ownership by original asker.
97. Add moderator warning banners for unsafe answers.
98. Add required flair and trade tags.
99. Add "unanswered in your trade" queue.
100. Add profile reputation summary from verified fixes and useful answers.
101. Add post save/bookmark.
102. Add mention notifications.
103. Add image attachments for questions with safe upload and moderation.
104. Add answer sorting: verified, highest score, newest.
105. Add "ask from active work" with private job details stripped by default.
106. Add community guidelines inline at compose time.
107. Add moderation queue for spam, harassment, safety misinformation, and suspicious solicitation.

## Phase 8 - Trade News

108. Keep real source URLs and source names visible.
109. Keep "Read original" links on every article.
110. Improve thumbnail quality by prioritizing article `og:image` and RSS media before fallbacks.
111. Filter out logos, favicons, sprites, avatars, and generic Google placeholders.
112. Add source filters: OSHA, ENR, Construction Dive, local, codes, workforce.
113. Add location-aware Jacksonville/local construction feed.
114. Add "discuss this" to create a Shop Talk discussion with source attribution.
115. Add "why this matters" short field-focused summary.
116. Add image/error fallback that does not look like a broken placeholder.
117. Add caching and time stamps so users know freshness.
118. Add admin source allowlist/denylist.

## Phase 9 - Tools As Individual Apps

119. Split each tool into its own module, route, local storage namespace, and test.
120. Make Tools open to an app grid, not a long mixed page.
121. Add Calculator as a standalone field calculator app.
122. Add Invoice Draft as a standalone invoice app with print/download/copy.
123. Add Estimate Builder as a standalone estimating app.
124. Add Daily Log as a standalone field report app.
125. Add Job Photos/Albums as a CompanyCam-inspired records app.
126. Add Punch List as a standalone issue tracker.
127. Add Safety Checklist as a standalone checklist app.
128. Add Mileage Logger as a standalone tax-record utility.
129. Add Expense Logger as a standalone job-cost utility.
130. Add Price Book as a standalone material/labor price reference.
131. Add Time Tracker as a standalone time log.
132. Add Bid Builder as a standalone proposal builder.
133. Add Payment Tracker as direct-payment recordkeeping, not payment processing.
134. Add Contracts/Templates as local drafts with explicit legal disclaimer.
135. Add Tax Summary as informational only, not official 1099/tax filing.
136. Gate every Pro-only tool honestly until billing is server-owned.

## Phase 10 - Records / CompanyCam-Inspired Field Proof

137. Add project albums with job, date, location, uploader, and notes.
138. Add before/during/after photo grouping.
139. Add captions and tags on photos.
140. Add automatic timeline from uploads, notes, checklists, closeout, and messages.
141. Add private signed URLs only.
142. Add upload retry and failure states.
143. Add offline upload queue later, with clear sync state.
144. Add report builder with selected photos and notes.
145. Add closeout package export.
146. Add permission model for who can view each project record.
147. Add evidence retention policy.
148. Add image compression/responsive derivatives.
149. Add EXIF/privacy review before storing location metadata.
150. Add audit events for project media access.

## Phase 11 - Messaging And Coordination

151. Add per-job message threads.
152. Add job context chip in each thread.
153. Add suggested replies for availability, scope, tools, and start date.
154. Add read receipts only if privacy expectations are clear.
155. Add attachment uploads with type/size validation.
156. Add message search.
157. Add mute per thread.
158. Add urgent flag with abuse controls.
159. Add system messages for offer/accept/reschedule/cancel.
160. Add moderation/reporting for messages.

## Phase 12 - Profiles, Trust, And Reputation

161. Add profile strength meter.
162. Add portfolio galleries.
163. Add certification/license/proof attachments with self-reported versus verified labeling.
164. Add insurance status with neutral/self-reported/verified states.
165. Add reviews only after completed work.
166. Add disputed review workflow.
167. Add badges that avoid regulated terms like Apprentice/Journeyman/Master.
168. Add availability calendar.
169. Add service area radius.
170. Add tools owned/equipment capability.
171. Add trade specialties and sub-specialties.
172. Add company page for contractors.

## Phase 13 - Onboarding And Activation

173. Keep signup fast, then ask for profile completion progressively.
174. Role selection must be visually obvious and immutable after signup unless support changes it.
175. Password rule stays 8+ characters unless security policy changes.
176. Invite code should be optional only if launch strategy permits open signup.
177. Add testing/admin account strategy separated from real users.
178. Add first-run checklist per role.
179. Add consent acceptance at signup and contextual reminders at post/apply.
180. Add email verification and phone verification status to profile.
181. Add Google OAuth, then Apple/Facebook only when provider config and merge flows are complete.
182. Add account linking before broad OAuth rollout.

## Phase 14 - Admin, Safety, And Operations

183. Add admin dashboard for support cases, reports, users, jobs, and moderation.
184. Add account restriction lifecycle: warning, timeout, suspension, ban.
185. Add audit log viewer for sensitive actions.
186. Add kill switches UI for operators.
187. Add provider status dashboard.
188. Add spend-limit tracking for SMS/email/storage.
189. Add live invite-code management.
190. Add support inbox triage.
191. Add incident drill reminders.
192. Add data export/delete request workflow.

## Phase 15 - Monitoring, Security, And Compliance

193. Keep Sentry or compatible monitoring configured and tested.
194. Add frontend error capture with source maps if privacy-reviewed.
195. Add CSP/report-only first, then enforce.
196. Add stricter upload malware/content scanning plan.
197. Add object lifecycle policy for abandoned uploads.
198. Add durable rate limits everywhere sensitive.
199. Add abuse heuristics for mass invites, spam posts, and repeated failed auth.
200. Add session management UX for active devices.
201. Add backup restore drill cadence and evidence freshness checks.
202. Add dependency review schedule.
203. Add privacy/security copy users can actually understand.

## Phase 16 - Mobile/PWA

204. Finish installable standalone PWA behavior.
205. Add app icon assets from the approved RIVT logo system only.
206. Add offline-readable shell and clear offline mutation blocking.
207. Add pull-to-refresh on Work, Crew, Shop Talk, Messages.
208. Add safe-area checks for notched phones.
209. Add Android hardware-back behavior.
210. Add mobile screenshot regression for every primary tab.
211. Add slow-network tests.
212. Add touch target audit.
213. Add text scaling audit at 150% and 200%.

## Phase 17 - Analytics And Growth

214. Add privacy-safe product analytics for activation, posting, applying, messaging, and retention.
215. Add admin view for jobs posted per week.
216. Add bids/applications per job.
217. Add time to accepted work.
218. Add completion rate.
219. Add review submission rate.
220. Add premium conversion only after billing is real.
221. Add churn/returning active users.
222. Add invite funnel metrics.
223. Add Jacksonville pilot cohort dashboard.
224. Add feedback tagging and export.

## Phase 18 - Final Polish Checklist For Each Release

225. No duplicated primary actions on the same screen.
226. No hidden feature without an entry point.
227. No buttons that do nothing.
228. No fake success states.
229. No blank cards.
230. No unhandled loading/error/empty state.
231. No horizontal overflow at 390 px.
232. No unreadable text in light or dark mode.
233. No generic placeholder thumbnails if real media exists.
234. No stale brand name or TradeCrew reference in user-facing UI.
235. No unapproved logo approximations.
236. No homeowner language.
237. Build, lint, tests, e2e, audit pass.
238. Production health reports exact deployed commit.
239. Deployment ledger and build state are updated.
240. The app feels simpler after the change, not busier.
