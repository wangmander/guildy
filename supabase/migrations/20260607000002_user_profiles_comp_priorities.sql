-- Matrix rebuild: per-user comparison priorities. Stores
-- { "enabled_soft": [keys...], "weights": { dim_key: number } }.
-- Null resolves in code to the preset soft set + equal weights.
-- Apply manually via the Supabase SQL editor (prod cannot take db push).
-- Idempotent.

alter table public.user_profiles
  add column if not exists comp_priorities jsonb;
