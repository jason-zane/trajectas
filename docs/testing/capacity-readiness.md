# Commercial launch capacity evidence

Recorded 6 September 2026 against the commercial-launch-readiness worktree based on `1b11b01`. This is local evidence for critical persistence, rate limiting, worker coordination, and a separate 100-participant run through actual Next HTTP ingress. Hosted capacity still needs a representative staging run.

## Repeat the local checks

Start the existing local Supabase stack and apply the current migrations to that local project. Then run from the repository:

```sh
node scripts/testing/run-capacity-local.mjs
```

The launcher reads only the fixed `supabase_kong_trajectas-local` container's gateway credentials into memory. It starts Vitest with an environment allowlist, uses only `http://127.0.0.1:54321`, and does not read `.env` files or inherit production credentials. Both database suites also require a local host and explicit opt-in. Fixtures have unique IDs and are removed after the tests; the database is never reset. Do not change the host guard to point this harness at a deployed environment.

For isolated non-database regressions:

```sh
npx vitest run tests/unit/assess-session-proof.test.ts tests/unit/session-form-transport-retry.test.ts tests/unit/pdf-browser-deadline.test.ts tests/unit/pdf-job-drain.test.ts tests/unit/report-generation-sweep.test.ts tests/unit/runner-claim.test.ts tests/unit/integration-confidentiality.test.ts
```

## Measured results

The final local run passed nine database tests. The assessment fixture has 100 distinct participant sessions in one active campaign and 20 Likert items per frozen form.

| Scenario | Result |
|---|---|
| 100 concurrent cold form assemblies through the real delivery DAL | 100 succeeded in 761 ms; verified exactly 100 persisted forms, each with 20 entries |
| 100 concurrent writers per answer round, same source IP | All 2,000 answers persisted; 2,100 requests including idempotent replays |
| Answer burst duration | 1,937 ms, approximately 1,032 answers/second |
| Request latency including final replay round | p50 63.18 ms; p95 103.66 ms; p99 114.41 ms |
| Data correctness | All 2,000 values verified; no duplicate or missing response rows |
| Report/PDF worker races | Seven tests passed: single winner, global caps, expired leases, stale-worker fencing, three delayed attempts, regeneration during a live PDF, and anonymous RPC denial |

The save test calls the actual rate limiter and actual Next route handler, which calls the real local HTTP Supabase service. Its signed session credentials are issued for synthetic fixture sessions. This excludes Next's HTTP ingress, browser rendering and IndexedDB behaviour, hosted Redis latency, full session-state/page delivery, scoring, AI services, PDF rendering throughput, and notifications. These numbers are not a claim of deployed requests per second or support for 1,000 participants.

The cold-start test is independent of the answer test and remains a hard assertion. Before transport recovery, one run initialized only 79 of 100 forms. Node reported `UND_ERR_SOCKET`; local Kong logged `512 worker_connections are not enough` with one gateway worker. No file-descriptor exhaustion or database timeout signature appeared. The final run still encountered a closed socket but recovered all 100 forms. Form assembly now retries only transient network failures, at most twice with short jitter, and waits for all outstanding reads before retrying. It re-reads the authoring revision each time. SQL, RLS and validation failures are not retried. The conflict-ignoring freeze remains idempotent. Unit tests cover successful recovery, retry exhaustion and immediate hard denial.

## Actual Next HTTP verification

A separate synthetic fixture exercised the local Next development server at `127.0.0.1:3117` and local Supabase, with one participant warming compilation before the measured cohort. All 100 entry pages loaded, and all 100 simultaneous session-start requests rendered their 20-item assessments. The harness extracted the server-issued, token-bound session proofs from the actual page responses and used them through the real proxy and save-batch HTTP route. Every one of 2,000 answers was read back and verified after 2,100 requests including replays; there were no missing or duplicate rows, and fixture cleanup passed.

| Actual HTTP stage | Final result |
|---|---|
| 100 entry pages | 100 succeeded; p95 3.22 seconds |
| 100 session-start pages | 100 succeeded; p95 14.26 seconds |
| 100 concurrent answer writers | 2,000 verified answers in 7.12 seconds, approximately 281 answers/second |
| Save request latency | p50 302.24 ms; p95 414.59 ms; p99 484.51 ms |

The first HTTP run exposed a remaining failure: only 79 start pages rendered, while the others encountered the local gateway's 512-connection ceiling before reaching form assembly. The shared server-only Supabase client now retries GET/HEAD socket failures at most twice with short jitter. It does not retry HTTP errors, aborts, writes or RPC POSTs. Exhausted reads have a distinct error so form recovery cannot multiply that retry budget. Failed participant lookups now reach the existing retryable page-error boundary instead of incorrectly calling a valid link expired. Focused tests cover these boundaries; the repeated 100-participant HTTP run passed.

These page timings are from the development server and include full HTML/RSC response delivery, not browser JavaScript execution or hydration. The 14-second start latency warrants staging measurement; it is not a production performance claim. Hosted Redis, scoring, report generation, Chromium throughput and sustained production load remain outside this HTTP check. The guarded companion harness and before/after JSON evidence are retained in the audit workspace.

## Capacity controls

Validated participant sessions have separate save/progress budgets backed by signed credentials bound to both token and session. API handlers verify that binding again before database access. One forged credential cannot obtain the shared-office allowance. Tests show 100 valid same-IP sessions can make 1,200 saves in a minute; an invalid-proof flood still reaches the unchanged 600/minute IP cap. Open registration retains its existing 10/minute IP budget, so pre-issued invitations are the appropriate path for a large shared-office cohort.

The database serializes report claims and caps active generation at six, across every instance. PDFs are durably queued, globally capped at two and limited to one browser per process. The minute PDF cron drains jobs independently of the report-generation runtime. Browser work has a 90-second deadline, including cold executable resolution, and a five-second graceful-close limit before killing its own child process. Report generation stops taking new chunks at its cumulative pickup deadline. Optional report AI has a separate cumulative budget and deterministic fallback.

PDF failures retain a database attempt count and next due time. After three attempts they become terminal failures. A claim token fences publication and failure updates; separate object paths prevent a stale worker overwriting a newer PDF. Recovery requeues leases older than 15 minutes. Report regeneration cannot invalidate a still-active PDF lease. External storage/email failures can still consume a function's remaining runtime; durable lease recovery is the safety net if the host terminates it.

## Hosted staging acceptance

Use a separate, confirmed non-production database and deployment, synthetic participants, and email/AI test destinations. Record compute tier, region, deployed commit, Redis configuration, assessment size and all queue limits with the results. Production project previews are not automatically isolated.

Run the following scenarios with production-like ingress and browser/API clients:

1. Start 100 pre-invited participants within 10 seconds, including a shared-IP cohort. Exercise the complete session-state and page-delivery path. Require all forms to load and match the frozen entries.
2. Sustain 100 participants for 20–30 minutes, answering about once every five seconds. This is about 20 average save requests/second, with synchronized bursts of 100. Require no lost acknowledged answers, no unauthorized access, no duplicates, and no legitimate 429s. Suggested save target: p95 under 500 ms and p99 under two seconds.
3. Include tab refresh, brief offline periods, duplicate sends, older delayed revisions, resume on another device, timed-section expiry and a completion burst. Compare final stored responses and score/report outputs with the expected fixtures.
4. Complete all 100 sessions in a short window. Confirm report/PDF caps hold, HTML reports become available independently of PDFs, and the queues drain without growing indefinitely. Measure an acceptable report turnaround explicitly; it cannot be inferred from the answer-save benchmark.
5. Interrupt a worker after claim, inject a transient PDF/AI/storage failure, and retry a trigger concurrently. Verify lease recovery, bounded retries, no duplicate report delivery and no stale PDF publication.
6. Inspect database CPU, query latency, pool waits, errors, function memory/duration, Redis latency and queue age. Fail the run for connection exhaustion, sustained backlog, silent scoring/report failures, or any data-integrity/security regression.

A database connection limit is not a participant limit: short HTTP database requests share connections, while each participant spends most of the assessment reading and thinking. A paid-plan upgrade and backups improve operating headroom and recovery, but do not replace this staging evidence. Treat 1,000 participants as a separate capacity exercise after the 100-person run passes; increase load gradually and measure before changing worker limits.
