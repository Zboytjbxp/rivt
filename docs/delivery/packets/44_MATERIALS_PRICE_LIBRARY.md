# Packet 44 - Materials and Price Library

## Objective

Replace the overlapping Materials and Price Book launchers with one field-ready
Materials app while preserving every saved supplier price and old deep link.

## Product boundary

- Materials remains useful for work acquired inside or outside RIVT.
- Takeoff presets contain geometry and waste assumptions only. RIVT does not
  invent supplier prices or silently seed an account with stale catalog data.
- The server-owned `price_book` tool-record type and the existing
  `rivt.priceBook.v1` device cache remain intact.
- No schema, authorization, billing, or production-data migration changes are
  included in this packet.

## Delivered behavior

- One Materials launcher opens three clear views: Takeoff, Sheets, and Price
  library.
- Existing saved prices are merged by record ID and update time rather than
  being replaced when server and device records meet.
- A legacy `?tool=price-book` link opens Materials directly on Price library.
- A legacy pinned Price Book shortcut is normalized to Materials without
  duplicating the shortcut.
- Mobile Price library presents saved prices before its add form, keeps all
  controls inside the viewport, and uses 44px tab targets.

## Acceptance evidence

- Production build passes.
- ESLint and security lint pass.
- Unit and E2E suites pass.
- Tools rendered QA passes at 1440x900, 390x844, and 320x568, including:
  one launcher, all three views, preserved saved-price visibility, legacy-link
  compatibility, and no horizontal overflow.
- Mobile-actions UI passes. The aggregate command reached the serial PostgreSQL
  integration run and exceeded the 15-minute local command window without a
  reported assertion failure; the directly affected server-owned tool-records
  integration suite then passed independently against the configured test
  database.
- Production dependency audit reports zero vulnerabilities.

## Remaining physical check

On one founder device, open Materials, switch through all three views, confirm
an existing supplier price is present, add one current price, leave the tool,
and confirm it remains after returning.
