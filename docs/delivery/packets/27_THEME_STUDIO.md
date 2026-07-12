# Packet 27 - Theme Studio

## Goal

Turn appearance from a row of decorative swatches into a useful device-level
preference people can understand, preview, and use across the product.

## Scope

- Keep the profile trigger as the account entry point; do not introduce a
  redundant hamburger menu.
- Replace tiny theme swatches in the account drawer and Settings with one shared
  Theme Studio: current-style preview, explicit System/Light/Dark controls, and
  named palette cards.
- Extend palette tokens to navigation chrome, selected states, information
  accents, and warning highlights so a selected palette has a consistent visible
  effect beyond primary buttons.

## Non-goals

- No billing entitlement or artificial Pro lock until the paid plan has a
  truthful server-enforced entitlement model for appearance preferences.
- No brand licensing claim or third-party tool-brand naming.
- No change to account, authorization, or stored profile data.

## Acceptance

- Account and Settings present the same named palette choices with a live
  preview of the selected style.
- System, Light, and Dark are visible choices with clear active state.
- Selecting a palette visibly updates app navigation, accents, and supporting
  semantic colors without a reload.
