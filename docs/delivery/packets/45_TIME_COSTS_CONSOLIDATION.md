# Packet 45 - Time and Costs Consolidation

## Objective

Reduce supporting-tool sprawl without deleting records or changing financial
calculations. Time Tracker, Expense Logger, Mileage, and Tax Summary become four
sections of one `Time & costs` app.

## Product boundary

- One supporting launcher replaces four separate launchers.
- The app uses a persistent lower tab dock with Time, Expenses, Mileage, and
  Summary sections sized for one-handed mobile use.
- Existing `time_session`, `expense`, and `mileage` server records and all
  existing device keys remain unchanged.
- Legacy URLs for `time-tracker`, `expense-logger`, `mileage`, and
  `tax-summary` open the matching section inside the consolidated app.
- Legacy pinned shortcuts are normalized to `time-costs` when read.
- Summary remains explicitly labeled as an estimate and directs the user to a
  tax professional. No tax or income data is invented.

## Acceptance

- Tools shows one `Time & costs` launcher and no separate Time, Expenses,
  Mileage, or Tax Summary launcher.
- Each section remains independently usable and reads its existing saved data.
- The lower tabs remain visible, tappable, and in viewport at desktop,
  390x844 mobile, and 320x568 compact-phone sizes.
- Old deep links select the expected section.
- No horizontal overflow is introduced.
- Build, lint, tests, rendered Tools QA, security lint, dependency audit, and
  focused tool-record integration verification are recorded before release.

## Non-goals

- No database migration or record conversion.
- No changes to IRS mileage rates or tax formulas.
- No new tax advice, payroll, payment, or bookkeeping claims.
- No redesign of the internal forms beyond their shared navigation shell.

