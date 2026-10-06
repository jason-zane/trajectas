# Local workspace roadmap validation

Tested on current `origin/main` `edf762189b6053e5898de814fea1979b8f00d626`, plus separate EPP commits `5e11056d` and `ba0374bb`, plus this roadmap. All inputs and mutations in tests are synthetic. No real invitation or customer operation ran.

| Command / check | Final result |
| --- | --- |
| `npm run test:unit -- --reporter=dot` | PASSED: 237 files, 3,193 tests, exit 0 |
| `npm run test:component -- --reporter=dot` | PASSED: 37 files, 206 tests, exit 0 |
| `npm run test:architecture -- --reporter=dot` | PASSED: 20 files, 97 tests, exit 0 |
| `npm run typecheck` | PASSED, exit 0 |
| `npm run lint` (repository max-warnings=0) | PASSED, exit 0 |
| `git diff --check` | PASSED |
| Normal `npm run build` | NOT COMPLETED: Turbopack compilation stalled and was stopped, exit 130 |
| Bounded `next build --webpack` with local/synthetic environment values | FAILED: untouched instrumentation imports raise `UnhandledSchemeError` for `node:crypto` and `node:util/types`, exit 1 |
| Local migration / real DB integration suite | UNRUN: local Supabase CLI telemetry and Docker socket actions were denied and stopped |
| Browser / Playwright E2E / live rendering | UNRUN; Chrome was reserved for the EPP investigation and no browser takeover occurred |
| Production migration, activation, customer records, invitations, merge/deploy | NOT ATTEMPTED; not authorised |

Command logs from this run remain at `/tmp/roadmap-combined-unit.log`, `/tmp/roadmap-combined-component.log`, `/tmp/roadmap-architecture.log`, `/tmp/roadmap-typecheck.log`, `/tmp/roadmap-combined-lint.log`, `/tmp/roadmap-build.log` and `/tmp/roadmap-webpack-build.log`. These are ephemeral local evidence, not release artifacts. Component/fixture corrections during implementation were followed by the final passing suites; no failing assertion was removed or weakened.

The source-contract test keeps TypeScript and SQL defaults/catalogue/dependencies aligned. It does not replace database replay, RLS, RPC grants, audit-trigger execution or atomic rollback verification. The real local integration file contains new concurrent first-insert, optimistic conflict, client Unified, dependency rejection, provisioning rollback and audited preset/override cases awaiting authorised execution.

A successful release build, local migration/integration run and browser acceptance remain release blockers. The separately reported sharp dependency audit in PR425/426 is unchanged; this branch does not claim to clear it. See the acceptance report for the unimplemented webhook pause/replay policy and absent specialist products.
