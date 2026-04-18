# UX/UI Audit

Systematic, methodical audit of every interactive surface in the Trajectas app. Produces findings, extracts patterns, codifies standards, and drives a series of thematic refresh sweeps — not a big-bang rewrite.

## Goals

1. Catalogue every surface and every interactive element across the app
2. Evaluate each against a shared rubric — scores are data, not opinion
3. Cluster findings into patterns (a finding affecting 12 surfaces is the same problem, 12 times)
4. Codify patterns into an expanded `docs/ui-standards.md`
5. Ship refreshes as thematic sweeps (empty states → forms → tables → etc.), each shipped as its own PR series
6. Establish ongoing hygiene so we stop drifting

## Scope

| In scope | Out of scope |
|----------|--------------|
| Client portal (**priority 1**) | Marketing site |
| Partner portal (**priority 2**) | |
| Admin / staff portal (**priority 3**) | |
| Component primitives (`src/components/`) | |
| Participant assessment-taking UI (**own mini-audit, last**) | |

## Phases

| Phase | What | Who drives | Artifacts |
|------:|------|------------|-----------|
| 0 | Foundations — rubric, taxonomy, templates | Drafted now | `framework.md`, this README |
| 1 | Inventory — catalogue every surface + screenshot every state | Autonomous overnight runs | `inventory/*.md`, `screenshots/**/*.png` |
| 2 | Evaluate — score each surface against rubric | Autonomous overnight runs | `findings/*.md` |
| 3 | Extract standards — cluster findings into patterns | Collaborative | `patterns.md`, expanded `docs/ui-standards.md` |
| 4 | Prioritise sweeps — order the refresh work | Collaborative | `sweeps.md` |
| 5 | Execute sweeps | Feature-dev cycle | PRs per sweep |
| 6 | Ongoing hygiene | Permanent | PR-template checkboxes, Storybook |

**Phases 1 and 2 are designed to run unattended.** They have no creative calls, just rubric-following. Phase 3 onward requires judgment and stays collaborative.

## Running autonomously

Each Phase 1 / Phase 2 task in `phase-1-inventory.md` is structured as a self-contained prompt. Hand it to a scheduled agent via `/schedule` and it will:

1. Read the framework + target surface
2. Produce a markdown artifact in the correct location
3. Commit + push on the audit branch
4. Exit

You can chain tasks by scheduling them sequentially across nights, or fan them out in parallel via separate remote triggers.

**Working branch convention:** all audit artifacts commit to `claude/audit-<phase>-<area>` branches (e.g. `claude/audit-inventory-client`), so the main branch stays quiet until a phase is ready to merge.

## Deliverables you should expect

- **`inventory/<portal>.md`** — structured table of every surface in a portal
- **`screenshots/<portal>/<surface>/<state>.png`** — visual state capture (loaded, empty, loading, error)
- **`findings/<surface>.md`** — rubric scores + specific findings per surface
- **`patterns.md`** — findings that recur ≥ 3 times, promoted to pattern status
- **`docs/ui-standards.md`** (expanded) — the living source of truth for future PRs
- **Storybook catalogue** (Phase 3+) — canonical components that implement the standards

## Files in this directory

| File | Purpose |
|------|---------|
| `README.md` | You are here |
| `framework.md` | **Read this first** — rubric, taxonomy, templates |
| `phase-1-inventory.md` | Autonomous Phase 1 task prompts |
| `phase-2-evaluate.md` | (created after Phase 1) — autonomous Phase 2 task prompts |
| `inventory/` | Phase 1 outputs |
| `screenshots/` | Phase 1 outputs |
| `findings/` | Phase 2 outputs |
| `patterns.md` | (created after Phase 2) — clustered recurring findings |
| `sweeps.md` | (created in Phase 4) — prioritised execution plan |
