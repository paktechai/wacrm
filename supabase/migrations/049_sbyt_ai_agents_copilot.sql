-- ============================================================
-- SBYT AI Agents + Copilot
-- Multi-agent personas sit on top of the existing BYO provider config.
-- The provider key remains in ai_configs; personas never store secrets.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ai_agent_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  agent_type text NOT NULL DEFAULT 'custom'
    CHECK (agent_type IN ('sales','support','receptionist','lead_qualifier','custom')),
  system_prompt text NOT NULL DEFAULT '',
  goals jsonb NOT NULL DEFAULT '[]'::jsonb,
  tool_policy jsonb NOT NULL DEFAULT '{}'::jsonb,
  handoff_policy jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ai_agent_profiles_default_per_account
  ON public.ai_agent_profiles(account_id)
  WHERE is_default;
CREATE INDEX IF NOT EXISTS ai_agent_profiles_account_active
  ON public.ai_agent_profiles(account_id, is_active, created_at);

ALTER TABLE public.ai_agent_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ai_agent_profiles_select ON public.ai_agent_profiles;
CREATE POLICY ai_agent_profiles_select ON public.ai_agent_profiles FOR SELECT
  USING (public.is_account_member(account_id));
DROP POLICY IF EXISTS ai_agent_profiles_insert ON public.ai_agent_profiles;
CREATE POLICY ai_agent_profiles_insert ON public.ai_agent_profiles FOR INSERT
  WITH CHECK (public.is_account_operational(account_id, 'admin'));
DROP POLICY IF EXISTS ai_agent_profiles_update ON public.ai_agent_profiles;
CREATE POLICY ai_agent_profiles_update ON public.ai_agent_profiles FOR UPDATE
  USING (public.is_account_operational(account_id, 'admin'))
  WITH CHECK (public.is_account_operational(account_id, 'admin'));
DROP POLICY IF EXISTS ai_agent_profiles_delete ON public.ai_agent_profiles;
CREATE POLICY ai_agent_profiles_delete ON public.ai_agent_profiles FOR DELETE
  USING (public.is_account_operational(account_id, 'admin'));

ALTER TABLE public.ai_configs
  ADD COLUMN IF NOT EXISTS default_agent_id uuid REFERENCES public.ai_agent_profiles(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.ai_copilot_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  agent_profile_id uuid REFERENCES public.ai_agent_profiles(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('draft','rewrite','summary','translate','analyze','next_action','agent_run')),
  input_language text,
  output_language text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_copilot_events_account_created
  ON public.ai_copilot_events(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_copilot_events_conversation
  ON public.ai_copilot_events(account_id, conversation_id, created_at DESC);

ALTER TABLE public.ai_copilot_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ai_copilot_events_select ON public.ai_copilot_events;
CREATE POLICY ai_copilot_events_select ON public.ai_copilot_events FOR SELECT
  USING (public.is_account_member(account_id));
DROP POLICY IF EXISTS ai_copilot_events_insert ON public.ai_copilot_events;
CREATE POLICY ai_copilot_events_insert ON public.ai_copilot_events FOR INSERT
  WITH CHECK (public.is_account_operational(account_id, 'agent'));

COMMENT ON TABLE public.ai_agent_profiles IS 'Reusable SBYT autonomous-agent personas; secrets remain in ai_configs.';
COMMENT ON TABLE public.ai_copilot_events IS 'Audit/analytics trail for AI copilot and autonomous agent actions.';
