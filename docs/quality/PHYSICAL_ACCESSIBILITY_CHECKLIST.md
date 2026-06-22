# Gate A Physical Accessibility Checklist

Use this checklist to close the remaining non-machine Gate A accessibility boundary. Automated smoke evidence is not a substitute for this pass.

## Target

- URL: `https://rivt.pro`
- Build under review: record `/api/health` commit before starting.
- Test accounts: use invited disposable contractor and tradesperson accounts; close or revoke them after the pass.

## Devices and Browsers

| Device/browser | Required |
|---|---:|
| iPhone Safari | Yes |
| Android Chrome | Yes |
| Desktop Chrome keyboard-only | Yes |
| Desktop or mobile screen reader | Yes |

Recommended screen readers:

- iOS: VoiceOver
- Android: TalkBack
- Windows: NVDA or Narrator
- macOS: VoiceOver

## Core Routes

Run each route as Contractor and Tradesperson where role-correct.

| Route/surface | Checks |
|---|---|
| Auth/login | Labels announced, invalid login error announced, no local fallback, 44px controls |
| Onboarding/profile | Role is clear, selected state visible, required errors announced |
| Home | Top-bar controls named, primary actions reachable, no overlap at 200% text |
| Work | Filter/post/apply controls reachable, empty/error states understandable |
| Crew | Cards readable, actions named, no horizontal scroll |
| Shop Talk | Search, trade filter, reaction controls, Trade News toggle/link names |
| Tools | Calculator, Invoice Draft, Daily Log, Records surfaces usable and readable |
| Messages/Inbox | Thread list, composer, notifications, empty states, mute/report controls |
| Profile/settings | Sign out, theme controls, notification preferences named |

## Manual Pass Criteria

For each route:

- No horizontal page scroll.
- No clipped or overlapping text.
- Every visible control has a spoken/visible name.
- Every tap target is comfortably tappable.
- Focus order is logical and does not trap the user.
- Error/success state is announced or visible near the triggering control.
- Light/dark theme remains readable.
- 200% text remains usable without hiding required actions.

## Evidence to Capture

For each device/browser:

- Device model and OS/browser version.
- Account role used.
- Routes covered.
- Pass/fail notes.
- Screenshots of any failure and at least one pass screenshot for Home, Work, Shop Talk, Tools, and Inbox.
- Screen-reader notes: first five focus targets on Home and one completed action flow.

## Failure Handling

Any failure that blocks posting work, finding work, messaging, viewing records, signing out, or understanding an error is a Gate A blocker. Record the failure, fix it, redeploy, and rerun the affected route/device.
