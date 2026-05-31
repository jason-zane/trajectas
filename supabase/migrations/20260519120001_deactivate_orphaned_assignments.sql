-- Backfill: deactivate assignment rows that still point at soft-deleted parents.
--
-- Soft deletes on assessments / report_templates / clients / partners do not
-- fire the ON DELETE CASCADE FKs on the assignment tables (CASCADE only fires
-- on hard DELETE). Going forward, the server actions deactivate dependents on
-- soft delete; this migration cleans up rows that were orphaned before that.

UPDATE client_assessment_assignments caa
SET is_active = false, updated_at = now()
FROM assessments a
WHERE a.id = caa.assessment_id
  AND a.deleted_at IS NOT NULL
  AND caa.is_active = true;

UPDATE partner_assessment_assignments paa
SET is_active = false, updated_at = now()
FROM assessments a
WHERE a.id = paa.assessment_id
  AND a.deleted_at IS NOT NULL
  AND paa.is_active = true;

UPDATE client_report_template_assignments crta
SET is_active = false, updated_at = now()
FROM report_templates rt
WHERE rt.id = crta.report_template_id
  AND rt.deleted_at IS NOT NULL
  AND crta.is_active = true;

UPDATE partner_report_template_assignments prta
SET is_active = false, updated_at = now()
FROM report_templates rt
WHERE rt.id = prta.report_template_id
  AND rt.deleted_at IS NOT NULL
  AND prta.is_active = true;

-- Also handle assignments whose owner (client / partner) is itself soft-deleted.

UPDATE client_assessment_assignments caa
SET is_active = false, updated_at = now()
FROM clients c
WHERE c.id = caa.client_id
  AND c.deleted_at IS NOT NULL
  AND caa.is_active = true;

UPDATE client_report_template_assignments crta
SET is_active = false, updated_at = now()
FROM clients c
WHERE c.id = crta.client_id
  AND c.deleted_at IS NOT NULL
  AND crta.is_active = true;

UPDATE partner_assessment_assignments paa
SET is_active = false, updated_at = now()
FROM partners p
WHERE p.id = paa.partner_id
  AND p.deleted_at IS NOT NULL
  AND paa.is_active = true;

UPDATE partner_report_template_assignments prta
SET is_active = false, updated_at = now()
FROM partners p
WHERE p.id = prta.partner_id
  AND p.deleted_at IS NOT NULL
  AND prta.is_active = true;
