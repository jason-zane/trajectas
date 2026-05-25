# Taxonomy Unification — Deferred Follow-ups

**Created:** 2026-05-25
**Owner:** Jason Hunt (with Claude)
**Related:**
- [`2026-05-25-taxonomy-unification-design.md`](./2026-05-25-taxonomy-unification-design.md)
- [`2026-05-24-ai-assessment-creator-design.md`](./2026-05-24-ai-assessment-creator-design.md)

Open work left after the taxonomy unification (PRs #182–#188) and the legacy-content archive (PR #190) shipped. Nothing here is blocking; each item is parked deliberately. Picking any of them up should be a fresh small PR — none depends on the others.

---

## 1. Drop `_taxonomy_unification_backup` table

**What it is:** JSONB snapshot of every row removed during the Phase 3 unification — `dimension_constructs`, `assessment_constructs`, `campaign_assessment_constructs`, construct-mode `participant_scores`, and construct-mode `assessments` rows. 536 rows total.

**Why parked:** Kept as a safety net for ~30 days in case a regression surfaces and we need to reconstruct the pre-migration state.

**When safe to drop:** Roughly **2026-06-25** (30 days post-migration), provided no regressions surfaced. The data is informational at this point — it isn't joined to anything live.

**How:**

```sql
DROP TABLE _taxonomy_unification_backup;
```

Apply as a migration named e.g. `20260625120000_drop_taxonomy_unification_backup.sql`.

---

## 2. Drop `_legacy_library_backup` table

**What it is:** JSONB snapshot of everything archived in PR #190 (legacy non-brain dimensions and their factors/links/scores). 601 rows total — 11 dimensions, 36 factors, 40 `factor_constructs` links, 514 `participant_scores`.

**Why parked:** Same safety-net reasoning — the soft-deleted rows are still in their own tables (with `deleted_at` set), this table is the explicit JSON archive in case we want to bulk-restore or audit later.

**When safe to drop:** Roughly **2026-06-25** (30 days post-archive), if no one has asked to restore any of the legacy content. The soft-deleted rows in `dimensions` / `factors` / `factor_constructs` are still recoverable independently via `restoreFactor` / `restoreDimension` server actions, so this table is genuinely redundant once you trust the archive.

**How:**

```sql
DROP TABLE _legacy_library_backup;
```

---

## 3. Partner UI parity for "Duplicate as parent factor"

**What's missing:** The button shipped to the admin construct edit page in PR #182 has no equivalent in the partner portal — because **the partner portal has no construct-authoring surface at all today**.

**Why parked:** Building the duplicate button is trivial (it's `src/app/(dashboard)/constructs/construct-form.tsx` adapted to partner routes), but it has nothing to attach to until the partner construct authoring flow exists. That's a larger design question — partners may need a different scoping model than platform admins (client-scoped library contributions, review/approval workflow, etc.).

**When to pick this up:** When the first partner needs to author constructs in their own workflow, or when we explicitly decide partner-side authoring is part of the next product surface.

**Where to start:**

- Look at `src/app/partner/` to see the existing partner surface — there's no `constructs/` subdirectory yet
- The admin construct form (`src/app/(dashboard)/constructs/construct-form.tsx`) is the reference. Most of it (rich-text fields, indicators tab, source picker, lock toggle, duplicate-as-factor button) can be reused; what needs design is the **client/partner scoping** — `constructs` has a nullable `client_id`-style column already? Verify before designing.
- The duplicate-as-factor server action (`duplicateConstructAsFactor` in `src/app/actions/constructs.ts`) is generic — it already supports being called from any UI as long as the caller has admin scope. Confirm whether partner admins should also get to call it (probably yes if they're authoring their own library), and whether the resulting factor should be partner-scoped.

---

## 4. `items_per_construct` restoration note (already done — context only)

**Not actually a follow-up — included so future contributors don't get confused.**

The `items_per_construct` column on `item_selection_rules` was mistakenly dropped in Phase 3b (`20260525140000_taxonomy_unification_drop_construct_path.sql`) along with the dual-path-mode-specific `total_construct_min` / `total_construct_max`. It was re-added in `20260525150000_restore_items_per_construct.sql` because it's actually the algorithm's per-leaf-entity config, not a dual-path artifact.

If you ever revisit those two migrations, treat them as a pair. Don't try to merge `restore_items_per_construct.sql` into `drop_construct_path.sql` — leaving it as a separate migration preserves the historical record of what happened.

---

## 5. Empty placeholder dimensions — final disposition

PR #190 archived these (soft-deleted) because they had no factors and weren't being used:

- Cognitive Ability
- Emotional Intelligence
- Interpersonal Skills
- Leadership

**Why parked as a follow-up:** They're soft-deleted, not hard-deleted, in case any of them turn out to be intentional placeholders for future builds. The names suggest they might be — for example, "Cognitive Ability" matches a planned new assessment family per [`2026-05-05-cognitive-ability-assessment-design.md`](./2026-05-05-cognitive-ability-assessment-design.md).

**When to revisit:** When you decide whether any of these are going to be populated. Either:
- **Keep archived** if they're truly dead. Hard-delete in a small follow-up: `DELETE FROM dimensions WHERE name IN (...) AND deleted_at IS NOT NULL;`
- **Restore** if you intend to populate them: `UPDATE dimensions SET deleted_at = NULL, is_active = true WHERE name = '...';`

---

## 6. Composite factors — when to introduce them

**Context:** Every live factor today is a 1:1 wrapper (a factor with exactly one child construct, composition-locked). The unified data model fully supports composite factors (multiple constructs under one factor with weights), but we haven't created any yet — the migration only generated wrappers.

**Why parked:** Composite factors are a content decision, not a data-model decision. They're the right answer when:
- Two or more constructs reliably correlate and the factor-level score is more interpretable than the individual constructs (classic psychometric factor)
- An assessment should report at a higher level of abstraction than its measured constructs

**When to pick this up:** When a real assessment-design conversation calls for it. Mechanics are already in place:
- Author creates a new factor (not locked by default)
- Authors links 2+ constructs to it via the existing factor-constructs UI
- After first respondent completes, the factor auto-locks (or admin manually locks)

No code work needed — purely an authoring task in the admin UI.

---

## 7. Item bank vs on-demand generation (cross-references AI Assessment Creator)

The AI Assessment Creator design ([`2026-05-24-ai-assessment-creator-design.md`](./2026-05-24-ai-assessment-creator-design.md)) flagged this as an open question: when the wizard finalises a factor selection, do we generate fresh items per construct, pull from existing pools, or hybrid?

**Why parked here:** The taxonomy unification doesn't force this decision, but it does make it cleaner — items always belong to a construct, every construct has a wrapper factor, so any item-selection strategy can operate at either layer.

**When to revisit:** As part of the AI Assessment Creator build, not before.

---

## Tracking

If you pick any of these up:
- Open a discrete PR per item, not a combined cleanup
- Cross-link back to this doc in the PR description
- Once shipped, strike through the item here and add the PR number rather than removing it — the history is useful

This doc lives at `docs/superpowers/specs/2026-05-25-taxonomy-followups.md` and is searchable by name from the specs directory.
