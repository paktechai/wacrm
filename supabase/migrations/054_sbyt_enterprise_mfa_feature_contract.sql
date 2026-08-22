-- ============================================================
-- SBYT Enterprise MFA enforcement + 2026 feature contract
-- ============================================================

-- Keep the enforcement bit on accounts because every tenant member can
-- already read their own account row. That lets the existing RLS helper
-- enforce AAL2 without granting agents access to admin-only security settings.
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS require_mfa boolean NOT NULL DEFAULT false;

UPDATE public.accounts a
SET require_mfa = s.require_mfa
FROM public.account_security_settings s
WHERE s.account_id = a.id;

CREATE OR REPLACE FUNCTION public.sync_account_mfa_requirement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.accounts
  SET require_mfa = NEW.require_mfa,
      updated_at = now()
  WHERE id = NEW.account_id;
  RETURN NEW;
END;
$$;
ALTER FUNCTION public.sync_account_mfa_requirement() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.sync_account_mfa_requirement() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS sync_account_mfa_requirement ON public.account_security_settings;
CREATE TRIGGER sync_account_mfa_requirement
AFTER INSERT OR UPDATE OF require_mfa ON public.account_security_settings
FOR EACH ROW EXECUTE FUNCTION public.sync_account_mfa_requirement();

-- Authoritative operational check used by tenant write RLS.
-- If enterprise MFA is required, conventional AAL1 sessions remain readable
-- but cannot write until the current JWT is promoted to AAL2.
CREATE OR REPLACE FUNCTION public.is_account_operational(
  target_account_id uuid,
  min_role public.account_role_enum DEFAULT 'viewer'
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT public.is_account_member(target_account_id, min_role)
    AND EXISTS (
      SELECT 1
      FROM public.accounts a
      WHERE a.id = target_account_id
        AND a.lifecycle_status NOT IN ('suspended', 'cancelled')
        AND (
          a.require_mfa = false
          OR COALESCE(auth.jwt() ->> 'aal', '') = 'aal2'
        )
    );
$$;

ALTER FUNCTION public.is_account_operational(uuid, public.account_role_enum) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.is_account_operational(uuid, public.account_role_enum) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_account_operational(uuid, public.account_role_enum) TO authenticated, service_role;

-- The internal Foundation plan keeps all SBYT-owned modules enabled while
-- commercial plans/prices are still being defined. Future paid plans can turn
-- individual keys off without another schema migration.
UPDATE public.saas_plans
SET features = features || jsonb_build_object(
  'modern_inbox', true,
  'crm2', true,
  'ai_agents', true,
  'ai_copilot', true,
  'marketing', true,
  'commerce', true,
  'integrations', true,
  'website_chat', true,
  'enterprise', true,
  'pwa', true
),
updated_at = now()
WHERE code = 'foundation';

COMMENT ON COLUMN public.accounts.require_mfa IS
  'Authoritative tenant write-enforcement bit. When true, is_account_operational requires JWT aal2.';
