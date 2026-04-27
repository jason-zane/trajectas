-- =============================================================================
-- Migration 00003: Schema Alignment
-- =============================================================================
-- Adds missing columns to competencies so the UI can filter by active status
-- and scope by partner. Makes category_id nullable since we use dimension_id.
-- =============================================================================

-- Add is_active to competencies (all existing rows default to true)
ALTER TABLE competencies
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
-- Add partner_id to competencies for multi-tenant scoping
ALTER TABLE competencies
    ADD COLUMN IF NOT EXISTS partner_id UUID REFERENCES partners(id) ON DELETE SET NULL;
-- Make category_id nullable (we use dimension_id from migration 2 instead)
ALTER TABLE competencies
    ALTER COLUMN category_id DROP NOT NULL;
-- Index for active competencies
CREATE INDEX IF NOT EXISTS idx_competencies_active ON competencies(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_competencies_partner ON competencies(partner_id);
