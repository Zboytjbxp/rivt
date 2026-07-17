# Heavy 16th Standalone Calculator Audit

Date: 2026-07-17

## Verdict

Heavy 16th already had a strong field-calculator foundation: direct
feet/inches entry, a complete sixteenth strip, 1/32-inch heavy/light nudges,
double/half controls, metric millimetre entry, exact unit conversion, large
keys, and a compact no-scroll layout. It did not need another calculator mode.

The gap was continuity. Before this packet, the display showed only the most
recent operation label, completed work disappeared after the next entry, and a
mistap or mode change gave the user no way to recover a result. That made a
capable calculator feel like a keypad rather than a standalone field app.

## Changes

- The display now behaves like a live calculator tape. While an operation is
  being entered, both operands and the pending operator remain visible.
- Completed equations and double/half operations are saved in a short,
  device-local calculation history. Tapping a result restores it directly to
  the calculator in its original imperial or metric mode.
- A dedicated History action sits beside Clear and Copy. On phones, history
  opens as a thumb-reachable bottom sheet with focus trapping, Escape/backdrop
  dismissal, and an explicit close action.
- Mode controls now say `MODE MM` and `MODE IN`, replacing the ambiguous
  `MET ON` / `IMP ON` labels.
- Copy feedback is announced to assistive technology without adding another
  visual banner over the keypad.

## Preserved boundaries

- Heavy 16th remains a fractions and measurement calculator. Spacing, cuts,
  hardware, and estimator modes are intentionally not being restored.
- Calculator preferences and tape history remain harmless device-local data;
  no job, customer, invoice, or other business record is stored in this tape.
- The compact 375x553 layout keeps all fifteen fraction buttons and the full
  keypad visible without the app top bar or bottom navigation competing for
  space.
- Metric users retain native millimetre/tenth entry and 0.5 mm heavy/light
  adjustments rather than receiving a converted imperial-only workflow.

## Remaining optional improvements

- Physical keyboard shortcuts would improve desktop speed but are not needed
  for the mobile field workflow and should be added only with a dedicated
  shortcut/help treatment.
- A native install or OS-level calculator shortcut belongs to future PWA/app
  packaging work, not this component.

