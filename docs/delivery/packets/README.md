# Gate A Execution Packets

Packet files in this directory are authoritative. Selected milestones are
summarized below; follow the active-packet pointer in `BUILD_STATE.md` and run
applicable packets in order. A packet is one AI session or a small number of
tightly controlled sessions. Do not combine packets to save time.

| Packet | Outcome |
|---|---|
| 00 | Fail-closed foundation, test harness, dependency and deployment identity |
| 01 | Versioned normalized data foundation and ownership model |
| 02 | Secure authentication, verification, recovery, onboarding, profiles |
| 03 | Real jobs, discovery, location privacy, and status history |
| 04 | Applications, offers, mutual acceptance, and active work |
| 05 | Job-linked messaging and in-app notifications |
| 06 | Private project records, uploads, completion, and closeout report |
| 07 | Eligible reviews, disputes, blocks/reports, and pilot admin/support |
| 08 | Gate A hardening, migration, restore, security, accessibility, and pilot release |
| 09 | Gate B Web Push delivery |
| 10 | Gate B matching job alerts |
| 11 | Active work continuity |
| 12 | Gate B daily use |
| 13 | Workflow coherence and subtraction |
| 14 | Field camera |
| 87 — customer-payment acceptance (`87_CUSTOMER_PAYMENT_ACCEPTANCE.md`) | Live Contacts → Estimate → Invoice → Payment-path acceptance; physical-device and authorized ACH completion remain human-owned |
| 87 — money-integrity containment (`87_MONEY_INTEGRITY_CONTAINMENT.md`) | Server-side invoice/payment consistency, retry, delivery, and monotonic provider-state containment |
| 88 | Security and infrastructure hardening, recovery, and data-governance launch boundary |
| 89 | Recovery closure design and lossless artifact contract |
| 90 | Guarded provider-neutral local recovery harness |
| 91 | Recovery activation decision and retention/key-custody boundary |
| 92 | Railway production-posture decision and tunable hosting thresholds |
| 93 | Railway replica, worker, migration, and connection safety |
| 94 | Railway activation readiness, staged rollback, and exact-approval boundary |
| 95 | Immutable launch-policy and mutable provider-evidence root separation; remediation of `csf_04e2d7dfe8fbe53f254d821c` |

Before each packet read:

- `RIVT_MASTER_BUILD_PROMPT.md`
- `docs/product/PRODUCT_CONTRACT.md`
- `docs/product/REQUIREMENTS_TRACEABILITY.md`
- `docs/architecture/SYSTEM.md`
- `docs/delivery/BUILD_STATE.md`
- `docs/delivery/RISKS.md`
- the active packet

After each packet update `BUILD_STATE.md`, traceability statuses, risks, migrations, acceptance evidence, and exact next task.
