# Gate A Risk Register

| ID | Severity | Risk | Current evidence | Required mitigation / exit |
|---|---:|---|---|---|
| R-001 | Critical | Authentication fails open in the browser | Mitigated locally: fallback removed and Playwright failure-path passes | Deploy exact commit and pass live failed-login smoke test before closure |
| R-002 | Critical | Private records are session-cookie scoped without authenticated ownership | Mitigated locally; disposable-DB cross-user test added | Pass CI, deploy, then normalize domain ownership |
| R-003 | Critical | Seed jobs/talent/reviews can appear as real marketplace activity | `src/data.ts`, seed constants, guest demo jobs | Production empty states; synthetic data confined to tests/demo environment |
| R-004 | High | Google users receive fabricated role/company/location | Mitigated locally: new OAuth users enter pending onboarding | Verify live OAuth onboarding and existing-account preservation |
| R-005 | High | Session fixation/overlong sessions | Mitigated locally; DB-backed rotation test added | Pass CI and later add device/session controls |
| R-006 | High | Core records can conflict or be overwritten as one JSON blob | Debounced whole-state PUT | Normalized domain schema and optimistic/state conflict strategy |
| R-007 | High | Upload authorization and type safety are insufficient | User ownership, exact MIME allowlist, and limits now exist locally | Add content-signature checks, malware scanning decision, and cross-user tests |
| R-008 | High | Known upload denial-of-service vulnerability | Closed locally: Multer 2.2.0 and zero-vulnerability audit | Recheck in CI and deployed lockfile |
| R-009 | High | No automated authorization or critical-flow tests | Partial: unit/integration/E2E and DB authorization cases exist | Verify CI enforcement and expand critical journeys by packet |
| R-010 | High | Production revision cannot be proven | Health lacks build ID; branch/deploy drift has occurred | Build metadata and deployment ledger |
| R-011 | High | Startup schema mutation can partially fail or drift | `ensureSchema()` contains CREATE/ALTER | Versioned transactional migrations and migration status |
| R-012 | High | CORS/CSRF/rate-limit posture is not launch safe | Mitigated locally with approved origins, SameSite cookies, and baseline limits | Complete threat review and use durable distributed limits before scale |
| R-013 | Medium | Lint debt hides dead behavior and unsafe cleanup | Closed locally: repository lint passes with zero findings | Keep full lint required in CI; remove four deprecated exports in Packet 01 |
| R-014 | Medium | Giant component creates regression and AI-context risk | `App.tsx` over 10k lines | Strangler migration by domain; no wholesale rewrite |
| R-015 | Medium | Navigation contradicts approved IA | Inbox is fifth primary destination | Gate-aware shell and messages top-bar entry |
| R-016 | Medium | “Verified/insured/OSHA cert” copy can overclaim | Boolean seed fields and current copy | Evidence-state vocabulary and counsel/content review |
| R-017 | Medium | Backup exists without verified restore evidence | No repo evidence | Timed restore drill and recorded result |
| R-018 | Medium | Direct undeclared dependency may disappear | Closed locally: `fast-xml-parser` is declared and locked | Verify CI installs from lockfile |

Risk closure requires evidence and owner. Lowering severity without evidence is not closure.
