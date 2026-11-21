# PostHog on the public demo — 2026-11-15

## Intent and acceptance

Connect the existing public teaching demo to the selected PostHog EU project without
disrupting ordinary applications or the Netlify AI function. Accept when the
production bundle contains the intended public project token and host, the browser
uses the SDK for pageviews and selected product events, the privacy page describes
the data boundary, and the existing automated gate passes. PostHog's own event
receipt and onboarding status require separate observation in the signed-in project.

## Implementation and review

- The wizard's first pull request was merged into GitHub `main`; the newer public
  Netlify build is deployed manually from this local worktree. Pull request #2 adds
  structured logs and remains open. Its two log changes are included in the local
  production build. Do not treat GitHub `main` or that PR as the deployment source.
- Netlify and the ignored local `.env.local` use `VITE_PUBLIC_POSTHOG_HOST` and
  `VITE_PUBLIC_POSTHOG_PROJECT_TOKEN`. The host is the PostHog EU ingest domain.
  The project token is public frontend configuration; the OpenAI key stays server-side.
- Browser SDK sends pageviews and explicit product events. Automatic click capture,
  session recording, surveys, flag requests and persistent PostHog identity storage
  are disabled. Persona identification is confined to synthetic IDs and roles.
- The privacy route explains PostHog Cloud EU and excludes profile, CV, answer and
  note content from explicit events. Review found an old page in the browser cache;
  reloading showed the current deployed copy.
- `PLAYWRIGHT_CHANNEL=msedge npm run check` passed: format, design kit, lint, types,
  86 unit/API tests, packet verification, build and 47 browser tests. Browser tests
  permit only the two specific PostHog EU hosts among external analytics requests.
- Production deploy `6af9f42b37b47de27d9c405f` is `ready`. The production JS asset
  hash matches the local built asset. `/api/health` returned 200 with token accounting.
  The public privacy page displayed the new PostHog disclosure after reload.

## Verification still needed

The signed-in PostHog dashboard was not available in the in-app browser, so event
receipt and the wizard's “Completed” status were not observed. A visit to the public
page was made, but a page visit alone cannot prove PostHog ingested the event. The
owner should check the selected project's live events or wizard in her signed-in
PostHog browser. No artificial event was sent to force a completion indicator.
