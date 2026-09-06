# Trajectory studio: three reviewable experiences

The studio provides three interactive directions in the existing Trajectas app. The second iteration keeps Snapshot / Over time as the shared structure and changes the analysis around the user's review: explicit campaign results, selected-group means, and multiple measures for an individual.

## Open the review

- Compare: `http://127.0.0.1:3012/preview/trajectory?experience=compare`
- Individual Trajectory: `http://127.0.0.1:3012/preview/trajectory?experience=individual`
- Unified Trajectory: `http://127.0.0.1:3012/preview/trajectory?experience=unified`

## Production access

| Portal | Compare | Individual Trajectory | Unified Trajectory |
| --- | --- | --- | --- |
| Admin | `/participants/compare` | `/participants/trajectory` | `/participants/unified` |
| Partner | `/partner/participants/compare` | `/partner/participants/trajectory` | `/partner/participants/unified` |
| Client | `/client/participants/compare` | `/client/participants/trajectory` | Unavailable |

Each route fixes its experience on the server and checks the existing portal authorization before loading results. Unified has no client route; the shared entry point also rejects that combination. URL mode parameters cannot change a fixed experience. Live saved views are isolated by client and experience. `/participants/studio` redirects through the admin gate to Unified. Existing saved comparisons and URLs with explicit assessment/session configuration retain their original workspace.

Production shows workspace data and portal navigation. Live analysis inherits WorkspaceShell spacing and theme, uses the shared PageHeader and Button components, and has no nested main landmark or independent theme control. Long assessment names wrap, and the participant picker keeps its search controls and Load action fixed while the results scroll. The fictional design preview is disabled in production; the three review URLs remain available locally.

The preview contains fictional people, roles, campaigns, assessment structures, results and reference values. The authenticated route uses the existing permission-checked participant search and canvas actions. No database migrations or production data changes are included.

## What changed after review

| Decision | Resulting behaviour |
| --- | --- |
| A snapshot is a chosen campaign result. | Each person has an explicit assessment attempt. Choose results can apply a campaign to everyone or set each person's campaign and attempt individually. |
| People and scores should connect immediately. | Named horizontal bars show scores and reference differences without hovering. A gold marker identifies the reference. Clicking a bar opens that exact result. |
| The selected group is a useful reference. | A mean is calculated separately for every measure, from the available selected results. Its sample size is shown. Difference view gives the bars a shared, symmetric zero baseline. |
| One person's story spans several measures. | A single selected person starts with up to five dimensions together. Choose up to six dimensions, factors or an overall score. A summary gives first, latest, change and reference comparisons. |
| Several people need one focused measure. | Each person gets one line on the selected measure. Unified Trajectory switches to measure lines when only one person remains, while preserving snapshot and history settings. |
| Detail must add information. | The snapshot measure selector switches between the dimension overview and a dimension's actual factors. The duplicate lower drill-down was removed. The matrix uses plain hierarchical labels. |
| Controls should have a clear purpose. | The people-type dropdown and generic Settings dialog were removed. Campaign result selection belongs to Snapshot; dates and history campaign scope belong to Over time. |
| Dates belong with provenance. | Snapshot cells contain scores and differences. The result selector and report source headers contain campaign, date and attempt details. |

The unified version remains the direction to evaluate for the eventual single **Trajectory** product. The two separate experiences stay available as working references for the user’s decision.

## Suggested review

1. Open Compare. The four selected people's overall scores are 77, 82, 74 and 71; their mean is 76. Each dimension has its own mean.
2. Switch **Scores / Difference**. Names remain attached to every value; zero becomes the selected reference in Difference view. Every visible comparison panel uses the same symmetric difference scale.
3. Open **Choose results**. Apply the 2025 development campaign, then choose Priya's earlier attempt. The plotted scores, group means and exports update together. A campaign with no completed result leaves that person empty.
4. Choose **Self-management · factors**. Sofia's missing Self-awareness score stays missing, and the reference sample falls to three people for that factor.
5. Open the matrix and enable **Include all assessments**. Workplace styles retains its own measures, has no invented overall score, and keeps James's absent result empty.
6. Open Individual Trajectory. Five dimensions appear on one dated chart. Open **Measures on this chart** to show factors, remove a measure, or use Overall only. Stored intervals become available when the plotted data actually contains them.
7. Choose **People leaders · example norm**, then **Difference**. Every measure is compared with its own fixed reference value; zero has the same meaning across all lines. The sample size and version are visible. The example programme target demonstrates a goal rather than a population expectation.
8. In Unified Trajectory, switch to Over time and adjust the dates. Switch back to Snapshot: its chosen campaign results are preserved. Remove people until one remains to see several measures for that individual.
9. Save a view, change the selection, then reopen it. Export CSV or print/save PDF, with optional numbered participant labels. Check desktop, dark mode and mobile layouts.

## Measurement and selection rules

- Snapshot pins a **session ID per stable person key and assessment ID**. It starts with the latest available completed result, then retains the selected attempt. History date or campaign changes do not rescope it. A removed or invalid session never silently falls back to another result.
- Every snapshot measure comes from the same selected attempt. Missing measures are never filled from older attempts, and missing is never represented as zero.
- A group mean includes each selected person once, including the person being compared. It requires at least two measured scores. Sample sizes vary by measure. This small selected group is not described as a normative population.
- History uses inclusive UTC dates and the actual time between completed assessments. The first measured point within that range is the baseline for each measure. Change is latest minus first in score points. One observation does not imply change.
- Absolute scores use the fixed 0–100 axis. Difference charts use a labelled symmetric scale around zero. Reference values remain fixed across the entire history; there is no changing-membership cohort line or historic percentile recalculation.
- A single person can show up to six measures. Multiple people show one measure. Colours follow identities, with distinct visible series. Dates and source detail are available through chart points and the assessment history disclosure.
- Stored score intervals appear only when supplied. Rollups do not receive synthetic intervals. No significant change, expected improvement, or causal interpretation is inferred.
- Assessments remain separate by assessment ID in charts, mean calculations, snapshots, saved views and exports. Preference scores do not receive an invented overall performance total.
- Same-name people remain separate by stable identity. Saved sessions are validated against that person and assessment, and saved dates must be real calendar dates.

## Norms and targets: what is implemented

The view accepts a reference contract containing assessment ID, measure-level score values, score scale, version, provenance and, for norms, a valid per-measure sample size. Incompatible assessments, unversioned references and invalid values are unavailable. A missing reference for a factor remains missing.

The preview supplies two explicitly fictional examples: a people-leader norm with n=240 and a programme target. The target has no factor values, so it also demonstrates partial reference coverage. Illustrative references cannot appear in a live dataset.

The repository has `NormGroup` / `NormTable` records and an admin norm metadata action. The current `CanvasResult` feed does not include compatible measure-level norm values, scale provenance or reference versions. The old June design note also predates later version-provenance migrations, so its claim that score rows lack norm IDs is no longer a sufficient implementation guide.

This change does **not** query the admin norm catalogue or assume its construct values match the canvas's dimension/factor/composite scale. The live view supports selected-group means now. A live norm/target adapter must establish assessment and measure mapping, exact scale, immutable version and tenant access before supplying references. Until then, the interface states that no compatible norm or target has been supplied.

## Export and persistence

CSV includes every measured dimension and factor in scope: score, exact completion date, campaign, attempt, session ID, history baseline/change, stored interval, reference value, sample size, version/basis and difference from reference. Text is protected against spreadsheet formula interpretation. Snapshot exports have no history date window.

PDF includes the displayed chart and a full results appendix. Snapshot provenance appears once in the person's assessment header rather than in every score row. Headers repeat when a table spans pages. Time reports retain dated observations, selected measure lines and reference provenance. Anonymous reports replace names, including the report title, and omit session IDs; campaign metadata remains.

Saved views are private to this browser, keyed by workspace and a versioned configuration format. They retain people, assessment, explicit snapshot results, history range, chosen measures and reference. They do not store scores or publish a team view. Loading a new live group starts a new analysis. Earlier prototype configurations are isolated under the previous storage version because they used different snapshot semantics.

## Implementation boundaries

- The authenticated route is additive in the admin dashboard, using `searchWorkspaceParticipants` and `getComparisonCanvas`, their authorization checks and existing person linking. There are no database clients in studio components.
- A signed-in manual check with the normal Supabase configuration remains necessary for live data. The local preview uses dummy local configuration; the shared dashboard bootstrap cannot run with those placeholders. Browser verification covers the fictional preview, not production authentication or data.
- Existing canvas requests allow eight people. Large-cohort aggregation is outside this interface.
- PDF uses the browser's print/save dialog, rather than server report delivery. No publishing, deployment, PR or merge is included.

## Code and verification

Verified: TypeScript and ESLint passed, 28 unit/architecture checks passed, and 17 browser flow checks passed. Final targeted visual checks confirmed the dark dialog surface and all four timeline-summary columns at 390px. Comparison and trajectory PDFs were rendered and inspected.

- `src/components/trajectory-studio/`: workspace, result selection, named comparison bars, timeline, matrix, exports and live picker.
- `src/lib/trajectory-studio/model.ts`: deterministic selection, measure hierarchy, reference calculations, exports and saved-state validation.
- `src/lib/trajectory-studio/demo.ts`: isolated fictional dataset and example references; never imported by the authenticated route.
- `tests/unit/trajectory-studio/model.test.ts`: identity, assessment and campaign boundaries, missing measures, group means, fixed references, multi-measure semantics and exports.
- `scripts/testing/check-trajectory-studio.mjs`: local browser interaction checks and screenshots using Puppeteer and a separate headless Chrome profile. Each run uses a new download directory.

```sh
node node_modules/typescript/bin/tsc --pretty false --noEmit --incremental false
node node_modules/vitest/vitest.mjs run tests/unit/trajectory-studio/model.test.ts tests/architecture/no-db-in-components.test.ts tests/architecture/tenant-scope-predicates.test.ts
node node_modules/eslint/bin/eslint.js src/components/trajectory-studio src/lib/trajectory-studio src/app/preview/trajectory 'src/app/(dashboard)/participants/studio' tests/unit/trajectory-studio scripts/testing/check-trajectory-studio.mjs --max-warnings=0
node scripts/testing/check-trajectory-studio.mjs
```

The browser check accepts `STUDIO_URL` for another loopback port and `CHROME_PATH` for a different installation. Screenshots, PDFs, CSVs and results are written under `output/trajectory-studio/` and are not committed.
