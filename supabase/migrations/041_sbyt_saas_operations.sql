-- ============================================================
-- SBYT SaaS operational defaults
-- Safe default subscription, usage metering RPC, and updated_at hooks.
--
-- Commercial pricing is intentionally NOT defined here. The internal
-- foundation plan simply preserves full CRM access until SBYT assigns a
-- commercial plan from Super Admin.
-- ============================================================

-- ------------------------------------------------------------
-- Internal foundation plan
-- ------------------------------------------------------------
INSERT INTO public.saas_plans (
  code,
  name,
  description,
  currency,
  monthly_price_minor,
  yearly_price_minor,
  limits,
  features,
  is_public,
  is_active,
  sort_order
)
VALUES (
  'foundation',
  'SBYT Foundation',
  'Internal fallback plan used until a commercial plan is assigned.',
  NULL,
  NULL,
  NULL,
  '{}'::jsonb,
  jsonb_build_object(
    'inbox', true,
    'contacts', true,
    'pipelines', true,
    'broadcasts', true,
    'automations', true,
    'flows', true,
    'ai_assistant', true,
    'api', true,
    'team', true
  ),
  false,
  true,
  -1000
)
ON CONFLICT (code) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  features = EXCLUDED.features,
  is_active = true,
  updated_at = now();

-- Existing tenants keep working immediately after SaaS enforcement is
-- introduced. An admin can move them to another plan later.
INSERT INTO public.account_subscriptions (
  account_id,
  plan_id,
  status,
  current_period_start,
  metadata
)
SELECT
  a.id,
  p.id,
  'active',
  now(),
  jsonb_build_object('source', 'foundation_backfill')
FROM public.accounts a
CROSS JOIN public.saas_plans p
WHERE p.code = 'foundation'
ON CONFLICT (account_id) DO NOTHING;

-- ------------------------------------------------------------
-- New-account subscription bootstrap
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_default_account_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_id uuid;
BEGIN
  SELECT id INTO v_plan_id
  FROM public.saas_plans
  WHERE code = 'foundation' AND is_active = true
  LIMIT 1;

  IF v_plan_id IS NOT NULL THEN
    INSERT INTO public.account_subscriptions (
      account_id,
      plan_id,
      status,
      current_period_start,
      metadata
    )
    VALUES (
      NEW.id,
      v_plan_id,
      'active',
      now(),
      jsonb_build_object('source', 'account_bootstrap')
    )
    ON CONFLICT (account_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ensure_default_account_subscription ON public.accounts;
CREATE TRIGGER ensure_default_account_subscription
AFTER INSERT ON public.accounts
FOR EACH ROW
EXECUTE FUNCTION public.ensure_default_account_subscription();

REVOKE ALL ON FUNCTION public.ensure_default_account_subscription() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_default_account_subscription() TO service_role;

-- ------------------------------------------------------------
-- Atomic usage metering
-- Server/service-role only. Every increment is an upsert so concurrent
-- workers cannot lose counts.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.increment_account_usage(
  p_account_id uuid,
  p_metric text,
  p_quantity bigint DEFAULT 1
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period_start date := date_trunc('month', now() AT TIME ZONE 'UTC')::date;
  v_quantity bigint;
BEGIN
  IF p_account_id IS NULL THEN
    RAISE EXCEPTION 'account id is required';
  END IF;

  IF p_metric IS NULL OR length(trim(p_metric)) < 1 OR length(trim(p_metric)) > 64 THEN
    RAISE EXCEPTION 'invalid usage metric';
  END IF;

  IF p_metric !~ '^[a-z0-9][a-z0-9_.-]{0,63}$' THEN
    RAISE EXCEPTION 'invalid usage metric format';
  END IF;

  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'usage quantity must be positive';
  END IF;

  INSERT INTO public.account_usage_monthly (
    account_id,
    period_start,
    metric,
    quantity,
    updated_at
  )
  VALUES (
    p_account_id,
    v_period_start,
    p_metric,
    p_quantity,
    now()
  )
  ON CONFLICT (account_id, period_start, metric)
  DO UPDATE SET
    quantity = public.account_usage_monthly.quantity + EXCLUDED.quantity,
    updated_at = now()
  RETURNING quantity INTO v_quantity;

  RETURN v_quantity;
END;
$$;

ALTER FUNCTION public.increment_account_usage(uuid, text, bigint) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.increment_account_usage(uuid, text, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_account_usage(uuid, text, bigint) TO service_role;

-- ------------------------------------------------------------
-- updated_at consistency
-- ------------------------------------------------------------
DROP TRIGGER IF EXISTS set_updated_at ON public.saas_plans;
CREATE TRIGGER set_updated_at
BEFORE UPDATE ON public.saas_plans
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at ON public.account_subscriptions;
CREATE TRIGGER set_updated_at
BEFORE UPDATE ON public.account_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at ON public.platform_admins;
CREATE TRIGGER set_updated_at
BEFORE UPDATE ON public.platform_admins
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_platform_audit_log_target
  ON public.platform_audit_log (target_type, target_id, created_at DESC);

COMMENT ON FUNCTION public.increment_account_usage(uuid, text, bigint) IS
  'Atomically increments one monthly SaaS usage metric. Service-role only.';
