# Trajectory — Longitudinal participant scoring across campaigns

## Problem

A participant in Trajectas exists today as one row in `campaign_participants`, scoped to a single campaign by `UNIQUE(campaign_id, email)`. When the same person is invited to a later campaign — three weeks, six months, a year later — they get a fresh row, with no link back to their earlier results. There is no way today to look at one human's scoring trajectory across the assessments they've taken over time.

The existing **Compare** feature (`participants/compare/`) is structurally orthogonal to this: it puts *different participants* side-by-side on a shared set of assessments. It does not — and cannot, without modification — show *one participant across many sessions over time*.

## Goal

Let an admin / client_admin / partner_admin view, for any participant, the same human's scoring over time across every assessment they have completed within the client. Default to plotting `scaled_score` per construct, with toggles to factor and dimension level. Reuse the existing comparison rollup and matrix infrastructure where possible.

## Non-goals

Out of scope for this spec:

- **Reliable Change Index, norm-group rescoring, practice-effect statistical handling.** Trajectas's reliability and norms data is not yet hardened enough to support these honestly. The data model and UI leave room to add them later without migration; raw delta display is what ships.
- **Cross-client identity.** People are scoped to a single client; the same email under two different clients represents two different people, by design.
- **Org Diagnostic respondents.** `org_diagnostic_respondents` is anonymity-protected by design. Trajectory will never surface those sessions.
- **HRIS / external-system identifiers.** No external_ref field; no SSO subject mapping. Email is the only identity signal.
- **A separate `persons` table.** A participant *is* a person; we group them with a single column on `campaign_participants` rather than building a parallel identity layer.
- **Trajectory-specific AI report generation.** A future spec.

## Concept

Every `campaign_participants` row gets a `person_key` (UUID). When two rows share a `person_key`, they refer to the same human. By default, on insert, the trigger auto-shares a `person_key` with any existing row that has the same email within the same client; otherwise a new UUID is generated. Admins can manually merge (set two `person_key`s to the same value) or split (re-randomise one row's `person_key`).

The Trajectory view for any participant walks `person_key` to find all the participant rows referring to the same human, joins through `participant_sessions` (completed only) to `participant_scores`, and plots the resulting points over time per construct (default), factor, or dimension.

This deliberately does *not* introduce a `persons` table. The simplest correct model — "these N rows are the same human" — is a grouping column. A separate identity table would buy person-level attributes we don't need yet (display_name comes from the most recent row, consent is opt-out by default, no external_ref, no auth-based candidate-only sessions in active use).

## Entry points

- **Participant detail page**: new tab **Trajectory** in 5th position on `/participants/[id]`, between Sessions and Reports. Mirrored to `/client/participants/[id]/trajectory` and `/partner/participants/[id]/trajectory`.
- **Standalone Trajectory page** (Phase 5): `/participants/trajectory` (and the client / partner mirrors), with a person picker. Out of scope for the initial build; included in this spec only enough to reserve the route name and confirm the data layer is reusable.

## Naming

- **Trajectory** — fits the brand (Trajectas), implies movement and direction, distinct from "Compare" (which is taken by the cross-participant view) and "Sessions" (which is the within-this-campaign-participant view).

## Data model

### New column on `campaign_participants`

```sql
ALTER TABLE campaign_participants
  ADD COLUMN person_key UUID NOT NULL DEFAULT gen_random_uuid();

CREATE INDEX idx_campaign_participants_person_key
  ON campaign_participants(person_key);

COMMENT ON COLUMN campaign_participants.person_key IS
  'Stable identifier grouping rows that refer to the same human within a client. Default is unique; auto-populated to match an existing row when (client_id, email) matches at insert time. Manually merged/split by admin actions.';
```

That single column is the entire identity-grouping schema. There is no `persons` table, no `person_identifiers`, no `person_links`, no review queue.

### Auto-link trigger

Fires `BEFORE INSERT` on `campaign_participants`:

```sql
CREATE OR REPLACE FUNCTION campaign_participants_auto_link_person()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_client_id UUID;
  v_existing_key UUID;
BEGIN
  -- Resolve client_id for the new row's campaign
  SELECT client_id INTO v_client_id
  FROM campaigns
  WHERE id = NEW.campaign_id;

  IF v_client_id IS NULL THEN
    RETURN NEW;  -- campaign has no client (shouldn't happen in practice); leave default
  END IF;

  -- Look for an existing participant with the same email under the same client
  SELECT cp.person_key INTO v_existing_key
  FROM campaign_participants cp
  JOIN campaigns c ON c.id = cp.campaign_id
  WHERE c.client_id = v_client_id
    AND cp.email = NEW.email
    AND cp.id <> NEW.id
  ORDER BY cp.created_at ASC
  LIMIT 1;

  IF v_existing_key IS NOT NULL THEN
    NEW.person_key := v_existing_key;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER campaign_participants_auto_link_person_trg
  BEFORE INSERT ON campaign_participants
  FOR EACH ROW EXECUTE FUNCTION campaign_participants_auto_link_person();
```

Notes:

- Only matches within the same client (privacy boundary).
- Email match is exact (CITEXT — case-insensitive equality).
- Ties (multiple existing rows) take the earliest by `created_at`; in practice they will all already share the same `person_key`.
- The default UUID stays in place when no match is found, so a new person is auto-created with zero work.

### Audit table

Merge and split operations leave an audit trail:

```sql
CREATE TABLE person_link_audit (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id         UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  action            TEXT NOT NULL CHECK (action IN ('merge','split')),
  source_person_key UUID NOT NULL,
  target_person_key UUID NOT NULL,
  affected_participant_ids UUID[] NOT NULL,
  performed_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  performed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason            TEXT
);

CREATE INDEX idx_person_link_audit_client ON person_link_audit(client_id, performed_at DESC);
```

### Row Level Security

`campaign_participants.person_key` requires no new RLS — the existing `campaign_participants_select` policy (`00070:413-426`) already gates row visibility on `campaigns.client_id ∈ auth_user_client_ids()`, which transparently covers admin, client_admin, and partner_admin. Same applies to `participant_sessions` and `participant_scores` for the trajectory query — their existing policies are correct.

`person_link_audit` gets the same `client_id ∈ auth_user_client_ids()` pattern:

```sql
ALTER TABLE person_link_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY person_link_audit_select ON person_link_audit
  FOR SELECT TO authenticated USING (
    is_platform_admin()
    OR client_id = ANY(auth_user_client_ids())
  );

CREATE POLICY person_link_audit_insert ON person_link_audit
  FOR INSERT TO authenticated WITH CHECK (
    is_platform_admin()
    OR client_id = ANY(auth_user_client_admin_ids())
  );
```

No UPDATE/DELETE policies — audit rows are immutable from the application.

## Data layer

### New server actions in `src/app/actions/trajectory.ts`

```ts
'use server'

export type TrajectoryLevel = 'dimension' | 'factor' | 'construct'

export type TrajectoryPoint = {
  sessionId: string
  campaignId: string
  campaignTitle: string
  assessmentId: string
  assessmentName: string
  completedAt: string
  attemptNumber: number
  rawScore: number | null
  scaledScore: number | null
  percentile: number | null
  validityFlag: string | null
  // Reserved fields, populated when reliability/norm work lands later:
  reliability: number | null
  normGroupId: string | null
  normGroupName: string | null
}

export type TrajectoryDelta = {
  fromSessionId: string
  toSessionId: string
  deltaScaled: number | null
  daysBetween: number
}

export type TrajectorySeries = {
  entityId: string
  entityName: string
  level: TrajectoryLevel
  parentId: string | null
  points: TrajectoryPoint[]
  deltas: TrajectoryDelta[]      // consecutive pairs + first-to-latest as last element
}

export type LinkedParticipant = {
  campaignParticipantId: string
  campaignId: string
  campaignTitle: string
  email: string
  firstName: string | null
  lastName: string | null
  status: string
  completedSessionCount: number
  createdAt: string
}

export type TrajectoryResult = {
  personKey: string
  displayName: string
  primaryEmail: string
  linkedParticipants: LinkedParticipant[]
  series: TrajectorySeries[]
  assessmentsTouched: { assessmentId: string; assessmentName: string }[]
}

export async function getPersonTrajectory(
  campaignParticipantId: string,
  options: {
    level: TrajectoryLevel
    assessmentIds?: string[]
    dateRange?: { from: string; to: string }
  },
): Promise<TrajectoryResult>

export async function searchPersons(
  query: string,
): Promise<{ campaignParticipantId: string; personKey: string; displayName: string; email: string; lastActivityAt: string | null }[]>

export async function linkParticipantsToSamePerson(
  sourceCampaignParticipantIds: string[],
  targetCampaignParticipantId: string,
  reason?: string,
): Promise<{ targetPersonKey: string; mergedCount: number }>

export async function unlinkParticipant(
  campaignParticipantId: string,
  reason?: string,
): Promise<{ newPersonKey: string }>

export async function getLinkedParticipants(
  campaignParticipantId: string,
): Promise<LinkedParticipant[]>
```

### `getPersonTrajectory` implementation

1. **Authorize** via `requireParticipantAccess(campaignParticipantId)` (existing helper in `src/lib/auth/authorization.ts`). RLS does the rest of the security work.
2. Resolve `person_key` and `client_id` from the given participant.
3. Load all `campaign_participants` rows sharing the `person_key`. (RLS already scopes to the client.)
4. Load all `participant_sessions` for those participants where `status = 'completed'`.
5. Load all `participant_scores` for those sessions.
6. Load taxonomy: `dimensions`, `factors`, `constructs`, and the relevant join tables (`dimension_constructs`, `factor_constructs`, `assessment_constructs`, `assessment_factors`) — only the entities touched by the loaded scores.
7. **Rollup** to the requested level using `src/lib/comparison/rollup-scores.ts` (extracted in Phase 2 to be reusable). Rollup is computed at query time; we accept the cost in exchange for not having to materialise and invalidate a projection table.
   - When `level = 'construct'`: pass through scores where `scoring_level = 'construct'`; for `scoring_level = 'factor'` sessions, the entity is unavailable at construct level (no down-rollup is meaningful) — those points simply don't appear in construct-level series.
   - When `level = 'factor'`: pass through scores where `scoring_level = 'factor'`; for `scoring_level = 'construct'` sessions, roll up the constructs into their factor parents.
   - When `level = 'dimension'`: roll up to dimension regardless of source scoring level, via either `factor_constructs → factors → factor` parents or `dimension_constructs` direct mapping.
8. **Group** by `entity_id`, sort by `completed_at` ASC, compute `attemptNumber` per (assessment, person) using the same logic as `src/lib/comparison/session-resolution.ts:computeAttemptOrdinals`.
9. **Deltas**: for each series, compute consecutive pairwise `Δ scaled_score` and `daysBetween`. Append a first-to-latest delta as the final entry (skipped when only one point exists).
10. Assemble and return `TrajectoryResult`.

### Auto-link audit

`linkParticipantsToSamePerson` and `unlinkParticipant` write to `person_link_audit` inside the same transaction as the `UPDATE`. Both require `is_platform_admin() OR client_id = ANY(auth_user_client_admin_ids())` — non-admin members of a client cannot merge or split.

## Workspace structure

### Tab on `/participants/[id]`

New tab `Trajectory`, position 5 (between Sessions and Reports). The tab is composed of:

#### Person header

- Display name + primary email (from the canonical `campaign_participants` row — the most recent one).
- Chip: *"N campaigns · M completed sessions · {earliest_completed_date} → {latest_completed_date}"*.
- **Linked records** affordance: small "{N} records linked" button → opens drawer listing all `campaign_participants` with this `person_key`, with per-row "Unlink" actions and a "Merge another participant in" action that opens a search picker (`searchPersons`).

#### Controls bar

- **Level toggle**: chips `Dimension · Factor · Construct`. Default `Dimension`.
- **Assessment filter**: multi-select chip list, default = all assessments the person has touched. *"Show only entities present in 2+ sessions"* toggle.
- **Date range**: range slider over the `completedAt` distribution. Default = full range.

#### Primary view — small-multiples chart grid

- One small line chart per entity at the selected level.
- X axis: `completedAt` (categorical-ordinal time — points are typically months apart; we don't waste pixels on linear-time gaps).
- Y axis: `scaledScore`. Y-axis range derived per entity from observed values with a small padding; no band overlay in v1 (band scheme requires norms to be meaningful).
- Points: filled circles, coloured by magnitude of `Δ scaled` from the prior point: small (grey), medium (amber), large (blue). Magnitude bins are pragmatic, not psychometric — to be tuned during build.
- Hover point: tooltip with assessment, attempt #, completion date, scaled score, percentile if present.
- Click chart: opens drill modal.
- Sort dropdown: alphabetical · biggest first-to-latest delta · most recent change · most stable.

#### Matrix view (toggle)

- Renders the same data via the extracted `<ScoreMatrix>` (Phase 2).
- Rows = entities at the selected level.
- Columns = sessions ordered by `completedAt` ascending (left = oldest, right = newest).
- Cells = `scaledScore`, no band colouring in v1.
- Trailing column: first-to-latest `Δ scaled` with arrow icon.

#### Drill modal

Opens from chart click or matrix row click. Contents:

- Full-size line chart of the entity.
- Full points table: session, assessment, date, attempt, scaled, percentile, validity.
- Deltas table: every pairwise delta with daysBetween.
- **Drivers** (only at Dimension / Factor level): which child entities contributed most to the first-to-latest change. Computed by sorting children by `|Δ scaled|`.
- Direct links to each underlying session detail page.

#### Empty and edge states

- 0 completed sessions: *"No completed sessions for this person yet."*
- 1 completed session: snapshot view + banner *"Trajectory becomes meaningful with 2+ completed sessions."*
- All sessions flagged invalid: hide charts; show banner with link to validity explainer.
- Repeat of the same assessment within 6 months: soft note on affected points: *"Re-tested same assessment within 6 months."* No statistical claim.

## Standalone Trajectory page (Phase 5, reserved)

`/participants/trajectory` (mirrored to `/client/participants/trajectory` and `/partner/participants/trajectory`).

- Person picker: search by name / email; results from `searchPersons` are persons in the user's accessible clients.
- Selecting a person → renders the same Trajectory body as the tab, in a standalone page layout with shareable URL parameters.

Component composition: the Trajectory tab and the Trajectory page share a single `<TrajectoryWorkspace>` component that takes the resolved `TrajectoryResult` and controls state as props.

## Routes and components

### Routes

```
src/app/(dashboard)/participants/[id]/trajectory/page.tsx
src/app/(dashboard)/participants/trajectory/page.tsx              (Phase 5)

src/app/client/participants/[id]/trajectory/page.tsx
src/app/client/participants/trajectory/page.tsx                   (Phase 5)

src/app/partner/participants/[id]/trajectory/page.tsx
src/app/partner/participants/trajectory/page.tsx                  (Phase 5)
```

Each tenant route delegates to `<TrajectoryWorkspace tenantContext={...} />` — the same pattern used by `participants/compare`.

### Components

```
src/components/trajectory/trajectory-workspace.tsx        # top-level
src/components/trajectory/trajectory-person-header.tsx
src/components/trajectory/trajectory-controls.tsx
src/components/trajectory/trajectory-charts.tsx           # small-multiples grid
src/components/trajectory/trajectory-chart-card.tsx       # one chart per entity
src/components/trajectory/trajectory-matrix.tsx           # uses <ScoreMatrix>
src/components/trajectory/trajectory-drill-modal.tsx
src/components/trajectory/trajectory-linked-records-drawer.tsx
src/components/trajectory/trajectory-empty-states.tsx
```

### Shared infrastructure refactors

```
src/components/results/score-matrix.tsx                   # extracted from comparison-matrix.tsx
src/lib/comparison/rollup-scores.ts                       # unchanged, reused
```

The `<ScoreMatrix>` extraction takes the row/column rendering, hover, sticky-row, and overflow handling from the current `comparison-matrix.tsx` and makes it generic over the row and column key types. Both Compare and Trajectory mount the same component with different data shapes.

## State and URL

Tab state is stored in the URL where it would aid sharing:

- `level=dimension|factor|construct` (default `dimension`)
- `assessments=<csv of assessment ids>` (default: all touched)
- `from=YYYY-MM-DD` / `to=YYYY-MM-DD` (default: full)
- `view=charts|matrix` (default `charts`)

`src/lib/trajectory/url-params.ts` encodes/decodes these — modelled on `src/lib/comparison/url-params.ts`. No deep linking into drill modals.

## Authorization

- All server actions begin with `requireParticipantAccess(campaignParticipantId)`.
- RLS on `campaign_participants`, `participant_sessions`, `participant_scores` already enforces tenant scope through `auth_user_client_ids()` — this transparently covers platform_admin, partner_admin (via partner-owned clients), and client members.
- `linkParticipantsToSamePerson` and `unlinkParticipant` additionally require `is_platform_admin() OR auth_user_client_admin_ids() contains the client_id of the affected participants`. Non-admins cannot mutate identity grouping.
- Cross-client merge attempts (the two participants belong to different clients) fail with a clear error. The auto-link trigger never crosses clients; manual merge enforces the same boundary.

## CSV export

Reuses `escapeCell` and `isoDate` from `src/lib/comparison/build-csv.ts`. New `src/lib/trajectory/build-csv.ts` produces long-format rows:

| column | source |
|---|---|
| Display name | most recent linked participant |
| Email | most recent linked participant |
| Campaign | session's campaign title |
| Assessment | session's assessment title |
| Completed at | `participant_sessions.completed_at` |
| Attempt # | computed via `computeAttemptOrdinals` |
| Level | `dimension` / `factor` / `construct` |
| Entity | taxonomy name |
| Scaled | `participant_scores.scaled_score` |
| Raw | `participant_scores.raw_score` |
| Percentile | `participant_scores.percentile` |
| Validity | `participant_sessions.validity_flag` if present |

One row per (session, level, entity). The current level toggle filters the export to the visible rows; "Export all levels" option produces the full set.

## Loading states

- Tab mount: skeleton chart grid + skeleton header. Aim for one server action round trip.
- Level toggle: optimistic UI; refetch in background only if the rollup isn't cacheable client-side.
- Drill modal: opens immediately with already-loaded data; no additional fetch needed.

## Testing

- **Migration** (Phase 1) tested via `npm run test:integration:local`:
  - Auto-link trigger creates new `person_key` when no email match.
  - Auto-link trigger reuses `person_key` when email matches within client.
  - Auto-link trigger does NOT match across clients.
  - Manual merge updates all source rows' `person_key`.
  - Manual split assigns a fresh `person_key`.
  - Audit rows are written for merge and split.
- **Rollup correctness** (Phase 3): pure-function tests of the trajectory rollup logic covering each cross-level case (factor-scored session at construct view, etc.).
- **Attempt ordinals**: reuse and extend the existing tests for `computeAttemptOrdinals`.
- **Trajectory data shape**: a fixtured-DB integration test seeding two campaigns, three sessions per person, and asserting the returned `TrajectorySeries` matches expected per-entity arrays.
- **RLS**: an integration test that two clients with the same email cannot see each other's persons.

## Rollout

Phasing — each phase is independently shippable and reviewable.

### Phase 1 — `person_key` foundation
- Single migration: column, index, trigger, audit table, RLS.
- Server actions: `searchPersons`, `linkParticipantsToSamePerson`, `unlinkParticipant`, `getLinkedParticipants`.
- Integration tests.
- No UI yet.

### Phase 2 — `<ScoreMatrix>` extraction
- Pure refactor of `src/components/comparison/comparison-matrix.tsx` into `src/components/results/score-matrix.tsx`.
- Migrate the existing Compare workspace to use it; ensure no visual regression.
- Independently mergeable, zero behaviour change for users.

### Phase 3 — Trajectory tab (Shape A)
- Server action `getPersonTrajectory`.
- New tab on `/participants/[id]`.
- `<TrajectoryWorkspace>` with charts, matrix toggle, drill modal, controls.
- Mirror to `/client` and `/partner` trees.
- CSV export.

### Phase 4 — Link-management UX
- "{N} records linked" affordance on the person header.
- Drawer with merge / unlink actions.
- Audit log visible to admins.

### Phase 5 — Standalone Trajectory page (Shape B)
- `/participants/trajectory` route in all three tenant trees.
- Person picker.
- Shareable URLs.

Phases 1–3 are MVP. Phases 4–5 are independently shippable.

## Risks and known limits

- **Auto-link false positives.** If two genuinely different humans within one client share an email (e.g. a shared inbox, a typo), they'll be auto-merged. Mitigated by visible "Linked records" affordance and per-row unlink. Watch unlink rate after launch.
- **Validity-flagged sessions.** Sessions flagged as invalid (careless responding, etc.) still appear in trajectory with a visual flag. Filtering them out by default risks hiding real signal; surfacing them with the flag preserves judgement.
- **Scaled-score comparability.** `scaled_score` is comparable within an assessment's calibration. Across two assessments measuring the same construct, scaled scores live on the same conceptual scale only when the constructs share calibration history. The UI does not currently warn about this; we accept the tradeoff for v1 simplicity, and the future RCI / norms work is where this becomes rigorous.
- **Adaptive item selection.** Two sessions on the same construct may rest on different items. The construct score is calibrated to be comparable on the latent trait; we trust the calibration. Documented honestly in the drill modal helper text.
- **Practice effects on short retest intervals.** Surfaced as a soft note on affected points; no statistical correction applied. Future work.
- **Construct / factor / dimension taxonomy changes over time.** A rename is benign (we query by ID). A re-parenting (e.g. moving a construct from one factor to another) causes the same construct to roll up differently for old vs. new sessions when queried at factor or dimension level. Phase 3 builds the rollup live, so the *current* parent applies to all points uniformly — preferable to mixed parentage but means historical trajectories at factor/dimension level can shift if the taxonomy is restructured. Materialising the rollup at scoring time would fix this; left as future work since taxonomy changes are rare.

## Out of scope (deferred)

- Reliable Change Index, norm-group regime handling, percentile / sten as primary plotted values. The `TrajectoryPoint` shape reserves `reliability`, `normGroupId`, and `normGroupName` so they can be populated later without a model change.
- Trajectory-specific AI-generated reports.
- Cross-client identity / merge across clients.
- Materialised `trajectory_score_points` projection. Live query is fine until measured otherwise.
- Person-level attributes table (`display_name`, consent, external_ref). Display name comes from the most recent linked participant; consent is opt-out by default with no UI surface in v1; external_ref isn't supported.
- Bulk identity import. Each `campaign_participants` row gets linked at insert time; no batch endpoint.
- Cross-tenant person discovery for platform_admin. A platform admin who wants to see the same human across multiple clients today must cross-reference manually.
