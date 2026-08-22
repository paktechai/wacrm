-- ============================================================
-- SBYT SaaS foundation
-- Plans, account lifecycle, subscriptions, usage metering,
-- platform administrators, and platform audit events.
--
-- Important design rule:
-- - tenant users may READ their own subscription/usage state
-- - tenant users may NOT change billing, metering, or platform roles
-- - writes are server/service-role responsibilities
-- ============================================================

-- ------------------------------------------------------------
-- Account lifecycle
-- ------------------------------------------------------------
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS lifecycle_status text NOT NULL DEFAULT 'active';

DO $$
BEGIN
  ALTER TABLE public.accounts
    ADD CONSTRAINT accounts_lifecycle_status_check
    CHECK (lifecycle_status IN ('trial', 'active', 'past_due', 'suspended', 'cancelled'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_accounts_lifecycle_status
  ON public.accounts (lifecycle_status);

-- ------------------------------------------------------------
-- Product plans / entitlements
-- Pricing is intentionally nullable until SBYT chooses a gateway,
-- currency strategy, and commercial price points.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.saas_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  currency text,
  monthly_price_minor bigint,
  yearly_price_minor bigint,
  limits jsonb NOT NULL DEFAULT '{}'::jsonb,
  features jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_public boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT saas_plans_code_format_check
    CHECK (code ~ '^[a-z0-9][a-z0-9_-]{1,63}$'),
  CONSTRAINT saas_plans_monthly_price_check
    CHECK (monthly_price_minor IS NULL OR monthly_price_minor >= 0),
  CONSTRAINT saas_plans_yearly_price_check
    CHECK (yearly_price_minor IS NULL OR yearly_price_minor >= 0)
);

CREATE INDEX IF NOT EXISTS idx_saas_plans_public_active
  ON public.saas_plans (is_public, is_active, sort_order);

-- ------------------------------------------------------------
-- One current subscription record per tenant account.
-- Provider fields are generic on purpose so the app is not tied to
-- Stripe or any single payment gateway.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.account_subscriptions (
  account_id uuid PRIMARY KEY REFERENCES public.accounts(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.saas_plans(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'trialing',
  provider text,
  provider_customer_id text,
  provider_subscription_id text,
  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  cancelled_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT account_subscriptions_status_check
    CHECK (status IN ('trialing', 'active', 'past_due', 'paused', 'cancelled'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_account_subscriptions_provider_subscription
  ON public.account_subscriptions (provider, provider_subscription_id)
  WHERE provider IS NOT NULL AND provider_subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_account_subscriptions_plan_status
  ON public.account_subscriptions (plan_id, status);

-- ------------------------------------------------------------
-- Monthly usage counters. Metric names are deliberately open-ended
-- (contacts, seats, broadcasts, ai_tokens, whatsapp_numbers, etc.).
-- The app can add new metrics without a schema migration.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.account_usage_monthly (
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  metric text NOT NULL,
  quantity bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, period_start, metric),
  CONSTRAINT account_usage_quantity_check CHECK (quantity >= 0),
  CONSTRAINT account_usage_metric_check CHECK (length(metric) BETWEEN 1 AND 64)
);

CREATE INDEX IF NOT EXISTS idx_account_usage_period_metric
  ON public.account_usage_monthly (period_start, metric);

-- ------------------------------------------------------------
-- Platform administrators are separate from tenant roles.
-- A tenant owner/admin is NOT automatically an SBYT platform admin.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'super_admin',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT platform_admins_role_check
    CHECK (role IN ('super_admin', 'support', 'billing_admin'))
);

CREATE TABLE IF NOT EXISTS public.platform_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text,
  target_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_audit_log_created_at
  ON public.platform_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_audit_log_actor
  ON public.platform_audit_log (actor_user_id, created_at DESC);

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
ALTER TABLE public.saas_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_usage_monthly ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY saas_plans_select
  ON public.saas_plans
  FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY account_subscriptions_select
  ON public.account_subscriptions
  FOR SELECT
  TO authenticated
  USING (public.is_account_member(account_id));

CREATE POLICY account_usage_monthly_select
  ON public.account_usage_monthly
  FOR SELECT
  TO authenticated
  USING (public.is_account_member(account_id));

CREATE POLICY platform_admins_select_self
  ON public.platform_admins
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Intentionally no authenticated policy on platform_audit_log.
-- The platform admin UI reads it through a server-only service-role client.

-- Minimise direct client privileges. RLS is still the primary guard,
-- but explicit grants make the intended boundary obvious.
REVOKE INSERT, UPDATE, DELETE ON public.saas_plans FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.account_subscriptions FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.account_usage_monthly FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.platform_admins FROM anon, authenticated;
REVOKE ALL ON public.platform_audit_log FROM anon, authenticated;

GRANT SELECT ON public.saas_plans TO authenticated;
GRANT SELECT ON public.account_subscriptions TO authenticated;
GRANT SELECT ON public.account_usage_monthly TO authenticated;
GRANT SELECT ON public.platform_admins TO authenticated;

GRANT ALL ON public.saas_plans TO service_role;
GRANT ALL ON public.account_subscriptions TO service_role;
GRANT ALL ON public.account_usage_monthly TO service_role;
GRANT ALL ON public.platform_admins TO service_role;
GRANT ALL ON public.platform_audit_log TO service_role;

COMMENT ON TABLE public.saas_plans IS
  'SBYT commercial plans and JSON entitlements. Pricing may remain null until commercial terms are configured.';
COMMENT ON TABLE public.account_subscriptions IS
  'Current SaaS subscription state for each tenant account; provider-neutral by design.';
COMMENT ON TABLE public.account_usage_monthly IS
  'Server-maintained monthly usage counters used for plan enforcement and reporting.';
COMMENT ON TABLE public.platform_admins IS
  'SBYT platform-level administrators. Completely separate from tenant account roles.';
