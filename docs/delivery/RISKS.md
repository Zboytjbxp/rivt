# Gate A Risk Register

| ID | Severity | Risk | Current evidence | Required mitigation / exit |
|---|---:|---|---|---|
| R-001 | Critical | Authentication fails open in the browser | Closed: browser fallback removed; CI and live failed-login checks pass on deployed commit | Preserve fail-closed coverage in every auth packet |
| R-002 | Critical | Private records are session-cookie scoped without authenticated ownership | Mitigated and deployed for legacy routes with CI cross-user isolation and live 401 checks | Normalize domain ownership in Packets 01-07 |
| R-003 | Critical | Seed jobs/talent/reviews can appear as real marketplace activity | `src/data.ts`, seed constants, guest demo jobs | Production empty states; synthetic data confined to tests/demo environment |
| R-004 | High | Google users receive fabricated role/company/location | Mitigated locally: new OAuth users enter pending onboarding | Verify live OAuth onboarding and existing-account preservation |
| R-005 | High | Session fixation/overlong sessions | Rotation is CI-proven and deployed; live signup/logout passed | Add device/session controls in Packet 02 |
| R-006 | High | Core records can conflict or be overwritten as one JSON blob | Debounced whole-state PUT | Normalized domain schema and optimistic/state conflict strategy |
| R-007 | High | Upload authorization and type safety are insufficient | User ownership, exact MIME allowlist, and limits exist; broken bucket-name config was found and corrected variables are staged | Deploy/verify new bucket, then add content-signature checks and scanning decision |
| R-008 | High | Known upload denial-of-service vulnerability | Closed in source and CI: Multer 2.2.0 and zero-vulnerability audit | Verify deployed lockfile/build |
| R-009 | High | No automated authorization or critical-flow tests | Partial: unit/integration/E2E and disposable-DB authorization cases pass in CI | Expand critical journeys by packet |
| R-010 | High | Production revision cannot be proven | Closed: health/readiness report commit `4c199d9`; deployment ledger records Railway build ID | Require source SHA for every deployment |
| R-011 | High | Startup schema mutation can partially fail or drift | Mitigated in source and CI by checksummed transactional migrations and advisory lock | Deploy, verify production ledger, and preserve immutable history |
| R-012 | High | CORS/CSRF/rate-limit posture is not launch safe | Mitigated locally with approved origins, SameSite cookies, and baseline limits | Complete threat review and use durable distributed limits before scale |
| R-013 | Medium | Lint debt hides dead behavior and unsafe cleanup | Closed locally: repository lint passes with zero findings | Keep full lint required in CI; remove four deprecated exports in Packet 01 |
| R-014 | Medium | Giant component creates regression and AI-context risk | `App.tsx` over 10k lines | Strangler migration by domain; no wholesale rewrite |
| R-015 | Medium | Navigation contradicts approved IA | Inbox is fifth primary destination | Gate-aware shell and messages top-bar entry |
| R-016 | Medium | “Verified/insured/OSHA cert” copy can overclaim | Boolean seed fields and current copy | Evidence-state vocabulary and counsel/content review |
| R-017 | Medium | Backup exists without verified restore evidence | Encrypted cloud-only logical snapshot was downloaded, decrypted, and count-reconciled; no full target restore yet | Perform timed restore into isolated PostgreSQL before Gate A launch |
| R-018 | Medium | Direct undeclared dependency may disappear | Closed and CI-proven: `fast-xml-parser` is declared and installed from lockfile | Verify deployed build |

Risk closure requires evidence and owner. Lowering severity without evidence is not closure.
