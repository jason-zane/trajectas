# Norm reference infrastructure — implementation receipt

This is the original local norm-branch receipt. For the current publishable
Preview integration, private source-import boundary, standard report and ordered
rollout, see [Preview integration](../preview-readiness.md). Its private source
seed migration is deliberately excluded from the public integration branch.

Prepared 30 October 2026 in isolated branch `codex/ipip-neo-120-references`.
This is local implementation evidence, not a hosted migration, activation or
release receipt. The public repository/source-reuse hold remains in place.

## Delivered behaviour

- The deterministic catalog seed prepares all **41 versions** across the six
  agreed families. Every source version is **draft**, has empty approval evidence,
  and is assigned only to the matching Trajectas Personality Profile form. The
  comparison report template is inactive and is not a default.
- Platform psychometrics shows versioned reference metadata, family, weighting,
  raw/effective N and review status. Existing calibration groups remain visible;
  sample size does not confer approval. Review records identify each selected
  group and expose source, form, population and method details.
- The assessment editor has a reporting-reference default. New campaign links
  inherit an approved default. Admin, partner and client campaign setup share
  the same per-assessment chooser; Quick launch includes a reference step and a
  final reference/version summary. Launch review repeats those choices.
- Campaign defaults freeze at launch or the first assessment attempt. A later
  comparison is a new report edition, not a change to the campaign or result.
- Authorised campaign managers, including client and partner managers, can
  request another report with an approved compatible reference or scale scores
  alone. Exact campaign scope, workspace feature gates and individual-result
  confidentiality checks apply. Ordinary members retain report RLS filtering.
- Each edition freezes the native result, template, source hash, reference
  interpretation and request identity. A request UUID converges retries; an
  advisory lock reserves edition numbers. Completion uses edition 1; additional
  comparisons start at edition 2, even if no automatic report existed.
- Manual editions stay ready for review even if the template auto-releases
  ordinary completion reports. Release, sending and participant-edition selection
  are separate actions. Participant default routing follows the selected edition;
  earlier explicit report links continue to identify their original snapshot.
- The comparison renderer shows the five dimensions and 30 traits, native POMP
  scale scores first, and a separate reference rank. Social Confidence and Stress
  Tolerance use the correctly reversed distribution comparator; Emotional
  Reactivity keeps its native direction. There is no overall personality score.
- Saved reports and PDFs retain their frozen meaning. A live withdrawal notice
  appears outside affected HTML/history content; withdrawal prevents new use.
  Additional PDF names include their reference and edition.

## Assessment compatibility and boundaries

The catalog and assignment tables carry instrument, form, itemset hash, scoring
and method versions. A mapping alone is insufficient: selectors and database
writes check the complete supported measurement contract. The implemented
comparison adapter is **IPIP-NEO-120 Johnson 2014 / native raw v1 / weighted
empirical midrank v1**. Other assessments keep their existing scoring/reporting;
adding their own norm data requires their own explicit compatible adapter and
reviewed source versions. No personality distribution is reused for an unrelated
assessment or treated as cognitive calibration.

Source review remains outstanding: dataset reuse/publication, administered-form
item equivalence, methodology/stability/uncertainty and intended population/use.
Preparation approval is not activation approval. No real source reference was
activated during testing; active test references are separately named SYNTHETIC.

## Ordered migration and rollback plan

Read `docs/runbook.md` and obtain the applicable identified-commit and target
approval before any hosted action. Do not run a blanket migration push.

1. Apply expand migration `20261029230651` alone. Existing report rows default to
   edition 1; the original `(session,template)` unique constraint remains. The
   additional-edition capability is false. No existing norms or report payloads
   are rewritten.
2. Install the edition-aware app and workers. Verify old reports and completion
   writes against the expanded schema. Additional editions remain disabled.
3. After all old writers are drained, apply contract migration `20261029231049`.
   It removes only the old two-column unique constraint and enables editions.
   Then apply `20261029231050` to seed the 41 inactive source versions and the
   inactive comparison template. Verify exact IDs/hashes and draft statuses.
4. Source activation, report-template activation/default assignment and campaign
   use require their separate review/release decisions. Nothing in these
   migrations activates a source norm.

Before contract, an old app can use the expanded schema. **After contract,
rollback must use an edition-aware app**: old two-column `ON CONFLICT` writers
are incompatible. Do not recreate the old unique constraint after multiple
editions exist or delete reports to make rollback fit. Database recovery follows
the runbook independently of app rollback. The disposable local stack replayed
the full migration sequence; no shared or production stack was reset.

## Verification

- Deterministic catalog check: 41 draft versions and inactive template reproduced.
- Full isolated local database suite: **561 passed; 16 provider/configuration
  dependent tests skipped**. This includes the new nine-test reference/edition
  suite and six native IPIP integration tests.
- The new suite verifies distinct frozen 35-scale interpretations, reversed
  facets, unchanged native scores, concurrent idempotency, incompatible/draft/
  cross-client rejection, frozen campaign defaults, manual review despite an
  auto-release template, explicit participant selection, withdrawal and
  aggregate-only refusal.
- Focused manager/scope, compatibility, participant-token and architecture checks
  pass. The browser check saved a compatible synthetic campaign reference and
  created a distinct ready report edition against an alternative synthetic norm.
- Desktop/mobile rendering and the inherited dark CSS variant were inspected.
  The single Impeccable detector pass returned no findings. The independent
  finish review's five material fixes were applied.
- Final required local validation completed successfully: release-script tests,
  lint, typecheck, **3,555 unit**, **244 component**, **97 architecture**, production
  build, and **seven smoke tests** passed. An earlier smoke attempt found the
  task's manual UI server already running; stopping that server and rerunning
  the complete validator resolved that test-harness collision.
- The authorised PDF endpoint generated and downloaded the synthetic Edition 4
  comparison, including the distinct reference/edition filename. A separate
  rerender through the actual print route verified the final pagination without
  overwriting the earlier PDF. All **four A4 pages** were inspected; participant
  identity, all 35 scales, reversed ranks, version and methodology remain visible.
- A live synthetic withdrawal check preserved the saved report and displayed the
  notice outside its content. A final local metadata check returned **41 draft
  source versions**, and `is_active=false, is_default=false` for the seeded
  comparison template.

These are local working-tree checks. CI remains the source of automated evidence
for an identified release commit. No push, merge, deployment, hosted migration or
source activation is included. The disposable test stack was stopped after use;
other local/shared stacks were left alone.
