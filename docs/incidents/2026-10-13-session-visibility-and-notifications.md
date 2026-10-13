# Session visibility and completion notifications — 2026-10-13

## Confirmed incident

A completed token-based assessment was visible in campaign session details but absent from the client participant sessions, counts and item-response panels. The participant activity feed still showed completion.

The session creation action omitted `participant_sessions.client_id`. Campaign ownership was correct, but membership-based row-level security hid the session and dependent responses, scores and reports. Activity uses participant lifecycle timestamps and therefore still rendered completion. A narrowly scoped repair of the reported session restored its campaign client ownership. An authenticated client-role read then returned one session, 150 responses, 25 scores and one report. This is database access evidence; an interactive production portal walkthrough has not been performed.

All 150 saved scalar responses were the lowest response. Each of the 25 delivered constructs had six equally weighted items with three reversed items, so the stored factor and composite scores of 50 were correct. No score, delivered form or stored report snapshot was changed. Rapid response persistence and boundary-drain regressions passed.

Completion notifications were enabled with an empty recipient list. The launcher omitted the creator email and overwrote the server-seeded recipient with an empty list. The released report had a ready PDF and no recorded consultant notification. The notifier returns before a provider request in this configuration. Provider mailbox delivery was not independently queried. Existing campaign recipient configuration and sending remain outstanding owner actions.

## Prevention and compatibility

- Session creation inherits client ownership from the same campaign lookup already authorized by the participant token, preserving clientless campaigns and rejecting cross-campaign requests.
- Campaign session names and rows navigate to the same session in all three portals.
- Item-response reads use the elevated client only after session/workspace and individual-results authorization; aggregate-only confidentiality is preserved.
- Admin construct drilldown uses existing CTT scale-bound derivation and POMP transforms. Persisted scoring remains unchanged.
- Fresh launch routes carry the actor email, require recipients when completion notifications are enabled, and stop activation when settings cannot be saved.
- Reuse preserves explicit recipients and toggles; enabled legacy copies default to the authorized copier, and system/API/preview creation disables consultant notifications when no recipient is configured.
- Authorized participant lists, sessions and activity follow campaign scope, including clientless partner campaigns. Aggregate-only scores remain withheld; report preview access matches session views and ordinary member audience restrictions remain in place.
- Legacy resumed sessions restore only a missing owner after token/campaign authorization. Existing non-null owners are preserved.
- Moving a campaign with sessions to another client is refused. The count and update are separate statements: a concurrent session start during transfer is not protected by an atomic database invariant and remains a follow-up requiring a separately reviewed migration.
- Real response lookup errors are surfaced instead of becoming a misleading empty panel.

The ownership audit found 22 additional historical sessions with null client owners across three clients after the reported session was repaired. No broad production backfill was performed. The scoped read fixes restore authorized application access, and resumed sessions repair their missing owner; direct database RLS can still hide an unrepaired historical row. A broader repair requires an explicitly reviewed scope.

No schema migration is included. Application rollback does not undo the one corrected ownership field. The repair does not affect frozen forms, answers, scores or reports. A reverse ownership repair would recreate the access failure and must be an explicitly reviewed incident-recovery decision.

## Verification and release

The initial isolated local validation passed release logic, lint, TypeScript, 3,291 unit tests, 230 component tests, 97 architecture tests, build, and seven browser smoke tests. The production dependency audit reported zero high/critical advisories. The expanded paths have targeted regression evidence and are undergoing a final isolated rerun and final-commit CI, including integration and seeded browser checks. One existing report-download unit test needed its synthetic database mock updated for the authorized admin-read path; its original failure was recorded and the focused rerun passed.

A fresh synthetic assessment through scoring, stored snapshot and downloadable PDF was not newly exercised by this incident investigation. No production assessment was submitted for testing, no provider settings were changed, and no consultant email was sent. Final SHA, CI and release decision are recorded with the PR under the release runbook.
