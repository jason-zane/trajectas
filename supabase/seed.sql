begin;

-- Deterministic local fixtures for seeded Playwright coverage.
-- These rows back the local-development admin bypass and token-based runner flows.

insert into partners (
  id,
  name,
  slug,
  settings,
  created_at,
  updated_at
)
values (
  '10000000-0000-0000-0000-000000000001',
  'Seeded Advisory Group',
  'seeded-advisory-group',
  '{}'::jsonb,
  '2026-03-01T00:00:00Z',
  '2026-03-01T00:00:00Z'
)
on conflict (id) do update
set
  name = excluded.name,
  slug = excluded.slug,
  settings = excluded.settings,
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
  items_per_page,
  time_limit_seconds,
  allow_back_nav,
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
  1,
  600,
  true,
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
  items_per_page = excluded.items_per_page,
  time_limit_seconds = excluded.time_limit_seconds,
  allow_back_nav = excluded.allow_back_nav,
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
    '2026-03-01T00:00:00Z',
    '2026-04-30T23:59:59Z',
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
on conflict (campaign_id, assessment_id) do update
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
  '2026-04-30T23:59:59Z',
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

commit;
