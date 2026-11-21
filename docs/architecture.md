# Architecture

One React/TypeScript application is built by Vite into static files. HashRouter renders routes under /#/; route parameters created in the browser require no hosting rewrites. The running app currently uses local CSS tokens, Timeless font and Base UI primitives. New and changed UI must follow the accepted Poster People [design system](design-system/README.md), adapted into the existing stack; installing its reference did not convert runtime styles. A loopback-only Node API handles optional OpenAI screening; it does not persist scenario data.

## Data flow

JSON marketplace/person fixtures → initialState → PrototypeProvider → feature views. Local operations go through transition with shared Zod schemas and explicit role/ownership/transition checks for coherent simulation. All roles still have access to the same browser data; these checks are not security.

Candidate source notes, generated draft and approved application are distinct fields. Submission snapshots CV, candidate name, job title, scenario score and summary. Employer stage events are appended, with private-in-the-UI notes. Profile/job edits do not rewrite submitted records.

Storage uses one versioned localStorage key. Import validates schema/version, unique IDs, cross-references and stage history before replacing state. Unreadable/incompatible saves are protected against automatic overwrite; settings can download the original raw save, import a valid file or explicitly reset. Failed/quota-limited persistence leaves the in-memory app usable and offers export. Scenario JSON remains capped at 2 MB; recordings live as Blobs in IndexedDB. ZIP exports contain scenario.json, audio.json and referenced audio files (64 MB total). ZIP import validates all members before staging media under fresh IDs; failures leave the active scenario intact. Legacy JSON import remains supported; no binary CV storage.

## Features

src/features/prototype owns model/storage/state and page compositions. src/features/jobs retains reusable presentation/filter/description logic; src/components/ui owns Base UI controls. Keep changes small.

LocalStorage is origin-specific. Reload preserves state; another browser/device/port starts separately. No cross-tab live synchronization is provided; close other tabs before editing/importing. Hash links reference records in the receiving browser, not transferred records.

## Evidence and distribution

The baseline historical CSV and JSON are separate from interactive state. Future evidence must arrive in a separately reviewed package. package:participant copies only explicit allowed files/directories, including the complete docs/design-system guide/kit, and omits docs/source, historical task notes, agent run history and .git. A packet verifier checks the baseline data; packaging also verifies a pristine file/hash manifest. Ordinary checks permit participants to edit code and generate build/test output without invalidating a distribution fingerprint. Instructor repository history is never participant-safe.

## Checks

npm run check and ./scripts/verify run formatting, design-system reference integrity/example checks, lint, types, unit tests, build and Playwright against the static preview. Playwright checks external requests, complete workflows, error/recovery behavior, keyboard controls and mobile layout. No test starts system services. npm run dev only starts Vite.

## Adaptive screening

Version-1 screening metadata now optionally contains a conversation cursor and resolved question IDs. The first three questions keep q1/q2/q3; at most two appended f1/f2 questions carry a parentId and a reason. Reading order places each clarification after its parent. Responses remain aligned with stored question IDs, not display positions. Skipped clarification has no text/audio; main answers cannot be marked skipped. Structural validation and complete/approved checks protect imported progress and submitted snapshots.

POST /api/screening/next accepts context, questions, answers, conversation and the active main questionId. The server validates progress and budget before asking OpenAI for either followUp:null or one question/reason. POST summary produces three evidence areas with exact sources/quotes or explicit unknowns, plus per-answer interpretations. Legacy summaries without evidence retain their read view. Editing a main response removes dependent follow-ups from that point and invalidates summary/approval; orphan binary media remains until reset as before.
