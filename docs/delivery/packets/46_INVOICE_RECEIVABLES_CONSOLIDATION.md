# Packet 46 - Invoice and Receivables Consolidation

## Objective

Make Invoice the single customer-billing workspace without deleting payment
records or changing invoice calculations. The existing invoice builder and
receivables tracker become Draft and Receivables sections of one app.

## Product boundary

- One Invoice launcher replaces the separate Invoice and Receivables
  launchers.
- Draft preserves customer details, line items, templates, print, email, and
  estimate-to-invoice conversion.
- Receivables preserves the existing payment tracker and its saved records.
- A persistent lower section dock keeps Draft and Receivables reachable with
  one hand on mobile; desktop renders the same sections in flow above the
  workspace.
- Legacy `?tool=payments` links and stored Receivables shortcuts resolve to
  Invoice with the Receivables section selected.
- Existing storage keys, server records, totals, taxes, and payment-state
  behavior remain unchanged.

## Acceptance

- Tools shows one Invoice launcher and no separate Receivables launcher.
- Invoice opens Draft by default and can switch to Receivables without leaving
  the app.
- Estimate conversion opens Invoice on Draft with the converted data intact.
- Legacy Receivables deep links select the Receivables section.
- Section controls remain visible and tappable at 1440x900, 390x844, and
  320x568 without horizontal overflow or covering the working surface.
- Build, lint, tests, rendered Tools QA, security lint, dependency audit, diff
  checks, and focused tool-record integration verification are recorded before
  release.

## Non-goals

- No database migration, record conversion, or storage-key rewrite.
- No invoice math, tax, payment-processing, email-provider, or billing change.
- No merge of Estimate into Invoice; Estimate remains a separate pre-sale
  workflow with its existing conversion path.
- No redesign of the internal invoice or payment forms beyond their shared
  navigation shell.
