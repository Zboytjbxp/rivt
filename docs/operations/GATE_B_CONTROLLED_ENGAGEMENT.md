# Gate B Controlled Engagement Runbook

This runbook covers the first period where RIVT has real Shop Talk activity, matching job alerts, active-work records, and Web Push. It complements the Gate A incident and launch runbooks; it does not weaken their readiness requirements.

## Daily operator check

1. Run `npm run monitor:production` after a deployment or any provider incident.
2. Review the moderation queue for unsafe advice, harassment, spam, and duplicate communities. Record an action and reason for every hide, lock, warning, restriction, or restoration.
3. Review `support@rivt.pro` for account recovery, active-work, billing, and privacy requests. Treat reports of missing photos or records as a private-data incident until scope is understood.
4. Confirm a sampled notification opens the exact object it names. A message opens its conversation; a matching job opens that job; a Shop Talk alert opens that post; a project alert opens that project record.
5. Check the first active job in the controlled cohort: photo upload status, today’s daily log, and any pending completion or review action. Do not inspect jobsite details unless you are an authorized participant or responding to a documented support/safety incident.

## Community quality

- Communities are created by real users, with public, contractor-only, or tradesperson-only audiences enforced by the server.
- Use search-first duplicate guidance before approving a new local community. Merge/archive only with an audit reason.
- Founder prompts are permitted only when clearly labeled as RIVT prompts. They are never presented as member posts, votes, member counts, or organic activity.
- Unsafe advice gets priority review. Lock or warn when needed; do not quietly delete a safety concern without an audit record.

## Notification truth

- The notification bell is the durable in-app source of truth.
- Device push is optional and starts only after the user taps `Enable device alerts` in Settings. Never prompt at page load.
- Push preference, browser permission, and a stored server subscription are separate conditions. A successful in-app notification is not proof of device delivery.
- When testing device alert delivery, use a real account you control and tap through to confirm the exact destination. Do not use a customer account or create fake marketplace activity.

## Matching-job alert check

- Matching alerts require selected trade plus exact public city/region/country and respect blocks and opt-outs.
- Never include an exact jobsite address, access notes, private scope attachments, or applicant information in alert text.
- The production fan-out limit is operationally bounded. If expected recipients exceed the limit, investigate before increasing it.

## Active-work record recovery

1. Confirm the job relationship and active-work id from the authoritative Work route.
2. Open the exact project record, not the generic Records list.
3. Confirm whether the media row exists and whether its status is `stored`, `failed`, or `rejected`.
4. Ask the participant to retry only the failed item. Do not tell them an upload succeeded until the job-scoped timeline shows it.
5. If a daily log is missing, direct the participant to the exact job-scoped Daily Log. Never infer a log was saved from a browser draft.
6. For invoice/payment questions, repeat the boundary: RIVT records participant-reported external payments; it does not collect, hold, verify, or protect job funds.

## Escalation

- Account access, security, privacy, unsafe-work, payment-deception, and cross-account record visibility reports escalate under `docs/operations/INCIDENT_REHEARSAL_RUNBOOK.md`.
- Platform-wide inability to save, upload, or open project records should use the relevant operational control and be recorded as an incident.
- Support must use the exact project, conversation, post, or notification id in handoff notes. Generic descriptions cause avoidable routing mistakes.
