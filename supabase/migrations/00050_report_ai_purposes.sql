-- =============================================================================
-- Migration 00050: Add AI prompt purposes for report strengths & development
-- =============================================================================

ALTER TYPE ai_prompt_purpose ADD VALUE IF NOT EXISTS 'report_strengths_analysis';
ALTER TYPE ai_prompt_purpose ADD VALUE IF NOT EXISTS 'report_development_advice';
