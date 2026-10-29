-- Separate transaction: PostgreSQL must commit the enum value before it is used.
ALTER TYPE public.scoring_profile ADD VALUE IF NOT EXISTS 'ipip_neo_120_v1';
