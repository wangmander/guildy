-- Phase 6b: Stripe paid-subscription columns on user_profiles.
--
-- subscription_status as text-with-default (no enum type for V2.0 — text is
-- simpler to evolve and Zod / TS handle the union at the application layer).
-- Allowed values: 'free' (default), 'active', 'past_due', 'canceled'.
-- Webhook handler in app/api/stripe/webhook/route.ts is the single writer.
--
-- current_period_end mirrors Stripe's billing cycle so generatePrepAction can
-- grace past_due users for 3 days past period end before soft-blocking the
-- Deep tier (Stripe Smart Retries default behavior).
--
-- stripe_customer_id is the canonical Stripe customer reference. Indexed
-- because the webhook resolves user identity via this column on every event.

alter table public.user_profiles
  add column stripe_customer_id text,
  add column subscription_status text not null default 'free',
  add column current_period_end timestamptz;

create index user_profiles_stripe_customer_idx
  on public.user_profiles (stripe_customer_id);
