# Report Block Design Review

Feedback collected block-by-block from the builder preview.
Once complete, this becomes the execution plan.

---

## Cover Page

- [ ] **Logo toggle not working** — "Show logo" toggle doesn't affect the preview. Investigate why.
- [ ] **Headers render above the featured card** — Eyebrow/heading/description sit on top of the coloured card section instead of inside it (or not at all). Fix positioning.
- [ ] **Card too big** — The featured card takes up too much vertical space. Shrink it down.
- [ ] **Add data pulls** — Cover page should support showing: assessment name, campaign name, and report name (currently only has campaignTitle and participantName).
- [ ] **Remove headers panel for cover page** — Cover page doesn't need eyebrow/heading/description since it has its own content fields.

---

## Custom Text

- [ ] **Content not editable** — Changing the heading/content fields in the builder doesn't update the preview. Hard-coded sample copy ("About This Assessment…") always shows instead of user-entered text.
- [ ] **Eyebrow/heading/description sit above the card** — Same issue as cover page. Headers need to render inside the block's presentation mode wrapper, not above it.
- [ ] **Add featured mode** — Currently only supports `open` and `inset`. Add `featured` as a supported presentation mode.

---

## Score Overview

### Functionality
- [ ] **Display level selector doesn't work** — Changing between dimension/factor/construct doesn't filter the entities shown. All entity types appear mixed together (dimensions, competencies, factors, constructs).
- [ ] **Entity selection doesn't work** — Selecting specific entities in the config has no effect on the preview.
- [ ] **Show score toggle** — Works, but score appears at the end of the entity name text, squishing it. Score should sit at the far right end of the bar instead.
- [ ] **Show band label toggle** — Doesn't show the actual band label (e.g. "Highly Proficient", "Developing"). Only shows "low", "mid", "high" text at the bottom of bars.
- [ ] **Group by dimension toggle** — Not working.
- [ ] **Headers sit above card** — Same systemic issue.

### Bar Chart
- [ ] **Remove dots at end of score bars** — The circle markers at the scoring point don't sit correctly and look off. Remove them.
- [ ] **Band colours need to be neutral** — Current colours use branding. Replace with a set of neutral but clearly distinguishable indicator colours (low/mid/high) that work regardless of brand theme.
- [ ] **Score position** — Move score value to the far right of the bar row so entity names don't get squished.

### Radar Chart
- [ ] **Labels cut off** — Entity name labels are clipped by the container. Needs more padding or overflow handling.
- [ ] **Show score / show band label / group by dimension** — None of these toggles work on radar chart.

### Gauges
- [ ] **Show score toggle not working**
- [ ] **Show band label toggle not working**
- [ ] **Group by dimension toggle not working** (may be N/A for gauges — TBD)

### Scorecard
- [ ] **Not rendering at all** — Scorecard chart type produces no output. Needs investigation.

---

## Score Detail

- [ ] **Display level selector not working** — Same issue as score overview; doesn't filter entities by type.
- [ ] **Entity selector not working** — Selecting specific entities has no effect on preview.
- [ ] **Duplicate chart type selector** — One on the content panel and one on the presentation panel. Remove the duplicate — only need one.
- [ ] **Lock chart type to segment** — Segment is the correct view for this block. Remove the chart type selector entirely; always use segment. Shows title, band label, score, and a bar per entity. User controls visibility via show score / show band label / show bar toggles.
- [ ] **Behavioural indicators not working** — "Show indicators" toggle has no visible effect.
- [ ] **Nested scores** — Keep this toggle. Shows child entity scores under each parent (e.g. factors under a dimension). Will work once display level / entity selection is fixed. Sample data needs to support parent-child hierarchy.
- [ ] **Headers sit above card** — Same systemic issue.

---

## Strengths Highlights

- [ ] **Inconsistent rendering across modes** — Featured mode shows numbers differently from open and carded modes. Needs to be consistent.
- [ ] **Remove scores and band labels entirely** — Strengths are already known to be strengths; showing "Highly Proficient" labels and scores is redundant. Strip them from all modes.
- [ ] **Column selector doesn't work** — Changing column count doesn't reflow the cards.
- [ ] **Headers sit above card** — Same systemic issue.

---

## Development Plan

- [ ] **Headers sit above card** — Same systemic issue. Otherwise design is acceptable.

---

## Section Divider

- [ ] **Thick rule too short** — Only spans a small portion of the page width. Should be full width.
- [ ] **Thick rule colour is off** — Showing a weird colour. Should default to light grey, or allow user to pick a colour for thick rule.
- [ ] **Simplify config** — Section divider doesn't need the headers panel or presentation mode selector. Remove those tabs/options for this block type.

---

## AI Text

- [ ] **Headers sit above card** — Same systemic issue.
- [ ] Otherwise featured and inset modes look fine.

---

## Global Issues

- [ ] **Drag-and-drop order not reflected in preview** — Reordering blocks in the builder doesn't update the order in the live preview.
- [ ] **Inset accent should be configurable on all blocks that support inset mode** — Add inset accent colour picker to every block type that has `inset` as a supported presentation mode.

### Recurring theme: Header positioning

**Headers (eyebrow/heading/description) render above the ModeWrapper for all blocks.** They need to be pushed inside the mode wrapper so they appear within the card/featured/inset styling, not floating above it. This likely applies to every block — will verify as we go.
