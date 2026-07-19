# Packet 67 - Saved Media Pinch Zoom

## Goal

Let a tradesperson inspect saved visual proof without browser page zoom or a
second device.

## Scope

- Add one reusable full-screen viewer for saved images.
- Support pinch zoom from 1x through 4x, dragging when enlarged, double-tap
  zoom, keyboard Escape, and bottom controls for one-handed adjustments.
- Use it on Shop Talk post and news detail media, job-photo detail, and
  punch-list photos and previews.
- Preserve the existing behavior of list and feed cards; the viewer is opened
  only through deliberate image interaction on a detail surface.

## Acceptance

- An attached Shop Talk post image opens into an inspectable full-screen view.
- A job-proof or punch-list image opens into the same viewer.
- Pinch, drag, reset, and close are usable without changing browser text size.
- Regular feed-card taps still open the post rather than unexpectedly opening
  a modal.

## Non-goals

- No image annotation, crop, OCR, download, or server changes.
- No change to the separate accessibility text-size preference.
