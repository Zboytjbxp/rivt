# Security Hardening Review: RIVT Recovery Closure

## Evidence Basis

This review is bound to repository source
`5a561a836834bae09d404628e7b0447b216bbfda` and the 24-artifact evidence
collection recorded in [context.md](context.md), collection SHA-256
`f170d32f0da2b2527ff003afebae195112dea6d20aaaa01c4f9d27ae47589080`.
Recovery implementation source has not drifted from that revision. Packet 89
delivery-state, risk, and traceability documentation was updated afterward,
so structured analysis records documentation-only source drift as `present`
while preserving the pre-analysis collection digest.

I inspected the database artifact creator/restorer, restore verifier, upload
flows and schemas, Packet 88 assessment, approved recovery policy, prior
restore evidence, current aggregate bucket inventory, and official Railway
and AWS recovery documentation. No production object was read and no
provider resource or setting was changed.

The evidence supports one structural opportunity: bind PostgreSQL and every
referenced object into a consistent, independently retained recovery point.
The fresh database artifact alone cannot recover file bytes.

## Constraints

- No potentially chargeable provider action is allowed without Michael's
  explicit approval immediately beforehand.
- Production PII and file bytes must not be copied to a developer workstation,
  repository, or evidence log.
- Normal database communication must remain on Railway private networking.
- The existing 24-hour RPO, 4-hour RTO, 30-day retention, and monthly restore
  cadence remain the minimum accepted targets.
- Malware scanning, retention/legal approval, HA, and provider compliance are
  adjacent blockers, not silently solved by backup work.
- Current pricing and the 40.4 MB bucket inventory support estimates, not a
  guarantee of a final invoice.

## Opportunity Portfolio

| Opportunity | Evidence | Options | Recommendation | Proposal |
| --- | --- | --- | --- | --- |
| Complete database-and-object recovery boundary | Fresh-artifact and object-byte gap (Packet 88), database restore tooling, media integrity schemas, current Railway bucket limitations | 1. Restore-only baseline; 2. full-corpus Railway snapshot; 3. cross-provider immutable backup | Choose Option 3; use Option 2 once as a capped proving stage | [Complete recovery boundary](proposals/complete-recovery-boundary.md) |

## Recommendation Summary

I recommend a separate-provider, client-side-encrypted backup with versioning,
enforced retention/Object Lock, an append-only production writer, and a
separate recovery credential. It is the only option reviewed that survives
compromise or deletion of the production Railway account.

We can get there without making a blind provider change. First we build and
review the bounded verifier locally. Then, only after an explicit **US$1.00
maximum incremental Railway-usage authorization**, we restore the exact fresh
database artifact and copy/restore the complete current 89-object corpus
through disposable private Railway targets. That produces honest one-time
proof and validates the harness. It does not become the long-term backup.

At the observed 40.4 MB scale, the one-time drill's conservative internal
model is below US$0.66, and a deliberately inefficient 30-day daily
cross-provider object copy is illustratively around US$0.11/month before
database bytes, compute, tax, growth, and retrieval. Neither number is an
invoice promise or spending authorization.

## Next Decisions

1. Approve or reject Option 3 as the target recovery architecture.
2. Separately approve or reject the US$1 Railway ceiling for the one-time
   proving drill after the local harness is reviewed.
3. Select the separately administered immutable destination. AWS S3
   Compliance Object Lock is the current recommendation, subject to account,
   region, DPA, retention, and cost approval.
4. Name the backup-encryption key custodian and offline recovery-credential
   holder.
5. Approve retention/deletion treatment for normal files, professional
   evidence, legal hold, and account deletion.

Until those decisions and the resulting restore evidence exist, R-051 remains
open and public launch remains blocked.
