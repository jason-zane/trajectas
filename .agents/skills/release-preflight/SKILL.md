---
name: release-preflight
description: Prepare Trajectas release evidence for a specific PR or commit, using the canonical runbook and applicable CI results. Use before a release decision or to identify remaining setup gates.
---

Read the repository root `AGENTS.md`, `docs/runbook.md`, and
`.github/pull_request_template.md`. Resolve these paths from the repository root,
not this skill directory. Use the runbook as the single policy source; inspect
actual scripts/workflows when validating automation claims.

Identify the branch, base and exact final commit, changed paths and worktree
status. Preserve other sessions' files. Run `npm run test:release` and, when
dependencies are available, `node scripts/release/validate-local.mjs` directly
from a trusted shell in an isolated env-free
worktree. Record individual command outcomes. For database evidence, use the
runbook's isolated local-stack procedure; do not reset a shared stack.

Read CI evidence for that commit through permitted tools. Confirm the stable
`release-gate` and applicable underlying jobs, including scoped seeded E2E.
Label absent, failed, cancelled, unexpectedly skipped, stale-SHA or unavailable
results as blockers. A docs-only seeded skip is intentional only when the
change-scope output says `false`. Record dependency-audit warnings separately;
a green job does not prove an unavailable audit ran.

Use only permitted reads for environment/recovery evidence. Distinguish the
runbook's approved interim local/disposable-CI and bounded read-only production
workflow from its future hosted-staging recommendations. Require verified
synthetic targets for write tests; missing hosted staging alone is not a blanket
migration-free release blocker. Record unrun live acceptance without claiming it
passed. Do not turn future setup or protection activation into current gates.
For database/scoring/billing changes, collect ordered compatibility, migration
and recovery evidence, preserving delivered forms and report snapshots.

Return a concise PR-ready evidence readout: exact SHA; passed/failed/not-run
checks; Preview and review evidence; compatibility/recovery evidence or N/A;
live setup unknowns; owner decision still needed. Do not call local checks a
production verification or claim readiness when required evidence is missing.

This skill does not authorize publishing, merging, deploying, provisioning,
credentials, account changes or production migrations. Respect the runbook's
action-time approvals. Stop a denied action and report the missing permission;
do not retry through another route. Never include secret values, bearer links
or production participant data in the readout.
