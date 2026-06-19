# Packet 03 — Jobs and Discovery

## Objective

Replace seeded/blob jobs with real contractor-owned jobs and tradesperson discovery.

Requirements: GA-JOB-001 through GA-JOB-010; GA-UX-001 through GA-UX-006 where affected.

## Required Work

1. Review/create jobs, locations, requirements, status-event, and draft data model.
2. Build create/edit/publish/pause/close APIs with authorization, validation, idempotency, and rate limits.
3. Implement canonical Gate A job fields and progressive draft persistence.
4. Separate public area from private exact address server-side.
5. Build paginated server discovery/filtering for open jobs.
6. Remove production seed jobs/talent/review counts; use directional empty states.
7. Migrate Work UI from blob handlers to typed APIs without reviving legacy navigation.
8. Correct the approved five-destination shell; hide deferred destinations behind flags without dead tabs.

## Acceptance

- Contractor can draft, refresh/relogin, resume, publish, edit, pause, close.
- Tradesperson discovers only real open permitted jobs.
- Exact address is absent from unauthorized payloads.
- Other contractor cannot mutate job.
- Closed/paused job rejects new interest.
- Duplicate publish does not duplicate job.
- Mobile/desktop loading, empty, error, filter, and detail states pass.

## Stop Condition

Do not implement applications/offers; leave job API and UI stable for Packet 04.
