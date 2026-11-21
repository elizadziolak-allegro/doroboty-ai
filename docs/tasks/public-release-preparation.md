# Public release preparation

## Scope and acceptance

Prepare, but do not deploy, the public training prototype: independent browser-local
synthetic scenarios, text-only real AI, USD 5 total including previous rehearsals,
no paid hosting or add-ons. Public support: eliza.dziolak@gmail.com (owner approved).

- Deployable request handler reuses domain validation; no browser secrets.
- Shared, finite, non-refundable AI reservations survive deploys and concurrent calls.
- Missing/corrupt storage and uncertain reservations must prevent provider calls.
- Local-to-cloud handoff cannot renew the budget; rehearse with temporary data only.
- Bound requests, document emergency stop/recovery and post-deployment smoke checks.
- Assess dependencies, run the full gate and review the final changes separately.
- Refresh the readiness report with actual evidence; keep remote checks unverified
  until they are executed. Do not claim that local tests verify a deployed service.

## Decisions

The owner approved public access without login, independent scenarios, the public
support email above and zero additional service cost. Account setup, production
secrets, actual publication and remote validation remain for the next quest.

## Validation

Completed 2026-11-14: npm run check (the Windows equivalent of scripts/verify)
returned 0 after the final runtime-context correction: formatting, reference-kit
integrity, lint, TypeScript, 75 unit/API tests, packet validation, static build,
function bundle/import and 41 Edge browser journeys. The isolated browser restore
also confirmed that selecting a different persona does not modify the first browser.
Footer contact is keyboard reachable and reflows at 375px; desktop/mobile captures
in artifacts/demo were visually inspected. The immutable kit was not modified.

Two explicit real-provider probes through the public Request/Response adapter with
the local persistent ledger passed: questions in 19.245s and summary with validated
source quotes in 34.195s. They used synthetic text, no retries, and two existing
allowance slots. The ledger now has 15 used / 10 remaining; USD 3 reserved is a
conservative ceiling, not actual billing. These probes are not cloud deployment tests.
Their service/validation modules were unchanged in the later context-only correction.

The final npm audit returned 0 and no known advisories. The shadcn generator and
deepmerge dependency were removed; the existing CSS and license were retained.
typescript-eslint was updated; a scoped minimatch 11.0.1 override removes the other
advisory. Full lint/type/build/browser checks passed with this override.

Source/dist/Git-history scan found no credential-pattern or exact local-key matches.
The local key was compared in memory only; neither its value nor a key hash was logged.

## Separate review

Reviewed reservation-before-provider ordering, bounded storage transport, uncertain
write receipts, maximum ticket range, no refunds/deploy resets, handoff-before-init,
public route/body/origin validation and safe logging. Corrected the Netlify context
gate to use runtime context.deploy.context, not the build-only CONTEXT variable.
Corrected Free-plan documentation: separate variable scopes may require a paid plan;
private variables must never be exposed with VITE_ or printed, even during build.

Concurrency tests model the provider's atomic claim contract. SDK persistence/stop
were rehearsed against isolated local storage. Inspection found that the SDK local
emulator is not an atomic race oracle; actual cloud concurrency is therefore an
explicit deployment check. No production store, account, secret or deploy was created.

Visual changes reuse the existing C12 footer, links and typography, with no new
component family or theme. Additional build chunk-size warnings are optimization
recommendations; no threshold was suppressed. Functions are disabled by default.

The final evidence and remaining deployment gates are in docs/production-readiness.html.
