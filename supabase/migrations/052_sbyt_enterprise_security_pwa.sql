-- ============================================================
-- SBYT Enterprise controls + PWA support
-- ============================================================

CREATE TABLE IF NOT EXISTS public.account_security_settings (
  account_id uuid PRIMARY KEY REFERENCES public.accounts(id) ON DELETE CASCADE,
  require_mfa boolean NOT NULL DEFAULT false,
  session_timeout_minutes integer NOT NULL DEFAULT 480 CHECK (session_timeout_minutes BETWEEN 15 AND 43200),
  data_retention_days integer NOT NULL DEFAULT 365 CHECK (data_retention_days BETWEEN 30 AND 3650),
  audit_retention_days integer NOT NULL DEFAULT 730 CHECK (audit_retention_days BETWEEN 30 AND 3650),
  allow_data_export boolean NOT NULL DEFAULT true,
  allowed_ip_cidrs text[] NOT NULL DEFAULT ARRAY[]::text[],
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.account_security_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS account_security_settings_select ON public.account_security_settings;
CREATE POLICY account_security_settings_select ON public.account_security_settings FOR SELECT
  USING (public.is_account_member(account_id, 'admin'));
DROP POLICY IF EXISTS account_security_settings_insert ON public.account_security_settings;
CREATE POLICY account_security_settings_insert ON public.account_security_settings FOR INSERT
  WITH CHECK (public.is_account_operational(account_id, 'admin'));
DROP POLICY IF EXISTS account_security_settings_update ON public.account_security_settings;
CREATE POLICY account_security_settings_update ON public.account_security_settings FOR UPDATE
  USING (public.is_account_operational(account_id, 'admin'))
  WITH CHECK (public.is_account_operational(account_id, 'admin'));

CREATE TABLE IF NOT EXISTS public.role_permission_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  role public.account_role_enum NOT NULL,
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(account_id, role)
);
ALTER TABLE public.role_permission_overrides ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS role_permission_overrides_select ON public.role_permission_overrides;
CREATE POLICY role_permission_overrides_select ON public.role_permission_overrides FOR SELECT
  USING (public.is_account_member(account_id));
DROP POLICY IF EXISTS role_permission_overrides_insert ON public.role_permission_overrides;
CREATE POLICY role_permission_overrides_insert ON public.role_permission_overrides FOR INSERT
  WITH CHECK (public.is_account_operational(account_id, 'admin'));
DROP POLICY IF EXISTS role_permission_overrides_update ON public.role_permission_overrides;
CREATE POLICY role_permission_overrides_update ON public.role_permission_overrides FOR UPDATE
  USING (public.is_account_operational(account_id, 'admin'))
  WITH CHECK (public.is_account_operational(account_id, 'admin'));
DROP POLICY IF EXISTS role_permission_overrides_delete ON public.role_permission_overrides;
CREATE POLICY role_permission_overrides_delete ON public.role_permission_overrides FOR DELETE
  USING (public.is_account_operational(account_id, 'admin'));

CREATE TABLE IF NOT EXISTS public.tenant_audit_log (
  id bigserial PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event text NOT NULL,
  object_type text,
  object_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tenant_audit_log_account_created
  ON public.tenant_audit_log(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tenant_audit_log_object
  ON public.tenant_audit_log(account_id, object_type, object_id, created_at DESC);
ALTER TABLE public.tenant_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_audit_log_select ON public.tenant_audit_log;
CREATE POLICY tenant_audit_log_select ON public.tenant_audit_log FOR SELECT
  USING (public.is_account_member(account_id, 'admin'));
-- Intentionally no authenticated INSERT/UPDATE/DELETE policy: server/service-role writes audit events.

CREATE TABLE IF NOT EXISTS public.web_push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  UNIQUE(user_id, endpoint)
);
CREATE INDEX IF NOT EXISTS idx_web_push_subscriptions_account_user
  ON public.web_push_subscriptions(account_id, user_id);
ALTER TABLE public.web_push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS web_push_subscriptions_select ON public.web_push_subscriptions;
CREATE POLICY web_push_subscriptions_select ON public.web_push_subscriptions FOR SELECT
  USING (user_id = auth.uid() AND public.is_account_member(account_id));
DROP POLICY IF EXISTS web_push_subscriptions_insert ON public.web_push_subscriptions;
CREATE POLICY web_push_subscriptions_insert ON public.web_push_subscriptions FOR INSERT
  WITH CHECK (user_id = auth.uid() AND public.is_account_operational(account_id));
DROP POLICY IF EXISTS web_push_subscriptions_update ON public.web_push_subscriptions;
CREATE POLICY web_push_subscriptions_update ON public.web_push_subscriptions FOR UPDATE
  USING (user_id = auth.uid() AND public.is_account_member(account_id))
  WITH CHECK (user_id = auth.uid() AND public.is_account_operational(account_id));
DROP POLICY IF EXISTS web_push_subscriptions_delete ON public.web_push_subscriptions;
CREATE POLICY web_push_subscriptions_delete ON public.web_push_subscriptions FOR DELETE
  USING (user_id = auth.uid() AND public.is_account_member(account_id));

CREATE TABLE IF NOT EXISTS public.data_export_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  format text NOT NULL DEFAULT 'json' CHECK (format IN ('json','csv')),
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('pending','processing','completed','failed')),
  row_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  error text
);
ALTER TABLE public.data_export_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS data_export_log_select ON public.data_export_log;
CREATE POLICY data_export_log_select ON public.data_export_log FOR SELECT
  USING (public.is_account_member(account_id, 'admin'));

COMMENT ON TABLE public.tenant_audit_log IS 'Append-only tenant audit trail written by trusted server routes.';
COMMENT ON TABLE public.account_security_settings IS 'Per-workspace enterprise security, retention and export policy.';
