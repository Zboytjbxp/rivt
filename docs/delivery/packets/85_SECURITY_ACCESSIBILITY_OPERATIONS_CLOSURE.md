# Packet 85 — Security, accessibility, and operations closure

## Objective

Close the remaining machine-verifiable launch controls across authentication,
request integrity, server-side fetching, automated accessibility, and
operational readiness without claiming that automation replaces physical
device or screen-reader acceptance.

## Acceptance boundary

### Security

- New email passwords and password resets are screened against the current
  Pwned Passwords corpus through its privacy-preserving five-character SHA-1
  range API. The raw password and full hash never leave RIVT.
- A known-compromised password is rejected with a typed, actionable error.
  A provider outage is recorded as degraded screening and does not turn the
  external service into a signup availability dependency.
- Invalid login performs the same password-hash work whether or not the email
  exists, removing the current account-enumeration timing shortcut.
- Unsafe browser requests are rejected when Fetch Metadata identifies a
  cross-site source. Exact Origin or Referer checks remain the fallback.
  Stripe webhooks stay outside the browser-origin guard, and the state/nonce
  protected Apple form-post callback remains explicitly reachable.
- Trade News article enrichment resolves every outbound article hostname and
  rejects private, loopback, link-local, carrier-grade NAT, multicast, and
  reserved destinations before each request and redirect.
- Security regression tests cover password privacy, provider failure,
  enumeration work, Fetch Metadata, Referer fallback, callback exemptions,
  and DNS-resolved SSRF denial.

### Accessibility

- The automated authenticated accessibility route matrix reflects the current
  product: Home, Work, Camera, Shop Talk, Tools, Messages, and account
  surfaces, including the People/Contacts entry under Work.
- The matrix checks mobile and desktop layouts, 200% text, reduced motion,
  named controls, visible keyboard focus, dialog Escape/focus return, tap
  targets, image alternatives, landmarks, and horizontal overflow.
- The physical checklist is updated to the current navigation and records the
  exact remaining hands-on evidence for iPhone Safari, Android Chrome,
  desktop keyboard-only, and a real screen reader.
- Physical-device and assistive-technology rows stay open until a human runs
  them. Packet 85 may not mark `GA-UX-006` fully Verified from headless
  browser evidence alone.

### Operations

- `incident:readiness -- --require-ready` and
  `launch:readiness -- --require-ready` pass from committed, dated evidence.
- CI continues to require launch readiness, the full unit/integration
  aggregate, fail-closed E2E, and the production dependency audit.
- Exact-source deployment health and the production synthetic monitor pass
  after merge.
- No restore, rehearsal, Stripe payment, notification delivery, or support
  response is fabricated for this packet.

## Explicit exclusions

- No production database or object-storage migration.
- No production password, email address, full password hash, API key, webhook
  secret, or provider response body is logged.
- No claim that VoiceOver, TalkBack, NVDA/Narrator, physical cameras, mobile
  keyboards, poor-signal radios, or OS-level large-text behavior was tested by
  headless Chromium.
- No change to billing/Connect settlement rules, public-content privacy,
  offline write scope, or role authorization.

## Required evidence

- A canonical Codex Security scan bundle with threat model, deterministic
  scope, candidate validation, attack-path decisions, findings/coverage JSON,
  and generated report.
- Production build, application lint, security lint, full unit/integration
  aggregate, E2E, focused rendered accessibility/product suites, launch and
  incident readiness, dependency audit, and diff integrity.
- Exact production source from `/api/health` and a passing production monitor.
- Updated `BUILD_STATE.md`, requirement maturity/evidence, deployment ledger,
  and the physical accessibility handoff.

## Three-things review

Before advancing, explicitly review:

1. whether password screening leaks the password, makes signup depend on a
   third party, or silently disables itself in production;
2. whether stricter browser-source checks break Stripe or OAuth callbacks, or
   leave a cookie-authenticated mutation reachable cross-site;
3. whether automated accessibility evidence is being mistaken for physical
   device and screen-reader acceptance.

Packet status: **Locally Accepted**. Production and physical-device evidence
remain pending exactly as described above.
