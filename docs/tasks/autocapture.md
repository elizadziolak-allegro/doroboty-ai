# Restricted Autocapture — 2026-11-16

## Intent and acceptance

Enable one safe automatic click event for a public, static button so the owner can
test Autocapture in PostHog. Keep forms, account areas, CVs, application content,
notes and AI screens outside Autocapture. Keep session recording disabled. Confirm
the browser build and existing behavior gate before publishing, then verify the
click in the owner's signed-in PostHog project.

## Implementation

- Autocapture listens only for clicks on buttons marked
  `data-ph-autocapture-safe`. The only marked button is the public **Build**
  category tab on the offers page. No form field, application, profile or employer
  control carries the marker.
- Element text and attributes are masked. A `before_send` hook reduces an
  Autocapture event to the PostHog identifiers, click type and a fixed
  `public_build_tab` label. It does not send the current URL, search query,
  surrounding text, form values or DOM element chain.
- Session recording remains disabled. The public privacy page now describes the
  one automatic click event. Existing explicit product events remain separate.
- Project-level Autocapture settings cannot be inspected from this session;
  the owner will confirm the result in the selected **Default project**.

## Verification

- `PLAYWRIGHT_CHANNEL=msedge npm run check` passed: format, design system,
  lint, types, 86 unit/API tests, packet verification, build and 47 browser tests.
  The first sandboxed attempt hit an `EPERM` child-process restriction; the
  authorized rerun completed successfully.
- Netlify production deploy `6afab72a1b5150f6a5fbca8c` is `ready` at the
  existing public URL. The remote JS asset SHA-256 matches the tested local
  build, and `/api/health` still reports token accounting.
- On the live page, the sole marked button was **Build**. Clicking it changed
  the public offers filter, and the privacy route displayed the new disclosure.
  This confirms the UI behavior and deployed configuration, not event receipt.
- The owner's signed-in PostHog **Default project** still needs a check for
  `$autocapture` with `autocapture_target=public_build_tab` and for the project
  setting. A screenshot of event properties should confirm that URLs, text,
  form values and DOM chains are absent. No session recording was enabled.
