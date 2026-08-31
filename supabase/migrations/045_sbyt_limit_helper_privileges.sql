-- ============================================================
-- SBYT plan-limit helper privilege tightening
-- account_plan_limit is an internal trigger helper and does not need to be
-- callable directly by tenant clients. Tenant users can read their own plan
-- and subscription through RLS instead.
-- ============================================================

REVOKE ALL ON FUNCTION public.account_plan_limit(uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.account_plan_limit(uuid, text)
  TO service_role;
