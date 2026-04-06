-- Internal integrations API foundation.
-- This creates the credential, mapping, idempotency, launch, webhook, and
-- outbox tables required for the private API substrate.

CREATE TABLE IF NOT EXISTS integration_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  provider_slug TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'internal_api',
  display_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,

  CONSTRAINT integration_connections_provider_slug_not_empty
    CHECK (length(trim(provider_slug)) > 0),
  CONSTRAINT integration_connections_display_name_not_empty
    CHECK (length(trim(display_name)) > 0),
  CONSTRAINT integration_connections_mode_check
    CHECK (mode IN ('internal_api', 'ats', 'hris')),
  CONSTRAINT integration_connections_status_check
    CHECK (status IN ('active', 'inactive'))
);

COMMENT ON TABLE integration_connections IS
  'Client-scoped integration connection records for internal API credentials and future ATS/HRIS adapters.';

CREATE INDEX IF NOT EXISTS idx_integration_connections_client
  ON integration_connections (client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_integration_connections_provider
  ON integration_connections (provider_slug, mode)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_integration_connections_updated_at ON integration_connections;
CREATE TRIGGER trg_integration_connections_updated_at
  BEFORE UPDATE ON integration_connections
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS integration_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_connection_id UUID NOT NULL REFERENCES integration_connections(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  secret_hash TEXT NOT NULL,
  scopes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  status TEXT NOT NULL DEFAULT 'active',
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT integration_credentials_label_not_empty
    CHECK (length(trim(label)) > 0),
  CONSTRAINT integration_credentials_key_prefix_not_empty
    CHECK (length(trim(key_prefix)) > 0),
  CONSTRAINT integration_credentials_secret_hash_not_empty
    CHECK (length(trim(secret_hash)) > 0),
  CONSTRAINT integration_credentials_status_check
    CHECK (status IN ('active', 'revoked'))
);

COMMENT ON TABLE integration_credentials IS
  'Hashed TalentFit-issued machine credentials used by the private integrations API.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_integration_credentials_key_prefix_unique
  ON integration_credentials (key_prefix);
CREATE INDEX IF NOT EXISTS idx_integration_credentials_client
  ON integration_credentials (client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_integration_credentials_active
  ON integration_credentials (integration_connection_id, status)
  WHERE revoked_at IS NULL;

DROP TRIGGER IF EXISTS trg_integration_credentials_updated_at ON integration_credentials;
CREATE TRIGGER trg_integration_credentials_updated_at
  BEFORE UPDATE ON integration_credentials
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS integration_idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_credential_id UUID NOT NULL REFERENCES integration_credentials(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  request_method TEXT NOT NULL,
  request_path TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_progress',
  response_status INTEGER,
  response_body JSONB,
  resource_type TEXT,
  resource_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),

  CONSTRAINT integration_idempotency_key_not_empty
    CHECK (length(trim(idempotency_key)) > 0),
  CONSTRAINT integration_idempotency_request_hash_not_empty
    CHECK (length(trim(request_hash)) > 0),
  CONSTRAINT integration_idempotency_status_check
    CHECK (status IN ('in_progress', 'completed'))
);

COMMENT ON TABLE integration_idempotency_keys IS
  'Replay protection and deterministic response storage for private integrations API mutations.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_integration_idempotency_unique
  ON integration_idempotency_keys (
    integration_credential_id,
    request_method,
    request_path,
    idempotency_key
  );
CREATE INDEX IF NOT EXISTS idx_integration_idempotency_client
  ON integration_idempotency_keys (client_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_integration_idempotency_updated_at ON integration_idempotency_keys;
CREATE TRIGGER trg_integration_idempotency_updated_at
  BEFORE UPDATE ON integration_idempotency_keys
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS integration_external_refs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_connection_id UUID NOT NULL REFERENCES integration_connections(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  local_table TEXT NOT NULL,
  local_id UUID NOT NULL,
  source_system TEXT NOT NULL,
  remote_object_type TEXT NOT NULL,
  remote_id TEXT NOT NULL,
  secondary_remote_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT integration_external_refs_local_table_not_empty
    CHECK (length(trim(local_table)) > 0),
  CONSTRAINT integration_external_refs_source_system_not_empty
    CHECK (length(trim(source_system)) > 0),
  CONSTRAINT integration_external_refs_remote_object_type_not_empty
    CHECK (length(trim(remote_object_type)) > 0),
  CONSTRAINT integration_external_refs_remote_id_not_empty
    CHECK (length(trim(remote_id)) > 0)
);

COMMENT ON TABLE integration_external_refs IS
  'Mappings between TalentFit records and external ATS/HRIS identifiers.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_integration_external_refs_unique_mapping
  ON integration_external_refs (
    integration_connection_id,
    COALESCE(campaign_id, '00000000-0000-0000-0000-000000000000'::uuid),
    source_system,
    remote_object_type,
    remote_id,
    local_table,
    local_id
  );
CREATE INDEX IF NOT EXISTS idx_integration_external_refs_lookup
  ON integration_external_refs (
    integration_connection_id,
    campaign_id,
    source_system,
    remote_object_type,
    remote_id
  );
CREATE INDEX IF NOT EXISTS idx_integration_external_refs_local
  ON integration_external_refs (local_table, local_id);

DROP TRIGGER IF EXISTS trg_integration_external_refs_updated_at ON integration_external_refs;
CREATE TRIGGER trg_integration_external_refs_updated_at
  BEFORE UPDATE ON integration_external_refs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS integration_launches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_connection_id UUID NOT NULL REFERENCES integration_connections(id) ON DELETE CASCADE,
  integration_credential_id UUID REFERENCES integration_credentials(id) ON DELETE SET NULL,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  campaign_participant_id UUID NOT NULL REFERENCES campaign_participants(id) ON DELETE CASCADE,
  delivery_method TEXT NOT NULL DEFAULT 'link',
  status TEXT NOT NULL DEFAULT 'created',
  assessment_url TEXT NOT NULL,
  launched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivered_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT integration_launches_delivery_method_check
    CHECK (delivery_method IN ('link', 'email')),
  CONSTRAINT integration_launches_status_check
    CHECK (status IN ('created', 'delivered', 'delivery_failed')),
  CONSTRAINT integration_launches_assessment_url_not_empty
    CHECK (length(trim(assessment_url)) > 0)
);

COMMENT ON TABLE integration_launches IS
  'Recorded assessment launches initiated by the private integrations API.';

CREATE INDEX IF NOT EXISTS idx_integration_launches_participant
  ON integration_launches (campaign_participant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_integration_launches_client
  ON integration_launches (client_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_integration_launches_updated_at ON integration_launches;
CREATE TRIGGER trg_integration_launches_updated_at
  BEFORE UPDATE ON integration_launches
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS integration_events_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  aggregate_type TEXT NOT NULL,
  aggregate_id UUID NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  dispatched_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT integration_events_outbox_event_type_not_empty
    CHECK (length(trim(event_type)) > 0),
  CONSTRAINT integration_events_outbox_aggregate_type_not_empty
    CHECK (length(trim(aggregate_type)) > 0),
  CONSTRAINT integration_events_outbox_status_check
    CHECK (status IN ('pending', 'dispatched', 'failed'))
);

COMMENT ON TABLE integration_events_outbox IS
  'Outbox of integration events awaiting client webhook delivery.';

CREATE INDEX IF NOT EXISTS idx_integration_events_outbox_pending
  ON integration_events_outbox (status, available_at)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_integration_events_outbox_client
  ON integration_events_outbox (client_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_integration_events_outbox_updated_at ON integration_events_outbox;
CREATE TRIGGER trg_integration_events_outbox_updated_at
  BEFORE UPDATE ON integration_events_outbox
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS integration_webhook_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_connection_id UUID NOT NULL REFERENCES integration_connections(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  url TEXT NOT NULL,
  subscribed_events TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  signing_secret_ciphertext TEXT NOT NULL,
  signing_secret_key_version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active',
  last_delivery_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT integration_webhook_endpoints_label_not_empty
    CHECK (length(trim(label)) > 0),
  CONSTRAINT integration_webhook_endpoints_url_not_empty
    CHECK (length(trim(url)) > 0),
  CONSTRAINT integration_webhook_endpoints_status_check
    CHECK (status IN ('active', 'inactive'))
);

COMMENT ON TABLE integration_webhook_endpoints IS
  'Client-managed webhook destinations for integration events.';

CREATE INDEX IF NOT EXISTS idx_integration_webhook_endpoints_client
  ON integration_webhook_endpoints (client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_integration_webhook_endpoints_status
  ON integration_webhook_endpoints (integration_connection_id, status);

DROP TRIGGER IF EXISTS trg_integration_webhook_endpoints_updated_at ON integration_webhook_endpoints;
CREATE TRIGGER trg_integration_webhook_endpoints_updated_at
  BEFORE UPDATE ON integration_webhook_endpoints
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS integration_webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_webhook_endpoint_id UUID NOT NULL REFERENCES integration_webhook_endpoints(id) ON DELETE CASCADE,
  integration_event_outbox_id UUID NOT NULL REFERENCES integration_events_outbox(id) ON DELETE CASCADE,
  attempt_no INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending',
  request_signature TEXT,
  response_status INTEGER,
  response_body_excerpt TEXT,
  next_attempt_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT integration_webhook_deliveries_status_check
    CHECK (status IN ('pending', 'delivered', 'failed'))
);

COMMENT ON TABLE integration_webhook_deliveries IS
  'Attempt log for outbound integration webhook deliveries.';

CREATE INDEX IF NOT EXISTS idx_integration_webhook_deliveries_endpoint
  ON integration_webhook_deliveries (integration_webhook_endpoint_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_integration_webhook_deliveries_event
  ON integration_webhook_deliveries (integration_event_outbox_id, attempt_no DESC);

DROP TRIGGER IF EXISTS trg_integration_webhook_deliveries_updated_at ON integration_webhook_deliveries;
CREATE TRIGGER trg_integration_webhook_deliveries_updated_at
  BEFORE UPDATE ON integration_webhook_deliveries
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE integration_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_idempotency_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_external_refs ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_launches ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_events_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_webhook_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_webhook_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY integration_connections_select ON integration_connections
  FOR SELECT TO authenticated
  USING (
    is_platform_admin()
    OR client_id = ANY(auth_user_client_ids())
    OR EXISTS (
      SELECT 1
      FROM clients c
      WHERE c.id = integration_connections.client_id
        AND c.partner_id = ANY(auth_user_partner_ids())
    )
  );

CREATE POLICY integration_credentials_select ON integration_credentials
  FOR SELECT TO authenticated
  USING (
    is_platform_admin()
    OR client_id = ANY(auth_user_client_ids())
    OR EXISTS (
      SELECT 1
      FROM clients c
      WHERE c.id = integration_credentials.client_id
        AND c.partner_id = ANY(auth_user_partner_ids())
    )
  );

CREATE POLICY integration_idempotency_keys_select ON integration_idempotency_keys
  FOR SELECT TO authenticated
  USING (
    is_platform_admin()
    OR client_id = ANY(auth_user_client_ids())
    OR EXISTS (
      SELECT 1
      FROM clients c
      WHERE c.id = integration_idempotency_keys.client_id
        AND c.partner_id = ANY(auth_user_partner_ids())
    )
  );

CREATE POLICY integration_external_refs_select ON integration_external_refs
  FOR SELECT TO authenticated
  USING (
    is_platform_admin()
    OR client_id = ANY(auth_user_client_ids())
    OR EXISTS (
      SELECT 1
      FROM clients c
      WHERE c.id = integration_external_refs.client_id
        AND c.partner_id = ANY(auth_user_partner_ids())
    )
  );

CREATE POLICY integration_launches_select ON integration_launches
  FOR SELECT TO authenticated
  USING (
    is_platform_admin()
    OR client_id = ANY(auth_user_client_ids())
    OR EXISTS (
      SELECT 1
      FROM clients c
      WHERE c.id = integration_launches.client_id
        AND c.partner_id = ANY(auth_user_partner_ids())
    )
  );

CREATE POLICY integration_events_outbox_select ON integration_events_outbox
  FOR SELECT TO authenticated
  USING (
    is_platform_admin()
    OR client_id = ANY(auth_user_client_ids())
    OR EXISTS (
      SELECT 1
      FROM clients c
      WHERE c.id = integration_events_outbox.client_id
        AND c.partner_id = ANY(auth_user_partner_ids())
    )
  );

CREATE POLICY integration_webhook_endpoints_select ON integration_webhook_endpoints
  FOR SELECT TO authenticated
  USING (
    is_platform_admin()
    OR client_id = ANY(auth_user_client_ids())
    OR EXISTS (
      SELECT 1
      FROM clients c
      WHERE c.id = integration_webhook_endpoints.client_id
        AND c.partner_id = ANY(auth_user_partner_ids())
    )
  );

CREATE POLICY integration_webhook_deliveries_select ON integration_webhook_deliveries
  FOR SELECT TO authenticated
  USING (
    is_platform_admin()
    OR EXISTS (
      SELECT 1
      FROM integration_webhook_endpoints endpoints
      JOIN clients c ON c.id = endpoints.client_id
      WHERE endpoints.id = integration_webhook_deliveries.integration_webhook_endpoint_id
        AND (
          c.id = ANY(auth_user_client_ids())
          OR c.partner_id = ANY(auth_user_partner_ids())
        )
    )
  );
