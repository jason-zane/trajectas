-- =========================================================================
-- 20260904160000_assessments_select_assigned.sql
--
-- Let a client read the assessments it has been GRANTED, not only the ones
-- it OWNS.
--
-- THE GAP
--
-- Every arm of assessments_select_authenticated scopes by an ownership
-- column on the assessment row itself:
--
--     platform admin
--     OR (org_admin AND client_id = auth_user_client_id())
--     OR partner_id = ANY (auth_user_partner_admin_ids())
--     OR (partner_id IS NULL AND client_id IS NULL)   -- platform-owned
--     OR partner_id = ANY (auth_user_partner_ids())
--     OR client_id = ANY (auth_user_client_ids())
--
-- Entitlement is not ownership. client_assessment_assignments is how a
-- client is granted an assessment somebody else owns, and no policy on
-- assessments has ever consulted it:
--
--     select count(*) from pg_policies
--     where schemaname = 'public' and tablename = 'assessments'
--       and coalesce(qual, '') like '%client_assessment_assignments%';
--     -- 0
--
-- So a PARTNER-owned assessment assigned to a client is unreadable by that
-- client's own members on their own connection. (A PLATFORM-owned assessment
-- — partner_id and client_id both NULL — already slips through the fourth
-- arm, which is world-readable to any authenticated user. The live gap is
-- the partner-owned case; this policy also makes the platform-owned grant
-- explicit instead of incidental.)
--
-- getClientAssessmentLibrary() never noticed because it reads on the admin
-- (service-role) client, which bypasses RLS entirely. Anything RLS-native
-- did notice: the grounded-chat tools in src/lib/chat/tools/ and
-- src/lib/dal/chat-search.ts return not_found for an assessment the client
-- can legitimately use. Raised on PR #380 and correctly deferred there —
-- it needs a policy, not a query predicate.
--
-- WHY A SEPARATE POLICY RATHER THAN AN ARM ON THE EXISTING ONE
--
-- Permissive policies OR together, so a second policy is semantically the
-- same as a seventh arm. It is preferred here because
-- fix/support-session-db-confinement is concurrently rewriting
-- assessments_select_authenticated in full (swapping is_platform_admin() for
-- is_unconfined_platform_admin()). Two migrations that both CREATE that one
-- policy would mean whichever replays second silently reverts the other —
-- and in one direction that reverts a tenant-confinement fix. This touches
-- nothing that branch touches, so merge order stops mattering.
--
-- CONFINEMENT
--
-- The grant is expressed through auth_user_client_ids(), not a direct
-- client_memberships lookup, so it inherits that function's behaviour rather
-- than forking it: revoked memberships are already excluded, and once the
-- confinement branch lands, a platform admin inside a support session is
-- narrowed to that session's target here too, automatically.
--
-- WHAT GATES THE GRANT
--
-- client_assessment_assignments has no revoked_at / expires_at / deleted_at
-- column. is_active (NOT NULL DEFAULT true) is the whole revocation story,
-- and it is what the app writes when a grant is withdrawn, when the
-- assessment is soft-deleted and when the client is soft-deleted
-- (20260519120001_deactivate_orphaned_assignments.sql). quota_limit is
-- deliberately NOT consulted: an exhausted quota must still render as an
-- exhausted quota, which means reading the row it belongs to.
--
-- Read-only, and narrower than the app already behaves. INSERT / UPDATE /
-- DELETE on assessments are untouched — an assignment grants use, never
-- authorship.
-- =========================================================================

DROP POLICY IF EXISTS "assessments_select_assigned_authenticated" ON public.assessments;

CREATE POLICY "assessments_select_assigned_authenticated" ON public.assessments
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.client_assessment_assignments caa
      WHERE caa.assessment_id = assessments.id
        AND caa.is_active
        AND caa.client_id = ANY (auth_user_client_ids())
    )
  );

COMMENT ON POLICY "assessments_select_assigned_authenticated" ON public.assessments IS
  'Entitlement arm: a client member may read an assessment their client holds an active client_assessment_assignments grant for, regardless of who owns it. Ownership arms live in assessments_select_authenticated; this is deliberately a separate permissive policy so the two can be edited independently.';

-- The EXISTS resolves through idx_client_assessment_assignments_assessment_id
-- (btree on assessment_id, created in 20260508214500_phase4_fk_indexes.sql).
-- Asserted rather than assumed: a seq scan of the assignment table on every
-- assessment read is the failure mode worth catching at migration time.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'client_assessment_assignments'
      AND indexdef LIKE '%(assessment_id%'
  ) THEN
    RAISE EXCEPTION
      'assessments_select_assigned_authenticated needs an index on client_assessment_assignments(assessment_id)';
  END IF;
END $$;
