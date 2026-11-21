# Participant guide

## Start

Use the prepared baseline package and Node.js 24 with npm.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:3001. If Node or registry access is blocked by your organization, ask your instructor/IT rather than bypassing the policy.

## Try a complete flow

1. Choose Anna Kowalska and browse offers.
2. Save an offer, edit the profile and submit an approved application. Source notes and the editable proposal are separate.
3. Choose Karolina Wiśniewska for BrightLabs and review its candidates.
4. Record review, invitation, conversation and the next decision.
5. Return to Anna and inspect the application history.

Karolina and Tomasz see their respective companies in the interface; this is role simulation. All data is local and synthetic. CVs are prepared text examples, not real uploads. AI proposals and scores simulate the scenario.

## Save, share and recover

Optional “Przyspiesz rekrutację” uses real OpenAI after opt-in, with a server-only key in `.env` (see README). The approved demo uses text answers and candidate approval; voice capture/transcription is disabled. Standard application works without a key. The persistent local allowance is 25 requests at a conservative USD 0.20 reservation per request, at most USD 5 including rehearsals; restarting does not reset it. See [the demo runbook](demo-runbook.md).

Changes survive reload in this browser. Settings can export a ZIP including existing audio, import ZIP/legacy JSON, or reset the scenario and recordings. Import/reset asks before replacing state. If a save is incompatible, download the original before resetting. Storage failure is shown explicitly; export before closing the tab. Only one tab in the same browser profile can open the scenario for editing. Close the first tab and choose “Spróbuj ponownie” in the second to continue there.

A URL shares the interface, not your local changes. To transfer a scenario, share the exported file and import it in the other browser. Exports include all personas, applications, notes and referenced recordings; never enter real personal data.

## Static build

Run npm run build. Serve dist/ through any static HTTP host. No provider account is needed for local development. Do not open index.html via file://; ES modules need HTTP. Hash links work without route rewrite configuration.

## Verification

Run ./scripts/verify or npm run check. Browser tests require provisioned Playwright Chromium; a missing test browser does not prevent npm run dev. Do not let an agent install system dependencies automatically.
