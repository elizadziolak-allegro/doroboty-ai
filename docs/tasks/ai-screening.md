# Optional AI screening

Intent: implement the approved local prototype on feat/ai-screening. Candidates optionally answer three job/CV-based questions using text or recordings, approve transcripts and an evidence-linked AI summary, and attach an immutable snapshot for the employer.

Acceptance: standard application remains usable without AI or a key; API secret remains server-only; questions and interpretation use real OpenAI calls; media survives reload/persona switching and portable scenario export; old JSON remains importable; no automatic stage changes, scoring or hiring recommendations. Poster People host components remain the visual source. Existing behavior register will be updated; verification evidence follows below.

## Verification — 2026-11-12

- Branch: feat/ai-screening; no remote push.
- Full gate passed: PLAYWRIGHT_CHANNEL=msedge npm run check. Formatting, preserved 67-file design kit (6 renderer tests), ESLint, TypeScript, 38 unit/API tests, baseline packet verification (120 journeys), production build and 38 browser tests all passed. Edge was already installed; the default Playwright Chromium binary was absent.
- Browser tests use controlled API responses and a simulated recorder, including mixed text/voice, transcript corrections, summary invalidation, reload, employer/company visibility, missing key, denied microphone, retryable provider errors, tooltip focus/Escape/click and mobile layout. Unit tests cover timeout, media roundtrip/remapping, incomplete exports, oversized media and state compatibility. This does not prove hardware microphone quality or real provider output quality.
- Actual local API started successfully without a key and reported configured:false. In-app browser inspection confirmed the entry section, disclosure, disabled start-until-consent and missing-key message. Screenshots: artifacts/screening-entry.png and artifacts/screening-mobile.png.
- Review: shared ApplicationRecord owns the new tab, domain submission/import rejects unapproved or unsupported summaries, exact quotes are validated, media writes complete before successful voice attachment, and API responses never expose credentials/upstream exceptions. Existing Match Score and recruitment stages remain unchanged.
- Windows checkout had converted original Git LF content to CRLF, breaking formatting, design-kit hashes and CSV verification. Restored original LF bytes and added .gitattributes to preserve them. The reference kit passes its original manifest; no kit design/content changed.
- Production build retains its existing bundle-size/third-party comment warnings. The live dev server now ignores generated test reports to avoid Windows watcher EBUSY.
- Not executed: real OpenAI calls. The user explicitly chose to continue without a key. To enable: fill OPENAI_API_KEY in the ignored local .env and restart the launcher; then exercise a synthetic CV and genuine short microphone answer before judging question/transcript/summary quality. No secret is required in chat.

## Live provider verification — 2026-11-13

Reloaded the current ignored .env by restarting the application. Authentication/model metadata succeeded; real local questions and summary endpoints produced three questions and three evidence-linked interpretations on synthetic data. A locally synthesized WAV returned a nonempty transcript from gpt-transcribe. This tests real transcription/provider access, not a physical microphone or browser WebM capture. Prior mocked browser tests remain the evidence for those UI paths. No application code changed; the full suite was not rerun. No secret values were printed or recorded.
