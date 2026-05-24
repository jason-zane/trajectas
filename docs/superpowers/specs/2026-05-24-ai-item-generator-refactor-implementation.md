# AI Item Generator — Implementation Plan

Companion to [`2026-05-24-ai-item-generator-refactor-design.md`](./2026-05-24-ai-item-generator-refactor-design.md). This document tracks the actual commit sequence on the `feat/ai-item-generator-refactor` branch.

Worktree: `.claude/worktrees/feat/ai-item-generator-refactor/`
Branch:   `feat/ai-item-generator-refactor` (tracks origin/main)

## Commit plan

Each commit must leave the app in a runnable state. Schema commits run *before* the code that consumes them.

| # | Commit | Files touched |
|---|---|---|
| 1 | `docs: spec for AI item generator refactor` | the two docs |
| 2 | `feat(db): generation_presets table + RLS` | new migration + RLS predicates |
| 3 | `feat(types): measurementMode / audience / useContext on GenerationRunConfig` | `src/types/generation.ts`, `src/types/database.ts`, `src/lib/validations/generation.ts` |
| 4 | `feat(actions): generation-presets CRUD` | `src/app/actions/generation-presets.ts`, `src/lib/supabase/mappers.ts` |
| 5 | `feat(ai): response_formats steering rewrite + new prompt branches` | migration updating response_formats descriptions; `prompts/item-generation.ts`; `prompts/item-critique.ts`; unit tests |
| 6 | `feat(ai): pipeline reads new steering inputs + playbook snapshot` | `src/lib/ai/generation/pipeline.ts`; `src/app/actions/generation.ts` (capture playbook snapshot at run kickoff) |
| 7 | `feat(db): seed initial playbook presets` | seed migration |
| 8 | `feat(ui): configurator canvas` | restructure `src/app/(dashboard)/generate/new/page.tsx`, new section components |
| 9 | `feat(ui): generation-in-progress redesign` | update run detail page's in-flight state |
| 10 | `feat(ui): post-generation review redesign` | restyle `[runId]/*` surface; replace sortable-item-table with DataTable |
| 11 | `feat(ui): preset editor` | new routes under `/generate/presets/` |
| 12 | `test: integration coverage for presets + steering` | `tests/integration/generation-presets.test.ts`; extend `tests/unit/item-generation.test.ts` |
| 13 | `chore: misc polish from manual UI walkthrough` | whatever surfaces during testing |

## Pre-flight checks before each commit

1. `npm run lint` (or `npm run check` if the project uses it)
2. `npm run build` — must pass before any UI commit lands
3. `npm test:unit` — must pass before any prompt/pipeline commit lands
4. `npm run test:integration:local` — for DB-touching commits

## Verification before opening the PR

1. Local Supabase running, all migrations applied via `supabase db reset`
2. `npm run test:integration:local` green
3. `npm run build` green
4. Manual UI walkthrough:
   - Load each seeded preset, observe the configurator pre-fills correctly
   - Tweak fields, see "Modified from preset" badge
   - Launch a small run (1 construct, 20 items), verify steering shows up in generated items
   - Watch in-progress view through to completion
   - Review items in the new table; filter, sort, multi-select, accept to library
   - Open the preset editor; edit, duplicate, soft-delete

## Live ship steps

1. Apply migrations to live Supabase via Supabase MCP (`apply_migration` per file, in order).
2. Run `get_advisors` after each migration; fix any new warnings (REVOKE EXECUTE on SECURITY DEFINER fns if any).
3. `git push -u origin feat/ai-item-generator-refactor`
4. `gh pr create` with body summarising spec + key surfaces.
5. `gh pr checks <num> --watch` through security → quality → e2e-smoke.
6. Address any CI failures.
7. `gh pr merge --squash --delete-branch`.
8. Locally: `git checkout main && git pull --ff-only`, then `git branch -D feat/ai-item-generator-refactor`, then `git worktree remove <worktree path>`.

## Risks & mitigations

- **Diff size.** This will be a large PR. Mitigation: each commit is small and focused, and the spec is the reading order.
- **Visual ambition vs schedule.** If a UI surface becomes unwieldy, defer non-essential polish to a follow-up. The configurator and review surface are the highest priority for "first-class feel".
- **Migration conflicts with live.** Apply to live *before* opening the PR per project convention so Vercel previews build against the new schema.
- **CI `npm audit` flakiness.** Treat as repo maintenance per AGENTS.md; bump as a separate `chore(deps)` commit on the same branch if it fails.
