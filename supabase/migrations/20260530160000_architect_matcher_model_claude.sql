-- =============================================================================
-- Architect: point the competency_matching model at Claude Sonnet 4.5
--
-- The matcher's model config was a pre-Architect default (`minimax/minimax-m2.5`,
-- a reasoning model). The matcher was never exercised until Architect shipped,
-- and in production runArchitectMatch failed inside the AI call: reasoning
-- models emit thinking/prose and don't reliably honour strict JSON mode, so the
-- structured ranking response failed to parse.
--
-- Brief extraction already runs on Claude Sonnet 4.5 and works. Use the same
-- proven, JSON-reliable model for matching, with a roomier token budget for
-- ranking ~20 factors. Editable later in Settings -> AI Configuration.
-- =============================================================================

UPDATE ai_model_configs
SET
  model_id     = 'anthropic/claude-sonnet-4-5',
  display_name = 'Claude Sonnet 4.5',
  config       = '{"temperature": 0.3, "max_tokens": 8000}'::jsonb
WHERE purpose = 'competency_matching';
