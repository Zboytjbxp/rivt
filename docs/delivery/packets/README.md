# Gate A Execution Packets

Run packets in order. A packet is one AI session or a small number of tightly controlled sessions. Do not combine packets to save time.

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

Before each packet read:

- `RIVT_MASTER_BUILD_PROMPT.md`
- `docs/product/PRODUCT_CONTRACT.md`
- `docs/product/REQUIREMENTS_TRACEABILITY.md`
- `docs/architecture/SYSTEM.md`
- `docs/delivery/BUILD_STATE.md`
- `docs/delivery/RISKS.md`
- the active packet

After each packet update `BUILD_STATE.md`, traceability statuses, risks, migrations, acceptance evidence, and exact next task.
