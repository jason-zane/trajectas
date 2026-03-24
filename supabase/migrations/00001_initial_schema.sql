-- =============================================================================
-- Talent Fit: Initial Schema Migration
-- =============================================================================
-- Multi-tenant psychometric assessment and organisational diagnostic platform.
--
-- Tenancy model (3-tier):
--   Platform  ->  Partners (consulting firms)  ->  Organisations (clients)
--
-- Sections:
--   1. Extensions & enums
--   2. Utility functions (updated_at trigger)
--   3. Multi-tenancy tables (partners, organizations, profiles)
--   4. Competency library (categories, competencies, items, IRT parameters)
--   5. Assessment builder (assessments, item selection rules)
--   6. Organisational diagnostic (dimensions, templates, sessions, responses)
--   7. AI matching (providers, models, prompts, runs, results)
--   8. Candidate assessment (sessions, responses, scores)
--   9. Indexes
--  10. Row-Level Security policies
--  11. Trigger attachments
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "citext";     -- case-insensitive text for emails / slugs

-- ---------------------------------------------------------------------------
-- 2. Enum types
-- ---------------------------------------------------------------------------
CREATE TYPE user_role AS ENUM (
    'platform_admin',
    'partner_admin',
    'org_admin',
    'consultant',
    'assessor',
    'candidate'
);

CREATE TYPE response_format_type AS ENUM (
    'likert',
    'forced_choice',
    'binary',
    'free_text'
);

CREATE TYPE item_status AS ENUM (
    'draft',
    'active',
    'archived'
);

CREATE TYPE irt_model_type AS ENUM (
    '1PL',
    '2PL',
    '3PL'
);

CREATE TYPE scoring_method AS ENUM (
    'irt',
    'ctt',
    'hybrid'
);

CREATE TYPE item_selection_strategy AS ENUM (
    'fixed',
    'rule_based',
    'cat'
);

CREATE TYPE assessment_status AS ENUM (
    'draft',
    'active',
    'archived'
);

CREATE TYPE diagnostic_session_status AS ENUM (
    'draft',
    'active',
    'completed',
    'archived'
);

CREATE TYPE ai_prompt_purpose AS ENUM (
    'competency_matching',
    'ranking_explanation',
    'diagnostic_analysis'
);

CREATE TYPE matching_run_status AS ENUM (
    'pending',
    'running',
    'completed',
    'failed'
);

CREATE TYPE candidate_session_status AS ENUM (
    'not_started',
    'in_progress',
    'completed',
    'expired'
);

-- ---------------------------------------------------------------------------
-- 3. Utility: auto-update updated_at
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION set_updated_at() IS
    'Trigger function that stamps updated_at with the current timestamp on every UPDATE.';

-- ---------------------------------------------------------------------------
-- 4. Helper: check if the current user holds a given role
-- ---------------------------------------------------------------------------
-- These helpers are used by RLS policies. They query the profiles table
-- so they must be created after the profiles table. We use forward
-- declarations via CREATE OR REPLACE later after the profiles table exists.

-- ==========================================================================
-- SECTION: MULTI-TENANCY
-- ==========================================================================

-- ---------------------------------------------------------------------------
-- partners
-- ---------------------------------------------------------------------------
CREATE TABLE partners (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT        NOT NULL,
    slug        CITEXT      NOT NULL,
    settings    JSONB       NOT NULL DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT partners_slug_unique UNIQUE (slug),
    CONSTRAINT partners_slug_format CHECK (slug ~ '^[a-z0-9][a-z0-9\-]*[a-z0-9]$' AND length(slug) >= 2),
    CONSTRAINT partners_name_not_empty CHECK (length(trim(name)) > 0)
);

COMMENT ON TABLE partners IS
    'Consulting firms that license the Talent Fit platform. Top-level tenant.';

-- ---------------------------------------------------------------------------
-- organizations
-- ---------------------------------------------------------------------------
CREATE TABLE organizations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id  UUID        REFERENCES partners(id) ON DELETE SET NULL,
    name        TEXT        NOT NULL,
    slug        CITEXT      NOT NULL,
    industry    TEXT,
    size        TEXT,
    settings    JSONB       NOT NULL DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT organizations_slug_unique UNIQUE (slug),
    CONSTRAINT organizations_slug_format CHECK (slug ~ '^[a-z0-9][a-z0-9\-]*[a-z0-9]$' AND length(slug) >= 2),
    CONSTRAINT organizations_name_not_empty CHECK (length(trim(name)) > 0)
);

COMMENT ON TABLE organizations IS
    'Client organisations. May belong to a partner (consulting firm) or operate directly on the platform.';

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
CREATE TABLE profiles (
    id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    partner_id      UUID        REFERENCES partners(id) ON DELETE SET NULL,
    organization_id UUID        REFERENCES organizations(id) ON DELETE SET NULL,
    role            user_role   NOT NULL DEFAULT 'candidate',
    first_name      TEXT        NOT NULL DEFAULT '',
    last_name       TEXT        NOT NULL DEFAULT '',
    email           CITEXT      NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT profiles_email_unique UNIQUE (email),
    CONSTRAINT profiles_email_format CHECK (email ~* '^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$')
);

COMMENT ON TABLE profiles IS
    'Extends Supabase auth.users with platform-specific attributes including role and tenant association.';

-- ---------------------------------------------------------------------------
-- RLS helper functions (defined after profiles exists)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION auth_user_role()
RETURNS user_role AS $$
    SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION auth_user_role() IS
    'Returns the platform role for the currently authenticated user.';

CREATE OR REPLACE FUNCTION auth_user_partner_id()
RETURNS UUID AS $$
    SELECT partner_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION auth_user_organization_id()
RETURNS UUID AS $$
    SELECT organization_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_platform_admin()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'platform_admin'
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_partner_admin()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'partner_admin'
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ==========================================================================
-- SECTION: COMPETENCY LIBRARY
-- ==========================================================================

-- ---------------------------------------------------------------------------
-- competency_categories
-- ---------------------------------------------------------------------------
CREATE TABLE competency_categories (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          TEXT    NOT NULL,
    description   TEXT,
    display_order INT    NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT competency_categories_name_not_empty CHECK (length(trim(name)) > 0)
);

COMMENT ON TABLE competency_categories IS
    'Logical groupings of competencies (e.g., Leadership, Cognitive, Interpersonal).';

-- ---------------------------------------------------------------------------
-- competencies
-- ---------------------------------------------------------------------------
CREATE TABLE competencies (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id   UUID        NOT NULL REFERENCES competency_categories(id) ON DELETE RESTRICT,
    name          TEXT        NOT NULL,
    slug          CITEXT      NOT NULL,
    description   TEXT,
    definition    TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT competencies_slug_unique UNIQUE (slug),
    CONSTRAINT competencies_slug_format CHECK (slug ~ '^[a-z0-9][a-z0-9\-]*[a-z0-9]$' AND length(slug) >= 2),
    CONSTRAINT competencies_name_not_empty CHECK (length(trim(name)) > 0)
);

COMMENT ON TABLE competencies IS
    'Individual competencies that can be measured via assessment items. Each belongs to a category.';

-- ---------------------------------------------------------------------------
-- response_formats
-- ---------------------------------------------------------------------------
CREATE TABLE response_formats (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       TEXT                NOT NULL,
    type       response_format_type NOT NULL,
    config     JSONB               NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ         NOT NULL DEFAULT now(),

    CONSTRAINT response_formats_name_unique UNIQUE (name),
    CONSTRAINT response_formats_name_not_empty CHECK (length(trim(name)) > 0)
);

COMMENT ON TABLE response_formats IS
    'Defines how a question is answered (e.g., likert_5, forced_choice, binary). Config JSONB holds scale labels and option definitions.';

-- ---------------------------------------------------------------------------
-- items (questions)
-- ---------------------------------------------------------------------------
CREATE TABLE items (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    competency_id      UUID        NOT NULL REFERENCES competencies(id) ON DELETE RESTRICT,
    response_format_id UUID        NOT NULL REFERENCES response_formats(id) ON DELETE RESTRICT,
    stem               TEXT        NOT NULL,
    reverse_scored     BOOLEAN     NOT NULL DEFAULT false,
    display_order      INT         NOT NULL DEFAULT 0,
    status             item_status NOT NULL DEFAULT 'draft',
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT items_stem_not_empty CHECK (length(trim(stem)) > 0)
);

COMMENT ON TABLE items IS
    'Assessment questions. Each item maps to one competency and one response format.';

-- ---------------------------------------------------------------------------
-- item_options
-- ---------------------------------------------------------------------------
CREATE TABLE item_options (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id       UUID    NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    label         TEXT    NOT NULL,
    value         NUMERIC NOT NULL,
    display_order INT     NOT NULL DEFAULT 0,

    CONSTRAINT item_options_label_not_empty CHECK (length(trim(label)) > 0)
);

COMMENT ON TABLE item_options IS
    'Individual response options for an item (e.g., Strongly Agree = 5, Agree = 4).';

-- ---------------------------------------------------------------------------
-- item_parameters (IRT)
-- ---------------------------------------------------------------------------
CREATE TABLE item_parameters (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id                UUID           NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    discrimination         NUMERIC,       -- a parameter
    difficulty             NUMERIC,       -- b parameter
    guessing               NUMERIC,       -- c parameter
    model_type             irt_model_type NOT NULL DEFAULT '2PL',
    calibration_sample_size INT,
    last_calibrated_at     TIMESTAMPTZ,
    created_at             TIMESTAMPTZ    NOT NULL DEFAULT now(),

    CONSTRAINT item_parameters_item_unique UNIQUE (item_id),
    CONSTRAINT item_parameters_discrimination_positive CHECK (discrimination IS NULL OR discrimination > 0),
    CONSTRAINT item_parameters_guessing_range CHECK (guessing IS NULL OR (guessing >= 0 AND guessing <= 1))
);

COMMENT ON TABLE item_parameters IS
    'Item Response Theory parameters for psychometric scoring. Supports 1PL, 2PL, and 3PL models.';

-- ==========================================================================
-- SECTION: ASSESSMENT BUILDER
-- ==========================================================================

-- ---------------------------------------------------------------------------
-- assessments
-- ---------------------------------------------------------------------------
CREATE TABLE assessments (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id          UUID                    REFERENCES organizations(id) ON DELETE SET NULL,
    name                     TEXT                    NOT NULL,
    slug                     CITEXT                  NOT NULL,
    description              TEXT,
    scoring_method           scoring_method          NOT NULL DEFAULT 'ctt',
    item_selection_strategy  item_selection_strategy  NOT NULL DEFAULT 'fixed',
    status                   assessment_status       NOT NULL DEFAULT 'draft',
    time_limit_minutes       INT,
    created_at               TIMESTAMPTZ             NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ             NOT NULL DEFAULT now(),

    CONSTRAINT assessments_slug_unique UNIQUE (slug),
    CONSTRAINT assessments_slug_format CHECK (slug ~ '^[a-z0-9][a-z0-9\-]*[a-z0-9]$' AND length(slug) >= 2),
    CONSTRAINT assessments_name_not_empty CHECK (length(trim(name)) > 0),
    CONSTRAINT assessments_time_limit_positive CHECK (time_limit_minutes IS NULL OR time_limit_minutes > 0)
);

COMMENT ON TABLE assessments IS
    'An assessment definition. Can be org-specific or platform-wide. Defines scoring and item selection strategies.';

-- ---------------------------------------------------------------------------
-- assessment_competencies (junction)
-- ---------------------------------------------------------------------------
CREATE TABLE assessment_competencies (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id  UUID    NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
    competency_id  UUID    NOT NULL REFERENCES competencies(id) ON DELETE RESTRICT,
    display_order  INT     NOT NULL DEFAULT 0,
    weight         NUMERIC NOT NULL DEFAULT 1.0,
    min_items      INT,
    max_items      INT,

    CONSTRAINT assessment_competencies_unique UNIQUE (assessment_id, competency_id),
    CONSTRAINT assessment_competencies_weight_positive CHECK (weight > 0),
    CONSTRAINT assessment_competencies_items_valid CHECK (
        (min_items IS NULL AND max_items IS NULL)
        OR (min_items IS NULL AND max_items > 0)
        OR (max_items IS NULL AND min_items > 0)
        OR (min_items > 0 AND max_items >= min_items)
    )
);

COMMENT ON TABLE assessment_competencies IS
    'Links competencies to an assessment with ordering, weighting, and item-count constraints.';

-- ---------------------------------------------------------------------------
-- item_selection_rules
-- ---------------------------------------------------------------------------
CREATE TABLE item_selection_rules (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id         UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
    total_competency_min  INT  NOT NULL,
    total_competency_max  INT  NOT NULL,
    items_per_competency  INT  NOT NULL,
    description           TEXT,

    CONSTRAINT item_selection_rules_min_max CHECK (total_competency_max >= total_competency_min),
    CONSTRAINT item_selection_rules_positive CHECK (
        total_competency_min > 0 AND items_per_competency > 0
    )
);

COMMENT ON TABLE item_selection_rules IS
    'Rules governing how many items are administered per competency based on how many competencies are selected (e.g., 1-3 comps = 10 items each, 4-7 = 7, 8+ = 5).';

-- ==========================================================================
-- SECTION: ORGANISATIONAL DIAGNOSTIC
-- ==========================================================================

-- ---------------------------------------------------------------------------
-- diagnostic_dimensions
-- ---------------------------------------------------------------------------
CREATE TABLE diagnostic_dimensions (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name           TEXT    NOT NULL,
    slug           CITEXT  NOT NULL,
    description    TEXT,
    category       TEXT,
    default_weight NUMERIC NOT NULL DEFAULT 1.0,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT diagnostic_dimensions_slug_unique UNIQUE (slug),
    CONSTRAINT diagnostic_dimensions_slug_format CHECK (slug ~ '^[a-z0-9][a-z0-9\-]*[a-z0-9]$' AND length(slug) >= 2),
    CONSTRAINT diagnostic_dimensions_name_not_empty CHECK (length(trim(name)) > 0),
    CONSTRAINT diagnostic_dimensions_weight_positive CHECK (default_weight > 0)
);

COMMENT ON TABLE diagnostic_dimensions IS
    'Variables measured in an organisational diagnostic (e.g., Culture, Engagement, Innovation).';

-- ---------------------------------------------------------------------------
-- diagnostic_templates
-- ---------------------------------------------------------------------------
CREATE TABLE diagnostic_templates (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT diagnostic_templates_name_not_empty CHECK (length(trim(name)) > 0)
);

COMMENT ON TABLE diagnostic_templates IS
    'Reusable groupings of diagnostic dimensions that form a standard diagnostic instrument.';

-- ---------------------------------------------------------------------------
-- diagnostic_template_dimensions (junction)
-- ---------------------------------------------------------------------------
CREATE TABLE diagnostic_template_dimensions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id     UUID    NOT NULL REFERENCES diagnostic_templates(id) ON DELETE CASCADE,
    dimension_id    UUID    NOT NULL REFERENCES diagnostic_dimensions(id) ON DELETE CASCADE,
    weight_override NUMERIC,
    display_order   INT     NOT NULL DEFAULT 0,

    CONSTRAINT diagnostic_template_dimensions_unique UNIQUE (template_id, dimension_id),
    CONSTRAINT diagnostic_template_dimensions_weight_positive CHECK (weight_override IS NULL OR weight_override > 0)
);

COMMENT ON TABLE diagnostic_template_dimensions IS
    'Links dimensions to a diagnostic template, optionally overriding the dimension default weight.';

-- ---------------------------------------------------------------------------
-- diagnostic_sessions
-- ---------------------------------------------------------------------------
CREATE TABLE diagnostic_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID                       NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    template_id     UUID                       REFERENCES diagnostic_templates(id) ON DELETE SET NULL,
    name            TEXT                       NOT NULL,
    description     TEXT,
    status          diagnostic_session_status  NOT NULL DEFAULT 'draft',
    department      TEXT,
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ                NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ                NOT NULL DEFAULT now(),

    CONSTRAINT diagnostic_sessions_name_not_empty CHECK (length(trim(name)) > 0),
    CONSTRAINT diagnostic_sessions_dates_valid CHECK (
        completed_at IS NULL OR started_at IS NULL OR completed_at >= started_at
    )
);

COMMENT ON TABLE diagnostic_sessions IS
    'An instance of a diagnostic being conducted for an organisation (optionally scoped to a department).';

-- ---------------------------------------------------------------------------
-- diagnostic_respondents
-- ---------------------------------------------------------------------------
CREATE TABLE diagnostic_respondents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID        NOT NULL REFERENCES diagnostic_sessions(id) ON DELETE CASCADE,
    profile_id      UUID        REFERENCES profiles(id) ON DELETE SET NULL,
    email           CITEXT      NOT NULL,
    name            TEXT        NOT NULL DEFAULT '',
    role_title      TEXT,
    department      TEXT,
    seniority_level TEXT,
    weight          NUMERIC     NOT NULL DEFAULT 1.0,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT diagnostic_respondents_email_session_unique UNIQUE (session_id, email),
    CONSTRAINT diagnostic_respondents_weight_positive CHECK (weight > 0),
    CONSTRAINT diagnostic_respondents_email_format CHECK (email ~* '^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$')
);

COMMENT ON TABLE diagnostic_respondents IS
    'People who respond to a diagnostic session. May or may not have a platform profile.';

-- ---------------------------------------------------------------------------
-- diagnostic_responses
-- ---------------------------------------------------------------------------
CREATE TABLE diagnostic_responses (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    respondent_id UUID    NOT NULL REFERENCES diagnostic_respondents(id) ON DELETE CASCADE,
    dimension_id  UUID    NOT NULL REFERENCES diagnostic_dimensions(id) ON DELETE RESTRICT,
    score         NUMERIC NOT NULL,
    notes         TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT diagnostic_responses_unique UNIQUE (respondent_id, dimension_id),
    CONSTRAINT diagnostic_responses_score_range CHECK (score >= 0 AND score <= 100)
);

COMMENT ON TABLE diagnostic_responses IS
    'Individual respondent scores for each diagnostic dimension.';

-- ---------------------------------------------------------------------------
-- diagnostic_dimension_weights (per-session custom weights)
-- ---------------------------------------------------------------------------
CREATE TABLE diagnostic_dimension_weights (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id   UUID    NOT NULL REFERENCES diagnostic_sessions(id) ON DELETE CASCADE,
    dimension_id UUID    NOT NULL REFERENCES diagnostic_dimensions(id) ON DELETE CASCADE,
    weight       NUMERIC NOT NULL,

    CONSTRAINT diagnostic_dimension_weights_unique UNIQUE (session_id, dimension_id),
    CONSTRAINT diagnostic_dimension_weights_positive CHECK (weight > 0)
);

COMMENT ON TABLE diagnostic_dimension_weights IS
    'Per-session overrides for dimension weights, allowing consultants to tune importance per engagement.';

-- ---------------------------------------------------------------------------
-- diagnostic_snapshots
-- ---------------------------------------------------------------------------
CREATE TABLE diagnostic_snapshots (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID   NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    session_id          UUID   NOT NULL REFERENCES diagnostic_sessions(id) ON DELETE CASCADE,
    snapshot_data       JSONB  NOT NULL DEFAULT '{}'::jsonb,
    aggregation_method  TEXT   NOT NULL DEFAULT 'weighted_mean',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE diagnostic_snapshots IS
    'Point-in-time aggregated scores for an organisation, persisted for trend analysis.';

-- ==========================================================================
-- SECTION: AI MATCHING
-- ==========================================================================

-- ---------------------------------------------------------------------------
-- ai_providers
-- ---------------------------------------------------------------------------
CREATE TABLE ai_providers (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          TEXT    NOT NULL,
    api_key_env_var TEXT  NOT NULL,
    base_url      TEXT,
    is_active     BOOLEAN NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT ai_providers_name_unique UNIQUE (name),
    CONSTRAINT ai_providers_name_not_empty CHECK (length(trim(name)) > 0)
);

COMMENT ON TABLE ai_providers IS
    'AI service providers (e.g., Anthropic, OpenAI). Stores reference to env var, never the key itself.';

-- ---------------------------------------------------------------------------
-- ai_model_configs
-- ---------------------------------------------------------------------------
CREATE TABLE ai_model_configs (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id  UUID    NOT NULL REFERENCES ai_providers(id) ON DELETE CASCADE,
    model_id     TEXT    NOT NULL,
    display_name TEXT    NOT NULL,
    is_default   BOOLEAN NOT NULL DEFAULT false,
    config       JSONB   NOT NULL DEFAULT '{}'::jsonb,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT ai_model_configs_model_unique UNIQUE (provider_id, model_id),
    CONSTRAINT ai_model_configs_display_name_not_empty CHECK (length(trim(display_name)) > 0)
);

COMMENT ON TABLE ai_model_configs IS
    'Specific model configurations (e.g., claude-sonnet-4-5-20250514 with temperature 0.3). Config JSONB holds temperature, max_tokens, etc.';

-- ---------------------------------------------------------------------------
-- ai_system_prompts
-- ---------------------------------------------------------------------------
CREATE TABLE ai_system_prompts (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       TEXT              NOT NULL,
    purpose    ai_prompt_purpose NOT NULL,
    content    TEXT              NOT NULL,
    version    INT               NOT NULL DEFAULT 1,
    is_active  BOOLEAN           NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ       NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ       NOT NULL DEFAULT now(),

    CONSTRAINT ai_system_prompts_version_unique UNIQUE (name, version),
    CONSTRAINT ai_system_prompts_version_positive CHECK (version > 0),
    CONSTRAINT ai_system_prompts_content_not_empty CHECK (length(trim(content)) > 0)
);

COMMENT ON TABLE ai_system_prompts IS
    'Versioned system prompts for AI operations. Allows A/B testing and rollback of prompt engineering.';

-- ---------------------------------------------------------------------------
-- matching_runs
-- ---------------------------------------------------------------------------
CREATE TABLE matching_runs (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id       UUID               NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    diagnostic_session_id UUID               NOT NULL REFERENCES diagnostic_sessions(id) ON DELETE CASCADE,
    ai_model_config_id    UUID               NOT NULL REFERENCES ai_model_configs(id) ON DELETE RESTRICT,
    system_prompt_id      UUID               NOT NULL REFERENCES ai_system_prompts(id) ON DELETE RESTRICT,
    status                matching_run_status NOT NULL DEFAULT 'pending',
    input_data            JSONB              NOT NULL DEFAULT '{}'::jsonb,
    created_at            TIMESTAMPTZ        NOT NULL DEFAULT now(),
    completed_at          TIMESTAMPTZ,

    CONSTRAINT matching_runs_dates_valid CHECK (
        completed_at IS NULL OR completed_at >= created_at
    )
);

COMMENT ON TABLE matching_runs IS
    'An execution of the AI matching engine: takes diagnostic results and recommends competencies.';

-- ---------------------------------------------------------------------------
-- matching_results
-- ---------------------------------------------------------------------------
CREATE TABLE matching_results (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    matching_run_id   UUID    NOT NULL REFERENCES matching_runs(id) ON DELETE CASCADE,
    competency_id     UUID    NOT NULL REFERENCES competencies(id) ON DELETE RESTRICT,
    rank              INT     NOT NULL,
    relevance_score   NUMERIC NOT NULL,
    reasoning         TEXT,
    incremental_value NUMERIC,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT matching_results_unique UNIQUE (matching_run_id, competency_id),
    CONSTRAINT matching_results_rank_positive CHECK (rank > 0),
    CONSTRAINT matching_results_relevance_range CHECK (relevance_score >= 0 AND relevance_score <= 1)
);

COMMENT ON TABLE matching_results IS
    'Individual competency recommendations produced by an AI matching run, ranked by relevance.';

-- ==========================================================================
-- SECTION: CANDIDATE ASSESSMENT
-- ==========================================================================

-- ---------------------------------------------------------------------------
-- candidate_sessions
-- ---------------------------------------------------------------------------
CREATE TABLE candidate_sessions (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id        UUID                   NOT NULL REFERENCES assessments(id) ON DELETE RESTRICT,
    candidate_profile_id UUID                   NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    organization_id      UUID                   NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    status               candidate_session_status NOT NULL DEFAULT 'not_started',
    started_at           TIMESTAMPTZ,
    completed_at         TIMESTAMPTZ,
    created_at           TIMESTAMPTZ            NOT NULL DEFAULT now(),

    CONSTRAINT candidate_sessions_dates_valid CHECK (
        (completed_at IS NULL OR started_at IS NULL OR completed_at >= started_at)
    )
);

COMMENT ON TABLE candidate_sessions IS
    'A candidate''s attempt at an assessment. Tracks lifecycle from invitation through completion.';

-- ---------------------------------------------------------------------------
-- candidate_responses
-- ---------------------------------------------------------------------------
CREATE TABLE candidate_responses (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id       UUID    NOT NULL REFERENCES candidate_sessions(id) ON DELETE CASCADE,
    item_id          UUID    NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
    response_value   NUMERIC NOT NULL,
    response_data    JSONB   NOT NULL DEFAULT '{}'::jsonb,
    response_time_ms INT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT candidate_responses_unique UNIQUE (session_id, item_id),
    CONSTRAINT candidate_responses_time_positive CHECK (response_time_ms IS NULL OR response_time_ms >= 0)
);

COMMENT ON TABLE candidate_responses IS
    'Individual item responses captured during a candidate session. Stores both numeric value and rich data.';

-- ---------------------------------------------------------------------------
-- candidate_scores
-- ---------------------------------------------------------------------------
CREATE TABLE candidate_scores (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id                UUID    NOT NULL REFERENCES candidate_sessions(id) ON DELETE CASCADE,
    competency_id             UUID    NOT NULL REFERENCES competencies(id) ON DELETE RESTRICT,
    raw_score                 NUMERIC NOT NULL,
    scaled_score              NUMERIC NOT NULL,
    percentile                NUMERIC,
    confidence_interval_lower NUMERIC,
    confidence_interval_upper NUMERIC,
    scoring_method            TEXT    NOT NULL,
    created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT candidate_scores_unique UNIQUE (session_id, competency_id),
    CONSTRAINT candidate_scores_percentile_range CHECK (
        percentile IS NULL OR (percentile >= 0 AND percentile <= 100)
    ),
    CONSTRAINT candidate_scores_ci_valid CHECK (
        (confidence_interval_lower IS NULL AND confidence_interval_upper IS NULL)
        OR (confidence_interval_lower IS NOT NULL AND confidence_interval_upper IS NOT NULL
            AND confidence_interval_upper >= confidence_interval_lower)
    )
);

COMMENT ON TABLE candidate_scores IS
    'Computed scores per competency for a candidate session, including confidence intervals and percentiles.';

-- ==========================================================================
-- SECTION: INDEXES
-- ==========================================================================

-- Multi-tenancy
CREATE INDEX idx_organizations_partner_id      ON organizations(partner_id)       WHERE partner_id IS NOT NULL;
CREATE INDEX idx_profiles_partner_id           ON profiles(partner_id)            WHERE partner_id IS NOT NULL;
CREATE INDEX idx_profiles_organization_id      ON profiles(organization_id)       WHERE organization_id IS NOT NULL;
CREATE INDEX idx_profiles_role                 ON profiles(role);
CREATE INDEX idx_profiles_email                ON profiles(email);

-- Competency library
CREATE INDEX idx_competencies_category_id      ON competencies(category_id);
CREATE INDEX idx_items_competency_id           ON items(competency_id);
CREATE INDEX idx_items_response_format_id      ON items(response_format_id);
CREATE INDEX idx_items_status                  ON items(status);
CREATE INDEX idx_item_options_item_id          ON item_options(item_id);
CREATE INDEX idx_item_parameters_item_id       ON item_parameters(item_id);

-- Assessment builder
CREATE INDEX idx_assessments_organization_id   ON assessments(organization_id)    WHERE organization_id IS NOT NULL;
CREATE INDEX idx_assessments_status            ON assessments(status);
CREATE INDEX idx_assessment_competencies_assessment ON assessment_competencies(assessment_id);
CREATE INDEX idx_assessment_competencies_competency ON assessment_competencies(competency_id);
CREATE INDEX idx_item_selection_rules_assessment    ON item_selection_rules(assessment_id);

-- Diagnostic
CREATE INDEX idx_diagnostic_sessions_org       ON diagnostic_sessions(organization_id);
CREATE INDEX idx_diagnostic_sessions_template  ON diagnostic_sessions(template_id)  WHERE template_id IS NOT NULL;
CREATE INDEX idx_diagnostic_sessions_status    ON diagnostic_sessions(status);
CREATE INDEX idx_diagnostic_respondents_session ON diagnostic_respondents(session_id);
CREATE INDEX idx_diagnostic_respondents_profile ON diagnostic_respondents(profile_id) WHERE profile_id IS NOT NULL;
CREATE INDEX idx_diagnostic_responses_respondent ON diagnostic_responses(respondent_id);
CREATE INDEX idx_diagnostic_responses_dimension  ON diagnostic_responses(dimension_id);
CREATE INDEX idx_diagnostic_dimension_weights_session ON diagnostic_dimension_weights(session_id);
CREATE INDEX idx_diagnostic_snapshots_org      ON diagnostic_snapshots(organization_id);
CREATE INDEX idx_diagnostic_snapshots_session  ON diagnostic_snapshots(session_id);
CREATE INDEX idx_diagnostic_template_dimensions_template ON diagnostic_template_dimensions(template_id);
CREATE INDEX idx_diagnostic_template_dimensions_dimension ON diagnostic_template_dimensions(dimension_id);

-- AI matching
CREATE INDEX idx_ai_model_configs_provider     ON ai_model_configs(provider_id);
CREATE INDEX idx_ai_system_prompts_purpose     ON ai_system_prompts(purpose);
CREATE INDEX idx_ai_system_prompts_active      ON ai_system_prompts(is_active)     WHERE is_active = true;
CREATE INDEX idx_matching_runs_org             ON matching_runs(organization_id);
CREATE INDEX idx_matching_runs_session         ON matching_runs(diagnostic_session_id);
CREATE INDEX idx_matching_runs_status          ON matching_runs(status);
CREATE INDEX idx_matching_results_run          ON matching_results(matching_run_id);
CREATE INDEX idx_matching_results_competency   ON matching_results(competency_id);

-- Candidate assessment
CREATE INDEX idx_candidate_sessions_assessment ON candidate_sessions(assessment_id);
CREATE INDEX idx_candidate_sessions_candidate  ON candidate_sessions(candidate_profile_id);
CREATE INDEX idx_candidate_sessions_org        ON candidate_sessions(organization_id);
CREATE INDEX idx_candidate_sessions_status     ON candidate_sessions(status);
CREATE INDEX idx_candidate_responses_session   ON candidate_responses(session_id);
CREATE INDEX idx_candidate_responses_item      ON candidate_responses(item_id);
CREATE INDEX idx_candidate_scores_session      ON candidate_scores(session_id);
CREATE INDEX idx_candidate_scores_competency   ON candidate_scores(competency_id);

-- ==========================================================================
-- SECTION: ROW-LEVEL SECURITY
-- ==========================================================================

-- Enable RLS on every table
ALTER TABLE partners                        ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles                        ENABLE ROW LEVEL SECURITY;
ALTER TABLE competency_categories           ENABLE ROW LEVEL SECURITY;
ALTER TABLE competencies                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE response_formats                ENABLE ROW LEVEL SECURITY;
ALTER TABLE items                           ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_options                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_parameters                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessments                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_competencies         ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_selection_rules            ENABLE ROW LEVEL SECURITY;
ALTER TABLE diagnostic_dimensions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE diagnostic_templates            ENABLE ROW LEVEL SECURITY;
ALTER TABLE diagnostic_template_dimensions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE diagnostic_sessions             ENABLE ROW LEVEL SECURITY;
ALTER TABLE diagnostic_respondents          ENABLE ROW LEVEL SECURITY;
ALTER TABLE diagnostic_responses            ENABLE ROW LEVEL SECURITY;
ALTER TABLE diagnostic_dimension_weights    ENABLE ROW LEVEL SECURITY;
ALTER TABLE diagnostic_snapshots            ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_providers                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_model_configs                ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_system_prompts               ENABLE ROW LEVEL SECURITY;
ALTER TABLE matching_runs                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE matching_results                ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_sessions              ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_responses             ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_scores                ENABLE ROW LEVEL SECURITY;

-- -------------------------------------------------------------------------
-- Policy naming convention: {table}_{action}_{role_scope}
-- -------------------------------------------------------------------------

-- ===== PARTNERS =====

CREATE POLICY partners_select_platform_admin ON partners
    FOR SELECT USING (is_platform_admin());

CREATE POLICY partners_select_own ON partners
    FOR SELECT USING (id = auth_user_partner_id());

CREATE POLICY partners_all_platform_admin ON partners
    FOR ALL USING (is_platform_admin());

-- ===== ORGANIZATIONS =====

CREATE POLICY organizations_select_platform_admin ON organizations
    FOR SELECT USING (is_platform_admin());

CREATE POLICY organizations_select_partner ON organizations
    FOR SELECT USING (partner_id IS NOT NULL AND partner_id = auth_user_partner_id());

CREATE POLICY organizations_select_own ON organizations
    FOR SELECT USING (id = auth_user_organization_id());

CREATE POLICY organizations_all_platform_admin ON organizations
    FOR ALL USING (is_platform_admin());

CREATE POLICY organizations_insert_partner_admin ON organizations
    FOR INSERT WITH CHECK (
        is_partner_admin() AND partner_id = auth_user_partner_id()
    );

CREATE POLICY organizations_update_partner_admin ON organizations
    FOR UPDATE USING (
        is_partner_admin() AND partner_id = auth_user_partner_id()
    );

-- ===== PROFILES =====

CREATE POLICY profiles_select_own ON profiles
    FOR SELECT USING (id = auth.uid());

CREATE POLICY profiles_select_platform_admin ON profiles
    FOR SELECT USING (is_platform_admin());

CREATE POLICY profiles_select_partner ON profiles
    FOR SELECT USING (
        auth_user_role() IN ('partner_admin', 'consultant')
        AND (
            partner_id = auth_user_partner_id()
            OR organization_id IN (
                SELECT o.id FROM organizations o WHERE o.partner_id = auth_user_partner_id()
            )
        )
    );

CREATE POLICY profiles_select_org ON profiles
    FOR SELECT USING (
        auth_user_role() = 'org_admin'
        AND organization_id = auth_user_organization_id()
    );

CREATE POLICY profiles_update_own ON profiles
    FOR UPDATE USING (id = auth.uid())
    WITH CHECK (
        -- Users cannot escalate their own role
        id = auth.uid()
        AND role = (SELECT role FROM profiles WHERE id = auth.uid())
    );

CREATE POLICY profiles_all_platform_admin ON profiles
    FOR ALL USING (is_platform_admin());

-- ===== COMPETENCY LIBRARY (read-accessible to all authenticated users) =====

CREATE POLICY competency_categories_select_authenticated ON competency_categories
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY competency_categories_all_platform_admin ON competency_categories
    FOR ALL USING (is_platform_admin());

CREATE POLICY competencies_select_authenticated ON competencies
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY competencies_all_platform_admin ON competencies
    FOR ALL USING (is_platform_admin());

CREATE POLICY response_formats_select_authenticated ON response_formats
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY response_formats_all_platform_admin ON response_formats
    FOR ALL USING (is_platform_admin());

CREATE POLICY items_select_authenticated ON items
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY items_all_platform_admin ON items
    FOR ALL USING (is_platform_admin());

CREATE POLICY item_options_select_authenticated ON item_options
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY item_options_all_platform_admin ON item_options
    FOR ALL USING (is_platform_admin());

CREATE POLICY item_parameters_select_authenticated ON item_parameters
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY item_parameters_all_platform_admin ON item_parameters
    FOR ALL USING (is_platform_admin());

-- ===== ASSESSMENTS =====

-- Platform-wide assessments (organization_id IS NULL) are visible to all authenticated users.
-- Org-specific assessments require membership in that org or its parent partner.
CREATE POLICY assessments_select_all ON assessments
    FOR SELECT USING (
        is_platform_admin()
        OR organization_id IS NULL
        OR organization_id = auth_user_organization_id()
        OR organization_id IN (
            SELECT o.id FROM organizations o WHERE o.partner_id = auth_user_partner_id()
        )
    );

CREATE POLICY assessments_all_platform_admin ON assessments
    FOR ALL USING (is_platform_admin());

CREATE POLICY assessments_manage_org_admin ON assessments
    FOR ALL USING (
        auth_user_role() = 'org_admin'
        AND organization_id = auth_user_organization_id()
    );

-- Assessment sub-tables follow the assessment's visibility
CREATE POLICY assessment_competencies_select ON assessment_competencies
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM assessments a WHERE a.id = assessment_id
            AND (
                is_platform_admin()
                OR a.organization_id IS NULL
                OR a.organization_id = auth_user_organization_id()
                OR a.organization_id IN (
                    SELECT o.id FROM organizations o WHERE o.partner_id = auth_user_partner_id()
                )
            )
        )
    );

CREATE POLICY assessment_competencies_all_platform_admin ON assessment_competencies
    FOR ALL USING (is_platform_admin());

CREATE POLICY item_selection_rules_select ON item_selection_rules
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM assessments a WHERE a.id = assessment_id
            AND (
                is_platform_admin()
                OR a.organization_id IS NULL
                OR a.organization_id = auth_user_organization_id()
                OR a.organization_id IN (
                    SELECT o.id FROM organizations o WHERE o.partner_id = auth_user_partner_id()
                )
            )
        )
    );

CREATE POLICY item_selection_rules_all_platform_admin ON item_selection_rules
    FOR ALL USING (is_platform_admin());

-- ===== DIAGNOSTIC DIMENSIONS & TEMPLATES (library-level, read to all authenticated) =====

CREATE POLICY diagnostic_dimensions_select_authenticated ON diagnostic_dimensions
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY diagnostic_dimensions_all_platform_admin ON diagnostic_dimensions
    FOR ALL USING (is_platform_admin());

CREATE POLICY diagnostic_templates_select_authenticated ON diagnostic_templates
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY diagnostic_templates_all_platform_admin ON diagnostic_templates
    FOR ALL USING (is_platform_admin());

CREATE POLICY diagnostic_template_dimensions_select_authenticated ON diagnostic_template_dimensions
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY diagnostic_template_dimensions_all_platform_admin ON diagnostic_template_dimensions
    FOR ALL USING (is_platform_admin());

-- ===== DIAGNOSTIC SESSIONS (org-scoped) =====

CREATE POLICY diagnostic_sessions_select ON diagnostic_sessions
    FOR SELECT USING (
        is_platform_admin()
        OR organization_id = auth_user_organization_id()
        OR organization_id IN (
            SELECT o.id FROM organizations o WHERE o.partner_id = auth_user_partner_id()
        )
    );

CREATE POLICY diagnostic_sessions_all_platform_admin ON diagnostic_sessions
    FOR ALL USING (is_platform_admin());

CREATE POLICY diagnostic_sessions_manage_org ON diagnostic_sessions
    FOR ALL USING (
        auth_user_role() IN ('org_admin', 'consultant')
        AND (
            organization_id = auth_user_organization_id()
            OR organization_id IN (
                SELECT o.id FROM organizations o WHERE o.partner_id = auth_user_partner_id()
            )
        )
    );

-- Diagnostic sub-tables derive access from their session's organization
CREATE POLICY diagnostic_respondents_select ON diagnostic_respondents
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM diagnostic_sessions ds WHERE ds.id = session_id
            AND (
                is_platform_admin()
                OR ds.organization_id = auth_user_organization_id()
                OR ds.organization_id IN (
                    SELECT o.id FROM organizations o WHERE o.partner_id = auth_user_partner_id()
                )
            )
        )
    );

CREATE POLICY diagnostic_respondents_all_platform_admin ON diagnostic_respondents
    FOR ALL USING (is_platform_admin());

CREATE POLICY diagnostic_respondents_manage ON diagnostic_respondents
    FOR ALL USING (
        auth_user_role() IN ('org_admin', 'consultant')
        AND EXISTS (
            SELECT 1 FROM diagnostic_sessions ds WHERE ds.id = session_id
            AND (
                ds.organization_id = auth_user_organization_id()
                OR ds.organization_id IN (
                    SELECT o.id FROM organizations o WHERE o.partner_id = auth_user_partner_id()
                )
            )
        )
    );

CREATE POLICY diagnostic_responses_select ON diagnostic_responses
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM diagnostic_respondents dr
            JOIN diagnostic_sessions ds ON ds.id = dr.session_id
            WHERE dr.id = respondent_id
            AND (
                is_platform_admin()
                OR ds.organization_id = auth_user_organization_id()
                OR ds.organization_id IN (
                    SELECT o.id FROM organizations o WHERE o.partner_id = auth_user_partner_id()
                )
            )
        )
    );

CREATE POLICY diagnostic_responses_all_platform_admin ON diagnostic_responses
    FOR ALL USING (is_platform_admin());

-- Respondents can insert their own responses
CREATE POLICY diagnostic_responses_insert_respondent ON diagnostic_responses
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM diagnostic_respondents dr
            WHERE dr.id = respondent_id AND dr.profile_id = auth.uid()
        )
    );

CREATE POLICY diagnostic_dimension_weights_select ON diagnostic_dimension_weights
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM diagnostic_sessions ds WHERE ds.id = session_id
            AND (
                is_platform_admin()
                OR ds.organization_id = auth_user_organization_id()
                OR ds.organization_id IN (
                    SELECT o.id FROM organizations o WHERE o.partner_id = auth_user_partner_id()
                )
            )
        )
    );

CREATE POLICY diagnostic_dimension_weights_all_platform_admin ON diagnostic_dimension_weights
    FOR ALL USING (is_platform_admin());

CREATE POLICY diagnostic_snapshots_select ON diagnostic_snapshots
    FOR SELECT USING (
        is_platform_admin()
        OR organization_id = auth_user_organization_id()
        OR organization_id IN (
            SELECT o.id FROM organizations o WHERE o.partner_id = auth_user_partner_id()
        )
    );

CREATE POLICY diagnostic_snapshots_all_platform_admin ON diagnostic_snapshots
    FOR ALL USING (is_platform_admin());

-- ===== AI PROVIDERS & CONFIGS (platform_admin only for write, read for consultants+) =====

CREATE POLICY ai_providers_select ON ai_providers
    FOR SELECT USING (
        auth_user_role() IN ('platform_admin', 'partner_admin', 'org_admin', 'consultant')
    );

CREATE POLICY ai_providers_all_platform_admin ON ai_providers
    FOR ALL USING (is_platform_admin());

CREATE POLICY ai_model_configs_select ON ai_model_configs
    FOR SELECT USING (
        auth_user_role() IN ('platform_admin', 'partner_admin', 'org_admin', 'consultant')
    );

CREATE POLICY ai_model_configs_all_platform_admin ON ai_model_configs
    FOR ALL USING (is_platform_admin());

CREATE POLICY ai_system_prompts_select ON ai_system_prompts
    FOR SELECT USING (
        auth_user_role() IN ('platform_admin', 'partner_admin', 'org_admin', 'consultant')
    );

CREATE POLICY ai_system_prompts_all_platform_admin ON ai_system_prompts
    FOR ALL USING (is_platform_admin());

-- ===== MATCHING RUNS & RESULTS (org-scoped) =====

CREATE POLICY matching_runs_select ON matching_runs
    FOR SELECT USING (
        is_platform_admin()
        OR organization_id = auth_user_organization_id()
        OR organization_id IN (
            SELECT o.id FROM organizations o WHERE o.partner_id = auth_user_partner_id()
        )
    );

CREATE POLICY matching_runs_all_platform_admin ON matching_runs
    FOR ALL USING (is_platform_admin());

CREATE POLICY matching_runs_manage ON matching_runs
    FOR ALL USING (
        auth_user_role() IN ('org_admin', 'consultant')
        AND (
            organization_id = auth_user_organization_id()
            OR organization_id IN (
                SELECT o.id FROM organizations o WHERE o.partner_id = auth_user_partner_id()
            )
        )
    );

CREATE POLICY matching_results_select ON matching_results
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM matching_runs mr WHERE mr.id = matching_run_id
            AND (
                is_platform_admin()
                OR mr.organization_id = auth_user_organization_id()
                OR mr.organization_id IN (
                    SELECT o.id FROM organizations o WHERE o.partner_id = auth_user_partner_id()
                )
            )
        )
    );

CREATE POLICY matching_results_all_platform_admin ON matching_results
    FOR ALL USING (is_platform_admin());

-- ===== CANDIDATE SESSIONS, RESPONSES & SCORES =====

CREATE POLICY candidate_sessions_select ON candidate_sessions
    FOR SELECT USING (
        is_platform_admin()
        OR candidate_profile_id = auth.uid()
        OR organization_id = auth_user_organization_id()
        OR organization_id IN (
            SELECT o.id FROM organizations o WHERE o.partner_id = auth_user_partner_id()
        )
    );

CREATE POLICY candidate_sessions_all_platform_admin ON candidate_sessions
    FOR ALL USING (is_platform_admin());

CREATE POLICY candidate_sessions_manage_org ON candidate_sessions
    FOR INSERT WITH CHECK (
        auth_user_role() IN ('org_admin', 'consultant', 'assessor')
        AND (
            organization_id = auth_user_organization_id()
            OR organization_id IN (
                SELECT o.id FROM organizations o WHERE o.partner_id = auth_user_partner_id()
            )
        )
    );

-- Candidates can update their own session (start, complete)
CREATE POLICY candidate_sessions_update_own ON candidate_sessions
    FOR UPDATE USING (candidate_profile_id = auth.uid());

CREATE POLICY candidate_responses_select ON candidate_responses
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM candidate_sessions cs WHERE cs.id = session_id
            AND (
                is_platform_admin()
                OR cs.candidate_profile_id = auth.uid()
                OR cs.organization_id = auth_user_organization_id()
                OR cs.organization_id IN (
                    SELECT o.id FROM organizations o WHERE o.partner_id = auth_user_partner_id()
                )
            )
        )
    );

CREATE POLICY candidate_responses_all_platform_admin ON candidate_responses
    FOR ALL USING (is_platform_admin());

-- Candidates can insert their own responses
CREATE POLICY candidate_responses_insert_own ON candidate_responses
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM candidate_sessions cs
            WHERE cs.id = session_id
            AND cs.candidate_profile_id = auth.uid()
            AND cs.status = 'in_progress'
        )
    );

CREATE POLICY candidate_scores_select ON candidate_scores
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM candidate_sessions cs WHERE cs.id = session_id
            AND (
                is_platform_admin()
                OR cs.candidate_profile_id = auth.uid()
                OR cs.organization_id = auth_user_organization_id()
                OR cs.organization_id IN (
                    SELECT o.id FROM organizations o WHERE o.partner_id = auth_user_partner_id()
                )
            )
        )
    );

CREATE POLICY candidate_scores_all_platform_admin ON candidate_scores
    FOR ALL USING (is_platform_admin());

-- ==========================================================================
-- SECTION: TRIGGERS (updated_at auto-stamp)
-- ==========================================================================

CREATE TRIGGER trg_partners_updated_at
    BEFORE UPDATE ON partners
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_organizations_updated_at
    BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_competencies_updated_at
    BEFORE UPDATE ON competencies
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_items_updated_at
    BEFORE UPDATE ON items
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_assessments_updated_at
    BEFORE UPDATE ON assessments
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_diagnostic_dimensions_updated_at
    BEFORE UPDATE ON diagnostic_dimensions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_diagnostic_templates_updated_at
    BEFORE UPDATE ON diagnostic_templates
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_diagnostic_sessions_updated_at
    BEFORE UPDATE ON diagnostic_sessions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_ai_model_configs_updated_at
    BEFORE UPDATE ON ai_model_configs
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_ai_system_prompts_updated_at
    BEFORE UPDATE ON ai_system_prompts
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ==========================================================================
-- END OF MIGRATION
-- ==========================================================================
