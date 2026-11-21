# Local demo readiness repairs

Slug: `demo-readiness-repairs`
Created: 2026-11-13

## Goal

Prepare the existing local prototype for Eliza's closed demonstration with synthetic
text, real OpenAI and a maximum USD 5 budget shared by rehearsal and demonstration.
Eliza is the incident owner. Dependency vulnerability review is explicitly deferred.

## Context

The user approved checklist repairs 2–7, the real AI rehearsal and the smoke/recovery
exercise. Preserve unrelated staged and unstaged work. Do not deploy or commit.
The first audit remains in the offline HTML history.

## Plan

- Preserve a source/build fallback before editing.
- Exclude generated readiness HTML from formatting.
- Add allowlisted, secret-free API diagnostics and a persistent conservative budget.
- Verify URLs and file boundaries; prevent concurrent browser writers.
- Exercise archive restoration, legacy saves and the fallback build.
- Run full checks, bounded real AI rehearsal, then refresh the readiness report.

## Acceptance Criteria

- The complete local gate passes.
- Diagnostics omit private input, credentials and raw upstream error messages.
- API attempts cannot exceed the approved local budget after a restart.
- Bad imports leave the current save intact; a second tab cannot silently overwrite it.
- An isolated restore and fallback rehearsal has inspectable results.
- Deferred or inaccessible checks remain unverified rather than passing.

## Files / Areas

Server, browser storage/imports, existing Notice/Button host recipes, tests,
participant instructions and the generated readiness report.

## Risks

Budget protection applies to this application's ledger, not other uses of the API key.
Fallback must not copy credentials, reset the budget or overwrite current browser data.
Native audio is outside this text-only demonstration.

## Handoff Notes

Implemented the approved repairs, including text-only real AI, a persistent USD 5
allowance, safe API error categories, ZIP/URL validation and single-writer Web Locks.
Page lifecycle handlers release the lock on closing/navigation; restored bfcache
pages reload before mounting a store again. UI changes reuse the host panel and
Button recipes; no kit files, tokens or unrelated layouts change.

Evidence is stored in the generated readiness report and ignored `artifacts/demo/`:
real-provider question/assessment/summary checks, synthetic scenario ZIP, isolated
restore, fallback submission/reload and screenshots. The pre-repair source/build
archive is preserved in the sibling `demo-recovery` directory with a hash manifest;
the fallback serves only restored static files on loopback port 3107 with AI disabled.
The full gate and current audit must be green except the deliberately unverified
dependency review before describing preparation as complete. The readiness report
records the actual final outcomes rather than assuming this condition was met.

Do not delete or restore `.local/demo-budget.json`: rehearsal attempts consume the
same allowance as the meeting. No deployment, commit or user-data reset was performed.
