# Agent instructions — Trajectas

Codex reads this file; `CLAUDE.md` contains only `@AGENTS.md`. Keep instructions
short and put maintained release policy in [docs/runbook.md](docs/runbook.md).
Read that runbook before planning a release, migration, preview or recovery;
use [.agents/skills/release-preflight/SKILL.md](.agents/skills/release-preflight/SKILL.md)
for the evidence readout. The skill is not permission to merge or deploy.

## Working here

- Use an isolated worktree and a small branch from current `origin/main`.
  `scripts/agent-worktree.sh <branch>` uses `.claude/worktrees/`; an isolated
  checkout in a task's writable workspace is acceptable when that location
  is unavailable. Never switch or edit Jason's primary checkout or another
  worker's branch. Inspect status first and preserve unrelated files.
- Search before reading; surface material uncertainty and recommend the
  simplest adequate approach. Keep commits and PRs focused.
- Read [docs/engineering-context.md](docs/engineering-context.md) for the
  relevant subsystem, [docs/ui-standards.md](docs/ui-standards.md) for UI, and
  [src/lib/dal/README.md](src/lib/dal/README.md) for data access. Preserve the
  existing passwordless model, tenant scope and cognitive review gates;
  existing architecture tests enforce these conventions.
- Preserve delivered assessment forms and stored report snapshots. Version
  new behavior and prove compatibility for database, scoring and billing
  work. Journal is a separate project.
- Development and Preview use isolated synthetic data. Never copy the
  primary `.env.local`, credentials or production assessment data. Do not
  run blanket live migrations before a PR. Follow the runbook's ordered
  rollout and separate app rollback from database recovery.
- `node scripts/release/validate-local.mjs` runs ordinary local checks in an isolated
  worktree without environment files. Database checks use
  `npm run test:integration:local` against an isolated local stack; CI is the
  source of final-commit automated evidence. Commands and exceptions are in
  the runbook, not a second checklist here.
- Release approval is Jason's explicit decision for an identified commit.
  Provider permissions, credentials, paid resources, account security and
  branch protection need their own applicable approval. A denied action
  stays blocked; report missing access rather than changing routes.
- Do not log secrets, cookies, bearer links or participant data in evidence.
  Do not weaken checks or quietly repair unrelated dependency/security work
  to make a release appear green; report the failure and its scope.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
