# Schema drift: `supabase/migrations` vs the live database

**Audited 2026-08-16** against project `rwpfwfcaxoevnvtkdmkx`, comparing a
from-scratch replay of all 230 migrations (`scripts/pg-migrate-check.sh --fresh`)
against the live schema.

## Why this exists

Three divergences surfaced one at a time while building the cognitive item
bank, each discovered by something breaking:

1. `item_media` and `item_scoring_rubrics` — a policy migration failed in
   production because the tables it altered were absent (guarded in
   `20260813101000`).
2. `response_format_type` had no `'cognitive'` value in production, despite
   `00005_foundation_alignment.sql:38` containing
   `ALTER TYPE … ADD VALUE IF NOT EXISTS 'cognitive'` (fixed by
   `20260815060000`).

Finding these by tripping over them is the problem. **`pg-migrate-check.sh`
reporting 230/230 does not prove production matches** — it proves the files
replay cleanly against an empty database, which is a different claim. This is
the first deliberate comparison.

## Findings

### 1. Three tables exist in the migrations but NOT in production

| Table | Created by |
|---|---|
| `item_media` | 3 migrations reference it |
| `item_scoring_rubrics` | 3 migrations reference it |
| `diagnostic_factor_hints` | 1 migration references it |

**Impact today: none.** No application code references any of the three
(`grep -r` over `src/` returns zero hits for each). They are reachable only
from migration files.

**Impact tomorrow: production-only breakage.** A fresh environment built from
migrations has these tables; production does not. The first feature to use one
works locally, passes CI, and fails in production — with `pg-migrate-check`
still reporting green, because it never looks at production.

**Recommended:** a reconciliation migration creating all three with
`IF NOT EXISTS`, replaying the original DDL and RLS verbatim. Low risk (nothing
reads them), and it removes a trap. Not done here because it is unrelated to
the work in flight and deserves its own review.

### 2. `competency_categories` exists in production but not in the migrations

Migration `00008_naming_refactor.sql` renamed `competency_categories` →
`library_categories`. Production has **both**: `library_categories` with 5 rows
(live, correct) and `competency_categories` with **0 rows** (orphan).

The orphan is not free-standing — it still has one inbound foreign key:

```
factors.category_id  ->  competency_categories   (competencies_category_id_fkey)
```

**This looked like a blocker and is not.** `factors` carries three category
columns, and only the dead one points at the orphan:

| Column | References | Populated |
|---|---|---|
| `category_id` | `competency_categories` (orphan, empty) | 0 of 71 |
| `primary_category_id` | `library_categories` | in use |
| `secondary_category_id` | `library_categories` | in use |

`assessmentReadyChecks` (`src/lib/library/factor-completeness.ts:37`) gates on
`primaryCategoryId`, not `category_id`, and 25 of 71 factors are already
`assessment_ready` — so factor promotion demonstrably works. `category_id` is
legacy cruft whose FK was never repointed or dropped.

**Recommended:** drop `factors.category_id` and then the orphan table, in that
order, in a migration of its own. Deliberately **not** done here: dropping a
column and a table in production is destructive, it is unrelated to the
cognitive work, and an empty table harms nothing while it waits for a proper
review.

### 3. Not drift — noise the comparison surfaces

- **pgcrypto functions** (`crypt`, `gen_salt`, `pgp_*`, `digest`, …) appear in
  the replay's `public` schema and not in production's. Supabase installs
  pgcrypto into the `extensions` schema; the local replay puts it in `public`.
  Same functions, different schema. Ignore.
- **`rls_auto_enable`** exists in production only. A Supabase-side helper, not
  something the migrations own.

## How to re-run this

```sh
scripts/pg-migrate-check.sh --fresh --keep-running
```

Then compare the replay against production. Tables, enums and functions are
the cheap high-signal comparison:

```sql
-- run against BOTH, diff the results
SELECT table_name FROM information_schema.tables
 WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY 1;

SELECT t.typname||':'||string_agg(e.enumlabel, ',' ORDER BY e.enumsortorder)
  FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid
  JOIN pg_namespace n ON n.oid=t.typnamespace
 WHERE n.nspname='public' GROUP BY t.typname ORDER BY 1;

SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' ORDER BY 1;
```

Enums matched exactly at this audit — worth keeping in the comparison, since
the `'cognitive'` divergence was an enum and cost the most time to find.

Column-level drift within a shared table is **not** covered by the above and is
the obvious next thing to check if something inexplicable happens again.
