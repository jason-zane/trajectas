# Trajectory & Compare — one page, chart on top, breakdown below

Status: Draft v4 (2026-06-13). Iterations: v1 three-lens canvas (too shallow
for 30-factor reality) → v2 ledger-of-arrows (too complex at 5 people; demoted
the chart) → v3 Profile/Trend views + six orthogonal controls (right structure,
too much jargon and choice) → **v4: same structure, designed for the
lowest-common-denominator user.** Companion specs:
`2026-05-12-trajectory-design.md`, `2026-04-27-participant-comparison-design.md`.

Mockups (open in a browser):
- Full page: `docs/superpowers/mockups/2026-06-13-trajectory-page.html`
- PDF report: `docs/superpowers/mockups/2026-06-13-growth-report-pdf.html`

## Problem

Six setups must be served — {one person, two people, group} × {snapshot, over
time} — across a two-layer taxonomy (5–6 dimensions, ~30 factors), for users
who are not data analysts. v3 solved the structural problem (a chart stays
readable only when one axis of the people × competencies × time cube collapses
into a control) but exposed too much of the machinery: Profile-vs-Trend,
Fit-vs-0–100, Taxonomy/Change/Spread, and an ambiguous snapshot-with-tails
state all required expertise to parse.

Implementation weaknesses carried forward (unchanged): picker-first landing;
ordinal axis documented as temporal (`trajectory-timeline.tsx:16` vs `:313`);
CI columns stored but never drawn; norms in schema, never on screen; no
Trajectory export; email-based `isLongitudinal`; per-campaign-participant
attempt ordinals; dead `'construct'` toggle
(`comparison-selection-bar.tsx:88`).

## Goal

One page that any client user can read without instruction; the same page for
all six setups; everything exportable. Design test: a first-time user must be
able to answer "who's growing, on what?" within ten seconds of landing,
without touching a control.

## The v4 simplifications

1. **No view toggle.** The page always shows both representations, linked:
   the **hero chart** on top (time expanded) and the **breakdown list** below
   (competencies expanded). Chart-people read the top; bar-people read the
   bottom. Clicking any row charts it — so the big graph is never more than
   one click away and never has to be "found" behind a drill.
2. **Three controls, plain words.**
   - **People** — chips. 1 person = Trajectory; 2+ = Compare. 9+ → table.
   - **Show change** — one switch, captioned "since first assessment ·
     Sep 2025" (the caption *is* the window picker's collapsed form; expanding
     it offers other start points). Off = dots only, dated. On = each dot
     grows a tail plus a signed chip. This kills the snapshot/baseline
     ambiguity: dots always mean *now*; change is explicit and labelled.
   - **Order** — dropdown: "Standard order · Largest change · Biggest
     differences."
3. **No scale toggle.** The hero auto-fits its y-axis with labelled ticks;
   the breakdown list is always 0–100 so position is absolute. (PDF defaults
   to the same.) The "why is the range small" complaint dissolves because the
   only zoomed surface is explicitly labelled.
4. **Plain-language tokens** (vocabulary contract for UI and reports):
   | Internal | On screen |
   |---|---|
   | norm band P25–P75 | "Typical range" (shaded) |
   | delta / Δ | "Change" / "+12 since Sep 2025" |
   | spread (max−min) | "Everyone sits between 60 and 78" |
   | \|Δ\| < noise threshold | grey chip, "within measurement noise" (report methodology) |
   | dimension / factor | kept — domain words clients already use |
   | frozen snapshot | "figures will not change as new results arrive" |
5. **Layer drill stays, but chart-first.** Clicking a dimension row does two
   things at once: charts it in the hero *and* opens its factor rows beneath
   it. Clicking a factor row charts the factor. One gesture, no breadcrumb
   needed on the happy path (breadcrumb appears only in the hero card's
   overline).

## Page anatomy (see page mockup)

1. Eyebrow + title ("Comparing five candidates" / person's name) + actions
   (Save view · Export ▾ with CSV and PDF report).
2. People chips.
3. Controls strip: Show change switch · Order dropdown.
4. **Hero card**: overline names the charted competency; one-sentence plain
   lede ("Priya Sharma has risen the most on Relating (+27 since September).
   Amara Okafor remains highest."); the chart (monotone curves, dots, end
   labels with name + now + change, "Typical range" band, real dated x-axis,
   campaign marker); a caption stating scale, period, and norm group in words.
5. **Breakdown card**: header hint ("Click any row to chart it"); Overall row;
   dimension rows, selected one open with its factor rows; each row = name ·
   0–100 track (typical range shaded, one dot per person *now*, faint tail
   when Show change is on) · plain summary ("Biggest change Priya +27 ·
   Everyone sits between 59 and 78").
6. Footer line: identity matching, per-person date variance, client name.

### Hero content rule

- 2+ people → lines are people, for the selected competency (Overall default).
- 1 person → lines are the children of the selected node (dimensions for
  Overall; factors for a dimension; single line + SEM ribbon for a factor).
- Single-session data → hero collapses to a profile header (no fake trend);
  Show change hidden.

Line budget ≤8, guaranteed by the collapse rule, never truncation.

## The six setups, one page

| Setup | What differs |
|---|---|
| 1 person, snapshot | hero = profile header; list dots only |
| 1 person, over time | hero = dimension lines (today's Trajectory) |
| 2 people, snapshot | list dumbbells; hero available once 2+ sessions exist |
| 2 people, over time | hero = two lines on selected competency |
| group 3–8, snapshot | list dot strips; summaries in words |
| group 3–8, over time | hero = N lines on selected competency |
| 9+ people | table view (existing comparison matrix) |

## PDF report (see report mockup)

Generated from a frozen `comparison_snapshots.rendered_data` via the existing
report pipeline; the on-screen ledes are the executive summary. Structure:

1. **Cover** — emerald band, "Growth report", client, candidate legend,
   period, norm group with n, generated date + frozen-snapshot sentence,
   confidentiality footer.
2. **Executive summary** — lede paragraph, numbered key findings (3), Overall
   chart, Overall table (baseline / now / change per candidate).
3. **The five dimensions** — per dimension: print-form track (dots + tails) +
   one-line narrative ("Biggest change … · highest today …").
4. **In depth, one page per dimension** — trend chart + factor table
   (now + change per person) + methodology box (typical range definition,
   change reading, noise threshold, identity matching, per-person dates).

CSV mirrors the breakdown list: rows = competencies (rollups flagged),
per-person columns first/now/change/per-session values/dates.

## Data model & data layer

Unchanged from v3: person_key longitudinality + per-person attempt ordinals;
`comparisons` JSONB gains `people`, `charted`, `show_change`, `since`,
`order`, `open_dimension`; Phase 4 adds `comparison_snapshots`;
`getTrajectories({ personKeys, level: 'both' })` return-shape change;
populate percentile + CI fields; norm resolution per assessment; pure helpers
for window resolution, summaries, ordering.

## Phases

- **Phase 0 — fixes:** dead construct toggle; person_key `isLongitudinal`;
  per-person attempt ordinals; temporal-axis docstring; audit logging for
  saved-comparison mutations.
- **Phase 1 — the page, on Compare:** breakdown list + three controls + hero
  using the current timeline component as a stopgap; table view one toggle
  away.
- **Phase 2 — hero chart proper:** temporal axis, monotone curves, SEM
  ribbons, typical-range band, markers, draw-in; row-click → chart wiring.
- **Phase 3 — one page, two doors:** Trajectory route renders the same page
  with one person; handoffs; saved views; retire trajectory-movers, the level
  toggle, and email-longitudinal.
- **Phase 4 — exports:** CSV with change columns; `comparison_snapshots`; PDF
  growth report per the mockup.
- **Phase 5 — rigor:** RCI from reliability replaces the noise heuristic;
  per-assessment SEM; cohort_label; norm versioning design.

## Risks

- **Vertical cost.** Hero + breakdown is a tall page; the hero must collapse
  on scroll (sticky mini-header with the charted competency) and on small
  viewports.
- **Tails hide dips** (dip-and-recover ≈ small net change) — mitigated by
  one-click chart per row; change metrics consider all session pairs.
- **Auto-fit hero can exaggerate** — labelled ticks always; PDF chart axes
  include the typical range for anchoring.
- **Word-summaries must be generated, not canned** — "Everyone sits between X
  and Y" style sentences need a tested generator with degenerate-case handling
  (one person, ties, missing sessions).
- **Per-person windows differ** — captions state dates; never silently align
  session indices across people.
- **Mixed assessment bases per factor** — row badge + methodology note.
- **Control creep is the failure mode this design exists to prevent.** Any
  proposed fourth control needs a written case for why a default can't do it.
