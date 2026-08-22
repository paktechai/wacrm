-- ============================================================
-- SBYT authoritative contact + team-seat limits
--
-- Contacts and profile/account membership can be written directly through
-- Supabase client/RPC paths, so the hard limit must live in Postgres rather
-- than only in Next.js routes. Missing/null plan limits mean unlimited.
-- ============================================================

CREATE OR REPLACE FUNCTION public.account_plan_limit(
  p_account_id uuid,
  p_metric text
)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN jsonb_typeof(p.limits -> p_metric) = 'number'
      THEN (p.limits ->> p_metric)::bigint
    ELSE NULL
  END
  FROM public.account_subscriptions s
  JOIN public.saas_plans p ON p.id = s.plan_id
  WHERE s.account_id = p_account_id
    AND p.is_active = true
  LIMIT 1;
$$;

ALTER FUNCTION public.account_plan_limit(uuid, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.account_plan_limit(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.account_plan_limit(uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.enforce_contact_plan_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit bigint;
  v_current bigint;
BEGIN
  v_limit := public.account_plan_limit(NEW.account_id, 'contacts');
  IF v_limit IS NULL THEN
    RETURN NEW;
  END IF;

  -- Serialise competing creates for the same account/metric so two requests
  -- cannot both observe the last available slot and overshoot the limit.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(NEW.account_id::text || ':contacts', 0)
  );

  SELECT count(*) INTO v_current
  FROM public.contacts
  WHERE account_id = NEW.account_id;

  IF v_current >= v_limit THEN
    RAISE EXCEPTION 'SBYT plan contact limit reached (%/%)', v_current, v_limit
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.enforce_contact_plan_limit() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.enforce_contact_plan_limit() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_contact_plan_limit() TO service_role;

DROP TRIGGER IF EXISTS enforce_contact_plan_limit ON public.contacts;
CREATE TRIGGER enforce_contact_plan_limit
BEFORE INSERT ON public.contacts
FOR EACH ROW
EXECUTE FUNCTION public.enforce_contact_plan_limit();

CREATE OR REPLACE FUNCTION public.enforce_team_member_plan_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit bigint;
  v_current bigint;
BEGIN
  -- On UPDATE only enforce when the user is actually moving into a different
  -- account. Role/name/avatar edits do not consume a new seat.
  IF TG_OP = 'UPDATE' AND NEW.account_id IS NOT DISTINCT FROM OLD.account_id THEN
    RETURN NEW;
  END IF;

  IF NEW.account_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_limit := public.account_plan_limit(NEW.account_id, 'team_members');
  IF v_limit IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(NEW.account_id::text || ':team_members', 0)
  );

  SELECT count(*) INTO v_current
  FROM public.profiles
  WHERE account_id = NEW.account_id;

  IF v_current >= v_limit THEN
    RAISE EXCEPTION 'SBYT plan team-member limit reached (%/%)', v_current, v_limit
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.enforce_team_member_plan_limit() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.enforce_team_member_plan_limit() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_team_member_plan_limit() TO service_role;

DROP TRIGGER IF EXISTS enforce_team_member_plan_limit ON public.profiles;
CREATE TRIGGER enforce_team_member_plan_limit
BEFORE INSERT OR UPDATE OF account_id ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.enforce_team_member_plan_limit();

COMMENT ON FUNCTION public.account_plan_limit(uuid, text) IS
  'Returns one numeric plan limit for an account; null means unlimited/unset.';
COMMENT ON FUNCTION public.enforce_contact_plan_limit() IS
  'Authoritative database guard for the contacts plan limit.';
COMMENT ON FUNCTION public.enforce_team_member_plan_limit() IS
  'Authoritative database guard for the team_members seat limit.';
