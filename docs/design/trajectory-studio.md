# Trajectory studio: three reviewable experiences

The studio provides three interactive directions in the existing Trajectas app. The original Compare and Trajectory routes remain available while these options are evaluated.

## Open the review

- Compare: `http://127.0.0.1:3012/preview/trajectory?experience=compare`
- Individual Trajectory: `http://127.0.0.1:3012/preview/trajectory?experience=individual`
- Unified Trajectory: `http://127.0.0.1:3012/preview/trajectory?experience=unified`
- Authenticated admin workspace: `/participants/studio`, also accessible under Insights → Trajectory studio.

The review uses fictional people, roles, campaigns, assessment structures, and results. The authenticated route uses existing permission-checked search and canvas actions. No database migrations or production data changes are part of this work.

## The three directions

| Experience | Core question | Setup | Main representation |
| --- | --- | --- | --- |
| Compare | How do these people differ? | Select people, campaign scope, assessment, and date window. | Dimension/factor dot profiles; a score matrix can include multiple assessments in separate sections. |
| Individual Trajectory | What has changed for this person? | Choose one person, an assessment, and a baseline window. | Scores against actual completion dates, observed change, factor drill-down, and individual assessment moments. |
| Unified Trajectory | What do I need to understand about this group? | The same selection and context, with a Snapshot / Over time switch. | A snapshot profile or dated progress chart, preserving people, assessment, campaign, dates, and focused measure when changing lenses. |

The unified version is the recommended direction to explore for the eventual single **Trajectory** product. The lens is explicit: selecting several people does not silently change the question or presentation. The separate experiences remain useful references for checking whether either workflow becomes harder inside the combined interface.

## Suggested review

1. Start in Compare with four employees. Click a dimension, then a factor. Inspect an individual result and its exact campaign, date, and attempt.
2. Open the matrix and select **Compare across all assessments**. Notice that Workplace styles keeps its own measures, has no invented overall score, and leaves James's missing results empty.
3. Filter the people list to candidates. Selected employees remain selected until removed; Clear starts a new selection. Up to eight people can be inspected together.
4. In Individual Trajectory, open Priya. Her repeated results include an intermediate dip, rather than a straight interpolation between baseline and latest.
5. Change the focus to a factor, enable stored score intervals in Settings, and open a plotted point. Choose a later baseline to see the observation window and change recalculate.
6. In Unified Trajectory, select a measure and switch between Snapshot and Over time. The selection and measurement context stay intact.
7. Save a view, change the selection, then reopen it. Export a CSV or print/save a PDF; optionally replace participant names with numbered labels.
8. Check the mobile layout, collapse the people panel, and try the studio's separate light/dark theme.

## Measurement and selection rules

- Snapshot resolves **one latest completed attempt per person per assessment inside the inclusive date window**. All measures come from that attempt. A missing factor is never silently filled from an older attempt.
- Over time includes the completed observations for the selected assessment and campaign scope. Dates use UTC and a real time axis. There is no future extrapolation.
- Change is a difference in score points from the first measured result in the window. Missing observations stay missing; one observation does not imply change.
- The scale stays 0–100. Scores are not labelled percentiles, and no normative bands or statistical significance are invented.
- Stored score intervals can be shown where the existing data includes them. Composites and rollups without intervals do not receive synthetic intervals.
- Assessments remain separate by assessment ID, including in the multi-assessment matrix and exports. There is no cross-instrument overall score.
- Identity uses the existing linked person key. Same-name participants remain separate, including in reports.
- CSV contains source, view, window, person, assessment, measure, measure type, numeric score, exact completion date, campaign, attempt, session ID, baseline, numeric change, and available interval bounds. Text is escaped against spreadsheet formulas.
- The PDF includes the focused chart, source/scope, reading notes, and dated results for all measures in scope. Its contents are fixed when printed. Numbered participant labels omit names and session IDs; campaign metadata remains.

## Implementation boundaries

- The authenticated route is additive and currently lives in the admin dashboard. It uses `searchWorkspaceParticipants` and `getComparisonCanvas`, including their existing access checks and person-linking rules. No credentials or production fixture data are embedded in the preview.
- The live workspace still needs a manual check with a signed-in account and the normal Supabase configuration. The local preview intentionally uses placeholders; the shared dashboard bootstrap requires the service-role configuration and cannot run with those placeholders. Automated browser review exercises the fictional preview; it does not claim to verify production data or authentication.
- Existing canvas requests allow eight entries. The studio enforces that limit visibly. A large-cohort aggregate view would be a separate design and data task.
- Employee/candidate role metadata is demonstrated in the preview. The current live search DTO does not expose those classifications; live selection uses campaign, name/email, and completed-assessment information instead of guessing a person's type.
- Saved views store configuration on this device, not result scores. They are not the existing team-shared saved-comparison service. Live saved selections are validated against the currently loaded group. Loading a new group starts a fresh analysis.
- PDF export uses the browser print/save dialog. It is not integrated into the existing server-generated snapshot/report delivery pipeline.
- No new norm selection, instrument equivalence, assessment version migration, effect-size inference, or reliable-change calculation is claimed. Those require explicit scoring/data contracts before broader release.

## Code and verification

Validation completed: TypeScript and ESLint passed; 17 focused unit/architecture checks and 13 end-to-end browser checks passed. The rendered sample PDF was inspected for chart, headers, pagination, and identity labels. Desktop, dark mode, and a 390px mobile viewport were checked.

- `src/components/trajectory-studio/`: shared workspace, people selection, charts, matrix, exports, live picker, loading state, and scoped styling.
- `src/lib/trajectory-studio/model.ts`: deterministic scope, attempt resolution, measure hierarchy, exports, and saved-state validation.
- `src/lib/trajectory-studio/demo.ts`: isolated fictional review dataset. Not imported by the authenticated route.
- `tests/unit/trajectory-studio/model.test.ts`: scope boundaries, missing measurements, no-composite instruments, identity, exports, and saved-state checks.
- `scripts/testing/check-trajectory-studio.mjs`: local-only browser verification and screenshots using installed Puppeteer and a separate headless Chrome session.

Run the local preview with the normal Next development command on a free port. The review itself does not need a signed-in user or a production database. This work was reviewed on port 3012 with local-only placeholder Supabase configuration.

```sh
node node_modules/typescript/bin/tsc --pretty false --noEmit --incremental false
node node_modules/vitest/vitest.mjs run tests/unit/trajectory-studio/model.test.ts tests/architecture/no-db-in-components.test.ts
node node_modules/eslint/bin/eslint.js src/components/trajectory-studio src/lib/trajectory-studio src/app/preview/trajectory 'src/app/(dashboard)/participants/studio' tests/unit/trajectory-studio scripts/testing/check-trajectory-studio.mjs --max-warnings=0
node scripts/testing/check-trajectory-studio.mjs
```

The browser check accepts `STUDIO_URL` for another loopback port and `CHROME_PATH` for a different Chrome installation. Screenshots, the sample PDF, CSV, and browser check results are written under `output/trajectory-studio/` and are not committed.

Before adopting the unified version, decide whether its people panel should default open, which comparison window should be the default for each campaign type, and whether saved views should be private or shared. Those choices can be made from these working experiences rather than from static mockups.
