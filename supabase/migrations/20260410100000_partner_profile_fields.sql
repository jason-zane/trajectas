-- Add profile fields to partners for the new Details tab
ALTER TABLE partners ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS contact_email TEXT;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS notes TEXT;
