# DoRoboty.ai — AIPH3 prototype

A local job marketplace for participants to extend and test. Built with React, TypeScript and Vite, using Base UI components. The required visual direction for new and changed screens is the accepted Poster People design system.

## Design system — start here for UI work

Read [project integration instructions](docs/design-system/README.md), [host implementation rules](docs/design-system/IMPLEMENTATION.md) and [application acceptance checklist](docs/design-system/VERIFICATION.md), then [design.md](docs/design-system/agent-kit/design.md), [component API](docs/design-system/agent-kit/components/API.md) and the relevant [human documentation](docs/design-system/agent-kit/reference/index.html). The complete 67-file kit is stored under docs/design-system/agent-kit, including reusable CSS/JS, component states, listing/offer examples, screenshots, Geist Serif with license and illustration. No other chat or global skill is required.

```sh
npm run design-system:check
npm run design-system:dev
```

With Node 24, the first command verifies the preserved kit and examples; the second serves a separate local preview at http://127.0.0.1:8952/. No kit installation is needed. The main app uses port 3001 as below.

Build UI from this system, adapting its anatomy and visual roles into the existing React/Base UI components and host tokens. Preserve application behavior and hash routing; do not replace product state with the standalone demo fixtures/controllers. The application has a host adaptation. For every UI task, compare the affected anatomy, type roles, state and keyboard behavior with the reference; passing kit checks alone does not establish visual acceptance. See the integration guide for exact reading order, assets, React mapping, responsive rules and verification. AGENTS.md and CLAUDE.md enforce the same direction.

## Run

Requirements: **Node.js 24 and npm**.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:3001. The optional AI screening uses a local Node API on 127.0.0.1:3002, started together with Vite. Copy `.env.example` to `.env` and set `OPENAI_API_KEY` locally; never paste it into chat or commit it. The approved demo pins `gpt-5-mini-2025-08-07`; other model overrides are rejected and transcription is disabled. Without a key, standard applications work and screening shows a configuration message. Package installation requires access to the npm registry.

Select Anna or Marek as a candidate, Karolina or Tomasz as an employer, or the instructor. Publish a job, apply, switch person and record the employer decision. Changes survive reload in this browser; recordings are stored in IndexedDB. Settings export a portable ZIP (scenario + audio, max 64 MB), import ZIP or legacy JSON (max 2 MB), and reset both stores. The optional “Przyspiesz rekrutację” section makes real OpenAI calls after opt-in. Existing Match Score and legacy summaries still simulate prepared scenarios. Use example CVs only.

## Optional AI screening

The current approved local demo is **text-only**, with Eliza as incident owner and
a USD 5 ceiling shared by rehearsal and demonstration. The real provider adapter
uses the pinned GPT-5 mini snapshot, reserves USD 0.20 per attempt in a persistent
local ledger and stops after 25 attempts (including failures). Voice recording is
disabled for this demo; existing recordings can still be viewed and exported.
See [the demo runbook](docs/demo-runbook.md) for the rehearsal, counters, backup and
fallback procedure. The engineering tests continue to exercise legacy voice records
with simulated services; they never spend the demo budget.

Candidates answer three job/CV-based main questions, one at a time, by text in this demo. Legacy voice records remain readable (3 minutes / 10 MB each). After a vague answer, AI may ask one targeted clarification: at most one per main question and two in the whole conversation. Concrete answers and explicit uncertainty can advance without another question; numeric metrics are not mandatory. Clarifications can be skipped. Candidates review an evidence card with exact source quotes and unknowns, and approve the package before submitting. Skipping never blocks a standard application. The employer and candidate see immutable submitted materials in the “Pytania AI” tab. No automatic hiring decision, stage advance or score is added. Progress survives reload. Editing a main answer restarts its dependent conversation and invalidates approval; subsequent main answers are retained for review. Old saved applications remain readable.

The backend binds only to loopback, limits request sizes/concurrency and total demo attempts, checks browser origins and never logs CVs, audio, answers or credentials. Diagnostic records contain only an allowlisted category/status, operation and request ID. In the current text-only demo, CV/job text and answers go to OpenAI; transcription is disabled. Responses use `store: false`; this is not a claim of zero provider retention. Use synthetic data. The local role picker is not authentication.

`npm run dev` starts both processes. Stop with Ctrl+C. The supplied Windows launcher sets Node/npm paths for this computer. The backend must restart after changing `.env`.

## Build and verify

```sh
npm run build
npm run preview
./scripts/verify
```

The static output is dist/. AI needs the local backend: run `npm run start:api` alongside preview; Vite preview proxies `/api`. Static hosting alone supports standard prototype flows, not AI. Browser checks require an already provisioned Playwright Chromium; starting the app never installs it. See [participant guide](docs/PARTICIPANT_GUIDE.md), [architecture](docs/architecture.md), [current features](FEATURES.md) and [case protocol](docs/case/CASE_PROTOCOL.md).

To distribute a baseline participant package, run npm run package:participant -- /absolute/output/directory. This excludes Git history and instructor source material. Never distribute this repository’s history as a stage-safe packet.

On Windows, if the Playwright Chromium binary is absent but Edge is installed, run the gate in PowerShell with `$env:PLAYWRIGHT_CHANNEL="msedge"; npm run check`. The default remains provisioned Playwright Chromium. Do not install OS dependencies as part of app startup.

# Public training deployment

The public training app is at https://doroboty-ai-eliza-demo.netlify.app on Netlify Free.
The release record is [Netlify deployment](docs/tasks/netlify-deployment.md).
The current public AI limit uses token cost accounting within USD 5, replacing
the historical 25-call cap; see [token budget migration](docs/tasks/token-budget.md).
Configuration is in `netlify.toml` and `netlify/functions`. Follow [the public runbook](docs/public-release-runbook.md)
for the Free-only hosting plan, private settings, budget transfer, emergency stop,
recovery and deployment checks. AI is disabled until explicitly configured; copying
only `dist` does not deploy the AI backend. Each visitor keeps a browser-local scenario.
