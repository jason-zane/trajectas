-- Frozen per-session form snapshots (LR-3 / #333).
--
-- Spec: docs/superpowers/specs/2026-08-13-logical-reasoning-build-plan/
-- 02-platform-architecture.md §1.3.1 (frozen per-session form snapshot),
-- §9 (sequencing — PR 3, called out there as "the highest-regression-risk
-- PR": it changes read-time delivery for EVERY assessment, not just
-- cognitive ones).
--
-- The problem this closes: getSessionState (src/app/actions/assess.ts)
-- recomputes the delivered item set on every read — campaign factor filter,
-- then selectItemsByDifficulty, then a session-seeded shuffle — and never
-- persists it. Editing an item, a section, or a campaign's factor selection
-- mid-session silently changes what a completed session "was". For a scored
-- ability test with an audit trail, that is disqualifying: you cannot
-- reconstruct what a candidate actually saw.
--
-- ===========================================================================
-- Where the freeze happens — NOT inside start_section_for_session
-- ===========================================================================
-- The doc's §3.1 asks explicitly whether the freeze belongs inside the
-- existing start_section_for_session RPC (20260813102000) rather than a
-- separate mechanism. It does not, for a structural reason, not a style
-- preference:
--
--   1. start_section_for_session fires per-section, only once the
--      participant's client asks to start THAT section's timer
--      (src/app/actions/assess.ts: startSectionTiming, called by the section
--      page after getSessionState has already resolved which section is
--      being rendered). getSessionState itself already computes and returns
--      EVERY section's items on first load, for every assessment, today —
--      that is existing, unchanged behaviour (the runner is not lazy-loaded
--      section by section). The freeze must therefore happen no later than
--      getSessionState's first read, for every section at once — earlier
--      than any per-section RPC call could ever reach.
--   2. The assembly algorithm itself (campaign factor filter,
--      selectItemsByDifficulty, applyItemOrdering) is TypeScript that reads
--      five-plus tables (campaign_assessment_factors, assessment_factors,
--      factor_constructs, item_selection_rules, items) with business logic
--      that has no PL/pgSQL equivalent today. Porting it into a SECURITY
--      DEFINER function would duplicate that logic in a second language, on
--      the single riskiest migration in the whole programme, to buy a
--      property — "freeze happens atomically with some other write" — that a
--      plain INSERT ... ON CONFLICT (session_id, section_id) DO NOTHING from
--      the DAL already gives for free. That is the exact idempotency pattern
--      start_section_for_session itself uses; it is just executed from
--      TypeScript because that is where the source data and the selection
--      code already live.
--
-- Concretely: the freeze is a plain admin-client (service_role) upsert from
-- src/lib/dal/session-forms.ts, called from getSessionState AND from
-- src/lib/dal/session-completeness.ts (both funnel through the same DAL
-- function, so there is exactly one implementation of "what was delivered"
-- — see that file's header for why this also fixes the completeness-gate
-- desync hazard). No new RPC / SECURITY DEFINER function is added by this
-- migration.
--
-- ===========================================================================
-- In-flight-at-deploy compatibility — freeze-on-next-read
-- ===========================================================================
-- Sessions already `in_progress` when this ships have no
-- participant_section_forms row yet. The chosen behaviour is
-- freeze-on-next-read: the first time src/lib/dal/session-forms.ts is asked
-- for a section's form and finds none, it assembles one from the CURRENT
-- selection inputs (item bank, campaign factor selection) using the same
-- deterministic, session-seeded algorithm as before — so if nothing in the
-- item bank or campaign configuration changed since the session started
-- (the overwhelmingly common case), the freeze reconstructs exactly what was
-- already shown.
--
-- To make sure this cannot corrupt a part-finished session even in the rare
-- case where something DID change between session start and this deploy,
-- the assembly step unions in any item that already has a saved
-- participant_responses row for that (session, section) but that the fresh
-- computation would otherwise have dropped. That guarantees the freeze can
-- only ever ADD previously-answered items back into "delivered", never
-- silently discard an answer the participant already gave — so the
-- completeness gate this table now backs (session-completeness.ts) can never
-- retroactively strand a part-finished session. See
-- src/lib/dal/session-forms.ts (getOrCreateSectionForms) for the
-- implementation and src/app/actions/assess.ts for the call site.
--
-- ===========================================================================
-- Deviation from the doc's §1.3.1 entries schema
-- ===========================================================================
-- The doc's example entry includes an optional `optionOrder` field for a
-- "per-sitting option shuffle" (doc 06 §5.3). No such shuffle exists
-- anywhere in the codebase today — item_options are always delivered sorted
-- by display_order — so this migration's entries do not carry one. Adding an
-- unrequested behaviour change to the highest-regression-risk migration in
-- the programme is the wrong trade; the JSON shape is additive (there is no
-- CHECK constraining entries[i]'s keys beyond "entries is an array"), so a
-- future PR can add optionOrder without touching this table.
--
-- Grants: SELECT + INSERT only — no UPDATE, no DELETE. Once written, a form
-- is immutable for the life of the session; nothing in this slice ever
-- updates a row. A future scorer that detects item content drift
-- (item_version / content_hash mismatch against the live items row —
-- possible in principle because items.lifecycle_state defaults to 'draft'
-- and the 20260813100500 immutability trigger only freezes content once an
-- item reaches calibrated/operational/retired) aborts rather than silently
-- rewriting the frozen form.

CREATE TABLE participant_section_forms (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        UUID NOT NULL REFERENCES participant_sessions(id) ON DELETE CASCADE,
  section_id        UUID NOT NULL REFERENCES assessment_sections(id) ON DELETE RESTRICT,
  assembled_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  assembly_seed     TEXT NOT NULL,                 -- '<sessionId>:<sectionId>'
  assembler_version TEXT NOT NULL,                 -- 'form-assembler@1'
  form_code         TEXT,                          -- named parallel form, when applicable (unused today)
  entries           JSONB NOT NULL,
  entry_count       INT NOT NULL,
  CONSTRAINT participant_section_forms_unique UNIQUE (session_id, section_id),
  CONSTRAINT participant_section_forms_entries_array
    CHECK (jsonb_typeof(entries) = 'array' AND entry_count = jsonb_array_length(entries)),
  CONSTRAINT participant_section_forms_entry_count_positive
    CHECK (entry_count > 0)
);

CREATE INDEX idx_participant_section_forms_session ON participant_section_forms(session_id);

COMMENT ON TABLE participant_section_forms IS
  'One row per (session, section), written the first time that section''s
   delivered item set is computed for this session — today that is
   getSessionState''s first call for the session (every section is frozen at
   once; see src/lib/dal/session-forms.ts), with session-completeness.ts able
   to freeze-on-demand too if it is ever reached first. Authoritative for
   delivery order and the completeness gate; a future scorer reads it as the
   authoritative delivered set rather than recomputing one. Immutable by
   grant: SELECT + INSERT only, no UPDATE/DELETE.';

COMMENT ON COLUMN participant_section_forms.entries IS
  'JSON array, one element per delivered item, in delivery order:
   { position, itemId, itemVersion, contentHash, purpose, countsTowardScore }.
   No option order (see migration header) and no answer-key material — this
   table stores WHICH items and WHAT ORDER, not item content, so a legitimate
   content edit to a draft item still renders correctly; only the identity
   and change-detection fingerprint (itemVersion / contentHash) are frozen.';

-- RLS: deny-all for anon/authenticated (matches the cognitive secure-set
-- precedent from 20260813100500/102000). Two narrow policies rather than one
-- "FOR ALL" — a POLICY's FOR clause only takes a single command, and ALL
-- would (at the RLS layer) permit UPDATE/DELETE this table is designed never
-- to allow; SELECT + INSERT only matches the immutability intent exactly.
ALTER TABLE participant_section_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role select" ON participant_section_forms
  FOR SELECT TO service_role USING (true);
CREATE POLICY "service_role insert" ON participant_section_forms
  FOR INSERT TO service_role WITH CHECK (true);

-- REVOKE ALL from service_role too, not just PUBLIC/anon/authenticated.
-- Supabase grants service_role a blanket ALL-privileges default via
-- ALTER DEFAULT PRIVILEGES (see scripts/README-pg-migrate-check.md — the
-- harness models this because it has bitten this repo before), and GRANT is
-- additive: it can only ADD privileges, never subtract from that blanket
-- grant. Verified empirically while building this migration — with only
-- `REVOKE ALL ... FROM PUBLIC, anon, authenticated`, service_role could
-- still UPDATE and DELETE a "frozen" row (the narrower GRANT SELECT, INSERT
-- below did nothing to stop it, because the blanket grant was untouched).
-- REVOKE ALL FROM service_role first, THEN grant back exactly SELECT +
-- INSERT, is what actually makes the table immutable-by-privilege rather
-- than immutable-by-convention.
REVOKE ALL ON TABLE participant_section_forms FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON TABLE participant_section_forms TO service_role;
