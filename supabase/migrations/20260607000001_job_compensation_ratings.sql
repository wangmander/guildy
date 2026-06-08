-- Matrix rebuild: per-offer soft ratings. Stores { soft_dim_key: 1-10 }.
-- Apply manually via the Supabase SQL editor (prod cannot take db push).
-- Idempotent.

alter table public.job_compensation
  add column if not exists ratings jsonb not null default '{}'::jsonb;
