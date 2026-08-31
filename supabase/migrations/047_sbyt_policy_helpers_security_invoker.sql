-- ============================================================
-- SBYT policy-helper hardening
--
-- These helpers are membership-aware and only query tenant-readable tables,
-- so they do not need SECURITY DEFINER. Running as the caller removes an
-- unnecessary privilege boundary while preserving their use inside RLS.
-- ============================================================

ALTER FUNCTION public.is_account_operational(uuid, public.account_role_enum)
  SECURITY INVOKER;

ALTER FUNCTION public.is_account_feature_enabled(uuid, text)
  SECURITY INVOKER;
