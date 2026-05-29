# AI Assessment Creator — Reconciled Build Plan

**Status:** Ready to build (v1 scoped)
**Date:** 2026-05-29
**Author:** Jason Hunt (with Claude)
**Supersedes the build sections of:** [`2026-05-24-ai-assessment-creator-design.md`](./2026-05-24-ai-assessment-creator-design.md)
**Reconciled against:** [`2026-05-25-taxonomy-unification-design.md`](./2026-05-25-taxonomy-unification-design.md) (implemented) — matching, assembly, and customer-facing display operate on **factors**, not constructs.

---

## 1. Why this document exists

The 2026-05-24 design predates the taxonomy unification. Its concept and I-O grounding still hold, but its schema and pipeline sections were written at the **construct** grain and several of its open questions have since been answered by what actually shipped. This document re-grounds the plan in the live library, locks the decisions taken on 2026-05-29, and lays out a buildable v1 sequence whose first milestone is a **working JD→factors matcher tested on the existing library**.

The original document remains the canonical reference for *concept, positioning, and I-O psychology lineage*. Read it for the "why." Read this for the "what we're building."

---

## 2. Live library state (grounded 2026-05-29)

Queried against the production project (`rwpfwfcaxoevnvtkdmkx`):

| Entity | Live | Shape |
|---|---|---|
| Dimensions | 5 | |
| Factors | 25 | **all 25 `is_match_eligible = true`** |
| Constructs | 25 | clean 1:1 with factors |
| Items | 360 | **all `status = active`**, exactly 12 per construct |

Every live factor has `definition`, `indicators_low/mid/high`, and `anchor_low/high` populated. `description` is empty on all 25 (the library uses `definition` as the prose field). Each factor reaches a complete 12-item pool via `factor_constructs → constructs → items`.

**Consequences that shape the plan:**

1. **The matcher is buildable and testable today** — 25 well-described, fully-populated, match-eligible factors with complete item pools. No backfill is required to start.
2. **`factors.is_match_eligible` already exists** — the taxonomy-unification work laid the factor-level matcher groundwork. The eligibility flag is in place and true on all 25.
3. **Assembly is already factor-based.** `createAssessment` (`src/app/actions/assessments.ts:794`) accepts `factors: [{ factorId, weight, itemCount }]` and writes `assessment_factors(factor_id, weight, item_count)`; the runner serves items from each factor's construct pool. The matcher's ranked-factor output maps almost 1:1 onto this. **No new item-selection plumbing is needed for v1.**

---

## 3. Decisions locked on 2026-05-29

### 3.1 Outcome taxonomy — three stored tags, multi-valued

`applicable_outcomes` is a `TEXT[]` on `factors`. Factors carry **multiple** tags (most leadership factors are dual/triple-use). Stored vocabulary is deliberately coarse, because outcome is the *weakest* of the three applicability discriminators — at 25 factors almost everything applies to selection *and* development, so a fine-grained vocabulary produces low-signal tags the matcher would over-trust.

| Stored tag | Absorbs (use cases) | Why it is a real distinction |
|---|---|---|
| `selection` | hiring, promotion, **succession** | "predict/decide across people"; succession is selection for a future role |
| `development` | development planning, **coaching** | "grow this person"; coaching is development at 1:1 grain |
| `team_composition` | team balance / complementarity | a different question — fit *within a set*, not absolute level |

The one outcome distinction that genuinely flips factor applicability is **selection vs development** (predictive-and-stable vs coachable-and-movable). `team_composition` is the third because it asks a structurally different question.

### 3.2 Decouple chip-picker intent from stored tag

The wizard's outcome chip-picker may present **richer, user-facing** intents (e.g. "Succession planning", "Executive coaching", "Team build"). Each maps to one stored tag for *eligibility filtering*, **and** the literal intent string flows into the extracted brief so the matcher's *reasoning and rationale* can be intent-specific. This yields discrimination where it is cheap (the LLM prompt) and honest coarse tags where precision would be fake (25 hand-set rows).

Indicative mapping:

| Chip (UI) | → stored `outcome` filter | literal intent into brief |
|---|---|---|
| Hiring / Selection | `selection` | "selection" |
| Promotion readiness | `selection` | "promotion" |
| Succession planning | `selection` | "succession" |
| Development planning | `development` | "development" |
| Coaching | `development` | "coaching" |
| Team composition | `team_composition` | "team_composition" |

### 3.3 Discrimination budget goes to level and function

`applicable_levels` (`ic | first_line_manager | mid_manager | senior_leader | executive`) genuinely separates factors and is the primary hard filter alongside outcome. `applicable_functions` is a loose free-tag set. Outcome stays coarse and acts as a soft/eligibility signal, not a fine-grained ranker.

### 3.4 Item assembly — factor-based, pool-first, reuse existing plumbing

v1 uses the existing `assessment_factors` path. Matcher returns ranked factors → user confirms picks → `createAssessment` inserts factor rows with `item_count`/`weight` → existing runner serves items from each factor's construct pool. Fresh item generation (existing generation pipeline) is a **later** enhancement for thin/new factors; nothing in today's library is thin, so it does not block v1. (If a factor ever maps to >1 construct, item distribution across constructs becomes a question — not applicable today at 1:1.)

### 3.5 Library hardening is incremental, not a prerequisite

Only applicability tags (and one matcher wiring fix) land before/with the matcher build. Everything else — overuse signatures, contrasts, exemplars, publishability bar, versioning, health dashboard — is deferred and ported to the factor grain when the library grows and customers arrive.

---

## 4. Schema changes

### 4.1 Now (lands before / alongside the matcher)

Migration on `factors`:

```sql
ALTER TABLE factors
  ADD COLUMN applicable_outcomes  TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN applicable_levels    TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN applicable_functions TEXT[] NOT NULL DEFAULT '{}';
```

- `applicable_outcomes` values constrained (in app validation, optionally a CHECK) to `selection | development | team_composition`.
- `applicable_levels` values to the five-level ladder.
- `applicable_functions` free text.
- **Backfill:** one AI-assisted pass over the 25 live factors, human-reviewed. ~25 rows. This is the only hand-work item in the "now" track and can land in parallel with or just after the matcher UI.

New prompt row in `ai_system_prompts`:

- Add `brief_extraction` to the purpose enum / `purpose-meta.ts` (currently has `competency_matching`, `library_import_structuring`).

### 4.2 Later (deferred, port to factor grain when needed)

- `overuse_signature` (text) on `factors` — match-quality + report nuance.
- `contrasts_with` (text[] of factor slugs) on `factors` — dedupe signal / authoring guidance.
- `factor_exemplars` table — critical-incident vignettes per pole (the doc's `construct_exemplars`, re-grained).
- `theoretical_lineage` (text) on `factors` — defensibility.
- `typical_item_count` / `typical_seconds_per_item` — UX nicety for live counters (today derivable: 12 items/factor).
- Status workflow + `promote_factor_to_published` gate; `factor_versions` + snapshot trigger; library health dashboard.
- Embeddings (`pgvector`) — not until ~150+ factors. You have 25.

---

## 5. The matcher pipeline (reconciled)

### Stage 0 — Matcher input fixes (must land regardless)

1. **Feed `definition`, not `description`.** The current prompt builder (`src/lib/ai/prompts/competency-matching.ts`) maps `availableFactors.description` into the prompt, but `description` is empty on all 25 factors. Source `definition` (+ optionally indicators) instead, or the matcher reasons over blank text.
2. **Generalise `MatchingInput`** (`src/types/ai.ts`). Today it is `{ clientId, diagnosticData: Record<dimId, number>, availableFactors }` — i.e. measured diagnostic scores. Add a discriminated source so the brief path and the diagnostic path share one engine:

```ts
type MatchingSource =
  | { kind: 'diagnostic'; clientId: string; diagnosticData: Record<string, number> }
  | { kind: 'brief'; brief: Brief }

interface MatchingInput {
  source: MatchingSource
  availableFactors: Array<{ id: string; name: string; definition: string;
                            applicableOutcomes: string[]; applicableLevels: string[] }>
}
```

The existing `runMatching` engine (`src/lib/ai/matching/engine.ts`) is sound and currently **orphaned** (no app code triggers a run; `matching.ts` only reads and bulk-deletes). This work gives it its first real trigger.

### Stage 1 — Intent capture (wizard step 1)

Single dense input: paste / upload / free text + outcome chip-picker (§3.2). One step, not three.

### Stage 2 — Brief extraction

One LLM call (`brief_extraction` prompt) → structured `Brief`:

```ts
type Brief = {
  role_title: string;
  level: 'ic' | 'first_line_manager' | 'mid_manager' | 'senior_leader' | 'executive';
  function: string;
  outcome: 'selection' | 'development' | 'team_composition';   // stored tag
  outcome_intent: string;        // literal chip label, e.g. "succession" — feeds reasoning
  responsibilities: string[];
  context_signals: string[];
  technical_requirements: string[];
};
```

Show the brief back to the user (wizard step 2) to sanity-check before matching runs.

### Stage 3 — Eligibility filter + rank

- **Filter** `is_match_eligible` factors where `brief.outcome ∈ applicable_outcomes` AND `brief.level ∈ applicable_levels` (treat empty tag arrays as "applies to all" until backfill completes, so the matcher works *before* tags land).
- **Rank** the filtered pool in one LLM call (pure-LLM, Option A from the doc — correct at 25 factors). Return ranked factors with per-factor rationale grounded in `outcome_intent` + responsibilities.
- Persist to `matching_runs` / `matching_results` (results keyed by `factor_id`; note the legacy `competency_id` column name in `00001` was renamed in `00022`).

### Stage 4 — Review surface (wizard step 3)

Ranked factor list. Each row: name, definition, **rationale**, swap/remove. Add-factor search at the bottom. Live counters: estimated items `= Σ item_count` and time `= Σ(item_count × seconds)/60` (default 12 items/factor, ~20s/item until `typical_*` fields exist).

### Stage 5 — Assemble + save (wizard step 4)

Name the assessment → call `createAssessment` with `factors: [{ factorId, weight, itemCount }]`. Reuse, do not rebuild. The runner serves items from each factor's construct pool.

---

## 6. Wizard UI

Reuse `ActionDialog` + `ActionWizard`; reference implementation `src/components/campaigns/quick-launch-modal.tsx`. Four steps: **Brief → Reviewing (brief read-back) → Picks → Name & create.** Dialog likely `max-w-4xl` (rationale text needs reading room). Keep it a modal, not a page — the modal communicates "this takes three minutes." Read `docs/ui-standards.md` before building.

---

## 7. Build sequence

Milestone in **bold**.

### Phase 1 — Matcher core (testable on existing 25 factors)
1. Stage 0 fixes: feed `definition`; generalise `MatchingInput` + the engine/prompt to the brief source.
2. `brief_extraction` prompt row + `purpose-meta.ts` entry.
3. File ingestion: PDF/DOCX → text (net-new; the doc flagged this as unbuilt).
4. `runMatching` trigger action in `src/app/actions/matching.ts` (create-run path), persisting to `matching_runs`/`matching_results`.
5. **→ Matcher runs end-to-end against the real library (CLI/integration test or a minimal harness).**

### Phase 2 — Wizard + assembly (demoable product)
6. 4-step `ActionWizard` (§6).
7. Step 3 picks UI: ranked list + rationale + counters + add/swap/remove.
8. Wire step 4 to `createAssessment`.
9. **→ End-to-end JD → bespoke assessment, in-app.**

### Phase 3 — Sharpen matching
10. Migration: `applicable_outcomes/levels/functions` on `factors`.
11. AI-assisted backfill of the 25 factors (human-reviewed).
12. Turn on eligibility filtering (Stage 3) using the tags.

### Phase 4+ — Hardening (as the library grows)
13. `overuse_signature`, `contrasts_with`, `factor_exemplars`, `theoretical_lineage`.
14. Status workflow + publishability gate + versioning + health dashboard.
15. Embeddings only past ~150 factors.

DB-touching phases follow the migration & deploy flow in `AGENTS.md` (local-first → live via MCP → `get_advisors` → commit → PR → CI green → squash-merge). All branch work in a worktree under `.claude/worktrees/`.

---

## 8. Open questions still live

1. **Brief-extraction failure modes** — what the wizard does when input is too thin ("I need a sales assessment"). Options: clarifying questions / proceed-on-minimal-brief / refuse below a confidence threshold. Decide before building Stage 2 UX.
2. **Item count per factor in the picks UI** — expose a per-factor slider, or fix at the full pool (12) with a global cap? Affects counter design.
3. **Weighting** — does v1 let the user weight factors, or is weight uniform? `assessment_factors.weight` supports it; the question is whether to surface it.
4. **Multi-tenant library** — still explicitly out of scope for v1; `factors.client_id` already exists, so the structural hook is present when it becomes a question.

---

## 9. Appendix — verified anchors

**Tables:** `factors` (`is_match_eligible`, `client_id`, `partner_id`, `definition`, `indicators_*`, `anchor_*`), `factor_constructs`, `constructs`, `items` (`construct_id`, `status`, `weight`, `purpose`, `difficulty`), `assessment_factors` (`factor_id`, `weight`, `item_count`), `matching_runs`, `matching_results` (`factor_id` / legacy `competency_id`), `ai_system_prompts`, `ai_model_configs`.

**Code:**
- `src/lib/ai/matching/engine.ts` — `runMatching` (sound, currently orphaned)
- `src/lib/ai/prompts/competency-matching.ts` — `buildMatchingPrompt`, `isValidRankingsPayload`
- `src/types/ai.ts` — `MatchingInput` / `MatchingOutput`
- `src/app/actions/matching.ts` — read + bulk-delete only; needs a create-run trigger
- `src/app/actions/assessments.ts:794` — `createAssessment` (assembly target; inserts `assessment_factors`)
- `src/lib/ai/purpose-meta.ts` — prompt purpose registry (`competency_matching` present; add `brief_extraction`)
- `src/components/action-dialog/{action-dialog,action-wizard}.tsx`; `src/components/campaigns/quick-launch-modal.tsx` (reference)
- `docs/ui-standards.md` — read before UI work
