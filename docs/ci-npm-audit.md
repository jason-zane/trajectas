# The `npm audit` CI gate — background

Moved out of `AGENTS.md` on 2026-09-23 to keep that file inside Codex's 32 KiB
instruction budget. `AGENTS.md` keeps the rules; this page keeps the history
and the reasoning behind them.

## Pre-existing CI debt — `npm audit` (original text)

The `security → Audit production dependencies` step runs
`scripts/audit-production-deps.mjs`, which wraps
`npm audit --omit=dev --audit-level=high`. **The threshold has not moved** — the
wrapper exists because `npm audit` exits 1 both when it finds a high-severity
advisory and when it cannot reach the registry, and those two need different
responses.

**A genuine advisory.** Next.js publishes high-severity advisories frequently,
so a red step is usually upstream of the PR's diff. Treat it as repo
maintenance, not feature work:

```sh
npm audit fix       # may bump minor versions
npm run test:unit   # sanity check
npm run build       # sanity check
git add package-lock.json
git commit -m "chore(deps): npm audit fix — bump <pkg> to <version>"
```

If `npm audit fix` doesn't resolve the advisory (e.g. no patched version exists
yet), surface it to the user — don't paper over it or relax `--audit-level`.

**A registry failure.** On 2026-09-04 the step went red three times in one day
without a single advisory involved: a `400 Bad Request` from
`/-/npm/v1/security/audits/quick` carrying `Invalid package tree, run npm
install to rebuild your package-lock.json`, and two `503`s. Each was "fixed" by
re-running the job, which is how people learn to ignore a security gate. Two
things were actually going on, both verified against npm's sources and a fake
registry:

- **npm 10 falls back to a retired endpoint.** It asks
  `/-/npm/v1/security/advisories/bulk` first and, on *any* failure, silently
  retries against `/-/npm/v1/security/audits/quick`, which npm has retired and
  which answers 400. So the "Invalid package tree" message was a symptom of the
  bulk request failing, not a lockfile problem — the lockfile was fine. npm 11
  removed the fallback, so CI pins `npm@11.19.1` for the audit step.
- **npm does not retry the audit request.** The body is gzipped into a stream
  and `make-fetch-happen` will not replay a stream body, so the response comes
  back with `x-fetch-attempts: 1` even under `--fetch-retries=3`. The retry has
  to live outside npm.

The wrapper reads `npm audit --json` and routes on the payload shape, not the
exit code:

| What came back | What happens |
| --- | --- |
| Report with a high/critical count | **exit 1** — the gate doing its job |
| Report clean at `high` | exit 0 |
| 5xx/408/429, a network error, a request that hangs past 150s, or anything from the retired quick endpoint | retried 4× with backoff; if it never lands, a `::warning::` annotation and exit 0 |
| 4xx from the bulk endpoint, a local npm error, unparseable output | **exit 1** — fail closed, that is not a blip |

So a give-up is visible in the Actions summary as *"npm audit skipped — nothing
was verified"*, never as a green tick that implies a clean bill of health.
`tests/unit/audit-production-deps.test.ts` pins the classification.

The timeout is not decoration: on this wrapper's own first CI run the endpoint
blew a 90s ceiling twice and then answered in 82s. The registry is capable of
being slow rather than dead, which is why the ceiling is 150s and the job gets
20 minutes — a tighter ceiling throws away attempts that were about to land.

If you find yourself wanting to add `|| true` or drop `--audit-level` to
`critical`, don't — the wrapper already absorbs the failure mode that tempts
you to, and anything left is a real finding.
