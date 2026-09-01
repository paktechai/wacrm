-- ============================================================
-- Wova8 Relationship OS — Feature Pack 1
-- Durable relationship memory, commitments, signals, explainable actions,
-- stakeholder links and AI decision traceability.
--
-- Design goals:
-- 1. Keep customer-facing communication working if intelligence is absent.
-- 2. Keep every record tenant-scoped and contact-scoped where possible.
-- 3. Preserve provenance and confidence so AI-derived facts are auditable.
-- 4. Never store provider secrets or raw credentials in decision traces.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.relationship_memory_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  memory_type text NOT NULL DEFAULT 'context'
    CHECK (memory_type IN ('fact','preference','context','goal','constraint','milestone','relationship','custom')),
  memory_key text,
  summary text NOT NULL CHECK (char_length(summary) BETWEEN 1 AND 2000),
  value_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_type text NOT NULL DEFAULT 'human'
    CHECK (source_type IN ('human','message','conversation','note','deal','appointment','transaction','import','ai','automation','api','custom')),
  source_ref text,
  confidence numeric(4,3) NOT NULL DEFAULT 1.000 CHECK (confidence BETWEEN 0 AND 1),
  state text NOT NULL DEFAULT 'active'
    CHECK (state IN ('active','stale','conflict','superseded','dismissed')),
  observed_at timestamptz NOT NULL DEFAULT now(),
  valid_from timestamptz,
  valid_until timestamptz,
  supersedes_id uuid REFERENCES public.relationship_memory_entries(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (valid_until IS NULL OR valid_from IS NULL OR valid_until > valid_from)
);

CREATE INDEX IF NOT EXISTS idx_relationship_memory_contact_active
  ON public.relationship_memory_entries(account_id, contact_id, observed_at DESC)
  WHERE state = 'active';
CREATE INDEX IF NOT EXISTS idx_relationship_memory_key
  ON public.relationship_memory_entries(account_id, contact_id, memory_key)
  WHERE memory_key IS NOT NULL AND state IN ('active','conflict');
CREATE INDEX IF NOT EXISTS idx_relationship_memory_stale
  ON public.relationship_memory_entries(account_id, state, valid_until)
  WHERE state IN ('active','stale','conflict');

CREATE TABLE IF NOT EXISTS public.relationship_commitments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 300),
  details text,
  commitment_direction text NOT NULL DEFAULT 'mutual'
    CHECK (commitment_direction IN ('our_commitment','their_commitment','mutual','external')),
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  due_at timestamptz,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','kept','broken','waived','cancelled')),
  source_type text NOT NULL DEFAULT 'human'
    CHECK (source_type IN ('human','message','conversation','note','deal','appointment','ai','automation','api','custom')),
  source_ref text,
  confidence numeric(4,3) NOT NULL DEFAULT 1.000 CHECK (confidence BETWEEN 0 AND 1),
  detected_by text NOT NULL DEFAULT 'human'
    CHECK (detected_by IN ('human','ai','automation','import','api')),
  detected_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_relationship_commitments_due
  ON public.relationship_commitments(account_id, status, due_at)
  WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_relationship_commitments_contact
  ON public.relationship_commitments(account_id, contact_id, status, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_relationship_commitments_owner
  ON public.relationship_commitments(account_id, owner_user_id, status, due_at)
  WHERE owner_user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.relationship_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  signal_type text NOT NULL,
  summary text NOT NULL CHECK (char_length(summary) BETWEEN 1 AND 1000),
  severity text NOT NULL DEFAULT 'medium'
    CHECK (severity IN ('info','low','medium','high','critical')),
  score smallint CHECK (score BETWEEN -100 AND 100),
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_type text NOT NULL DEFAULT 'system'
    CHECK (source_type IN ('system','human','message','conversation','event','ai','automation','api','custom')),
  source_ref text,
  confidence numeric(4,3) NOT NULL DEFAULT 1.000 CHECK (confidence BETWEEN 0 AND 1),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','acknowledged','resolved','dismissed','expired')),
  observed_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  resolved_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_relationship_signals_attention
  ON public.relationship_signals(account_id, status, severity, observed_at DESC)
  WHERE status IN ('active','acknowledged');
CREATE INDEX IF NOT EXISTS idx_relationship_signals_contact
  ON public.relationship_signals(account_id, contact_id, status, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_relationship_signals_type
  ON public.relationship_signals(account_id, signal_type, status, observed_at DESC);

CREATE TABLE IF NOT EXISTS public.relationship_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  recommendation_type text NOT NULL DEFAULT 'follow_up',
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 300),
  rationale text NOT NULL CHECK (char_length(rationale) BETWEEN 1 AND 2000),
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  urgency text NOT NULL DEFAULT 'normal'
    CHECK (urgency IN ('low','normal','high','urgent')),
  confidence numeric(4,3) NOT NULL DEFAULT 1.000 CHECK (confidence BETWEEN 0 AND 1),
  policy_status text NOT NULL DEFAULT 'review'
    CHECK (policy_status IN ('allowed','review','blocked')),
  requires_approval boolean NOT NULL DEFAULT true,
  action_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_by text NOT NULL DEFAULT 'system'
    CHECK (generated_by IN ('system','ai','automation','human','api')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','dismissed','completed','expired')),
  expires_at timestamptz,
  acted_at timestamptz,
  acted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_relationship_recommendations_queue
  ON public.relationship_recommendations(account_id, status, urgency, created_at DESC)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_relationship_recommendations_contact
  ON public.relationship_recommendations(account_id, contact_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.relationship_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  source_contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  target_contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  relationship_kind text NOT NULL DEFAULT 'related'
    CHECK (relationship_kind IN ('related','colleague','family','advisor','introducer','referrer','decision_maker','champion','blocker','influencer','reports_to','partner','custom')),
  direction text NOT NULL DEFAULT 'directed'
    CHECK (direction IN ('directed','mutual')),
  strength smallint CHECK (strength BETWEEN 0 AND 100),
  influence smallint CHECK (influence BETWEEN 0 AND 100),
  summary text,
  source_type text NOT NULL DEFAULT 'human'
    CHECK (source_type IN ('human','message','conversation','event','ai','import','api','custom')),
  source_ref text,
  confidence numeric(4,3) NOT NULL DEFAULT 1.000 CHECK (confidence BETWEEN 0 AND 1),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','stale','dismissed')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (source_contact_id <> target_contact_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_relationship_links_unique_active
  ON public.relationship_links(account_id, source_contact_id, target_contact_id, relationship_kind)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_relationship_links_source
  ON public.relationship_links(account_id, source_contact_id, status, strength DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_relationship_links_target
  ON public.relationship_links(account_id, target_contact_id, status, strength DESC NULLS LAST);

CREATE TABLE IF NOT EXISTS public.ai_decision_traces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  operation text NOT NULL
    CHECK (operation IN ('draft','auto_reply','next_best_action','signal_detection','memory_extraction','commitment_detection','routing','summary','automation','other')),
  outcome text NOT NULL,
  decision_summary text NOT NULL CHECK (char_length(decision_summary) BETWEEN 1 AND 3000),
  confidence numeric(4,3) CHECK (confidence BETWEEN 0 AND 1),
  context_sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  knowledge_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  policy_checks jsonb NOT NULL DEFAULT '[]'::jsonb,
  model_provider text,
  model_name text,
  correlation_id text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_decision_traces_contact
  ON public.ai_decision_traces(account_id, contact_id, created_at DESC)
  WHERE contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_decision_traces_conversation
  ON public.ai_decision_traces(account_id, conversation_id, created_at DESC)
  WHERE conversation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_decision_traces_operation
  ON public.ai_decision_traces(account_id, operation, created_at DESC);

-- -----------------------------
-- Row-level security
-- -----------------------------
ALTER TABLE public.relationship_memory_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relationship_commitments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relationship_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relationship_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relationship_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_decision_traces ENABLE ROW LEVEL SECURITY;

-- Reading relationship intelligence inherits visibility from the underlying
-- contact(s). This works with the existing assignment-scoped contact policy.
CREATE POLICY relationship_memory_select ON public.relationship_memory_entries
  FOR SELECT TO authenticated
  USING (
    public.is_account_member(account_id)
    AND EXISTS (
      SELECT 1 FROM public.contacts contact
      WHERE contact.id = relationship_memory_entries.contact_id
        AND contact.account_id = relationship_memory_entries.account_id
    )
  );
CREATE POLICY relationship_memory_insert ON public.relationship_memory_entries
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_account_operational(account_id, 'agent')
    AND public.is_account_feature_enabled(account_id, 'contacts')
    AND EXISTS (
      SELECT 1 FROM public.contacts contact
      WHERE contact.id = relationship_memory_entries.contact_id
        AND contact.account_id = relationship_memory_entries.account_id
    )
  );
CREATE POLICY relationship_memory_update ON public.relationship_memory_entries
  FOR UPDATE TO authenticated
  USING (public.is_account_operational(account_id, 'agent'))
  WITH CHECK (public.is_account_operational(account_id, 'agent'));
CREATE POLICY relationship_memory_delete ON public.relationship_memory_entries
  FOR DELETE TO authenticated
  USING (public.is_account_operational(account_id, 'admin'));

CREATE POLICY relationship_commitments_select ON public.relationship_commitments
  FOR SELECT TO authenticated
  USING (
    public.is_account_member(account_id)
    AND EXISTS (
      SELECT 1 FROM public.contacts contact
      WHERE contact.id = relationship_commitments.contact_id
        AND contact.account_id = relationship_commitments.account_id
    )
  );
CREATE POLICY relationship_commitments_insert ON public.relationship_commitments
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_account_operational(account_id, 'agent')
    AND public.is_account_feature_enabled(account_id, 'contacts')
    AND EXISTS (
      SELECT 1 FROM public.contacts contact
      WHERE contact.id = relationship_commitments.contact_id
        AND contact.account_id = relationship_commitments.account_id
    )
  );
CREATE POLICY relationship_commitments_update ON public.relationship_commitments
  FOR UPDATE TO authenticated
  USING (public.is_account_operational(account_id, 'agent'))
  WITH CHECK (public.is_account_operational(account_id, 'agent'));
CREATE POLICY relationship_commitments_delete ON public.relationship_commitments
  FOR DELETE TO authenticated
  USING (public.is_account_operational(account_id, 'admin'));

CREATE POLICY relationship_signals_select ON public.relationship_signals
  FOR SELECT TO authenticated
  USING (
    public.is_account_member(account_id)
    AND EXISTS (
      SELECT 1 FROM public.contacts contact
      WHERE contact.id = relationship_signals.contact_id
        AND contact.account_id = relationship_signals.account_id
    )
  );
CREATE POLICY relationship_signals_insert ON public.relationship_signals
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_account_operational(account_id, 'agent')
    AND public.is_account_feature_enabled(account_id, 'contacts')
  );
CREATE POLICY relationship_signals_update ON public.relationship_signals
  FOR UPDATE TO authenticated
  USING (public.is_account_operational(account_id, 'agent'))
  WITH CHECK (public.is_account_operational(account_id, 'agent'));
CREATE POLICY relationship_signals_delete ON public.relationship_signals
  FOR DELETE TO authenticated
  USING (public.is_account_operational(account_id, 'admin'));

CREATE POLICY relationship_recommendations_select ON public.relationship_recommendations
  FOR SELECT TO authenticated
  USING (
    public.is_account_member(account_id)
    AND EXISTS (
      SELECT 1 FROM public.contacts contact
      WHERE contact.id = relationship_recommendations.contact_id
        AND contact.account_id = relationship_recommendations.account_id
    )
  );
CREATE POLICY relationship_recommendations_insert ON public.relationship_recommendations
  FOR INSERT TO authenticated
  WITH CHECK (public.is_account_operational(account_id, 'agent'));
CREATE POLICY relationship_recommendations_update ON public.relationship_recommendations
  FOR UPDATE TO authenticated
  USING (public.is_account_operational(account_id, 'agent'))
  WITH CHECK (public.is_account_operational(account_id, 'agent'));
CREATE POLICY relationship_recommendations_delete ON public.relationship_recommendations
  FOR DELETE TO authenticated
  USING (public.is_account_operational(account_id, 'admin'));

CREATE POLICY relationship_links_select ON public.relationship_links
  FOR SELECT TO authenticated
  USING (
    public.is_account_member(account_id)
    AND EXISTS (
      SELECT 1 FROM public.contacts source_contact
      WHERE source_contact.id = relationship_links.source_contact_id
        AND source_contact.account_id = relationship_links.account_id
    )
    AND EXISTS (
      SELECT 1 FROM public.contacts target_contact
      WHERE target_contact.id = relationship_links.target_contact_id
        AND target_contact.account_id = relationship_links.account_id
    )
  );
CREATE POLICY relationship_links_insert ON public.relationship_links
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_account_operational(account_id, 'agent')
    AND public.is_account_feature_enabled(account_id, 'contacts')
  );
CREATE POLICY relationship_links_update ON public.relationship_links
  FOR UPDATE TO authenticated
  USING (public.is_account_operational(account_id, 'agent'))
  WITH CHECK (public.is_account_operational(account_id, 'agent'));
CREATE POLICY relationship_links_delete ON public.relationship_links
  FOR DELETE TO authenticated
  USING (public.is_account_operational(account_id, 'admin'));

-- Decision traces may contain operational reasoning, so access is deliberately
-- narrower than general relationship data. Agents can inspect traces for a
-- contact they can already access; admins can inspect account-level traces.
CREATE POLICY ai_decision_traces_select ON public.ai_decision_traces
  FOR SELECT TO authenticated
  USING (
    public.is_account_member(account_id)
    AND (
      public.is_account_member(account_id, 'admin')
      OR (
        contact_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.contacts contact
          WHERE contact.id = ai_decision_traces.contact_id
            AND contact.account_id = ai_decision_traces.account_id
        )
      )
    )
  );
CREATE POLICY ai_decision_traces_insert ON public.ai_decision_traces
  FOR INSERT TO authenticated
  WITH CHECK (public.is_account_operational(account_id, 'agent'));
CREATE POLICY ai_decision_traces_update ON public.ai_decision_traces
  FOR UPDATE TO authenticated
  USING (public.is_account_operational(account_id, 'admin'))
  WITH CHECK (public.is_account_operational(account_id, 'admin'));
CREATE POLICY ai_decision_traces_delete ON public.ai_decision_traces
  FOR DELETE TO authenticated
  USING (public.is_account_operational(account_id, 'admin'));

COMMENT ON TABLE public.relationship_memory_entries IS
  'Wova8 durable relationship memory with provenance, confidence, validity and conflict/staleness state.';
COMMENT ON TABLE public.relationship_commitments IS
  'Promises and commitments detected or recorded across relationship interactions, with ownership and due-state tracking.';
COMMENT ON TABLE public.relationship_signals IS
  'Explainable relationship risk/opportunity signals such as decay, revival, high intent and overdue commitments.';
COMMENT ON TABLE public.relationship_recommendations IS
  'Explainable next-best-action queue with evidence, urgency, confidence and policy/approval gates.';
COMMENT ON TABLE public.relationship_links IS
  'Stakeholder graph edges between relationships, including introduction, influence, champion and blocker context.';
COMMENT ON TABLE public.ai_decision_traces IS
  'Auditable AI/system decision traces. Stores references and summaries, never provider secrets or credentials.';
