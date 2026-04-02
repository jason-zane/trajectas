# Item Generation Pipeline Enhancement — Design Spec

## Problem

The item generation pipeline produces inconsistent results:
1. Some constructs get only 20 items due to parse failures, deduplication, and low attempt ceilings
2. The temperature slider may silently do nothing for models that don't support it
3. Generated items lack diversity across behavioural facets in later batches
4. No quality filtering happens before items enter the expensive embedding/network analysis stages
5. Cross-construct leakage is only detected post-hoc (bootEGA), wasting pipeline resources
6. Difficulty spread across items is left to chance
7. No way to estimate psychometric properties before collecting human data

## Solution Overview

Two tiers of enhancement:

**Tier 1 — Pipeline Hardening (implement now):**
- Temperature-aware model picker
- Increased attempt ceiling
- Full batch size requests
- Facet diversity guidance on batch 2+

**Tier 2 — Next-Generation Pipeline (implement in phases):**
Four optional pipeline stages, toggled per run:
- Item Critique (multi-agent review)
- Leakage Guard (real-time cross-construct checking)
- Difficulty Targeting (IRT-informed generation steering)
- Synthetic Validation (in silico respondent simulation)

## Tier 1: Pipeline Hardening

### 1a. Temperature Awareness

**Problem:** OpenRouter silently ignores unsupported parameters. If a model doesn't support temperature, the wizard slider does nothing with no indication to the user.

**Change:**
- Add `supported_parameters?: string[]` to the `OpenRouterModel` type in `src/types/generation.ts`. OpenRouter already returns this field in its `/api/v1/models` response — we're currently discarding it.
- In the generation wizard Step 3, check whether the selected generation model includes `"temperature"` in its `supported_parameters`. If not, disable the temperature slider and show an inline note: "This model does not support temperature adjustment."
- No backend changes. The API call already sends temperature and OpenRouter handles unsupported params. This is a UX honesty fix.

### 1b. Increased Attempt Ceiling

**Problem:** With target 60 and BATCH_SIZE 20, the maximum attempts is `Math.ceil(60/20) + 4 = 7`. After deduplication and parse failures, this often isn't enough.

**Change:** In `src/lib/ai/generation/pipeline.ts`, change the safety margin from `+4` to `+8`:

```
Math.ceil(target / BATCH_SIZE) + 8
```

For target 60 this gives 11 max attempts — plenty of headroom.

### 1c. Always Request Full Batch Size

**Problem:** When 10 items remain to hit the target, the pipeline requests exactly 10. After dedup, it might keep 6 and fall short.

**Change:** In `src/lib/ai/generation/pipeline.ts`, change:

```
const needed = Math.min(BATCH_SIZE, target - accumulated.length)
```

to simply:

```
const needed = BATCH_SIZE
```

The pipeline already stops accumulating at the target (`if (accumulated.length >= target) break`), so requesting more than needed is safe — surplus items are simply not added.

### 1d. Facet Diversity Guidance

**Problem:** Later batches tend to repeat the same behavioural facets as earlier ones, producing items that get deduplicated or removed by UVA.

**Change:** In `src/lib/ai/generation/prompts/item-generation.ts`, when `previousItems` is non-empty, extract the `facet` labels from already-generated items and append a diversity instruction to the prompt:

```
## Facet Coverage
Previous batches covered these facets: [list of facet labels].
Explore different behavioural expressions of the construct that are not yet represented.
```

This requires threading the facet metadata from previously generated items into `buildItemGenerationPrompt`. The pipeline already tracks generated items with their facets in `rawCandidates` — pass the facet list alongside `previousItems`.

**Files to modify:**
- `src/lib/ai/generation/prompts/item-generation.ts` — add `previousFacets?: string[]` param, append facet coverage section
- `src/lib/ai/generation/pipeline.ts` — collect facets from accumulated items, pass to prompt builder

## Tier 2: Next-Generation Pipeline

### Architecture: Configurable Pipeline Stages

The generation wizard's Step 3 gets a new "Pipeline Options" section with four toggle cards. Each shows:
- Name and one-line description
- Impact indicator (what it improves)
- Cost indicator (relative time/token cost)

| Toggle | Default | Impact | Cost |
|--------|---------|--------|------|
| Item Critique | On | Removes weak items before embedding | +1 LLM call per batch (separate model) |
| Leakage Guard | On | Catches cross-construct items during generation | Embedding comparison per item (no LLM) |
| Difficulty Targeting | Off | Steers generation toward difficulty gaps | Embedding analysis between batches (no LLM) |
| Synthetic Validation | Off | Estimates reliability before human data | +50-100 LLM calls per construct (expensive) |

Toggle state is stored in `GenerationRunConfig` as optional boolean fields:

```typescript
enableItemCritique?: boolean        // default: true
enableLeakageGuard?: boolean        // default: true
enableDifficultyTargeting?: boolean // default: false
enableSyntheticValidation?: boolean // default: false
```

### 2a. Item Critique (Multi-Agent Review)

**Purpose:** A second, independent LLM reviews each batch of generated items before they enter the embedding pipeline.

**Separate model and prompt:**
- New `ai_prompt_purpose` enum value: `item_critique`
- New model config entry on `/settings/ai`: allows selecting a different model (e.g., Claude Sonnet for critique while MiniMax generates)
- New system prompt editable at `/settings/prompts/item_critique`
- This ensures genuine independent review — different model, different training biases

**Flow:**
1. Pipeline generates batch of 20 items as normal
2. Before deduplication, the full batch is sent to the critique model
3. The critique prompt receives: the batch of items, the construct definition + description + indicators, and the contrast constructs
4. The critique LLM evaluates each item on five dimensions:
   - **Construct purity** — does this item clearly belong to the target construct?
   - **Discriminant validity** — would this item cross-load onto contrast constructs?
   - **Inflation risk** — would a low-scorer still rate themselves 4-5?
   - **Readability** — accessible at 8th-grade reading level?
   - **Reverse-key quality** — if reverse-scored, is it a genuine alternative or a straw man?
5. Each item gets a verdict: **keep**, **revise** (with specific revision text), or **drop** (with reason)
6. Revised items are accepted with the revision applied. Dropped items don't enter the pool.

**Data stored per item:**
- `critiqueVerdict`: `'kept' | 'revised' | 'dropped'`
- `critiqueReason?: string` (for revised/dropped items)
- `critiqueOriginalStem?: string` (original text before revision, if revised)

**Interaction with existing pipeline:** Critique runs per-batch, before deduplication and before embedding. Bad items never waste embedding tokens. Items still go through UVA and bootEGA after critique — critique is a quality pre-filter, not a replacement for statistical validation.

### 2b. Leakage Guard (Real-Time Cross-Construct Checking)

**Purpose:** Catch items that semantically belong to a different construct during generation, not just post-hoc in bootEGA.

**Flow:**
1. Before generation begins, compute a centroid embedding for each construct from the construct definition text (reuse preflight embeddings if available from the readiness check, otherwise embed definitions)
2. As items are generated for Construct A, embed each new item and compare its cosine similarity to all construct centroids
3. If an item's similarity to another construct's centroid ≥ its similarity to its own construct's centroid, flag it as "leaking"
4. Flagged items are dropped before entering the pool
5. As items accumulate, incrementally update construct centroids to incorporate item embeddings (centroids become more representative over time)

**Key details:**
- No LLM calls — pure embedding math, very fast
- For the first construct generated, there are no other construct items yet — leakage guard contributes from construct 2 onward
- If a construct produces many leaking items, surface this as a warning in the review UI ("12 items were dropped due to cross-construct leakage — consider sharpening this construct's definition")

**Data stored per item:**
- `leakageScore?: number` — cosine similarity to nearest non-target construct centroid
- `leakageTarget?: string` — name of the construct it leaked toward (if flagged)

### 2c. Difficulty Targeting (IRT-Informed Generation)

**Purpose:** Actively steer generation toward difficulty gaps rather than hoping for a natural spread.

**Flow:**
1. After each batch, compute each item's distance from its construct centroid in embedding space
2. Normalize to a 0-1 difficulty estimate: items near the centre = "easy" (broad, commonly endorsed), items on the periphery = "hard" (specific, only strong scorers endorse)
3. Bin items into three difficulty zones (easy: 0-0.33, moderate: 0.33-0.66, hard: 0.66-1.0) and check the distribution
4. Target distribution: ~20% easy, ~50% moderate, ~30% hard
5. If the pool is skewed, append a steering instruction to the next batch prompt: "The pool is currently heavy on easy-to-endorse items. For this batch, focus on items that only someone genuinely high on this construct would endorse — use trade-off framing, friction situations, and conditional behaviours."

**Key details:**
- No separate model or LLM call — embedding math between batches plus a prompt modifier
- The embedding-based estimate is stored alongside the LLM's self-reported `difficultyTier` — the review UI can show when they disagree ("the model thought this was moderate, but embedding analysis suggests it's easy")

**Data stored per item:**
- `difficultyEstimate?: number` — continuous 0-1 score from embedding distance

### 2d. Synthetic Validation (In Silico Pre-Validation)

**Purpose:** Simulate how a population would respond to the surviving items to estimate factor structure and reliability before collecting human data.

**Separate model config:**
- New `ai_prompt_purpose` enum value: `synthetic_respondent`
- Separate model entry on `/settings/ai` — can use a cheap, fast model since persona simulation doesn't require deep reasoning, just consistency
- Separate system prompt at `/settings/prompts/synthetic_respondent`

**Flow:**
1. After items survive the full pipeline (critique → dedup → embed → EGA → UVA → bootEGA), the surviving pool enters synthetic validation
2. Generate 50-100 synthetic respondent personas varying on demographics, role level, and expected trait levels (e.g., "Senior manager, 15 years experience, high conscientiousness, moderate agreeableness, low neuroticism")
3. Each persona "completes" the items on a 1-5 Likert scale — the LLM responds as that persona, rating each item
4. This produces a synthetic response matrix (respondents × items)
5. Run psychometric analyses on the synthetic data:
   - **Factor structure** — does the intended dimensionality emerge?
   - **Internal consistency** — estimated Cronbach's alpha per construct
   - **Item-total correlations** — which items correlate poorly with their construct?
   - **Cross-loading detection** — which items load onto multiple factors?
6. Surface results in the review UI before the human reviews items

**Important caveats (from research):**
- LLM-simulated data replicates group-level latent structures well (factor structure, configural/metric invariance) but does NOT approximate individual-level response distributions
- Synthetic results should be presented as "estimated" with a clear disclaimer — this is prototyping, not validation
- Useful for flagging structural problems (wrong dimensionality, cross-loading items), not for establishing exact reliability coefficients

**Data surfaced in review UI:**
- Per-item: synthetic item-total correlation, cross-loading warnings
- Per-construct: estimated alpha, factor loading pattern
- Overall: whether intended dimensionality emerged

### Review UI Enhancements

The existing review page (`/generate/[runId]`) gets additional data columns for each new stage:

- **Critique verdict** — "kept", "revised" (with diff), or shows drop reason
- **Leakage score** — similarity to nearest non-target construct, flagged if close
- **Difficulty estimate** — continuous 0-1 score alongside LLM's self-reported tier
- **Synthetic flags** — item-total correlation and cross-loading warnings (when synthetic validation was on)

**Pipeline funnel summary** at the top of the review page:
- Items generated → survived critique → survived dedup → survived UVA → survived bootEGA → final pool
- Per-construct breakdown to spot which constructs had trouble
- Which pipeline stages were active for this run

## New Database Enum Values

Two new `ai_prompt_purpose` values:
- `item_critique`
- `synthetic_respondent`

These require a migration to extend the enum and seed default prompts.

## New Model Config Entries

Two new entries in `ai_model_configs`:
- Purpose `item_critique` — default to same model as `item_generation`
- Purpose `synthetic_respondent` — default to a fast/cheap model

## Files to Modify (Tier 1)

| File | Change |
|------|--------|
| `src/types/generation.ts` | Add `supported_parameters?: string[]` to `OpenRouterModel` |
| `src/lib/ai/generation/pipeline.ts` | Increase attempt ceiling, always request full batch, pass facets to prompt builder |
| `src/lib/ai/generation/prompts/item-generation.ts` | Add `previousFacets` param, append facet coverage section |
| `src/app/(dashboard)/generate/new/page.tsx` | Disable temperature slider when model doesn't support it |

## Files to Create/Modify (Tier 2)

| File | Change |
|------|--------|
| `src/types/generation.ts` | Add pipeline toggle fields to `GenerationRunConfig`, add critique/leakage/difficulty fields to `ScoredCandidateItem` |
| `src/types/database.ts` | Add `item_critique` and `synthetic_respondent` to `AIPromptPurpose` |
| `src/lib/ai/generation/pipeline.ts` | Integrate critique, leakage guard, difficulty targeting, and synthetic validation as conditional stages |
| `src/lib/ai/generation/prompts/item-critique.ts` | New file — critique prompt builder and response parser |
| `src/lib/ai/generation/prompts/synthetic-respondent.ts` | New file — persona generation and response simulation prompts |
| `src/lib/ai/generation/leakage-guard.ts` | New file — centroid computation, similarity checking, incremental updates |
| `src/lib/ai/generation/difficulty-targeting.ts` | New file — embedding distance calculation, gap analysis, prompt steering |
| `src/lib/ai/generation/synthetic-validation.ts` | New file — persona generation, response simulation, psychometric analysis |
| `src/app/(dashboard)/generate/new/page.tsx` | Pipeline options toggle UI in Step 3 |
| `src/app/(dashboard)/generate/[runId]/page.tsx` | Review UI enhancements — critique verdicts, leakage scores, difficulty estimates, synthetic flags, funnel summary |
| `supabase/migrations/` | New migration: extend `ai_prompt_purpose` enum, seed critique and synthetic respondent prompts and model configs |

## What This Does NOT Change

- **Preflight readiness check** — unchanged, still runs before generation
- **EGA/UVA/bootEGA core algorithms** — unchanged, new stages are additive
- **Existing generation prompt (v5)** — unchanged, facet diversity is appended dynamically
- **Existing review UI** — enhanced with new columns, not replaced
