-- Dimensions: add definition + behavioural indicators
ALTER TABLE dimensions ADD COLUMN IF NOT EXISTS definition TEXT;
ALTER TABLE dimensions ADD COLUMN IF NOT EXISTS indicators_low TEXT;
ALTER TABLE dimensions ADD COLUMN IF NOT EXISTS indicators_mid TEXT;
ALTER TABLE dimensions ADD COLUMN IF NOT EXISTS indicators_high TEXT;

-- Competencies (Factors): add behavioural indicators (definition already exists)
ALTER TABLE competencies ADD COLUMN IF NOT EXISTS indicators_low TEXT;
ALTER TABLE competencies ADD COLUMN IF NOT EXISTS indicators_mid TEXT;
ALTER TABLE competencies ADD COLUMN IF NOT EXISTS indicators_high TEXT;

-- Traits (Constructs): add definition + behavioural indicators
ALTER TABLE traits ADD COLUMN IF NOT EXISTS definition TEXT;
ALTER TABLE traits ADD COLUMN IF NOT EXISTS indicators_low TEXT;
ALTER TABLE traits ADD COLUMN IF NOT EXISTS indicators_mid TEXT;
ALTER TABLE traits ADD COLUMN IF NOT EXISTS indicators_high TEXT;
