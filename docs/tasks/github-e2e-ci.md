# Publish the current tests and run them on GitHub — 2026-11-21

## Intent and acceptance

Put the current app, server and full test suite in GitHub together so that the
tests run against the matching code. Run the existing `npm run check` gate for
every pushed branch and every pull request, with an optional manual run. Preserve
the participant package check. Confirm a clean checkout can install and execute
the gate in GitHub Actions before considering the task complete.

## Scope and review

- The current GitHub `main` contains only the earlier `prototype.spec.ts` E2E
  file. The local worktree has newer AI, public API and recovery journeys plus
  the implementation those tests exercise. Publishing only the test files would
  make CI fail against the older source.
- The workflow previously ran on pull requests and pushes to `main`. It now
  runs on every branch push, every pull request and manual dispatch. It uses
  Node 24, a clean `npm ci`, provisioned Playwright Chromium, the complete
  `npm run check` gate and the baseline participant package verification.
- Do not put `.env`, Netlify credentials, generated bundles, test reports or
  private runtime files into the repository. Review the proposed file list and
  credential scan before pushing.

## Verification

- The full local gate passed on this change: formatting, design-system
  integrity, lint, TypeScript, 86 unit/API tests, the baseline packet, frontend
  and function build, and 47 Edge browser tests. The first sandboxed attempt
  hit a child-process permission error; the authorized rerun passed.
- `package:participant` produced and verified a baseline-only package in an
  empty temporary directory.
- GitHub Actions ran from a clean checkout on the proposed branch. The first
  run stopped during `npm ci` because 31 lockfile URLs pointed to the company
  Artifactory. After changing those URLs to the public npm registry without
  changing package versions or integrity hashes, both checks for the latest
  pull request commit passed. The complete gate and participant package check
  succeeded in GitHub Actions.
- The pull request remains a draft because it also includes newer application
  and server code. Review that wider scope before merging it into `main`.
