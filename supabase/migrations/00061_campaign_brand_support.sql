-- Add 'campaign' to brand_owner_type enum so campaigns can have their own brand config
ALTER TYPE brand_owner_type ADD VALUE IF NOT EXISTS 'campaign';
