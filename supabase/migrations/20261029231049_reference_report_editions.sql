-- CONTRACT PHASE: apply only after all report writers use edition-aware conflict
-- targets. Roll back to an edition-capable app; older ON CONFLICT(session,template)
-- writers are incompatible once this constraint is removed. No reports are deleted.
ALTER TABLE public.report_snapshots DROP CONSTRAINT report_snapshots_session_template_unique;
UPDATE public.norm_reporting_capabilities SET editions_enabled=true WHERE singleton;
