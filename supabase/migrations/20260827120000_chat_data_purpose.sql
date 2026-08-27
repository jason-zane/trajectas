-- Chat data mode — the AI prompt purpose.
--
-- ai_system_prompts.purpose is the ai_prompt_purpose ENUM, so a new mode needs
-- the value added to the type before any row can reference it. Postgres will
-- not let a value added in one transaction be USED in that same transaction,
-- which is why the seed rows live in a separate migration that runs after this
-- one commits.

ALTER TYPE ai_prompt_purpose ADD VALUE IF NOT EXISTS 'chat_data';
