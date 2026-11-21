# Public training release runbook

Owner/support: Eliza Dziolak, eliza.dziolak@gmail.com.
Public URL: https://doroboty-ai-eliza-demo.netlify.app
Project ID: 59130e30-a095-4b97-96d0-eb555d4996f6. Netlify Free only, no paid add-ons.
Visitors use independent browser-local synthetic scenarios and simulated personas.

## Deployment and settings

Node 24, npm ci, npm run check, then production deploy using netlify.toml.
Publish dist and bundled netlify/functions; never upload the workspace or .env.
For manual API uploads explicitly set timeout=60 on the screening function. The
SDK/older CLI may default to 30s, which is insufficient for the 45s provider deadline.
The local folder is already linked via ignored .netlify/state.json. No GitHub
continuous-deployment connection was configured. Secrets stay on the server.

Production environment variables (Netlify > Project configuration > Environment variables):

| Name                  | Purpose                                                    |
| --------------------- | ---------------------------------------------------------- |
| OPENAI_API_KEY        | Secret provider key; no VITE_ prefix                       |
| OPENAI_TEXT_MODEL     | gpt-5-mini-2025-08-07                                      |
| AI_SITE_ID            | Exact project ID above                                     |
| AI_ENABLED            | true only when the cost ledger is initialized and verified |
| AWS_LAMBDA_JS_RUNTIME | nodejs24.x                                                 |

Runtime deploy context must be production. Preview/branch contexts cannot spend.
Environment changes require a production deployment. Free may not offer separate
variable scopes; the build never injects private variables into browser code.

## Current cost accounting (v2)

The owner authorized replacing the historical 25-attempt cutoff on 2026-11-15.
Keep store doroboty-training-budget-v1 and key cost-ledger-v2 across ALL deploys.
Never initialize another site/store to renew the budget. The historical manifest
and attempt tickets remain intact, with the v1 manifest disabled permanently.
Local historical AI stays frozen; no second allowance is created locally.

The shared USD 5 ceiling includes an owner-reported historical USD 0.12 plus a
USD 0.005 rounding buffer. Legacy calls after the last verified 21 remain reserved
conservatively when their relationship to that report is uncertain. Historical
spend is an estimate, not an API-verified provider invoice.

Before each request, an atomic compare-and-swap reserves USD 0.116384: conservative
400,000 input tokens at USD 0.25/million plus 8192 output at USD 2/million.
Settlement charges actual returned input tokens, discounts cached input at
USD 0.025/million, and includes reasoning in the output count. The unused part is
released. Amounts round upward to integer microdollars. Settlement is idempotent.
Timeouts, missing usage and ambiguous storage writes retain reservations. They
never expire automatically. Investigate against provider records before any
manual reconciliation; do not clear the ledger to recover availability.

Health returns accounting=tokens, spentUsd (includes historical estimate),
reservedUsd (unsettled only), remainingUsd and maximumUsd. There is no fixed
remaining-call count. New requests are denied when the available amount cannot
cover one worst-case reservation. This cap covers only this application's key
usage, not other tools/projects using the same provider account.

## Stop and recovery

Use the private operator script server/budget-admin.ts with AI_SITE_ID and
NETLIFY_AUTH_TOKEN supplied privately (not command arguments, chat or source).
Actions: status, stop, enable. They detect v2 and conditionally change its flag;
stop retains all pending reservations and already running calls can settle.
init must never overwrite an existing ledger. There is no public admin endpoint.

1. On incident, stop the shared cost ledger first; inspect request IDs and safe
   function logs. Do not collect CVs, answers, keys or scenario ZIPs by email.
2. If storage/operator access is unavailable, set AI_ENABLED=false and redeploy;
   revoke the dedicated provider key if necessary. Verify health and POST fail safely.
3. Keep v1 disabled when rolling back code. Historical builds use old accounting
   and must not be re-enabled. Prefer the current code with AI disabled.
4. Diagnose before re-enabling. Existing reservations and charged cost survive
   stop/enable and all redeployments. A new allowance requires owner approval.
5. Browser scenario recovery is separate: export before changing origins/importing.
   A new domain does not automatically migrate localStorage.

## Runtime and checks

Provider timeout 45s, no automatic retries, low reasoning and verbosity, 8192
output tokens maximum, no tools/audio. Reservation and settlement each get a fresh
4s storage deadline, leaving room within the explicitly deployed 60s hosting limit. Usage
settles before generated JSON is validated, so malformed content is still charged.
Request bodies max 256 KiB. Declared rate rule: 12/minute per IP/domain; enforcement
can be delayed. Financial safety comes from the atomic ledger, not rate limiting.

Before sharing a new release, run npm run check, inspect the deployment ID/HTTPS,
verify token health, bundled/static secret exclusions and stop/enable. Check CAS
concurrency against isolated synthetic cloud keys, never production balances.
A real-provider probe consumes budget; use synthetic data and record settlement.

Historical deployment: docs/tasks/netlify-deployment.md.
Current migration, checks and limitations: docs/tasks/token-budget.md.
Preparation reports and the previous production-readiness score are historical.

Technical pricing source checked 2026-11-15:
https://developers.openai.com/api/docs/models/gpt-5-mini
