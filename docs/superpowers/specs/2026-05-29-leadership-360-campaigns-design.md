# Leadership 360 Campaigns — Design

**Status:** Draft / design exploration (no code yet)
**Date:** 2026-05-29
**Author:** Jason + Claude

---

## 1. Overview

Add multi-rater **360-degree feedback** to Trajectas. A 360 measures one
**subject** (a leader) as seen by themselves *and* by observers (manager,
peers, direct reports), using the **same constructs** worded from each
perspective, then reports the **self-vs-others gap** that drives
development.

This is delivered as a new **campaign type**, not a new product. An admin
who already knows how to run an assessment campaign runs a 360 the same
way — the type selector at creation changes who is invited and how results
aggregate.

### 1.1 Locked decisions

| Decision | Direction |
|---|---|
| **Foundation** | New campaign **kind** on the existing `campaigns` surface. Reuse the campaign container + the assessment runner (`participant_sessions` / `participant_responses` / `/assess/[token]`). Add a dedicated 360 relational layer (`campaign_raters`). **Copy** org-diagnostic's anonymity-RLS and immutable-snapshot *patterns* — do **not** attach to or extend `org_diagnostic_*`; that is a separate product. |
| **Subjects per campaign** | **One** subject per 360 campaign. No cohorts. The subject is a reused `campaign_participant`. |
| **Rater setup** | Subject **nominates** → manager/admin **approves** → invitations fire. |
| **Item wording** | Add `stem_observer` to `items`. Single observer wording for **all** rater types. AI backfill tool for existing items; generator emits both stems going forward. |
| **Purpose** | **Development-only.** 360 data never flows into appraisal / pay / promotion surfaces. Hard boundary in UI and data access. |
| **Approval** | Build **both** paths: admin/coach in-system approval **and** external tokenised manager approval (email → approval page). Campaign config selects which applies. |
| **Below-N policy** | **Suppress** categories with <3 raters. No merge fallback in v1. |
| **Norms** | None at this stage → v1 is **self-referential + gap-based**. |
| **Open-text comments** | **Out** for v1 (rating items only). |

### 1.1a Scope: admin-dashboard test bed first

For the initial build, **the entire 360 feature lives in the platform-admin
dashboard only** — no client- or partner-level surfaces, navigation, or
RLS exposure yet. This is a deliberate test bed so the flow can be
exercised end-to-end by platform admins before it is opened to clients
and partners. Concretely:

- 360 campaign creation, the Subject & Raters tab, rater approval, and
  the 360 report all render under admin routes / for `is_platform_admin()`
  only.
- Client/partner RLS `SELECT` policies on the new 360 tables are
  **deferred** — only the platform-admin policies ship initially (the
  subject/rater token paths still work via service-role, as they don't
  depend on client RLS).
- Opening to client/partner level is a later phase, layered on once the
  admin test bed is validated.

### 1.2 Non-goals (v1)

- Cohort 360s (many subjects in one campaign).
- Relationship-specific item wording (peer vs report see different text).
- Appraisal / evaluation use of 360 scores.
- External raters (customers, vendors) — schema leaves room, UI deferred.
- Automated coach/facilitator scheduling (we surface the *recommendation*).

### 1.3 Grounding in 360 standards

The design honours established 360 practice:

- **Rater categories:** self, manager (named/individual), peers, direct
  reports, optional "other." Self and manager are treated specially;
  peers and reports are **always aggregated**.
- **N≥3 anonymity rule:** a rater category's scores are **never shown**
  unless ≥3 raters in that category responded. Below threshold →
  suppress, or merge into a combined "Colleagues" bucket. Manager has no
  threshold (inherently identified, but still not shown per-item verbatim
  attributable).
- **Self vs observer wording:** self = first person ("I communicate
  clearly"), observer = third person ("This leader communicates
  clearly"), scoring the **same construct**.
- **Report leads with the gap** (Johari framing: blind spots / hidden
  strengths), not raw scores.
- **Development-only** positioning produces materially more behaviour
  change and keeps raters honest.

---

## 2. Data model

### 2.1 Reuse (no change)

- **`campaigns`** — container: title, slug, client, dates, branding,
  status, resume/progress flags. *Add* a `kind` column (§2.2).
- **`campaign_participants`** — the **subject** of a 360 is a single
  participant row, exactly as today. The subject takes the **self**
  version of the assessment through the normal flow.
- **`participant_sessions` / `participant_responses`** — the assessment
  **runner**. Every rater filling out the survey is "a session of
  responses against an assessment," same as a self-taker. We reuse the
  token flow, the `save_response_for_session` RPC, resume, timers,
  everything. (See §5 for how a rater's session is linked.)
- **`items` / `constructs` / `factors`** and the scoring pipeline
  (`POMP → construct → factor → dimension`).

### 2.2 `campaigns.kind`

```sql
CREATE TYPE campaign_kind AS ENUM ('self', 'leadership_360');
ALTER TABLE campaigns
  ADD COLUMN kind campaign_kind NOT NULL DEFAULT 'self';
```

`self` is the world that exists today (zero behaviour change).
`leadership_360` activates the 360 layer below.

### 2.3 `campaign_raters` (new)

The 360-specific relational layer. One row per invited rater of the
subject. Distinct from `campaign_participants` so we never pollute the
clean single-rater semantics of that table (no relationship, no
nomination state, no anonymity exception there).

```sql
CREATE TYPE rater_relationship AS ENUM (
  'self', 'manager', 'peer', 'direct_report', 'other'
);

CREATE TYPE rater_status AS ENUM (
  'nominated',   -- proposed by subject, awaiting approval
  'approved',    -- approved, not yet invited
  'declined',    -- approver rejected this nominee
  'invited',     -- invitation email sent
  'in_progress', -- started their survey
  'completed',   -- finished
  'withdrawn',
  'expired'
);

CREATE TABLE campaign_raters (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id        UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  -- the subject being rated; for a one-subject campaign this is the
  -- campaign's single participant. Denormalised for clarity + future cohorts.
  subject_participant_id UUID NOT NULL REFERENCES campaign_participants(id) ON DELETE CASCADE,

  relationship       rater_relationship NOT NULL,
  name               TEXT,
  email              CITEXT NOT NULL,

  -- token-based survey access, no auth (same primitive as participants)
  access_token       TEXT NOT NULL UNIQUE
                       DEFAULT encode(gen_random_bytes(32), 'hex'),

  -- the runner session this rater fills out (created on first open)
  session_id         UUID REFERENCES participant_sessions(id) ON DELETE SET NULL,

  status             rater_status NOT NULL DEFAULT 'nominated',
  nominated_by       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  approved_by        UUID REFERENCES profiles(id) ON DELETE SET NULL,
  nominated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at        TIMESTAMPTZ,
  invited_at         TIMESTAMPTZ,
  started_at         TIMESTAMPTZ,
  completed_at       TIMESTAMPTZ,

  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ,

  -- one rater per email per subject; lets the same person rate different
  -- subjects in different campaigns, but never twice for one subject
  CONSTRAINT campaign_raters_email_per_subject
    UNIQUE (subject_participant_id, email)
);
```

**Self handling:** the subject's *own* self-rating is the existing
`campaign_participant` session — we do **not** create a `self`
`campaign_raters` row for the subject's own response. The `'self'`
enum value exists only so aggregation/reporting can treat the subject's
self-session uniformly with the rater buckets. (Alternative considered:
model self as a rater row too, for a perfectly uniform pipeline. Rejected
for v1 — it duplicates the participant and complicates the existing
self-only flow. Revisit if it simplifies scoring.)

### 2.4 Items: observer variant

```sql
ALTER TABLE items
  ADD COLUMN stem_observer TEXT;  -- third-person; NULL ⇒ no observer variant yet

COMMENT ON COLUMN items.stem_observer IS
  'Observer/rater-perspective phrasing (third person). Self phrasing stays in stem.';
```

- Rendering branches: a rater session shows `stem_observer ?? stem`;
  a self session always shows `stem`.
- An item is **360-eligible** only when `stem_observer IS NOT NULL`.
  A 360 campaign warns at setup if any selected item lacks an observer
  variant, with a one-click "generate variants" action (§4).
- Scoring is unchanged — both stems measure the same `construct_id`.

### 2.5 360 snapshot (copy org-diag pattern)

Immutable aggregate produced when the 360 closes. We do **not** reuse
`org_diagnostic_profiles`; we add a parallel, campaign-scoped table.

```sql
CREATE TABLE campaign_360_snapshots (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id        UUID NOT NULL REFERENCES campaigns(id) ON DELETE RESTRICT,
  subject_participant_id UUID NOT NULL REFERENCES campaign_participants(id) ON DELETE RESTRICT,

  -- aggregate-only payload: per-construct/factor means by rater category,
  -- self-vs-others gaps, Johari quadrant assignments, suppressed-category
  -- flags. NEVER per-rater rows. Shape defined alongside scoring (§6).
  data               JSONB NOT NULL,

  rater_count        INT NOT NULL CHECK (rater_count >= 0),
  rater_count_by_category JSONB NOT NULL,  -- {"manager":1,"peer":4,"direct_report":5}

  generated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  generated_by       UUID REFERENCES profiles(id) ON DELETE SET NULL,

  CONSTRAINT campaign_360_snapshots_one_per_campaign UNIQUE (campaign_id)
);
```

Insert-only, one per campaign, hard-deleted only on an explicit reopen.

---

## 3. Campaign type & creation UX

- **New Campaign** → first step is a **type choice**: *Self-Assessment*
  or *360 Feedback*. The rest of the create form is shared (title,
  client, dates, branding).
- A 360 campaign's detail shell reuses the existing tabs, with the
  **Participants** tab replaced/augmented by a **Subject & Raters** tab:
  - **Subject** — pick / invite the one person being rated (a
    `campaign_participant`). They will take the self version.
  - **Raters** — nomination + approval table (§4).
- **Assessments** tab: same assessment-attach flow. Setup validates that
  attached assessments' items have `stem_observer` populated, surfacing
  a "generate observer variants" action otherwise.
- Campaign list shows a **kind badge** (Self / 360) and 360 rows show
  rater-coverage progress instead of single completion.

**Read on "one campaign, select one of each":** rejected by design. In a
360 the self-rating *is part of the 360* — the subject answers the same
constructs their observers do, and the self-vs-others gap is the product.
So the type is an exclusive fork: a *Self* campaign is today's flow; a
*360* campaign inherently bundles self + observers. We don't combine two
separate instruments in one campaign.

---

## 4. Item dual-wording pipeline

Goal: every item is usable for both self and 360 with minimal author
effort.

1. **Schema:** `items.stem_observer` (§2.4).
2. **Backfill tool** — an admin action (and/or one-off script) that, for
   a selected scope (construct / factor / whole library), calls the LLM
   to rewrite each `stem` into third-person observer phrasing and stores
   it in `stem_observer`. Output is **reviewable** before commit (shows
   `stem` ↔ proposed `stem_observer` side by side), so it's a
   psychometric artifact, not an invisible transform.
   - Reuses the generation infra in `src/lib/ai/generation/`. New prompt
     `prompts/observer-perspective.ts`: "Rewrite this self-report item as
     a third-person behavioural observation of a leader, preserving
     meaning, construct, and reverse-scoring direction. Keep it
     comparable in difficulty and length."
3. **Generator emits both going forward** — implemented (Phase 1) as a
   **post-pipeline step**, not threaded through the psychometric stages. The
   critique stage can *revise* a self stem mid-pipeline, so deriving the
   observer variant inside the pipeline would risk self/observer drift.
   Instead, once `runPipeline` returns and the self stems are final, a single
   batched call (`generateObserverStemsForCandidates`, reusing the observer
   prompt) writes `generated_items.stem_observer`, and `acceptItems` copies it
   to `items.stem_observer`. Best-effort: if the call fails, generation
   proceeds without observer wording and it can be backfilled later. Realises
   the "items get created as 360 items too, always usable for both" intent;
   on by default for the real (API-key) pipeline.
4. **Equivalence note:** observer wording is single (same text for
   manager/peer/report). Reverse-scoring flag, construct linkage,
   response format, and options are **shared** between perspectives —
   only the displayed stem differs.

---

## 5. Rater lifecycle: nominate → approve → invite → take

### 5.1 Nomination (subject)

- After the subject is set up, they receive a **nomination link**
  (token, same primitive). They add proposed raters: name, email,
  relationship. Rows inserted as `status='nominated'`,
  `nominated_by = subject`.
- Guidance enforced in UI per standards: encourage ≥3 peers, ≥3 direct
  reports, 1 manager; warn when a category will fall below the N≥3
  reporting threshold.

### 5.2 Approval (manager / admin) — both paths built in v1

Approver sees the nominated list, can approve/decline each (`approved` /
`declined`, `approved_by`, `approved_at`), add or remove nominees. This is
the anti-gaming gate from the standards (stops a subject stacking only
friendly raters). **Both** approver paths are in scope for v1:

- **Admin / coach approval (in-system):** the platform/coach admin
  approves from the campaign's Raters tab. Pure UI on an authenticated
  surface; no extra delivery channel. This is the lighter build.
- **Manager approval (external):** when the campaign designates a named
  manager who is *not* a platform user, approval happens via a
  **tokenised approval flow** — an `approval_request` email links the
  manager to a token-scoped approval page (same token primitive as
  raters, no login). They approve/decline/edit the nominee list there.
  This needs its own email type + a lightweight external approval page +
  RLS-bypassed token resolution scoped to that one campaign's nominees.

The campaign config chooses which approver applies (named manager →
external flow; otherwise admin/coach in-system). Build order: admin path
first (Phase 3a), manager external path second (Phase 3b).

### 5.3 Invitation

- On approval (or a bulk "send invites" action), each `approved` rater
  gets an email with `/(assess)/[access_token]`. `status → invited`,
  `invited_at` set. Reuses the email system; **new EmailTypes**:
  `rater_invite`, `rater_reminder`, `nomination_request`,
  `approval_request`.
- Reminders: standard cadence (invite + reminder at ~5 days + final near
  deadline), driven off `closes_at` and rater `status`.

### 5.4 Taking the survey (rater)

- Rater opens their token → resolves to a `campaign_rater` (service-role,
  bypasses RLS, same pattern as participant tokens).
- On first open we **create a `participant_session`** for the campaign's
  360 assessment, link it via `campaign_raters.session_id`, set
  `status → in_progress`. The runner renders `stem_observer` because the
  session is rater-owned.
- Responses flow through the existing `save_response_for_session` path.
  The RPC must be extended to **authorize rater tokens** (today it
  validates participant tokens) — accept either a `campaign_participant`
  or a `campaign_rater` token and bind the session accordingly.
- On submit: rater `status → completed`, `completed_at` set.

### 5.5 Integrity / anti-self-rating safeguards

Your "different IP" instinct — replaced with stronger, token-based
guarantees (IP is brittle: shared office networks, VPNs, mobile):

- **Distinct tokens per rater** — already the primitive; one token =
  one rater slot = one session. A token cannot be reused for another
  slot.
- **Subject ≠ rater email check** — block nominating the subject's own
  email as an observer; the subject's input is the self-session only.
- **Duplicate-rater guard** — `UNIQUE (subject_participant_id, email)`
  prevents one person occupying two slots for the same subject.
- **One submission per token** — session completion locks the rater row;
  reopening requires admin action.
- **(Optional, low-cost) telemetry** — record submission IP/user-agent on
  the session for *post-hoc anomaly review only* (e.g. all raters from
  one device), never as a hard block. Decision: include as advisory
  metadata, not enforcement.

---

## 6. Scoring & aggregation

Reuse the per-session pipeline (`POMP → construct → factor → dimension`)
to score **each** session (self and every rater) independently. Then add a
**360 aggregation layer**:

1. Group completed sessions by `relationship` (self / manager / peer /
   direct_report).
2. Per construct (and factor), compute the **mean POMP per category**.
3. **N≥3 suppression (locked):** if a category has <3 completed raters,
   **suppress** its per-category scores entirely (do not emit). No
   merge-into-"Colleagues" fallback in v1. Manager (typically N=1) is
   shown as its own named category but never decomposed to attributable
   per-item detail.
4. **Self-vs-others gap:** `self − mean(all non-self observers)` per
   construct/factor, plus **Johari quadrant** assignment:
   - *Open* (high self, high other), *Hidden/Overrated* (high self, low
     other → potential derailer), *Blind spot* (low self, high other →
     unrecognised strength), *Unknown* (low both).
5. **Highest/lowest behaviours** across all observers.
6. Persist the aggregate-only result into `campaign_360_snapshots.data`
   on close (immutable). Per-rater scores live in their sessions but are
   **never exposed to the subject**.

**Norms (locked):** no leadership norms exist at this stage, so v1 is
**self-referential + gap-based** — scores are interpreted against the
subject's own self-rating and against the other-rater aggregate, not
against an external norm group. Normative comparison is a later addition
if/when norms are built.

---

## 7. Reporting

A dedicated 360 report (extends the existing report builder/renderer):

- **Summary table** — per construct/factor: self, manager, peer (agg),
  direct report (agg) side by side, with suppressed categories greyed.
- **Gap view** — self-vs-others, sorted to surface blind spots and
  hidden strengths first (Johari framing). This **leads** the report.
- **Highest / lowest** behaviours.
- **Rater coverage** — counts by category (e.g. "Peers: 4 of 5"),
  aggregate only.
- **Development framing** — explicit "for development, not appraisal"
  language; recommend a coach debrief before/with the report.
- **Verbatim comments** (if open-text items added later) — anonymised,
  bucketed by category, never attributable.

---

## 8. Anonymity & security (copy org-diag RLS pattern)

- **Subject can never identify their raters or see individual rater
  scores.** Enforced at the RLS layer: the subject's access path (their
  participant token, and any authenticated client view) has **no SELECT**
  on `campaign_raters` individual rows or on other raters' sessions.
  Only the **aggregate snapshot** is visible to the subject.
- **Raters cannot see each other.**
- **Platform admin / coach** can see the rater roster and per-rater
  completion (for chasing responses and validation) — but the
  development-only boundary means these scores never surface in any
  appraisal/evaluation view.
- **Token access** for raters runs service-role (bypasses RLS) scoped to
  the single resolved rater, exactly like participant tokens.
- New `SECURITY DEFINER` functions (e.g. rater token resolution, the
  extended save RPC) must **revoke EXECUTE from `anon`/`authenticated`**
  in a follow-up migration, and run `get_advisors` after DDL (per repo
  migration flow).

---

## 9. Build sequence (phased)

**Phase 1 — Items dual-wording (independent, low risk) — ✅ DONE (branch
`feat/leadership-360-phase1`)**
- ✅ `items.stem_observer` + `generated_items.stem_observer` migration
  (`20260529120000_items_observer_stem.sql`); `Item.stemObserver` type;
  mapper exposes it.
- ✅ Observer-perspective prompt (`prompts/observer-perspective.ts`) + parser
  with unit tests.
- ✅ Backfill tool: server actions (`actions/observer-variants.ts`) + shared
  reviewable dialog, wired as a bulk action on `/items` **and** a per-construct
  batch button (both surfaces).
- ✅ Editable `stem_observer` field + 360-ready indicator on the item editor
  (auto-save, construct items only).
- ✅ Generator emits observer wording (post-pipeline step; copied on accept).
- ⏳ Deferred to Phase 3 (no consumer yet): runner rendering of the observer
  stem for rater sessions — there are no rater sessions until then.

**Phase 2 — 360 campaign skeleton**
- `campaign_kind` enum + column; type selector at creation; kind badge in
  list; conditional detail shell.
- `campaign_raters` table + RLS (anonymity). Subject = single
  participant reuse.

**Phase 3a — Rater lifecycle (admin approval)**
- Nomination link + screen; approval table with **admin/coach in-system
  approval**; invite + reminder emails (new EmailTypes
  `nomination_request`, `rater_invite`, `rater_reminder`).
- Extend token resolution + `save_response_for_session` to accept rater
  tokens; create/link rater sessions; render observer stems.
- Integrity safeguards (§5.5).

**Phase 3b — Manager approval (external)**
- `approval_request` email + tokenised external approval page +
  RLS-bypassed token resolution scoped to the campaign's nominees.
- Campaign config to designate a named manager and route approval.

**Phase 4 — Scoring, snapshot, report**
- 360 aggregation layer (per-category means, N≥3 suppression, gap,
  Johari).
- `campaign_360_snapshots` on close (+ reopen handling).
- 360 report template (gap-led).

**Phase 5 — Polish**
- Coverage dashboard, reminder cadence automation, rater-guidance
  warnings, coach-debrief framing, advisory submission telemetry.

---

## 10. Resolved decisions & remaining risks

**Resolved (2026-05-29):**

1. **Approver identity** — build **both** admin in-system approval and
   external tokenised manager approval (§5.2). Campaign config selects
   the applicable path.
2. **Minimum-N policy** — **suppress** below 3; no merge fallback (§6).
3. **Norms** — none yet; v1 self-referential + gap-based (§6).
4. **Open-text comments** — **out** for v1; rating items only.
5. **Legacy `diagnostic_*` tables — verified against live schema
   (local).** Findings: the `diagnostic_*` set is an **org-profiling-for-
   matching** feature, *not* a leadership 360. `diagnostic_sessions`
   profiles a *client/org* (has `client_id`, `template_id`, `name` — no
   subject person); `diagnostic_respondents` has
   `role_title`/`department`/`seniority_level`/`weight` but **no
   relationship field** (no manager/peer/report); the set is wired into
   `matching_runs` (candidate-matching engine) and all tables are
   **empty (0 rows)**. The earlier exploration claim of a
   `relationship` enum was incorrect. **Conclusion: nothing to harvest;
   build the 360 layer fresh as specced.** Note the three distinct
   concepts to keep naming clear: `diagnostic_*` (org-profile-for-
   matching), `org_diagnostic_*` (newer org-diagnostic product), and the
   `campaign` 360 (this design).

**Remaining open:**

- **Self modelled as a rater row vs reused participant** — current plan
  reuses the participant (no `self` rater row). Revisit only if it
  complicates aggregation more than it saves.
