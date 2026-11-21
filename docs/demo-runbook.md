# Local demo runbook

Owner: Eliza Dziolak. Approved scope: a closed presentation on her computer,
synthetic text and real OpenAI, maximum USD 5 for rehearsal and demonstration combined.
No real CVs, participant recordings or external accounts are required.
At the start, tell participants to report problems directly to Eliza during the
meeting. Record only the affected step and the safe request ID/category, with no
personal CV, answer or credential. No participant account or remote support portal
is part of this closed presentation.

## Before the meeting

1. Use the existing Windows launcher in the parent folder (`Start-DoRoboty.cmd`).
   It starts the web page and local API. Keep the server terminal available for diagnostics.
2. Open http://127.0.0.1:3001 in one browser tab. A second tab is blocked before it can edit.
3. In Settings, export your existing scenario before importing a demo copy.
   The prepared synthetic copy is `artifacts/demo/demo-scenario.zip`.
   Export includes recruiter notes and any existing audio; keep it local.
4. Confirm that the API health page http://127.0.0.1:3002/api/health reports
   `configured: true`, `textOnly: true` and enough `attemptsRemaining`.
   This checks configuration, not a successful provider response.
5. Choose Anna, open the AI Product Manager offer and enter a synthetic application.
   Opt into AI, answer by text, review the evidence card and approve it.
   Switch to the matching employer and check the submitted application.
6. Reload and confirm the saved result. Export a copy if you want to keep the rehearsal.

Successful rehearsal: the application and approved evidence card are visible after reload,
the employer sees the same submitted material, and an export can be restored.
If this fails, do not start the live AI demonstration; use the standard flow below.

## Budget and paid rehearsal

The local API is pinned to `gpt-5-mini-2025-08-07`, standard tier, no tools,
no automatic retries and at most 8192 output tokens. Voice transcription is disabled
for this approved text-only demonstration.

The persistent `.local/demo-budget.json` reserves USD 0.20 **before each attempt**,
including timeouts and failures. At most 25 attempts are allowed, including the
agent's rehearsal. Restarting does not renew them. The health endpoint shows the
remaining attempts. Reservations are conservative; they are not billed amounts.
Do not delete, replace, restore from backup or share this ledger to renew the allowance.
This limit does not control other programs using the same OpenAI key.

Engineering rehearsal command (run by the agent after approval):
`node --env-file-if-exists=.env scripts/demo-smoke.mjs --approved-budget-5-usd`.
It is never part of the ordinary tests. It makes at most five real text requests,
validates the returned source quotes and writes counters/statuses without private text.

Pricing evidence retrieved 2026-11-13:
[official GPT-5 mini model page](https://developers.openai.com/api/docs/models/gpt-5-mini).
It records USD 0.25 per million input tokens, USD 2 per million output tokens and a
400,000-token context. Even using the full input window plus the configured output
cap gives USD 0.116384 before any cache discount, below the USD 0.20 reservation.
Reassess these assumptions before a later demo or a model/tier change.
The page labels this snapshot deprecated; the real rehearsal must confirm current access.

## If something stops working

Eliza observes the error and follows this order:

1. **AI error:** keep the entered answers. Look for `screening_error` in the API terminal.
   Its request ID and category contain no CV, answer, audio or key.
   `authentication`: local key/access issue; `quota`: provider funds;
   `rate_limit`: provider limit; `timeout/connection`: network;
   `budget/configuration`: local allowance/ledger; `validation/upstream`: response issue.
   Never paste the key or the full environment file into a chat.
2. **At most one manual retry**, only if the remaining allowance permits it and
   the cause is temporary. Then skip the optional AI section and submit a standard
   application. Explain that this part of the demonstration is unavailable.
3. **No internet:** use the local standard scenario. AI needs a connection;
   prepared scenario Match Scores are simulations, not live AI results.
4. **Unreadable save:** do not reset the only copy. In Settings download the original
   save, then try the prepared ZIP in a separate browser profile.
5. **Application version broken:** run the preserved static fallback on port 3107
   using the supplied recovery launcher in the sibling `demo-recovery` folder.
   It uses a separate browser origin and has no AI proxy. Do not overwrite the
   current checkout, `.env` or budget ledger.
6. **Budget ledger error:** keep it unchanged and use the standard flow.
   A leftover lock or corrupted counter requires review; do not delete it to continue spending.

## After the meeting

Keep only the synthetic scenario you intend to reuse and store exports locally.
If you want to discard practice changes, first verify a copy in a separate profile,
then use Settings → Reset with confirmation. Browser reset does not delete exported
ZIP files or the server budget counter. This run does not delete any existing user data.
Record whether participants completed the flow and any errors; do not interpret
synthetic scores or this rehearsal as recruiting effectiveness.

The dependency review was performed during public-release preparation; see the
current readiness report. For the future public deployment use public-release-runbook.md.
The current provider timeout is 45 seconds. Local budget handoff permanently disables
local paid calls before the single cloud site can be enabled.
