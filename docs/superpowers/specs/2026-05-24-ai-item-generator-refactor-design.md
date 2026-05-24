# AI Item Generator — Refactor & Playbook Presets

**Status:** Design / pre-build
**Date:** 2026-05-24
**Author:** Jason Hunt (with Claude)
**Related:** [`2026-05-24-ai-assessment-creator-design.md`](./2026-05-24-ai-assessment-creator-design.md), [`2026-04-03-pipeline-enhancement-design.md`](./2026-04-03-pipeline-enhancement-design.md)

---

## Table of Contents

1. [Problem](#problem)
2. [Goal](#goal)
3. [Non-goals](#non-goals)
4. [Concept](#concept)
5. [The Invariant: The Science Core](#the-invariant-the-science-core)
6. [Steering Inputs](#steering-inputs)
7. [Playbook Presets](#playbook-presets)
8. [Prompt Architecture](#prompt-architecture)
9. [Data Model](#data-model)
10. [UI Architecture](#ui-architecture)
11. [Seeded Playbooks](#seeded-playbooks)
12. [Build Sequence](#build-sequence)
13. [Open Questions](#open-questions)
14. [Appendix: Relevant Files](#appendix-relevant-files)

---

## Problem

The AI item generator at `src/app/(dashboard)/generate/` and its pipeline at `src/lib/ai/generation/pipeline.ts` produces statistically rigorous items — the AI-GENIE pipeline (critique → leakage guard → EGA → UVA → BootEGA → optional synthetic validation) is solid. But the *content* steering is thin:

- The generation prompt is implicitly behavioural-Likert. Anything else (capability items, situational judgement, frequency-scaled 360 items, trait self-report) is left to the model's instincts.
- The rating-scale entity exists (`response_formats`, seeded by `00018_seed_foundation_response_formats.sql`) and its `responseFormatId` is wired through to `pipeline.ts:96` — but the seeded descriptions read as participant-facing labels, not as LLM steering text. The model sees them and proceeds to write items as if all scales were agreement scales.
- There is no concept of **measurement mode** (behavioural / trait / capability / situational / open), **audience** (graduate intake / senior leadership / etc.), or **use-context** (selection / development / research). These are the three highest-leverage levers for item phrasing and they aren't represented anywhere in the config.
- Run configuration is built from scratch every time. There are no saved playbooks. Jason and any other Trajectas admin who uses the generator has to remember which knobs go together for "a behavioural development tool" vs "a capability SJT for selection".
- The UI at `src/app/(dashboard)/generate/new/page.tsx` is functional but not first-class. The post-generation review surface (`[runId]/page.tsx` + `sortable-item-table.tsx` + `quality-panel.tsx`) is dense and informative but visually un-polished compared to the rest of the platform.

The result: item quality is bottlenecked by prompt steering, and the operator experience around generation is unloved.

## Goal

Refactor the AI item generator into a first-class tool for Trajectas admins. Specifically:

1. **Add the three missing steering dimensions** — measurement mode, audience, use-context — as first-class fields on the run config, and branch the generation + critique prompts on them.
2. **Treat the rating scale as steering, not labelling.** Audit the seeded response-format descriptions and rewrite them as LLM-facing writing rules.
3. **Introduce playbook presets** — admin-shared, editable, encoding not just config defaults but a full writing rubric, exemplars, and pipeline-stage defaults that get injected into prompts at generation time.
4. **Redesign the three surfaces** — configurator, generation-in-progress, post-generation review — to match the platform's premium visual standards.
5. **Preserve the science core exactly.** No changes to `pipeline.ts` numerical behaviour, `synthetic-validation.ts`, `leakage-guard.ts`, `difficulty-targeting.ts`, or the `network/` modules beyond accepting richer inputs.

## Non-goals

- **No new science.** This is not the place to add IRT calibration, new community-detection algorithms, or improved bootstrap procedures. The pipeline's behaviour holds.
- **No validation-of-existing-items entry point.** The prior conversation discussed extracting a "validate-only" path from the pipeline. Useful, but out of scope here; tracked separately.
- **Not exposed to clients.** This surface stays admin-only.
- **No backfill of historical runs.** Old `generation_runs` rows keep their existing config shape; new fields default to null/undefined and are simply absent from the `aiSnapshot` of old runs.
- **No changes to library-side item schema.** Items entering the library still carry the same fields they do today; preset and steering data are recorded on the *run*, not on the item.

## Concept

Two ideas, both load-bearing:

**1. Three new steering dimensions feed the prompts.**

```
                                ┌──────────────────────────────┐
   Construct + Indicators ──→   │                              │
   Measurement Mode      ──→    │  buildItemGenerationPrompt   │  ──→  Items
   Audience              ──→    │  buildCritiquePrompt         │
   Use-Context           ──→    │                              │
   Rating Scale (steered)──→    └──────────────────────────────┘
   Playbook Rubric       ──→
   Playbook Exemplars    ──→
```

Each of these changes what the model writes. Measurement mode changes the *shape* of a stem ("I tend to…" vs "When X happens, I usually…" vs "Solve this problem…"). Audience changes the *vocabulary and complexity*. Use-context changes the *social-desirability tolerance and framing*. Rating-scale changes the *grammar of the stem* (a frequency scale demands "How often…", an agreement scale demands a declarative). The rubric and exemplars carry the rest of the writing playbook.

**2. Playbooks are first-class objects, not config bundles.**

A playbook preset is the thing a senior I-O psychologist would write to teach a junior one how to build a particular kind of assessment. It carries:

- Measurement mode default + audience default + use-context default
- Recommended response format (with a sentence explaining *why*)
- A markdown rubric: writing rules, allowed/disallowed phrasings, sentence-opening guidance, tone
- 3–6 exemplar items, each labelled good or bad, with a one-sentence reason
- SD-tolerance, difficulty mix, critique strictness, which pipeline stages to enable

Loading a preset pre-fills the configurator and *injects rubric + exemplars into the generation and critique prompts at run time*. Edit the preset in the admin editor, the next run uses the new playbook. The preset is the durable artefact; runs are ephemeral applications of it.

## The Invariant: The Science Core

The following are **untouched** by this refactor in any way that changes their numerical output:

- `src/lib/ai/generation/pipeline.ts` — the orchestrator: only changes are (a) reading new config fields and (b) snapshotting them into `aiSnapshot`. No changes to stage ordering, thresholds, or algorithms.
- `src/lib/ai/generation/leakage-guard.ts`
- `src/lib/ai/generation/difficulty-targeting.ts`
- `src/lib/ai/generation/synthetic-validation.ts`
- `src/lib/ai/generation/construct-preflight.ts`
- `src/lib/ai/generation/embeddings.ts`
- `src/lib/ai/generation/network/*` (correlation, network-builder, walktrap, nmi, wto, bootstrap)

Constants — `BATCH_SIZE = 20`, `WTO_CUTOFF = 0.20`, `STABILITY_CUTOFF = 0.75`, `N_BOOTSTRAPS = 100`, `WALKTRAP_STEP_CANDIDATES = [3,4,5,6]` — remain hard-coded at their current values. If a future spec wants to expose them as preset-level overrides, that is its problem.

The two files that **do** change substantively:

- `src/lib/ai/generation/prompts/item-generation.ts` — gains measurement-mode branching, audience/use-context injection, scale-steering injection, rubric + exemplar injection.
- `src/lib/ai/generation/prompts/item-critique.ts` — same injections, so the critique applies the playbook's standards.

Unit tests at `tests/unit/item-generation.test.ts` cover the branching; new tests cover the injection.

## Steering Inputs

Three new fields on `GenerationRunConfig`. All optional for back-compat; if absent, the prompt falls back to behavioural-Likert defaults (the current behaviour).

### `measurementMode`

```ts
type MeasurementMode =
  | 'behavioural'       // observable behaviour, self- or other-reported
  | 'trait'             // tendency / disposition self-report
  | 'capability'        // can-do / knowledge / skill demonstration
  | 'situational'       // SJT — "given scenario X, response Y"
  | 'open'              // free-text override; mode description supplied per-run
```

Mode determines the **stem template family**. The prompt branches on this to choose example phrasings and writing rules. `'open'` carries a `measurementModeDescription` string that the admin writes themselves, for cases that don't fit the canonical list.

### `audience`

A short structured object, not a free-string, so we can analyse against it later but keep flexibility:

```ts
interface Audience {
  level?: 'entry' | 'mid' | 'senior' | 'executive' | 'mixed' | 'open'
  description?: string   // free text — always allowed, required if level === 'open'
}
```

Drives reading-level guidance ("write at an A2/B1 ESL-friendly level for entry roles", "graduate-level vocabulary acceptable for executive audiences") and example contextualisation ("frame in terms of team meetings and code reviews" vs "frame in terms of board interactions and capital allocation").

### `useContext`

```ts
type UseContext =
  | 'development'   // formative — feedback-oriented; tolerate SD risk; allow growth phrasing
  | 'selection'     // high-stakes — minimise SD; demand observable specificity
  | 'research'      // exploratory — full latitude
  | 'open'          // free-text override
```

Affects SD tolerance, item framing ("In the past month, how often have you…" vs "Generally speaking, do you…"), and which pipeline stages the prompt advises caution around.

## Playbook Presets

### Why a preset is not just a config row

The minimum-viable shape would be a row of defaults: `(measurement_mode, use_context, response_format_id, target_n, ...)`. That helps the operator but does nothing for item quality. The playbook adds three fields that **the LLM sees**:

- `rubric` — markdown text injected into the generation system prompt as writing rules
- `exemplars` — `Array<{ stem: string; verdict: 'good' | 'bad'; reason: string }>` injected as concrete demonstrations
- `critique_emphasis` — short string injected into the critique prompt steering which dimensions to weight ("for selection items, weight SD risk heavily and prefer behavioural specificity over breadth")

These are what make a preset substantively change item quality, not just save a few clicks.

### Editor

Admin-only route at `/generate/presets/`:

- **List** — table of presets with name, measurement mode, use context, last edited, last used.
- **Edit** — single page with the same section structure as the configurator, plus markdown editor for rubric and a repeating field for exemplars. Auto-saves per project convention (`useAutoSave` for textareas, save button for structural changes).
- **Duplicate** — single-click duplication is the path for iteration; you start from an existing playbook rather than from scratch.
- **Soft-delete** with undo per project convention. Hard-delete is impossible from the UI.

### Per-run customisation

Loading a preset pre-fills the configurator. **Every field remains editable**, including the rubric and exemplars. If the admin tweaks anything after loading, the configurator shows a "Modified from preset: <name>" badge; the run records the preset_id *and* the resolved-after-edits config + rubric snapshot, so each run is reproducible regardless of later preset edits.

## Prompt Architecture

The current generation prompt at `prompts/item-generation.ts` is a single template. After the refactor:

```ts
buildItemGenerationPrompt({
  construct,
  batchSize,
  responseFormat,             // full row, not just description — includes steering text
  measurementMode,
  measurementModeDescription, // only for 'open'
  audience,
  useContext,
  playbook,                   // { rubric, exemplars, critiqueEmphasis } if a preset is in use
  previousItems,
  previousFacets,
  difficultySteering,
  contrastConstructs,
})
```

The template is composed from blocks:

1. **Construct block** — same as today (name, definition, description, indicators, parent factors).
2. **Mode block** — measurement-mode-specific stem-template guidance. Five branches; one per mode. The `open` branch interpolates the admin-supplied mode description.
3. **Audience block** — reading-level + contextualisation guidance.
4. **Use-context block** — SD posture + framing guidance.
5. **Scale block** — the response format's *steering* text (rewritten from `00018`'s descriptions); for example, frequency scales get rules about "phrase as a behaviour that can vary in frequency" and Likert agreement scales get rules about "phrase as a declarative the respondent can endorse".
6. **Playbook rubric block** — if a preset is in use, the rubric markdown is injected verbatim.
7. **Playbook exemplars block** — if a preset is in use, exemplars are rendered as a bulleted list with their verdicts and reasons. The model is told to imitate the good and avoid the bad.
8. **Contrast + previous-items + facet-coverage + difficulty-steering** — same as today.
9. **Output schema** — same as today, unchanged: stem, reverseScored, rationale, difficultyTier, sdRisk, facet.

The critique prompt (`buildCritiquePrompt`) receives the same steering inputs plus `critiqueEmphasis`, so its rubric for keep/revise/drop aligns with how the items were asked for in the first place.

## Data Model

### New table — `generation_presets`

```sql
create table public.generation_presets (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  description           text,                         -- short, admin-facing
  measurement_mode      text not null,                -- behavioural | trait | capability | situational | open
  measurement_mode_description text,                  -- required when measurement_mode = 'open'
  audience              jsonb not null default '{}'::jsonb,   -- { level, description }
  use_context           text not null,                -- development | selection | research | open
  use_context_description text,                       -- required when use_context = 'open'
  response_format_id    uuid references public.response_formats(id) on delete restrict,
  response_format_rationale text,                     -- one-sentence "why this scale"
  rubric                text,                         -- markdown, injected into prompt
  exemplars             jsonb not null default '[]'::jsonb,  -- Array<{ stem, verdict, reason }>
  critique_emphasis     text,                         -- injected into critique prompt
  sd_tolerance          text,                         -- low | moderate | high — advisory to model
  difficulty_mix        jsonb,                        -- { easy?: number, moderate?: number, hard?: number } as ratios
  critique_strictness   text default 'standard',      -- lenient | standard | strict
  pipeline_defaults     jsonb not null default '{}'::jsonb,  -- { enableItemCritique?, enableLeakageGuard?, enableDifficultyTargeting?, enableSyntheticValidation? }
  recommended_target_per_construct integer default 60,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  deleted_at            timestamptz,                  -- soft delete
  created_by            uuid references auth.users(id) on delete set null
);

create index on public.generation_presets (deleted_at) where deleted_at is null;
create index on public.generation_presets (measurement_mode, use_context);

alter table public.generation_presets enable row level security;

-- Admin-only (org_admin role or platform_admin) read, write, delete
create policy generation_presets_admin_select on public.generation_presets
  for select using (auth.role() in ('org_admin', 'platform_admin'));   -- placeholder; align with project helper functions

create policy generation_presets_admin_insert on public.generation_presets
  for insert with check (auth.role() in ('org_admin', 'platform_admin'));

create policy generation_presets_admin_update on public.generation_presets
  for update using (auth.role() in ('org_admin', 'platform_admin'));
```

> **Note on RLS:** the exact predicate aligns with whatever admin helper exists in `migrations/` for similar admin-only tables — likely `is_platform_admin()` or analogous. The migration will use the actual helper, not the placeholder above.

### Extended `GenerationRunConfig`

```ts
export interface GenerationRunConfig {
  // Existing fields — unchanged
  constructIds: string[]
  targetItemsPerConstruct: number
  temperature: number
  generationModel: string
  embeddingModel: string
  networkEstimator?: 'tmfg' | 'ebicglasso'
  responseFormatId?: string
  promptPurpose?: 'item_generation' | 'factor_item_generation'
  constructOverrides?: Record<string, ConstructConfigOverride>
  enableItemCritique?: boolean
  enableLeakageGuard?: boolean
  enableDifficultyTargeting?: boolean
  enableSyntheticValidation?: boolean

  // New — all optional for back-compat
  presetId?: string
  measurementMode?: MeasurementMode
  measurementModeDescription?: string   // only when measurementMode === 'open'
  audience?: Audience
  useContext?: UseContext
  useContextDescription?: string         // only when useContext === 'open'

  // Resolved-at-run-time playbook snapshot — recorded for reproducibility
  playbookSnapshot?: {
    rubric?: string
    exemplars?: Array<{ stem: string; verdict: 'good' | 'bad'; reason: string }>
    critiqueEmphasis?: string
    sdTolerance?: 'low' | 'moderate' | 'high'
    difficultyMix?: { easy?: number; moderate?: number; hard?: number }
    critiqueStrictness?: 'lenient' | 'standard' | 'strict'
    sourcePresetId?: string
    sourcePresetName?: string
    modifiedFromPreset?: boolean
  }
}
```

`playbookSnapshot` is captured at run kickoff in the action that creates the run, before the pipeline starts. The pipeline reads it and passes it to the prompt builders. The preset row itself can be edited or deleted later without affecting historical run reproducibility.

### `response_formats` description rewrite

The existing rows seeded by `00018_seed_foundation_response_formats.sql` have `description` text that reads as a participant-facing scale label ("A 5-point Likert from Strongly Disagree to Strongly Agree"). The refactor rewrites these as **LLM steering text** — phrasing rules for the stem the model should generate. A new follow-up migration updates the existing rows in place; no schema change.

Example, before:

> "A 5-point Likert scale from Strongly Disagree to Strongly Agree."

After:

> "Agreement Likert (5-point, Strongly Disagree → Strongly Agree). Items MUST be declarative statements the respondent can agree or disagree with — present tense, first-person where appropriate ('I…'), no questions, no frequency adverbs. Avoid double-barrelled claims. Avoid hedges like 'sometimes' or 'often' (those belong to a frequency scale, not this one)."

The participant-facing label moves into a separate column `display_label` if it isn't already separable, so what the participant sees during testing doesn't change. (We'll verify the column situation when we get to the implementation.)

## UI Architecture

Three surfaces, designed as a coherent product. All match `docs/ui-standards.md`: Plus Jakarta Sans / JetBrains Mono, `--primary` emerald + `--gold` accents, gold eyebrows, `var(--ease-spring)`, `ScrollReveal` staggers, `DataTable` for tabular surfaces, branded errors and loading states.

### 1. Configurator canvas

`/generate/new` — replaces the existing form.

**Layout.** Three-column desktop layout, collapsing to single column on mobile.

```
┌────────────────────────────────────────────────────────────────────┐
│  Eyebrow: GENERATE                                                 │
│  Title:   New item generation run                                  │
│  Preset row: [Load preset ▾]  [Loaded: Behavioural — Selection] (×)│
├────────┬────────────────────────────────────────────┬──────────────┤
│ Rail   │  Section content                           │ Sticky       │
│        │                                            │ Launch       │
│ 1.✓ Co │                                            │ Summary      │
│ 2.◐ It │  (current section, big, breathable)        │              │
│ 3.○ Sc │                                            │ • Constructs │
│ 4.○ Pi │                                            │ • N items    │
│ 5.○ Mo │                                            │ • Cost est.  │
│ 6.○ Re │                                            │ • [Launch]   │
└────────┴────────────────────────────────────────────┴──────────────┘
```

Left rail is non-blocking: any section is jumpable at any time. Status dot per section: empty / partial / complete / has-warning. The rail is not a wizard; it's a navigator.

**Sections:**

1. **Constructs** — pick constructs (the existing multi-select, but laid out as a real selection panel, not a cramped form control), set per-construct target. Inline preflight similarity check is preserved.
2. **Item character** — three controls: measurement mode (segmented control with 5 options), audience (level select + free description), use-context (segmented control with 4 options). Each option shows a one-line explanation under it on hover. Free-text "open" descriptions appear when the corresponding control is `open`.
3. **Rating scale** — response format picker. Each scale option renders a **live preview** card showing a *generated example stem written for that scale*, given the currently-selected measurement mode and a placeholder construct. This makes the consequence of the choice visible at the moment of choosing.
4. **Pipeline** — critique, leakage guard, difficulty targeting, synthetic validation toggles. Each with a one-line description. Defaults respect the active preset. Collapsed by default.
5. **Models & advanced** — generation model, embedding model, critique model, temperature, network estimator. Collapsed by default.
6. **Review** — read-only render of the resolved config + playbook snapshot. The same view the run detail page shows for completed runs, so the operator's mental model is consistent across surfaces.

**Sticky launch summary** (right column on desktop, bottom sheet on mobile): live count of constructs × items per construct, estimated input/output tokens and cost (using the model's pricing from the OpenRouter catalog), warnings (incoherent scale+mode combinations, missing required fields), and the launch button.

**Coherence warnings.** Two combinations trigger an inline warning, not a block:
- Capability mode + agreement scale ("Capability items work better with frequency or accuracy scales — are you sure?")
- Selection use-context + lenient critique strictness ("Selection items typically benefit from strict critique — are you sure?")
The admin can override; the override is captured in the run.

### 2. Generation-in-progress view

Replaces the current progress bar. New layout:

- **Pipeline stage rail** — vertical timeline with stages (Generation, Critique, Embedding, Leakage check, Initial EGA, UVA, BootEGA, Synthetic validation, Final). Each shows status (pending / running / done / skipped), elapsed time, and the relevant counter (items generated, items kept by critique, items flagged by leakage, NMI value, etc.).
- **Live item stream** — items appear as they're generated, grouped by construct, with their facet/difficulty/SD tags. Calm motion: gentle fade-in via `ScrollReveal`, no aggressive flashing.
- **Running stats panel** — total tokens used (and projected), token cost, items per construct, critique outcomes (kept/revised/dropped), leakage flags, NMI by stage as values are produced.
- **Cancel** — clean cancel button that stops further LLM calls; the pipeline persists what it has so the operator can still review what was generated.

The data plumbing is unchanged from today — the pipeline already calls `onProgress(stage, pct, details)`. This is purely a presentation rewrite.

### 3. Post-generation review surface

`/generate/[runId]` — substantial visual rewrite, preserving `network-graph.tsx` and `quality-panel.tsx` semantically.

- **Run header** — eyebrow + title (the run's purpose), badges (model, scale, measurement mode, preset), launched-at, status, an "open in preset editor" link if a preset was used.
- **Tabs (or sidebar nav, TBD during build):** Items / Network / Diagnostics / Run snapshot.
- **Items tab** — `DataTable` (per UI standards) with columns: stem, construct, community, stability, wTO max, critique verdict, SD risk, difficulty tier, facet, status (kept / removed by UVA / removed by BootEGA / dropped by critique / leakage-flagged). Filterable by every column; multi-select with bulk actions: Accept (save to library), Reject, Export. Inline edit on stem and reverseScored. Diff badge when an item was revised by critique.
- **Network tab** — keep the existing `network-graph.tsx` visualisation; restyle to UI standards.
- **Diagnostics tab** — `quality-panel.tsx` content, restyled: NMI per stage, UVA + bootstrap sweeps, critique stats, leakage stats, synthetic-validation α if computed.
- **Run snapshot tab** — read-only render of the resolved config (same view as the configurator's Review section), plus the `aiSnapshot` payload — model IDs, prompt IDs and versions, walktrap step, embedding type used, the playbook rubric + exemplars used. This is the "reproducibility" tab; everything needed to rerun this exact configuration is here.

Saving items to the library (accept action) uses the existing server action at `acceptItemsSchema` in `validations/generation.ts`; UX changes are presentational.

## Seeded Playbooks

Four starter presets shipped via a seed migration. They are written to be *useful* in the sense that they encode genuine I-O psych guidance; Jason refines them over time.

1. **Behavioural — Selection (Likert)** — agreement scale, selection use-context, mid-level audience, strict critique, low SD tolerance, rubric emphasising observable specificity and counter-faking phrasing.
2. **Behavioural — Development (Likert)** — agreement scale, development use-context, mixed audience, standard critique, moderate SD tolerance, rubric emphasising feedback-friendly framing and growth-oriented stems.
3. **Frequency-based 360 (development)** — frequency scale, development use-context, other-rater framing, rubric emphasising observable behaviour the rater can have witnessed.
4. **Capability — Situational Judgement** — accuracy/best-response scale, selection use-context, situational measurement mode, rubric for scenario stems with response options and rationales.

Each preset's exemplars include 3 good items and 1–2 bad items with reasons.

## Build Sequence

One PR. The order of commits within the PR provides internal checkpoints so partial state never ships:

1. **Schema migration** — `generation_presets` table + RLS + indexes. Apply locally, run advisors, follow up with REVOKE migration if any SECURITY DEFINER fns added.
2. **Type system** — extend `GenerationRunConfig`, add `MeasurementMode`, `Audience`, `UseContext`, `Playbook` types in `src/types/generation.ts` and `src/types/database.ts`.
3. **Server actions** — preset CRUD (`src/app/actions/generation-presets.ts`): list, get, create, update, soft-delete.
4. **Prompt rewrite** — `buildItemGenerationPrompt` and `buildCritiquePrompt` accept new fields and branch correctly. Unit tests added.
5. **Response format steering rewrite** — migration that updates seeded rows' descriptions.
6. **Pipeline plumbing** — `pipeline.ts` reads new config fields, threads them into the prompt builders, snapshots the playbook into `aiSnapshot`. Existing tests still pass.
7. **Preset seed migration** — four starter presets.
8. **Configurator canvas** — restructure `/generate/new`. Replaces the existing form.
9. **In-progress view** — restyle the run detail page's in-flight state.
10. **Review surface** — restyle the run detail page's done state.
11. **Preset editor** — `/generate/presets/` list and edit screens.
12. **Tests & verification** — unit, integration, manual UI pass with dev server.
13. **Live migration application + PR open + ship.**

Each commit on its own should leave the app in a runnable state. The migration commits run *before* the code that depends on them, so the schema is always ahead of the consuming code.

## Open Questions

These were resolved during the design conversation and are recorded for the implementation:

- **Audience as object vs string?** Object with `level` + optional `description`. Allows analysis against a vocabulary later.
- **Per-user vs admin-shared presets?** Admin-shared. Trajectas's admin pool is small and the value of a shared playbook library outweighs the cost of stepping on each other's drafts.
- **Hard delete or soft delete for presets?** Soft. Per project save-and-persistence principles.
- **Allow editing a preset that was already used in a run?** Yes. Past runs snapshot the playbook into `aiSnapshot.playbookSnapshot`, so editing a preset doesn't break historical reproducibility.
- **Default measurement mode if none supplied?** `behavioural`. Matches today's implicit default.
- **Allow generation without a preset?** Yes. Presets are an accelerator, not a requirement.

Genuinely open:

- **Cost-estimate model accuracy.** We can read prices from the OpenRouter catalog and multiply by projected tokens, but the projection (input vs output tokens) is rough. We'll ship with a deliberately conservative estimate and label it as such.
- **Exemplar item count in the prompt.** Too few and the model doesn't learn the style; too many and we burn tokens on what amounts to few-shot. Initial value: 3 good + 1 bad per construct's batch. Tune after first runs.

## Appendix: Relevant Files

**Pipeline core (preserved):**
- `src/lib/ai/generation/pipeline.ts`
- `src/lib/ai/generation/leakage-guard.ts`
- `src/lib/ai/generation/difficulty-targeting.ts`
- `src/lib/ai/generation/synthetic-validation.ts`
- `src/lib/ai/generation/construct-preflight.ts`
- `src/lib/ai/generation/embeddings.ts`
- `src/lib/ai/generation/network/*`

**Pipeline I/O (rewritten):**
- `src/lib/ai/generation/prompts/item-generation.ts`
- `src/lib/ai/generation/prompts/item-critique.ts`

**Schema & types:**
- `src/types/generation.ts`
- `src/types/database.ts`
- `src/lib/validations/generation.ts`
- new: `supabase/migrations/<date>_generation_presets.sql`
- new: `supabase/migrations/<date>_response_formats_steering_rewrite.sql`
- new: `supabase/migrations/<date>_seed_initial_playbooks.sql`

**Server actions:**
- `src/app/actions/generation.ts` (existing — updates to capture new fields and playbook snapshot)
- new: `src/app/actions/generation-presets.ts`

**UI — configurator:**
- `src/app/(dashboard)/generate/new/page.tsx` (restructured)
- new: `src/app/(dashboard)/generate/new/configurator-canvas.tsx` and section subcomponents

**UI — in-progress + review:**
- `src/app/(dashboard)/generate/[runId]/page.tsx` (restyled)
- `src/app/(dashboard)/generate/[runId]/quality-panel.tsx` (restyled)
- `src/app/(dashboard)/generate/[runId]/sortable-item-table.tsx` (replaced by `DataTable`-based table)
- `src/app/(dashboard)/generate/[runId]/network-graph.tsx` (restyled, semantics preserved)

**UI — preset editor:**
- new: `src/app/(dashboard)/generate/presets/page.tsx` (list)
- new: `src/app/(dashboard)/generate/presets/[presetId]/page.tsx` (edit)
- new: `src/app/(dashboard)/generate/presets/new/page.tsx` (create)

**UI standards reference:**
- `docs/ui-standards.md`

**Tests:**
- `tests/unit/item-generation.test.ts` (extended for new branches)
- new: `tests/integration/generation-presets.test.ts`

---

*End of spec.*
