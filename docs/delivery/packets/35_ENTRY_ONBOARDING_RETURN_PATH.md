# Packet 35 - Entry, Login, and Onboarding Return Path

Status: locally verified

## Objective

Replace the low-information onboarding carousel with one decisive product
entry, keep Preview, Create account, and Log in equally discoverable, and
remove instructional clutter from the post-signup setup flow.

## Delivered

- The first screen now explains RIVT as work, proof, and trade community for
  contractors and tradespeople instead of promoting one feature per slide.
- Preview, Create free account, and Log in are all visible in the initial
  compact-phone viewport. Preview is explicitly labeled as a one-year sample
  workspace rather than real marketplace activity.
- Login includes a visible RIVT overview return path instead of trapping a
  returning user in the form.
- Product pillars make Shop Talk, Work, Network, and Field tools legible before
  signup without adding a marketing carousel.
- The setup footer no longer narrates its own controls. Back and Next share a
  stable one-handed row; only real validation, verification, and final
  readiness information occupy the status area.

## Verification

- `npm run build`
- `npm run lint`
- `npm run test:ui:guest-preview`
- `git diff --check`

The rendered smoke checks the 320x568 entry and login states, keeps all three
entry decisions in the initial viewport, exercises the login return path, and
continues through both contractor and tradesperson sample workspaces.

## Boundary

This packet changes entry hierarchy, copy, and setup ergonomics only. It does
not alter authentication, role immutability, email verification, consent,
onboarding persistence, guest-preview isolation, or authorization.
