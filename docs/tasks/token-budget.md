# Token-based public AI budget

## Intent

Replace the production 25-attempt cutoff with a shared USD 5 cost ledger. The
owner reports USD 0.12 historical OpenAI spend and authorizes this migration.
This is owner-reported historical cost, not an API-verified invoice. Seed USD 0.125
to cover cent rounding; conservatively add a maximum request charge for any old
tickets after the last verified 21 attempts as pending unknown-cost reservations.
Preserve old records and freeze v1.

## Acceptance

- Reserve the model's worst-case cost atomically before every provider request.
- Settle exactly once using input, cached-input and output tokens, including
  reasoning tokens in the provider's output count. Release only the difference
  after confirmed usage. Unknown usage/timeout retains its reservation.
- Never expire uncertain reservations, renew the allowance on deploy, or retry
  a paid call automatically. A missing/corrupt/stopped ledger fails closed.
- Keep local historical AI frozen; the new accounting applies to the public site.
- Verify concurrent reservations, settlement idempotency, storage failures,
  migration, operator stop and deploy persistence. Publish to the same URL.

## Technical source

Checked 2026-11-15, separate from the fictional case:
https://developers.openai.com/api/docs/models/gpt-5-mini
GPT-5 mini standard rates per million tokens: USD 0.25 input, USD 0.025 cached
input, USD 2 output. Snapshot remains gpt-5-mini-2025-08-07; no tools/audio,
8192 output tokens, 400,000-token model context. Worst-case reservation is
USD 0.116384 (conservatively allowing 400,000 input plus 8192 output tokens).

## Migration and deployment — 2026-11-15

The live v1 store contained 25 used attempts, not the previously observed 21.
Stopped the v1 manifest and waited over 60 seconds for old calls before creating
cost-ledger-v2 once using onlyIfNew in the same site-wide store. The owner-reported
USD 0.12 is not timestamped against individual calls: four extra old attempts retain
separate pending reservations of USD 0.116384 each. Their sum, USD 0.465536, is
unknown-cost coverage, not measured spend. They may be reconciled only against
confirmed provider records; no automatic release or expiry was introduced.

Seeded charged estimate USD 0.125 (reported USD 0.12 + USD 0.005 rounding buffer).
The legacy manifest stays disabled and all attempt records are unchanged. The
local ledger remains transferred/frozen. Rollback must never re-enable v1.

Production deploy `6af994f09f7a41a721210bff` is ready at
https://doroboty-ai-eliza-demo.netlify.app, context production, Node 24. The execution
environment for elevated CLI calls could not access the previously installed CLI.
Published through the official Netlify REST API using the existing authorized
session in memory. Replaced the previous CLI ZIP's user entrypoint with the fresh,
standalone esbuild bundle; preserved the Netlify Lambda bootstrap, function routes,
Node 24 runtime and rate rule. Static files use content hashes, with the same
security _headers configuration. No source repo push or public secret was needed.

## Verification and review

- Main release gate passed formatting, reference kit, lint, types, 83 unit/API
  tests at that point, packet validation, build and function import. In the initial
  46-browser-test run, 43 passed and 3 exceeded 30-second limits, including PDF
  downloads. Only those 3 were rerun with one worker and a 60-second command-line
  timeout: all passed in 39.4 seconds, with no product changes. This was not a
  single all-green initial E2E run.
- Two additional integration regressions brought the final unit/API suite to
  85 passing tests. Supplemental typecheck, lint for changed tests and formatting
  passed. Browser public-api fixtures now exercise token accounting with conditional
  updates; the historical v1 module is retained only for compatibility tests.
- The SDK emulator's GET omits ETag in version 11.1.9. The new SDK test initially
  exposed this and now asserts fail-closed behavior and an unchanged balance; the
  production CAS requirement was not weakened. Real-cloud atomicity was verified
  separately: 8 updates using one ETag produced exactly one winner and rejected
  a stale overwrite (`artifacts/token-cas-check.json`).
- One paid synthetic public questions request returned 200 and 3 valid questions
  in 7.302 seconds. It settled exactly one reservation at USD 0.001029 from returned
  provider usage; its unused reservation was released. This also proved the old
  exhausted 25-attempt count does not block v2. No automatic paid retries were made.
- Real operator stop/enable commands were imported with credentials only in
  process memory. Health changed 200 -> 503 -> 200, with charged and pending
  amounts unchanged. The old manifest remained disabled throughout.
- Final health: configured=true, accounting=tokens, spentUsd=0.126029,
  reservedUsd=0.465536, remainingUsd=4.408435, maximumUsd=5. AI is enabled.

Separate review checked reservation-before-provider ordering, CAS conflict retries,
bounded storage, stop races, idempotent settlement, cached-input arithmetic,
reasoning-inclusive output counts, invalid-content charging, uncertain write
handling and one-time migration/rollback boundaries. Deadlines are 4s reserve +
20s provider + 4s settlement within the observed 30s host execution window.
Financial accounting is per request receipt, not mutable service-instance state.

Evidence (ignored, private operator artifacts): token-migration.json,
token-api-deploy.json, token-deploy-status.json, token-live-smoke.json,
token-operator-check.json and token-status.json under artifacts/.

## Limits

The historical seed is owner-reported, not an OpenAI invoice fetch. Rates are fixed
for the approved GPT-5 mini snapshot; change them if provider pricing changes.
Uncertain historical/time-out usage stays reserved, and the cap covers only this
application, not unrelated consumers of the same API key/account. The test did not
repeat the full paid conversation or a second live browser flow because this change
affects backend accounting. Existing static UI and scenario persistence are
unchanged. The historical production-readiness score has not been rerun.
