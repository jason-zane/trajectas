-- =========================================================================
-- Enum types for the Organisational Diagnostics feature.
-- IDEMPOTENT: safe to re-run after partial application.
-- =========================================================================

DO $$ BEGIN
  CREATE TYPE org_diagnostic_campaign_kind AS ENUM ('baseline', 'role_rep');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE org_diagnostic_campaign_status AS ENUM ('draft', 'active', 'closed', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE org_diagnostic_instrument AS ENUM ('OPS', 'LCQ', 'REP');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE org_diagnostic_track_status AS ENUM ('pending', 'open', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE org_diagnostic_respondent_type AS ENUM ('employee', 'senior_leader', 'hiring_manager', 'team_member');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE org_diagnostic_respondent_status AS ENUM ('invited', 'in_progress', 'completed', 'withdrawn', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE org_diagnostic_profile_kind AS ENUM ('baseline', 'role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE client_role_status AS ENUM ('open', 'filled', 'closed', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;;
