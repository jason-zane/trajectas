-- Enforce security_invoker on campaigns_with_counts.
--
-- The original view migration (20260410213110) defines the view WITH
-- (security_invoker = true) so it inherits the campaigns table's RLS. The
-- live database had drifted: the option was off, so the view ran as its
-- owner (SECURITY DEFINER semantics), bypassing RLS and exposing campaign
-- rows + counts across client tenants to any authenticated/anon caller.
-- Flagged by the Supabase "Security Definer View" advisor.
--
-- This statement is idempotent and brings live in line with source.

ALTER VIEW public.campaigns_with_counts SET (security_invoker = on);
