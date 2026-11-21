# Summary timeout recovery

## Report and evidence

2026-11-15: the owner reported the generic AI unavailable message around approval
and submission. Netlify log request f8efca3a-1802-4dbf-9e8f-110f49e9decd identifies
operation summary, category upstream, duration 20,123.59 ms. Four preceding calls
succeeded. The cost ledger is enabled with more than USD 4 available, and one
unsettled additional reservation. ApplyForm.submit performs no network AI calls;
it validates the approved card and writes the browser scenario. The evidence
points to the summary provider deadline, not an exhausted allowance or failed
local submit. No raw user answers were collected.

## Acceptance

- Give OpenAI 45 seconds and deploy the function with an explicit 60-second runtime
  timeout, leaving room for two 4-second cost-store transactions.
- Classify the SDK timeout by its actual class, even when its name is Error.
- Return an actionable summary-specific timeout message with a request ID.
- Preserve drafts and require explicit manual retry; no automatic paid retries.
- Verify a summary taking longer than the former deadline, retained answers,
  approval and local submission. Publish on the same URL; preserve the cost ledger.

Technical source checked 2026-11-15 (outside fictional case evidence):
https://docs.netlify.com/build/functions/configuration/ lists a 60s synchronous
limit; the installed OpenAPI function upload operation accepts a timeout parameter.
The previous manual publication explicitly used 30s; the corrected release uses 60s.

## Result

Full npm run check passed with CI=1 (two browser workers): 86 unit/API tests,
47 browser journeys, formatting, lint, types, baseline packet, static build and
function import. The new browser regression explicitly simulates an SDK summary
timeout, reloads preserved answers, retries manually, approves the AI card and
submits the application without increasing the provider call count at submission.
The timeout regression verifies the request remains active beyond 20 seconds and
aborts at 45 seconds without retrying. Error classification checks the actual SDK
class, since its inherited Error.name did not identify the prior timeout.

Production deploy 6af99daf65448ec1d8dd28fd is ready at the unchanged public URL.
Netlify accepted the function upload with timeout=60; server uses a 45s provider
deadline plus separately bounded 4s reservation/settlement transactions. Published
through the same authenticated API procedure, preserving bootstrap, Node 24,
static assets, security headers, routes, rate rule and the existing v2 cost ledger.

A real synthetic summary request returned HTTP 200 in 13.035 seconds, with three
validated evidence cards and retained source quotes. Request ID:
ca1a52bd-262a-4179-b27d-a4228250d4a3. No automatic paid retry was used. This live
success was below the old deadline, so it does not independently measure a >30s
hosting execution; the longer boundary is covered by upload configuration and
the mocked-time provider test. The owner's saved browser scenario was not changed
or reset. The failed request's uncertain reservation was not released.

Review checked caller validation before local submission, unchanged explicit
approval, non-submitting summary controls, timeout response diagnostics without
private text, provider deadline below the configured host deadline, and unchanged
financial reservation/settlement boundaries. FEATURES.md and the current release
runbook now document the 45s/60s pair so a later deploy does not restore 30s.

Evidence: artifacts/summary-api-deploy.json, artifacts/summary-deploy-status.json,
artifacts/summary-live-smoke.json. Prior task reports remain historical.
