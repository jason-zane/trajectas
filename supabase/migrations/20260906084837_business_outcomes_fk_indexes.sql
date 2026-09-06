-- Cover composite ownership references and the normal study timeline reads.
CREATE INDEX outcome_imports_study_client_created_idx ON public.outcome_imports(study_id,client_id,created_at DESC);
CREATE INDEX outcome_runs_study_client_created_idx ON public.outcome_runs(study_id,client_id,created_at DESC);
CREATE INDEX outcome_reports_study_client_created_idx ON public.outcome_reports(study_id,client_id,created_at DESC);
CREATE INDEX outcome_drafts_run_study_client_idx ON public.outcome_report_drafts(run_id,study_id,client_id);
DROP INDEX public.outcome_imports_study_created_idx;
DROP INDEX public.outcome_runs_study_created_idx;
DROP INDEX public.outcome_reports_study_created_idx;
