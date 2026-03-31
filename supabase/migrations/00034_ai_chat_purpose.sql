-- Add 'chat' to ai_prompt_purpose enum and seed a default model config row

ALTER TYPE ai_prompt_purpose ADD VALUE IF NOT EXISTS 'chat';
-- Default chat model-config seeding is handled in 00036_fix_model_config_unique_constraint.
