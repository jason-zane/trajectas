begin;

-- Deterministic local fixtures for seeded Playwright coverage.
-- These rows back the local-development admin bypass and token-based runner flows.

insert into partners (
  id,
  name,
  slug,
  settings,
  created_at,
  updated_at,
  can_customize_branding
)
values (
  '10000000-0000-0000-0000-000000000001',
  'Seeded Advisory Group',
  'seeded-advisory-group',
  '{}'::jsonb,
  '2026-03-01T00:00:00Z',
  '2026-03-01T00:00:00Z',
  -- Branding on, so the partner console's Branding tab is exercisable; the
  -- "not enabled" empty state is covered by flipping this off in a test.
  true
)
on conflict (id) do update
set
  name = excluded.name,
  slug = excluded.slug,
  settings = excluded.settings,
  can_customize_branding = excluded.can_customize_branding,
  updated_at = excluded.updated_at;

-- A second partner and its client, so the cross-partner boundary can be tested
-- against a client that really exists. Pointing the test at a made-up slug only
-- exercises the "no such row" branch, which would still pass if a partner could
-- reach every other partner's clients.
insert into partners (
  id,
  name,
  slug,
  settings,
  created_at,
  updated_at,
  can_customize_branding
)
values (
  '20000000-0000-0000-0000-000000000002',
  'Rival Advisory Group',
  'rival-advisory-group',
  '{}'::jsonb,
  '2026-03-01T00:00:00Z',
  '2026-03-01T00:00:00Z',
  false
)
on conflict (id) do update
set
  name = excluded.name,
  slug = excluded.slug,
  can_customize_branding = excluded.can_customize_branding,
  updated_at = excluded.updated_at;

insert into clients (
  id,
  partner_id,
  name,
  slug,
  industry,
  settings,
  created_at,
  updated_at,
  deleted_at
)
values (
  '20000000-0000-0000-0000-000000000102',
  '20000000-0000-0000-0000-000000000002',
  'Rival Client Co',
  'rival-client-co',
  'Technology',
  '{}'::jsonb,
  '2026-03-01T00:00:00Z',
  '2026-03-01T00:00:00Z',
  null
)
on conflict (id) do update
set
  partner_id = excluded.partner_id,
  name = excluded.name,
  slug = excluded.slug,
  updated_at = excluded.updated_at;

insert into clients (
  id,
  partner_id,
  name,
  slug,
  industry,
  settings,
  created_at,
  updated_at,
  deleted_at
)
values (
  '10000000-0000-0000-0000-000000000101',
  '10000000-0000-0000-0000-000000000001',
  'Seeded Client Co',
  'seeded-client-co',
  'Technology',
  '{}'::jsonb,
  '2026-03-01T00:00:00Z',
  '2026-03-01T00:00:00Z',
  null
)
on conflict (id) do update
set
  partner_id = excluded.partner_id,
  name = excluded.name,
  slug = excluded.slug,
  industry = excluded.industry,
  settings = excluded.settings,
  updated_at = excluded.updated_at,
  deleted_at = excluded.deleted_at;

insert into assessments (
  id,
  client_id,
  title,
  slug,
  description,
  scoring_method,
  item_selection_strategy,
  status,
  time_limit_minutes,
  format_mode,
  created_at,
  updated_at,
  deleted_at
)
values (
  '10000000-0000-0000-0000-000000000201',
  '10000000-0000-0000-0000-000000000101',
  'Seeded Leadership Assessment',
  'seeded-leadership-assessment',
  'Deterministic local assessment used for admin and participant workflow coverage.',
  'ctt',
  'fixed',
  'active',
  20,
  'traditional',
  '2026-03-01T00:00:00Z',
  '2026-03-01T00:00:00Z',
  null
)
on conflict (id) do update
set
  client_id = excluded.client_id,
  title = excluded.title,
  slug = excluded.slug,
  description = excluded.description,
  scoring_method = excluded.scoring_method,
  item_selection_strategy = excluded.item_selection_strategy,
  status = excluded.status,
  time_limit_minutes = excluded.time_limit_minutes,
  format_mode = excluded.format_mode,
  updated_at = excluded.updated_at,
  deleted_at = excluded.deleted_at;

insert into assessment_sections (
  id,
  assessment_id,
  response_format_id,
  title,
  instructions,
  display_order,
  item_ordering,
  time_limit_seconds,
  created_at,
  updated_at
)
values (
  '10000000-0000-0000-0000-000000000301',
  '10000000-0000-0000-0000-000000000201',
  'a5000000-0000-0000-0000-000000000001',
  'Core Leadership Signals',
  'Choose the response that best matches your typical behaviour.',
  0,
  'fixed',
  600,
  '2026-03-01T00:00:00Z',
  '2026-03-01T00:00:00Z'
)
on conflict (id) do update
set
  assessment_id = excluded.assessment_id,
  response_format_id = excluded.response_format_id,
  title = excluded.title,
  instructions = excluded.instructions,
  display_order = excluded.display_order,
  item_ordering = excluded.item_ordering,
  time_limit_seconds = excluded.time_limit_seconds,
  updated_at = excluded.updated_at;

insert into assessment_section_items (
  id,
  section_id,
  item_id,
  display_order,
  created_at
)
values
  (
    '10000000-0000-0000-0000-000000000311',
    '10000000-0000-0000-0000-000000000301',
    'a6000000-0000-0000-0000-000000000001',
    0,
    '2026-03-01T00:00:00Z'
  ),
  (
    '10000000-0000-0000-0000-000000000312',
    '10000000-0000-0000-0000-000000000301',
    'a6000000-0000-0000-0000-000000000002',
    1,
    '2026-03-01T00:00:00Z'
  ),
  (
    '10000000-0000-0000-0000-000000000313',
    '10000000-0000-0000-0000-000000000301',
    'a6000000-0000-0000-0000-000000000005',
    2,
    '2026-03-01T00:00:00Z'
  )
on conflict (section_id, item_id) do update
set
  display_order = excluded.display_order;

insert into campaigns (
  id,
  title,
  slug,
  description,
  status,
  client_id,
  partner_id,
  opens_at,
  closes_at,
  branding,
  allow_resume,
  show_progress,
  randomize_assessment_order,
  created_at,
  updated_at,
  deleted_at
)
values
  (
    '10000000-0000-0000-0000-000000000401',
    'Seeded Leadership Campaign',
    'seeded-leadership-campaign',
    'Primary seeded campaign covering invited, in-progress, completed, and revoked participant states.',
    'active',
    '10000000-0000-0000-0000-000000000101',
    '10000000-0000-0000-0000-000000000001',
    now() - interval '90 days',
    now() + interval '180 days',
    '{}'::jsonb,
    true,
    true,
    false,
    '2026-03-01T00:00:00Z',
    '2026-03-10T00:00:00Z',
    null
  ),
  (
    '10000000-0000-0000-0000-000000000402',
    'Seeded Closed Campaign',
    'seeded-closed-campaign',
    'Closed seeded campaign used to verify campaign access gating.',
    'closed',
    '10000000-0000-0000-0000-000000000101',
    '10000000-0000-0000-0000-000000000001',
    '2026-01-01T00:00:00Z',
    '2026-02-01T00:00:00Z',
    '{}'::jsonb,
    true,
    true,
    false,
    '2026-01-01T00:00:00Z',
    '2026-02-02T00:00:00Z',
    null
  )
on conflict (id) do update
set
  title = excluded.title,
  slug = excluded.slug,
  description = excluded.description,
  status = excluded.status,
  client_id = excluded.client_id,
  partner_id = excluded.partner_id,
  opens_at = excluded.opens_at,
  closes_at = excluded.closes_at,
  branding = excluded.branding,
  allow_resume = excluded.allow_resume,
  show_progress = excluded.show_progress,
  randomize_assessment_order = excluded.randomize_assessment_order,
  updated_at = excluded.updated_at,
  deleted_at = excluded.deleted_at;

insert into campaign_assessments (
  id,
  campaign_id,
  assessment_id,
  display_order,
  is_required,
  created_at
)
values
  (
    '10000000-0000-0000-0000-000000000411',
    '10000000-0000-0000-0000-000000000401',
    '10000000-0000-0000-0000-000000000201',
    0,
    true,
    '2026-03-01T00:00:00Z'
  ),
  (
    '10000000-0000-0000-0000-000000000412',
    '10000000-0000-0000-0000-000000000402',
    '10000000-0000-0000-0000-000000000201',
    0,
    true,
    '2026-01-01T00:00:00Z'
  )
-- campaign_assessments_live_unique is a partial index (WHERE deleted_at IS
-- NULL, migration 20260810092000); ON CONFLICT must state the predicate to
-- infer it.
on conflict (campaign_id, assessment_id) where deleted_at is null do update
set
  display_order = excluded.display_order,
  is_required = excluded.is_required;

insert into campaign_access_links (
  id,
  campaign_id,
  token,
  label,
  max_uses,
  use_count,
  expires_at,
  is_active,
  created_at
)
values (
  '10000000-0000-0000-0000-000000000451',
  '10000000-0000-0000-0000-000000000401',
  'seed-open-link',
  'Seeded open enrollment',
  50,
  0,
  now() + interval '180 days',
  true,
  '2026-03-01T00:00:00Z'
)
on conflict (id) do update
set
  campaign_id = excluded.campaign_id,
  token = excluded.token,
  label = excluded.label,
  max_uses = excluded.max_uses,
  use_count = excluded.use_count,
  expires_at = excluded.expires_at,
  is_active = excluded.is_active;

insert into campaign_participants (
  id,
  campaign_id,
  email,
  first_name,
  last_name,
  access_token,
  status,
  invited_at,
  started_at,
  completed_at,
  created_at,
  updated_at
)
values
  (
    '10000000-0000-0000-0000-000000000501',
    '10000000-0000-0000-0000-000000000401',
    'avery.invited@example.com',
    'Avery',
    'Invited',
    'seed-invited-token',
    'invited',
    '2026-03-15T09:00:00Z',
    null,
    null,
    '2026-03-15T09:00:00Z',
    '2026-03-15T09:00:00Z'
  ),
  (
    '10000000-0000-0000-0000-000000000502',
    '10000000-0000-0000-0000-000000000401',
    'blake.progress@example.com',
    'Blake',
    'Progress',
    'seed-in-progress-token',
    'in_progress',
    '2026-03-14T09:00:00Z',
    '2026-03-18T09:10:00Z',
    null,
    '2026-03-14T09:00:00Z',
    '2026-03-18T09:10:00Z'
  ),
  (
    '10000000-0000-0000-0000-000000000503',
    '10000000-0000-0000-0000-000000000401',
    'casey.completed@example.com',
    'Casey',
    'Completed',
    'seed-completed-token',
    'completed',
    '2026-03-13T09:00:00Z',
    '2026-03-13T09:15:00Z',
    '2026-03-13T09:32:00Z',
    '2026-03-13T09:00:00Z',
    '2026-03-13T09:32:00Z'
  ),
  (
    '10000000-0000-0000-0000-000000000504',
    '10000000-0000-0000-0000-000000000401',
    'river.revoked@example.com',
    'River',
    'Revoked',
    'seed-revoked-token',
    'expired',
    '2026-03-12T09:00:00Z',
    null,
    null,
    '2026-03-12T09:00:00Z',
    '2026-03-20T09:00:00Z'
  ),
  (
    '10000000-0000-0000-0000-000000000505',
    '10000000-0000-0000-0000-000000000402',
    'sam.closed@example.com',
    'Sam',
    'Closed',
    'seed-closed-token',
    'invited',
    '2026-01-20T09:00:00Z',
    null,
    null,
    '2026-01-20T09:00:00Z',
    '2026-01-20T09:00:00Z'
  )
on conflict (id) do update
set
  campaign_id = excluded.campaign_id,
  email = excluded.email,
  first_name = excluded.first_name,
  last_name = excluded.last_name,
  access_token = excluded.access_token,
  status = excluded.status,
  invited_at = excluded.invited_at,
  started_at = excluded.started_at,
  completed_at = excluded.completed_at,
  updated_at = excluded.updated_at;

insert into participant_sessions (
  id,
  assessment_id,
  participant_profile_id,
  client_id,
  status,
  started_at,
  completed_at,
  created_at,
  campaign_id,
  campaign_participant_id,
  current_section_id,
  current_item_index,
  time_remaining_seconds,
  processing_status,
  processing_error,
  processed_at
)
values
  (
    '10000000-0000-0000-0000-000000000601',
    '10000000-0000-0000-0000-000000000201',
    null,
    '10000000-0000-0000-0000-000000000101',
    'in_progress',
    '2026-03-18T09:10:00Z',
    null,
    '2026-03-18T09:10:00Z',
    '10000000-0000-0000-0000-000000000401',
    '10000000-0000-0000-0000-000000000502',
    '10000000-0000-0000-0000-000000000301',
    1,
    '{"10000000-0000-0000-0000-000000000301": 420}'::jsonb,
    'idle',
    null,
    null
  ),
  (
    '10000000-0000-0000-0000-000000000602',
    '10000000-0000-0000-0000-000000000201',
    null,
    '10000000-0000-0000-0000-000000000101',
    'completed',
    '2026-03-13T09:15:00Z',
    '2026-03-13T09:32:00Z',
    '2026-03-13T09:15:00Z',
    '10000000-0000-0000-0000-000000000401',
    '10000000-0000-0000-0000-000000000503',
    '10000000-0000-0000-0000-000000000301',
    2,
    '{}'::jsonb,
    'ready',
    null,
    '2026-03-13T09:32:00Z'
  )
on conflict (id) do update
set
  assessment_id = excluded.assessment_id,
  participant_profile_id = excluded.participant_profile_id,
  client_id = excluded.client_id,
  status = excluded.status,
  started_at = excluded.started_at,
  completed_at = excluded.completed_at,
  campaign_id = excluded.campaign_id,
  campaign_participant_id = excluded.campaign_participant_id,
  current_section_id = excluded.current_section_id,
  current_item_index = excluded.current_item_index,
  time_remaining_seconds = excluded.time_remaining_seconds,
  processing_status = excluded.processing_status,
  processing_error = excluded.processing_error,
  processed_at = excluded.processed_at;

insert into participant_responses (
  id,
  session_id,
  item_id,
  response_value,
  response_data,
  response_time_ms,
  created_at,
  section_id
)
values
  (
    '10000000-0000-0000-0000-000000000701',
    '10000000-0000-0000-0000-000000000601',
    'a6000000-0000-0000-0000-000000000001',
    4,
    '{}'::jsonb,
    1200,
    '2026-03-18T09:12:00Z',
    '10000000-0000-0000-0000-000000000301'
  ),
  (
    '10000000-0000-0000-0000-000000000702',
    '10000000-0000-0000-0000-000000000602',
    'a6000000-0000-0000-0000-000000000001',
    5,
    '{}'::jsonb,
    1100,
    '2026-03-13T09:16:00Z',
    '10000000-0000-0000-0000-000000000301'
  ),
  (
    '10000000-0000-0000-0000-000000000703',
    '10000000-0000-0000-0000-000000000602',
    'a6000000-0000-0000-0000-000000000002',
    4,
    '{}'::jsonb,
    1030,
    '2026-03-13T09:20:00Z',
    '10000000-0000-0000-0000-000000000301'
  ),
  (
    '10000000-0000-0000-0000-000000000704',
    '10000000-0000-0000-0000-000000000602',
    'a6000000-0000-0000-0000-000000000005',
    3,
    '{}'::jsonb,
    980,
    '2026-03-13T09:24:00Z',
    '10000000-0000-0000-0000-000000000301'
  )
on conflict (session_id, item_id) do update
set
  response_value = excluded.response_value,
  response_data = excluded.response_data,
  response_time_ms = excluded.response_time_ms,
  section_id = excluded.section_id;

-- ── Seeded admin actor ──────────────────────────────────────────────────────
-- Backs the authenticated half of the seeded Playwright suite (the "seeded
-- admin workspace" tests). The e2e harness serves every surface on one host, so
-- the request surface always resolves to "public" and `isPlatformAdmin` is never
-- true there; the dashboard renders via the host-based local-dev gate and the
-- page data actions scope to this actor's client via auth_user_client_ids().
-- That membership (admin on Seeded Client Co) is what makes the seeded
-- campaigns/participants visible. Passwordless by design — no encrypted_password
-- is set; sessions are minted at test time via the Supabase admin API + OTP
-- verify (see tests/e2e/seeded/auth.ts). Confined to the local test stack.
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  is_sso_user,
  is_anonymous,
  -- GoTrue scans these token columns as non-null strings; leaving them NULL
  -- makes admin lookups fail with "Database error finding user".
  confirmation_token,
  recovery_token,
  email_change,
  email_change_token_new
)
values (
  '00000000-0000-0000-0000-000000000000',
  '10000000-0000-0000-0000-000000000111',
  'authenticated',
  'authenticated',
  'seed-admin@seeded-client-co.test',
  '2026-03-01T00:00:00Z',
  '2026-03-01T00:00:00Z',
  '2026-03-01T00:00:00Z',
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  false,
  false,
  false,
  '',
  '',
  '',
  ''
)
on conflict (id) do update
set
  email = excluded.email,
  email_confirmed_at = excluded.email_confirmed_at,
  raw_app_meta_data = excluded.raw_app_meta_data,
  confirmation_token = excluded.confirmation_token,
  recovery_token = excluded.recovery_token,
  email_change = excluded.email_change,
  email_change_token_new = excluded.email_change_token_new,
  updated_at = excluded.updated_at;

insert into auth.identities (
  provider_id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
values (
  '10000000-0000-0000-0000-000000000111',
  '10000000-0000-0000-0000-000000000111',
  jsonb_build_object(
    'sub', '10000000-0000-0000-0000-000000000111',
    'email', 'seed-admin@seeded-client-co.test',
    'email_verified', true
  ),
  'email',
  '2026-03-01T00:00:00Z',
  '2026-03-01T00:00:00Z',
  '2026-03-01T00:00:00Z'
)
on conflict (provider_id, provider) do update
set
  identity_data = excluded.identity_data,
  updated_at = excluded.updated_at;

insert into profiles (
  id,
  partner_id,
  client_id,
  role,
  first_name,
  last_name,
  email,
  display_name,
  is_active,
  created_at,
  updated_at
)
values (
  '10000000-0000-0000-0000-000000000111',
  null,
  '10000000-0000-0000-0000-000000000101',
  'org_admin',
  'Seeded',
  'Admin',
  'seed-admin@seeded-client-co.test',
  'Seeded Admin',
  true,
  '2026-03-01T00:00:00Z',
  '2026-03-01T00:00:00Z'
)
on conflict (id) do update
set
  partner_id = excluded.partner_id,
  client_id = excluded.client_id,
  role = excluded.role,
  first_name = excluded.first_name,
  last_name = excluded.last_name,
  email = excluded.email,
  display_name = excluded.display_name,
  is_active = excluded.is_active,
  updated_at = excluded.updated_at;

insert into client_memberships (
  id,
  profile_id,
  client_id,
  role,
  is_default,
  created_at,
  updated_at
)
values (
  '10000000-0000-0000-0000-000000000121',
  '10000000-0000-0000-0000-000000000111',
  '10000000-0000-0000-0000-000000000101',
  'admin',
  true,
  '2026-03-01T00:00:00Z',
  '2026-03-01T00:00:00Z'
)
on conflict (profile_id, client_id) do update
set
  role = excluded.role,
  is_default = excluded.is_default,
  updated_at = excluded.updated_at;

-- The seeded PARTNER admin, for the partner-portal e2e journey. Admin of
-- Seeded Advisory Group, which owns Seeded Client Co — so this actor reaches
-- the client console through its partner membership, not a client one. Same
-- passwordless model as the client admin above.
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  is_sso_user,
  is_anonymous,
  confirmation_token,
  recovery_token,
  email_change,
  email_change_token_new
)
values (
  '00000000-0000-0000-0000-000000000000',
  '10000000-0000-0000-0000-000000000112',
  'authenticated',
  'authenticated',
  'seed-partner-admin@seeded-advisory-group.test',
  '2026-03-01T00:00:00Z',
  '2026-03-01T00:00:00Z',
  '2026-03-01T00:00:00Z',
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  false,
  false,
  false,
  '',
  '',
  '',
  ''
)
on conflict (id) do update
set
  email = excluded.email,
  email_confirmed_at = excluded.email_confirmed_at,
  raw_app_meta_data = excluded.raw_app_meta_data,
  confirmation_token = excluded.confirmation_token,
  recovery_token = excluded.recovery_token,
  email_change = excluded.email_change,
  email_change_token_new = excluded.email_change_token_new,
  updated_at = excluded.updated_at;

insert into auth.identities (
  provider_id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
values (
  '10000000-0000-0000-0000-000000000112',
  '10000000-0000-0000-0000-000000000112',
  jsonb_build_object(
    'sub', '10000000-0000-0000-0000-000000000112',
    'email', 'seed-partner-admin@seeded-advisory-group.test',
    'email_verified', true
  ),
  'email',
  '2026-03-01T00:00:00Z',
  '2026-03-01T00:00:00Z',
  '2026-03-01T00:00:00Z'
)
on conflict (provider_id, provider) do update
set
  identity_data = excluded.identity_data,
  updated_at = excluded.updated_at;

insert into profiles (
  id,
  partner_id,
  client_id,
  role,
  first_name,
  last_name,
  email,
  display_name,
  is_active,
  created_at,
  updated_at
)
values (
  '10000000-0000-0000-0000-000000000112',
  '10000000-0000-0000-0000-000000000001',
  null,
  'partner_admin',
  'Seeded',
  'Partner',
  'seed-partner-admin@seeded-advisory-group.test',
  'Seeded Partner Admin',
  true,
  '2026-03-01T00:00:00Z',
  '2026-03-01T00:00:00Z'
)
on conflict (id) do update
set
  partner_id = excluded.partner_id,
  client_id = excluded.client_id,
  role = excluded.role,
  first_name = excluded.first_name,
  last_name = excluded.last_name,
  email = excluded.email,
  display_name = excluded.display_name,
  is_active = excluded.is_active,
  updated_at = excluded.updated_at;

insert into partner_memberships (
  id,
  profile_id,
  partner_id,
  role,
  is_default,
  created_at,
  updated_at
)
values (
  '10000000-0000-0000-0000-000000000122',
  '10000000-0000-0000-0000-000000000112',
  '10000000-0000-0000-0000-000000000001',
  'admin',
  true,
  '2026-03-01T00:00:00Z',
  '2026-03-01T00:00:00Z'
)
on conflict (profile_id, partner_id) do update
set
  role = excluded.role,
  is_default = excluded.is_default,
  updated_at = excluded.updated_at;

-- The partner's allocation for the seeded assessment, capped at 25 so the
-- assign dialog's cap rule and the pool guard are both exercisable. The
-- assessment is client-owned, so D4 would admit it anyway; the cap is the point.
-- Seeded last: assigned_by references a profile created further down.
insert into partner_assessment_assignments (
  id,
  partner_id,
  assessment_id,
  quota_limit,
  assigned_by,
  created_at,
  updated_at
)
values (
  '10000000-0000-0000-0000-000000000211',
  '10000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000201',
  25,
  '10000000-0000-0000-0000-000000000111',
  '2026-03-01T00:00:00Z',
  '2026-03-01T00:00:00Z'
)
on conflict (id) do update
set
  quota_limit = excluded.quota_limit,
  is_active = true,
  updated_at = excluded.updated_at;

commit;
