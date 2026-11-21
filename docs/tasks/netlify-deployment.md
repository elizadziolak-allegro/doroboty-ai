# Netlify deployment

## Intent and acceptance

Publish the current training application to a public HTTPS URL on the owner's
Netlify Free team. Deploy only built assets and bundled functions. Preserve the
existing browser-local synthetic scenarios and the shared USD 5 AI allowance.

- Confirm the Free plan and publish a disabled-AI fallback first.
- Verify HTTPS, headers, functions, and independent browser scenarios.
- Transfer the actual local ledger once; never renew consumed tickets.
- Configure server-only credentials without displaying them or publishing .env.
- Verify cloud conditional writes before enabling AI; retain a stop procedure.
- Record the final deployment ID, URL, verification results, and limitations.

## Local release gate

2026-11-14: npm run check passed: 75 unit/API tests, 46 browser tests,
baseline packet checks, formatting, lint, types, static build and function bundle.
The source working tree includes existing uncommitted changes. Publication uses
the current built files; it does not push or commit the source repository.

FEATURES.md was reviewed; deployment initially preserves product behavior.

## Observed hosting correction

The first live AI journey generated questions and evaluated three answers, but
summary generation was terminated by the host after exactly 30,000 ms (function
log request bbd44c17). The installed Functions SDK also declares a 30-second
synchronous default. The existing 45-second provider timeout could not return
the application's controlled error before that boundary.

Changed the provider timeout to 20 seconds, leaving room for the 7-second storage
deadline; kept zero retries and the existing ticket limit. GPT-5 mini now uses low
reasoning effort and verbosity to shorten generation. Updated the existing timeout
regression test to assert the deadline and these request settings. The failed
request remains counted. Revalidation and a new deployment are required before
retesting the saved summary; previous preparation results remain historical.

## Published result — 2026-11-14

- Public URL: https://doroboty-ai-eliza-demo.netlify.app
- Netlify project: `59130e30-a095-4b97-96d0-eb555d4996f6`, team `eliza-dziolak`.
- Plan confirmed by account API: Free (`credit-free`), 300 included credits,
  no payment method and no overage capability. No paid additions were enabled.
- Final production deploy: `6af889a3645702f9d423ac8c`, state `ready`, Node 24.
- Source fingerprint: `532f7b981b22ea782f5279b8ed8fc44881caa93a3fc1867ba5434cad9c6ef981`.
  Its 160-file input definition is recorded in `artifacts/netlify-deployment.json`.
- The initial project was private by default. The owner-authorized public audience
  was applied, then anonymous requests verified without browser login cookies.

### Verification performed

- Full local gate passed again after the timeout correction: 75 unit/API and
  46 browser tests, plus formatting, lint, types, packet and build checks.
- Anonymous HTTPS returned 200, expected security headers and exact matching
  SHA-256 values for deployed JS/CSS/icon assets. Netlify injects its own badge
  into HTML. API health confirmed configured text-only AI.
- Private source/environment/Git paths returned 404. Exact-key scans found no
  provider secret in 35 static files or 786 bundled function files; the function
  archive contained no .env, .local, .git or instructor-source paths.
- Eight simultaneous conditional writes to an isolated cloud test key produced
  one winner; a later overwrite was rejected. Real budget tickets were untouched.
- On the deployed UI, standard submission survived reload. The AI journey generated
  questions, assessed three synthetic answers, recovered saved answers after the
  initial host timeout, then successfully produced a validated summary after the
  correction. Explicit approval and submission persisted the card, which was visible
  in the employer's candidate record. Screenshots are in `artifacts/netlify-live.jpg`
  and `artifacts/netlify-employer.jpg`.
- The operator stop rehearsal changed health from 200/configured to 503 and back
  to 200/configured without consuming a ticket. AI is enabled at completion.
- The budget survived deployments: 15 transferred local attempts plus cloud tickets
  16–21, including the timed-out summary. Four calls remain; USD 4.20 is reserved
  against the USD 5 ceiling, not an invoice. No ticket was refunded or reset.

### Operational limits and recovery

Four calls are not four complete conversations: a new three-answer journey normally
needs at least five calls. Ordinary submissions continue when AI is unavailable.
Increasing the allowance requires an explicit new owner decision.

This is a public teaching prototype with browser-local synthetic scenarios, not
real accounts or shared recruiting data. Local tests cover independent browser
contexts; a second independent browser was not exercised against the live origin.
The deployed manifest declares the 12/minute IP/domain rule; delayed enforcement
under traffic was not load-tested. A separate draft deployment, a full remote ZIP
restore and a production rollback were not exercised in this task. The historical
production-readiness score has not been rerun or relabeled.

The original disabled-AI deploy is `6af88069d9058f8900c4449b`. Prefer stopping the
shared manifest before any rollback; never restore the budget ledger/tickets.
Follow `docs/public-release-runbook.md` for the existing operator script and
server environment settings. The ignored release helper used the authorized CLI
session in memory; no token was copied into commands, reports or repository files.

Detailed evidence: `artifacts/netlify-deployment.json`,
`artifacts/netlify-remote-smoke.json`, `artifacts/netlify-disabled-smoke.json`,
`artifacts/netlify-cloud-concurrency.json`, `artifacts/netlify-bundle-audit.json`,
and `artifacts/netlify-stop-check.json`.
