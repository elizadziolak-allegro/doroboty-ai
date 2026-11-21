# Task: Adaptive screening conversation

## Goal

Replace the flat three-answer form with a sequential conversation. Ask one targeted follow-up when an answer leaves an important gap: no more than two overall and one per main question. Show recruiters an evidence card for own contribution, decisions and results, with exact quotes and explicit unknowns.

## Context

The user approved this iteration of the existing optional screening prototype. No recruiting effectiveness has been established.

## Plan

- [x] Extend optional screening state/API while preserving saved applications and media archives.
- [x] Add bounded follow-up decisions through OpenAI Structured Outputs.
- [x] Build one-question candidate flow with text/voice, optional clarification and review/edit.
- [x] Add source-linked evidence cards, regression tests and actual provider verification.
- [x] Run verification and review the diff/screenshots.

## Acceptance Criteria

- Three main questions, zero to two clarifications; explicit uncertainty is accepted without pressure to invent numbers.
- Same recording/transcript/approval and standard application paths; no automated scoring or stage changes.
- Persist progress; editing a main answer restarts its dependent conversation and invalidates the summary.
- Old screening snapshots remain readable; ZIP export includes follow-up recordings.
- `npm run check` passes with the installed Edge channel.

## Files / Areas

Screening schema, conversation state, candidate/recruiter UI and local server; existing record sheet and media storage.

## Risks

Follow-ups and interpretations can still miss useful information. Bounds and source validation do not prove recruiting effectiveness. Test actual vague/concrete examples separately from deterministic UI mocks.

## Handoff Notes

Continue on feat/ai-screening; preserve existing staged work and the ignored .env. Limits are three main questions and at most two clarifications, one question per screen.

## Verification — 2026-11-13

Full gate passed using PLAYWRIGHT_CHANNEL=msedge: formatting, original 67-file kit integrity and 6 renderer tests, lint, types, 45 unit/API tests, baseline packet, build and 39 browser tests. The last one-probe-per-main guard also passed a repeated 45-test unit run. Existing bundle-size/third-party comment warnings remain.

Inspected desktop follow-up and mobile review/evidence screenshots in artifacts/adaptive-screening-question.png and adaptive-screening-mobile.png. A separate review checked progress invalidation, skip semantics, server budget/active-question checks, legacy reads and exact citation lookup. No score or recruitment stage changes.

Actual OpenAI examples on synthetic CV/job data: vague answer produced a targeted probe; concrete personal actions and explicit uncertainty produced no probe. Evidence cited f1 for personal contribution, q2 for the decision and used unknown for result when only a measurement method was known. Initial probes over-expanded a concrete answer; tightened instructions and few-shot examples, then repeated the scenarios. Results are examples, not a broad reliability estimate. Physical microphone and real recruiting effectiveness were not tested. .env remained ignored and no key was logged.
