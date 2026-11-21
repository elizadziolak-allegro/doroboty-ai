# Public API browser journeys

## Intent and acceptance

Extend the existing Playwright suite with browser journeys through the real public
Request/Response handler and domain validation. Only the provider and atomic storage
contract are replaced with deterministic in-memory test doubles. No OpenAI requests,
production store, real credentials or user budget may be used.

Cover approved text-only submission, explicit approval, persistent browser state,
shared-budget exhaustion across browsers, storage failure and invalid provider output.
Every test owns an isolated HTTP server/store; parallel tests must not share state.
Assert user-visible recovery and persisted results, not only HTTP statuses.
Run the full repository gate and document the actual result.

The review found a health-response edge case: an absent textOnly field enabled
voice controls. The form now requires explicit configured:true and textOnly:false
to enable voice. The existing voice-test fixture explicitly declares this capability.
FEATURES.md records this behavior change; no layout or styling changed.
These tests do not verify the deployed Netlify runtime or actual cloud atomicity.

## Validation

Completed on 2026-11-14. The focused suite passed all five new journeys. An
additional regression assertion reproduced the enabled voice button against the
old build after a health failure; it passes with the capability check fixed.

The final `npm run check` exited 0: formatting, design-kit verification, lint,
type checking, 75 unit/API tests, 120 packet journeys, frontend and function builds,
and all 46 Playwright browser tests passed (Edge, 7 workers). The fixture callback
was renamed from use to runTest to avoid a React hook lint collision; no rule was
disabled. Review confirmed per-test storage/server isolation, real handler and
validation execution, explicit persisted-application assertions and cleanup.

No paid provider requests were made. The real ledger remains at 15 attempts,
13,797 input tokens and 19,182 output tokens. Cloud storage and provider behavior
are deterministic test doubles; deployed Netlify behavior remains outside scope.

## Running locally

Use Node 24 and the already installed Playwright browser. `npm run check` builds
fresh assets and runs all checks, including every E2E test. To run only these journeys:

```sh
npm run build
npm run test:e2e -- tests/e2e/public-api.spec.ts
```

On this Windows computer the provisioned browser is Edge; set PLAYWRIGHT_CHANNEL
to msedge in the process environment. No new browser or package installation is needed.
Tests start their own preview on 3106 and per-test loopback API on random free ports.
Do not start the normal paid API for these tests. Browser API requests are forwarded
to the test-owned handler; it never creates an OpenAI client or reads the real ledger.
The HTML execution report is playwright-report/index.html; failures retain traces
and screenshots in test-results. The readiness audit is a separate versioned snapshot
and is not silently reassessed by adding or running tests.
