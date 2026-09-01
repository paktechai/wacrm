-- ============================================================
-- Wova8 Relationship OS — Data API + RLS hardening
-- Supabase 2026 no longer guarantees new public tables are automatically
-- granted to Data API roles. Make intended privileges explicit and ensure
-- authenticated writes cannot target a hidden/cross-account contact.
-- ============================================================

-- No Relationship OS data is public.
REVOKE ALL ON TABLE public.relationship_memory_entries FROM anon;
REVOKE ALL ON TABLE public.relationship_commitments FROM anon;
REVOKE ALL ON TABLE public.relationship_signals FROM anon;
REVOKE ALL ON TABLE public.relationship_recommendations FROM anon;
REVOKE ALL ON TABLE public.relationship_links FROM anon;
REVOKE ALL ON TABLE public.ai_decision_traces FROM anon;

-- Browser clients can work only through RLS. Decision traces are read-only to
-- authenticated browser sessions; writes are performed by trusted server paths.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.relationship_memory_entries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.relationship_commitments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.relationship_signals TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.relationship_recommendations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.relationship_links TO authenticated;
GRANT SELECT ON TABLE public.ai_decision_traces TO authenticated;

-- Server-side service role must retain full access for best-effort AI tracing,
-- automation and future intelligence processors.
GRANT ALL ON TABLE public.relationship_memory_entries TO service_role;
GRANT ALL ON TABLE public.relationship_commitments TO service_role;
GRANT ALL ON TABLE public.relationship_signals TO service_role;
GRANT ALL ON TABLE public.relationship_recommendations TO service_role;
GRANT ALL ON TABLE public.relationship_links TO service_role;
GRANT ALL ON TABLE public.ai_decision_traces TO service_role;

-- -----------------------------
-- Durable memory
-- -----------------------------
DROP POLICY IF EXISTS relationship_memory_insert ON public.relationship_memory_entries;
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

DROP POLICY IF EXISTS relationship_memory_update ON public.relationship_memory_entries;
CREATE POLICY relationship_memory_update ON public.relationship_memory_entries
  FOR UPDATE TO authenticated
  USING (
    public.is_account_operational(account_id, 'agent')
    AND public.is_account_feature_enabled(account_id, 'contacts')
    AND EXISTS (
      SELECT 1 FROM public.contacts contact
      WHERE contact.id = relationship_memory_entries.contact_id
        AND contact.account_id = relationship_memory_entries.account_id
    )
  )
  WITH CHECK (
    public.is_account_operational(account_id, 'agent')
    AND public.is_account_feature_enabled(account_id, 'contacts')
    AND EXISTS (
      SELECT 1 FROM public.contacts contact
      WHERE contact.id = relationship_memory_entries.contact_id
        AND contact.account_id = relationship_memory_entries.account_id
    )
  );

-- -----------------------------
-- Commitments
-- -----------------------------
DROP POLICY IF EXISTS relationship_commitments_insert ON public.relationship_commitments;
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
    AND (
      relationship_commitments.conversation_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.conversations conversation
        WHERE conversation.id = relationship_commitments.conversation_id
          AND conversation.account_id = relationship_commitments.account_id
          AND conversation.contact_id = relationship_commitments.contact_id
      )
    )
  );

DROP POLICY IF EXISTS relationship_commitments_update ON public.relationship_commitments;
CREATE POLICY relationship_commitments_update ON public.relationship_commitments
  FOR UPDATE TO authenticated
  USING (
    public.is_account_operational(account_id, 'agent')
    AND public.is_account_feature_enabled(account_id, 'contacts')
    AND EXISTS (
      SELECT 1 FROM public.contacts contact
      WHERE contact.id = relationship_commitments.contact_id
        AND contact.account_id = relationship_commitments.account_id
    )
  )
  WITH CHECK (
    public.is_account_operational(account_id, 'agent')
    AND public.is_account_feature_enabled(account_id, 'contacts')
    AND EXISTS (
      SELECT 1 FROM public.contacts contact
      WHERE contact.id = relationship_commitments.contact_id
        AND contact.account_id = relationship_commitments.account_id
    )
    AND (
      relationship_commitments.conversation_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.conversations conversation
        WHERE conversation.id = relationship_commitments.conversation_id
          AND conversation.account_id = relationship_commitments.account_id
          AND conversation.contact_id = relationship_commitments.contact_id
      )
    )
  );

-- -----------------------------
-- Signals
-- -----------------------------
DROP POLICY IF EXISTS relationship_signals_insert ON public.relationship_signals;
CREATE POLICY relationship_signals_insert ON public.relationship_signals
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_account_operational(account_id, 'agent')
    AND public.is_account_feature_enabled(account_id, 'contacts')
    AND EXISTS (
      SELECT 1 FROM public.contacts contact
      WHERE contact.id = relationship_signals.contact_id
        AND contact.account_id = relationship_signals.account_id
    )
    AND (
      relationship_signals.conversation_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.conversations conversation
        WHERE conversation.id = relationship_signals.conversation_id
          AND conversation.account_id = relationship_signals.account_id
          AND conversation.contact_id = relationship_signals.contact_id
      )
    )
  );

DROP POLICY IF EXISTS relationship_signals_update ON public.relationship_signals;
CREATE POLICY relationship_signals_update ON public.relationship_signals
  FOR UPDATE TO authenticated
  USING (
    public.is_account_operational(account_id, 'agent')
    AND public.is_account_feature_enabled(account_id, 'contacts')
    AND EXISTS (
      SELECT 1 FROM public.contacts contact
      WHERE contact.id = relationship_signals.contact_id
        AND contact.account_id = relationship_signals.account_id
    )
  )
  WITH CHECK (
    public.is_account_operational(account_id, 'agent')
    AND public.is_account_feature_enabled(account_id, 'contacts')
    AND EXISTS (
      SELECT 1 FROM public.contacts contact
      WHERE contact.id = relationship_signals.contact_id
        AND contact.account_id = relationship_signals.account_id
    )
    AND (
      relationship_signals.conversation_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.conversations conversation
        WHERE conversation.id = relationship_signals.conversation_id
          AND conversation.account_id = relationship_signals.account_id
          AND conversation.contact_id = relationship_signals.contact_id
      )
    )
  );

-- -----------------------------
-- Explainable recommendations
-- -----------------------------
DROP POLICY IF EXISTS relationship_recommendations_insert ON public.relationship_recommendations;
CREATE POLICY relationship_recommendations_insert ON public.relationship_recommendations
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_account_operational(account_id, 'agent')
    AND public.is_account_feature_enabled(account_id, 'contacts')
    AND EXISTS (
      SELECT 1 FROM public.contacts contact
      WHERE contact.id = relationship_recommendations.contact_id
        AND contact.account_id = relationship_recommendations.account_id
    )
    AND (
      relationship_recommendations.conversation_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.conversations conversation
        WHERE conversation.id = relationship_recommendations.conversation_id
          AND conversation.account_id = relationship_recommendations.account_id
          AND conversation.contact_id = relationship_recommendations.contact_id
      )
    )
  );

DROP POLICY IF EXISTS relationship_recommendations_update ON public.relationship_recommendations;
CREATE POLICY relationship_recommendations_update ON public.relationship_recommendations
  FOR UPDATE TO authenticated
  USING (
    public.is_account_operational(account_id, 'agent')
    AND public.is_account_feature_enabled(account_id, 'contacts')
    AND EXISTS (
      SELECT 1 FROM public.contacts contact
      WHERE contact.id = relationship_recommendations.contact_id
        AND contact.account_id = relationship_recommendations.account_id
    )
  )
  WITH CHECK (
    public.is_account_operational(account_id, 'agent')
    AND public.is_account_feature_enabled(account_id, 'contacts')
    AND EXISTS (
      SELECT 1 FROM public.contacts contact
      WHERE contact.id = relationship_recommendations.contact_id
        AND contact.account_id = relationship_recommendations.account_id
    )
    AND (
      relationship_recommendations.conversation_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.conversations conversation
        WHERE conversation.id = relationship_recommendations.conversation_id
          AND conversation.account_id = relationship_recommendations.account_id
          AND conversation.contact_id = relationship_recommendations.contact_id
      )
    )
  );

-- -----------------------------
-- Stakeholder graph links
-- -----------------------------
DROP POLICY IF EXISTS relationship_links_insert ON public.relationship_links;
CREATE POLICY relationship_links_insert ON public.relationship_links
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_account_operational(account_id, 'agent')
    AND public.is_account_feature_enabled(account_id, 'contacts')
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

DROP POLICY IF EXISTS relationship_links_update ON public.relationship_links;
CREATE POLICY relationship_links_update ON public.relationship_links
  FOR UPDATE TO authenticated
  USING (
    public.is_account_operational(account_id, 'agent')
    AND public.is_account_feature_enabled(account_id, 'contacts')
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
  )
  WITH CHECK (
    public.is_account_operational(account_id, 'agent')
    AND public.is_account_feature_enabled(account_id, 'contacts')
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

-- Traces are created by trusted server paths. Remove the authenticated write
-- policies so a browser client cannot forge AI provenance/audit evidence.
DROP POLICY IF EXISTS ai_decision_traces_insert ON public.ai_decision_traces;
DROP POLICY IF EXISTS ai_decision_traces_update ON public.ai_decision_traces;
DROP POLICY IF EXISTS ai_decision_traces_delete ON public.ai_decision_traces;
